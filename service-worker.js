const CACHE='ksr-l5-v1';
const FILES=['./','index.html','admin.html','style.css','storage.js','ksr-parser-l5.js','admin.js','student.js','manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
