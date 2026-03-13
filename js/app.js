/**
 * App — Ponto de entrada e orquestração da aplicação PLC Web
 */

class PLCApp {
    constructor() {
        this.elements = [];
        this.rungs = [];
        this.branches = [];
        this.selectedElement = null;
        this.simulationRunning = false;
        this.plcType = 'PLC-Max.';

        // Theme
        this.theme = new ThemeManager('dark');
        this.theme.applyCSS();

        // Toolbar + Menu
        this.toolbar = new Toolbar(this);

        // Canvas
        const canvasEl = document.getElementById('ladder-canvas');
        this.ladderCanvas = new LadderCanvas(canvasEl, this);

        // Properties Panel
        const propsContainer = document.getElementById('props-content');
        this.propertiesPanel = new PropertiesPanel(propsContainer, this);
        this.updateProperties();

        // Drop zone
        this._setupCanvasDrop();

        // Keyboard
        this._setupKeyboard();

        // Communication
        this.serialComm = typeof SerialComm !== 'undefined' ? new SerialComm() : null;
        this.bleComm = typeof BLEComm !== 'undefined' ? new BLEComm() : null;
        this.plcProtocol = typeof PLCProtocol !== 'undefined' ? new PLCProtocol() : null;
        this.serializer = typeof PLCSerializer !== 'undefined' ? new PLCSerializer() : null;
        this.activeComm = null; // Can be 'serial' or 'ble'
        this._setupCommunication();

        // Initial rung
        this.addRung();
    }

    // ===== Rungs =====
    addRung() {
        const RUNG_SPACING = 80;
        let y;
        if (this.rungs.length === 0) {
            y = 80;
        } else {
            const lastRung = this.rungs[this.rungs.length - 1];

            // Igual ao Python: spacing = max_branch_height + rung_spacing
            const branchesOnLast = this.elements.filter(
                e => e.type === 'branch' && Math.abs((e.rung_y || e.y) - lastRung.y) < 10
            );
            let spacing = RUNG_SPACING;
            if (branchesOnLast.length > 0) {
                const maxBranchHeight = Math.max(
                    ...branchesOnLast.map(b => Math.abs((b.branch_y || (b.y + 80)) - (b.rung_y || b.y)))
                );
                spacing = maxBranchHeight + RUNG_SPACING;
            }

            y = lastRung.y + spacing;
        }
        const index = this.rungs.length;
        this.rungs.push({ y, index });
        this.ladderCanvas.render();
    }

    // ===== Theme =====
    setTheme(name) {
        this.theme.setTheme(name);
        this.ladderCanvas.render();
        this.updateProperties();
    }

    // ===== Model =====
    setModel(model) {
        this.plcType = model;
    }

    // ===== Properties =====
    updateProperties() {
        // Esconde/mostra a sidebar de propriedades (overlay)
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.display = this.selectedElement ? 'flex' : 'none';
        }

