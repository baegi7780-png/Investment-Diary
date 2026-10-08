import Decimal from './vendor/decimal.mjs';
Decimal.set({precision:50});
export function formatMoney(amount,rate){
  if(amount===null||amount===undefined)return {usd:'현재가 미설정',krw:null};
  const value=new Decimal(amount);
  const won=rate?value.mul(rate).toFixed(0,Decimal.ROUND_HALF_UP):null;
  return {usd:'$'+value.toFixed(2),krw:won===null?null:'약 '+won.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'원'};
}
