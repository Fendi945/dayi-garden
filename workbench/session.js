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
  root.Day1Session = {create, fetchWithTimeout};
})(globalThis);
