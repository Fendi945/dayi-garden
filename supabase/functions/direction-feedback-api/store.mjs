import {AppError,check} from './rules.mjs';
export function createStore(url,key,fetcher=fetch){
 const base=url.replace(/\/$/,'');
 const headers={apikey:key,Authorization:'Bearer '+key};
 async function request(path,opts={}){
  let r;try{r=await fetcher(base+path,{...opts,headers:{...headers,...opts.headers},signal:opts.signal||AbortSignal.timeout(30000)});}catch{throw new AppError('database_unavailable',503);}
  if(!r.ok){let x;try{x=await r.json();}catch{};throw new AppError(x?.code==='23505'?'conflict':'database_request_failed',r.status===401?503:400);}
  return r.status===204?null:await r.json();
 }
 const json=(body,method='POST')=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const rpc=(name,args={})=>request('/rest/v1/rpc/'+name,json(args));
 const table=(name,query='')=>request('/rest/v1/'+name+query);
 const insert=(name,data)=>request('/rest/v1/'+name,{...json(data),headers:{'Content-Type':'application/json',Prefer:'return=representation'}});
 const patch=(name,query,data)=>request('/rest/v1/'+name+query,{...json(data,'PATCH'),headers:{'Content-Type':'application/json',Prefer:'return=representation'}});
 const byCode=async(code)=>(await table('orders','?order_code=eq.'+encodeURIComponent(code)+'&limit=1'))[0];
 return {
  rpc,table,insert,patch,
  orderByCode:byCode,
  async orderById(id){return (await table('orders','?id=eq.'+encodeURIComponent(id)+'&limit=1'))[0];},
  async config(){return (await table('dayi_settings','?name=eq.production&select=value'))[0]?.value||{};},
  secret(name){return rpc('dayi_secret',{p_name:name});},
  async put(bucket,path,bytes,mime){
   await request('/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'Content-Type':mime,'x-upsert':'true'},body:bytes});
  },
  async sign(bucket,path){
   check(path&&!path.includes('..')&&!/^https?:/.test(path),'invalid_asset_path');
   const x=await request('/storage/v1/object/sign/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),json({expiresIn:900}));
   const signed=x.signedURL||x.signedUrl;
   check(typeof signed==='string','asset_unavailable',503);
   return signed.startsWith('https://')?signed:base+(signed.startsWith('/storage/v1/')?'':'/storage/v1')+signed;
  },
  async event(order,event,detail={}){await insert('dayi_events',{order_id:order,event,detail});},
  claim(testOnly=false){return rpc('dayi_claim',{p_tests_only:testOnly});},
  prepareEdit(job,cp){return rpc('dayi_prepare_edit',{p_order:job.order_id,p_lease:job.lease_id,p_checkpoint:cp});},
  checkpoint(job,stage,cp){return rpc('dayi_checkpoint',{p_order:job.order_id,p_lease:job.lease_id,p_stage:stage,p_checkpoint:cp});},
  publish(job,cp,model){return rpc('dayi_publish',{p_order:job.order_id,p_lease:job.lease_id,p_path:cp.candidate_path,p_advice:cp.review.advice,p_model:model,p_prompt:cp.prompt});},
  async signal(){try{await rpc('dayi_signal');}catch{/* periodic scheduler recovers a lost immediate signal */}},
  async fail(job,code,retry,message){
   const rows=await patch('dayi_jobs','?order_id=eq.'+job.order_id+'&lease_id=eq.'+job.lease_id+'&state=eq.running',{
    state:retry?'queued':'failed',last_error:code,retry_count:job.retry_count+1,lease_id:null,locked_until:null,
    available_at:new Date(Date.now()+30000).toISOString(),updated_at:new Date().toISOString()
   });
   if(!rows?.length)return;
   const visible=code==='unsuitable_photo'?message:code==='quality_limit_reached'?'画面尚未达到交付要求，订单已保留，正在安排处理。':retry?'连接暂时中断，系统正在继续处理。':'本次处理遇到问题，订单已保留，请通过订单页联系处理。';
   await patch('orders','?id=eq.'+job.order_id,{process_status:retry?'queued':'failed',error_message:visible,updated_at:new Date().toISOString()});
   await insert('dayi_events',{order_id:job.order_id,event:retry?'stage_retry':'stage_failed',detail:{stage:job.stage,code,retry}});
  },
  async authenticate(token){
   const r=await fetcher(base+'/auth/v1/user',{headers:{apikey:key,Authorization:token},signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new AppError('unauthorized',401);
   const user=await r.json();check(user.email==='day1garden58@gmail.com'&&user.email_confirmed_at,'forbidden',403);return user;
  }
 };
}
