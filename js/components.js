/**
 * Definições dos 13 componentes PLC — copiado do COMPONENT_DATA e COMPONENT_DYNAMIC_ICONS do ladder.py
 */

const COMPONENT_DATA = {
    branch:       { label: "Branch",        icon: "|_____|" },
    contact:      { label: "Contato",       icon: "——| |——" },
    coil:         { label: "Bobina",        icon: "——( )——" },
    joystick:     { label: "Joystick",      icon: "——[JOY]——" },
    potentiometer:{ label: "Potenciômetro", icon: "——[POT]——" },
    analog_input: { label: "Analógica",     icon: "——[ANA]——" },
    variable:     { label: "Variável",      icon: "——[VAR]——" },
    timer:        { label: "Timer",         icon: "——[TIM]——" },
    counter:      { label: "Contador",      icon: "——[CONT]——" },
    compare:      { label: "Comparador",    icon: "——[CMP]——" },
    math:         { label: "Matemática",    icon: "——[MTH]——" },
    can:          { label: "CAN",           icon: "——[CAN]——" },
    rtc:          { label: "RTC",           icon: "——[RTC]——" },
};

const COMPONENT_DYNAMIC_ICONS = {
    contact: {
        toggle_NA:      "——| |——",
        toggle_NF:      "——|/|——",
        momentary_NA:   "——|○|——",
        momentary_NF:   "——|/○|——",
        pulse:          "——|PLS|——",
    },
    coil: {
        NORMAL:   "——( )——",
        INVERTED: "——(/)——",
        SET:      "——(S)——",
        RESET:    "——(R)——",
        TOGGLE:   "——(T)——",
        PWM:      "——(P)——",
    },
    timer: {
        TON: "——[TON]——",
        TOF: "——[TOF]——",
    },
    math: {
        ADD:     "——[+]——",
        SUB:     "——[−]——",
        MUL:     "——[×]——",
        DIV:     "——[÷]——",
        FORMULA: "—[F>x]—",
    },
    counter: {
        UP:    "——[CTU]——",
        DOWN:  "——[CTD]——",
        RESET: "——[CTR]——",
    },
    joystick:     "——[JOY]——",
    potentiometer:"——[POT]——",
    analog_input: "——[AN]——",
    compare:      "——[CMP]——",
    variable:     "——[VAR]——",
    can:          "——[CAN]——",
    rtc:          "——[RTC]——",
};

// Labels abreviados para toolbar (do Python)
const SHORT_LABELS = {
    "Joystick":      "Joy",
    "Potenciômetro": "Pot",
    "Analógica":     "Analog",
    "Variável":      "Var",
    "Contador":      "Cont",
    "Comparador":    "Comp",
    "Matemática":    "Math"
};

// Ordem dos componentes na toolbar (do Python)
const COMPONENT_TOOLBAR_ORDER = [
    "branch", "contact", "coil", "joystick", "potentiometer",
    "analog_input", "variable", "timer", "counter", "compare", "math", "can", "rtc"
];

const COMPONENT_HALF_WIDTH = 35;

let elementIdCounter = 0;

function getDefaultName(elements, compType) {
    const prefixes = {
        contact: "I0.", coil: "Q0.", timer: "T", counter: "C",
        joystick: "JOY", branch: "B", potentiometer: "POT",
        analog_input: "AN", compare: "CMP", math: "MATH",
        variable: "VAR", variable_contact: "VC", can: "CAN", rtc: "RTC",
    };
    const prefix = prefixes[compType] || "E";
    const existing = new Set();
    elements.forEach(el => {
        if (el.type === compType && el.name.startsWith(prefix)) {
            const idx = parseInt(el.name.slice(prefix.length), 10);
            if (!isNaN(idx)) existing.add(idx);
        }
    });
    let i = 0;
    while (existing.has(i)) i++;
    return prefix + i;
}

