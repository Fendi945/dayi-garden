import {AppError,check,text,details,providerBase,imageMime,sha256,PRICE,WORKFLOW,PROMPT_VERSION} from './rules.mjs';
import {createProvider} from './provider.mjs';
import {runOne} from './worker.mjs';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-dayi-worker','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
const tokenValid=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
const codeValid=c=>typeof c==='string'&&/^DAYI-[A-Z0-9-]{10,50}$/.test(c);
const uuidValid=c=>typeof c==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(c);
const TEST_TYPES=['毛坯庭院','硬化庭院','已有植物庭院'];
async function readBody(req){const reader=req.body?.getReader();check(reader,'invalid_body');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>7*1024*1024){await reader.cancel();throw new AppError('file_too_large',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const response=new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||'application/json'}});return req.headers.get('content-type')?.includes('multipart/form-data')?Object.fromEntries(await response.formData()):await response.json();}
function safeConfig(config){return {enabled:config.enabled===true,api_base:config.api_base,image_model:config.image_model,vision_model:config.vision_model,minimum_score:config.minimum_score,max_images:config.max_images};}
export function createHandler({store,env={},fetcher=fetch,providerFactory=createProvider}){
 async function runtime(){const config=await store.config();config.signature=await signature(config);const key=env.DASHSCOPE_API_KEY||env.DAYI_IMAGE_API_KEY||await store.secret('dayi_image_api_key');return {config,key};}
 async function signature(c){return sha256(JSON.stringify([WORKFLOW,PROMPT_VERSION,c.api_base,c.image_model,c.vision_model,c.minimum_score,c.max_images,c.reference_paths||{}]));}
 async function calibration(config){
  const rows=await store.table('orders','?is_test=eq.true&process_status=eq.completed&configuration_id=eq.'+config.signature+'&select=id,order_code,test_case_type,photo_hash,calibration_approved_at');
  const approved=rows.filter(o=>o.calibration_approved_at);const types=[...new Set(approved.map(o=>o.test_case_type))];
  return {ready:TEST_TYPES.every(t=>types.includes(t))&&new Set(approved.map(o=>o.photo_hash)).size>=3,approved_types:types,required_types:TEST_TYPES,completed:rows.length,approved:approved.length};
 }
 async function authorizeOrder(code,token){
  check(codeValid(code)&&tokenValid(token),'order_access_denied',403);
  const o=await store.orderByCode(code);check(o,'order_access_denied',403);
  const a=(await store.table('dayi_order_access','?order_id=eq.'+o.id+'&select=token_hash'))[0];
  check(a?.token_hash===await sha256(token),'order_access_denied',403);return o;
 }
 async function admin(req){return store.authenticate(req.headers.get('Authorization')||'');}
 async function permitted(req,action,limit=30,seconds=60){
  const addr=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  check(await store.rpc('dayi_rate_limit',{p_key:await sha256(action+':'+addr),p_limit:limit,p_seconds:seconds}),'rate_limited',429,'操作有些频繁，请稍后继续。');
 }
 return async function handle(req){
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
   const declared=Number(req.headers.get('content-length')||0);check(declared<=7*1024*1024,'file_too_large',413);
   const body=await readBody(req);const action=text(body.action,40);
   if(action==='status'){
    const {config,key}=await runtime();return reply({ready:!!key&&config.enabled===true,price:PRICE,workflow:WORKFLOW,payment_mode:'manual_confirmation'});
   }
   if(action==='worker'){
    const workerKey=await store.secret('dayi_worker_key');
    check(workerKey&&req.headers.get('x-dayi-worker')===workerKey,'forbidden',403);
    const {config,key}=await runtime();
    if(!key)return reply({idle:true,reason:'not_configured'});
    return reply(await runOne(store,providerFactory(config,key,fetcher),config));
   }
   if(action==='create'){
    await permitted(req,'create',12,3600);
    const {config,key}=await runtime();check(key&&config.enabled===true,'not_ready',503,'目前正在完善交付，请稍后再来。');
    check(uuidValid(body.request_id)&&tokenValid(body.access_token),'invalid_request');
    const d=details(body.details||{});
    const code='DAYI-'+new Date().toISOString().slice(2,10).replaceAll('-','')+'-'+crypto.randomUUID().replaceAll('-','').slice(0,20).toUpperCase();
    const o=await store.rpc('dayi_create_order',{p_request:body.request_id,p_hash:await sha256(body.access_token),p_code:code,p_details:d});
    return reply({order_code:o.order_code,checkout_stage:o.checkout_stage,has_photo:!!o.photo_path,has_proof:!!o.payment_proof_path});
   }
   if(action==='upload'){
    await permitted(req,'upload',30,3600);
    const o=await authorizeOrder(body.order_code,body.access_token);
    check(o.checkout_stage==='draft'&&o.payment_status==='pending_verification','order_locked',409);
    check(['yard','payment'].includes(body.kind)&&body.file&&typeof body.file.arrayBuffer==='function','invalid_upload');
    check(body.file.size>0&&body.file.size<=6*1024*1024,'file_too_large',413);
    const bytes=new Uint8Array(await body.file.arrayBuffer());const mime=imageMime(bytes);const hash=await sha256(bytes);
    const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
    const path=`incoming/v2/${o.id}/${body.kind}-${hash.slice(0,20)}.${ext}`;
    await store.put('order-photos',path,bytes,mime);
    await store.patch('orders','?id=eq.'+o.id,{[body.kind==='yard'?'photo_path':'payment_proof_path']:path,...(body.kind==='yard'?{photo_hash:hash}:{}),updated_at:new Date().toISOString()});
    return reply({uploaded:true});
   }
   if(action==='submit'){
    const o=await authorizeOrder(body.order_code,body.access_token);
    if(o.checkout_stage==='submitted')return reply({submitted:true});
    check(o.photo_path&&o.payment_proof_path,'missing_photos');
    const contact=text(body.contact,100);check(contact.length>=3,'invalid_contact');
    await store.patch('orders','?id=eq.'+o.id+'&checkout_stage=eq.draft',{contact,checkout_stage:'submitted',updated_at:new Date().toISOString()});
    await store.event(o.id,'order_submitted');return reply({submitted:true});
   }
   if(action==='result'){
    await permitted(req,'result',90,60);
    const o=await authorizeOrder(body.order_code,body.access_token);
    const complete=o.process_status==='completed'&&o.result_a_path&&Array.isArray(o.advice_json)&&o.advice_json.length===3;
    const out={order_code:o.order_code,checkout_stage:o.checkout_stage,payment_status:o.payment_status,process_status:complete?'completed':o.process_status==='completed'?'generating':o.process_status,error_message:o.error_message||null,has_photo:!!o.photo_path,has_proof:!!o.payment_proof_path};
    if(complete){out.image_url=await store.sign(o.result_bucket,o.result_a_path);out.original_url=await store.sign('order-photos',o.photo_path);out.advice=o.advice_json;}
    return reply(out);
   }
   if(action.startsWith('admin_')){
    const user=await admin(req);
    if(action==='admin_status'){
     const {config,key}=await runtime();return reply({config:safeConfig(config),image_key_configured:!!key,calibration:await calibration(config),payment_mode:'manual_confirmation',workflow:WORKFLOW});
    }
    if(action==='admin_configure'){
     const old=await store.config();const incoming=body.config||{};
     const config={...old,...safeConfig({...old,...incoming})};config.api_base=providerBase(config.api_base);
     check(/^qwen-[a-z0-9.-]{3,100}$/.test(config.image_model)&&/^qwen[a-z0-9.-]{3,100}$/.test(config.vision_model),'invalid_model');
     check([1,2].includes(config.max_images)&&Number.isFinite(config.minimum_score)&&config.minimum_score>=75&&config.minimum_score<=100,'invalid_quality_settings');
     const newKey=text(body.api_key,512);if(newKey)check(newKey.length>=24,'invalid_api_key');
     config.signature=await signature(config);
     if(config.enabled===true)check((await calibration(config)).ready,'calibration_required',409,'请先完成3类不同现场的测试，并核对通过后再开放接单。');
     if(newKey||config.enabled===true){
      const key=newKey||env.DASHSCOPE_API_KEY||env.DAYI_IMAGE_API_KEY||await store.secret('dayi_image_api_key');check(key,'missing_image_key');
      await providerFactory(config,key,fetcher).vision('仅输出JSON：{"connected":true}',[]);
     }
     if(newKey)await store.rpc('dayi_save_secret',{p_name:'dayi_image_api_key',p_value:newKey});
     await store.patch('dayi_settings','?name=eq.production',{value:config,updated_at:new Date().toISOString()});
     return reply({saved:true,config:safeConfig(config)});
    }
    if(action==='admin_metrics'){return reply(await store.rpc('dayi_metrics',{p_days:[1,7,30,3650].includes(Number(body.days))?Number(body.days):7}));}
    if(action==='admin_orders'){
     const offset=Math.max(0,Math.min(10000,Number(body.offset)||0));
     const filter=body.filter==='pending'?'&is_test=eq.false&payment_status=eq.pending_verification':body.filter==='failed'?'&process_status=eq.failed':body.filter==='tests'?'&is_test=eq.true':'&is_test=eq.false';
     const rows=await store.table('orders','?checkout_stage=eq.submitted'+filter+'&order=created_at.desc&limit=25&offset='+offset);
     for(const o of rows){if(o.result_a_path){try{o.image_url=await store.sign(o.result_bucket,o.result_a_path);}catch{o.image_unavailable=true;}}const job=(await store.table('dayi_jobs','?order_id=eq.'+o.id+'&select=stage,state,checkpoint,last_error'))[0];if(job)o.job={stage:job.stage,state:job.state,last_error:job.last_error,review:job.checkpoint?.review,image_count:job.checkpoint?.image_count,model:job.checkpoint?.config?.image_model};}
     return reply({orders:rows});
    }
    if(action==='admin_order_images'){
     const o=await store.orderByCode(text(body.order_code,80));check(o,'not_found',404);
     return reply({yard:o.photo_path?await store.sign('order-photos',o.photo_path):null,proof:o.payment_proof_path?await store.sign('order-photos',o.payment_proof_path):null});
    }
    if(action==='admin_test'){
     const {config,key}=await runtime();check(key,'missing_image_key',409,'请先保存模型服务密钥。');
     check(uuidValid(body.request_id)&&TEST_TYPES.includes(body.test_case_type),'invalid_test');
     check(body.file&&typeof body.file.arrayBuffer==='function'&&body.file.size<=6*1024*1024,'invalid_upload');
     const d=details(JSON.parse(body.details||'{}'));const bytes=new Uint8Array(await body.file.arrayBuffer());const mime=imageMime(bytes);const hash=await sha256(bytes);
     const code='DAYI-TEST-'+body.request_id.replaceAll('-','').toUpperCase();let order=await store.orderByCode(code);
     if(!order){
      const path='validation/'+hash+'.'+(mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp');await store.put('order-photos',path,bytes,mime);
      try{order=(await store.insert('orders',{order_code:code,checkout_stage:'submitted',is_test:true,product_code:'direction_feedback_test',amount_cny:0,payment_status:'not_required',process_status:'queued',photo_path:path,photo_hash:hash,test_case_type:body.test_case_type,configuration_id:config.signature,style:d.style,style_desc:d.style,yard_size:d.yard_size,needs:d.needs,notes:d.notes,workflow_version:WORKFLOW}))[0];}catch(e){order=await store.orderByCode(code);if(!order)throw e;}
     }
     const r=await store.rpc('dayi_enqueue',{p_code:code,p_actor:user.id,p_confirm:false});await store.signal();return reply({...r,order_code:code});
    }
    if(action==='admin_approve_test'){
     const o=await store.orderByCode(text(body.order_code,80));check(o?.is_test&&o.process_status==='completed','test_incomplete',409);
     await store.patch('orders','?id=eq.'+o.id,{calibration_approved_at:new Date().toISOString(),calibration_approved_by:user.id});return reply({approved:true});
    }
    if(action==='admin_confirm'||action==='admin_retry'||action==='admin_resume_image'){
     const {config,key}=await runtime();const order=await store.orderByCode(text(body.order_code,80));check(key&&(config.enabled===true||order?.is_test),'not_ready',503,'请先完成生成服务的一次性设置与测试。');
     const r=await store.rpc('dayi_enqueue',{p_code:text(body.order_code,80),p_actor:user.id,p_confirm:action==='admin_confirm',p_new_image:action==='admin_resume_image'});
     await store.signal();return reply(r);
    }
   }
   throw new AppError('unknown_action',404);
  }catch(e){
   const code=e instanceof AppError?e.code:e instanceof SyntaxError?'invalid_json':'internal_error';
   return reply({error:code,message:e instanceof AppError&&e.message!==code?e.message:'本次操作未完成，请稍后重试；已提交的订单会保留。'},e instanceof AppError?e.status:500);
  }
 };
}
