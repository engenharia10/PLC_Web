/**
 * Conectores — Página de configuração de I/O dos conectores físicos (ECU-MAX).
 * Porta de conector_max.py + mapeamento_conector1/2.py.
 *
 * Mostra:
 *  - Periféricos Ativos: PWM (enable+freq), CAN1/CAN2 (enable+baud) → app.ioConfig
 *  - Mapa visual do Conector 1 (entradas I0.x) e Conector 2 (saídas Q0.x),
 *    com cores por função e destaque dos pinos usados no ladder.
 */

// ===== Mapeamento Conector 1 (entradas I0.x) =====
const CONECTOR_1 = {
    'A2': { logico: 'I0.0', stm32: 'PE10' }, 'A3': { logico: 'I0.1', stm32: 'PG1' },
    'A4': { logico: 'I0.2', stm32: 'PF14' }, 'A7': { logico: 'I0.3', stm32: 'PB1' },
    'A8': { logico: 'I0.4', stm32: 'PC2' },  'A9': { logico: 'I0.5', stm32: 'PC3' },
    'A10': { logico: 'I0.6', stm32: 'PF4' }, 'A11': { logico: 'I0.7', stm32: 'PF7' },
    'A12': { logico: 'I0.8', stm32: 'PF10' },
    'B1': { logico: 'I0.9', stm32: 'PE13' }, 'B2': { logico: 'I0.10', stm32: 'PE8' },
    'B3': { logico: 'I0.11', stm32: 'PG0' }, 'B4': { logico: 'I0.12', stm32: 'PF13' },
    'B7': { logico: 'I0.13', stm32: 'PB0' }, 'B8': { logico: 'I0.14', stm32: 'PC4' },
    'B9': { logico: 'I0.15', stm32: 'PA2' }, 'B10': { logico: 'I0.16', stm32: 'PF3' },
    'B11': { logico: 'I0.17', stm32: 'PF6' }, 'B12': { logico: 'I0.18', stm32: 'PF9' },
    'B13': { logico: 'I0.19', stm32: 'PC1' },
    'C1': { logico: 'I0.20', stm32: 'PE12' }, 'C2': { logico: 'I0.21', stm32: 'PE7' },
    'C3': { logico: 'I0.22', stm32: 'PF15' }, 'C7': { logico: 'I0.23', stm32: 'PC5' },
    'C8': { logico: 'I0.24', stm32: 'PE9' }, 'C9': { logico: 'I0.25', stm32: 'PA3' },
    'C10': { logico: 'I0.26', stm32: 'PA4' }, 'C11': { logico: 'I0.27', stm32: 'PF5' },
    'C12': { logico: 'I0.28', stm32: 'PF8' }, 'C13': { logico: 'I0.29', stm32: 'PC0' },
};

// ===== Mapeamento Conector 2 (saídas Q0.x) =====
const CONECTOR_2 = {
    'C2': { logico: 'Q0.0', stm32: 'PG5' }, 'C3': { logico: 'Q0.1', stm32: 'PG8' },
    'C4': { logico: 'Q0.2', stm32: 'PA15' }, 'C5': { logico: 'Q0.3', stm32: 'PC8' },
    'C6': { logico: 'Q0.4', stm32: 'PD15' }, 'C7': { logico: 'Q0.5', stm32: 'PB4' },
    'C10': { logico: 'Q0.6', stm32: 'PE5' }, 'C11': { logico: 'Q0.7', stm32: 'PA10' },
    'C12': { logico: 'Q0.8', stm32: 'PE14' }, 'C13': { logico: 'Q0.30', stm32: 'RESERVED' },
    'B1': { logico: 'Q0.9', stm32: 'PG3' }, 'B2': { logico: 'Q0.10', stm32: 'PG6' },
    'B3': { logico: 'Q0.11', stm32: 'PA11' }, 'B4': { logico: 'Q0.12', stm32: 'PD2' },
    'B5': { logico: 'Q0.13', stm32: 'PC7' }, 'B6': { logico: 'Q0.14', stm32: 'PD14' },
    'B7': { logico: 'Q0.15', stm32: 'PD12' }, 'B10': { logico: 'Q0.16', stm32: 'PE6' },
    'B11': { logico: 'Q0.17', stm32: 'PB8' }, 'B12': { logico: 'Q0.18', stm32: 'PB10' },
    'B13': { logico: 'Q0.19', stm32: 'PA0' },
    'A1': { logico: 'Q0.20', stm32: 'PG4' }, 'A2': { logico: 'Q0.21', stm32: 'PG7' },
    'A3': { logico: 'Q0.22', stm32: 'PA12' }, 'A4': { logico: 'Q0.23', stm32: 'PC9' },
    'A5': { logico: 'Q0.24', stm32: 'PC6' }, 'A6': { logico: 'Q0.25', stm32: 'PB3' },
    'A7': { logico: 'Q0.26', stm32: 'PD13' }, 'A11': { logico: 'Q0.27', stm32: 'PB9' },
    'A12': { logico: 'Q0.28', stm32: 'PB11' }, 'A13': { logico: 'Q0.29', stm32: 'PA1' },
};

