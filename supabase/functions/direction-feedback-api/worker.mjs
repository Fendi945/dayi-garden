import {WORKFLOW,PROMPT_VERSION,AppError,check,validatePlan,validateReview,planPrompt,editPrompt,reviewPrompt,imageMime,sha256,styleGroup} from './rules.mjs';
export async function runOne(store,provider,config){
 const job=await store.claim(config.enabled!==true);if(!job)return {idle:true};
 const order=await store.orderById(job.order_id);const cp=job.checkpoint||{};let imageStarted=false;
 const mark=async(stage)=>{check(await store.checkpoint(job,stage,cp),'stale_lease',409);await store.signal();};
 try{
  check(order.is_test||['confirmed','verified','paid'].includes(order.payment_status),'payment_not_confirmed',409);
  config=cp.config||config;
  if(job.stage==='plan'){
   const original=await store.sign('order-photos',order.photo_path);
   const out=await provider.vision(planPrompt(order),[original]);
   await store.patch('orders','?id=eq.'+order.id,{configuration_id:config.signature});
   cp.plan=validatePlan(out.data);cp.workflow=WORKFLOW;cp.prompt_version=PROMPT_VERSION;cp.image_count=0;cp.config=config;
   cp.seed=crypto.getRandomValues(new Uint32Array(1))[0]%2147483647;
   await store.event(order.id,'plan_ready',{request_id:out.request_id,usage:out.usage});await mark('edit');
  }else if(job.stage==='edit'){
   check((cp.image_count||0)<Math.min(2,config.max_images||2),'quality_limit_reached',422);
   const original=await store.sign('order-photos',order.photo_path);
   const referencePath=config.reference_paths?.[styleGroup(order.style)];
   const refs=referencePath?[await store.sign('dayi-private-results',referencePath)]:[];
   cp.prompt=editPrompt(order,cp.plan,cp.correction);cp.image_count=(cp.image_count||0)+1;
   await store.event(order.id,'image_requested',{attempt:cp.image_count,seed:cp.seed,model:config.image_model,prompt_version:PROMPT_VERSION});
   check(await store.prepareEdit(job,cp),'stale_lease',409);imageStarted=true;
   cp.generated=await provider.edit(cp.prompt,[...refs,original],cp.seed+cp.image_count-1);
   await mark('download');
   await store.event(order.id,'image_received',{request_id:cp.generated.request_id,usage:cp.generated.usage,seconds:cp.generated.seconds});
  }else if(job.stage==='download'){
   const bytes=await provider.download(cp.generated.url);const mime=imageMime(bytes);
   cp.candidate_path=`results/${order.id}/candidate-${cp.image_count}.${mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp'}`;
   cp.candidate_hash=await sha256(bytes);
   await store.put('dayi-private-results',cp.candidate_path,bytes,mime);
   delete cp.generated.url;
   await mark('review');
  }else if(job.stage==='review'){
   const urls=await Promise.all([store.sign('order-photos',order.photo_path),store.sign('dayi-private-results',cp.candidate_path)]);
   const out=await provider.vision(reviewPrompt(order,cp.plan),urls);
   cp.review=validateReview(out.data,cp.generated.seconds,config.minimum_score||80);
   await store.event(order.id,'quality_review',{attempt:cp.image_count,review:cp.review,request_id:out.request_id,usage:out.usage});
   if(cp.review.accepted){await mark('publish');}
   else if(cp.image_count<Math.min(2,config.max_images||2)){
    cp.correction=cp.review.reasons.join('；').slice(0,450)||'严格保持原建筑、门窗、边界、视角及客户保留项，重新落实全部需求。';await mark('edit');
   }else{throw new AppError('quality_limit_reached',422,'这次画面尚未达到交付要求，订单已保留，正在安排处理。');}
  }else if(job.stage==='publish'){
   check(cp.review?.accepted===true,'quality_gate_required',409);
   check(await store.publish(job,cp,config.image_model),'stale_lease',409);
  }else throw new AppError('unknown_job_stage',500);
  return {processed:true,stage:job.stage};
 }catch(e){
  if(e.code==='stale_lease')return {stale:true};
  const code=imageStarted&&!['provider_auth_failed','provider_rate_limited','provider_rejected'].includes(e.code)?'ambiguous_image_timeout':e.code||'worker_error';
  const transient=['provider_unreachable','provider_rate_limited','image_download_failed'].includes(code)&&job.stage!=='edit'&&job.retry_count<2;
  await store.fail(job,code,transient,e.message);
  if(transient)await store.signal();
  return {processed:false,code};
 }
}
