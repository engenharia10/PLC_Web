/**
 * PWA — Registro do Service Worker com auto-update
 */
(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('[PWA] SW registrado:', registration.scope);

                // Se há um novo SW esperando, ativa imediatamente e recarrega
                // Garante que Android não use cache desatualizado
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Novo SW instalado — recarrega para aplicar
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            navigator.serviceWorker.addEventListener('controllerchange', () => {
                                window.location.reload();
                            }, { once: true });
                        }
                    });
                });
            })
            .catch((err) => {
                console.warn('[PWA] Falha ao registrar SW:', err);
            });
    });
})();
