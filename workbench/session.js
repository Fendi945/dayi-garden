/* Session infrastructure only. No stored credentials or application data here. */
(function (root) {
  async function fetchWithTimeout(url, options = {}, milliseconds = 30000, fetcher = root.fetch.bind(root)) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, milliseconds);
    try { return await fetcher(url, {...options, signal: controller.signal}); }
    finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  }
  function createMagicLinkSender({auth, onState, storage, now = Date.now, schedule = setTimeout, cancel = clearTimeout}) {
    const key = 'day1.auth.emailRetryAt.v1', cooldown = 60000;
    let pending = false, retryAt = 0, timer = null, message = '';
    if (storage === undefined) { try { storage = root.localStorage; } catch {} }
    function savedRetryAt() {
      try {
        const value = Number(storage?.getItem(key));
        return Number.isFinite(value) && value > now() && value <= now() + cooldown ? value : 0;
      } catch { return 0; }
    }
    function pauseResend() {
      retryAt = now() + cooldown;
      // Persist only the deadline, never an email, credential or session.
      try { storage?.setItem(key, String(retryAt)); } catch {}
    }
    function render() {
      retryAt = Math.max(retryAt, savedRetryAt());
      const retrySeconds = Math.max(0, Math.ceil((retryAt - now()) / 1000));
      if (timer !== null) cancel(timer);
      timer = null;
      onState({pending, retrySeconds, disabled: pending || retrySeconds > 0, message});
      // This timer updates the button only; it never sends a request.
      if (retrySeconds) timer = schedule(render, Math.min(1000, retryAt - now()));
    }
    async function send(email, redirectTo) {
      retryAt = Math.max(retryAt, savedRetryAt());
      if (pending || retryAt > now()) { render(); return false; }
      email = String(email || '').trim();
      if (!email) { message = '请输入已开通的 DAY1 后台邮箱。'; render(); return false; }
      pending = true; message = '正在发送登录链接…'; render();
      try {
        const {error} = await auth.signInWithOtp({email, options: {shouldCreateUser: false, emailRedirectTo: redirectTo}});
        if (error) {
          if (error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code) || /rate limit/i.test(error.message || '')) {
            pauseResend();
            message = '暂时无法发送更多登录邮件，请先查看收件箱或稍后重试。已设置后台密码时可使用密码登录。';
          } else if (error.code === 'signup_disabled' || /signups? not allowed/i.test(error.message || '')) {
            message = '请使用已开通的 DAY1 后台邮箱，本页不支持注册。';
          } else {
            message = '登录链接未发送成功，请检查后台邮箱后稍后重试。';
          }
          return false;
        }
        pauseResend();
        message = '登录邮件已发送，尚未完成登录。请在希望使用 DAY1 的浏览器中打开最新邮件里的链接，进入工作台后才算登录成功。';
        return true;
      } catch {
        // A timeout can occur after the service accepted the email request.
        pauseResend();
        message = '暂时无法确认邮件是否发出。请先查看收件箱，再尝试重发。';
        return false;
      } finally { pending = false; render(); }
    }
    retryAt = savedRetryAt();
    if (retryAt) message = '登录邮件暂不可重发，请先查看收件箱。';
    render();
    return {send};
  }
  function create({auth, publicKey, onSession, onSignedOut, onRecovery, fetcher = root.fetch.bind(root), timeout = 30000}) {
    let userId = null, epoch = 0, refresh = null, eventVersion = 0;
    const pending = new Set();
    function apply(session, recovery = false) {
      const next = session?.user?.id || null;
      if (next !== userId) {
        epoch++; pending.forEach(c => c.abort()); pending.clear(); refresh = null;
        userId = next;
        if (next) onSession(session); else onSignedOut();
      }
      if (next && recovery) onRecovery();
    }
    async function token() {
      const captured = epoch;
      let {data, error} = await auth.getSession();
      if (error) throw error;
      let session = data?.session;
      if (!session || !userId) throw Error('请重新登录。');
      if (session.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
        if (!refresh) {
          const attempt = auth.refreshSession();
          refresh = attempt;
          attempt.finally(() => { if (refresh === attempt) refresh = null; }).catch(() => {});
        }
        const result = await refresh;
        if (result.error) throw Error('暂时无法刷新登录，请检查网络后重试。');
        session = result.data?.session;
      }
      if (captured !== epoch || !session || session.user.id !== userId) throw Error('登录状态已变化，请重试。');
      return session.access_token;
    }
    async function api(url, body) {
      const captured = epoch;
      const bearer = await token();
      if (captured !== epoch) throw Error('登录状态已变化，请重试。');
      const controller = new AbortController(); pending.add(controller);
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetchWithTimeout(url, {method: 'POST', signal: controller.signal, headers: {apikey: publicKey, Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json'}, body: JSON.stringify(body || {})}, timeout, fetcher);
        const value = await response.json().catch(() => ({}));
        if (captured !== epoch) throw Error('登录状态已变化，请重试。');
        if (!response.ok) {
          // No automatic replay: a failed POST may already have changed server state.
          if (response.status === 401) throw Error('登录验证未通过，请重新登录。');
          throw Error(value.message || value.error || ('请求失败 ' + response.status));
        }
        return value;
      } catch (error) {
        if (captured !== epoch) throw Error('登录状态已变化，请重试。');
        if (error.name === 'AbortError') throw Error('请求超时，请检查网络后重试；请先确认上次操作是否完成。');
        throw error;
      } finally { clearTimeout(timer); pending.delete(controller); }
    }
    async function start() {
      auth.onAuthStateChange((event, session) => {
        const version = ++eventVersion;
        // Supabase auth callbacks run under its session lock. Defer API work.
        setTimeout(() => { if (version === eventVersion) apply(session, event === 'PASSWORD_RECOVERY'); }, 0);
      });
      const before = eventVersion;
      const {data, error} = await auth.getSession();
      if (error) throw error;
      if (before === eventVersion) apply(data?.session);
      if (!data?.session && !userId) onSignedOut();
    }
    async function signOut() {
      eventVersion++; apply(null);
      const {error} = await auth.signOut({scope: 'local'});
      if (error) throw Error('退出未完成，请检查网络后再次退出。');
    }
    return {start, api, signOut};
  }
  root.Day1Session = {create, fetchWithTimeout, createMagicLinkSender};
})(globalThis);
