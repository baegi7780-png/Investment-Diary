import assert from 'node:assert/strict';
const origin=process.env.TEST_URL||'http://localhost:8794';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local tests only');
class Client{
 cookie='';csrf='';
 async call(path,method='GET',body){const res=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))this.cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()}}
 async ok(...args){const r=await this.call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
 async login(name){await this.ok('/login','POST',{username:name,password:name==='test_admin'?'Changed-admin-pass-123':'Extra-user-pass-123'});this.csrf=(await this.ok('/me')).csrf}
}
const owner=new Client(),reader=new Client(),guest=new Client();
await owner.login('test_admin');await reader.login('extra_user_0');await reader.ok('/profile','POST',{nickname:'공유조회테스터'});
const path='/community/records?username=test_admin&market=US';
assert.equal((await guest.call(path)).status,401);
assert.deepEqual((await reader.ok(path)).transactions,[]);assert.deepEqual((await reader.ok(path)).notes,[]);
let trades=await owner.ok('/transactions?market=US');let trade=trades[0];
assert.equal(trade.visibility,'PRIVATE');assert.equal(trade.reason_visibility,'PRIVATE');assert.equal(trade.memo_visibility,'PRIVATE');
trade={...trade,visibility:'PUBLIC',reason_visibility:'PUBLIC',memo_visibility:'PRIVATE',reason:'PUBLIC-REASON-ONLY',memo:'SECRET-MEMO-NEVER-SENT'};
await owner.ok('/transactions','PATCH',trade);
let shared=await reader.ok(path);assert.equal(shared.transactions.length,1);assert.equal(shared.transactions[0].reason,'PUBLIC-REASON-ONLY');assert.equal(shared.transactions[0].memo,null);assert.ok(!JSON.stringify(shared).includes('SECRET-MEMO'));assert.ok(!JSON.stringify(shared).includes('request_id'));assert.ok(!JSON.stringify(shared).includes('transaction_id'));
assert.equal((await reader.call('/transactions','PATCH',trade)).status,404);assert.equal((await reader.call(path,'POST',{})).status,405);
assert.equal((await owner.call('/transactions','PATCH',{...trade,visibility:'invalid'})).status,400);
assert.deepEqual((await reader.ok('/community/records?username=test_admin&market=KR')).transactions,[]);
await owner.ok('/transactions','PATCH',{...trade,reason_visibility:'PRIVATE',memo_visibility:'PUBLIC'});
shared=await reader.ok(path);assert.equal(shared.transactions[0].reason,null);assert.equal(shared.transactions[0].memo,trade.memo);
// An old client omitting visibility must preserve the owner's settings.
const legacy={...trade};delete legacy.visibility;delete legacy.reason_visibility;delete legacy.memo_visibility;
await owner.ok('/transactions','PATCH',legacy);shared=await reader.ok(path);assert.equal(shared.transactions[0].reason,null);assert.equal(shared.transactions[0].memo,trade.memo);
await owner.ok('/transactions','PATCH',{...trade,visibility:'PRIVATE',memo_visibility:'PUBLIC'});assert.deepEqual((await reader.ok(path)).transactions,[]);
await owner.ok('/stocks/'+trade.stock_id+'/note','POST',{content:'PUBLIC-JOURNAL',target_price:'250',stop_price:'150',visibility:'PUBLIC'});
assert.equal((await reader.ok(path)).notes[0].content,'PUBLIC-JOURNAL');assert.equal((await reader.ok('/stocks/'+trade.stock_id+'/note')).content,'');
await owner.ok('/stocks/'+trade.stock_id+'/note','POST',{content:'HIDDEN-JOURNAL',target_price:'250',stop_price:'150',visibility:'PRIVATE'});assert.deepEqual((await reader.ok(path)).notes,[]);
// Final public fixtures for UI inspection, including escaped hostile text.
await owner.ok('/transactions','PATCH',{...trade,visibility:'PUBLIC',reason:'<img src=x onerror=alert(1)> 성장 전망',reason_visibility:'PUBLIC',memo_visibility:'PRIVATE'});
await owner.ok('/stocks/'+trade.stock_id+'/note','POST',{content:'장기 성장 전망을 확인하고 분할 매수합니다.\n실적 발표 후 투자 판단을 다시 기록합니다.',target_price:'250',stop_price:'150',visibility:'PUBLIC'});
console.log('PASS: private migration defaults, authenticated public access, independent text privacy, revocation, market filtering, owner-only writes, legacy setting preservation and private SQL projection');

