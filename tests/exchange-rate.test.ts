import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeRate,parseRate,koreaDay} from '../src/exchange-rate.ts';
// @ts-ignore Shared browser module uses the local Decimal bundle.
import {formatMoney} from '../public/currency.mjs';
const time=Date.parse('2026-10-08T00:00:00Z');
test('USD/KRW response validation rejects wrong pair, bad dates and invalid rates',()=>{
  assert.deepEqual(parseRate({base:'USD',quote:'KRW',rate:1339.58,date:'2026-10-08'},time),{rate:'1339.58',date:'2026-10-08'});
  for(const change of [{base:'EUR'},{quote:'USD'},{rate:0},{rate:-1},{rate:Infinity},{rate:'1339'},{date:'2026-02-30'},{date:'2027-01-01'}])assert.throws(()=>parseRate({base:'USD',quote:'KRW',rate:1339.58,date:'2026-10-08',...change},time));
  assert.equal(koreaDay(Date.parse('2026-10-07T15:00:00Z')),'2026-10-08');
});
test('KRW conversion preserves decimal precision, negative/zero and missing values',()=>{
  assert.deepEqual(formatMoney('1400','1339.58'),{usd:'$1400.00',krw:'약 1,875,412원'});
  assert.equal(formatMoney('-105','1339.58').krw,'약 -140,656원');
  assert.equal(formatMoney('0','1339.58').krw,'약 0원');
  assert.equal(formatMoney('9007199254740993','1').krw,'약 9,007,199,254,740,993원');
  assert.equal(formatMoney(null,'1339.58').krw,null);assert.equal(formatMoney('100',null).krw,null);
});
function fakeDb(initial={}){
  const state={rate:null,rate_date:null,checked_at:null,last_attempt:0,refresh_failed:0,...initial};
  return {state,prepare:(sql:string)=>{let args:any[]=[];const statement={bind:(...a:any[])=>{args=a;return statement},first:async()=>({...state}),run:async()=>{
    if(sql.includes('SET last_attempt')){if(state.last_attempt>=args[1])return {meta:{changes:0}};state.last_attempt=args[0];}
    else if(sql.includes('SET rate=')){[state.rate,state.rate_date,state.checked_at]=args;state.refresh_failed=0;}
    else if(sql.includes('SET refresh_failed'))state.refresh_failed=1;
    else throw new Error('Unexpected SQL');
    return {meta:{changes:1}};
  }};return statement}} as any;
}
test('Daily refresh is shared across simultaneous readers and then served from cache',async()=>{
  const db=fakeDb();let calls=0;
  const fetcher=async()=>{calls++;return Response.json({base:'USD',quote:'KRW',rate:1339.58,date:'2026-10-08'})};
  await Promise.all([exchangeRate(db,fetcher as any,time),exchangeRate(db,fetcher as any,time)]);
  const result=await exchangeRate(db,fetcher as any,time+3600000);
  assert.equal(calls,1);assert.equal(result.rate,'1339.58');assert.equal(result.usingCachedRate,false);
});
test('Provider failure keeps previous rate and throttles retries; missing rate remains unavailable',async()=>{
  const db=fakeDb({rate:'1300',rate_date:'2026-10-07',checked_at:'2026-10-07T00:00:00Z'});let calls=0;
  const fail=async()=>{calls++;throw new Error('offline')};
  const result=await exchangeRate(db,fail as any,time);
  assert.equal(result.rate,'1300');assert.equal(result.date,'2026-10-07');assert.equal(result.usingCachedRate,true);assert.equal(result.refreshFailed,true);
  await exchangeRate(db,fail as any,time+1000);assert.equal(calls,1);
  assert.equal((await exchangeRate(fakeDb(),fail as any,time)).rate,null);
});
test('An older provider date cannot replace a saved rate',async()=>{
  const db=fakeDb({rate:'1300',rate_date:'2026-10-07',checked_at:'2026-10-07T00:00:00Z'});
  const result=await exchangeRate(db,(async()=>Response.json({base:'USD',quote:'KRW',rate:1000,date:'2026-10-06'})) as any,time);
  assert.equal(result.rate,'1300');assert.equal(result.refreshFailed,true);
});
