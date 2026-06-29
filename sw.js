const CACHE = 'khonsu-ops-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/main.js',
  './js/state.js',
  './js/data.js',
  './js/utils.js',
  './js/sync.js',
  './js/auth.js',
  './js/nav.js',
  './js/toast.js',
  './js/products.js',
  './js/form.js',
  './js/addon.js',
  './js/customer.js',
  './js/sales.js',
  './js/report.js',
  './js/inventory.js',
  './js/purchase-orders.js',
  './js/master-list.js',
  './js/settings.js',
  './js/setup.js',
  './js/units.js',
  './js/scanner.js',
  './js/dashboard.js',
  './js/reports.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Let Google Fonts go through the network; cache everything else
  if (e.request.url.includes('fonts.googleapis.com') || e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; })
        )
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
