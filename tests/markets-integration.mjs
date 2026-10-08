import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin=process.env.TEST_URL||'http://localhost:8792';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local test environment only');
let cookie='',csrf='';
async function call(path,method='GET',body){const res=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()}}
async function ok(...args){const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
await ok('/login','POST',{username:'test_admin',password:'Changed-admin-pass-123'});csrf=(await ok('/me')).csrf;
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',process.env.TEST_STATE||'../../work/signup-test-state','--command',`UPDATE fx_rates SET rate=CASE pair WHEN 'USD/KRW' THEN '1300' ELSE '9' END,rate_date='2026-10-08',checked_at='${new Date().toISOString()}',last_attempt=${Date.now()},refresh_failed=0;`],{stdio:'pipe'});
const before=await ok('/portfolio?market=US');assert.equal(before.items[0].ticker,'NVDA');assert.equal(before.items[0].currency,'USD');assert.equal(before.items[0].position.value,'1400');
const kr=await ok('/stocks','POST',{market:'KR',ticker:'005930',name:'삼성전자',exchange:'KRX',currency:'KRW'}),jp=await ok('/stocks','POST',{market:'JP',ticker:'7203',name:'Toyota',exchange:'TSE',currency:'JPY'});
assert.equal((await ok('/stocks','POST',{market:'KR',ticker:'005930',name:'duplicate',exchange:'KRX'})).id,kr.id);
assert.equal((await call('/stocks','POST',{market:'JP',ticker:'130A',name:'Invalid currency',exchange:'TSE',currency:'USD'})).status,400);
for(const [stock,price,fee,current] of [[kr,'70000','1000','80000'],[jp,'2800','100','3000']]){
  await ok('/transactions','POST',{stock_id:stock.id,currency:stock.currency,type:'BUY',price,quantity:'10',fee,trade_date:'2026-10-08',reason:'Local market test',memo:'private test',request_id:crypto.randomUUID()});
  await ok('/stocks/'+stock.id+'/price','POST',{mode:'MANUAL',price:current});
  assert.equal((await call('/stocks/'+stock.id+'/price','POST',{mode:'API'})).status,400);
  assert.equal((await call('/stocks/'+stock.id+'/quote','POST',{})).status,400);
}
assert.equal((await call('/transactions','POST',{stock_id:kr.id,currency:'USD',type:'BUY',price:'1',quantity:'1',fee:'0',trade_date:'2026-10-08',reason:'',memo:'',request_id:crypto.randomUUID()})).status,400);
const filteredKr=await ok('/portfolio?market=KR'),filteredJp=await ok('/portfolio?market=JP');assert.equal(filteredKr.items.length,1);assert.equal(filteredKr.summary.currency,'KRW');assert.equal(filteredKr.summary.pnl,'99000');assert.equal(filteredJp.summary.currency,'JPY');assert.equal(filteredJp.summary.pnl,'1900');
const all=await ok('/portfolio');assert.equal(all.summary.currency,'KRW');assert.equal(all.summary.cost,'2637400');assert.equal(all.summary.value,'2890000');assert.equal(all.summary.pnl,'252600');
assert.equal((await ok('/transactions?market=JP')).length,1);assert.equal((await ok('/transactions?market=JP'))[0].currency,'JPY');
const shared=(await ok('/community/portfolios?market=KR')).users.find(u=>u.username==='test_admin');assert.equal(shared.items.length,1);assert.equal(shared.items[0].market,'KR');assert.equal(shared.items[0].currency,'KRW');assert.equal(shared.summary.value,'800000');assert.ok(!JSON.stringify(shared).includes('private test'));
const uniqueUS=await ok('/stocks','POST',{market:'US',ticker:'TEST',name:'Test US',exchange:'NASDAQ'}),uniqueJP=await ok('/stocks','POST',{market:'JP',ticker:'TEST',name:'Test JP',exchange:'TSE'});assert.notEqual(uniqueUS.id,uniqueJP.id);assert.equal((await ok('/stocks?market=JP&q=TEST')).length,1);
assert.equal((await call('/portfolio?market=EU')).status,400);
console.log('PASS: preserved US holdings, KR/JP native trades, exact mixed KRW totals, market filtering, currency rejection, shared privacy and cross-market ticker identity');
