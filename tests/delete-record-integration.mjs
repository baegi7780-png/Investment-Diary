import assert from 'node:assert/strict';
const origin=process.env.TEST_URL||'http://localhost:8794';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local tests only');
class Client{
 cookie='';csrf='';
 async call(path,method='GET',body){const r=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()}}
 async ok(...args){const r=await this.call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
 async login(username,password){await this.ok('/login','POST',{username,password});this.csrf=(await this.ok('/me')).csrf}
}
const owner=new Client(),other=new Client(),guest=new Client();
await owner.login('test_admin','Changed-admin-pass-123');await other.login('extra_user_0','Extra-user-pass-123');
const ticker='D'+Date.now(),stock=await owner.ok('/stocks','POST',{market:'US',ticker,name:'삭제 테스트',exchange:'NASDAQ'}),path='/stocks/'+stock.id+'/records';
await owner.ok('/transactions','POST',{stock_id:stock.id,type:'BUY',price:'10',quantity:'2',fee:'0',trade_date:'2026-10-08',reason:'삭제 테스트 이유',memo:'메모',visibility:'PUBLIC',reason_visibility:'PUBLIC',request_id:crypto.randomUUID()});
await owner.ok('/transactions','POST',{stock_id:stock.id,type:'SELL',price:'12',quantity:'1',fee:'0',trade_date:'2026-10-08',reason:'부분 매도',memo:'',request_id:crypto.randomUUID()});
await owner.ok('/stocks/'+stock.id+'/note','POST',{content:'삭제할 일지',target_price:'15',stop_price:'5',visibility:'PUBLIC'});
await owner.ok('/stocks/'+stock.id+'/price','POST',{price:'12',mode:'MANUAL'});
assert.equal((await guest.call(path,'DELETE',{confirmTicker:ticker})).status,401);
assert.equal((await other.call(path,'DELETE',{confirmTicker:ticker})).status,404);
assert.equal((await owner.call(path,'DELETE',{confirmTicker:'WRONG'})).status,400);
assert.equal((await owner.ok('/transactions')).filter(t=>t.stock_id===stock.id).length,2);
await other.ok('/transactions','POST',{stock_id:stock.id,type:'BUY',price:'20',quantity:'3',fee:'0',trade_date:'2026-10-08',reason:'다른 회원 기록',memo:'보존',request_id:crypto.randomUUID()});
await other.ok('/stocks/'+stock.id+'/note','POST',{content:'다른 회원 일지',target_price:'25',stop_price:'10'});
await other.ok('/stocks/'+stock.id+'/price','POST',{price:'22',mode:'MANUAL'});
assert.ok((await other.ok('/community/records?username=test_admin')).transactions.some(t=>t.ticker===ticker));
await owner.ok(path,'DELETE',{confirmTicker:ticker,user_id:(await other.ok('/me')).id});
assert.ok(!(await owner.ok('/transactions')).some(t=>t.stock_id===stock.id));assert.ok(!(await owner.ok('/portfolio')).items.some(s=>s.id===stock.id));
assert.equal((await owner.ok('/stocks/'+stock.id+'/note')).content,'');
const shared=await other.ok('/community/records?username=test_admin');assert.ok(!shared.transactions.some(t=>t.ticker===ticker));assert.ok(!shared.notes.some(t=>t.ticker===ticker));
assert.equal((await other.ok('/transactions')).filter(t=>t.stock_id===stock.id).length,1);assert.equal((await other.ok('/stocks/'+stock.id+'/note')).content,'다른 회원 일지');assert.equal((await other.ok('/portfolio')).items.find(s=>s.id===stock.id).manual_price,'22');
assert.equal((await owner.call(path,'DELETE',{confirmTicker:ticker})).status,404);
assert.ok((await owner.ok('/stocks?q='+ticker)).some(s=>s.id===stock.id));
console.log('PASS: own stock records deleted atomically, public copies gone, confirmation and authentication enforced, shared stock and other member records preserved');
