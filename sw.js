/* Saha Kariyer — service worker.
   HTML (index.html) için "network-first": her zaman en güncel sürümü
   almaya çalışır, ağ yoksa cache'e düşer. Diğer statik dosyalar
   (manifest, ikonlar) için "cache-first + arka planda güncelle".
   Reklam/analitik ağ isteklerine hiç dokunulmaz, hep ağdan gider.

   ÖNEMLİ — GÜNCELLEME NASIL ÇALIŞIR:
   Tarayıcı yeni bir sürüm var mı diye bakarken sw.js dosyasının
   byte'larını eski kayıtlı sw.js ile karşılaştırır. Bu dosyanın
   içeriği hiç değişmezse (sadece index.html değişmiş olsa bile)
   tarayıcı yeni bir service worker kurulumu (install) TETİKLEMEZ ve
   kullanıcı güncellemeyi asla görmez. Bu yüzden her deploy'da
   SW_VERSION değerini artırın (v1 -> v2 -> v3 ...). Sadece SW_VERSION
   satırını değiştirmek bile dosyanın byte'larını değiştirdiği için
   yeterlidir. */
const SW_VERSION = 'v2';                 // <-- HER YAYINDA (DEPLOY) ARTIRIN
const CACHE = 'saha-kariyer-' + SW_VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE))
    // NOT: skipWaiting() burada bilerek ÇAĞRILMIYOR. Yeni SW kurulunca
    // "waiting" (bekliyor) durumunda kalır; sayfa kullanıcıya "Güncelle"
    // butonunu gösterir, kullanıcı tıklayınca sayfa SKIP_WAITING mesajı
    // gönderir ve o zaman yeni SW devreye girer. Böylece oyun ortasında
    // kullanıcı fark etmeden sürüm değişip veri/durum karışmaz.
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sayfa "artık devral" dediğinde (kullanıcı Güncelle'ye bastığında) çalışır.
self.addEventListener('message', e => {
  const d = e.data;
  if(d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // sadece kendi origin'imizdeki GET isteklerini önbellekle; reklam/3. taraf istekleri ağdan gitsin
  if(req.method !== 'GET' || url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if(isHTML){
    // NETWORK-FIRST: index.html için önce ağdan taze sürümü almayı dene.
    // Ağ yoksa (çevrimdışı) cache'teki son bilinen sürüme düş.
    e.respondWith(
      fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Diğer statik dosyalar (manifest, ikonlar): cache-first + arka planda güncelle
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
