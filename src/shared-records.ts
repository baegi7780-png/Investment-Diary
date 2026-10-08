import type {Market} from './markets';
export function visibility(value:unknown,previous:unknown='PRIVATE'){
  const result=value===undefined?previous:value;
  if(result!=='PRIVATE'&&result!=='PUBLIC')throw new Error('공개 범위는 공개 또는 비공개로 선택하세요');
  return result;
}
export async function sharedRecords(db:D1Database,username:string,market:Market|'ALL'){
  const owner=await db.prepare('SELECT id,username,nickname FROM users WHERE username=? AND active=1').bind(username).first<{id:string;username:string;nickname:string|null}>();
  if(!owner)return null;
  const suffix=market==='ALL'?'':' AND s.market=?',args=market==='ALL'?[owner.id]:[owner.id,market];
  // Query only public records. Private text is removed in SQL, before serialization.
  const transactions=(await db.prepare("SELECT s.ticker,s.name,s.market,s.currency,t.type,t.trade_date,t.price,t.quantity,t.fee,CASE WHEN t.reason_visibility='PUBLIC' THEN t.reason ELSE NULL END AS reason,CASE WHEN t.memo_visibility='PUBLIC' THEN t.memo ELSE NULL END AS memo FROM transactions t JOIN stocks s ON s.id=t.stock_id WHERE t.user_id=? AND t.visibility='PUBLIC'"+suffix+' ORDER BY t.trade_date DESC,t.created_at DESC,t.transaction_id DESC').bind(...args).all()).results;
  const notes=(await db.prepare("SELECT s.ticker,s.name,s.market,s.currency,n.content,n.target_price,n.stop_price,n.updated_at FROM investment_notes n JOIN stocks s ON s.id=n.stock_id WHERE n.user_id=? AND n.visibility='PUBLIC'"+suffix+' ORDER BY n.updated_at DESC,s.ticker').bind(...args).all()).results;
  return {username:owner.username,nickname:owner.nickname,transactions,notes};
}
