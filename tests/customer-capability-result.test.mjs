import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../direction-feedback/capability-result.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../direction-feedback/index.html',import.meta.url),'utf8');
const code='DAYI-260930-TESTORDER',key='a'.repeat(64);

function viewer({hash='#order='+code+'&key='+key,decode=Promise.resolve(),status=200}={}){
  const calls=[],elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{
      style:{},textContent:'',src:'',complete:true,naturalWidth:800,children:[],onload:null,onerror:null,
      classList:{classes:new Set(id==='resultBox'?['hidden']:[]),add(s){this.classes.add(s)},remove(s){this.classes.delete(s)},contains(s){return this.classes.has(s)},toggle(s,b){b?this.add(s):this.remove(s)}},
      replaceChildren(){this.children=[]},appendChild(n){this.children.push(n)},decode(){return decode}
    });
    return elements.get(id);
  }
  const document={hidden:false,getElementById:element,querySelectorAll:s=>s==='.step'?[{getAttribute:()=> '8',classList:element('step').classList}]:[],createElement:()=>({children:[],appendChild(n){this.children.push(n)}}),createTextNode:t=>({textContent:t}),addEventListener(){}};
  const fetch=async(_,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    if(status!==200)return Response.json({error:'order_access_denied'},{status});
    if(body.action==='result_seen')return Response.json({recorded:true});
    return Response.json({order_code:code,process_status:'completed',image_url:'https://signed.example/result',advice:['一','二','三'],delivery_id:6});
  };
  for(const id of ['resultImg']){const img=element(id);Object.defineProperty(img,'src',{get(){return this._src||''},set(v){this._src=v;decode.then(()=>queueMicrotask(()=>this.onload?.()),()=>queueMicrotask(()=>this.onerror?.()))}})}
  const context={window:{location:{hash}},document,fetch,Response,URLSearchParams,AbortSignal,Promise,clearTimeout,setTimeout:()=>1,requestAnimationFrame:fn=>queueMicrotask(fn)};
  vm.createContext(context);vm.runInContext(source,context);
  return {calls,element,settle:()=>new Promise(resolve=>setTimeout(resolve,10))};
}

test('legacy intake remains present and loads the result adapter only for a capability fragment',async()=>{
  assert.match(html,/id="submitOrder"/);
  assert.match(html,/<script src="\.\/capability-result\.js" defer><\/script>/);
  const normal=viewer({hash:''});await normal.settle();assert.equal(normal.calls.length,0);
  const invalid=viewer({hash:'#order='+code+'&key=bad'});await invalid.settle();
  assert.equal(invalid.calls.length,0);assert.equal(invalid.element('statusTitle').textContent,'订单链接不完整');
});

test('signed image and exactly three suggestions display before current-delivery acknowledgement',async()=>{
  let showImage;const decode=new Promise(resolve=>{showImage=resolve});
  const app=viewer({decode});await app.settle();
  assert.deepEqual(app.calls.map(x=>x.action),['result']);
  assert.equal(app.element('resultBox').classList.contains('hidden'),true);
  showImage();await app.settle();
  assert.equal(app.element('resultImg').src,'https://signed.example/result');
  assert.equal(app.element('advice').children.length,3);
  assert.equal(app.element('resultBox').classList.contains('hidden'),false);
  assert.deepEqual(app.calls.map(x=>x.action),['result','result_seen']);
  assert.equal(app.calls[1].delivery_id,6);
  assert.equal(app.calls[1].access_token,key);
});

test('invalid capability never displays or acknowledges a result',async()=>{
  const app=viewer({status:403});await app.settle();
  assert.deepEqual(app.calls.map(x=>x.action),['result']);
  assert.equal(app.element('resultBox').classList.contains('hidden'),true);
  assert.equal(app.element('statusTitle').textContent,'订单链接暂时无法读取');
});

test('a signed URL that fails to decode is not reported as viewed',async()=>{
  let rejectDecode;const decode=new Promise((_,reject)=>{rejectDecode=reject});
  const app=viewer({decode});await app.settle();rejectDecode(new Error('image failed'));await app.settle();
  assert.deepEqual(app.calls.map(x=>x.action),['result']);
  assert.equal(app.element('resultBox').classList.contains('hidden'),true);
});
