import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../workbench/recovery.js',import.meta.url),'utf8');
function setup({legacy=false,hash='',entries=new Map(),request=async()=>Response.json({id:'synthetic-user'}),blockedStorage=false}={}){
  const nodes=new Map(),calls=[],history=[];
  const q=s=>{if(!nodes.has(s))nodes.set(s,{value:'',disabled:false,textContent:'',className:'',classList:{hidden:s==='#setCard',add(x){if(x==='hidden')this.hidden=true},remove(x){if(x==='hidden')this.hidden=false}}});return nodes.get(s);};
  q('#email').value='synthetic-owner@example.test';
  const location={pathname:'/dayi-garden/workbench/'+(legacy?'reset.html':'recover-v2.html'),hash,search:''};
  const window={location,document:{querySelector:q},history:{replaceState(...args){history.push(args);}},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>entries.get(k),setItem(k,v){if(blockedStorage)throw Error('denied');entries.set(k,v)},removeItem(k){if(blockedStorage)throw Error('denied');entries.delete(k);}},Day1Session:{fetchWithTimeout:async(url,options,timeout)=>{calls.push({url,options,timeout});assert.ok(history.length||!hash,'credentials cleared before fetch');return request(url,options);}}};
  vm.runInNewContext(source,{window,URLSearchParams,Date});
  return {q,calls,history,entries,send:q(legacy?'#send':'#sendBtn'),save:q(legacy?'#save':'#saveBtn'),sendMsg:q(legacy?'#requestMsg':'#sendMsg'),settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('both recovery routes verify the token before allowing password mutation and scrub callback immediately',async()=>{
  for(const legacy of [false,true]){
    let finish;const s=setup({legacy,hash:'#access_token=synthetic-token&refresh_token=synthetic-refresh',request:()=>new Promise(resolve=>{finish=resolve;})});
    assert.equal(s.save.disabled,true);assert.equal(s.calls[0].options.method,'GET');assert.equal(s.history[0][2],'/dayi-garden/workbench/'+(legacy?'reset.html':'recover-v2.html'));
    await s.save.onclick();assert.equal(s.calls.length,1);
    finish(Response.json({id:'synthetic-user'}));await s.settle();assert.equal(s.q('#p1').disabled,false);
    assert.equal(s.calls[0].timeout,30000);assert.equal(s.entries.size,0);
  }
});
test('expired fragment and stale legacy session never show a valid reset form or permit PUT',async()=>{
  for(const legacy of [false,true]){
    const entries=new Map(legacy?[['day1_mobile_session_v1',JSON.stringify({access_token:'synthetic-expired'})]]:[]);
    const s=setup({legacy,entries,hash:legacy?'':'#access_token=synthetic-expired',request:async()=>new Response('',{status:401})});await s.settle();
    assert.equal(s.q('#setCard').classList.hidden,true);assert.match(s.sendMsg.textContent,/失效/);
    await s.save.onclick();assert.equal(s.calls.filter(x=>x.options.method==='PUT').length,0);
  }
});
test('recovery sends are single-flight and reload respects timestamp-only cooldown',async()=>{
  const entries=new Map();let finish;const s=setup({entries,request:()=>new Promise(resolve=>{finish=resolve;})});
  const first=s.send.onclick();await s.send.onclick();assert.equal(s.calls.length,1);
  const reload=setup({entries});await reload.send.onclick();assert.equal(reload.calls.length,0);
  assert.deepEqual([...entries.keys()],['day1.auth.recoveryRetryAt.v1']);assert.match(entries.values().next().value,/^\d+$/);
  finish(Response.json({}));await first;assert.match(s.sendMsg.textContent,/请求已提交/);
});
test('ambiguous sends and server throttling never resend automatically or claim a completed reset',async()=>{
  for(const request of [async()=>{throw Error('timeout')},async()=>new Response('',{status:429})]){
    const s=setup({request});await s.send.onclick();await s.send.onclick();assert.equal(s.calls.length,1);assert.equal(s.send.disabled,true);
    assert.match(s.sendMsg.textContent,/确认|频繁/);
  }
});
test('successful password save clears inputs/token despite blocked legacy storage and cannot repeat PUT',async()=>{
  const s=setup({hash:'#access_token=synthetic-token',blockedStorage:true});await s.settle();s.q('#p1').value=s.q('#p2').value='synthetic-password';
  await s.save.onclick();assert.equal(s.q('#p1').value,'');assert.equal(s.q('#p2').value,'');assert.equal(s.save.disabled,true);assert.match(s.q('#setMsg').textContent,/已更新成功/);
  await s.save.onclick();assert.equal(s.calls.filter(x=>x.options.method==='PUT').length,1);
});
test('verification network failure supports a read-only retry and never silently resubmits passwords',async()=>{
  let attempt=0;const s=setup({hash:'#access_token=synthetic-token',request:async()=>{if(++attempt===1)throw Error('network');return Response.json({id:'synthetic-user'});}});await s.settle();
  assert.equal(s.save.textContent,'重试验证');await s.save.onclick();assert.equal(s.q('#p1').disabled,false);assert.deepEqual(s.calls.map(x=>x.options.method),['GET','GET']);
});
