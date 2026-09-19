import {AppError,check,providerBase,parseJSON} from './rules.mjs';
export function createProvider(config,key,fetcher=fetch){
 const base=providerBase(config.api_base);
 async function call(path,body,timeout,stage){
  let res;
  try{res=await fetcher(base+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});}
  catch(e){throw new AppError(stage==='edit'?'ambiguous_image_timeout':'provider_unreachable',503);}
  let x;try{x=await res.json();}catch{throw new AppError(stage==='edit'?'ambiguous_image_timeout':'invalid_model_response',502);}
  if(!res.ok||x.code)throw new AppError(res.status===401||x.code==='InvalidApiKey'?'provider_auth_failed':res.status===429?'provider_rate_limited':'provider_rejected',502);
  return x;
 }
 return {
  async vision(prompt,images){
   const x=await call('/compatible-mode/v1/chat/completions',{model:config.vision_model,messages:[{role:'user',content:[...images.map(url=>({type:'image_url',image_url:{url}})),{type:'text',text:prompt}]}],stream:false,max_tokens:2400,enable_thinking:false},60000,'vision');
   return {data:parseJSON(x.choices?.[0]?.message?.content),request_id:x.id,usage:x.usage};
  },
  async edit(prompt,images,seed){
   const start=Date.now();
   const x=await call('/api/v1/services/aigc/multimodal-generation/generation',{model:config.image_model,input:{messages:[{role:'user',content:[...images.map(image=>({image})),{text:prompt}]}]},parameters:{n:1,seed,prompt_extend:false,watermark:false}},110000,'edit');
   const url=x.output?.choices?.[0]?.message?.content?.find(c=>c.image)?.image;
   check(typeof url==='string','ambiguous_image_timeout',502);
   return {url,request_id:x.request_id,usage:x.usage,seconds:(Date.now()-start)/1000};
  },
  async download(url){
   const u=new URL(url);
   check(u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.endsWith('.aliyuncs.com'),'untrusted_image_url',502);
   const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
   check(r.ok,'image_download_failed',502);
   check(Number(r.headers.get('content-length')||0)<=10485760,'image_too_large',502);
   const reader=r.body.getReader();let size=0;const chunks=[];
   while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>10485760){await reader.cancel();throw new AppError('image_too_large',502);}chunks.push(value);}
   const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return data;
  }
 };
}
