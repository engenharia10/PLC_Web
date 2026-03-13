/**
 * Propriedades — Painel dinâmico de propriedades do componente selecionado
 * Baseado no ladder_properties.py
 */

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
        const t = this.app.theme;
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

        // Nome
        if (['contact', 'coil', 'timer', 'counter'].includes(type)) {
            let options = [];
            let defaultName = '';
            
            if (type === 'contact') {
                const isTRM = this.app.plcType === 'PLC-Trm';
                const contactType = el.contact_type || 'NA';
                const PULSE_PINS_MAX = ['I0.7', 'I0.16', 'I0.17', 'I0.27'];
                const PULSE_PINS_TRM = ['I0.1', 'I0.2', 'I0.9', 'I0.15'];

                let pins;
                if (contactType === 'pulse') {
                    pins = isTRM ? PULSE_PINS_TRM : PULSE_PINS_MAX;
                } else {
                    const pinCount = isTRM ? 20 : 29;
                    pins = Array.from({ length: pinCount }, (_, i) => `I0.${i}`);
                }
                for (const p of pins) options.push({ value: p, label: p });
                defaultName = el.name || pins[0];
                if (!pins.includes(defaultName)) defaultName = pins[0];

            } else if (type === 'coil') {
                for(let i=0; i<=29; i++) options.push({ value: `Q0.${i}`, label: `Q0.${i}` });
                defaultName = el.name || 'Q0.0';
                
            } else if (type === 'timer') {
                for(let i=0; i<=15; i++) options.push({ value: `T${i}`, label: `T${i}` });
                defaultName = el.name || 'T0';
                
            } else if (type === 'counter') {
                for(let i=0; i<=15; i++) options.push({ value: `C${i}`, label: `C${i}` });
                defaultName = el.name || 'C0';
            }

            frag.appendChild(this._createSelect('Nome:', options, el.name || defaultName, (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));
        } else {
            frag.appendChild(this._createField('Nome:', 'text', el.name, (v) => {
                el.name = v;
                this.app.ladderCanvas.render();
            }));
        }

        // Comentário
        frag.appendChild(this._createField('Nome/Função:', 'text', el.comment || '', (v) => {
            el.comment = v;
        }));

        // Tipo específico
        if (type === 'contact') {
            frag.appendChild(this._createSelect('Tipo de Contato:', [
                { value: 'NA', label: 'NA (Normalmente Aberto)' },
                { value: 'NF', label: 'NF (Normalmente Fechado)' },
                { value: 'momentary', label: 'Momentâneo NA' },
                { value: 'momentary_nf', label: 'Momentâneo NF' },
                { value: 'component', label: 'Componente NA' },
                { value: 'component_nf', label: 'Componente NF' },
                { value: 'pulse', label: 'Medição de Pulso (RPM)' },
            ], el.contact_type || 'NA', (v) => {
                if (v.startsWith('momentary')) {
                    el.contact_behavior = 'momentary';
                    el.contact_type = v === 'momentary_nf' ? 'NF' : 'NA';
                } else {
                    el.contact_behavior = 'toggle';
                    el.contact_type = v;
                }
                // Recarrega painel para atualizar opções de nome (pulso usa pinos específicos)
                this.app.ladderCanvas.render();
                this.app.updateProperties();
            }));
        }

        if (type === 'coil') {
            frag.appendChild(this._createSelect('Tipo de Bobina:', [
                { value: 'NORMAL', label: 'Normal' },
                { value: 'INVERTED', label: 'Invertida' },
                { value: 'SET', label: 'Set' },
                { value: 'RESET', label: 'Reset' },
                { value: 'TOGGLE', label: 'Toggle' },
                { value: 'PWM', label: 'PWM' },
            ], el.coil_type || 'NORMAL', (v) => {
                el.coil_type = v;
                this.app.ladderCanvas.render();
            }));
        }

        if (type === 'timer') {
            frag.appendChild(this._createSelect('Modo do Timer:', [
                { value: 'TON', label: 'Timer ON (TON)' },
                { value: 'TOF', label: 'Timer OFF (TOF)' },
            ], el.timer_type || 'TON', (v) => {
                el.timer_type = v;
                this.app.ladderCanvas.render();
            }));
            frag.appendChild(this._createField('Preset (ms):', 'number', el.preset || '1000', (v) => {
                el.preset = v;
            }));
        }

        if (type === 'counter') {
            frag.appendChild(this._createSelect('Modo do Contador:', [
                { value: 'UP', label: 'Contador UP (CTU)' },
                { value: 'DOWN', label: 'Contador DOWN (CTD)' },
                { value: 'RESET', label: 'Reset (CTR)' },
            ], el.counter_type || 'UP', (v) => {
                el.counter_type = v;
                this.app.ladderCanvas.render();
            }));
            frag.appendChild(this._createField('Preset:', 'number', el.preset || '10', (v) => {
                el.preset = v;
            }));
        }

        if (type === 'math') {
            frag.appendChild(this._createSelect('Operação:', [
                { value: 'ADD', label: 'Adição (+)' },
                { value: 'SUB', label: 'Subtração (−)' },
                { value: 'MUL', label: 'Multiplicação (×)' },
                { value: 'DIV', label: 'Divisão (÷)' },
                { value: 'FORMULA', label: 'Fórmula' },
            ], el.operation || 'ADD', (v) => {
                el.operation = v;
                this.app.ladderCanvas.render();
            }));
        }

        if (type === 'can') {
            frag.appendChild(this._createSelect('Modo CAN:', [
                { value: 'SEND', label: 'Enviar (SEND)' },
                { value: 'RECEIVE', label: 'Receber (RECEIVE)' },
            ], el.can_mode || 'SEND', (v) => {
                el.can_mode = v;
                this.app.ladderCanvas.render();
            }));
        }

        // Preset genérico para compare, variable, etc
        if (['compare', 'variable', 'potentiometer', 'analog_input', 'joystick'].includes(type)) {
            frag.appendChild(this._createField('Preset/Valor:', 'text', el.preset || '', (v) => {
                el.preset = v;
            }));
        }

        // Botão deletar
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
        input.value = value;
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
            if (opt.isGroup) {
                const grp = document.createElement('optgroup');
                grp.label = opt.label;
                select.appendChild(grp);
            } else {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                if (opt.value === currentValue) o.selected = true;
                
                const groups = select.getElementsByTagName('optgroup');
                if (groups.length > 0) {
                    groups[groups.length - 1].appendChild(o);
                } else {
                    select.appendChild(o);
                }
            }
        }
        
        select.addEventListener('change', () => onChange(select.value));
        group.appendChild(select);

        return group;
    }
}

window.PropertiesPanel = PropertiesPanel;
