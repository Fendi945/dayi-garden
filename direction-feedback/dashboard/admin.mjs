import {SUPABASE_URL,PUBLIC_KEY,API_URL} from '../config.mjs';
const $=id=>document.getElementById(id),SESSION='dayi_admin_v2';
let session,refreshPromise,config,days=7,filter='pending',offset=0,loading=false,testId=crypto.randomUUID();
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
async function status(){
 const x=await api('admin_status');config=x.config;
 $('serviceStatus').textContent=config.enabled?'自动交付已开启 · 核对到账后，订单会自动处理。':'正在准备上线 · 客户付款入口暂未开放。';
 $('apiBase').value=config.api_base;$('imageModel').value=config.image_model;$('visionModel').value=config.vision_model;$('minimumScore').value=config.minimum_score;$('enabled').checked=config.enabled;
 $('keyStatus').textContent=x.image_key_configured?'密钥已保存，可开始测试；无需重复填写。':'尚未配置模型密钥。请在阿里云百炼开通服务后填写。';
 $('calibration').textContent=x.calibration.required_types.map(t=>t+'：'+(x.calibration.approved_types.includes(t)?'已核对通过':'待验证')).join('　/　');
 if(!x.image_key_configured)$('settings').open=true;
}
async function metrics(){const m=await api('admin_metrics',{days});for(const k of ['visitors','submitted','completed'])$(k).textContent=m[k]??0;$('revenue').textContent='¥'+Number(m.revenue||0).toFixed(2);$('paidCount').textContent=(m.paid||0)+'笔已确认到账';$('funnel').textContent='访问 '+m.visitors+' → 开始填写 '+m.starts+' → 查看反馈服务 '+m.offers+' → 提交 '+m.submitted+' → 到账 '+m.paid+' → 完整交付 '+m.completed;}
const statusNames={waiting_payment_verification:'待核对到账',pending_generation:'等待接入处理',queued:'排队中',generating:'处理中',completed:'已完成',failed:'需要处理'};
const stageNames={plan:'理解现场',edit:'编辑方向图',download:'保存图片',review:'复核与建议',publish:'交付'};
async function orders(append=false){
 if(loading)return;loading=true;
 try{if(!append){offset=0;$('orders').replaceChildren();}const x=await api('admin_orders',{offset,filter});if(!append&&!x.orders.length)$('orders').innerHTML='<p class="empty">这里暂时没有订单。</p>';
 for(const o of x.orders){const el=document.createElement('article');el.className='order';const complete=o.process_status==='completed'&&o.advice_json?.length===3&&o.result_a_path;
 const label=complete?'已完整交付':o.process_status==='completed'?'历史结果待补齐':statusNames[o.process_status]||o.process_status;
 el.innerHTML=`<div class="order-top"><b class="order-code">${esc(o.order_code)}</b><span class="amount">${o.is_test?'上线测试':'¥'+Number(o.amount_cny||0).toFixed(2)}</span></div><div class="order-meta"><span class="badge">${esc(label)}</span><span>${esc(o.style)}</span><span>${esc(o.yard_size)}</span><span>${esc(new Date(o.created_at).toLocaleString('zh-CN',{hour12:false}))}</span></div><p class="sub">${esc(o.contact||'后台验证现场')} · ${esc((o.needs||[]).join('、'))}</p>${o.notes?'<p class="sub">'+esc(o.notes)+'</p>':''}${o.error_message?'<p class="error">'+esc(o.error_message)+'</p>':''}${o.job?'<p class="sub">当前：'+esc(stageNames[o.job.stage])+' · 已请求出图 '+(o.job.image_count||0)+' 次'+(o.job.last_error?' · '+esc(o.job.last_error):'')+'</p>':''}<details><summary>查看现场与付款凭证</summary><div class="detail-grid" data-images></div></details>${o.image_url?'<img class="detail-img" src="'+esc(o.image_url)+'" alt="本次生成结果" loading="lazy">':''}${o.advice_json?.length?'<ul>'+o.advice_json.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':''}${o.job?.review?'<div class="quality">自动复核：'+esc(o.job.review.total)+' / 100 · '+(o.job.review.accepted?'通过':'未通过')+'<br>'+esc(o.job.review.reasons.join('；')||'请对照原院核对现场关系。')+'</div>':''}<div class="order-actions"></div>`;
 el.querySelector('details').addEventListener('toggle',async e=>{const area=el.querySelector('[data-images]');if(!e.target.open||area.childElementCount)return;try{const a=await api('admin_order_images',{order_code:o.order_code});area.innerHTML=['yard','proof'].map(k=>a[k]?'<div><p class="sub">'+(k==='yard'?'原院照片':'付款凭证')+'</p><img class="detail-img" src="'+esc(a[k])+'" alt="'+(k==='yard'?'原院照片':'付款凭证')+'"></div>':'').join('');}catch(err){message(err.message);}});
 const actions=el.querySelector('.order-actions');
 function action(label,fn){const b=document.createElement('button');b.className='action-primary';b.textContent=label;b.addEventListener('click',async()=>{b.disabled=true;try{await fn();await Promise.all([status(),metrics()]);await orders();message('已保存，后台会继续处理。');}catch(e){message(e.message);}finally{b.disabled=false;}});actions.append(b);}
 if(!o.is_test&&o.payment_status==='pending_verification')action('已核对到账，开始自动处理',()=>api('admin_confirm',{order_code:o.order_code}));
 else if(!complete&&o.job?.last_error!=='ambiguous_image_timeout'&&(!o.job||o.job.state==='failed'))action('继续处理这笔订单',()=>api('admin_retry',{order_code:o.order_code}));
 if(o.is_test&&complete&&!o.calibration_approved_at)action('已对照原院，核对通过',()=>api('admin_approve_test',{order_code:o.order_code}));
 if(o.calibration_approved_at)actions.insertAdjacentHTML('beforeend','<p class="sub">已由大一核对通过。</p>');
 if(o.job?.last_error==='ambiguous_image_timeout'&&(o.job.image_count||0)<2)action('已核实未出图，授权再试一次',()=>api('admin_resume_image',{order_code:o.order_code}));
 if(o.job?.last_error==='ambiguous_image_timeout')actions.insertAdjacentHTML('beforeend','<p class="sub">请先到模型平台核查这次请求是否成功，避免重复扣费。原订单与请求记录已保留。</p>');
 $('orders').append(el);}
 offset+=x.orders.length;$('more').classList.toggle('hidden',x.orders.length<25);
 }finally{loading=false;}
}
async function load(){await status();$('login').classList.add('hidden');$('workspace').classList.remove('hidden');$('logout').classList.remove('hidden');await Promise.all([metrics(),orders()]);}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginButton').disabled=true;message('');try{const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});const x=await r.json();if(!r.ok)throw Error('邮箱或密码未通过验证，请检查后重试。');saveSession(x);$('password').value='';await load();}catch(err){message(err.message);}finally{$('loginButton').disabled=false;}});
$('logout').addEventListener('click',()=>{saveSession(null);showLogin();});
$('configForm').addEventListener('submit',async e=>{e.preventDefault();$('saveConfig').disabled=true;message('正在验证并保存…');try{await api('admin_configure',{api_key:$('apiKey').value.trim(),config:{...config,api_base:$('apiBase').value.trim(),image_model:$('imageModel').value.trim(),vision_model:$('visionModel').value.trim(),minimum_score:Number($('minimumScore').value),max_images:2,enabled:$('enabled').checked}});$('apiKey').value='';await status();message('设置已保存。');}catch(err){message(err.message);}finally{$('saveConfig').disabled=false;}});
$('testPhoto').addEventListener('change',()=>{testId=crypto.randomUUID();});
$('testForm').addEventListener('submit',async e=>{e.preventDefault();$('runTest').disabled=true;try{const f=$('testPhoto').files[0];if(!f||f.size>6*1024*1024)throw Error('请选择6MB以内的 JPG、PNG 或 WebP 现场照片。');const form=new FormData();form.set('file',f);await api('admin_test',{request_id:testId,test_case_type:$('testType').value,details:JSON.stringify({yard_size:'不确定',style:$('testStyle').value,needs:['休闲喝茶','降低维护'],notes:$('testNotes').value})},form);filter='tests';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));await orders();message('测试已进入后台处理。可以关闭页面，稍后回来核对结果。');testId=crypto.randomUUID();}catch(err){message(err.message);}finally{$('runTest').disabled=false;}});
$('refresh').addEventListener('click',()=>Promise.all([status(),metrics(),orders()]).catch(e=>message(e.message)));
$('more').addEventListener('click',()=>orders(true).catch(e=>message(e.message)));
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(a=>a.classList.toggle('active',a===b));metrics().catch(e=>message(e.message));}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(a=>a.classList.toggle('active',a===b));orders().catch(e=>message(e.message));}));
try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null');}catch{}
if(session)load().catch(e=>{showLogin();message(e.message);});
setInterval(()=>{if(session&&!document.hidden&&!loading&&offset<=25&&!$('settings').open)Promise.all([metrics(),orders()]).catch(()=>{});},30000);