        try {
            this.propertiesPanel.update(this.selectedElement);
        } catch (e) {
            console.error('Erro ao atualizar propriedades:', e);
        }
    }

    // ===== Start / Stop PLC =====
    toggleSimulation() {
        this.simulationRunning = !this.simulationRunning;
        const btn = document.getElementById('sim-btn');
        if (btn) {
            btn.textContent = this.simulationRunning ? '⏹️' : '▶️';
            btn.title = this.simulationRunning ? 'STOP PLC (F5)' : 'START PLC (F5)';
        }
        if (this.activeComm) {
            if (this.simulationRunning) {
                this.sendCommCommand(PLCProtocol.createStartPacket(), "START");
            } else {
                this.sendCommCommand(PLCProtocol.createStopPacket(), "STOP");
            }
        }
    }

    // ===== Delete =====
    deleteSelected() {
        if (!this.selectedElement) return;
        const idx = this.elements.indexOf(this.selectedElement);
        if (idx >= 0) {
            this.elements.splice(idx, 1);
            this.selectedElement = null;
            this.updateProperties();
            this.ladderCanvas.render();
        }
    }

    // ===== Project management =====
    newProject() {
        if (this.elements.length > 0) {
            if (!confirm('Há alterações não salvas. Deseja continuar?')) return;
        }
        this.elements = [];
        this.rungs = [];
        this.branches = [];
        this.selectedElement = null;
        this.addRung();
        this.updateProperties();
    }

    saveProject() {
        const data = this._serializeProject();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'projeto.plc';
        a.click();
        URL.revokeObjectURL(url);
    }

    saveProjectAs() {
        this.saveProject();
    }

    openProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.plc,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    this._loadProject(data);
                } catch (err) {
                    alert('Erro ao ler arquivo: ' + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    exportJSON() {
        this.saveProject();
    }

    importJSON() {
        this.openProject();
    }

    _serializeProject() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

        return {
            "Versão:": "Versão 1.0",
            "Gerado:": "Editor Ladder Alfatronic Web",
            "Data:": dateStr,
            plc_type: this.plcType,
            routines: [{
                rungs: this.rungs.map(r => {
                    // Branches desta rung
                    const branchesOnRung = this.elements.filter(
                        e => e.type === 'branch' && Math.abs((e.rung_y || e.y) - r.y) < 5
                    );
                    // Y das linhas de branch (onde ficam os filhos)
                    const branchChildYs = branchesOnRung.map(b => b.branch_y || (b.y + 80));

                    const elements = this.elements.filter(e => {
                        if (e.type === 'branch') return Math.abs((e.rung_y || e.y) - r.y) < 5;
                        if (Math.abs(e.y - r.y) < 5) return true;
                        return branchChildYs.some(bY => Math.abs(e.y - bY) < 5);
                    }).map(e => {
                        const s = { ...e };
                        // Formato Python: tipo UPPERCASE
                        s.type = e.type.toUpperCase();
                        if (s.parent == null) s.parent = null;
                        if (!s.element_mode) s.element_mode = 'new';
                        if (!s.comment) s.comment = '';
                        if (!s.tag) s.tag = s.name || '';
                        // Marca parent para filhos de branch
                        if (e.type !== 'branch') {
                            for (const b of branchesOnRung) {
                                const bY = b.branch_y || (b.y + 80);
                                if (Math.abs(e.y - bY) < 5) { s.parent = b.id; break; }
                            }
                        }
                        return s;
                    });

                    return {
                        rungId: r.index,
                        y: r.y,
                        description: `Rung ${r.index}`,
                        logic: { type: 'branch', elements }
                    };
                })
            }]
        };
    }

    _loadProject(data) {
        this.elements = [];
        this.rungs = [];
        this.branches = [];
        this.selectedElement = null;

        // Carrega plc_type se presente
        if (data.plc_type) this.plcType = data.plc_type;

        const seenIds = new Set();

        if (data.routines && data.routines.length > 0) {
            const routine = data.routines[0];
            for (const rung of (routine.rungs || [])) {
                this.rungs.push({ y: rung.y, index: rung.rungId });
                for (const el of (rung.logic?.elements || [])) {
                    // Normaliza tipo para lowercase (Python usa UPPERCASE)
                    const normalized = { ...el, type: (el.type || '').toLowerCase() };
                    // Branch: garante rung_y e branch_y
                    if (normalized.type === 'branch') {
                        normalized.rung_y = normalized.rung_y != null ? normalized.rung_y : rung.y;
                        normalized.branch_y = normalized.branch_y != null ? normalized.branch_y : (rung.y + 80);
                    }
                    // Evita duplicatas (mesmo id)
                    if (!seenIds.has(normalized.id)) {
                        seenIds.add(normalized.id);
                        this.elements.push(normalized);
                    }
                }
            }
        } else if (data.rungs) {
            // Formato legado flat
            for (const r of data.rungs) {
                this.rungs.push({ y: r.y, index: r.index });
            }
            for (const el of (data.elements || [])) {
                this.elements.push({ ...el, type: (el.type || '').toLowerCase() });
            }
        }

        if (this.rungs.length === 0) this.addRung();
        this.updateProperties();
        this.ladderCanvas.render();
    }

    // ===== Canvas Drag/Drop =====
    _setupCanvasDrop() {
        const canvas = document.getElementById('ladder-canvas');
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const compType = e.dataTransfer.getData('text/plain');
            if (compType && COMPONENT_DATA[compType]) {
                this.ladderCanvas.handleDrop(compType, e.clientX, e.clientY);
            }
        });
    }

    // ===== Keyboard =====
    _setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') {
                this.deleteSelected();
            } else if (e.key === 'F5') {
                e.preventDefault();
                this.toggleSimulation();
            } else if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.newProject();
            } else if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                this.openProject();
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveProject();
            } else if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.addRung();
            }
        });
    }

    // ===== Communication & Modal =====
    _setupCommunication() {
        // Modal elements
        const modal = document.getElementById('comm-modal');
        const closeBtn = document.getElementById('comm-close-btn');
        const tabSerial = document.getElementById('tab-serial');
        const tabBle = document.getElementById('tab-ble');
        const panelSerial = document.getElementById('panel-serial');
        const panelBle = document.getElementById('panel-ble');

        // Close modal
        closeBtn.onclick = () => this.hideCommModal();
        window.onclick = (e) => { if (e.target === modal) this.hideCommModal(); };

        // Tabs
        tabSerial.onclick = () => {
            tabSerial.classList.add('active');
            tabBle.classList.remove('active');
            panelSerial.style.display = 'block';
            panelBle.style.display = 'none';
        };
        tabBle.onclick = () => {
            tabBle.classList.add('active');
            tabSerial.classList.remove('active');
            panelBle.style.display = 'block';
            panelSerial.style.display = 'none';
        };

        // Monitor: fechar
        document.getElementById('monitor-close-btn').onclick = () => {
            document.getElementById('monitor-window').classList.add('hidden');
        };

        // Monitor: limpar
        document.getElementById('monitor-clear-btn').onclick = () => {
            document.getElementById('monitor-terminal').value = '';
        };

        // Monitor: enviar
        document.getElementById('monitor-send-btn').onclick = () => this._doMonitorSend();
        document.getElementById('monitor-send-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._doMonitorSend();
        });

        // Monitor: arrastar pela barra de título
        this._setupMonitorDrag();


        // ======= Serial Setup =======
        if (this.serialComm) {
            const btnConnect = document.getElementById('serial-connect-btn');
            const btnDisconnect = document.getElementById('serial-disconnect-btn');
            const baudSelect = document.getElementById('serial-baudrate');

            this.serialComm.onConnect = () => {
                this.activeComm = 'serial';
                btnConnect.disabled = true;
                btnDisconnect.disabled = false;
                this.updateCommStatusIndicator();
                this.logComm("Conectado à porta Serial.");
            };
            this.serialComm.onDisconnect = () => {
                this.activeComm = null;
                btnConnect.disabled = false;
                btnDisconnect.disabled = true;
                this.updateCommStatusIndicator();
                this.logComm("Serial Desconectado.");
            };
            this.serialComm.onDataReceived = (data) => {
                this.handleCommRX(data);
            };
            this.serialComm.onError = (e) => this.logComm(`Erro Serial: ${e.message}`);

            btnConnect.onclick = async () => {
                try {
                    await this.serialComm.connect(parseInt(baudSelect.value));
                } catch (e) {
                    this.logComm(`Falha ao conectar Serial: ${e.message}`);
                }
            };
            btnDisconnect.onclick = () => this.serialComm.disconnect();
        } else {
            document.getElementById('serial-connect-btn').disabled = true;
            this.logComm('Aviso: Web Serial não suportado no seu navegador.');
        }

        // ======= BLE Setup =======
        if (this.bleComm) {
            const btnConnectBle = document.getElementById('ble-connect-btn');
            const btnDisconnectBle = document.getElementById('ble-disconnect-btn');

            this.bleComm.onConnect = () => {
                this.activeComm = 'ble';
                btnConnectBle.disabled = true;
                btnDisconnectBle.disabled = false;
                this.updateCommStatusIndicator();
                this.logComm("Conectado ao dispositivo BLE.");
            };
            this.bleComm.onDisconnect = () => {
                this.activeComm = null;
                btnConnectBle.disabled = false;
                btnDisconnectBle.disabled = true;
                this.updateCommStatusIndicator();
                this.logComm("BLE Desconectado.");
            };
            this.bleComm.onDataReceived = (data) => {
                this.handleCommRX(data);
            };

            btnConnectBle.onclick = async () => {
                try {
                    this.logComm("Iniciando Scan BLE...");
                    await this.bleComm.connect();
                } catch (e) {
                    this.logComm(`Falha BLE: ${e.message}`);
                }
            };
            btnDisconnectBle.onclick = () => this.bleComm.disconnect();
        } else {
            document.getElementById('ble-connect-btn').disabled = true;
            this.logComm('Aviso: Web Bluetooth não suportado no seu navegador.');
        }
    }

    showCommModal() {
        document.getElementById('comm-modal').style.display = 'flex';
    }

    hideCommModal() {
        document.getElementById('comm-modal').style.display = 'none';
    }

    logComm(msg) {
        const trm = document.getElementById('monitor-terminal');
        if (!trm) return;
        const now = new Date().toLocaleTimeString();
        trm.value += `[${now}] ${msg}\n`;
        trm.scrollTop = trm.scrollHeight;
    }

    showMonitor() {
        document.getElementById('monitor-window').classList.remove('hidden');
    }

    _doMonitorSend() {
        const input = document.getElementById('monitor-send-input');
        const data = input.value;
        if (!data || !this.activeComm) return;
        if (this.activeComm === 'serial' && this.serialComm.isConnected) {
            this.serialComm.sendText(data)
                .then(() => { this.logComm(`> [Serial TX]: ${data}`); input.value = ''; })
                .catch(e => this.logComm(`ERRO Serial TX: ${e.message}`));
        } else if (this.activeComm === 'ble' && this.bleComm.isConnected) {
            this.bleComm.sendText(data)
                .then(() => { this.logComm(`> [BLE TX]: ${data}`); input.value = ''; })
                .catch(e => this.logComm(`ERRO BLE TX: ${e.message}`));
        }
    }

    _setupMonitorDrag() {
        const win = document.getElementById('monitor-window');
        const bar = document.getElementById('monitor-titlebar');
        let dragging = false, ox = 0, oy = 0;

        bar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            dragging = true;
            const rect = win.getBoundingClientRect();
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            win.style.right = 'auto';
            win.style.bottom = 'auto';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            win.style.left = (e.clientX - ox) + 'px';
            win.style.top  = (e.clientY - oy) + 'px';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    updateCommStatusIndicator() {
        const ind = document.getElementById('comm-status-indicator');
        if (this.activeComm === 'serial') {
            ind.style.color = '#3b82f6';
            ind.innerHTML = '🔌 Serial Conectado';
        } else if (this.activeComm === 'ble') {
            ind.style.color = '#10b981';
            ind.innerHTML = '📶 BLE Conectado';
        } else {
            ind.style.color = '#64748b';
            ind.innerHTML = '🔌 Desconectado';
        }
    }

    handleCommRX(dataBytes) {
        // Exibe binário / texto de forma simples no monitor
        // Em um formato real, a decodificação dos pacotes de telemetria
        // [0xBB, 0x66, SIZE_L, SIZE_H, ...] aconteceria aqui.
        const header = dataBytes.length >= 2 ? (dataBytes[0] === PLCProtocol.STATUS_MAGIC1 && dataBytes[1] === PLCProtocol.STATUS_MAGIC2) : false;
        
        if (header) {
            this.logComm(`[RX Status Packet]: ${dataBytes.length} bytes`);
        } else {
            const decoder = new TextDecoder();
            const text = decoder.decode(dataBytes);
            if (text.trim() || dataBytes.length > 0) {
                // Remove caracteres nao imprimiveis
                const cleanText = text.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '');
                if (cleanText) {
                    this.logComm(`< [RX Text]: ${cleanText}`);
                } else {
                    this.logComm(`< [RX Hex]: ${PLCProtocol.bytesToHex(dataBytes)}`);
                }
            }
        }
    }

    async sendCommCommand(packetData, label) {
        if (!this.activeComm) {
            alert("Conecte-se ao PLC (Serial ou BLE) primeiro!");
            return;
        }

        this.logComm(`> Enviando pacote ${label} (${packetData.length} bytes)...`);
        
        try {
            if (this.activeComm === 'serial' && this.serialComm.isConnected) {
                await this.serialComm.send(packetData);
            } else if (this.activeComm === 'ble' && this.bleComm.isConnected) {
                await this.bleComm.send(packetData);
            }
            this.logComm(`[OK] ${label} enviado com sucesso.`);
        } catch (e) {
            this.logComm(`[ERRO] Falha ao enviar ${label}: ${e.message}`);
        }
    }

    async uploadToPLC() {
        if (!this.activeComm) {
            alert("Conecte-se ao PLC (Serial ou BLE) primeiro!");
            return;
        }
        if (!this.serializer || !this.plcProtocol) {
            alert("Erro: Módulos de serialização ou protocolo não carregados.");
            return;
        }

        try {
            this.logComm(`> Preparando UPLOAD: Serializando Ladder...`);
            this.logComm(`> [DEBUG] Elements: ${this.elements.length} | Rungs: ${this.rungs.length}`);
            let payloadData = this.serializer.serialize(this.elements, this.rungs);

            let packet = PLCProtocol.createLoadProgramPacket(payloadData);
            this.logComm(`> Pacote montado: ${packet.length} bytes.`);

            // Dump completo em linhas de 16 bytes (offset | hex | ascii)
            {
                const COLS = 16;
                let lines = [`> [TX Hex] ${packet.length} bytes:`];
                for (let off = 0; off < packet.length; off += COLS) {
                    let chunk = packet.slice(off, off + COLS);
                    let hex = Array.from(chunk).map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
                    let asc = Array.from(chunk).map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.').join('');
                    let addr = off.toString(16).padStart(4,'0').toUpperCase();
                    lines.push(`  ${addr}: ${hex.padEnd(COLS*3-1,' ')}  ${asc}`);
                }
                this.logComm(lines.join('\n'));
            }

            await this.sendCommCommand(packet, "UPLOAD");

            // Salva referência do programa compilado e timestamp (usado por saveToFlash)
            this.lastCompiledProgram = payloadData;
            this.lastProgramUploadTs = performance.now();

            this.logComm(`> Transferência Concluída.`);
            this.logComm(`> Pressione ▶️ (F5) para iniciar o PLC.`);
            alert("Transferência Concluída!\n\nPressione ▶️ (F5) para iniciar o PLC.");
        } catch (e) {
            this.logComm(`[ERRO UPLOAD] Falha ao serializar projeto: ${e.message}`);
            alert(`Erro na compilação do Ladder:\n${e.message}`);
        }
    }

    async saveToFlash() {
        // Bloqueia durante simulação offline (sem conexão real)
        if (this.simulationRunning && !this.activeComm) {
            alert("Não é possível gravar na Flash durante a simulação.\n\nPare a simulação e tente novamente.");
            return;
        }

        if (!this.activeComm) {
            alert("Conecte ao PLC primeiro (Serial ou BLE).");
            return;
        }

        // Verifica se há programa compilado (igual ao Python: last_compiled_program)
        if (!this.lastCompiledProgram || this.lastCompiledProgram.length === 0) {
            alert("Nenhum programa compilado disponível.\n\nFaça o download (Transferir) do programa primeiro.");
            return;
        }

        // Aguarda 450ms após upload para evitar corrida (igual ao Python: min_wait_after_upload_s = 0.45)
        const MIN_WAIT_MS = 450;
        if (this.lastProgramUploadTs) {
            const elapsed = performance.now() - this.lastProgramUploadTs;
            if (elapsed < MIN_WAIT_MS) {
                const waitMs = Math.ceil(MIN_WAIT_MS - elapsed) + 20;
                this.logComm(`> Aguardando ${waitMs}ms para finalizar recepção no PLC...`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }
        }

        try {
            this.logComm(`> Enviando CMD_SAVE_TO_FLASH (0x10)...`);
            const packet = PLCProtocol.createCommandPacket(PLCProtocol.CMD_SAVE_TO_FLASH);
            await this.sendCommCommand(packet, "SAVE_TO_FLASH");
            this.logComm(`> Programa gravado na Flash W25Q64.`);
            alert(`Salvando programa na Flash W25Q64...\n\nTamanho: ${this.lastCompiledProgram.length} bytes\n\nAguarde a confirmação no monitor.`);
        } catch (e) {
            this.logComm(`[ERRO] Falha ao gravar na Flash: ${e.message}`);
            alert(`Erro ao salvar na Flash:\n${e.message}`);
        }
    }
}

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PLCApp();
});
