import {API_URL,PUBLIC_KEY,SUPABASE_URL} from './config.mjs';
const $=id=>document.getElementById(id);
function track(event){try{const body={event_name:event,path:location.pathname,source:new URLSearchParams(location.search).get('source')||'direct',session_id:sessionStorage.getItem('dayi_session')||crypto.randomUUID()};sessionStorage.setItem('dayi_session',body.session_id);fetch(SUPABASE_URL+'/rest/v1/analytics_events',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});}catch{}}
const STATE_KEY='dayi_checkout_v2';
let state={step:0,needs:[],style:'',yardSize:'',notes:'',contact:'',request_id:crypto.randomUUID(),access_token:randomToken()};
let timer,submitting=false,photo,proof,pollVersion=0,paymentReady=false;
function randomToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function save(){try{localStorage.setItem(STATE_KEY,JSON.stringify(state));}catch{message('浏览器暂时不能保存进度，请保存订单链接。');}}
function message(text){$('feedback').textContent=text;$('feedback').hidden=!text;}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function request(action,data={},form=null,timeout=45000){
 const options={method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+PUBLIC_KEY},signal:AbortSignal.timeout(timeout)};
 if(form){form.set('action',action);for(const[k,v]of Object.entries(data))form.set(k,String(v));options.body=form;}
 else{options.headers['Content-Type']='application/json';options.body=JSON.stringify({action,...data});}
 let r;try{r=await fetch(API_URL,options);}catch{throw new Error('连接暂时中断，请重试。已保存的订单和照片会保留。');}
 let x;try{x=await r.json();}catch{throw new Error('暂时无法确认付款状态，请重新检查。没有发起扣款。');}if(!r.ok)throw new Error(x.message||'本次操作未完成，请稍后重试。');return x;
}
const access=()=>({order_code:state.order_code,access_token:state.access_token});
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('dayi-checkout',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function cachedFile(kind,value){
 const store=await db();return new Promise((resolve,reject)=>{const tx=store.transaction('files',value===undefined?'readonly':'readwrite');const r=value===undefined?tx.objectStore('files').get(state.access_token+':'+kind):tx.objectStore('files').put(value,state.access_token+':'+kind);tx.oncomplete=()=>{resolve(r.result);store.close();};tx.onerror=()=>{reject(tx.error);store.close();};});
}
export async function normalizeImage(file,minDimension=384){
 if(file.size>25*1024*1024)throw new Error('照片较大，请先选择25MB以内的照片。');
 let img;try{img=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('这张照片暂时无法读取。请在相册导出为 JPG，或上传清晰截图。');}
 if(img.width<minDimension||img.height<minDimension){img.close();throw new Error('照片太小，请换一张能看清现场的原图。');}
 const ratio=Math.min(1,2048/Math.max(img.width,img.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);img.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));
 if(!blob||blob.size>6*1024*1024)throw new Error('照片暂时无法处理，请换一张清晰的 JPG 照片。');
 return new File([blob],'photo.jpg',{type:'image/jpeg'});
}
function selectedNeeds(){return [...document.querySelectorAll('#needs input:checked')].map(x=>x.value);}
function showStep(n){
 state.step=n;save();message('');if(n===1)track('start_click');if(n===6)track('offer_view');
 document.querySelectorAll('.step').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===n));
 $('sizeNext').disabled=!state.yardSize;$('styleNext').disabled=!state.style;
 $('progress').style.width=(n===0?0:n===8?100:Math.min(96,Math.round(n/7*96)))+'%';
 if(n===6)$('summary').innerHTML='院子面积：'+esc(state.yardSize)+'<br>主要需求：'+esc(state.needs.join('、'))+'<br>偏好方向：'+esc(state.style);
 if(n===8){$('orderCodeText').textContent=state.order_code||'';updateOrderLink();}
 window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function updateOrderLink(){
 const url=new URL(location.href);url.hash=new URLSearchParams({order:state.order_code,key:state.access_token}).toString();
 $('resumeLink').href=url.href;
}
function setPaymentStatus(text,ready=false){
 paymentReady=ready;$('paymentStatus').textContent=text;
 $('paymentControls').hidden=false;$('paymentQr').hidden=false;
 $('submitOrder').disabled=!ready;$('saveQr').disabled=false;
}
async function preparePayment({resume=false}={}){
 if(submitting)return;submitting=true;
 showStep(7);setPaymentStatus('正在保存你的院子与需求，请稍候…');
 $('paymentOrder').textContent=state.order_code?'订单号：'+state.order_code:'';
 $('retryPayment').disabled=true;$('toPay').disabled=true;
 try{
  if(!resume||state.details_dirty){
   if(!state.yardSize||!state.style||!state.needs.length||(!photo&&!state.has_photo))throw new Error('请返回补齐院子照片和需求，完成后即可提交订单。');
   setPaymentStatus('正在保存你的院子与需求…');
   const x=await request('create',{request_id:state.request_id,access_token:state.access_token,details:{style:state.style,yard_size:state.yardSize,needs:state.needs,notes:state.notes}});
   if(x.checkout_stage==='submitted'){state.order_code=x.order_code;state.submitted=true;save();showStep(8);poll();return;}
   state.order_code=x.order_code;state.has_photo=x.has_photo&&!state.photo_dirty;state.details_dirty=false;save();
   if(!state.has_photo){await upload('yard',photo);state.has_photo=true;state.photo_dirty=false;save();}
  }
  if(!state.order_code||!state.has_photo)throw new Error('请先完成现场照片上传，再继续付款。');
  $('paymentOrder').textContent='订单号：'+state.order_code;
  setPaymentStatus('可以扫码付款 ¥39.90。请核对收款方名称；付款后回到此页提交凭证，大一核对实际到账后安排反馈。',true);
 }catch(e){setPaymentStatus(e.message+' 请点击下方“重新保存订单”，或联系大一。');}
 finally{submitting=false;$('retryPayment').disabled=false;$('toPay').disabled=false;}
}
function bind(){
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{if(state.step===5){state.notes=$('notes').value.trim();}showStep(Number(b.dataset.go));}));
 document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showStep(Math.max(0,state.step-1))));
 $('yardPhoto').addEventListener('change',async function(){
  const f=this.files?.[0];if(!f)return;this.disabled=true;$('photoNext').disabled=true;
  try{photo=await normalizeImage(f);await cachedFile('yard',photo).catch(()=>{});state.has_photo=false;state.photo_dirty=true;save();$('photoPreview').src=URL.createObjectURL(photo);$('photoPreview').style.display='block';$('photoNext').disabled=false;message('');}catch(e){message(e.message);}finally{this.disabled=false;}
 });
 $('photoNext').addEventListener('click',()=>{if(photo||state.has_photo)showStep(2);});
 document.querySelectorAll('[name=yardSize]').forEach(r=>r.addEventListener('change',()=>{state.yardSize=r.value;state.details_dirty=true;save();$('sizeNext').disabled=false;}));
 $('sizeNext').addEventListener('click',()=>{if(!state.yardSize){message('请先选择院子的面积范围。');return;}showStep(3);});
 document.querySelectorAll('#needs input').forEach(r=>r.addEventListener('change',()=>{state.needs=selectedNeeds();state.details_dirty=true;save();}));
 $('needsNext').addEventListener('click',()=>{state.needs=selectedNeeds();if(!state.needs.length){message('请至少选择一个最希望解决的问题。');return;}showStep(4);});
 document.querySelectorAll('[name=style]').forEach(r=>r.addEventListener('change',()=>{state.style=r.value;state.details_dirty=true;save();$('styleNext').disabled=false;}));
 $('styleNext').addEventListener('click',()=>{if(!state.style){message('请先选择一个方向感觉。');return;}showStep(5);});
 $('notes').addEventListener('input',()=>{state.notes=$('notes').value;state.details_dirty=true;save();});
 $('contact').addEventListener('input',()=>{state.contact=$('contact').value;save();});
 $('toPay').addEventListener('click',()=>preparePayment());
 $('retryPayment').addEventListener('click',()=>preparePayment({resume:!!state.order_code&&state.has_photo}));
 $('payProof').addEventListener('change',async function(){
  if(!this.files?.[0])return;this.disabled=true;
  try{proof=await normalizeImage(this.files[0],100);await cachedFile('proof',proof).catch(()=>{});state.has_proof=false;state.proof_dirty=true;save();$('proofStatus').textContent='付款截图已保存，可以提交订单。';}catch(e){message(e.message);}finally{this.disabled=false;}
 });
 $('submitOrder').addEventListener('click',async function(){
  if(submitting)return;if(!paymentReady){message('订单尚未保存完成，请点击“重新保存订单”；已付款请保留截图或联系大一。');return;}submitting=true;this.disabled=true;this.textContent='正在提交…';
  try{
   state.contact=$('contact').value.trim();save();if(state.contact.length<3)throw new Error('请填写一个用于订单沟通的微信号或手机号。');
   if(!state.has_proof){if(!proof)throw new Error('请上传付款成功截图。');await upload('payment',proof);state.has_proof=true;state.proof_dirty=false;save();}
   await request('submit',{...access(),contact:state.contact});state.submitted=true;save();track('order_submit');showStep(8);poll();
  }catch(e){message(e.message);}finally{submitting=false;this.disabled=false;this.textContent='我已付款，提交订单 →';}
 });
 $('saveQr').addEventListener('click',()=>{const a=document.createElement('a');a.href=new URL('./assets/company-payment-qr.png',location.href).href;a.download='大一造园_对公收款码.png';a.click();});
 $('copyOrder').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('resumeLink').href);message('订单链接已复制，请妥善保存；持有链接的人可以查看本次结果。');}catch{message('请长按“重新查看本次订单”保存链接。');}});
 $('downloadResult').addEventListener('click',async()=>{try{const r=await fetch($('resultImg').src);if(!r.ok)throw Error();const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='大一造园_庭院改造方向图.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}catch{message('请长按结果图片保存，或重新打开订单再试。');}});
 document.querySelectorAll('[data-consult]').forEach(b=>b.addEventListener('click',()=>{$('consultOrder').textContent=state.order_code||'';$('consultDialog').showModal();}));
 $('closeConsult').addEventListener('click',()=>$('consultDialog').close());
 $('newOrder').addEventListener('click',()=>{localStorage.removeItem(STATE_KEY);location.hash='';location.reload();});
 $('retryStatus').addEventListener('click',()=>poll());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.step===8&&state.order_code)poll();});
}
async function upload(kind,file){const f=new FormData();f.set('file',file,file.name);return request('upload',{...access(),kind},f);}
async function poll(){
 clearTimeout(timer);const version=++pollVersion;if(!state.order_code)return;
 try{
  const x=await request('result',access());if(version!==pollVersion)return;state.has_photo=x.has_photo&&!state.photo_dirty;state.has_proof=x.has_proof&&!state.proof_dirty;
  if(x.checkout_stage==='draft'){state.submitted=false;save();if(!state.has_photo){showStep(1);message('现场照片还未上传完成，请继续上传后再付款。');return;}if(state.step>=1&&state.step<=6)return;await preparePayment({resume:true});return;}
  state.submitted=true;save();if(state.step!==8)showStep(8);
  const messages={waiting_payment_verification:['等待付款确认','付款凭证已提交，核对实际到账后安排反馈。'],pending_generation:['已确认到账','已收到款项，正在安排你的方向反馈，无需再次付款。'],queued:['已进入处理队列','照片和需求已保存，你可以关闭页面，稍后通过订单链接回来。'],generating:['正在整理你的庭院方向','正在生成画面并检查现场关系，结果完成后会在这里出现。'],failed:['这次处理需要继续跟进',x.error_message||'订单已经保留，请通过下方入口联系处理，无需再次付款。']};
  if(x.process_status==='completed'&&x.image_url&&Array.isArray(x.advice)&&x.advice.length===3){
   $('resultImg').src=x.image_url;await $('resultImg').decode();if(version!==pollVersion)return;
   $('originalImg').src=x.original_url;$('advice').innerHTML=x.advice.map((s,i)=>'<div><b>0'+(i+1)+'</b>｜'+esc(s)+'</div>').join('');
   $('resultBox').classList.remove('hidden');$('statusTitle').textContent='你的方向反馈已完成';$('statusText').textContent='结合原院对照画面，再看下面的3条设计建议。';state.completed=true;save();return;
  }
  const msg=messages[x.process_status]||['订单正在处理','照片与需求已保存，请稍后回来查看。'];$('statusTitle').textContent=msg[0];$('statusText').textContent=msg[1];
  if(x.process_status==='failed')return;
 }catch(e){$('statusText').textContent=e.message;}
 if(version===pollVersion)timer=setTimeout(poll,12000);
}
async function init(){
 try{const saved=JSON.parse(localStorage.getItem(STATE_KEY)||'null');if(saved&&saved.access_token)state={...state,...saved};}catch{}
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.get('order')&&/^[a-f0-9]{64}$/.test(hash.get('key')||'')){if(state.order_code!==hash.get('order'))state={step:8,needs:[],request_id:crypto.randomUUID()};state.order_code=hash.get('order');state.access_token=hash.get('key');state.step=8;state.submitted=true;}
 try{[photo,proof]=await Promise.all([cachedFile('yard'),cachedFile('proof')]);}catch{}
 $('notes').value=state.notes||'';$('contact').value=state.contact||'';
 document.querySelectorAll('[name=yardSize]').forEach(x=>x.checked=x.value===state.yardSize);
 document.querySelectorAll('[name=style]').forEach(x=>x.checked=x.value===state.style);
 document.querySelectorAll('#needs input').forEach(x=>x.checked=state.needs.includes(x.value));
 if(photo){$('photoPreview').src=URL.createObjectURL(photo);$('photoPreview').style.display='block';}
 $('photoNext').disabled=!photo&&!state.has_photo;
 if(proof||state.has_proof)$('proofStatus').textContent='已有付款截图，提交时会继续使用。';
 track('page_view');bind();showStep(state.submitted?8:state.step||0);if(state.order_code)poll();else if(state.step===7)preparePayment();
}
init();
