import assert from 'node:assert/strict';
const root=process.env.DAY1_SMOKE_URL || 'https://fendi945.github.io/dayi-garden/';
const page=await fetch(new URL('workbench/',root),{signal:AbortSignal.timeout(15000)});
assert.equal(page.status,200);const html=await page.text();
for(const name of ['dashboard','clients','finance','design','content','assets','tasks','core','account'])assert.ok(html.includes('data-tab="'+name+'"'),'Missing entry: '+name);
assert.ok(html.includes('进入 DAY1'));assert.ok(html.includes('name="viewport"'));
for(const route of ['direction-feedback/','direction-feedback/dashboard/']){
  const response=await fetch(new URL(route,root),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,'Preserved route: '+route);
}
if(process.argv.includes('--candidate')){
  assert.ok(html.includes('./session.js'),'Candidate session module absent');
  const response=await fetch(new URL('workbench/session.js',root),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
  assert.ok((await response.text()).includes('Day1Session'));
  const dashboard=await fetch(new URL('direction-feedback/dashboard/',root),{signal:AbortSignal.timeout(15000)});
  assert.equal(dashboard.status,200);
  const adminHtml=await dashboard.text();
  assert.ok(adminHtml.includes('day1_is_admin')&&adminHtml.includes('确认测试付款'),'Owner bridge or test receipt action absent');
}
console.log('PASS: primary URL, 9 protected entries and both legacy customer routes. This HTTP check does not prove authenticated or mobile interaction.');
