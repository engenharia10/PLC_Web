/**
 * PWA — Registro do Service Worker
 */
(function () {
    'use strict';

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registrado:', registration.scope);
                })
                .catch((err) => {
                    console.warn('[PWA] Falha ao registrar Service Worker:', err);
                });
        });
    }
})();
