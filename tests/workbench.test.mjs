import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const html=fs.readFileSync(new URL('../workbench/index.html',import.meta.url),'utf8');
const baseline=JSON.parse(fs.readFileSync(new URL('./workbench-baseline.json',import.meta.url),'utf8'));
test('confirmed workbench HTML, CSS, mobile rules and all links remain byte-identical',()=>{
  assert.equal(createHash('sha256').update(html.split('<script src=')[0]).digest('hex'),baseline.html_css_before_scripts_sha256);
  assert.deepEqual([...html.matchAll(/data-tab="([^"]+)"/g)].map(x=>x[1]),baseline.navigation);
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(x=>x[1]),baseline.protected_hrefs);
});
test('production inline scripts parse and SDK is pinned',()=>{
  for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
  assert.match(html,/@supabase\/supabase-js@2\.95\.0/);
  assert.match(html,/<script src="\.\/session.js"><\/script>/);
});
