/**
 * ThemeManager — Gerencia os 4 temas visuais do PLC Editor
 * Copiado fielmente do themes.py (Python/PyQt5)
 */

const THEMES = {
    dark: {
        BG_DARK: "#1e293b",
        TEXT_COLOR: "#f1f5f9",
        ENTRY_BG: "#334155",
        ENTRY_FG: "#f1f5f9",
        MENU_BG: "#334155",
        MENU_FG: "#f1f5f9",
        MENU_ACTIVE: "#475569",
        THEME_FRAME_BG: "#1e293b",
        THEME_BTN_BG: "#334155",
        THEME_BTN_FG: "#f1f5f9",
        THEME_BTN_ACTIVE: "#475569",
        NOTEBOOK_BG: "#334155",
        NOTEBOOK_TAB_BG: "#475569",
        NOTEBOOK_TAB_FG: "#f1f5f9",
        LADDER_BG: "#1e293b",
        COMPONENT_HEADER_BG: "#6366f1",
        COMPONENT_HEADER_FG: "#f1f5f9",
        COMPONENT_SUBTITLE_FG: "#cbd5e1",
        CANVAS_BG: "#0f172a",
        BUTTON_BG: "#334155",
        BUTTON_FG: "#f1f5f9",
        BUTTON_ACTIVE_BG: "#475569",
        RUNG_LINE_COLOR: "#94a3b8",
        POWER_RAIL_COLOR: "#3b82f6",
        PROPS_BG: "#334155",
        PROPS_FG: "#f1f5f9",
        SUCCESS_BG: "#22c55e",
        SUCCESS_DARK: "#16a34a",
        ERROR_BG: "#ef4444",
        INFO_BG: "#3b82f6",
        SIM_BG: "#1e293b",
        SIM_HEADER_BG: "#6366f1",
        SIM_HEADER_FG: "#f1f5f9",
        SIM_STATUS_STOPPED: "#64748b",
        SIM_STATUS_RUNNING: "#22c55e",
        SIM_ELEMENT_BG: "#334155",
        SIM_ELEMENT_FG: "#f1f5f9",
        ST_BG: "#1e293b",
        ST_FG: "#9CDCFE",
        ST_EDITOR_BG: "#0f172a",
        AI_PANEL_BG: "#334155",
        AI_TITLE_FG: "#818cf8",
        AI_BTN_BG: "#6366f1",
        CONN_BG: "#1e293b",
        CONN_FG: "#f1f5f9",
        PIN_BG: "#334155",
        PIN_FG: "#f1f5f9",
    },

    ultra_dark: {
        BG_DARK: "#080d18",
        TEXT_COLOR: "#f1f5f9",
        ENTRY_BG: "#0f172a",
        ENTRY_FG: "#f1f5f9",
        MENU_BG: "#121924",
        MENU_FG: "#f1f5f9",
        MENU_ACTIVE: "#1A212B",
        THEME_FRAME_BG: "#05080f",
        THEME_BTN_BG: "#1e293b",
        THEME_BTN_FG: "#f1f5f9",
        THEME_BTN_ACTIVE: "#181E28",
        NOTEBOOK_BG: "#1e293b",
        NOTEBOOK_TAB_BG: "#1F2732",
        NOTEBOOK_TAB_FG: "#f1f5f9",
        LADDER_BG: "#090e1a",
        COMPONENT_HEADER_BG: "#02031b",
        COMPONENT_HEADER_FG: "#f1f5f9",
        COMPONENT_SUBTITLE_FG: "#cbd5e1",
        CANVAS_BG: "#020617",
        BUTTON_BG: "#151c28",
        BUTTON_FG: "#f1f5f9",
        BUTTON_ACTIVE_BG: "#1B222C",
        RUNG_LINE_COLOR: "#94a3b8",
        POWER_RAIL_COLOR: "#3b82f6",
        PROPS_BG: "#1e293b",
        PROPS_FG: "#f1f5f9",
        SUCCESS_BG: "#16a34a",
        SUCCESS_DARK: "#15803d",
        ERROR_BG: "#be123c",
        INFO_BG: "#2563eb",
        SIM_BG: "#0f172a",
        SIM_HEADER_BG: "#020323",
        SIM_HEADER_FG: "#f1f5f9",
        SIM_STATUS_STOPPED: "#64748b",
        SIM_STATUS_RUNNING: "#055805",
        SIM_ELEMENT_BG: "#1e293b",
        SIM_ELEMENT_FG: "#f1f5f9",
        ST_BG: "#0f172a",
        ST_FG: "#9CDCFE",
        ST_EDITOR_BG: "#020617",
        AI_PANEL_BG: "#1e293b",
        AI_TITLE_FG: "#818cf8",
        AI_BTN_BG: "#080c70",
        CONN_BG: "#0f172a",
        CONN_FG: "#f1f5f9",
        PIN_BG: "#1e293b",
        PIN_FG: "#f1f5f9",
    },

    light: {
        BG_DARK: "#f1f5f9",
        TEXT_COLOR: "#1e293b",
        ENTRY_BG: "#ffffff",
        ENTRY_FG: "#1e293b",
        MENU_BG: "#e2e8f0",
        MENU_FG: "#1e293b",
        MENU_ACTIVE: "#cbd5e1",
        THEME_FRAME_BG: "#f1f5f9",
        THEME_BTN_BG: "#e2e8f0",
        THEME_BTN_FG: "#1e293b",
        THEME_BTN_ACTIVE: "#cbd5e1",
        NOTEBOOK_BG: "#e2e8f0",
        NOTEBOOK_TAB_BG: "#cbd5e1",
        NOTEBOOK_TAB_FG: "#1e293b",
        LADDER_BG: "#f8fafc",
        COMPONENT_HEADER_BG: "#6366f1",
        COMPONENT_HEADER_FG: "#ffffff",
        COMPONENT_SUBTITLE_FG: "#ddd6fe",
        CANVAS_BG: "#ffffff",
        BUTTON_BG: "#ffffff",
        BUTTON_FG: "#334155",
        BUTTON_ACTIVE_BG: "#e0e7ff",
        RUNG_LINE_COLOR: "#94a3b8",
        POWER_RAIL_COLOR: "#3b82f6",
        PROPS_BG: "#e0e7ff",
        PROPS_FG: "#1e293b",
        SUCCESS_BG: "#22c55e",
        SUCCESS_DARK: "#16a34a",
        ERROR_BG: "#ef4444",
        INFO_BG: "#3b82f6",
        SIM_BG: "#f8fafc",
        SIM_HEADER_BG: "#6366f1",
        SIM_HEADER_FG: "#ffffff",
        SIM_STATUS_STOPPED: "#94a3b8",
        SIM_STATUS_RUNNING: "#22c55e",
        SIM_ELEMENT_BG: "#e2e8f0",
        SIM_ELEMENT_FG: "#1e293b",
        ST_BG: "#f8fafc",
        ST_FG: "#1e293b",
        ST_EDITOR_BG: "#ffffff",
        AI_PANEL_BG: "#e0e7ff",
        AI_TITLE_FG: "#4338ca",
        AI_BTN_BG: "#6366f1",
        CONN_BG: "#f8fafc",
        CONN_FG: "#1e293b",
        PIN_BG: "#e2e8f0",
        PIN_FG: "#1e293b",
    },

    super_blue: {
        BG_DARK: "#0d1b2a",
        TEXT_COLOR: "#e0f4ff",
        ENTRY_BG: "#1e3a5f",
        ENTRY_FG: "#e0f4ff",
        MENU_BG: "#1b263b",
        MENU_FG: "#e0f4ff",
        MENU_ACTIVE: "#2563eb",
        THEME_FRAME_BG: "#0d1b2a",
        THEME_BTN_BG: "#1e3a5f",
        THEME_BTN_FG: "#e0f4ff",
        THEME_BTN_ACTIVE: "#3b82f6",
        NOTEBOOK_BG: "#1b263b",
        NOTEBOOK_TAB_BG: "#2563eb",
        NOTEBOOK_TAB_FG: "#ffffff",
        LADDER_BG: "#0d1b2a",
        COMPONENT_HEADER_BG: "#1d4ed8",
        COMPONENT_HEADER_FG: "#ffffff",
        COMPONENT_SUBTITLE_FG: "#93c5fd",
        CANVAS_BG: "#1b3a5a",
        BUTTON_BG: "#1e3a5f",
        BUTTON_FG: "#e0f4ff",
        BUTTON_ACTIVE_BG: "#2563eb",
        RUNG_LINE_COLOR: "#60a5fa",
        POWER_RAIL_COLOR: "#3b82f6",
        PROPS_BG: "#1b263b",
        PROPS_FG: "#e0f4ff",
        SUCCESS_BG: "#0ea5e9",
        SUCCESS_DARK: "#0284c7",
        ERROR_BG: "#dc2626",
        INFO_BG: "#3b82f6",
        SIM_BG: "#0d1b2a",
        SIM_HEADER_BG: "#1d4ed8",
        SIM_HEADER_FG: "#ffffff",
        SIM_STATUS_STOPPED: "#64748b",
        SIM_STATUS_RUNNING: "#0ea5e9",
        SIM_ELEMENT_BG: "#1e3a5f",
        SIM_ELEMENT_FG: "#e0f4ff",
        ST_BG: "#0d1b2a",
        ST_FG: "#60a5fa",
        ST_EDITOR_BG: "#1a2942",
        AI_PANEL_BG: "#1b263b",
        AI_TITLE_FG: "#60a5fa",
        AI_BTN_BG: "#2563eb",
        CONN_BG: "#0d1b2a",
        CONN_FG: "#e0f4ff",
        PIN_BG: "#1e3a5f",
        PIN_FG: "#e0f4ff",
    }
};

class ThemeManager {
    constructor(initialTheme = 'dark') {
        this.themeName = initialTheme in THEMES ? initialTheme : 'dark';
        this.currentTheme = { ...THEMES[this.themeName] };
    }

    setTheme(themeName) {
        if (this.themeName === themeName || !(themeName in THEMES)) return false;
        this.themeName = themeName;
        this.currentTheme = { ...THEMES[themeName] };
        this.applyCSS();
        return true;
    }

    get(key) {
        return this.currentTheme[key] || '#888';
    }

    isDark() {
        return this.themeName !== 'light';
    }

    applyCSS() {
        const root = document.documentElement;
        const t = this.currentTheme;
        for (const [key, value] of Object.entries(t)) {
            // Convert KEY_NAME to --key-name CSS variable
            const cssVar = '--' + key.toLowerCase().replace(/_/g, '-');
            root.style.setProperty(cssVar, value);
        }
        // Set dark mode class
        document.body.classList.toggle('theme-light', !this.isDark());
        document.body.classList.toggle('theme-dark', this.isDark());
    }
}

// Export
window.ThemeManager = ThemeManager;
window.THEMES = THEMES;
