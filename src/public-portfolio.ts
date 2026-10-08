import {Decimal,position,type Trade} from './calculation';
export async function publicPortfolio(db:D1Database){
  const owner=await db.prepare("SELECT id FROM users WHERE role='ADMIN' AND active=1 ORDER BY created_at,id LIMIT 1").first<{id:string}>();
  if(!owner)return {available:false,items:[],summary:null};
  const trades=(await db.prepare('SELECT transaction_id,stock_id,type,price,quantity,fee,trade_date,created_at FROM transactions WHERE user_id=?').bind(owner.id).all<Trade&{stock_id:string}>()).results;
  const stocks=(await db.prepare('SELECT s.id,s.ticker,s.name,s.exchange,o.price_mode,o.manual_price,o.updated_at manual_at,c.price api_price,c.updated_at api_at,c.provided_at,c.delay_note FROM stocks s LEFT JOIN user_price_overrides o ON o.stock_id=s.id AND o.user_id=? LEFT JOIN stock_price_cache c ON c.stock_id=s.id WHERE s.id IN (SELECT stock_id FROM transactions WHERE user_id=?) ORDER BY s.ticker').bind(owner.id,owner.id).all<Record<string,any>>()).results;
  const items=stocks.flatMap(s=>{
    const mode=s.price_mode==='API'?'API':'MANUAL';
    const p=position(trades.filter(t=>t.stock_id===s.id),mode==='API'?s.api_price??null:s.manual_price??null);
    if(new Decimal(p.quantity).isZero())return [];
    // Deliberate public allowlist: no account IDs, transaction IDs, profits map or notes.
    return [{ticker:s.ticker,name:s.name,exchange:s.exchange,currency:'USD',quantity:p.quantity,average:p.average,averageCost:p.averageCost,cost:p.cost,current:p.current,value:p.value,pnl:p.pnl,rate:p.rate,priceSource:mode,updatedAt:mode==='API'?s.api_at??null:s.manual_at??null,providedAt:mode==='API'?s.provided_at??null:null,delayNote:mode==='API'?s.delay_note??null:null}];
  });
  let cost=new Decimal(0),value=new Decimal(0),missing=0;
  for(const s of items){cost=cost.plus(s.cost);if(s.value===null)missing++;else value=value.plus(s.value)}
  const pnl=missing?null:value.minus(cost);
  return {available:true,items,summary:{cost:cost.toFixed(),value:missing?null:value.toFixed(),pnl:pnl?.toFixed()??null,rate:pnl&&!cost.isZero()?pnl.div(cost).mul(100).toFixed():null,missing}};
}
