import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../workbench/production-status.js',import.meta.url),'utf8');
function setup(api){
  let hidden=false;const nodes=[];
  function createElement(tag){const n={tag,children:[],events:{},removed:false,textContent:'',append(...children){this.children.push(...children)},setAttribute(){},addEventListener(k,f){this.events[k]=f},remove(){this.removed=true}};nodes.push(n);return n;}
  const section=createElement('section');const document={createElement,querySelector:s=>s==='#appView'?{classList:{contains:()=>hidden}}:section};
  const root={document};vm.runInNewContext(source,root);const control=root.Day1ProductionStatus.create({api,document});
  return {control,nodes,section,hide:v=>hidden=v,text:()=>nodes.filter(n=>!n.removed).map(n=>n.textContent).join('|')};
}
const valid=()=>({image_key_configured:false,config:{enabled:false},calibration:{approved_types:[]}});
test('production monitoring is owner-session read only, coalesces and never sends a model/configuration action',async()=>{
  const calls=[];let release;const h=setup(body=>{calls.push(body);return new Promise(r=>release=r)});
  const a=h.control.refresh(),b=h.control.refresh();assert.equal(a,b);assert.equal(calls.length,1);assert.equal(JSON.stringify(calls),JSON.stringify([{action:'admin_status'}]));
  release(valid());await a;assert.match(h.text(),/待完成服务接入/);assert.match(h.text(),/已关闭/);assert.match(h.text(),/0 \/ 3/);
  assert.equal(h.nodes.find(n=>n.tag==='button').disabled,false);
});
test('configured key is not presented as a working provider and calibration counts only known scene types',async()=>{
  const x=valid();x.image_key_configured=true;x.calibration.approved_types=['毛坯庭院','毛坯庭院','injected'];const h=setup(async()=>x);await h.control.refresh();
  assert.match(h.text(),/已配置，调用尚需验证/);assert.match(h.text(),/1 \/ 3/);assert.ok(!h.text().includes('injected'));
});
test('signed-out shell cannot request status; logout removes panel and late private responses are discarded',async()=>{
  let release,calls=0;const h=setup(()=>{calls++;return new Promise(r=>release=r)});h.hide(true);await h.control.refresh();assert.equal(calls,0);
  h.hide(false);const pending=h.control.refresh();const panel=h.nodes.find(n=>n.id==='productionStatus');h.hide(true);h.control.clear();release(valid());await pending;assert.equal(panel.removed,true);assert.ok(!h.text().includes('毛坯庭院'));
});
test('failed or malformed responses replace stale status with unknown; retry requires a click',async()=>{
  let calls=0;const h=setup(async()=>{calls++;if(calls===1)return valid();if(calls===2)throw Error('private diagnostics');return {config:{enabled:true}}});
  await h.control.refresh();await h.control.refresh();assert.match(h.text(),/未能确认/);assert.ok(!h.text().includes('private diagnostics'));assert.equal(calls,2);
  await h.nodes.find(n=>n.tag==='button').events.click();assert.equal(calls,3);assert.match(h.text(),/未能确认/);
});
test('previous-session completion cannot clear the next session request or overwrite its status',async()=>{
  const releases=[];let calls=0;const h=setup(()=>{calls++;return new Promise(r=>releases.push(r))});
  const old=h.control.refresh();h.control.clear();const current=h.control.refresh();releases[0](valid());await old;
  assert.equal(h.control.refresh(),current);assert.equal(calls,2);const x=valid();x.image_key_configured=true;releases[1](x);await current;assert.match(h.text(),/已配置/);
});
