// Real browser interactions with a controlled backend; no real receipt or customer delivery is changed.
import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const server=spawn('python3',['-m','http.server','8771','--bind','127.0.0.1','--directory','direction-feedback'],{stdio:'ignore'});let browser;
const fixture=fs.readFileSync('tests/fixtures/yard-placeholder.jpg');
try{
 await new Promise(r=>setTimeout(r,400));browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let delivered=false,deliveryCount=0;
  const paid={order_code:'DAYI-QA-PAID123456',checkout_stage:'submitted',contact:'验证客户',style:'东方自然',yard_size:'100㎡以上',needs:['降低维护'],notes:'保留原树',payment_status:'confirmed',process_status:'pending_generation',amount_cny:39.9,has_photo:true,has_proof:true,created_at:'2026-09-21T00:00:00Z',updated_at:'2026-09-21T00:00:00Z'};
  const pending={...paid,order_code:'DAYI-QA-PENDING123',payment_status:'pending_verification',process_status:'waiting_payment_verification'};
  const image='http://127.0.0.1:8771/qa-image.jpg';
  await page.addInitScript(()=>sessionStorage.setItem('dayi_admin_v2',JSON.stringify({access_token:'test-only',expires_at:9999999999})));
  await page.route('**/qa-image.jpg',r=>r.fulfill({contentType:'image/jpeg',body:fixture}));
  await page.route('https://fhvhnibznphatfnbvvnb.supabase.co/**',async route=>{
   const request=route.request();const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(request.method()==='OPTIONS')return send({});
   if(request.headers()['content-type']?.includes('multipart/form-data')){
    const raw=request.postData();assert.match(raw,/admin_deliver/);assert.match(raw,/DAYI-QA-PAID123456/);assert.match(raw,/expected_updated_at/);assert.match(raw,/保留原建筑与围墙/);assert.match(raw,/优先整理喝茶区域/);assert.match(raw,/施工前核对现场排水/);delivered=true;deliveryCount++;return send({delivered:true});
   }
   const b=request.postDataJSON();
   if(b.action==='admin_business_status')return send({automatic:false});
   if(b.action==='admin_metrics')return send({submitted:2,pending:1,paid:1,completed:delivered?1:0,revenue:39.9});
   if(b.action==='admin_business_orders'){
    if(b.filter==='drafts')return send({orders:[{...pending,checkout_stage:'draft',order_code:'DAYI-QA-DRAFT123',has_proof:false,contact:null}]});
    assert.equal(b.filter,'all');return send({orders:[{...paid,...(delivered?{process_status:'completed',result_a_path:'result.jpg',image_url:image,advice_json:['保留原建筑与围墙','优先整理喝茶区域','施工前核对现场排水']}: {})},pending]});
   }
   if(b.action==='admin_result_link')return send({order_code:paid.order_code,access_token:'a'.repeat(64),expires_at:'2099-01-01'});
   if(b.action==='admin_order_images')return send({yard:image,proof:image});
   if(b.action==='admin_order_prompt')return send({source:'draft',note:'根据需求整理的草稿，尚未用于自动出图。',prompt:'保留原树 <script>window.BAD=true</script>'});
   if(b.action==='admin_history')return send({deliveries:delivered?[{version:1,created_at:'2026-09-21T00:00:00Z',image_url:image,advice:['保留原建筑与围墙','优先整理喝茶区域','施工前核对现场排水']}]:[]});
   throw Error('Unexpected action '+b.action);
  });
  await page.goto('http://127.0.0.1:8771/dashboard/');await page.locator('.order').first().waitFor();assert.equal(await page.locator('.order').count(),2);assert.match(await page.locator('#orderListSummary').textContent(),/2 条/);
  let order=page.locator('.order').filter({hasText:paid.order_code});
  await order.getByText('客户原图与付款凭证',{exact:true}).click();await order.locator('[data-images] img').first().evaluate(i=>i.decode());assert.equal(await order.getByRole('link',{name:'打开原尺寸图片'}).count(),2);
  await order.getByText('查看 / 复制生图提示词',{exact:true}).click();await order.getByText(/根据需求整理的草稿/).waitFor();assert.match(await order.locator('[data-prompt-text]').textContent(),/保留原树/);assert.equal(await page.evaluate(()=>window.BAD),undefined);
  assert.equal(await page.locator('.order').filter({hasText:pending.order_code}).getByRole('button',{name:'上传效果图并交付',exact:true}).isDisabled(),true);
  await order.getByRole('button',{name:'上传效果图并交付',exact:true}).click();await page.locator('#deliveryDialog').waitFor({state:'visible'});await page.locator('#deliveryOriginal').evaluate(i=>i.decode());await page.locator('#deliveryImage').setInputFiles('tests/fixtures/yard-placeholder.jpg');await page.waitForFunction(()=>{const i=document.getElementById('deliveryPreview');return !i.hidden&&i.complete&&i.naturalWidth>0;});
  for(const [i,value]of ['保留原建筑与围墙','优先整理喝茶区域','施工前核对现场排水'].entries())await page.locator('#advice'+(i+1)).fill(value);
  await page.locator('#publishDelivery').click();await page.getByText('反馈已保存。请查看本版查看状态，或复制客户结果链接发送给客户。',{exact:true}).waitFor();assert.equal(deliveryCount,1);order=page.locator('.order').filter({hasText:paid.order_code});await order.locator('img[alt="本次反馈方向图"]').evaluate(i=>i.decode());
  await order.getByText('尚无查看记录（本版反馈）',{exact:true}).waitFor();await order.getByRole('button',{name:'复制客户结果链接',exact:true}).click();await order.getByLabel('客户结果链接',{exact:true}).waitFor();assert.match(await order.getByLabel('客户结果链接',{exact:true}).inputValue(),/#order=DAYI-QA-PAID123456&key=a{64}$/);
  await order.getByText('查看反馈交付记录',{exact:true}).click();await order.getByText('第 1 版',{exact:false}).waitFor();
  await page.locator('[data-filter="drafts"]').click();await page.getByText('未提交完成',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'上传效果图并交付',exact:true}).isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px: all orders, original/proof, safe draft prompt, payment guard, image upload + 3 advice, delivery history, draft filter');await context.close();
 }
}finally{await browser?.close();server.kill();}
