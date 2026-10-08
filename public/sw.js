const CACHE='stock-journal-static-v8';
const STATIC=['/icons/brand-mark.png','/icons/favicon-32.png','/offline.html','/style.css','/vendor/bootstrap.min.css','/vendor/decimal.mjs','/vendor/qrcode.mjs','/app.js','/pwa.js','/access-url.mjs','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('stock-journal-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache sessions, API responses, investment records or writes.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;
  }
  if(!STATIC.includes(url.pathname))return;
  event.respondWith((async()=>{try{const result=await fetch(request);if(result.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname,result.clone())}return result}catch{const cached=await caches.match(url.pathname);return cached||new Response('오프라인',{status:503})}})());
});
