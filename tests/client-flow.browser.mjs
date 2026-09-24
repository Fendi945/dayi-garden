// Runs actual DOM events and browser storage; the controlled backend covers retries without a real charge.
import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1','--directory','direction-feedback'],{stdio:'ignore'});
let browser;const evidence=[];const out=process.env.DAYI_QA_DIR||'.qa';fs.mkdirSync(out,{recursive:true});
try{
 await new Promise(r=>setTimeout(r,500));browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let hasPhoto=false,hasProof=false,submitted=false,firstCreate=true,createCount=0,proofCount=0,submitCount=0,latestDetails;
  await page.route('https://fhvhnibznphatfnbvvnb.supabase.co/**',async route=>{
   const req=route.request();const send=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x),headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
   if(req.method()==='OPTIONS'||req.url().endsWith('/analytics_events'))return send({});
   let b;try{b=req.postDataJSON();}catch{}
   if(!b){const raw=req.postData()||'';if(raw.includes('name="kind"\r\n\r\nyard'))hasPhoto=true;else{hasProof=true;proofCount++;}return send({uploaded:true});}
   if(b.action==='create'){if(firstCreate){firstCreate=false;return send({message:'测试：保存暂时中断，请重试。'},503);}createCount++;latestDetails=b.details;return send({order_code:'DAYI-260920-CLIENTFLOW00001',has_photo:hasPhoto,has_proof:hasProof,checkout_stage:submitted?'submitted':'draft'});}
   if(b.action==='submit'){assert.equal(hasPhoto,true);assert.equal(hasProof,true);assert.ok(b.contact.length>=3);submitted=true;submitCount++;return send({submitted:true});}
   if(b.action==='result')return send({checkout_stage:submitted?'submitted':'draft',payment_status:'pending_verification',process_status:'waiting_payment_verification',has_photo:hasPhoto,has_proof:hasProof});
   throw Error('Unexpected request: '+b.action);
  });
  const active=n=>page.locator(`[data-step="${n}"].active`).waitFor();const back=n=>page.locator(`[data-step="${n}"] [data-back]`).first().click();
  const select=(id,value)=>page.locator('#'+id+' label').filter({hasText:new RegExp('^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
  await page.goto('http://127.0.0.1:8765/');await page.locator('[data-go="1"]').click();await page.locator('#yardPhoto').setInputFiles('tests/fixtures/yard-placeholder.jpg');await page.locator('#photoNext').click();await active(2);assert.equal(await page.locator('#sizeNext').isDisabled(),true);
  for(const size of ['小于30㎡','30–60㎡','60–100㎡','不确定','100㎡以上']){await select('yardSize',size);await page.locator('#sizeNext').click();await active(3);await back(3);await active(2);await select('yardSize',size);await page.reload();await active(2);assert.equal(await page.locator('#sizeNext').isEnabled(),true);await page.locator('#sizeNext').click();await active(3);await back(3);}
  await page.locator('#sizeNext').click();await page.locator('#needsNext').click();await active(3);assert.match(await page.locator('#feedback').textContent(),/至少选择/);
  await select('needs','休闲喝茶');await select('needs','降低维护');await page.reload();await active(3);assert.equal(await page.locator('#needs input:checked').count(),2);await page.locator('#needsNext').click();await active(4);assert.equal(await page.locator('#styleNext').isDisabled(),true);
  for(const style of ['现代极简','温暖生活感','我说不清，让大一帮我判断','自然松弛','东方自然']){await select('style',style);await page.locator('#styleNext').click();await active(5);await back(5);await select('style',style);await page.reload();await active(4);assert.equal(await page.locator('#styleNext').isEnabled(),true);await page.locator('#styleNext').click();await active(5);await back(5);}
  await page.locator('#styleNext').click();await page.locator('#notes').fill('保留原树和围墙，减少维护。');await page.locator('[data-go="6"]').click();await active(6);assert.match(await page.locator('#summary').textContent(),/100㎡以上/);assert.match(await page.locator('#summary').textContent(),/东方自然/);
  await page.locator('#toPay').click();await active(7);await page.locator('#paymentStatus').getByText(/测试：保存暂时中断/).waitFor();assert.equal(await page.locator('#paymentQr').isVisible(),true);assert.equal(await page.locator('#contact').isVisible(),true);assert.equal(await page.locator('#submitOrder').isDisabled(),true);
  await page.locator('#retryPayment').click();await page.waitForFunction(()=>!document.getElementById('submitOrder').disabled);assert.equal(createCount,1);await page.locator('#paymentQr img').evaluate(img=>img.decode());assert.equal(await page.locator('#paymentQr img').evaluate(img=>img.naturalWidth),410);
  await page.locator('#contact').fill('CLIENT FLOW TEST');await page.locator('#payProof').setInputFiles('tests/fixtures/yard-placeholder.jpg');await page.locator('#proofStatus').getByText('付款截图已保存，可以提交订单。').waitFor();await page.reload();await active(7);await page.waitForFunction(()=>!document.getElementById('submitOrder').disabled);assert.equal(await page.locator('#contact').inputValue(),'CLIENT FLOW TEST');
  // Revising a draft must preserve all fields and update the same order on returning to payment.
  await back(7);await active(6);await back(6);await active(5);await page.locator('#notes').fill('修改后的保留项');await page.reload();await active(5);await page.locator('[data-go="6"]').click();await page.locator('#toPay').click();await page.waitForFunction(()=>!document.getElementById('submitOrder').disabled);assert.equal(latestDetails.notes,'修改后的保留项');assert.equal(latestDetails.yard_size,'100㎡以上');assert.equal(createCount,2);
  await page.screenshot({path:out+'/payment-'+viewport.width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const download=page.waitForEvent('download');await page.locator('#saveQr').click();assert.match((await download).suggestedFilename(),/收款码/);
  await page.locator('#submitOrder').click();await active(8);await page.locator('#statusTitle').getByText('等待付款确认').waitFor();assert.equal(proofCount,1);assert.equal(submitCount,1);await page.reload();await active(8);await page.locator('#statusTitle').getByText('等待付款确认').waitFor();assert.equal(submitCount,1);assert.equal(await page.locator('#resumeLink').getAttribute('href').then(Boolean),true);
  await page.screenshot({path:out+'/submitted-'+viewport.width+'.png',fullPage:true});assert.deepEqual(errors,[]);evidence.push({viewport,allFiveSizes:true,allFiveStyles:true,backAndReload:true,needsPersist:true,paymentQrAndContact:true,qrDownload:true,saveRetry:true,draftEditPersist:true,sameOrderSubmit:true,pageErrors:errors});await context.close();
 }
 console.log(JSON.stringify({passed:true,evidence}));fs.writeFileSync(out+'/client-flow-results.json',JSON.stringify({passed:true,evidence},null,2));
}finally{await browser?.close();server.kill();}
