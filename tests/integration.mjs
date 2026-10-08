import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin=process.env.TEST_URL||'http://localhost:8787',setup=process.env.TEST_SETUP_TOKEN;
if(!setup)throw new Error('TEST_SETUP_TOKEN is required');
class Client{
  cookie='';csrf='';
  async call(path,method='GET',body){const res=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});const cookie=res.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];return {status:res.status,data:await res.json()};}
  async ok(path,method='GET',body){const r=await this.call(path,method,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
  async login(username,password){await this.ok('/login','POST',{username,password});this.csrf=(await this.ok('/me')).csrf}
}
const a=new Client(),b=new Client(),guest=new Client();
await a.ok('/setup','POST',{token:setup,username:'test_admin',password:'Admin-test-pass-123'});
await a.login('test_admin','Admin-test-pass-123');
await a.ok('/users','POST',{username:'test_user',password:'User-test-pass-123'});
const stock=await a.ok('/stocks','POST',{ticker:'NVDA',name:'NVIDIA',exchange:'NASDAQ'});
const buy1={stock_id:stock.id,type:'BUY',price:'180',quantity:'5',fee:'0',trade_date:'2026-10-01',reason:'AI 데이터센터 성장',memo:'',request_id:crypto.randomUUID()};
await a.ok('/transactions','POST',buy1);await a.ok('/transactions','POST',buy1);
await a.ok('/transactions','POST',{...buy1,price:'190',trade_date:'2026-10-02',request_id:crypto.randomUUID()});
assert.equal((await a.ok('/transactions')).length,2,'duplicate request prevented');
await a.ok(`/stocks/${stock.id}/price`,'POST',{mode:'MANUAL',price:'200'});
let p=(await a.ok('/portfolio')).items[0].position;assert.equal(p.average,'185');assert.equal(p.value,'2000');assert.equal(p.pnl,'150');assert.equal(Number(p.rate).toFixed(2),'8.11');
await a.ok('/transactions','POST',{...buy1,type:'SELL',price:'210',quantity:'3',trade_date:'2026-10-03',request_id:crypto.randomUUID()});
p=(await a.ok('/portfolio')).items[0].position;assert.equal(p.quantity,'7');assert.equal(p.average,'185');assert.equal(p.realized,'75');assert.equal(p.pnl,'105');
await a.ok('/logout','POST',{});await a.login('test_admin','Admin-test-pass-123');assert.equal((await a.ok('/portfolio')).items[0].manual_price,'200');
await b.login('test_user','User-test-pass-123');assert.equal((await b.ok('/transactions')).length,0);assert.equal((await b.ok('/portfolio')).items.length,0);
const ta=await a.ok('/transactions');assert.equal((await b.call('/transactions','DELETE',{transaction_id:ta[0].transaction_id})).status,404);
assert.equal((await b.call('/users')).status,403);assert.equal((await guest.call('/portfolio')).status,401);
const stolenCsrf=a.csrf;a.csrf='wrong';assert.equal((await a.call(`/stocks/${stock.id}/price`,'POST',{mode:'MANUAL',price:'300'})).status,403);a.csrf=stolenCsrf;
await b.ok(`/stocks/${stock.id}/price`,'POST',{mode:'MANUAL',price:'999'});assert.equal((await a.ok('/portfolio')).items[0].manual_price,'200');
assert.equal((await a.call('/transactions','PATCH',{...ta[0],quantity:'1'})).status,200);
assert.equal((await a.call('/transactions','DELETE',{transaction_id:ta[1].transaction_id})).status,400);
assert.equal((await a.call('/transactions','PATCH',{...ta[1],quantity:'1'})).status,400);
await a.ok('/transactions','PATCH',ta[0]);
await a.ok(`/stocks/${stock.id}/note`,'POST',{content:'기업 전망과 매매 복기',target_price:'250',stop_price:'150'});assert.equal((await a.ok(`/stocks/${stock.id}/note`)).content,'기업 전망과 매매 복기');assert.equal((await b.ok(`/stocks/${stock.id}/note`)).content,'');
assert.equal((await a.call(`/stocks/${stock.id}/quote`,'POST',{})).status,503);assert.equal((await a.ok('/portfolio')).items[0].price_mode,'MANUAL');
await a.ok(`/stocks/${stock.id}/price`,'POST',{mode:'API'});assert.equal((await a.ok('/portfolio')).items[0].position.value,null);
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to',process.env.TEST_STATE||'../../work/test-state','--command',"INSERT INTO stock_price_cache SELECT id,'195','2026-10-08T00:00:00.000Z','2026-10-08T00:00:00.000Z','TEST ONLY','테스트 환경 전용 가격' FROM stocks WHERE ticker='NVDA';"],{stdio:'pipe'});
assert.equal((await a.ok('/portfolio')).items[0].position.pnl,'70');
await a.ok(`/stocks/${stock.id}/price`,'POST',{mode:'MANUAL'});assert.equal((await a.ok('/portfolio')).items[0].position.pnl,'105');
for(let i=0;i<3;i++)await a.ok('/users','POST',{username:'extra_user_'+i,password:'Extra-user-pass-123'});assert.equal((await a.call('/users','POST',{username:'sixth_user',password:'Sixth-user-pass-123'})).status,400);
const users=await a.ok('/users'),uid=users.find(u=>u.username==='test_user').id;await a.ok('/users','PATCH',{id:uid,active:false});assert.equal((await b.call('/portfolio')).status,401);
await a.ok('/password','POST',{current:'Admin-test-pass-123',password:'Changed-admin-pass-123'});assert.equal((await a.call('/portfolio')).status,401);await a.login('test_admin','Changed-admin-pass-123');
console.log('PASS: NVDA scenario, duplicate prevention, persistence, isolation, CSRF, edit/delete replay, notes, API failure, mode switching, 5-user cap, deactivation, password change');
