import {SUPABASE_URL,PUBLIC_KEY,API_URL} from '../config.mjs';
const $=id=>document.getElementById(id),SESSION='dayi_admin_v2';
let session,refreshPromise,days=7,filter='all',offset=0,loading=false,deliveryOrder=null,previewUrl=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function message(t){$('feedback').textContent=t;}
function saveSession(x){session=x;if(x)sessionStorage.setItem(SESSION,JSON.stringify(x));else sessionStorage.removeItem(SESSION);}
async function refreshToken(){
 if(refreshPromise)return refreshPromise;
 refreshPromise=(async()=>{if(!session?.refresh_token)throw Error('请重新登录。');const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){saveSession(null);showLogin();throw Error('登录已过期，请重新登录。');}saveSession(await r.json());})();
 try{await refreshPromise;}finally{refreshPromise=null;}
}
export async function api(action,data={},form=null,retried=false){
 if(session?.expires_at&&session.expires_at*1000<Date.now()+30000)await refreshToken();
 const headers={apikey:PUBLIC_KEY,Authorization:'Bearer '+session?.access_token};
 let body;if(form){form.set('action',action);for(const[k,v]of Object.entries(data))form.set(k,String(v));body=form;}else{headers['Content-Type']='application/json';body=JSON.stringify({action,...data});}
 let r;try{r=await fetch(API_URL,{method:'POST',headers,body,signal:AbortSignal.timeout(75000)});}catch{throw Error('连接暂时中断，已保存的操作会保留。请刷新核对。');}
 if(r.status===401&&!retried){await refreshToken();return api(action,data,form,true);}
 const x=await r.json();if(!r.ok)throw Error(x.message||'本次操作未完成。');return x;
}
function showLogin(){$('login').classList.remove('hidden');$('workspace').classList.add('hidden');$('logout').classList.add('hidden');}
async function status(){const x=await api('admin_business_status');$('serviceStatus').textContent=x.automatic?'核对实际到账后，订单会自动处理；需要跟进的订单会留在这里。':'核对到账后安排反馈；方向图与3条建议核对完整后交付。';}
async function metrics(){const m=await api('admin_metrics',{days});for(const k of ['pending','submitted','completed'])$(k).textContent=m[k]??0;$('revenue').textContent='¥'+Number(m.revenue||0).toFixed(2);$('paidCount').textContent=(m.paid||0)+'笔已确认到账';$('funnel').textContent='本期访问 '+(m.visitors||0)+' · 提交 '+(m.submitted||0)+' · 到账 '+(m.paid||0)+' · 完整交付 '+(m.completed||0);}
const statusNames={waiting_payment_verification:'待核对到账',pending_generation:'待安排反馈',queued:'等待处理',generating:'处理中',completed:'已交付',failed:'需要跟进'};
const time=v=>v?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—';
async function orders(append=false){
 if(loading)return;loading=true;
 try{if(!append){offset=0;$('orders').replaceChildren();}const x=await api('admin_business_orders',{offset,filter});if(!append&&!x.orders.length)$('orders').innerHTML='<p class="empty">'+(filter==='drafts'?'没有尚未提交完成的草稿。':'当前分类暂无记录，可切换“全部已提交”查看。')+'</p>';
 for(const o of x.orders){const el=document.createElement('article');el.className='order';const complete=o.process_status==='completed'&&o.advice_json?.length===3&&o.result_a_path;
 const paid=['confirmed','paid','verified'].includes(o.payment_status);
 const label=o.checkout_stage==='draft'?'未提交完成':complete?'已交付':o.process_status==='completed'?'历史反馈待补齐':statusNames[o.process_status]||'待跟进';
 el.innerHTML=`<div class="order-top"><b class="order-code">${esc(o.order_code)}</b><span class="amount">¥${Number(o.amount_cny||0).toFixed(2)}</span></div><div class="order-meta"><span class="badge">${esc(label)}</span><span>${paid?'已确认到账':'待核对到账'}</span><span>${esc(time(o.created_at))}</span></div><p><b>${esc(o.contact||'未留联系方式')}</b></p><p class="sub">${esc(o.style)} · ${esc(o.yard_size)} · ${esc((o.needs||[]).join('、'))}</p>${o.notes?'<p class="sub">'+esc(o.notes)+'</p>':''}<p class="sub">现场照片：${o.has_photo?'已提交':'待补齐'} · 付款凭证：${o.has_proof?'已提交':'待补齐'}${paid?' · 到账确认：'+esc(time(o.paid_at)):''}</p>${complete?'<p class="sub" data-view-status>'+ (o.result_first_viewed_at?'结果页已展示 · '+esc(time(o.result_first_viewed_at)):'尚无查看记录（本版反馈）')+'</p>':''}${o.process_status==='failed'?'<p class="error">这笔反馈需要继续跟进，订单和款项记录已保留。</p>':''}<details data-materials><summary>客户原图与付款凭证</summary><div class="detail-grid" data-images></div></details><details data-prompt><summary>查看 / 复制生图提示词</summary><p class="sub" data-prompt-note></p><pre class="prompt-box" data-prompt-text></pre><button type="button" class="action-secondary" data-copy-prompt disabled>复制提示词</button></details>${o.image_url?'<img class="detail-img" src="'+esc(o.image_url)+'" alt="本次反馈方向图" loading="lazy">':''}${o.advice_json?.length?'<ol>'+o.advice_json.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ol>':''}<details data-history><summary>查看反馈交付记录</summary><div data-deliveries></div></details><div class="order-actions"></div>`;
 el.querySelector('[data-materials]').addEventListener('toggle',async e=>{const area=el.querySelector('[data-images]');if(!e.target.open||area.childElementCount)return;try{const a=await api('admin_order_images',{order_code:o.order_code});area.innerHTML=['yard','proof'].map(k=>a[k]?'<div><p class="sub">'+(k==='yard'?'原院照片':'付款凭证')+'</p><a href="'+esc(a[k])+'" target="_blank" rel="noopener noreferrer">打开原尺寸图片</a><img class="detail-img" src="'+esc(a[k])+'" alt="'+(k==='yard'?'原院照片':'付款凭证')+'"></div>':'').join('');}catch(err){message(err.message);}});
 let promptText='';
 el.querySelector('[data-prompt]').addEventListener('toggle',async e=>{if(!e.target.open||promptText)return;const note=el.querySelector('[data-prompt-note]');note.textContent='正在读取提示词…';try{const p=await api('admin_order_prompt',{order_code:o.order_code});promptText=p.prompt;note.textContent=p.note;el.querySelector('[data-prompt-text]').textContent=promptText;el.querySelector('[data-copy-prompt]').disabled=false;}catch(err){note.textContent=err.message;}});
 el.querySelector('[data-copy-prompt]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(promptText);message('提示词已复制。');}catch{const range=document.createRange();range.selectNodeContents(el.querySelector('[data-prompt-text]'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);message('浏览器未允许自动复制，已选中文字，可长按复制或按 Ctrl+C。');}});
 el.querySelector('[data-history]').addEventListener('toggle',async e=>{if(!e.target.open)return;try{const h=await api('admin_history',{order_code:o.order_code});el.querySelector('[data-deliveries]').innerHTML=h.deliveries.length?h.deliveries.map(d=>'<p class="sub">第 '+d.version+' 版 · '+esc(time(d.created_at))+' · '+(d.first_viewed_at?'结果页已展示：'+esc(time(d.first_viewed_at)):'暂无查看记录')+'</p><img class="detail-img" src="'+esc(d.image_url)+'" alt="已交付方向图"><ol>'+d.advice.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ol>').join(''):'<p class="sub">暂无历史版本；现有结果显示在订单中。</p>';}catch(err){message(err.message);}});
 const actions=el.querySelector('.order-actions');
 function action(label,fn,disabled=false){const b=document.createElement('button');b.className='action-primary';b.textContent=label;b.disabled=disabled;b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){message(e.message);}finally{b.disabled=false;}});actions.append(b);}
 if(o.checkout_stage!=='draft'&&o.payment_status==='pending_verification'&&o.has_photo&&o.has_proof&&o.contact)action('已核对实际到账，确认收款',async()=>{await api('admin_confirm',{order_code:o.order_code});message('到账已确认并保存。');await Promise.all([metrics(),orders()]);});
 if(!o.production_active)action(complete?'上传新版效果图':'上传效果图并交付',()=>openDelivery(o),!paid||o.checkout_stage==='draft');
 if(complete)action('复制客户结果链接',async()=>{
  const x=await api('admin_result_link',{order_code:o.order_code});const url=new URL('../',location.href);url.hash=new URLSearchParams({order:x.order_code,key:x.access_token}).toString();
  let box=el.querySelector('[data-result-link]');if(!box){box=document.createElement('div');box.dataset.resultLink='';const label=document.createElement('label');label.textContent='客户结果链接（有效期30天）';const input=document.createElement('input');input.readOnly=true;input.setAttribute('aria-label','客户结果链接');input.style.cssText='display:block;width:100%;min-width:0;margin:8px 0';label.append(input);box.append(label);const note=document.createElement('p');note.className='sub';note.textContent='请单独发给对应客户；持有链接即可查看。打开链接测试也会计入查看记录。';box.append(note);el.append(box);}const input=box.querySelector('input');input.value=url.href;
  try{await navigator.clipboard.writeText(url.href);message('客户结果链接已复制，请通过客户留下的联系方式发送。');}catch{input.focus();input.select();message('结果链接已生成并选中，请长按复制或按 Ctrl+C。');}
 });
 if(!paid){const note=document.createElement('p');note.className='action-note';note.textContent=o.checkout_stage==='draft'?'客户尚未完成提交，暂不能确认收款或交付。':'核对实际到账并确认收款后，即可上传效果图、填写3条建议并回传。';el.append(note);}
 $('orders').append(el);}
 offset+=x.orders.length;$('orderListSummary').textContent=(filter==='drafts'?'未完成提交的草稿':'当前分类的已提交记录')+'：已显示 '+offset+' 条';$('more').classList.toggle('hidden',x.orders.length<25);
 }finally{loading=false;}
}
async function openDelivery(o){
 const imgs=await api('admin_order_images',{order_code:o.order_code});deliveryOrder=o;$('deliveryForm').reset();$('deliveryOrder').textContent=o.order_code+' · '+(o.contact||'未留联系方式');$('deliveryOriginal').src=imgs.yard;$('deliveryPreview').hidden=true;$('deliveryMessage').textContent='';[1,2,3].forEach((n,i)=>$('advice'+n).value=o.advice_json?.[i]||'');$('deliveryDialog').showModal();
}
async function load(){await status();$('login').classList.add('hidden');$('workspace').classList.remove('hidden');$('logout').classList.remove('hidden');await Promise.all([metrics(),orders()]);}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginButton').disabled=true;message('');try{const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});const x=await r.json();if(!r.ok)throw Error('邮箱或密码未通过验证，请检查后重试。');saveSession(x);$('password').value='';await load();}catch(err){message(err.message);}finally{$('loginButton').disabled=false;}});
$('logout').addEventListener('click',()=>{saveSession(null);showLogin();});
$('closeDelivery').addEventListener('click',()=>$('deliveryDialog').close());
$('deliveryImage').addEventListener('change',()=>{const f=$('deliveryImage').files[0];if(!f)return;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(f);$('deliveryPreview').src=previewUrl;$('deliveryPreview').hidden=false;});
$('deliveryForm').addEventListener('submit',async e=>{e.preventDefault();if(!deliveryOrder)return;$('publishDelivery').disabled=true;$('deliveryMessage').textContent='正在保存反馈…';try{const f=$('deliveryImage').files[0];if(!f||f.size>6*1024*1024)throw Error('请选择6MB以内的反馈图片。');const form=new FormData();form.set('file',f);const advice=[1,2,3].map(n=>$('advice'+n).value.trim());await api('admin_deliver',{order_code:deliveryOrder.order_code,expected_updated_at:deliveryOrder.updated_at,advice:JSON.stringify(advice)},form);$('deliveryDialog').close();message('反馈已保存。请查看本版查看状态，或复制客户结果链接发送给客户。');await Promise.all([metrics(),orders()]);}catch(err){$('deliveryMessage').textContent=err.message+' 若订单已有变化，请关闭并刷新后重新核对。';}finally{$('publishDelivery').disabled=false;}});
$('refresh').addEventListener('click',()=>Promise.all([status(),metrics(),orders()]).catch(e=>message(e.message)));
$('more').addEventListener('click',()=>orders(true).catch(e=>message(e.message)));
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(a=>a.classList.toggle('active',a===b));metrics().catch(e=>message(e.message));}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(a=>a.classList.toggle('active',a===b));orders().catch(e=>message(e.message));}));
try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{}
if(session)load().catch(e=>{showLogin();message(e.message);});
setInterval(()=>{if(session&&!document.hidden&&!loading&&offset<=25&&!$('deliveryDialog').open)Promise.all([metrics(),orders()]).catch(()=>{});},30000);
