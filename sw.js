const CACHE_NAME = 'konok-v51';
const ASSETS = ['./', './index.html', './css/style.css', './js/db.js', './js/view.js', './js/controller.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));