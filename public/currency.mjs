import Decimal from './vendor/decimal.mjs';
Decimal.set({precision:50});
export function formatMoney(amount,rate,currency='USD'){
  if(amount===null||amount===undefined)return {usd:'현재가 미설정',krw:null};
  const value=new Decimal(amount);
  const won=rate&&currency!=='KRW'?value.mul(rate).toFixed(0,Decimal.ROUND_HALF_UP):null;
  const prefix={USD:'$',KRW:'₩',JPY:'¥'}[currency];
  if(!prefix)throw new Error('지원하지 않는 통화');
  const native=value.toFixed(currency==='KRW'&&value.isInteger()?0:2);
  return {usd:prefix+(currency==='USD'?native:native.replace(/\B(?=(\d{3})+(?!\d))/g,',')),krw:won===null?null:'약 '+won.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'원'};
}
