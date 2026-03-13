/**
 * Toolbar — Barra de ferramentas e menu principal
 * Baseado em toolbar.py e menu.py (create_main_menu)
 */

class Toolbar {
    constructor(app) {
        this.app = app;
        this._buildMenuBar();
        this._buildToolbar();
        this._buildComponentPalette();
    }

    // ===== Menu Bar (do menu.py create_main_menu) =====
    _buildMenuBar() {
        const menubar = document.getElementById('menubar');
        const menus = [
            {
                label: '📁 Arquivo', items: [
                    { label: '📄 Novo', shortcut: 'Ctrl+N', action: () => this.app.newProject() },
                    { label: '📂 Abrir', shortcut: 'Ctrl+O', action: () => this.app.openProject() },
                    { label: '💾 Salvar', shortcut: 'Ctrl+S', action: () => this.app.saveProject() },
                    { label: '💾 Salvar Como...', action: () => this.app.saveProjectAs() },
                    { type: 'separator' },
                    { label: '📤 Exportar JSON', action: () => this.app.exportJSON() },
                    { label: '📥 Importar JSON', action: () => this.app.importJSON() },
                    { type: 'separator' },
                    { label: '💿 Salvar BIN', action: () => this.app.saveBin() },
                    { label: '📂 Enviar BIN para PLC', action: () => this.app.sendBinToPlc() },
                ]
            },
            {
                label: '✏️ Editar', items: [
                    { label: '↶ Desfazer', shortcut: 'Ctrl+Z', action: () => {} },
                    { label: '↷ Refazer', shortcut: 'Ctrl+Y', action: () => {} },
                    { type: 'separator' },
                    { label: '↧ Adicionar Rung', shortcut: 'Ctrl+R', action: () => this.app.addRung() },
                    { type: 'separator' },
                    { label: '🗑️ Deletar', shortcut: 'Del', action: () => this.app.deleteSelected() },
                ]
            },
            {
                label: '⚙️ Configurações', items: [
                    { label: '🔲 Grade', action: () => {} },
                ]
            },
            {
                label: '🎨 Tema', items: [
                    { label: '☀️ Modo Claro', action: () => this.app.setTheme('light') },
                    { label: '🌙 Modo Escuro', action: () => this.app.setTheme('dark') },
                    { label: '🌑 Modo Ultra Escuro', action: () => this.app.setTheme('ultra_dark') },
                    { label: '🔵 Modo Super Azul', action: () => this.app.setTheme('super_blue') },
                ]
            },
            {
                label: '🖥️ Modelo', items: [
                    { label: '⚡ ECU Max', action: () => this.app.setModel('PLC-Max.') },
                    { label: '🔧 ECU TRM', action: () => this.app.setModel('PLC-Trm') },
                ]
            },
            {
                label: '🔌 PLC', items: [
                    { label: '▶️ Iniciar/Parar Simulador', shortcut: 'F5', action: () => this.app.toggleSimulation() },
                ]
            },
            {
                label: '📡 Comunicação', items: [
                    { label: '🔌 Conectar PLC (Serial)', action: () => this.app.showCommModal() },
                    { label: '📶 Conectar PLC (BLE)', action: () => this.app.showCommModal() },
                    { type: 'separator' },
                    { label: '⬆️ Transferir Programa', action: () => this.app.uploadToPLC() },
                    { type: 'separator' },
                    { label: '🖥️ Monitor Serial', action: () => this.app.showMonitor() },
                ]
            },
            {
                label: '❓ Ajuda', items: [
                    { label: '📖 Documentação', action: () => {} },
                    { label: '⌨️ Atalhos de Teclado', action: () => this._showShortcuts() },
                    { label: 'ℹ️ Sobre', action: () => this._showAbout() },
                ]
            },
        ];

        for (const menu of menus) {
            const menuItem = document.createElement('div');
            menuItem.className = 'menu-item';

            const trigger = document.createElement('button');
            trigger.className = 'menu-trigger';
            trigger.textContent = menu.label;
            menuItem.appendChild(trigger);

            const dropdown = document.createElement('div');
            dropdown.className = 'menu-dropdown';
            for (const item of menu.items) {
                if (item.type === 'separator') {
                    const sep = document.createElement('div');
                    sep.className = 'menu-separator';
                    dropdown.appendChild(sep);
                } else {
                    const btn = document.createElement('button');
                    btn.className = 'menu-dropdown-item';
                    btn.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
                    btn.onclick = () => {
                        item.action();
                        this._closeAllMenus();
                    };
                    dropdown.appendChild(btn);
                }
            }
            menuItem.appendChild(dropdown);

            trigger.onclick = (e) => {
                e.stopPropagation();
                const isOpen = menuItem.classList.contains('open');
                this._closeAllMenus();
                if (!isOpen) {
                    menuItem.classList.add('open');
                    
                    // Como a menubar agora tem overflow-x, dropdowns com position absolute serão cortados!
                    // Fixamos o dropdown e usamos Javascript para achar a coordenada XYZ na tela
                    const rect = trigger.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.top = rect.bottom + 'px';
                    dropdown.style.left = rect.left + 'px';
                }
            };

            menubar.appendChild(menuItem);
        }

        // Fechar ao clicar fora
        document.addEventListener('click', () => this._closeAllMenus());
    }

    _closeAllMenus() {
        document.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
    }

