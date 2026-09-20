/* Saha Kariyer — basit service worker.
   Sadece bu oyunun kendi dosyasını (index.html) önbelleğe alır; reklam/analitik
   ağ isteklerine dokunmaz (adsbygoogle, googlesyndication vb. hep ağdan gider). */
const CACHE = 'saha-kariyer-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // sadece kendi origin'imizdeki GET isteklerini önbellekle; reklam/3. taraf istekleri ağdan gitsin
  if(e.request.method !== 'GET' || url.origin !== self.location.origin){
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(()=> cached);
      return cached || network;
    })
  );
});
