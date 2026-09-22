/* Saha Kariyer — service worker.
   HTML (index.html) için "network-first": her zaman en güncel sürümü
   almaya çalışır, ağ yoksa cache'e düşer. Diğer statik dosyalar
   (manifest, ikonlar) için "cache-first + arka planda güncelle".
   Reklam/analitik ağ isteklerine hiç dokunulmaz, hep ağdan gider.

   GÜNCELLEME BANNER'I ARTIK BU DOSYAYA BAĞLI DEĞİL:
   index.html içindeki checkHtmlVersionUpdate() fonksiyonu, index.html'i
   düzenli aralıklarla ağdan (no-store) tekrar indirip içindeki
   APP_VERSION'ı okuyup çalışan sürümle karşılaştırıyor. Yani "Yeni sürüm
   var" banner'ının çıkması için SADECE index.html'deki APP_VERSION'ı
   artırmak yeterli — bu dosyaya (sw.js) dokunmanıza gerek yok.

   Bu dosyayı ne zaman değiştirmeniz gerekir: sadece CORE listesindeki
   statik dosyaları (manifest.json, ikonlar) da değiştirdiyseniz ve
   bunların eski cache'teki kopyalarının hemen atılıp yeniden indirilmesini
   istiyorsanız, aşağıdaki SW_VERSION'ı artırın (index.html'deki
   APP_VERSION ile aynı tutmak zorunlu değil, sadece pratik bir kural).
   index.html zaten "network-first" çekildiği için, sadece index.html'i
   değiştirdiğiniz normal deploy'larda bu dosyayı hiç değiştirmenize
   gerek yok. */
const SW_VERSION = 'v3.8';                // <-- sadece manifest/ikon gibi statik dosyalar değiştiyse artırın
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
    // cache:'no-store' -> tarayıcının kendi HTTP önbelleğini (Cache-Control
    // header'larını) tamamen atla; yoksa GitHub Pages'in cache süresi
    // dolmadan bu fetch() aslında ağa hiç gitmeyip tarayıcı disk
    // önbelleğinden eski index.html'i döndürebiliyordu — "sayfa yenilense
    // bile eski sürüm geliyor" sorununun asıl sebebi buydu.
    // Ağ yoksa (çevrimdışı) cache'teki son bilinen sürüme düş.
    e.respondWith(
      fetch(req, {cache: 'no-store'}).then(res => {
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
