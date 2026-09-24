// Browser rendering, including a delayed/broken image, determines whether a receipt may be sent.
import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const server=spawn('python3',['-m','http.server','8772','--bind','127.0.0.1','--directory','direction-feedback'],{stdio:'ignore'});let browser;
try{
 await new Promise(r=>setTimeout(r,400));browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const scenario of ['complete','broken','incomplete']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();let receipts=0,releaseImage;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const gate=new Promise(r=>releaseImage=r),fixture=fs.readFileSync('tests/fixtures/yard-placeholder.jpg');
  await page.route('**/result-test.jpg',async route=>{await gate;return scenario==='broken'?route.fulfill({status:500,body:'failed'}):route.fulfill({contentType:'image/jpeg',body:fixture});});
  await page.route('**/original-test.jpg',r=>r.fulfill({contentType:'image/jpeg',body:fixture}));
  await page.route('https://fhvhnibznphatfnbvvnb.supabase.co/**',async route=>{
   const req=route.request(),send=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(req.method()==='OPTIONS'||req.url().endsWith('/analytics_events'))return send({});const b=req.postDataJSON();
   assert.equal(b.order_code,'DY-47135563');assert.equal(b.access_token,'a'.repeat(64));
   if(b.action==='result')return send({checkout_stage:'submitted',process_status:'completed',has_photo:true,delivery_id:3,image_url:'http://127.0.0.1:8772/result-test.jpg',original_url:'http://127.0.0.1:8772/original-test.jpg',advice:scenario==='incomplete'?['a']:['保留原树','减少硬化','核对排水']});
   if(b.action==='result_seen'){receipts++;assert.equal(scenario,'complete');assert.equal(b.delivery_id,3);assert.equal(await page.locator('#resultBox').isVisible(),true);assert.equal(await page.locator('#resultImg').evaluate(i=>i.complete&&i.naturalWidth>0),true);assert.equal(await page.locator('#advice > div').count(),3);return send(receipts===1?{message:'temporary'}:{recorded:true},receipts===1?503:200);}
   throw Error('unexpected '+b.action);
  });
  await page.goto('http://127.0.0.1:8772/#order=DY-47135563&key='+'a'.repeat(64),{waitUntil:'domcontentloaded'});await page.waitForTimeout(200);assert.equal(receipts,0);assert.equal(await page.locator('#resultBox').isVisible(),false);releaseImage();
  if(scenario==='complete'){
   await page.waitForResponse(r=>r.request().postData()?.includes('result_seen'));await page.waitForTimeout(50);assert.equal(receipts,1);assert.equal(await page.locator('#resultBox').isVisible(),true);
   const retry=page.waitForResponse(r=>r.request().postData()?.includes('result_seen'));await page.locator('#retryStatus').click();await retry;assert.equal(receipts,2);assert.equal(await page.locator('#statusTitle').textContent(),'你的方向反馈已完成');
  }else{await page.waitForTimeout(250);assert.equal(receipts,0);assert.equal(await page.locator('#resultBox').isVisible(),false);}
  assert.deepEqual(errors,[]);console.log('PASS receipt '+scenario);await context.close();
 }
}finally{await browser?.close();server.kill();}
