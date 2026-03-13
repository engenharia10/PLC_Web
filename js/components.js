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

    // Subtipo padrão por componente
    if (compType === 'contact') {
        element.contact_type = 'NA';
        element.contact_behavior = 'toggle';
    } else if (compType === 'coil') {
        element.coil_type = 'NORMAL';
    } else if (compType === 'timer') {
        element.timer_type = 'TON';
        element.preset = '1000';
    } else if (compType === 'counter') {
        element.counter_type = 'UP';
        element.preset = '10';
    } else if (compType === 'math') {
        element.operation = 'ADD';
    } else if (compType === 'can') {
        element.can_mode = 'SEND';
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

// Exports
window.COMPONENT_DATA = COMPONENT_DATA;
window.COMPONENT_DYNAMIC_ICONS = COMPONENT_DYNAMIC_ICONS;
window.SHORT_LABELS = SHORT_LABELS;
window.COMPONENT_TOOLBAR_ORDER = COMPONENT_TOOLBAR_ORDER;
window.COMPONENT_HALF_WIDTH = COMPONENT_HALF_WIDTH;
window.getDefaultName = getDefaultName;
window.createNewElement = createNewElement;
window.getElementIcon = getElementIcon;
