import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../direction-feedback/dashboard/index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
assert.ok(script,'order dashboard inline script exists');

function dashboard({owner=true,shared=true,firstOrderUnauthorized=false,isTest=true,state='waiting_payment_verification',privateResult=false}={}){
  const calls=[],buttons=[],details=[],elements=new Map(),storage=new Map();
  let token='workbench-token', authEvent, denied=false, confirmCount=0;
  function element(id){
    if(!elements.has(id))elements.set(id,{
      value:'',textContent:'',innerHTML:'',disabled:false,
      classList:{values:new Set(),add(x){this.values.add(x)},remove(x){this.values.delete(x)},contains(x){return this.values.has(x)}},
      replaceChildren(){this.innerHTML='';this.textContent=''},
      addEventListener(){},click(){this.onclick?.()},getAttribute(){return ''}
    });
    return elements.get(id);
  }
  const document={
    getElementById:element,
    querySelectorAll(selector){
      if(selector==='#orders details'){
        return [...element('orders').innerHTML.matchAll(/<details data-order="([^"]+)"/g)].map(match=>{
          const d={open:false,dataset:{},getAttribute:()=>match[1],addEventListener(_,fn){this.toggle=fn}};
          details.push(d);return d;
        });
      }
      if(selector==='[data-confirm-generate]'){
        return [...element('orders').innerHTML.matchAll(/data-confirm-generate="([^"]+)"/g)].map(match=>{
          const b={textContent:'确认测试付款',disabled:false,getAttribute:()=>match[1],addEventListener(_,fn){this.click=fn}};
          buttons.push(b);return b;
        });
      }
      return [];
    }
  };
  const rows=[{order_code:'DAYI-260930-TESTORDER',is_test:isTest,amount_cny:39.9,payment_status:state==='waiting_payment_verification'?'pending_verification':'confirmed',process_status:state,result_a_path:privateResult?'reviewed/example/result.png':null,result_bucket:privateResult?'dayi-private-results':'order-results',advice_json:[]}];
  const fetcher=async(url,opts={})=>{
    const endpoint=String(url),body=opts.body;
    calls.push({endpoint,method:opts.method,authorization:opts.headers?.Authorization,body});
    if(endpoint.includes('/rpc/day1_is_admin'))return Response.json(owner);
    if(endpoint.includes('/rest/v1/orders')){
      if(firstOrderUnauthorized&&!denied){denied=true;return Response.json({error:'expired'},{status:401})}
      return Response.json(rows);
    }
    if(endpoint.endsWith('/functions/v1/direction-feedback-api')){
      if(JSON.parse(body).action==='admin_history')return Response.json({deliveries:[{image_url:'https://example.test/private-signed-result'}]});
      return Response.json({confirmed:true,state:'pending_generation'});
    }
    if(endpoint.includes('/rest/v1/rpc/'))return Response.json([]);
    throw Error('Unexpected network request: '+endpoint);
  };
  const auth={
    async getSession(){return {data:{session:shared?{access_token:token}:null},error:null}},
    async refreshSession(){token='refreshed-token';return {data:{session:{access_token:token}},error:null}},
    onAuthStateChange(cb){authEvent=cb;return {data:{subscription:{unsubscribe(){}}}}},
    async signOut(){shared=false;authEvent('SIGNED_OUT')}
  };
  const runtime={document,fetch:fetcher,Response,window:{supabase:{createClient:()=>({auth})},confirm(){confirmCount++;return true}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    Date,setTimeout,clearTimeout,URL,navigator:{},FormData};
  vm.createContext(runtime);vm.runInContext(script,runtime);
  return {calls,buttons,details,element,storage,authEvent:()=>authEvent,confirmCount:()=>confirmCount,settle:()=>new Promise(resolve=>setTimeout(resolve,5))};
}

test('signed-in workbench owner opens the existing dashboard and confirms only a synthetic receipt',async()=>{
  const app=dashboard();await app.settle();
  assert.equal(app.element('dashboard').classList.contains('hidden'),false);
  assert.match(app.element('orders').innerHTML,/测试订单（未实际付款）/);
  assert.match(app.element('orders').innerHTML,/确认测试付款/);
  assert.equal(app.storage.has('dayi_admin_session'),false,'shared session must not be copied into legacy storage');
  assert.equal(app.buttons.length,1);
  app.buttons[0].click();await app.settle();
  assert.equal(app.confirmCount(),1);
  const mutations=app.calls.filter(x=>x.method==='POST'&&x.endpoint.includes('/functions/v1/'));
  assert.equal(mutations.length,1);
  assert.deepEqual(JSON.parse(mutations[0].body),{action:'admin_confirm',order_code:'DAYI-260930-TESTORDER'});
  assert.equal(app.calls.some(x=>x.endpoint.includes('/generate-direction-feedback')),false);
});

test('shared session without a positive server owner check cannot read orders',async()=>{
  const app=dashboard({owner:false});await app.settle();
  assert.equal(app.element('dashboard').classList.contains('hidden'),true);
  assert.equal(app.calls.filter(x=>x.endpoint.includes('/rest/v1/orders')).length,0);
  assert.equal(app.element('orders').innerHTML,'');
});

test('an expired shared token refreshes before retry and sign-out removes private order content',async()=>{
  const app=dashboard({firstOrderUnauthorized:true});await app.settle();
  const attempts=app.calls.filter(x=>x.endpoint.includes('/rest/v1/orders'));
  assert.equal(attempts.length,2);
  assert.equal(attempts[0].authorization,'Bearer workbench-token');
  assert.equal(attempts[1].authorization,'Bearer refreshed-token');
  assert.match(app.element('orders').innerHTML,/TESTORDER/);
  app.authEvent()('SIGNED_OUT');
  assert.equal(app.element('dashboard').classList.contains('hidden'),true);
  assert.equal(app.element('orders').innerHTML,'');
});

test('confirmed synthetic order cannot invoke the legacy generation retry button',async()=>{
  const synthetic=dashboard({state:'pending_generation'});await synthetic.settle();
  assert.doesNotMatch(synthetic.element('orders').innerHTML,/data-retry-generate/);
  assert.match(synthetic.element('orders').innerHTML,/测试单请使用上方人工交付/);
  const real=dashboard({state:'pending_generation',isTest:false});await real.settle();
  assert.match(real.element('orders').innerHTML,/data-retry-generate/,'existing production order control stays available');
});

test('private delivery preview uses owner history signed URL rather than public bucket URL',async()=>{
  const app=dashboard({state:'completed',privateResult:true});await app.settle();
  assert.match(app.element('orders').innerHTML,/id="result_DAYI-260930-TESTORDER"/);
  assert.doesNotMatch(app.element('orders').innerHTML,/object\/public\/order-results\/reviewed/);
  app.details[0].open=true;app.details[0].toggle();await app.settle();
  assert.equal(app.element('result_DAYI-260930-TESTORDER').src,'https://example.test/private-signed-result');
  assert.equal(app.calls.filter(x=>x.endpoint.includes('/functions/v1/direction-feedback-api')).length,1);
});
