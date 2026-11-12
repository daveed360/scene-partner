// keeps the app, the cast pictures and the fonts on the phone, so rehearsal works without internet
const C = 'ap-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', './index.html', './icon.svg', './icon-180.png']))); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  // a message or a file shared from WhatsApp (Android share sheet): keep it, then open the app to pick it up
  if(r.method === 'POST' && new URL(r.url).pathname.endsWith('/share-target')){
    e.respondWith((async () => {
      try{
        const fd = await r.formData(), f = fd.get('file');
        const text = [fd.get('title'), fd.get('text'), fd.get('url')].filter(x => x && String(x).trim()).join('\n').trim();
        const c = await caches.open('ap-share');
        const hasFile = f && typeof f === 'object' && f.size > 0;
        if(hasFile) await c.put('./__share/file', new Response(f, {headers: {'Content-Type': f.type || 'application/octet-stream'}}));
        await c.put('./__share/meta', new Response(JSON.stringify({text, file: hasFile ? f.name : '', type: hasFile ? f.type : '', t: Date.now()}), {headers: {'Content-Type': 'application/json'}}));
      }catch(err){}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if(r.method !== 'GET') return;
  const u = new URL(r.url);
  if(u.origin === location.origin && (r.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('/'))){
    // the page: always fresh when online, saved copy when offline
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); return res; })
      .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
    return;
  }
  if(u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(u.host)){
    e.respondWith(caches.open(C).then(c => c.match(r).then(m => {
      const net = fetch(r).then(res => { if(res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => m);
      return m || net;
    })));
  }
});