// Entradas com ADC válidas (verde no Conector 1)
const ECU_MAX_ADC_INPUTS_C = [
    'I0.3', 'I0.4', 'I0.5', 'I0.6', 'I0.7', 'I0.8', 'I0.14', 'I0.15',
    'I0.16', 'I0.17', 'I0.18', 'I0.19', 'I0.23', 'I0.25', 'I0.26', 'I0.27', 'I0.28', 'I0.29',
];

// Saídas com PWM de hardware (amarelo no Conector 2)
const ECU_MAX_PWM_OUTPUTS_C = new Set([
    'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'Q0.6', 'Q0.7', 'Q0.11', 'Q0.13',
    'Q0.14', 'Q0.15', 'Q0.16', 'Q0.17', 'Q0.18', 'Q0.19',
    'Q0.23', 'Q0.24', 'Q0.25', 'Q0.26', 'Q0.27', 'Q0.28', 'Q0.29',
]);

function getLogicalAddressConn1(pinNum) {
    if (pinNum < 1 || pinNum > 39) return null;
    let row, col;
    if (pinNum <= 13) { row = 'A'; col = pinNum; }
    else if (pinNum <= 26) { row = 'B'; col = pinNum - 13; }
    else { row = 'C'; col = pinNum - 26; }
    const info = CONECTOR_1[`${row}${col}`];
    return info ? info.logico : null;
}

function getLogicalAddressConn2(pinNum) {
    if (pinNum < 1 || pinNum > 39) return null;
    let row, col;
    if (pinNum <= 13) { row = 'C'; col = pinNum; }
    else if (pinNum <= 26) { row = 'B'; col = pinNum - 13; }
    else { row = 'A'; col = pinNum - 26; }
    const info = CONECTOR_2[`${row}${col}`];
    return info ? info.logico : null;
}

function getUsedPinsFromLadder(elements) {
    const used = { inputs: {}, outputs: {} };
    (elements || []).forEach(el => {
        const t = el.type, name = el.name || '';
        if (t === 'contact' && name.startsWith('I0.')) {
            used.inputs[name] = 'Entrada';
        } else if (t === 'coil' && name.startsWith('Q0.')) {
            used.outputs[name] = (el.coil_type === 'PWM') ? 'PWM' : 'Saida';
        } else if (t === 'joystick' || t === 'potentiometer' || t === 'analog_input') {
            const pin = el.analog_pin || '';
            if (pin.startsWith('I0.')) used.inputs[pin] = 'Analogica';
        }
    });
    return used;
}

class ConectoresPage {
    constructor(app) {
        this.app = app;
    }

    _ensureIoConfig() {
        if (!this.app.ioConfig) this.app.ioConfig = {};
        return this.app.ioConfig;
    }

    show() {
        const area = document.getElementById('conectores-area');
        if (!area) return;
        document.getElementById('canvas-area').style.display = 'none';
        const sa = document.getElementById('script-area');
        if (sa) sa.style.display = 'none';
        area.style.display = 'flex';
        this.app._activeView = 'conectores';
        this._render(area);
    }

