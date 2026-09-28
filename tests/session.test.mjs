import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../workbench/session.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
function setup(overrides={}){
  const root={fetch,AbortController,setTimeout,clearTimeout,Date};vm.createContext(root);vm.runInContext(code,root);
  let callback,session={user:{id:'synthetic-owner'},access_token:'fake-test-token',expires_at:Date.now()/1000+3600};
  const state={shown:0,cleared:0,recovered:0,refreshes:0,signedOut:0};
  const auth={onAuthStateChange:f=>{callback=f},getSession:async()=>({data:{session}}),refreshSession:async()=>{state.refreshes++;await tick();session={...session,expires_at:Date.now()/1000+3600};return {data:{session}}},signOut:async()=>{state.signedOut++;session=null;callback('SIGNED_OUT',null);return {}},...overrides.auth};
  const control=root.Day1Session.create({publicKey:'public-test',onSession:()=>state.shown++,onSignedOut:()=>state.cleared++,onRecovery:()=>state.recovered++,...overrides,auth});
  return {control,state,event:(event,s=session)=>callback(event,s),expire:()=>session.expires_at=0.1};
}
test('refresh and same-user sign-in preserve the active interface',async()=>{const h=setup();await h.control.start();h.event('TOKEN_REFRESHED');await tick();h.event('SIGNED_IN');await tick();assert.equal(h.state.shown,1);assert.equal(h.state.cleared,0)});
test('recovery enters account without resetting the app',async()=>{const h=setup();await h.control.start();h.event('PASSWORD_RECOVERY');await tick();assert.equal(h.state.recovered,1);assert.equal(h.state.shown,1)});
test('parallel calls share one refresh, and each POST executes once',async()=>{let posts=0;const h=setup({fetcher:async()=>{posts++;return Response.json({ok:true})}});await h.control.start();h.expire();await Promise.all([h.control.api('/a',{}),h.control.api('/b',{})]);assert.equal(h.state.refreshes,1);assert.equal(posts,2)});
test('sign-out clears private state and discards an already running response',async()=>{let release,started;const ready=new Promise(r=>started=r);const h=setup({fetcher:async()=>{started();return new Promise(r=>release=r)}});await h.control.start();const pending=h.control.api('/data',{});await ready;await h.control.signOut();release(Response.json({private:'old-user-data'}));await assert.rejects(pending,/登录状态已变化/);assert.equal(h.state.cleared,1);await assert.rejects(h.control.api('/data',{}),/重新登录/)});
test('network failure preserves login and never replays mutations',async()=>{let posts=0;const h=setup({fetcher:async()=>{posts++;throw Error('offline')}});await h.control.start();await assert.rejects(h.control.api('/save',{}),/offline/);assert.equal(posts,1);assert.equal(h.state.cleared,0);assert.equal(h.state.signedOut,0)});
test('hung request times out without deleting the session',async()=>{const h=setup({timeout:10,fetcher:async(url,opts)=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}))))});await h.control.start();await assert.rejects(h.control.api('/data',{}),/请求超时/);assert.equal(h.state.signedOut,0)});
test('initial stale restore cannot reverse sign-out event',async()=>{let release;const h=setup({auth:{getSession:()=>new Promise(r=>release=r)}});const pending=h.control.start();h.event('SIGNED_OUT',null);release({data:{session:{user:{id:'old'}}}});await pending;await tick();assert.equal(h.state.shown,0)});