function createNewElement(compType, x, y, elements) {
    const name = getDefaultName(elements, compType);
    const id = ++elementIdCounter;
    const data = COMPONENT_DATA[compType];
    const element = {
        id, type: compType, name, x, y,
        icon: data ? data.icon : "——[?]——",
        comment: "",
        preset: "",
    };

    // Subtipo padrão por componente (igual ao Python)
    if (compType === 'contact') {
        element.contact_type = 'NA';
        element.contact_behavior = 'toggle';
        element.pulse_mode = 0;
        element.pulse_per_rev = '1';
        element.pulse_filter = '1';
    } else if (compType === 'coil') {
        element.coil_type = 'NORMAL';
        element.toggle_independent = true;
        element.pwm_polarity = 'Positivo';
        element.pwm_source = '';
        element.pwm_current_init = '0';
        element.pwm_current_final = '0';
        element.pwm_ramp_init = '0';
        element.pwm_ramp_final = '0';
        element.pwm_auto_formula = '';
        element.pwm_custom_formula = '';
    } else if (compType === 'timer') {
        element.timer_type = 'TON';
        element.timer_timebase = 'ms';
        element.preset = '1000';
    } else if (compType === 'counter') {
        element.counter_type = 'UP';
        element.preset = '10';
        element.counter_mode = 'new';
        element.target_counter = '';
        element.verify_preset = false;
    } else if (compType === 'math') {
        element.operation = 'ADD';
        element.source_a = '';
        element.preset = '0';
        element.math_auto_formula = '';
        element.math_custom_formula = '';
    } else if (compType === 'compare') {
        element.compare_operator = '==';
        element.source_a = '';
        element.preset = '0';
    } else if (compType === 'variable') {
        element.scope = 'local';
        element.variable_mode = 'Escrever';
        element.variable_type = 'INT';
        element.array_size = 0;
        element.initial_value = '0';
        element.preset = '0';
    } else if (compType === 'joystick') {
        element.axis = 'JX';
        element.joystick_axis = 'JX';   // alias mantido para compatibilidade UI
        element.analog_pin = 'I0.5';
        element.joystick_mode = 'new';
        element.min_value = '210';
        element.max_value = '1750';
    } else if (compType === 'potentiometer') {
        element.analog_pin = 'I0.4';
        element.min_value = '0';
        element.max_value = '100';
    } else if (compType === 'analog_input') {
        element.analog_number = 'AN0';
        element.analog_pin = 'I0.5';    // alias mantido para compatibilidade UI
        element.min_value = '0';
        element.max_value = '1980';
    } else if (compType === 'can') {
        element.can_bus = 'CAN1';
        element.can_mode = 'SEND';
        element.can_address = '0x00000000';
        element.can_time = '100';
        element.can_dlc = '8';
        element.can_rx_byte = 'Byte 0';
        element.can_rx_size = '1';
        // Dados individuais como no Python (can_data_0 … can_data_7)
        for (let i = 0; i < 8; i++) element[`can_data_${i}`] = '0';
        element.can_data = Array(8).fill('0'); // alias array para compatibilidade UI
        element.can_rx_bytes = [];
    } else if (compType === 'rtc') {
        element.rtc_mode = 'System';
        element.rtc_output = 'segundos';
        element.rtc_dia = '1';
        element.rtc_mes = '1';
        element.rtc_ano = '2025';
        element.rtc_horas = '0';
        element.rtc_minutos = '0';
        element.rtc_segundos = '0';
        element.rtc_data = '01/01/2025';
        element.rtc_horario = '00:00:00';
    }

    return element;
}

function getElementIcon(element) {
    const type = element.type;
    try {
        if (type === 'contact') {
            const behavior = element.contact_behavior || 'toggle';
            const ct = element.contact_type || 'NA';
            if (ct === 'component') return "——|C|——";
            if (ct === 'component_nf') return "——|C/|——";
            if (ct === 'pulse') return "——|PLS|——";
            const key = behavior + '_' + ct;
            return COMPONENT_DYNAMIC_ICONS.contact[key] || "——| |——";
        } else if (type === 'coil') {
            const key = element.coil_type || 'NORMAL';
            let icon = COMPONENT_DYNAMIC_ICONS.coil[key] || "——( )——";
            if (key === 'PWM') {
                const pol = element.pwm_polarity || 'Positivo';
                const sign = pol === 'Positivo' ? '+' : '-';
                icon = `——(P${sign})——`;
            }
            return icon;
        } else if (type === 'timer') {
            return COMPONENT_DYNAMIC_ICONS.timer[element.timer_type || 'TON'] || "——[TIM]——";
        } else if (type === 'math') {
            return COMPONENT_DYNAMIC_ICONS.math[element.operation || 'ADD'] || "——[MTH]——";
        } else if (type === 'counter') {
            return COMPONENT_DYNAMIC_ICONS.counter[element.counter_type || 'UP'] || "——[CTU]——";
        } else if (type in COMPONENT_DYNAMIC_ICONS) {
            return COMPONENT_DYNAMIC_ICONS[type];
        }
    } catch (e) {}
    return element.icon || "——[?]——";
}

