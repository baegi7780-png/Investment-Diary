import Decimal from './vendor/decimal.mjs';
Decimal.set({precision:50});
export function pricePreview(holding,input){
  if(typeof input!=='string'||!/^\d{1,12}(\.\d{1,8})?$/.test(input)||new Decimal(input).lte(0))throw Error('예상 가격을 0보다 큰 숫자로 입력하세요. 소수 8자리까지 가능합니다.');
  const value=new Decimal(input).mul(holding.quantity),cost=new Decimal(holding.cost),pnl=value.minus(cost);
  return {price:new Decimal(input).toFixed(),value:value.toFixed(),pnl:pnl.toFixed(),rate:cost.isZero()?null:pnl.div(cost).mul(100).toFixed()};
}