    _render(area) {
        const cfg = this._ensureIoConfig();
        const elements = this.app.elements || [];
        const usedPins = getUsedPinsFromLadder(elements);

        const hasCan = elements.some(e => e.type === 'can');
        const hasPwm = elements.some(e => e.type === 'coil' && e.coil_type === 'PWM');
        // IHM com transporte CAN também conta como CAN ativo (igual ao serializer)
        const hasIhmCan1 = elements.some(e => e.type === 'ihm' && (e.ihm_transport === 'CAN' || e.ihm_transport === 'Both') && (e.ihm_can_bus || 'CAN1') === 'CAN1');
        const hasIhmCan2 = elements.some(e => e.type === 'ihm' && (e.ihm_transport === 'CAN' || e.ihm_transport === 'Both') && e.ihm_can_bus === 'CAN2');

        const can1Default = !!cfg.CAN1_enabled || hasCan || hasIhmCan1;
        const can2Default = !!cfg.CAN2_enabled || hasIhmCan2;
        const pwmDefault = !!cfg.PWM_enabled || hasPwm;
        const can1Baud = String(cfg.CAN1_baudrate ?? '250');
        const can2Baud = String(cfg.CAN2_baudrate ?? '250');
        const pwmFreq = String(cfg.PWM_frequency ?? '100');
        const serialBaud = String(cfg.Serial_baudrate ?? '115200');
        const rs485Baud = String(cfg.RS485_baudrate ?? '115200');

        const baudOpts = ['100', '125', '250', '500', '1000'];
        const uartBaudOpts = ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'];

        area.innerHTML = `
            <div class="conn-header">
                <button class="conn-back-btn" id="conn-back-btn">← Voltar</button>
                <span class="conn-title">⚡ Configuração de Conectores I/O</span>
            </div>
            <div class="conn-scroll">
                <div class="conn-box">
                    <div class="conn-box-title">Periféricos Ativos</div>
                    <div class="conn-row">
                        <label class="conn-check"><input type="checkbox" id="conn-pwm-en" ${pwmDefault ? 'checked' : ''}> Habilitar PWM</label>
                        <span class="conn-lbl">Frequência:</span>
                        <input type="number" id="conn-pwm-freq" class="conn-input" value="${pwmFreq}" min="50" max="1200">
                        <span class="conn-lbl">Hz (50-1200)</span>
                    </div>
                    <div class="conn-row">
                        <label class="conn-check"><input type="checkbox" id="conn-can1-en" ${can1Default ? 'checked' : ''}> Habilitar CAN 1</label>
                        <span class="conn-lbl">Baud Rate:</span>
                        <select id="conn-can1-baud" class="conn-select">${baudOpts.map(b => `<option value="${b}" ${b === can1Baud ? 'selected' : ''}>${b}</option>`).join('')}</select>
                        <span class="conn-lbl">Kbps</span>
                    </div>
                    <div class="conn-row">
                        <label class="conn-check"><input type="checkbox" id="conn-can2-en" ${can2Default ? 'checked' : ''}> Habilitar CAN 2</label>
                        <span class="conn-lbl">Baud Rate:</span>
                        <select id="conn-can2-baud" class="conn-select">${baudOpts.map(b => `<option value="${b}" ${b === can2Baud ? 'selected' : ''}>${b}</option>`).join('')}</select>
                        <span class="conn-lbl">Kbps</span>
                    </div>
                    <div class="conn-row">
                        <span class="conn-check">Serial (IHM/USART6)</span>
                        <span class="conn-lbl">Baud Rate:</span>
                        <select id="conn-serial-baud" class="conn-select">${uartBaudOpts.map(b => `<option value="${b}" ${b === serialBaud ? 'selected' : ''}>${b}</option>`).join('')}</select>
                        <span class="conn-lbl">bps</span>
                    </div>
                    <div class="conn-row">
                        <span class="conn-check">485 (IHM/USART2)</span>
                        <span class="conn-lbl">Baud Rate:</span>
                        <select id="conn-rs485-baud" class="conn-select">${uartBaudOpts.map(b => `<option value="${b}" ${b === rs485Baud ? 'selected' : ''}>${b}</option>`).join('')}</select>
                        <span class="conn-lbl">bps</span>
                    </div>
                </div>

                <div class="conn-box">
                    <div class="conn-box-title">🔌 CONECTOR 1 - 39 Pinos (Entradas I0.x)</div>
                    ${this._renderGrid(1, usedPins)}
                </div>

                <div class="conn-box">
                    <div class="conn-box-title">🔌 CONECTOR 2 - 39 Pinos (Saídas Q0.x)</div>
                    ${this._renderGrid(2, usedPins)}
                </div>

                <div class="conn-legend">
                    <span class="conn-leg"><i style="background:red"></i>VCC</span>
                    <span class="conn-leg"><i style="background:black"></i>GND</span>
                    <span class="conn-leg"><i style="background:purple"></i>CAN</span>
                    <span class="conn-leg"><i style="background:orange"></i>RS485</span>
                    <span class="conn-leg"><i style="background:green"></i>Analógica</span>
                    <span class="conn-leg"><i style="background:blue"></i>Digital</span>
                    <span class="conn-leg"><i style="background:yellow"></i>PWM</span>
                    <span class="conn-leg"><i style="background:gray"></i>Não usado</span>
                </div>
            </div>
        `;

        // Persistência da config de periféricos
        const persist = () => {
            cfg.PWM_enabled = document.getElementById('conn-pwm-en').checked;
            cfg.PWM_frequency = document.getElementById('conn-pwm-freq').value || '100';
            cfg.CAN1_enabled = document.getElementById('conn-can1-en').checked;
            cfg.CAN1_baudrate = document.getElementById('conn-can1-baud').value;
            cfg.CAN2_enabled = document.getElementById('conn-can2-en').checked;
            cfg.CAN2_baudrate = document.getElementById('conn-can2-baud').value;
            cfg.Serial_baudrate = document.getElementById('conn-serial-baud').value;
            cfg.RS485_baudrate = document.getElementById('conn-rs485-baud').value;
        };
        ['conn-pwm-en', 'conn-can1-en', 'conn-can2-en', 'conn-can1-baud', 'conn-can2-baud',
         'conn-serial-baud', 'conn-rs485-baud']
            .forEach(id => document.getElementById(id).addEventListener('change', persist));

        const freqInput = document.getElementById('conn-pwm-freq');
        freqInput.addEventListener('change', () => {
            let v = parseInt(freqInput.value, 10);
            if (isNaN(v)) v = 100;
            v = Math.max(50, Math.min(1200, v));
            freqInput.value = String(v);
            cfg.PWM_frequency = String(v);
        });

        // Salva os defaults auto-detectados imediatamente (CAN/PWM por elementos)
        persist();

        document.getElementById('conn-back-btn').onclick = () => this.app.showLadderView();
    }

