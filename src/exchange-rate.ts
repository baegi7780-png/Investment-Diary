import {Decimal} from './calculation';
type CachedRate={rate:string|null;rate_date:string|null;checked_at:string|null;last_attempt:number;refresh_failed:number};
export const koreaDay=(time:number)=>new Date(time+9*60*60*1000).toISOString().slice(0,10);
export function parseRate(payload:unknown,time=Date.now()){
  const p=payload as Record<string,unknown>;
  if(!p||p.base!=='USD'||p.quote!=='KRW'||typeof p.rate!=='number'||!Number.isFinite(p.rate)||p.rate<=0||typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date||p.date>koreaDay(time))throw new Error('Invalid USD/KRW rate');
  return {rate:new Decimal(p.rate).toFixed(),date:p.date};
}
export async function exchangeRate(db:D1Database,fetcher:typeof fetch=fetch,time=Date.now()){
  const read=()=>db.prepare("SELECT * FROM exchange_rates WHERE pair='USD/KRW'").first<CachedRate>();
  let cached=(await read())!;
  // A database lease avoids concurrent requests fetching the provider repeatedly.
  if(!cached.checked_at||koreaDay(Date.parse(cached.checked_at))!==koreaDay(time)){
    const claim=await db.prepare("UPDATE exchange_rates SET last_attempt=? WHERE pair='USD/KRW' AND last_attempt<?").bind(time,time-60*60*1000).run();
    if(claim.meta.changes){
      try{
        const res=await fetcher('https://api.frankfurter.dev/v2/rate/USD/KRW',{signal:AbortSignal.timeout(8000)});
        if(!res.ok)throw new Error('Rate provider unavailable');
        const latest=parseRate(await res.json(),time);
        if(cached.rate_date&&latest.date<cached.rate_date)throw new Error('Older rate rejected');
        await db.prepare("UPDATE exchange_rates SET rate=?,rate_date=?,checked_at=?,refresh_failed=0 WHERE pair='USD/KRW'").bind(latest.rate,latest.date,new Date(time).toISOString()).run();
      }catch{
        await db.prepare("UPDATE exchange_rates SET refresh_failed=1 WHERE pair='USD/KRW'").run();
      }
      cached=(await read())!;
    }
  }
  return {base:'USD',quote:'KRW',rate:cached.rate,date:cached.rate_date,checkedAt:cached.checked_at,source:'Frankfurter',refreshFailed:!!cached.refresh_failed,usingCachedRate:!!cached.rate&&(!cached.checked_at||koreaDay(Date.parse(cached.checked_at))!==koreaDay(time))};
}
