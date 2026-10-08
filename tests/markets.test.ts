import test from 'node:test';
import assert from 'node:assert/strict';
import {stockMarket,marketFilter,portfolioSummary} from '../src/markets.ts';
import {parseRate} from '../src/exchange-rate.ts';
// @ts-ignore Shared browser currency renderer.
import {formatMoney} from '../public/currency.mjs';
const holding=(currency:string,cost:string,value:string|null,realized='0')=>({currency,position:{cost,value,quantity:'1',realized}});
test('Markets select native currencies and validate Korean, US and alphanumeric Japanese codes',()=>{
  assert.equal(stockMarket('KR','005930').currency,'KRW');assert.equal(stockMarket('US','NVDA').currency,'USD');assert.equal(stockMarket('JP','130A').currency,'JPY');
  for(const [market,ticker,currency] of [['KR','NVDA','KRW'],['US','005930','USD'],['JP','72033','JPY'],['KR','005930','USD'],['EU','TEST','EUR']])assert.throws(()=>stockMarket(market,ticker,currency));
  assert.equal(marketFilter(null),'ALL');assert.throws(()=>marketFilter('invalid'));
});
test('Mixed currencies aggregate only after KRW conversion; a filtered market stays native',()=>{
  const items=[holding('USD','100','110'),holding('KRW','100000','120000'),holding('JPY','1000','1200')],rates={USD:'1300',KRW:'1',JPY:'9'};
  const total=portfolioSummary(items,rates);assert.equal(total.currency,'KRW');assert.equal(total.cost,'239000');assert.equal(total.value,'273800');assert.equal(total.pnl,'34800');
  const jp=portfolioSummary([items[2]],rates,'JP');assert.equal(jp.currency,'JPY');assert.equal(jp.value,'1200');assert.equal(jp.pnl,'200');
  const usd=portfolioSummary([items[0]],{});assert.equal(usd.currency,'USD');assert.equal(usd.value,'110');
});
test('Missing FX or current prices never create a partial mixed total',()=>{
  const partial=portfolioSummary([holding('USD','100','110'),holding('JPY','1000','1200')],{USD:'1300',JPY:null});assert.equal(partial.value,null);assert.equal(partial.cost,null);assert.equal(partial.missingFx,1);
  const price=portfolioSummary([holding('KRW','100',null)],{KRW:'1'},'KR');assert.equal(price.value,null);assert.equal(price.cost,'100');assert.equal(price.missing,1);
});
test('Native KRW and JPY formatting never uses a dollar symbol or converts KRW twice',()=>{
  assert.deepEqual(formatMoney('70000','1','KRW'),{usd:'₩70,000',krw:null});assert.deepEqual(formatMoney('3000','9','JPY'),{usd:'¥3,000.00',krw:'약 27,000원'});
  assert.equal(parseRate({base:'JPY',quote:'KRW',rate:9.2,date:'2026-10-08'},Date.parse('2026-10-08'),'JPY').rate,'9.2');
});
