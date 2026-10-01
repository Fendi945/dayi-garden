import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../workbench/client-preview.js',import.meta.url),'utf8');
function setup(hidden=false){
  const nodes=[];
  function node(tag){const n={tag,children:[],events:{},style:{},open:false,removed:false,focused:false,classList:{contains:()=>hidden},setAttribute(){},addEventListener(k,fn){this.events[k]=fn},append(...items){this.children.push(...items)},showModal(){this.open=true},close(){this.open=false;this.events.close?.()},remove(){this.removed=true},focus(){this.focused=true}};nodes.push(n);return n;}
  const link=node('a'),app=node('section'),body=node('body');
  const document={body,querySelector:s=>s==='#appView'?app:link,createElement:node};
  const window={document};vm.runInNewContext(source,{window});
  return {window,link,nodes,click:(extra={})=>{const e={button:0,preventDefault(){this.prevented=true},...extra};link.events.click(e);return e;}};
}
test('backend preview returns without navigating/reloading the workbench and removes its frame on close',()=>{
  const s=setup();assert.equal(s.click().prevented,true);
  const dialog=s.nodes.find(n=>n.tag==='dialog'),frame=s.nodes.find(n=>n.tag==='iframe'),back=s.nodes.find(n=>n.tag==='button');
  assert.equal(dialog.open,true);assert.equal(frame.src,'../direction-feedback/');
  assert.equal(back.textContent,'← 返回设计 / 生图');
  back.events.click();assert.equal(dialog.removed,true);assert.equal(frame.src,'about:blank');assert.equal(s.link.focused,true);
  s.click();s.window.Day1ClientPreview.close();assert.equal(s.nodes.filter(n=>n.tag==='dialog').at(-1).removed,true);
});
test('signed-out shell and modified clicks cannot activate the backend preview',()=>{
  assert.equal(setup(true).click().prevented,undefined);
  for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]){
    const s=setup();assert.equal(s.click(extra).prevented,undefined);assert.equal(s.nodes.some(n=>n.tag==='iframe'),false);
  }
});
