import assert from 'node:assert/strict';
const origin=process.env.TEST_URL||'http://localhost:8794';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local tests only');
class Client{
 cookie='';csrf='';
 async call(path,method='GET',body){const r=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}
 async ok(...args){const r=await this.call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
 async login(username,password){await this.ok('/login','POST',{username,password});this.csrf=(await this.ok('/me')).csrf}
}
const owner=new Client(),editor=new Client(),guest=new Client();await owner.login('test_admin','Changed-admin-pass-123');await editor.login('extra_user_0','Extra-user-pass-123');
const stock=(await owner.ok('/portfolio?market=US')).items.find(s=>s.ticker==='NVDA'),input={username:'test_admin',stock_id:stock.id,currency:'USD',price:'215'};
const oldTrades=await owner.ok('/transactions'),oldNote=await owner.ok('/stocks/'+stock.id+'/note'),editorPortfolio=await editor.ok('/portfolio');
assert.equal((await guest.call('/community/price','POST',input)).status,401);
const noCsrf=new Client();noCsrf.cookie=editor.cookie;assert.equal((await noCsrf.call('/community/price','POST',input)).status,403);
for(const price of ['0','-10','NaN',''])assert.equal((await editor.call('/community/price','POST',{...input,price})).status,400);
assert.equal((await editor.call('/community/price','POST',{...input,currency:'KRW'})).status,400);
assert.equal((await editor.call('/community/price','POST',{...input,username:'test_user'})).status,404);
await owner.ok('/stocks/'+stock.id+'/price','POST',{mode:'API'});
await editor.ok('/community/price','POST',input);
let actual=(await owner.ok('/portfolio?market=US')).items.find(s=>s.id===stock.id);assert.equal(actual.price_mode,'MANUAL');assert.equal(actual.manual_price,'215');assert.equal(actual.position.value,'1505');assert.equal(actual.position.pnl,'210');assert.ok(Math.abs(Number(actual.position.rate)-210/1295*100)<1e-10);
let feed=(await editor.ok('/community/portfolios?market=US')).users.find(u=>u.username==='test_admin').items.find(s=>s.ticker==='NVDA');assert.equal(feed.stockId,stock.id);assert.equal(feed.current,'215');assert.equal(feed.priceEditedBy,(await editor.ok('/me')).nickname);assert.equal(feed.priceSource,'MANUAL');
assert.deepEqual(await editor.ok('/portfolio'),editorPortfolio);assert.deepEqual(await owner.ok('/transactions'),oldTrades);assert.deepEqual(await owner.ok('/stocks/'+stock.id+'/note'),oldNote);
await owner.ok('/stocks/'+stock.id+'/price','POST',{price:'200',mode:'MANUAL'});feed=(await editor.ok('/community/portfolios?market=US')).users.find(u=>u.username==='test_admin').items.find(s=>s.ticker==='NVDA');assert.equal(feed.priceEditedBy,null);
for(const [market,currency,ticker,price] of [['KR','KRW','005930','81000'],['JP','JPY','7203','3100']]){const s=(await owner.ok('/portfolio?market='+market)).items.find(s=>s.ticker===ticker);await editor.ok('/community/price','POST',{username:'test_admin',stock_id:s.id,currency,price});assert.equal((await owner.ok('/portfolio?market='+market)).items.find(x=>x.id===s.id).position.current,price);}
const closed=await owner.ok('/stocks','POST',{market:'US',ticker:'C'+Date.now(),name:'closed test',exchange:'NASDAQ'});
for(const type of ['BUY','SELL'])await owner.ok('/transactions','POST',{stock_id:closed.id,type,price:'1',quantity:'1',fee:'0',trade_date:'2026-10-08',reason:'',memo:'',request_id:crypto.randomUUID()});
assert.equal((await editor.call('/community/price','POST',{...input,stock_id:closed.id})).status,404);
await editor.ok('/community/price','POST',input);
console.log('PASS: authenticated peer price edits recalculate owner returns, preserve editor portfolio/private records, log editor, validate currencies and held stocks, and allow owner replacement');
