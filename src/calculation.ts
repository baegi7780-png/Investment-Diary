import Decimal from 'decimal.js';
Decimal.set({precision:50, rounding:Decimal.ROUND_HALF_UP});
export {Decimal};
export type Trade={transaction_id:string,type:'BUY'|'SELL',price:string,quantity:string,fee:string,trade_date:string,created_at:string};
export function number(value:unknown,positive=false):string {
  if(typeof value!=='string'||!/^\d{1,12}(\.\d{1,8})?$/.test(value)) throw new Error('숫자는 최대 정수 12자리, 소수 8자리로 입력하세요');
  const n=new Decimal(value); if(n.isNegative()||(positive&&n.isZero())) throw new Error('가격과 수량은 0보다 커야 합니다'); return n.toFixed();
}
export function position(trades:Trade[],current:string|null=null) {
  let qty=new Decimal(0),cost=new Decimal(0),execution=new Decimal(0),realized=new Decimal(0),soldCost=new Decimal(0);
  const profits:Record<string,string>={};
  for(const t of [...trades].sort((a,b)=>a.trade_date.localeCompare(b.trade_date)||a.created_at.localeCompare(b.created_at)||a.transaction_id.localeCompare(b.transaction_id))) {
    const q=new Decimal(t.quantity),p=new Decimal(t.price),fee=new Decimal(t.fee);
    if(t.type==='BUY'){qty=qty.plus(q);cost=cost.plus(p.mul(q)).plus(fee);execution=execution.plus(p.mul(q));}
    else {
      if(q.gt(qty)) throw new Error(`${t.trade_date}: 보유수량을 초과하는 매도입니다. 이후 거래도 확인하세요`);
      const basis=cost.div(qty).mul(q),baseExecution=execution.div(qty).mul(q),profit=p.mul(q).minus(fee).minus(basis);
      profits[t.transaction_id]=profit.toFixed();realized=realized.plus(profit);soldCost=soldCost.plus(basis);qty=qty.minus(q);cost=cost.minus(basis);execution=execution.minus(baseExecution);
      if(qty.isZero()){cost=new Decimal(0);execution=new Decimal(0);}
    }
  }
  const value=current===null?null:new Decimal(current).mul(qty),pnl=value===null?null:value.minus(cost);
  return {quantity:qty.toFixed(),cost:cost.toFixed(),average:qty.isZero()?'0':execution.div(qty).toFixed(),averageCost:qty.isZero()?'0':cost.div(qty).toFixed(),current,value:value?.toFixed()??null,pnl:pnl?.toFixed()??null,rate:pnl===null||cost.isZero()?null:pnl.div(cost).mul(100).toFixed(),priceDifference:current===null||qty.isZero()?null:new Decimal(current).minus(execution.div(qty)).toFixed(),realized:realized.toFixed(),realizedRate:soldCost.isZero()?null:realized.div(soldCost).mul(100).toFixed(),profits};
}