    // ===== Toolbar icons (do toolbar.py) =====
    _buildToolbar() {
        const toolbar = document.getElementById('toolbar');
        const buttons = [
            { icon: '📄', tooltip: 'Novo (Ctrl+N)', action: () => this.app.newProject() },
            { icon: '📂', tooltip: 'Abrir (Ctrl+O)', action: () => this.app.openProject() },
            { icon: '💾', tooltip: 'Salvar (Ctrl+S)', action: () => this.app.saveProject() },
            { type: 'separator' },
            { icon: '⚙️', tooltip: 'Conectores', action: () => {} },
            { type: 'spacer' },
            { icon: '🔌', tooltip: 'Conectar ao PLC', action: () => this.app.showCommModal() },
            { icon: '⬆️', tooltip: 'Transferir para PLC', action: () => this.app.uploadToPLC() },
            { icon: '💿', tooltip: 'Gravar Dados PLC', action: () => this.app.saveToFlash() },
            { type: 'separator' },
            { icon: '▶️', tooltip: 'Iniciar Simulador (F5)', action: () => this.app.toggleSimulation(), id: 'sim-btn' },
        ];

        for (const btn of buttons) {
            if (btn.type === 'separator') {
                const sep = document.createElement('div');
                sep.className = 'toolbar-separator';
                toolbar.appendChild(sep);
            } else if (btn.type === 'spacer') {
                const sp = document.createElement('div');
                sp.className = 'toolbar-spacer';
                toolbar.appendChild(sp);
            } else {
                const b = document.createElement('button');
                b.className = 'toolbar-btn';
                b.textContent = btn.icon;
                b.title = btn.tooltip;
                if (btn.id) b.id = btn.id;
                b.onclick = btn.action;
                toolbar.appendChild(b);
            }
        }
    }

    // ===== Component Palette (do create_ladder_tab) =====
    _buildComponentPalette() {
        const palette = document.getElementById('component-palette');

        // Botão de Rung
        const rungBtn = document.createElement('button');
        rungBtn.className = 'component-btn';
        rungBtn.innerHTML = '<span class="comp-icon">│───│</span><span class="comp-label">Rung</span>';
        rungBtn.onclick = () => this.app.addRung();
        palette.appendChild(rungBtn);

        // Componentes
        for (const compType of COMPONENT_TOOLBAR_ORDER) {
            const data = COMPONENT_DATA[compType];
            const shortLabel = SHORT_LABELS[data.label] || data.label;

            const btn = document.createElement('button');
            btn.className = 'component-btn';
            
            // Apenas habilita Drag HTML5 (Desktop). No Mobile, draggable bloqueia scroll e clicks nativos
            if (!('ontouchstart' in window) || navigator.maxTouchPoints === 0) {
                btn.setAttribute('draggable', 'true');
            }
            
            btn.dataset.compType = compType;
            btn.innerHTML = `<span class="comp-icon">${data.icon}</span><span class="comp-label">${shortLabel}</span>`;

            // Drag and drop HTML5 (Apenas para Desktop)
            btn.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', compType);
                e.dataTransfer.effectAllowed = 'copy';
                btn.classList.add('dragging');
            });
            btn.addEventListener('dragend', () => {
                btn.classList.remove('dragging');
            });

            // Tap/Click to Add (Para Mobile e usabilidade rápida)
            btn.addEventListener('click', () => {
                const isBranch = (compType === 'branch');
                const app = this.app;
                
                // Base target relative to canvas margins
                let targetX = app.ladderCanvas.LEFT_MARGIN + 15;
                let targetY = 80;
                if (app.selectedElement && !isBranch) {
                    // Adiciona logo após o componente selecionado
                    targetX = app.selectedElement.x + 80;
                    targetY = app.selectedElement.y;
                } else if (app.rungs.length > 0) {
                    // Adiciona na última rung, em um espaço livre ou no começo
                    const lastRung = app.rungs[app.rungs.length - 1];
                    targetY = lastRung.y;
                    
                    // Acha elemento mais a direita nesta rung
                    const rEls = app.elements.filter(e => Math.abs((e.rung_y || e.y) - targetY) < 10);
                    if (rEls.length > 0) {
                         const maxR = Math.max(...rEls.map(e => e.x + (e.width || 0)));
                         targetX = maxR + 80;
                    }
                }

                // Ajusta caso passe da margem direita (tela inteira no mobile)
                const cv = document.getElementById('ladder-canvas');
                let cssWidth = 800;
                if (cv) cssWidth = cv.getBoundingClientRect().width;
                if (targetX > cssWidth - 60) targetX = 100; // Reseta x

                // Usa as coordenadas de tela simuladas pra reusar lógica do handleDrop
                const cvRect = cv.getBoundingClientRect();
                const simClientX = cvRect.left + targetX;
                const simClientY = cvRect.top + targetY - app.ladderCanvas.scrollY;
                
                app.ladderCanvas.handleDrop(compType, simClientX, simClientY);
            });

            palette.appendChild(btn);
        }
    }

    _showShortcuts() {
        alert(
            '⌨️ Atalhos de Teclado\n\n' +
            'Ctrl+N — Novo\n' +
            'Ctrl+O — Abrir\n' +
            'Ctrl+S — Salvar\n' +
            'Ctrl+R — Adicionar Rung\n' +
            'Del — Deletar\n' +
            'F5 — Simulador\n'
        );
    }

    _showAbout() {
        alert('PLC Ladder Editor — Web Edition\n\n© Alfatronic\nBaseado no Editor Ladder Python/PyQt5');
    }
}

window.Toolbar = Toolbar;