// SVG icons modernos para a toolbar (não usados no canvas)
const COMPONENT_SVG_ICONS = {
    branch: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="1" x2="5" y1="10" y2="10"/><line x1="5" x2="5" y1="5" y2="15"/><line x1="15" x2="15" y1="5" y2="15"/><line x1="15" x2="19" y1="10" y2="10"/><line x1="5" x2="15" y1="7" y2="7"/><line x1="5" x2="15" y1="13" y2="13"/></svg>`,
    contact: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1" x2="6" y1="10" y2="10"/><line x1="6" x2="6" y1="4" y2="16"/><line x1="11" x2="11" y1="4" y2="16"/><line x1="11" x2="19" y1="10" y2="10"/></svg>`,
    coil:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="1" x2="5" y1="10" y2="10"/><circle cx="10" cy="10" r="5"/><line x1="15" x2="19" y1="10" y2="10"/></svg>`,
    joystick:`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><line x1="10" x2="10" y1="5" y2="9"/><line x1="10" x2="10" y1="11" y2="15"/><line x1="5" x2="9" y1="10" y2="10"/><line x1="11" x2="15" y1="10" y2="10"/><circle cx="10" cy="10" r="2" fill="currentColor"/></svg>`,
    potentiometer:`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="6"/><line x1="10" x2="10" y1="4" y2="7"/><path d="M6 15 A6 6 0 0 0 14 15"/><line x1="10" x2="13" y1="7" y2="4"/></svg>`,
    analog_input:`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 10 Q3.5 4 6 10 Q8.5 16 11 10 Q13.5 4 16 10 Q18.5 16 19 10"/></svg>`,
    variable:`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="14" height="12" rx="2"/><line x1="3" x2="17" y1="9" y2="9"/><line x1="9" x2="9" y1="9" y2="16"/></svg>`,
    timer:   `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="12" r="7"/><line x1="10" x2="10" y1="8" y2="12"/><line x1="10" x2="13" y1="12" y2="14"/><line x1="7" x2="13" y1="3" y2="3"/></svg>`,
    counter: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="8" width="12" height="9" rx="2"/><line x1="10" x2="10" y1="10" y2="14"/><line x1="8" x2="12" y1="10" y2="10"/><polyline points="7,6 10,3 13,6"/></svg>`,
    compare: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="12,4 4,10 12,16"/><line x1="15" x2="15" y1="4" y2="16"/></svg>`,
    math:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="14" height="14" rx="2"/><line x1="10" x2="10" y1="7" y2="13"/><line x1="7" x2="13" y1="10" y2="10"/></svg>`,
    can:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="3" r="2"/><circle cx="3" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><line x1="10" x2="4.5" y1="5" y2="14"/><line x1="10" x2="15.5" y1="5" y2="14"/><line x1="5" x2="15" y1="16" y2="16"/></svg>`,
    rtc:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="14" height="13" rx="2"/><line x1="3" x2="17" y1="9" y2="9"/><line x1="7" x2="7" y1="2" y2="6"/><line x1="13" x2="13" y1="2" y2="6"/><line x1="10" x2="10" y1="12" y2="14"/><line x1="10" x2="12" y1="14" y2="15"/></svg>`,
    rung:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="2" x2="18" y1="10" y2="10"/><line x1="2" x2="2" y1="6" y2="14"/><line x1="18" x2="18" y1="6" y2="14"/></svg>`,
};

// Exports
window.COMPONENT_DATA = COMPONENT_DATA;
window.COMPONENT_SVG_ICONS = COMPONENT_SVG_ICONS;
window.COMPONENT_DYNAMIC_ICONS = COMPONENT_DYNAMIC_ICONS;
window.SHORT_LABELS = SHORT_LABELS;
window.COMPONENT_TOOLBAR_ORDER = COMPONENT_TOOLBAR_ORDER;
window.COMPONENT_HALF_WIDTH = COMPONENT_HALF_WIDTH;
window.getDefaultName = getDefaultName;
window.createNewElement = createNewElement;
window.getElementIcon = getElementIcon;
