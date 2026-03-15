/**
 * Service Worker — PLC Ladder Editor PWA
 * Estratégia: Cache-First com fallback para rede
 */

const CACHE_NAME = 'plc-editor-v39';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/mqtt.min.js',
    './js/mqtt_comm.js',
    './js/plc_protocol.js',
    './js/serial_comm.js',
    './js/ble_comm.js',
    './js/plc_serializer.js',
    './js/themes.js',
    './js/components.js',
    './js/canvas.js',
    './js/properties.js',
    './js/toolbar.js',
    './js/app.js',
    './js/pwa.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './manifest.json'
];

// Install — pre-cache de todos os assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate — limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Removendo cache antigo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch — Cache-First: retorna do cache se disponível, senão busca na rede
self.addEventListener('fetch', (event) => {
    // Ignora requisições não-GET (ex: POST do BLE/Serial)
    if (event.request.method !== 'GET') return;

    // Ignora requisições para URLs externas (chrome-extension, etc)
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then((networkResponse) => {
                        // Clonar a resposta para poder guardar no cache
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(event.request, responseClone));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline fallback: para navegação, retorna index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('Offline', { status: 503, statusText: 'Offline' });
                    });
            })
    );
});
