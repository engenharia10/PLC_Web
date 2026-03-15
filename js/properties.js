/**
 * Propriedades — Painel dinâmico de propriedades do componente selecionado
 * Baseado no ladder_properties.py — propriedades idênticas ao Python
 */

const ECU_MAX_ADC_INPUTS = [
    'I0.3', 'I0.4', 'I0.5', 'I0.6', 'I0.7', 'I0.8',
    'I0.14', 'I0.15', 'I0.16', 'I0.17', 'I0.18',
    'I0.22', 'I0.24', 'I0.25', 'I0.26', 'I0.27', 'I0.28'
];

class PropertiesPanel {
    constructor(container, app) {
        this.container = container;
        this.app = app;
    }

    clear() {
        this.container.innerHTML = '';
    }

    update(element) {
        this.clear();
        if (!element) {
            this._showEmpty();
            return;
        }
        this._buildForElement(element);
    }

    _showEmpty() {
        this.container.innerHTML = `
            <div class="props-empty">
                <div class="props-empty-icon">🖱️</div>
                <div class="props-empty-text">Selecione um componente<br>para editar propriedades</div>
            </div>
        `;
    }

    _buildForElement(el) {
        const frag = document.createDocumentFragment();
        const type = el.type;

        // === NOME ===
        if (type === 'contact') {
            const isTRM = this.app.plcType === 'PLC-Trm';
            const PULSE_PINS_MAX = ['I0.7', 'I0.16', 'I0.17', 'I0.27'];
            const PULSE_PINS_TRM = ['I0.1', 'I0.2', 'I0.9', 'I0.15'];
            const contactType = el.contact_type || 'NA';
            let pins;
            if (contactType === 'pulse') {
                pins = isTRM ? PULSE_PINS_TRM : PULSE_PINS_MAX;
            } else {
                const pinCount = isTRM ? 20 : 29;
                pins = Array.from({ length: pinCount }, (_, i) => `I0.${i}`);
            }
            const opts = pins.map(p => ({ value: p, label: p }));
            let defaultName = el.name || pins[0];
            if (!pins.includes(defaultName)) defaultName = pins[0];
            frag.appendChild(this._createSelect('Nome:', opts, defaultName, (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));

        } else if (type === 'coil') {
            const opts = Array.from({ length: 30 }, (_, i) => ({ value: `Q0.${i}`, label: `Q0.${i}` }));
            frag.appendChild(this._createSelect('Nome:', opts, el.name || 'Q0.0', (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));

        } else if (type === 'timer') {
            const opts = Array.from({ length: 16 }, (_, i) => ({ value: `T${i}`, label: `T${i}` }));
            frag.appendChild(this._createSelect('Nome:', opts, el.name || 'T0', (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));

        } else if (type === 'counter') {
            const opts = Array.from({ length: 16 }, (_, i) => ({ value: `C${i}`, label: `C${i}` }));
            frag.appendChild(this._createSelect('Nome:', opts, el.name || 'C0', (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));

        } else {
            frag.appendChild(this._createField('Nome:', 'text', el.name || '', (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));
        }

        // === COMENTÁRIO (Nome/Função) ===
        frag.appendChild(this._createField('Nome/Função:', 'text', el.comment || '', (v) => {
            el.comment = v;
        }));

        // =========================================================
        // CONTACT
        // =========================================================
        if (type === 'contact') {
            // Tipo de Contato
            const ctSel = this._createSelect('Tipo de Contato:', [
                { value: 'NA',           label: 'NA (Normalmente Aberto)' },
                { value: 'NF',           label: 'NF (Normalmente Fechado)' },
                { value: 'momentary',    label: 'Momentâneo NA' },
                { value: 'momentary_nf', label: 'Momentâneo NF' },
                { value: 'component',    label: 'Componente NA' },
                { value: 'component_nf', label: 'Componente NF' },
                { value: 'pulse',        label: 'Medição de Pulso (RPM)' },
            ], (() => {
                const ct = el.contact_type || 'NA';
                const cb = el.contact_behavior || 'toggle';
                if (cb === 'momentary') return ct === 'NF' ? 'momentary_nf' : 'momentary';
                return ct;
            })(), (v) => {
                if (v === 'momentary' || v === 'momentary_nf') {
                    el.contact_behavior = 'momentary';
                    el.contact_type = v === 'momentary_nf' ? 'NF' : 'NA';
                } else {
                    el.contact_behavior = 'toggle';
                    el.contact_type = v;
                }
                this.app.ladderCanvas.render();
                this.app.updateProperties();
            });
            frag.appendChild(ctSel);

            // Seleção de Componente (quando component/component_nf)
            const ct = el.contact_type || 'NA';
            if (ct === 'component' || ct === 'component_nf') {
                const compElements = (this.app.elements || []).filter(e =>
                    ['coil', 'timer', 'counter'].includes(e.type) && e !== el
                );
                const compOpts = compElements.map(e => ({ value: e.name, label: `${e.name} (${e.type})` }));
                if (compOpts.length === 0) compOpts.push({ value: '', label: '(nenhum componente)' });
                frag.appendChild(this._createSelect('Selecionar Componente:', compOpts, el.component_ref || compOpts[0].value, (v) => {
                    el.component_ref = v;
                }));
            }

            // Parâmetros de Pulso
            if (ct === 'pulse') {
                frag.appendChild(this._createRadioGroup('Modo:', [
                    { value: '0', label: 'RPM' },
                    { value: '1', label: 'Largura (µs)' },
                ], String(el.pulse_mode ?? 0), (v) => {
                    el.pulse_mode = parseInt(v);
                }));
                frag.appendChild(this._createField('Pulsos por Revolução:', 'number', el.pulse_per_rev ?? '1', (v) => {
                    el.pulse_per_rev = v;
                }));
                frag.appendChild(this._createField('Filtro Debounce (ms):', 'number', el.pulse_filter ?? '1', (v) => {
                    el.pulse_filter = v;
                }));
            }
        }

        // =========================================================
        // COIL
        // =========================================================
        if (type === 'coil') {
            const coilSel = this._createSelect('Tipo de Bobina:', [
                { value: 'NORMAL',   label: 'Normal' },
                { value: 'INVERTED', label: 'Invertida' },
                { value: 'SET',      label: 'Set' },
                { value: 'RESET',    label: 'Reset' },
                { value: 'TOGGLE',   label: 'Toggle' },
                { value: 'PWM',      label: 'PWM' },
            ], el.coil_type || 'NORMAL', (v) => {
                el.coil_type = v;
                this.app.ladderCanvas.render();
                this.app.updateProperties();
            });
            frag.appendChild(coilSel);

            const coilType = el.coil_type || 'NORMAL';

            // Toggle — Independente da linha
            if (coilType === 'TOGGLE') {
                frag.appendChild(this._createCheckbox('Independente da linha',
                    el.toggle_independent !== false, (v) => {
                        el.toggle_independent = v;
                    }
                ));
            }

            // PWM — Parâmetros
            if (coilType === 'PWM') {
                frag.appendChild(this._createRadioGroup('Polaridade:', [
                    { value: 'Positivo', label: 'Positivo' },
                    { value: 'Negativo', label: 'Negativo' },
                ], el.pwm_polarity || 'Positivo', (v) => {
                    el.pwm_polarity = v;
                    this.app.ladderCanvas.render();
                }));

                // Fonte PWM — elementos de leitura analógica existentes
                const srcElements = (this.app.elements || []).filter(e =>
                    ['joystick', 'potentiometer', 'analog_input'].includes(e.type)
                );
                const srcOpts = srcElements.map(e => ({ value: e.name, label: `${e.name} (${e.type})` }));
                if (srcOpts.length === 0) srcOpts.push({ value: '', label: '(nenhuma fonte)' });
                frag.appendChild(this._createSelect('Fonte PWM:', srcOpts, el.pwm_source || srcOpts[0].value, (v) => {
                    el.pwm_source = v;
                }));

                frag.appendChild(this._createField('Corrente Inicial:', 'number', el.pwm_current_init || '0', (v) => {
                    el.pwm_current_init = v;
                }));
                frag.appendChild(this._createField('Corrente Final:', 'number', el.pwm_current_final || '0', (v) => {
                    el.pwm_current_final = v;
                }));
                frag.appendChild(this._createField('Rampa Inicial (ms):', 'number', el.pwm_ramp_init || '0', (v) => {
                    el.pwm_ramp_init = v;
                }));
                frag.appendChild(this._createField('Rampa Final (ms):', 'number', el.pwm_ramp_final || '0', (v) => {
                    el.pwm_ramp_final = v;
                }));
                frag.appendChild(this._createTextarea('Fórmula (variáveis):', el.pwm_auto_formula || '', (v) => {
                    el.pwm_auto_formula = v;
                }));
                frag.appendChild(this._createTextarea('Fórmula (valores numéricos):', el.pwm_custom_formula || '', (v) => {
                    el.pwm_custom_formula = v;
                }));
            }
        }

        // =========================================================
        // TIMER
        // =========================================================
        if (type === 'timer') {
            frag.appendChild(this._createSelect('Modo do Timer:', [
                { value: 'TON', label: 'Timer ON (TON)' },
                { value: 'TOF', label: 'Timer OFF (TOF)' },
            ], el.timer_type || 'TON', (v) => {
                el.timer_type = v;
                this.app.ladderCanvas.render();
            }));

            frag.appendChild(this._createRadioGroup('Timebase:', [
                { value: 'ms', label: 'Milisegundos' },
                { value: 's',  label: 'Segundos' },
            ], el.timer_timebase || 'ms', (v) => {
                el.timer_timebase = v;
            }));

            frag.appendChild(this._createField('Preset:', 'number', el.preset || '1000', (v) => {
                el.preset = v;
            }));
        }

        // =========================================================
        // COUNTER
        // =========================================================
        if (type === 'counter') {
            frag.appendChild(this._createSelect('Tipo de Contador:', [
                { value: 'UP',    label: 'Contador UP (CTU)' },
                { value: 'DOWN',  label: 'Contador DOWN (CTD)' },
                { value: 'RESET', label: 'Reset (CTR)' },
            ], el.counter_type || 'UP', (v) => {
                el.counter_type = v;
                this.app.ladderCanvas.render();
            }));

            frag.appendChild(this._createField('Preset:', 'number', el.preset || '10', (v) => {
                el.preset = v;
            }));

            frag.appendChild(this._createCheckbox('Verifica Preset',
                el.verify_preset === true, (v) => {
                    el.verify_preset = v;
                }
            ));
        }

        // =========================================================
        // MATH
        // =========================================================
        if (type === 'math') {
            frag.appendChild(this._createSelect('Operação:', [
                { value: 'ADD',     label: 'Adição (+)' },
                { value: 'SUB',     label: 'Subtração (−)' },
                { value: 'MUL',     label: 'Multiplicação (×)' },
                { value: 'DIV',     label: 'Divisão (÷)' },
                { value: 'FORMULA', label: 'Fórmula (RPN)' },
            ], el.operation || 'ADD', (v) => {
                el.operation = v;
                this.app.ladderCanvas.render();
                this.app.updateProperties();
            }));

            if ((el.operation || 'ADD') === 'FORMULA') {
                frag.appendChild(this._createTextarea('Fórmula (variáveis):', el.math_auto_formula || '', (v) => {
                    el.math_auto_formula = v;
                }));
                frag.appendChild(this._createTextarea('Fórmula (valores numéricos):', el.math_custom_formula || '', (v) => {
                    el.math_custom_formula = v;
                }));
            }
        }

        // =========================================================
        // COMPARE
        // =========================================================
        if (type === 'compare') {
            frag.appendChild(this._createSelect('Operador:', [
                { value: '==',  label: 'Igual (==)' },
                { value: '!=',  label: 'Diferente (!=)' },
                { value: '>',   label: 'Maior (>)' },
                { value: '<',   label: 'Menor (<)' },
                { value: '>=',  label: 'Maior ou Igual (>=)' },
                { value: '<=',  label: 'Menor ou Igual (<=)' },
                { value: 'AND', label: 'AND' },
                { value: 'OU',  label: 'OU' },
                { value: 'XOR', label: 'XOR' },
            ], el.compare_operator || '==', (v) => {
                el.compare_operator = v;
            }));

            frag.appendChild(this._createField('Preset/Valor:', 'text', el.preset || '', (v) => {
                el.preset = v;
            }));
        }

        // =========================================================
        // VARIABLE
        // =========================================================
        if (type === 'variable') {
            frag.appendChild(this._createRadioGroup('Modo:', [
                { value: 'Escrever', label: 'Escrever (Set)' },
                { value: 'Ler',      label: 'Ler (Get)' },
            ], el.variable_mode || 'Escrever', (v) => {
                el.variable_mode = v;
            }));

            frag.appendChild(this._createRadioGroup('Tipo:', [
                { value: 'INT',        label: 'Inteiro (INT)' },
                { value: 'FLOAT',      label: 'Ponto Flutuante (FLOAT)' },
                { value: 'ARRAY',      label: 'Array' },
                { value: 'SCHAR',      label: 'Signed Char' },
                { value: 'INT_EEPROM', label: 'Int/EEprom' },
            ], el.variable_type || 'INT', (v) => {
                el.variable_type = v;
                this.app.updateProperties();
            }));

            if ((el.variable_type || 'INT') === 'ARRAY') {
                frag.appendChild(this._createField('Tamanho do Array:', 'number', el.array_size || '0', (v) => {
                    el.array_size = v;
                }));
            }

            frag.appendChild(this._createField('Valor Inicial:', 'text', el.initial_value || '0', (v) => {
                el.initial_value = v;
            }));
        }

        // =========================================================
        // JOYSTICK
        // =========================================================
        if (type === 'joystick') {
            frag.appendChild(this._createSelect('Eixo do Joystick:', [
                { value: 'JX', label: 'JX' },
                { value: 'JY', label: 'JY' },
                { value: 'JZ', label: 'JZ' },
            ], el.axis || el.joystick_axis || 'JX', (v) => {
                el.axis = v;
                el.joystick_axis = v;
            }));

            frag.appendChild(this._createSelect('Pino ADC:',
                ECU_MAX_ADC_INPUTS.map(p => ({ value: p, label: p })),
                el.analog_pin || 'I0.5', (v) => {
                    el.analog_pin = v;
                }
            ));

            frag.appendChild(this._createField('Valor Mínimo:', 'number', el.min_value ?? '210', (v) => {
                el.min_value = v;
            }));
            frag.appendChild(this._createField('Valor Máximo:', 'number', el.max_value ?? '1750', (v) => {
                el.max_value = v;
            }));
        }

        // =========================================================
        // POTENTIOMETER
        // =========================================================
        if (type === 'potentiometer') {
            frag.appendChild(this._createSelect('Pino ADC:',
                ECU_MAX_ADC_INPUTS.map(p => ({ value: p, label: p })),
                el.analog_pin || 'I0.4', (v) => {
                    el.analog_pin = v;
                }
            ));

            frag.appendChild(this._createField('Valor Mínimo:', 'number', el.min_value ?? '0', (v) => {
                el.min_value = v;
            }));
            frag.appendChild(this._createField('Valor Máximo:', 'number', el.max_value ?? '100', (v) => {
                el.max_value = v;
            }));
        }

        // =========================================================
        // ANALOG INPUT
        // =========================================================
        if (type === 'analog_input') {
            frag.appendChild(this._createSelect('Pino ADC:',
                ECU_MAX_ADC_INPUTS.map(p => ({ value: p, label: p })),
                el.analog_pin || 'I0.5', (v) => {
                    el.analog_pin = v;
                }
            ));

            frag.appendChild(this._createField('Valor Mínimo:', 'number', el.min_value ?? '0', (v) => {
                el.min_value = v;
            }));
            frag.appendChild(this._createField('Valor Máximo:', 'number', el.max_value ?? '1980', (v) => {
                el.max_value = v;
            }));
        }

        // =========================================================
        // CAN
        // =========================================================
        if (type === 'can') {
            frag.appendChild(this._createRadioGroup('Barramento CAN:', [
                { value: 'CAN1', label: 'CAN1' },
                { value: 'CAN2', label: 'CAN2' },
            ], el.can_bus || 'CAN1', (v) => {
                el.can_bus = v;
            }));

            frag.appendChild(this._createRadioGroup('Modo CAN:', [
                { value: 'SEND',    label: 'ENVIAR' },
                { value: 'RECEIVE', label: 'RECEBER' },
            ], el.can_mode || 'SEND', (v) => {
                el.can_mode = v;
                this.app.ladderCanvas.render();
                this.app.updateProperties();
            }));

            frag.appendChild(this._createField('Endereço (Hex/Dec):', 'text', el.can_address || '0x00000000', (v) => {
                el.can_address = v;
            }));

            frag.appendChild(this._createField('Intervalo (ms):', 'number', el.can_time || '100', (v) => {
                el.can_time = v;
            }));

            const canMode = el.can_mode || 'SEND';

            if (canMode === 'SEND') {
                frag.appendChild(this._createField('DLC (0-8):', 'number', el.can_dlc || '8', (v) => {
                    el.can_dlc = v;
                }));
                if (!el.can_data) el.can_data = Array(8).fill('0');
                for (let i = 0; i < 8; i++) {
                    const key = `can_data_${i}`;
                    const val = el[key] ?? el.can_data?.[i] ?? '0';
                    frag.appendChild(this._createField(`Byte ${i}:`, 'text', val, (v) => {
                        el[key] = v;
                        if (el.can_data) el.can_data[i] = v;
                    }));
                }
            } else {
                // RECEIVE — seleção de bytes
                frag.appendChild(this._createByteCheckboxes(el));
            }
        }

        // =========================================================
        // RTC
        // =========================================================
        if (type === 'rtc') {
            frag.appendChild(this._createRadioGroup('Modo RTC:', [
                { value: 'System', label: 'System' },
                { value: 'Manual', label: 'Manual' },
            ], el.rtc_mode || 'System', (v) => {
                el.rtc_mode = v;
                this.app.updateProperties();
            }));

            if ((el.rtc_mode || 'System') === 'Manual') {
                const rtcFields = [
                    ['Dia:', 'rtc_dia'], ['Mês:', 'rtc_mes'], ['Ano:', 'rtc_ano'],
                    ['Horas:', 'rtc_horas'], ['Minutos:', 'rtc_minutos'], ['Segundos:', 'rtc_segundos'],
                ];
                for (const [label, key] of rtcFields) {
                    frag.appendChild(this._createField(label, 'number', el[key] || '0', (v) => {
                        el[key] = v;
                    }));
                }
            }

            frag.appendChild(this._createRadioGroup('Saída RTC:', [
                { value: 'segundos', label: 'segundos' },
                { value: 'minutos',  label: 'minutos' },
                { value: 'horas',    label: 'horas' },
                { value: 'dia',      label: 'dia' },
                { value: 'mes',      label: 'mes' },
                { value: 'ano',      label: 'ano' },
                { value: 'data',     label: 'data' },
                { value: 'horario',  label: 'horario' },
            ], el.rtc_output || 'segundos', (v) => {
                el.rtc_output = v;
            }));
        }

        // === BOTÃO DELETAR ===
        const delBtn = document.createElement('button');
        delBtn.className = 'props-delete-btn';
        delBtn.textContent = '🗑️ Deletar Componente';
        delBtn.onclick = () => {
            const idx = this.app.elements.indexOf(el);
            if (idx >= 0) {
                this.app.elements.splice(idx, 1);
                this.app.selectedElement = null;
                this.update(null);
                this.app.ladderCanvas.render();
            }
        };
        frag.appendChild(delBtn);

        this.container.appendChild(frag);
    }

    // =========================================================
    // Helpers de criação de widgets
    // =========================================================

    _createField(label, type, value, onChange) {
        const group = document.createElement('div');
        group.className = 'props-group';

        const lbl = document.createElement('label');
        lbl.className = 'props-label';
        lbl.textContent = label;
        group.appendChild(lbl);

        const input = document.createElement('input');
        input.className = 'props-input';
        input.type = type;
        input.value = value ?? '';
        input.addEventListener('input', () => onChange(input.value));
        group.appendChild(input);

        return group;
    }

    _createSelect(label, options, currentValue, onChange) {
        const group = document.createElement('div');
        group.className = 'props-group';

        const lbl = document.createElement('label');
        lbl.className = 'props-label';
        lbl.textContent = label;
        group.appendChild(lbl);

        const select = document.createElement('select');
        select.className = 'props-select';

        for (const opt of options) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            if (String(opt.value) === String(currentValue)) o.selected = true;
            select.appendChild(o);
        }

        select.addEventListener('change', () => onChange(select.value));
        group.appendChild(select);

        return group;
    }

    _createRadioGroup(label, options, currentValue, onChange) {
        const group = document.createElement('div');
        group.className = 'props-group';

        const lbl = document.createElement('label');
        lbl.className = 'props-label';
        lbl.textContent = label;
        group.appendChild(lbl);

        const radioWrap = document.createElement('div');
        radioWrap.className = 'props-radio-group';

        const name = 'radio_' + Math.random().toString(36).slice(2);
        for (const opt of options) {
            const wrap = document.createElement('label');
            wrap.className = 'props-radio-label';

            const rb = document.createElement('input');
            rb.type = 'radio';
            rb.name = name;
            rb.value = opt.value;
            rb.checked = String(opt.value) === String(currentValue);
            rb.addEventListener('change', () => { if (rb.checked) onChange(rb.value); });

            wrap.appendChild(rb);
            wrap.appendChild(document.createTextNode(' ' + opt.label));
            radioWrap.appendChild(wrap);
        }

        group.appendChild(radioWrap);
        return group;
    }

    _createCheckbox(label, checked, onChange) {
        const group = document.createElement('div');
        group.className = 'props-group props-checkbox-group';

        const wrap = document.createElement('label');
        wrap.className = 'props-radio-label';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.addEventListener('change', () => onChange(cb.checked));

        wrap.appendChild(cb);
        wrap.appendChild(document.createTextNode(' ' + label));
        group.appendChild(wrap);

        return group;
    }

    _createTextarea(label, value, onChange) {
        const group = document.createElement('div');
        group.className = 'props-group';

        const lbl = document.createElement('label');
        lbl.className = 'props-label';
        lbl.textContent = label;
        group.appendChild(lbl);

        const ta = document.createElement('textarea');
        ta.className = 'props-textarea';
        ta.value = value || '';
        ta.rows = 3;
        ta.addEventListener('input', () => onChange(ta.value));
        group.appendChild(ta);

        return group;
    }

    _createByteCheckboxes(el) {
        const group = document.createElement('div');
        group.className = 'props-group';

        const lbl = document.createElement('label');
        lbl.className = 'props-label';
        lbl.textContent = 'Selecione os Bytes:';
        group.appendChild(lbl);

        const grid = document.createElement('div');
        grid.className = 'props-byte-grid';

        if (!el.can_rx_bytes) el.can_rx_bytes = [];

        const visual = document.createElement('div');
        visual.className = 'props-byte-visual';

        const updateVisual = () => {
            const sel = el.can_rx_bytes;
            visual.textContent = sel.length > 0 ? 'Bytes: ' + sel.map(b => `B${b}`).join(', ') : 'Visualização: -';
        };

        for (let i = 0; i < 8; i++) {
            const wrap = document.createElement('label');
            wrap.className = 'props-radio-label';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = (el.can_rx_bytes || []).includes(i);
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    if (!el.can_rx_bytes.includes(i)) el.can_rx_bytes.push(i);
                } else {
                    el.can_rx_bytes = el.can_rx_bytes.filter(x => x !== i);
                }
                updateVisual();
            });

            wrap.appendChild(cb);
            wrap.appendChild(document.createTextNode(` B${i}`));
            grid.appendChild(wrap);
        }

        group.appendChild(grid);
        updateVisual();
        group.appendChild(visual);

        return group;
    }
}

window.PropertiesPanel = PropertiesPanel;
