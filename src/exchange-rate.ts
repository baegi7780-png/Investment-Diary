import {Decimal} from './calculation';
type CachedRate={rate:string|null;rate_date:string|null;checked_at:string|null;last_attempt:number;refresh_failed:number};
export const koreaDay=(time:number)=>new Date(time+9*60*60*1000).toISOString().slice(0,10);
export function parseRate(payload:unknown,time=Date.now(),base:'USD'|'JPY'='USD'){
  const p=payload as Record<string,unknown>;
  if(!p||p.base!==base||p.quote!=='KRW'||typeof p.rate!=='number'||!Number.isFinite(p.rate)||p.rate<=0||typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date||p.date>koreaDay(time))throw new Error('Invalid USD/KRW rate');
  return {rate:new Decimal(p.rate).toFixed(),date:p.date};
}
export async function exchangeRate(db:D1Database,fetcher:typeof fetch=fetch,time=Date.now(),base:'USD'|'JPY'='USD'){
  const pair=base+'/KRW';
  const read=()=>db.prepare("SELECT * FROM fx_rates WHERE pair=?").bind(pair).first<CachedRate>();
  let cached=(await read())!;
  // A database lease avoids concurrent requests fetching the provider repeatedly.
  if(!cached.checked_at||koreaDay(Date.parse(cached.checked_at))!==koreaDay(time)){
    const claim=await db.prepare("UPDATE fx_rates SET last_attempt=? WHERE last_attempt<? AND pair=?").bind(time,time-60*60*1000,pair).run();
    if(claim.meta.changes){
      try{
        const res=await fetcher('https://api.frankfurter.dev/v2/rate/'+base+'/KRW',{signal:AbortSignal.timeout(8000)});
        if(!res.ok)throw new Error('Rate provider unavailable');
        const latest=parseRate(await res.json(),time,base);
        if(cached.rate_date&&latest.date<cached.rate_date)throw new Error('Older rate rejected');
        await db.prepare("UPDATE fx_rates SET rate=?,rate_date=?,checked_at=?,refresh_failed=0 WHERE pair=?").bind(latest.rate,latest.date,new Date(time).toISOString(),pair).run();
      }catch{
        await db.prepare("UPDATE fx_rates SET refresh_failed=1 WHERE pair=?").bind(pair).run();
      }
      cached=(await read())!;
    }
  }
  return {base,quote:'KRW',rate:cached.rate,date:cached.rate_date,checkedAt:cached.checked_at,source:'Frankfurter',refreshFailed:!!cached.refresh_failed,usingCachedRate:!!cached.rate&&(!cached.checked_at||koreaDay(Date.parse(cached.checked_at))!==koreaDay(time))};
}

export async function exchangeRates(db:D1Database){const [USD,JPY]=await Promise.all([exchangeRate(db),exchangeRate(db,fetch,Date.now(),'JPY')]);return {USD,JPY};}
export async function cachedRates(db:D1Database){const rows=(await db.prepare('SELECT pair,rate FROM fx_rates').all<{pair:string;rate:string|null}>()).results;return Object.fromEntries([['KRW','1'],...rows.map(r=>[r.pair.split('/')[0],r.rate])]) as Record<string,string|null>;}
