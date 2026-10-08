import {number,position,Decimal,type Trade} from './calculation';
import {communityPortfolios} from './public-portfolio';
import {visibility,sharedRecords} from './shared-records';
import {exchangeRate,exchangeRates,cachedRates} from './exchange-rate';
import {marketFilter,stockMarket,portfolioSummary} from './markets';
interface Env {DB:D1Database;ASSETS:Fetcher;SETUP_TOKEN?:string;ALLOW_HTTP_LOCAL?:string;TWELVE_DATA_API_KEY?:string;QUOTE_DISPLAY_APPROVED?:string}
type User={id:string;username:string;nickname:string|null;role:string;active:number;revision:number;password_hash:string};
const now=()=>new Date().toISOString(),id=()=>crypto.randomUUID();
const response=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const text=(v:unknown,max=200)=>{if(typeof v!=='string'||v.length>max)throw new Error('입력 길이나 형식을 확인하세요');return v.trim()};
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>Uint8Array.from(s.match(/../g)!,v=>parseInt(v,16));
async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
async function hash(p:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)).buffer)){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);
  return `${salt}:${hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256))}`;
}
function password(v:unknown){const p=text(v,128);if(p.length<12)throw new Error('비밀번호는 12자 이상이어야 합니다');return p}
function equal(a:string,b:string){let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
function cookie(token:string,secure:boolean,age=604800){return `journal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure?'; Secure':''}`}
async function body(r:Request){if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('JSON 요청이 필요합니다');const raw=await r.text();if(raw.length>30000)throw new Error('요청이 너무 큽니다');return JSON.parse(raw)}
async function rows<T>(db:D1Database,sql:string,...args:unknown[]){return (await db.prepare(sql).bind(...args).all<T>()).results}
async function trades(db:D1Database,uid:string,sid?:string){return rows<Trade&Record<string,any>>(db,'SELECT * FROM transactions WHERE user_id=?'+(sid?' AND stock_id=?':''),...sid?[uid,sid]:[uid])}
async function mutate(db:D1Database,u:Pick<User,'id'|'revision'>,statements:D1PreparedStatement[]){await db.batch([db.prepare('INSERT INTO write_guards VALUES (?,?)').bind(u.id,u.revision),...statements,db.prepare('DELETE FROM write_guards WHERE user_id=?').bind(u.id)])}
async function route(r:Request,e:Env):Promise<Response>{
  const url=new URL(r.url),path=url.pathname,method=r.method,secure=url.protocol==='https:';
  if(!path.startsWith('/api/'))return e.ASSETS.fetch(r);
  if(method!=='GET'&&r.headers.get('Origin')!==url.origin)return response({error:'요청 출처를 확인할 수 없습니다'},403);
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(!secure&&!(local&&e.ALLOW_HTTP_LOCAL==='true'))return response({error:'HTTPS가 필요합니다'},403);
  if(path==='/api/exchange-rate')return method==='GET'?response(await exchangeRate(e.DB)):response({error:'지원하지 않는 요청'},405);
  if(path==='/api/exchange-rates')return method==='GET'?response(await exchangeRates(e.DB)):response({error:'지원하지 않는 요청'},405);
  if(path==='/api/status'){
    const count=await e.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{count:number}>();
    const setting=await e.DB.prepare("SELECT value FROM app_settings WHERE key='account_limit'").first<{value:number}>();
    const limit=setting!.value;
    return response({setupRequired:!count!.count,accountLimit:limit,registrationOpen:count!.count>0&&(!limit||count!.count<limit)});
  }
  if(path==='/api/register'){
    if(method!=='POST')return response({error:'지원하지 않는 요청'},405);
    if(!(await e.DB.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").first()))return response({error:'관리자 초기 설정이 필요합니다'},403);
    const time=Date.now(),key='register:'+await digest(r.headers.get('CF-Connecting-IP')||'local');
    await e.DB.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').bind(key,time+900000,time,time).run();
    const attempt=await e.DB.prepare('SELECT count FROM login_attempts WHERE key=?').bind(key).first<{count:number}>();
    if(attempt!.count>20)return response({error:'가입 요청이 많습니다. 15분 후 다시 시도하세요'},429);
    const b=await body(r),username=text(b.username,40);
    if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username))throw new Error('아이디는 영문·숫자·._- 3~40자입니다');
    const h=await hash(password(b.password));
    await e.DB.prepare("INSERT INTO users(id,username,password_hash,role,created_at) VALUES (?,?,?,'USER',?)").bind(id(),username,h,now()).run();
    return response({ok:true});
  }
  if(path==='/api/setup'&&method==='POST'){
    const b=await body(r);if(!e.SETUP_TOKEN||!equal(String(b.token||''),e.SETUP_TOKEN))return response({error:'초기 설정 토큰이 올바르지 않습니다'},403);
    const username=text(b.username,40);if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username))throw new Error('아이디는 영문/숫자 3~40자입니다');
    const h=await hash(password(b.password));const result=await e.DB.prepare("INSERT INTO users (id,username,password_hash,role,created_at) SELECT ?,?,?,'ADMIN',? WHERE NOT EXISTS(SELECT 1 FROM users)").bind(id(),username,h,now()).run();
    return result.meta.changes?response({ok:true}):response({error:'초기 설정이 이미 완료되었습니다'},409);
  }
  if(path==='/api/login'&&method==='POST'){
    const b=await body(r),username=text(b.username,40),p=text(b.password,128),key=await digest((r.headers.get('CF-Connecting-IP')||'local')+':'+username.toLowerCase()),time=Date.now();
    await e.DB.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').bind(key,time+900000,time,time).run();
    const attempt=await e.DB.prepare('SELECT count FROM login_attempts WHERE key=?').bind(key).first<{count:number}>();if(attempt!.count>10)return response({error:'15분 후 다시 시도하세요'},429);
    const u=await e.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first<User>();
    const candidate=await hash(p,u?.password_hash.split(':')[0]||'00000000000000000000000000000000');
    if(!u||!u.active||!equal(candidate,u.password_hash))return response({error:'아이디 또는 비밀번호를 확인하세요'},401);
    const token=id()+id(),csrf=id();await e.DB.batch([e.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now()),e.DB.prepare('INSERT INTO sessions VALUES (?,?,?,?)').bind(await digest(token),u.id,csrf,new Date(time+604800000).toISOString()),e.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key)]);
    return response({ok:true},200,{'Set-Cookie':cookie(token,secure)});
  }
  const token=r.headers.get('Cookie')?.match(/(?:^|;\s*)journal_session=([^;]+)/)?.[1]||'',tokenHash=await digest(token);
  const session=await e.DB.prepare('SELECT s.csrf,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(tokenHash,now()).first<User&{csrf:string}>();
  if(!session)return response({error:'로그인이 필요합니다'},401);
  const u=session;
  if(method!=='GET'&&!equal(r.headers.get('X-CSRF-Token')||'',session.csrf))return response({error:'CSRF 토큰이 올바르지 않습니다'},403);
  if(path==='/api/profile'&&method==='POST'){
    const b=await body(r),nickname=text(b.nickname,100).normalize('NFKC').replace(/ +/g,' ');
    if([...nickname].length<2||[...nickname].length>20||!/^\p{L}[\p{L}\p{N} ._-]*$|^\p{N}[\p{L}\p{N} ._-]*$/u.test(nickname))throw new Error('닉네임은 2~20자이며 한글·영문·숫자·공백·._-를 사용할 수 있습니다. 첫 글자는 문자나 숫자여야 합니다');
    await e.DB.prepare('UPDATE users SET nickname=?,nickname_key=? WHERE id=?').bind(nickname,nickname.toLocaleLowerCase('en-US'),u.id).run();return response({ok:true,nickname});
  }
  if(!u.nickname&&!['/api/me','/api/logout'].includes(path))return response({error:'닉네임을 먼저 설정해주세요'},409);
  if(path==='/api/registration-settings'){
    if(u.role!=='ADMIN')return response({error:'관리자 권한이 필요합니다'},403);
    if(method==='POST'){
      const b=await body(r),limit=b.accountLimit;
      if(typeof limit!=='number'||!Number.isSafeInteger(limit)||limit<0||limit>100000)throw new Error('인원 제한은 0~100000 사이의 정수입니다. 0은 제한 없음입니다');
      await e.DB.prepare("UPDATE app_settings SET value=? WHERE key='account_limit'").bind(limit).run();
    }else if(method!=='GET')return response({error:'지원하지 않는 요청'},405);
    const setting=await e.DB.prepare("SELECT value FROM app_settings WHERE key='account_limit'").first<{value:number}>();
    return response({accountLimit:setting!.value});
  }
  if(path==='/api/community/portfolios')return method==='GET'?response(await communityPortfolios(e.DB,marketFilter(url.searchParams.get('market')))):response({error:'전체 투자현황은 조회만 가능합니다'},405);
  if(path==='/api/community/price')return response({error:'다른 회원의 현재가는 저장하지 않습니다. 화면의 예상 수익률을 이용하세요'},405);
  if(path==='/api/community/records'){
    if(method!=='GET')return response({error:'공개 기록은 조회만 가능합니다'},405);
    const records=await sharedRecords(e.DB,text(url.searchParams.get('username'),40),marketFilter(url.searchParams.get('market')));
    return records?response(records):response({error:'사용자를 찾을 수 없습니다'},404);
  }
  if(path==='/api/me')return response({id:u.id,username:u.username,nickname:u.nickname,needsNickname:!u.nickname,role:u.role,csrf:u.csrf});
  if(path==='/api/logout'&&method==='POST'){await e.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();return response({ok:true},200,{'Set-Cookie':cookie('',secure,0)})}
  if(path==='/api/password'&&method==='POST'){
    const b=await body(r);if(!equal(await hash(text(b.current,128),u.password_hash.split(':')[0]),u.password_hash))throw new Error('현재 비밀번호가 맞지 않습니다');
    await e.DB.batch([e.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hash(password(b.password)),u.id),e.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id)]);return response({ok:true},200,{'Set-Cookie':cookie('',secure,0)});
  }
  if(path==='/api/users'){
    if(u.role!=='ADMIN')return response({error:'관리자 권한이 필요합니다'},403);
    if(method==='GET')return response(await rows(e.DB,'SELECT id,username,nickname,role,active FROM users ORDER BY created_at'));
    const b=await body(r);
    if(method==='POST'){const name=text(b.username,40);if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(name))throw new Error('아이디 형식을 확인하세요');await e.DB.prepare("INSERT INTO users(id,username,password_hash,role,created_at) VALUES (?,?,?,'USER',?)").bind(id(),name,await hash(password(b.password)),now()).run()}
    else if(method==='PATCH'){if(b.id===u.id)throw new Error('자기 관리자 계정은 비활성화할 수 없습니다');if(typeof b.active!=='boolean')throw new Error('활성 상태를 확인하세요');await e.DB.batch([e.DB.prepare("UPDATE users SET active=? WHERE id=? AND role='USER'").bind(b.active?1:0,text(b.id)),e.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(b.id)])}
    else return response({error:'지원하지 않는 요청'},405);return response({ok:true});
  }
  if(path==='/api/stocks'){
    if(method==='GET'){const q=(url.searchParams.get('q')||'').slice(0,40),market=marketFilter(url.searchParams.get('market'));return response(await rows(e.DB,'SELECT id,ticker,name,exchange,market,currency FROM stocks WHERE (ticker LIKE ? OR name LIKE ?)'+(market==='ALL'?'':' AND market=?')+' ORDER BY market,ticker LIMIT 50',...market==='ALL'?['%'+q+'%','%'+q+'%']:['%'+q+'%','%'+q+'%',market]));}
    if(method==='POST'){const b=await body(r),ticker=text(b.ticker,15).toUpperCase(),config=stockMarket(b.market,ticker,b.currency),name=text(b.name,100),exchange=b.exchange?text(b.exchange,30):config.exchange;if(!name||!exchange)throw new Error('종목명과 거래소를 입력하세요');
      await e.DB.prepare("INSERT INTO stocks(id,identity_key,name,exchange,legacy_currency,ticker,market,currency) VALUES (?,?,?,?,'USD',?,?,?) ON CONFLICT(market,ticker) DO NOTHING").bind(id(),config.market+':'+ticker,name,exchange,ticker,config.market,config.currency).run();
      return response(await e.DB.prepare('SELECT id,ticker,name,exchange,market,currency FROM stocks WHERE ticker=? AND market=?').bind(ticker,config.market).first());}
  }
  if(path==='/api/portfolio'&&method==='GET'){
    const ts=await trades(e.DB,u.id),settings=await rows<Record<string,any>>(e.DB,'SELECT s.*,o.manual_price,o.price_mode,o.updated_at manual_at,c.price api_price,c.updated_at api_at,c.provided_at,c.delay_note FROM stocks s LEFT JOIN user_price_overrides o ON o.stock_id=s.id AND o.user_id=? LEFT JOIN stock_price_cache c ON c.stock_id=s.id WHERE s.id IN (SELECT stock_id FROM transactions WHERE user_id=? UNION SELECT stock_id FROM user_price_overrides WHERE user_id=?)',u.id,u.id,u.id);
    const market=marketFilter(url.searchParams.get('market'));
    const items=settings.filter(s=>market==='ALL'||s.market===market).map(s=>({...s,currency:s.currency,position:position(ts.filter(t=>t.stock_id===s.id),s.price_mode==='API'?s.api_price??null:s.manual_price??null)}));
    return response({items,summary:portfolioSummary(items,await cachedRates(e.DB),market)});
  }
  if(path==='/api/transactions'){
    if(method==='GET'){const market=marketFilter(url.searchParams.get('market'));return response(await rows(e.DB,'SELECT t.*,s.ticker,s.name,s.market,s.currency FROM transactions t JOIN stocks s ON s.id=t.stock_id WHERE user_id=?'+(market==='ALL'?'':' AND s.market=?')+' ORDER BY trade_date,created_at,transaction_id',...market==='ALL'?[u.id]:[u.id,market]));}
    const b=await body(r),existing=method==='POST'?null:await e.DB.prepare('SELECT * FROM transactions WHERE transaction_id=? AND user_id=?').bind(text(b.transaction_id),u.id).first<Trade&{stock_id:string;visibility:string;reason_visibility:string;memo_visibility:string}>();
    if(method!=='POST'&&!existing)return response({error:'거래를 찾을 수 없습니다'},404);
    const sid=existing?.stock_id||text(b.stock_id),all=await trades(e.DB,u.id,sid),tid=existing?.transaction_id||id();
    const tradeStock=await e.DB.prepare('SELECT currency FROM stocks WHERE id=?').bind(sid).first<{currency:string}>();
    if(!tradeStock)return response({error:'종목이 없습니다'},404);
    if(b.currency!==undefined&&b.currency!==tradeStock.currency)throw new Error('종목의 거래 통화와 입력 통화가 일치하지 않습니다');
    if(method==='POST'){const duplicate=await e.DB.prepare('SELECT * FROM transactions WHERE user_id=? AND request_id=?').bind(u.id,text(b.request_id)).first();if(duplicate)return response(duplicate)}
    if(!['POST','PATCH','DELETE'].includes(method))return response({error:'지원하지 않는 요청'},405);
    if(method==='DELETE'){position(all.filter(t=>t.transaction_id!==tid));await mutate(e.DB,u,[e.DB.prepare('DELETE FROM transactions WHERE transaction_id=? AND user_id=?').bind(tid,u.id)])}
    else {
      if(!['BUY','SELL'].includes(b.type))throw new Error('매수/매도를 선택하세요');const date=text(b.trade_date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('날짜가 올바르지 않습니다');
      const t:Trade={transaction_id:tid,type:b.type,price:number(b.price,true),quantity:number(b.quantity,true),fee:number(b.fee),trade_date:date,created_at:existing?.created_at||now()},reason=text(b.reason,3000),memo=text(b.memo,5000);
      position([...all.filter(x=>x.transaction_id!==tid),t]);
      const scope=visibility(b.visibility,existing?.visibility),reasonScope=visibility(b.reason_visibility,existing?.reason_visibility),memoScope=visibility(b.memo_visibility,existing?.memo_visibility);
      const stmt=method==='POST'?e.DB.prepare('INSERT INTO transactions(transaction_id,user_id,stock_id,type,price,quantity,fee,trade_date,reason,memo,request_id,created_at,updated_at,visibility,reason_visibility,memo_visibility) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(tid,u.id,sid,t.type,t.price,t.quantity,t.fee,date,reason,memo,text(b.request_id),t.created_at,now(),scope,reasonScope,memoScope):e.DB.prepare('UPDATE transactions SET type=?,price=?,quantity=?,fee=?,trade_date=?,reason=?,memo=?,updated_at=?,visibility=?,reason_visibility=?,memo_visibility=? WHERE transaction_id=? AND user_id=?').bind(t.type,t.price,t.quantity,t.fee,date,reason,memo,now(),scope,reasonScope,memoScope,tid,u.id);
      await mutate(e.DB,u,[stmt]);
    }
    return response({ok:true});
  }
  const deletion=path.match(/^\/api\/stocks\/([^/]+)\/records$/);
  if(deletion){
    if(method!=='DELETE')return response({error:'지원하지 않는 요청'},405);
    const sid=deletion[1],stock=await e.DB.prepare('SELECT ticker FROM stocks WHERE id=?').bind(sid).first<{ticker:string}>();
    const owned=await e.DB.prepare('SELECT stock_id FROM transactions WHERE user_id=? AND stock_id=? UNION SELECT stock_id FROM investment_notes WHERE user_id=? AND stock_id=? UNION SELECT stock_id FROM user_price_overrides WHERE user_id=? AND stock_id=?').bind(u.id,sid,u.id,sid,u.id,sid).first();
    if(!stock||!owned)return response({error:'내 투자기록을 찾을 수 없습니다'},404);
    const b=await body(r);if(b.confirmTicker!==stock.ticker)return response({error:'삭제할 종목코드를 정확히 입력하세요'},400);
    await mutate(e.DB,u,[
      e.DB.prepare('DELETE FROM transactions WHERE user_id=? AND stock_id=?').bind(u.id,sid),
      e.DB.prepare('DELETE FROM investment_notes WHERE user_id=? AND stock_id=?').bind(u.id,sid),
      e.DB.prepare('DELETE FROM user_price_overrides WHERE user_id=? AND stock_id=?').bind(u.id,sid),
      e.DB.prepare('DELETE FROM peer_price_updates WHERE owner_id=? AND stock_id=?').bind(u.id,sid)
    ]);
    return response({ok:true});
  }
  const match=path.match(/^\/api\/stocks\/([^/]+)\/(price|note|quote)$/);
  if(match){const sid=match[1],action=match[2];if(!await e.DB.prepare('SELECT id FROM stocks WHERE id=?').bind(sid).first())return response({error:'종목이 없습니다'},404);
    if(action==='price'&&method==='POST'){const b=await body(r);const marketStock=await e.DB.prepare('SELECT market FROM stocks WHERE id=?').bind(sid).first<{market:string}>();if(b.mode==='API'&&marketStock!.market!=='US')return response({error:'한국장·일본장은 현재가를 직접 입력하세요'},400);if(!['MANUAL','API'].includes(b.mode))throw new Error('가격 모드를 확인하세요');const prev=await e.DB.prepare('SELECT manual_price FROM user_price_overrides WHERE user_id=? AND stock_id=?').bind(u.id,sid).first<{manual_price:string|null}>(),price=b.price===undefined?prev?.manual_price??null:number(b.price,true);if(b.mode==='MANUAL'&&price===null)throw new Error('수동 현재가를 입력하세요');
      await mutate(e.DB,u,[e.DB.prepare('INSERT INTO user_price_overrides VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,stock_id) DO UPDATE SET manual_price=excluded.manual_price,price_mode=excluded.price_mode,updated_at=CASE WHEN ? THEN excluded.updated_at ELSE user_price_overrides.updated_at END').bind(id(),u.id,sid,price,b.mode,now(),b.price===undefined?0:1),e.DB.prepare('DELETE FROM peer_price_updates WHERE owner_id=? AND stock_id=?').bind(u.id,sid)]);return response({ok:true});}
    if(action==='note'){if(method==='GET')return response(await e.DB.prepare('SELECT * FROM investment_notes WHERE user_id=? AND stock_id=?').bind(u.id,sid).first()||{content:'',target_price:null,stop_price:null,visibility:'PRIVATE'});if(method==='POST'){const b=await body(r),previous=await e.DB.prepare('SELECT visibility FROM investment_notes WHERE user_id=? AND stock_id=?').bind(u.id,sid).first<{visibility:string}>();await e.DB.prepare('INSERT INTO investment_notes(user_id,stock_id,content,target_price,stop_price,updated_at,visibility) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,stock_id) DO UPDATE SET content=excluded.content,target_price=excluded.target_price,stop_price=excluded.stop_price,updated_at=excluded.updated_at,visibility=excluded.visibility').bind(u.id,sid,text(b.content,15000),b.target_price?number(b.target_price,true):null,b.stop_price?number(b.stop_price,true):null,now(),visibility(b.visibility,previous?.visibility)).run();return response({ok:true})}}
    if(action==='quote'&&method==='POST'){
      const marketStock=await e.DB.prepare('SELECT market FROM stocks WHERE id=?').bind(sid).first<{market:string}>();if(marketStock!.market!=='US')return response({error:'한국장·일본장은 현재가를 직접 입력하세요'},400);
      if(!e.TWELVE_DATA_API_KEY||e.QUOTE_DISPLAY_APPROVED!=='true')return response({error:'API가 미설정되어 있습니다. 수동 현재가를 이용하세요'},503);
      const cache=await e.DB.prepare('SELECT * FROM stock_price_cache WHERE stock_id=?').bind(sid).first<{updated_at:string}>();if(cache&&Date.now()-Date.parse(cache.updated_at)<900000)return response({ok:true,cached:true});
      const stock=await e.DB.prepare('SELECT ticker FROM stocks WHERE id=?').bind(sid).first<{ticker:string}>();
      const api=new URL('https://api.twelvedata.com/quote');api.searchParams.set('symbol',stock!.ticker);api.searchParams.set('apikey',e.TWELVE_DATA_API_KEY);
      let data:any;try{const upstream=await fetch(api,{signal:AbortSignal.timeout(10000)});data=await upstream.json();if(!upstream.ok||data.status==='error'||!data.close||!data.timestamp)throw new Error()}catch{return response({error:'시세 조회 실패. 기존 가격과 수동 모드는 유지됩니다'},502)}
      await e.DB.prepare('INSERT INTO stock_price_cache VALUES (?,?,?,?,?,?) ON CONFLICT(stock_id) DO UPDATE SET price=excluded.price,provided_at=excluded.provided_at,updated_at=excluded.updated_at,source=excluded.source,delay_note=excluded.delay_note').bind(sid,number(String(data.close),true),new Date(Number(data.timestamp)*1000).toISOString(),now(),'Twelve Data','지연 가능 / 거래소·계약별 상이').run();return response({ok:true});
    }
  }
  return response({error:'요청 경로가 없습니다'},404);
}
export default {scheduled(_controller:ScheduledController,e:Env,ctx:ExecutionContext){ctx.waitUntil(exchangeRates(e.DB).then(result=>{if(result.USD.refreshFailed||result.JPY.refreshFailed)console.error('Daily USD/KRW refresh failed; cached rate retained')}));},async fetch(r:Request,e:Env){let res:Response;try{res=await route(r,e)}catch(err){const message=err instanceof Error?err.message:'';res=response({error:message.includes('CONCURRENT_WRITE')?'다른 요청이 먼저 저장되었습니다. 새로고침 후 다시 시도하세요':message.includes('계정은 최대')?'가입 인원이 가득 찼습니다. 관리자에게 문의해 주세요':message.includes('UNIQUE')?'이미 등록된 정보입니다':message.includes('D1')?'데이터 저장 오류가 발생했습니다':message||'처리 중 오류가 발생했습니다'},400)}
  const headers=new Headers(res.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");if(['/sw.js','/manifest.webmanifest'].includes(new URL(r.url).pathname))headers.set('Cache-Control','no-cache');if(new URL(r.url).protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');return new Response(res.body,{status:res.status,headers});}};