    // Replica a lógica de cores do conector_max.py
    _pinStyle(connector, pinNum, usedPins) {
        let bg = '#334155', fg = 'white', text = 'N.C', logical;
        const special = (b, t, f = 'white') => { bg = b; text = t; fg = f; isSpecial = true; };
        let isSpecial = false;

        if (connector === 1) {
            logical = getLogicalAddressConn1(pinNum);
            const vcc = [13, 32, 19], gnd = [1, 18, 31], darkred = [30];
            const can = { 5: 'CANH', 6: 'CANL' };
            if (vcc.includes(pinNum)) special('red', 'VCC');
            else if (gnd.includes(pinNum)) special('black', 'GND');
            else if (can[pinNum]) special('purple', can[pinNum]);
            else if (darkred.includes(pinNum)) special('darkred', '5Vcc');
            else if (logical && ECU_MAX_ADC_INPUTS_C.includes(logical)) { bg = 'green'; text = 'N.C'; }
            else if (logical) { bg = 'blue'; text = 'N.C'; }
            const used = logical && usedPins.inputs[logical];
            let border = bg;
            if (used) { text = usedPins.inputs[logical]; }
            else if (logical && !isSpecial) { border = bg; bg = 'gray'; fg = 'white'; }
            return { bg, fg, text, logical, border, used };
        } else {
            logical = getLogicalAddressConn2(pinNum);
            const vcc = [13, 36], gnd = [1, 34, 35];
            const can = { 9: 'CANH', 22: 'CANL' };
            const rs485 = { 8: 'RS485 A', 21: 'RS485 B' };
            if (vcc.includes(pinNum)) special('red', 'VCC');
            else if (gnd.includes(pinNum)) special('black', 'GND');
            else if (can[pinNum]) special('purple', can[pinNum]);
            else if (rs485[pinNum]) special('orange', rs485[pinNum], 'black');
            else if (logical && ECU_MAX_PWM_OUTPUTS_C.has(logical)) { bg = 'yellow'; fg = 'black'; text = 'N.C'; }
            else if (logical) { bg = 'blue'; text = 'N.C'; }
            const used = logical && usedPins.outputs[logical];
            let border = bg;
            if (used) { text = usedPins.outputs[logical]; }
            else if (logical && !isSpecial) { border = bg; bg = 'gray'; fg = 'white'; }
            return { bg, fg, text, logical, border, used };
        }
    }

    _renderGrid(connector, usedPins) {
        let html = '<div class="conn-grid">';
        for (let row = 0; row < 3; row++) {
            html += '<div class="conn-grid-row">';
            for (let col = 12; col >= 0; col--) {
                const pinNum = row * 13 + (col + 1);
                const s = this._pinStyle(connector, pinNum, usedPins);
                const logHtml = s.logical
                    ? `<span class="conn-pin-log" style="color:${s.used ? 'black' : 'darkgray'}">${s.logical}</span>` : '';
                html += `
                    <div class="conn-pin" style="background:${s.bg}; border-color:${s.border};">
                        <div class="conn-pin-head">
                            <span class="conn-pin-num" style="color:${s.fg}">Pino ${pinNum}</span>
                            ${logHtml}
                        </div>
                        <div class="conn-pin-fn" style="color:${s.fg}">${s.text}</div>
                    </div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }
}

window.ConectoresPage = ConectoresPage;
