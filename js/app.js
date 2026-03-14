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
        this.mqttComm = typeof MQTTComm !== 'undefined' ? new MQTTComm() : null;
        this.plcProtocol = typeof PLCProtocol !== 'undefined' ? new PLCProtocol() : null;
        this.serializer = typeof PLCSerializer !== 'undefined' ? new PLCSerializer() : null;
        this.activeComm = null; // Can be 'serial', 'ble' or 'mqtt'
        this._setupCommunication();
        this._setupMQTT();

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
        // Reseta view ao abrir projeto
        this.ladderCanvas.scrollX = 0;
        this.ladderCanvas.scrollY = 0;
        this.ladderCanvas.scale = 1;
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
        const tabBle   = document.getElementById('tab-ble');
        const tabMqtt  = document.getElementById('tab-mqtt');
        const panelSerial = document.getElementById('panel-serial');
        const panelBle    = document.getElementById('panel-ble');
        const panelMqtt   = document.getElementById('panel-mqtt');

        const showTab = (active, panels) => {
            [tabSerial, tabBle, tabMqtt].forEach(t => t.classList.remove('active'));
            [panelSerial, panelBle, panelMqtt].forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
            active.classList.add('active');
            panels.style.display = 'block';
        };

        // Close modal
        closeBtn.onclick = () => this.hideCommModal();
        window.onclick = (e) => { if (e.target === modal) this.hideCommModal(); };

        // Tabs
        tabSerial.onclick = () => showTab(tabSerial, panelSerial);
        tabBle.onclick    = () => showTab(tabBle, panelBle);
        tabMqtt.onclick   = () => showTab(tabMqtt, panelMqtt);

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
            } else if (this.activeComm === 'mqtt' && this.mqttComm.isConnected) {
                this.mqttComm.send(packetData);
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

            // Pergunta se deseja proteger com senha
            if (await this._confirmSimNao("Deseja proteger o programa com senha?")) {
                const pwd = prompt("Digite a senha (máx. 32 caracteres):");
                if (pwd) {
                    packet = this._binAppendPassword(packet, pwd);
                    this.logComm(`> Proteção por senha aplicada.`);
                }
            }

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

    // ===== Diálogo customizado Sim/Não =====
    _confirmSimNao(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

            const box = document.createElement('div');
            box.style.cssText = 'background:#1e293b;border:1px solid #475569;border-radius:8px;padding:24px 28px;min-width:280px;max-width:400px;font-family:sans-serif;color:#e2e8f0';

            const msg = document.createElement('p');
            msg.style.cssText = 'margin:0 0 20px;font-size:14px;line-height:1.5';
            msg.textContent = message;

            const btns = document.createElement('div');
            btns.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';

            const btnSim = document.createElement('button');
            btnSim.textContent = 'Sim';
            btnSim.style.cssText = 'padding:7px 22px;background:#3b82f6;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600';

            const btnNao = document.createElement('button');
            btnNao.textContent = 'Não';
            btnNao.style.cssText = 'padding:7px 22px;background:#475569;color:#e2e8f0;border:none;border-radius:5px;cursor:pointer;font-size:13px';

            const done = (val) => { document.body.removeChild(overlay); resolve(val); };
            btnSim.onclick = () => done(true);
            btnNao.onclick = () => done(false);

            btns.appendChild(btnNao);
            btns.appendChild(btnSim);
            box.appendChild(msg);
            box.appendChild(btns);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            btnSim.focus();
        });
    }

    // ===== BIN password helpers (igual ao Python menu.py) =====
    // Formato: [pacote AA55...checksum] + [BB CC] + [32 bytes senha UTF-8 null-padded]
    _binHasPassword(data) {
        return data.length >= 34 && data[data.length - 34] === 0xBB && data[data.length - 33] === 0xCC;
    }

    _binStripPassword(data) {
        if (this._binHasPassword(data)) {
            return { raw: data.slice(0, data.length - 34), pwdBytes: data.slice(data.length - 32) };
        }
        return { raw: data, pwdBytes: null };
    }

    _binVerifyPassword(pwdBytes, password) {
        const enc = new TextEncoder().encode(password).slice(0, 32);
        const padded = new Uint8Array(32);
        padded.set(enc);
        for (let i = 0; i < 32; i++) if (padded[i] !== pwdBytes[i]) return false;
        return true;
    }

    _binAppendPassword(data, password) {
        const enc = new TextEncoder().encode(password).slice(0, 32);
        const padded = new Uint8Array(32);
        padded.set(enc);
        const result = new Uint8Array(data.length + 34);
        result.set(data);
        result[data.length]     = 0xBB;
        result[data.length + 1] = 0xCC;
        result.set(padded, data.length + 2);
        return result;
    }

    // ===== Salvar BIN (gera + opção de senha + download) =====
    async saveBin() {
        if (!this.serializer) { alert("Módulo de serialização não carregado."); return; }
        try {
            const payloadData = this.serializer.serialize(this.elements, this.rungs);
            let packet = PLCProtocol.createLoadProgramPacket(payloadData);

            if (await this._confirmSimNao("Deseja proteger o arquivo .bin com senha?")) {
                const pwd = prompt("Digite a senha (máx. 32 caracteres):");
                if (pwd) {
                    packet = this._binAppendPassword(packet, pwd);
                }
            }

            const blob = new Blob([packet], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'programa.bin';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert(`Erro ao gerar BIN:\n${e.message}`);
        }
    }

    // ===== Enviar BIN para PLC (carrega arquivo + verifica senha + envia) =====
    async sendBinToPlc() {
        if (!this.activeComm) {
            alert("Conecte-se ao PLC (Serial ou BLE) primeiro!");
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bin';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            let data;
            try {
                const buf = await file.arrayBuffer();
                data = new Uint8Array(buf);
            } catch (err) {
                alert(`Erro ao ler arquivo: ${err.message}`);
                return;
            }

            // 1) Se arquivo já tem senha → verifica antes de acessar conteúdo
            if (this._binHasPassword(data)) {
                const pwd = prompt("Arquivo protegido por senha.\nDigite a senha:");
                if (!pwd) return;
                const pwdBytes = data.slice(data.length - 32);
                if (!this._binVerifyPassword(pwdBytes, pwd)) {
                    alert("Senha incorreta!");
                    return;
                }
            }

            // 2) Valida magic bytes AA 55 (no pacote base sem senha)
            const { raw } = this._binStripPassword(data);
            if (raw.length < 6 || raw[0] !== 0xAA || raw[1] !== 0x55) {
                alert("Arquivo inválido!\nMagic bytes 0xAA 0x55 não encontrados.");
                return;
            }

            // 3) Valida checksum XOR (apenas sobre o pacote base)
            let calcCs = 0;
            for (let i = 0; i < raw.length - 1; i++) calcCs ^= raw[i];
            if (calcCs !== raw[raw.length - 1]) {
                const cont = confirm(
                    `Checksum diverge!\nCalculado: 0x${calcCs.toString(16).toUpperCase()}\n` +
                    `Arquivo: 0x${raw[raw.length - 1].toString(16).toUpperCase()}\n\nEnviar mesmo assim?`
                );
                if (!cont) return;
            }

            // 4) Pergunta se deseja enviar com ou sem senha
            let sendData = raw; // começa com pacote base (sem senha)
            if (await this._confirmSimNao("Deseja enviar o programa com proteção de senha?")) {
                const pwd = prompt("Digite a senha (máx. 32 caracteres):");
                if (pwd) {
                    sendData = this._binAppendPassword(raw, pwd);
                }
            }

            // 5) Envia
            try {
                this.logComm(`> Enviando BIN: ${sendData.length} bytes (${file.name})${sendData.length > raw.length ? ' [com senha]' : ''}...`);
                await this.sendCommCommand(sendData, "BIN");
                this.logComm(`> BIN enviado com sucesso.`);
                this.logComm(`> Pressione ▶️ (F5) para iniciar o PLC.`);
                alert("BIN enviado!\n\nPressione ▶️ (F5) para iniciar o PLC.");
            } catch (err) {
                this.logComm(`[ERRO] Falha ao enviar BIN: ${err.message}`);
                alert(`Erro ao enviar BIN:\n${err.message}`);
            }
        };
        input.click();
    }

    // ===== MQTT =====
    _setupMQTT() {
        if (!this.mqttComm) return;

        const statusEl = document.getElementById('mqtt-status-msg');
        const connBtn  = document.getElementById('mqtt-connect-btn');
        const discBtn  = document.getElementById('mqtt-disconnect-btn');
        const commInd  = document.getElementById('comm-status-indicator');

        // Mostrar/ocultar senha
        const passInput  = document.getElementById('mqtt-pass');
        const passToggle = document.getElementById('mqtt-pass-toggle');
        if (passToggle) {
            passToggle.onclick = () => {
                const show = passInput.type === 'password';
                passInput.type = show ? 'text' : 'password';
                passToggle.textContent = show ? '🙈' : '👁';
            };
        }

        this.mqttComm.onLog = (msg) => this.logComm(`[MQTT] ${msg}`);

        this.mqttComm.onConnected = () => {
            connBtn.disabled = true;
            discBtn.disabled = false;
            if (statusEl) statusEl.textContent = '✅ Conectado — ' + this.mqttComm.deviceId;
            if (commInd) commInd.textContent = '☁️ MQTT Online';
            this.activeComm = 'mqtt';
            // Abre monitor MQTT
            document.getElementById('mqtt-monitor-window').classList.remove('hidden');
            this.hideCommModal();
            // Arrastar monitor MQTT
            this._makeDraggable(
                document.getElementById('mqtt-monitor-window'),
                document.getElementById('mqtt-monitor-titlebar')
            );
        };

        this.mqttComm.onDisconnected = () => {
            connBtn.disabled = false;
            discBtn.disabled = true;
            if (statusEl) statusEl.textContent = '🔌 Desconectado';
            if (commInd) commInd.textContent = '🔌 Desconectado';
            if (this.activeComm === 'mqtt') this.activeComm = null;
        };

        this.mqttComm.onStateUpdate = (state) => {
            this._renderMQTTState(state);
        };

        this.mqttComm.onData = (bytes) => {
            this.handleCommRX(bytes);
        };

        connBtn.onclick = () => {
            const host = document.getElementById('mqtt-host').value.trim();
            const user = document.getElementById('mqtt-user').value.trim();
            const pass = document.getElementById('mqtt-pass').value.trim();
            const id   = document.getElementById('mqtt-device-id').value.trim();
            if (!host || !user || !id) {
                if (statusEl) statusEl.textContent = '⚠️ Preencha Host, Usuário e Device ID';
                return;
            }
            if (statusEl) statusEl.textContent = '⏳ Conectando...';
            this.mqttComm.connect(host, user, pass, id);
        };

        discBtn.onclick = () => {
            this.mqttComm.disconnect();
            document.getElementById('mqtt-monitor-window').classList.add('hidden');
        };

        document.getElementById('mqtt-monitor-close').onclick = () => {
            document.getElementById('mqtt-monitor-window').classList.add('hidden');
        };
    }

    _renderMQTTState(s) {
        const N_IO = 32;

        // Helper: badge colorido
        const badge = (label, val, on) =>
            `<span title="${label}" style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;padding:2px 5px;border-radius:4px;font-size:11px;font-family:monospace;background:${on ? '#166534' : '#1e293b'};color:${on ? '#4ade80' : '#475569'};border:1px solid ${on ? '#16a34a' : '#334155'}">${label}</span>`;

        const valBadge = (label, val) =>
            `<span title="${label}=${val}" style="display:inline-flex;gap:2px;align-items:center;padding:2px 6px;border-radius:4px;font-size:11px;font-family:monospace;background:#1e293b;color:#38bdf8;border:1px solid #334155"><span style="color:#64748b">${label}:</span>${val}</span>`;

        // Entradas
        const inEl = document.getElementById('mqtt-inputs-grid');
        if (inEl) {
            let h = '';
            for (let i = 0; i < N_IO; i++) {
                const on = (s.inputs >> i) & 1;
                if (on || i < 16) h += badge(`I${i}`, on, on);
            }
            inEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // Saídas
        const outEl = document.getElementById('mqtt-outputs-grid');
        if (outEl) {
            let h = '';
            for (let i = 0; i < N_IO; i++) {
                const on = (s.outputs >> i) & 1;
                if (on || i < 16) h += badge(`Q${i}`, on, on);
            }
            outEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // Timers TON + TOFF
        const tmEl = document.getElementById('mqtt-timers-row');
        if (tmEl) {
            let h = '';
            s.timers_ton.forEach((v, i)  => { if (v !== undefined) h += valBadge(`N${i}`, v); });
            s.timers_toff.forEach((v, i) => { if (v !== undefined) h += valBadge(`F${i}`, v); });
            tmEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // Contadores CTU + CTD
        const cntEl = document.getElementById('mqtt-counters-row');
        if (cntEl) {
            let h = '';
            s.ctu.forEach((v, i) => { if (v !== undefined) h += valBadge(`U${i}`, v); });
            s.ctd.forEach((v, i) => { if (v !== undefined) h += valBadge(`D${i}`, v); });
            cntEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // Variáveis
        const varEl = document.getElementById('mqtt-vars-row');
        if (varEl) {
            let h = '';
            s.vars.forEach((v, i) => { if (v !== undefined) h += valBadge(`V${i}`, v); });
            varEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // CMP + MATH
        const cmpEl = document.getElementById('mqtt-cmp-row');
        if (cmpEl) {
            let h = '';
            s.cmp.forEach((v, i)  => { if (v !== undefined) h += valBadge(`K${i}`, v); });
            s.math.forEach((v, i) => { if (v !== undefined) h += valBadge(`M${i}`, v); });
            cmpEl.innerHTML = h || '<span style="color:#475569;font-size:11px">—</span>';
        }

        // RTC
        if (s.rtc) {
            const rtcEl = document.getElementById('mqtt-monitor-rtc');
            if (rtcEl) rtcEl.textContent = '🕐 ' + s.rtc;
        }
    }
}

// Inicializa quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PLCApp();
});
