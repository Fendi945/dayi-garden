// Server-side protection for every Pages route, including static assets.
// Set WORKBENCH_PASSWORD as a Cloudflare Pages secret (at least 16 characters).
const LOGIN = '/__workbench/login';
const LOGOUT = '/__workbench/logout';
const COOKIE = '__Host-day1_session';
const MAX_AGE = 8 * 60 * 60;
const encoder = new TextEncoder();

function response(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    ...extra,
  } });
}

function welcome(error = '', status = 200) {
  return response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>欢迎 · 大一工作台</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f8f6f3;color:#222;font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;min-height:100svh;display:flex;flex-direction:column}header{padding:30px 40px;border-bottom:1px solid #ddd6cc}.logo{font-family:Georgia,serif;font-size:34px;font-weight:bold;letter-spacing:-2px}.dot{color:#c6402f;font-size:26px;vertical-align:top;letter-spacing:0}main{flex:1;display:grid;place-items:center;padding:48px 24px}.panel{width:100%;max-width:420px}.eyebrow{color:#c6402f;font-size:11px;letter-spacing:3px;margin-bottom:22px}h1{font-size:clamp(28px,6vw,36px);font-weight:500;line-height:1.4;margin:0 0 14px}p{font-size:14px;color:#746e65;line-height:1.8;margin:0 0 36px}label{display:block;font-size:13px;margin-bottom:10px}input{width:100%;border:1px solid #ccc3b8;background:transparent;color:#222;padding:15px;font:inherit;border-radius:4px}input:focus{outline:2px solid #c6402f;outline-offset:2px}button{width:100%;margin-top:18px;border:0;border-radius:4px;background:#c6402f;color:white;padding:15px;font:inherit;cursor:pointer}button:hover{background:#ad3527}.error{min-height:24px;color:#c6402f;font-size:13px;margin:14px 0 0}footer{text-align:center;color:#8c8478;font-size:11px;letter-spacing:1px;padding:24px}@media(max-width:500px){header{padding:24px}}
  </style></head><body><header><span class="logo">dayi</span><span class="dot">•</span></header><main><section class="panel"><div class="eyebrow">DAY1 WORKBENCH</div><h1>新的一天，欢迎来到你的工作台。</h1><p>回到自己的节奏，专注现在最重要的事。</p><form method="post" action="${LOGIN}"><label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="512" placeholder="输入你的密码" autofocus><button type="submit">进入工作台 →</button><div class="error" role="alert">${error}</div></form></section></main><footer>大一 · 私人工作空间</footer></body></html>`, status);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function key(password) {
  return crypto.subtle.importKey('raw', await digest('day1-session-v1:' + password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function hex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function session(password, hostname) {
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  const payload = `${Math.floor(Date.now() / 1000) + MAX_AGE}.${hex(nonce)}`;
  const signature = await crypto.subtle.sign('HMAC', await key(password), encoder.encode(hostname + ':' + payload));
  return payload + '.' + hex(new Uint8Array(signature));
}

async function authenticated(request, password, hostname) {
  const value = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, nonce, signature] = value.split('.');
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + MAX_AGE) return false;
  const bytes = Uint8Array.from(signature.match(/../g), b => parseInt(b, 16));
  return crypto.subtle.verify('HMAC', await key(password), bytes, encoder.encode(hostname + ':' + expires + '.' + nonce));
}

function cookie(value, age = MAX_AGE) {
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const password = env.WORKBENCH_PASSWORD;
  // Never fall back to public assets when the secret is absent or invalid.
  if (typeof password !== 'string' || password.length < 16 || password.length > 512) {
    return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>工作台暂未开放</title><p>私人工作台正在配置访问保护，请稍后再试。</p></html>', 503);
  }
  if (url.protocol !== 'https:') return response('', 308, { Location: 'https://' + url.host + url.pathname + url.search });
  if (url.pathname === LOGIN || url.pathname === LOGOUT) {
    if (request.method === 'POST') {
      if (request.headers.get('Origin') !== url.origin) return response('请求无效，请重新打开登录页面。', 403);
      if (url.pathname === LOGOUT) return response('', 303, { Location: LOGIN, 'Set-Cookie': cookie('', 0) });
      if (Number(request.headers.get('Content-Length') || 0) > 4096) return welcome('密码不正确，请重试。', 401);
      let supplied;
      try {
        supplied = (await request.formData()).get('password');
      } catch {
        return welcome('请求无效，请重试。', 400);
      }
      if (typeof supplied !== 'string' || supplied.length > 512 || !equal(await digest(supplied), await digest(password))) {
        return welcome('密码不正确，请重试。', 401);
      }
      return response('', 303, { Location: '/', 'Set-Cookie': cookie(await session(password, url.hostname)) });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return response('', 405, { Allow: 'GET, HEAD, POST' });
    if (url.pathname === LOGOUT) return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>退出工作台</title><form method="post"><button>退出工作台</button></form></html>');
    if (await authenticated(request, password, url.hostname)) return response('', 303, { Location: '/' });
    return welcome();
  }
  if (!await authenticated(request, password, url.hostname)) {
    return response('', 303, { Location: LOGIN });
  }
  const upstream = await context.next();
  const result = new Response(upstream.body, upstream);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  return result;
}
