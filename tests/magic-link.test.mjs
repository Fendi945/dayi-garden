import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../workbench/session.js', import.meta.url), 'utf8');
function setup({request = async () => ({}), entries = new Map(), deniedStorage = false} = {}) {
  const runtime = {fetch, AbortController, setTimeout, clearTimeout, Date};
  vm.createContext(runtime); vm.runInContext(source, runtime);
  let time = 1000000, sequence = 0;
  const timers = new Map(), calls = [], states = [];
  const storage = {
    getItem(key) { if (deniedStorage) throw Error('storage disabled'); return entries.get(key); },
    setItem(key, value) { if (deniedStorage) throw Error('storage disabled'); entries.set(key, value); }
  };
  function create() {
    return runtime.Day1Session.createMagicLinkSender({
      auth: {signInWithOtp: async args => { calls.push(args); return request(args); }},
      onState: state => states.push(state), storage, now: () => time,
      schedule: (callback, delay) => { const id = ++sequence; timers.set(id, {callback, due:time + delay}); return id; },
      cancel: id => timers.delete(id)
    });
  }
  function advance(milliseconds) {
    time += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= time) { timers.delete(id); timer.callback(); }
  }
  return {create, advance, calls, states, entries, state: () => states.at(-1)};
}
const email = 'synthetic-owner@example.test', redirect = 'https://example.test/workbench/';

test('one click sequence sends one email and never claims a signed-in session', async () => {
  let finish;
  const h = setup({request: () => new Promise(resolve => { finish = resolve; })});
  const sender = h.create(), first = sender.send(email, redirect);
  assert.equal(h.state().disabled, true);
  assert.equal(await sender.send(email, redirect), false);
  finish({}); assert.equal(await first, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.shouldCreateUser, false);
  assert.equal(h.calls[0].options.emailRedirectTo, redirect);
  assert.match(h.state().message, /尚未完成登录/);
  assert.equal(h.state().retrySeconds, 60);
  h.advance(60000);
  assert.equal(h.state().disabled, false);
  assert.equal(h.calls.length, 1, 'timer must not automatically resend');
});

test('reload preserves resend cooldown without storing an email or credential', async () => {
  const h = setup(), first = h.create();
  await first.send(email, redirect);
  const reloaded = h.create();
  assert.equal(await reloaded.send(email, redirect), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.entries.size, 1);
  assert.ok([...h.entries.values()].every(value => /^\d+$/.test(value)));
  assert.ok(!JSON.stringify([...h.entries]).includes(email));
  h.advance(60000);
  assert.equal(await reloaded.send(email, redirect), true);
  assert.equal(h.calls.length, 2, 'a new explicit click can resend after cooldown');
});

test('observed signup and rate-limit failures have actionable safe messages', async () => {
  let error = {code:'signup_disabled', message:'Signups not allowed for otp'};
  const h = setup({request: async () => ({error})}), sender = h.create();
  assert.equal(await sender.send(email, redirect), false);
  assert.match(h.state().message, /DAY1 后台邮箱/);
  assert.equal(h.state().disabled, false, 'a mistaken email can be corrected');
  error = {status:429, code:'over_email_send_rate_limit', message:'email rate limit exceeded'};
  await sender.send(email, redirect);
  assert.match(h.state().message, /查看收件箱/);
  assert.equal(h.state().disabled, true);
  await sender.send(email, redirect);
  assert.equal(h.calls.length, 2);
  h.advance(60000); error = {message:'provider diagnostic that must not be displayed'};
  await sender.send(email, redirect);
  assert.doesNotMatch(h.state().message, /provider diagnostic/);
});

test('ambiguous network failure does not retry, including when storage is unavailable', async () => {
  const h = setup({deniedStorage:true, request: async () => { throw Error('timeout after send'); }}), sender = h.create();
  assert.equal(await sender.send(email, redirect), false);
  assert.match(h.state().message, /无法确认邮件是否发出/);
  assert.equal(h.state().disabled, true);
  await sender.send(email, redirect); h.advance(60000);
  assert.equal(h.calls.length, 1);
  assert.equal(h.state().disabled, false);
});
