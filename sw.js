const CACHE_NAME = 'mareas-v13';
const ASSETS_TO_UPDATE = ['index.html', 'style.css', 'main.js'];
const ASSETS = [
    ...ASSETS_TO_UPDATE,
    'favicon.ico',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: limpiando caché antiguo');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    
    // Para los archivos principales del sistema, usamos Network-First para asegurar actualizaciones
    if (ASSETS_TO_UPDATE.some(asset => url.pathname.endsWith(asset))) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
    } else {
        // Para el resto (librerías externas), Cache-First
        e.respondWith(
            caches.match(e.request).then((res) => res || fetch(e.request))
        );
    }
});
