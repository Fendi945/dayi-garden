import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
fs.mkdirSync('.qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const fixture=fs.readFileSync(new URL('./fixtures/yard-placeholder.jpg',import.meta.url));
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let hasPhoto=false,hasProof=false,submitted=false,complete=false,brokenAdvice=false,paymentUploads=0,yardUploads=0;
await page.route('https://fhvhnibznphatfnbvvnb.supabase.co/**',async route=>{const req=route.request();if(req.url().includes('/analytics_events'))return route.fulfill({status:201,body:'',headers:{'Access-Control-Allow-Origin':'*'}});let body;try{body=req.postDataJSON();}catch{body=null;}
 const send=x=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x),headers:{'Access-Control-Allow-Origin':'*'}});
 if(req.method()==='OPTIONS')return send({});
 if(!body){const raw=req.postData()||'';if(raw.includes('name="kind"\r\n\r\nyard')){hasPhoto=true;yardUploads++;}else{hasProof=true;paymentUploads++;}return send({uploaded:true});}
 if(body.action==='create')return send({order_code:'DAYI-260919-1234567890ABCDEF',has_photo:hasPhoto,has_proof:hasProof,checkout_stage:submitted?'submitted':'draft'});
 if(body.action==='submit'){submitted=true;return send({submitted:true});}
 if(body.action==='result')return send({checkout_stage:submitted?'submitted':'draft',payment_status:'pending_verification',process_status:complete||brokenAdvice?'completed':'waiting_payment_verification',has_photo:hasPhoto,has_proof:hasProof,image_url:complete||brokenAdvice?'http://127.0.0.1:8765/__fixture.jpg':null,original_url:'http://127.0.0.1:8765/__fixture.jpg',advice:complete?['保留原院的围墙和建筑，延续现有空间关系。','优先整理休闲位置，减少不必要的大面积硬化。','先核对现场排水，再决定具体施工做法。']:[]});
 return send({ready:true});});
await page.route('**/__fixture.jpg',r=>r.fulfill({contentType:'image/jpeg',body:fixture}));
await page.goto('http://127.0.0.1:8765/');await page.screenshot({path:'./.qa/customer-mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('[data-go="1"]').click();await page.locator('#yardPhoto').setInputFiles({name:'fixture.jpg',mimeType:'image/jpeg',buffer:fixture});await page.locator('#photoNext').click();await page.locator('[name="yardSize"][value="30–60㎡"]').check();await page.locator('#needs input[value="休闲喝茶"]').check();await page.locator('#needsNext').click();await page.locator('[name="style"][value="东方自然"]').check();await page.locator('#notes').fill('保留原来的树和围墙。');await page.locator('[data-go="6"]').click();await page.locator('#toPay').click();await page.locator('#contact').fill('unit-test');await page.locator('#payProof').setInputFiles({name:'proof.jpg',mimeType:'image/jpeg',buffer:fixture});await page.locator('#proofStatus').getByText('付款截图已保存，可以提交订单。').waitFor();await page.locator('#submitOrder').click();await page.locator('#orderCodeText').getByText('DAYI-260919-1234567890ABCDEF').waitFor();assert.equal(yardUploads,1);assert.equal(paymentUploads,1);
await page.reload();await page.locator('#statusTitle').getByText('等待付款确认').waitFor();assert.equal(await page.locator('[data-step="8"]').evaluate(el=>el.classList.contains('active')),true);
brokenAdvice=true;await page.locator('#retryStatus').click();await page.waitForTimeout(150);assert.equal(await page.locator('#resultBox').isVisible(),false);
complete=true;await page.locator('#retryStatus').click();await page.locator('#statusTitle').getByText('你的方向反馈已完成').waitFor();assert.equal(await page.locator('#advice>div').count(),3);assert.equal(await page.locator('#resultBox').isVisible(),true);
await page.locator('[data-consult]').first().click();assert.equal(await page.locator('#consultDialog').isVisible(),true);await page.locator('#closeConsult').click();
const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));let refreshed=false,oldRequests=0;
await admin.route('https://fhvhnibznphatfnbvvnb.supabase.co/**',async route=>{const req=route.request();const b=req.postDataJSON();const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
 if(req.url().includes('grant_type=refresh_token')){refreshed=true;return send({access_token:'new-token',refresh_token:'new-refresh',expires_at:9999999999});}
 if(req.headers().authorization==='Bearer old-token'){oldRequests++;return send({message:'expired'},401);}
 assert.equal(req.headers().authorization,'Bearer new-token');
 if(b.action==='admin_status')return send({config:{enabled:false,api_base:'https://dashscope.aliyuncs.com',image_model:'qwen-image-2.0-pro-2026-06-22',vision_model:'qwen3-vl-plus',minimum_score:80,max_images:2},image_key_configured:false,calibration:{ready:false,approved_types:[],required_types:['毛坯庭院','硬化庭院','已有植物庭院']}});
 if(b.action==='admin_orders')return send({orders:[]});return send({visitors:0,starts:0,offers:0,submitted:0,paid:0,completed:0,revenue:0});});
await admin.addInitScript(()=>sessionStorage.setItem('dayi_admin_v2',JSON.stringify({access_token:'old-token',refresh_token:'old-refresh',expires_at:9999999999})));
await admin.goto('http://127.0.0.1:8765/dashboard/');await admin.locator('#workspace:not(.hidden)').waitFor();await admin.locator('#visitors').getByText('0',{exact:true}).waitFor();assert.equal(refreshed,true);assert.equal(oldRequests,1);assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await admin.screenshot({path:'./.qa/admin-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
await page.setViewportSize({width:1440,height:1000});await page.locator('#newOrder').click();await page.locator('[data-step="0"].active').waitFor();await page.screenshot({path:'./.qa/customer-desktop.png',fullPage:true});
console.log(JSON.stringify({passed:true,checks:['mobile checkout and image uploads','reload restores submitted order','incomplete result not delivered','image plus 3 advice delivered','consultation dialog','admin token refresh replaces old token','mobile overflow absent','new order clears prior state'],yardUploads,paymentUploads,pageErrors:errors}));await browser.close();
