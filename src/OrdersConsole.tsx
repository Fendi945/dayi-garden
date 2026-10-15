import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Camera, CircleAlert, CreditCard, LockKeyhole, LogOut, RefreshCw, Search } from "lucide-react";

const API = "https://fhvhnibznphatfnbvvnb.supabase.co";
const PUBLIC_KEY = "sb_publishable_8_ElUXtWKbEM9Of37zdYug_mdWjcV4B";
const SESSION_KEY = "day1-orders-admin-session-v1";

type Session = { access_token: string; refresh_token: string; expires_at: number };
type Order = {
  id: string; created_at: string; updated_at: string | null; order_code: string | null;
  contact: string | null; status: string | null; notes: string | null;
  photo_path: string | null; photo_urls: string | null; payment_proof_path: string | null;
  style: string | null; style_desc: string | null; owner_type: string | null;
  yard_size: string | null; maintenance_level: string | null; needs: string[] | null;
  payment_status: string | null; process_status: string | null; product_code: string | null;
  amount_cny: number | null; payment_method: string | null; paid_at: string | null;
  checkout_stage: string | null; is_test: boolean | null;
};
type Picture = { path: string; url: string | null; error: boolean };

function restoredSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const value = raw ? JSON.parse(raw) as Session : null;
    return value && value.access_token && value.refresh_token ? value : null;
  } catch { return null; }
}
function saveSession(next: Session | null) {
  try {
    if (next) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Private browsing may disable storage. */ }
}
async function apiFetch(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", PUBLIC_KEY);
  if (token) headers.set("Authorization", "Bearer " + token);
  if (init.body) headers.set("Content-Type", "application/json");
  const result = await fetch(API + path, { ...init, headers, cache: "no-store" });
  if (!result.ok) {
    let message = "请求失败（" + result.status + "）";
    try {
      const info = await result.json() as { msg?: string; message?: string; error_description?: string; error?: string };
      message = info.msg || info.message || info.error_description || info.error || message;
    } catch { /* Keep the HTTP status. */ }
    throw new Error(message);
  }
  return result.json();
}
async function freshToken(session: Session, update: (session: Session) => void) {
  if (session.expires_at > Date.now() + 60000) return session.access_token;
  const renewed = await apiFetch("/auth/v1/token?grant_type=refresh_token", null, {
    method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }),
  }) as { access_token: string; refresh_token: string; expires_in: number };
  const next = {
    access_token: renewed.access_token,
    refresh_token: renewed.refresh_token,
    expires_at: Date.now() + renewed.expires_in * 1000,
  };
  update(next);
  return next.access_token;
}
function labelTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : value;
}
const paymentNames: Record<string, string> = {
  pending_verification: "待核实收款", verified: "已核实", paid: "已收款", pending: "待付款", rejected: "未通过",
};
const processNames: Record<string, string> = {
  waiting_payment_verification: "待核实付款", waiting_payment: "待付款",
  pending: "待处理", processing: "处理中", completed: "已完成", failed: "异常待处理",
};
function picturePath(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "object" && input !== null) {
    const obj = input as { path?: unknown; url?: unknown; src?: unknown };
    return picturePath(obj.path || obj.url || obj.src);
  }
  if (typeof input !== "string") return null;
  let name = input.trim();
  if (!name) return null;
  const marker = "order-photos/";
  if (name.includes(marker)) name = name.slice(name.lastIndexOf(marker) + marker.length);
  else if (/^https?:\/\//i.test(name)) return null;
  name = name.split("?")[0].replace(/^\/+/, "");
  try { name = decodeURIComponent(name); } catch { /* Leave malformed paths unchanged. */ }
  if (!name.startsWith("incoming/") || name.includes("..") || name.includes("\\")) return null;
  return name;
}
function photoPaths(order: Order) {
  const candidates: unknown[] = [order.photo_path];
  if (order.photo_urls) {
    try {
      const parsed = JSON.parse(order.photo_urls) as unknown;
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else candidates.push(parsed);
    } catch {
      candidates.push(...order.photo_urls.split(/[\n,;]+/));
    }
  }
  return Array.from(new Set(candidates.map(picturePath).filter((p): p is string => Boolean(p))));
}
async function signedUrl(path: string, token: string): Promise<string> {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const data = await apiFetch("/storage/v1/object/sign/order-photos/" + safePath, token, {
    method: "POST", body: JSON.stringify({ expiresIn: 600 }),
  }) as { signedURL?: string; signedUrl?: string };
  const url = data.signedURL || data.signedUrl;
  if (!url) throw new Error("未能取得图片访问地址");
  if (url.startsWith("https://")) return url;
  if (url.startsWith("/storage/v1/")) return API + url;
  if (url.startsWith("/object/")) return API + "/storage/v1" + url;
  throw new Error("图片访问地址无效");
}
function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div className="border-b border-border py-3"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 break-words text-sm leading-6">{value || "—"}</div></div>;
}
export function OrdersConsole() {
  const [session, setSession] = useState<Session | null>(restoredSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");

  function remember(next: Session | null) {
    saveSession(next);
    setSession(next);
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await apiFetch("/auth/v1/token?grant_type=password", null, {
        method: "POST", body: JSON.stringify({ email: email.trim(), password }),
      }) as { access_token: string; refresh_token: string; expires_in: number };
      remember({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + data.expires_in * 1000 });
      setPassword("");
    } catch (e) {
      setError("管理员登录失败：" + (e instanceof Error ? e.message : "请检查邮箱和密码"));
    } finally { setBusy(false); }
  }
  async function loadOrders() {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const token = await freshToken(session, remember);
      const fields = "id,created_at,updated_at,order_code,contact,status,notes,photo_path,photo_urls,payment_proof_path,style,style_desc,owner_type,yard_size,maintenance_level,needs,payment_status,process_status,product_code,amount_cny,payment_method,paid_at,checkout_stage,is_test";
      const data = await apiFetch("/rest/v1/orders?select=" + fields + "&order=created_at.desc&limit=300", token) as Order[];
      setOrders(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
    } catch (e) {
      setError("读取订单失败：" + (e instanceof Error ? e.message : "请重试") + "。如账号没有管理员权限，将无法读取客户资料。");
    } finally { setBusy(false); }
  }
  useEffect(() => { if (session) void loadOrders(); }, [session?.access_token]);
  const visible = useMemo(() => {
    const word = query.trim().toLowerCase();
    return orders.filter((o) =>
      (showTests || !o.is_test) &&
      (!word || [o.order_code, o.contact, o.notes, o.style, o.style_desc].some((v) => (v || "").toLowerCase().includes(word)))
    );
  }, [orders, query, showTests]);
  const selected = visible.find((o) => o.id === selectedId) || visible[0] || null;
  const genuineCount = orders.filter((o) => !o.is_test).length;
  const pendingCount = orders.filter((o) => !o.is_test && o.payment_status === "pending_verification").length;
  const photoCount = orders.filter((o) => !o.is_test && photoPaths(o).length).length;

  useEffect(() => {
    let cancelled = false;
    setPictures([]); setReceipt(null); setImageError("");
    if (!session || !selected) return;
    const paths = photoPaths(selected);
    setImageBusy(true);
    (async () => {
      try {
        const token = await freshToken(session, remember);
        const list = await Promise.all(paths.map(async (path) => {
          try { return { path, url: await signedUrl(path, token), error: false }; }
          catch { return { path, url: null, error: true }; }
        }));
        let proof: string | null = null;
        const proofPath = picturePath(selected.payment_proof_path);
        if (proofPath) {
          try { proof = await signedUrl(proofPath, token); } catch { /* Receipt is optional. */ }
        }
        if (!cancelled) {
          setPictures(list); setReceipt(proof);
          if (list.some((p) => p.error)) setImageError("部分图片暂时无法加载，可尝试重新选择此订单。");
        }
      } catch (e) {
        if (!cancelled) setImageError("获取图片失败：" + (e instanceof Error ? e.message : "请重试"));
      } finally { if (!cancelled) setImageBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [selected?.id, session?.access_token]);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-14 lg:px-14">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-strong pb-7">
        <div><p className="section-label text-brand">经营 / 订单</p><h1 className="mt-3 font-display text-4xl md:text-5xl">客户订单</h1><p className="mt-3 text-sm text-muted-foreground">客户提交记录、庭院原图、需求和收款进度 · 管理员专用</p></div>
        {session && <div className="flex gap-3">
          <button type="button" onClick={() => void loadOrders()} disabled={busy} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-xs hover:bg-secondary disabled:opacity-50"><RefreshCw className="size-4" />刷新</button>
          <button type="button" onClick={() => { remember(null); setOrders([]); setPictures([]); }} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-xs hover:bg-secondary"><LogOut className="size-4" />退出订单后台</button>
        </div>}
      </div>
      {!session ? (
        <form onSubmit={(event) => void login(event)} className="mx-auto max-w-md border border-border bg-secondary/30 p-7 md:p-9">
          <LockKeyhole className="size-7 text-brand" />
          <h2 className="mt-5 text-xl font-semibold">管理员身份验证</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">为保护客户资料，请使用大一订单系统的管理员邮箱和密码。这里与工作台入口密码是两道不同的保护。</p>
          <label className="mt-8 block text-xs font-medium">管理员邮箱<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required className="mt-2 w-full rounded border border-border bg-background p-3 text-sm outline-brand" placeholder="输入管理员邮箱" /></label>
          <label className="mt-5 block text-xs font-medium">登录密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded border border-border bg-background p-3 text-sm outline-brand" placeholder="输入订单系统密码" /></label>
          {error && <p className="mt-4 text-sm text-brand" role="alert">{error}</p>}
          <button disabled={busy} type="submit" className="mt-7 flex w-full items-center justify-center gap-2 rounded bg-primary p-3 text-sm text-primary-foreground disabled:opacity-60">{busy ? "正在验证..." : "登录查看客户订单"} <ArrowRight className="size-4" /></button>
        </form>
      ) : (
        <>
          {error && <div role="alert" className="mb-6 flex items-start gap-2 border-l-2 border-brand bg-secondary p-4 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-brand" />{error}</div>}
          <div className="mb-8 grid grid-cols-3 divide-x divide-border border-y border-border">
            {[["真实订单", genuineCount], ["待核实收款", pendingCount], ["含照片订单", photoCount]].map(([name, value]) => (
              <div key={name} className="py-5 text-center"><p className="text-[11px] text-muted-foreground">{name}</p><p className="mt-2 font-display text-2xl md:text-3xl">{value}</p></div>
            ))}
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(290px,0.85fr)_minmax(0,1.4fr)]">
            <aside className="min-w-0">
              <div className="flex items-center gap-2 border-b border-border pb-3"><Search className="size-4 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="搜索订单编号、客户或需求" /></div>
              <label className="my-4 flex items-center gap-2 text-xs text-muted-foreground"><input checked={showTests} onChange={(e) => setShowTests(e.target.checked)} type="checkbox" />同时显示测试订单（{orders.length - genuineCount}）</label>
              {busy && orders.length === 0 ? <p className="py-8 text-sm text-muted-foreground">正在读取订单...</p> : visible.length === 0 ? <p className="py-8 text-sm text-muted-foreground">没有符合条件的订单。</p> : (
                <div className="divide-y divide-border border-y border-border">
                  {visible.map((order) => (
                    <button key={order.id} onClick={() => setSelectedId(order.id)} type="button" className={"w-full px-3 py-4 text-left transition-colors hover:bg-secondary " + (selected?.id === order.id ? "border-l-2 border-brand bg-secondary/60" : "border-l-2 border-transparent")}>
                      <div className="flex items-start justify-between gap-3"><span className="break-all text-sm font-semibold">{order.order_code || "未编号订单"}</span><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" /></div>
                      <p className="mt-2 max-w-full truncate text-xs">{order.contact || "未填写联系方式"}{order.is_test ? " · 测试" : ""}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>{labelTime(order.created_at)}</span><span className="text-brand">{paymentNames[order.payment_status || ""] || order.payment_status || "待确认"}</span></div>
                    </button>
                  ))}
                </div>
              )}
            </aside>
            <section className="min-w-0" aria-label="客户订单详情">
              {selected ? (
                <div className="border border-border p-5 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"><div><p className="section-label">订单详情</p><h2 className="mt-2 break-all text-xl font-semibold">{selected.order_code || "未编号订单"}</h2><p className="mt-2 text-xs text-muted-foreground">{labelTime(selected.created_at)}</p></div><span className="rounded border border-border px-3 py-1.5 text-xs text-brand">{processNames[selected.process_status || ""] || selected.process_status || "待处理"}</span></div>
                  <div className="grid gap-x-7 md:grid-cols-2">
                    <Info label="客户联系方式" value={selected.contact} />
                    <Info label="产品 / 服务" value={selected.product_code} />
                    <Info label="订单金额" value={selected.amount_cny == null ? "—" : "¥" + Number(selected.amount_cny).toLocaleString("zh-CN")} />
                    <Info label="付款状态" value={paymentNames[selected.payment_status || ""] || selected.payment_status} />
                    <Info label="付款方式" value={selected.payment_method} />
                    <Info label="庭院面积" value={selected.yard_size} />
                    <Info label="偏好风格" value={[selected.style, selected.style_desc].filter(Boolean).join(" / ")} />
                    <Info label="业主类型 / 维护要求" value={[selected.owner_type, selected.maintenance_level].filter(Boolean).join(" / ")} />
                  </div>
                  <Info label="客户需求" value={Array.isArray(selected.needs) ? selected.needs.join("、") : selected.needs} />
                  <Info label="补充描述" value={selected.notes} />
                  <div className="mt-8 flex items-center gap-2 border-t border-strong pt-6"><Camera className="size-4 text-brand" /><h3 className="text-lg font-semibold">客户上传的庭院照片</h3></div>
                  {imageError && <p role="alert" className="mt-3 text-xs text-brand">{imageError}</p>}
                  {imageBusy ? <p className="mt-5 text-sm text-muted-foreground">正在安全读取原图...</p> : pictures.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">此订单没有可识别的上传图片。</p> : (
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {pictures.map((pic, index) => <div className="min-w-0" key={pic.path}>{pic.url ? <a href={pic.url} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" title="点击查看原图" className="group block"><img loading="lazy" src={pic.url} alt={"客户庭院照片 " + (index + 1)} className="aspect-square w-full rounded border border-border bg-secondary object-cover" /><span className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-brand"><ArrowDownToLine className="size-3" />查看原图 {index + 1}</span></a> : <div className="grid aspect-square place-items-center border border-border bg-secondary text-xs text-muted-foreground">图片不可用</div>}</div>)}
                    </div>
                  )}
                  {receipt && <div className="mt-7 border-t border-border pt-5"><p className="mb-3 flex items-center gap-2 text-sm font-medium"><CreditCard className="size-4" />付款凭证</p><a href={receipt} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="text-sm text-brand underline">查看上传的付款凭证</a></div>}
                  <div className="mt-8 flex items-center gap-2 border-t border-border pt-5 text-[11px] text-muted-foreground"><LockKeyhole className="size-3.5" />照片通过私有存储临时授权读取，不存入公开代码仓库。</div>
                </div>
              ) : <div className="grid min-h-52 place-items-center border border-border p-8 text-sm text-muted-foreground">选择左侧订单查看客户需求与上传图片</div>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
