import {Decimal} from './calculation';
export const markets={US:{currency:'USD',exchange:'NASDAQ'},KR:{currency:'KRW',exchange:'KRX'},JP:{currency:'JPY',exchange:'TSE'}} as const;
export type Market=keyof typeof markets;
export function marketFilter(value:unknown):Market|'ALL'{
  if(value===undefined||value===null||value==='ALL')return 'ALL';
  if(typeof value!=='string'||!Object.hasOwn(markets,value))throw new Error('한국장·미국장·일본장을 선택하세요');
  return value as Market;
}
export function stockMarket(value:unknown,ticker:string,currency?:unknown){
  const market=marketFilter(value??'US');if(market==='ALL')throw new Error('종목의 시장을 선택하세요');
  const patterns={US:/^[A-Z][A-Z0-9.-]{0,14}$/,KR:/^\d{6}$/,JP:/^[0-9A-Z]{4}$/};
  if(!patterns[market].test(ticker))throw new Error(market==='KR'?'한국 종목코드는 6자리 숫자입니다':market==='JP'?'일본 종목코드는 영문·숫자 4자리입니다':'미국 티커 형식을 확인하세요');
  if(currency!==undefined&&currency!==markets[market].currency)throw new Error('시장과 거래 통화가 일치하지 않습니다');
  return {market,...markets[market]};
}
type Amounts={cost:string;value:string|null;quantity:string;realized?:string};
export function portfolioSummary(items:{currency:string;position:Amounts}[],rates:Record<string,string|null>,filter:Market|'ALL'='ALL'){
  const currencies=[...new Set(items.map(s=>s.currency))];
  const currency=filter!=='ALL'?markets[filter].currency:currencies.length===1?currencies[0]:'KRW';
  let cost=new Decimal(0),value=new Decimal(0),realized=new Decimal(0),missing=0,missingFx=0;
  for(const s of items){
    const factor=s.currency===currency?'1':rates[s.currency],p=s.position;
    if(new Decimal(p.quantity).gt(0)&&p.value===null)missing++;
    if(!factor){missingFx++;continue;}
    cost=cost.plus(new Decimal(p.cost).mul(factor));realized=realized.plus(new Decimal(p.realized??'0').mul(factor));
    if(new Decimal(p.quantity).gt(0)&&p.value!==null)value=value.plus(new Decimal(p.value).mul(factor));
  }
  const pnl=missing||missingFx?null:value.minus(cost);
  return {currency,cost:missingFx?null:cost.toFixed(),value:missing||missingFx?null:value.toFixed(),pnl:pnl?.toFixed()??null,rate:pnl&&!cost.isZero()?pnl.div(cost).mul(100).toFixed():null,realized:missingFx?null:realized.toFixed(),missing,missingFx};
}
