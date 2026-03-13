/**
 * PWA — Registro do Service Worker e lógica de instalação
 */

(function () {
    'use strict';

    let deferredPrompt = null;

    // ===== Registro do Service Worker =====
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registrado:', registration.scope);

                    // Verifica atualizações periodicamente
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('[PWA] Nova versão disponível. Recarregue a página.');
                            }
                        });
                    });
                })
                .catch((err) => {
                    console.warn('[PWA] Falha ao registrar Service Worker:', err);
                });
        });
    }

    // ===== Lógica de Instalação =====
    const banner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');

    // Captura o evento beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Verifica se o usuário já descartou o banner nesta sessão
        if (sessionStorage.getItem('pwa-install-dismissed')) return;

        // Mostra o banner de instalação
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.add('pwa-banner-show');
        }
    });

    // Botão Instalar
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] Resultado da instalação:', outcome);

            deferredPrompt = null;
            if (banner) {
                banner.style.display = 'none';
            }
        });
    }

    // Botão Fechar
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            if (banner) {
                banner.style.display = 'none';
            }
            sessionStorage.setItem('pwa-install-dismissed', '1');
        });
    }

    // Detecta quando o app é instalado
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App instalado com sucesso!');
        deferredPrompt = null;
        if (banner) {
            banner.style.display = 'none';
        }
    });

})();
