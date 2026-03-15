// mqtt_comm.js v=1
// Cliente MQTT (WebSocket) para HiveMQ Cloud + parser ST: telemetria

class MQTTComm {
    constructor() {
        this.client       = null;
        this.isConnected  = false;
        this.deviceId     = '';
        this.topicRx      = '';
        this.topicTx      = '';
        this._rxBuffer    = '';

        // Callbacks
        this.onConnected     = null; // ()
        this.onDisconnected  = null; // ()
        this.onData          = null; // (dataBytes: Uint8Array)
        this.onStateUpdate   = null; // (state: object)
        this.onLog           = null; // (msg: string)

        // Estado parsed
        this.state = {
            inputs:   0,  // bitmask 32 bits
            outputs:  0,
            timers_ton:  [],
            timers_toff: [],
            ctu:  [],
            ctd:  [],
            cmp:  [],
            vars: [],
            math: [],
            adc:  [],
            pot:  [],
            joy:  [],
            can:  [],
            rtc:  '',
            raw:  ''
        };
    }

    // HiveMQ Cloud: WebSocket TLS porta 8884
    connect(host, user, pass, deviceId) {
        if (typeof mqtt === 'undefined') {
            this._log('mqtt.js não carregado');
            return;
        }
        this.deviceId = deviceId.toUpperCase().replace(/:/g, '');
        this.topicRx  = `plc/${this.deviceId}/rx`;
        this.topicTx  = `plc/${this.deviceId}/tx`;

        const url = `wss://${host}:8884/mqtt`;
        const clientId = 'plcweb_' + Math.random().toString(16).slice(2, 8);

        this.client = mqtt.connect(url, {
            clientId,
            username: user,
            password: pass,
            clean: true,
            reconnectPeriod: 3000,
            connectTimeout: 10000
        });

        this.client.on('connect', () => {
            this.isConnected = true;
            this.client.subscribe(this.topicRx, { qos: 0 });
            this._log(`MQTT conectado | Device: ${this.deviceId}`);
            if (this.onConnected) this.onConnected();
        });

        this.client.on('message', (topic, message) => {
            if (topic === this.topicRx) {
                if (this.onData) this.onData(message);
                this._processRaw(new TextDecoder().decode(message));
            }
        });

        this.client.on('error', (e) => {
            this._log(`MQTT erro: ${e.message}`);
        });

        this.client.on('close', () => {
            this.isConnected = false;
            this._log('MQTT desconectado');
            if (this.onDisconnected) this.onDisconnected();
        });
    }

    disconnect() {
        if (this.client) { this.client.end(true); this.client = null; }
        this.isConnected = false;
    }

    send(dataBytes) {
        if (!this.isConnected || !this.topicTx) return;
        // Passa Uint8Array direto — mqtt.js aceita no browser sem Buffer global
        const payload = dataBytes instanceof Uint8Array ? dataBytes : new Uint8Array(dataBytes);
        this.client.publish(this.topicTx, payload, { qos: 1 });
    }

    // ---- Parser ST: ----
    _processRaw(text) {
        this._rxBuffer += text;

        // Processa todos os blocos completos (dois ST: consecutivos)
        let idx;
        while ((idx = this._rxBuffer.indexOf('ST:', 3)) !== -1) {
            const block = this._rxBuffer.slice(0, idx);
            this._rxBuffer = this._rxBuffer.slice(idx);
            if (block.includes('ST:')) this._parseBlock(block);
        }

        // Flush por timeout: garante que o último/único pacote seja processado
        // mesmo que não chegue um segundo ST: logo em seguida (ex: Android com
        // pacotes espaçados ou conexão lenta)
        clearTimeout(this._flushTimer);
        this._flushTimer = setTimeout(() => {
            if (this._rxBuffer.includes('ST:')) {
                this._parseBlock(this._rxBuffer);
                this._rxBuffer = '';
            }
        }, 300);

        // Flush imediato se buffer muito grande
        if (this._rxBuffer.length > 2048) {
            clearTimeout(this._flushTimer);
            this._parseBlock(this._rxBuffer);
            this._rxBuffer = '';
        }
    }

    _parseBlock(text) {
        const s = this.state;
        s.raw = text;

        // I: bitmask entradas
        const mI = text.match(/I:([0-9A-Fa-f]+)/);
        if (mI) s.inputs = parseInt(mI[1], 16);

        // Q: bitmask saídas
        const mQ = text.match(/Q:([0-9A-Fa-f]+)/);
        if (mQ) s.outputs = parseInt(mQ[1], 16);

        // N<idx>: timers TON
        for (const m of text.matchAll(/N(\d+):([\d,]+)/g))
            this._fillArray(s.timers_ton, parseInt(m[1]), m[2].split(',').map(Number));

        // F<idx>: timers TOFF
        for (const m of text.matchAll(/F(\d+):([\d,]+)/g))
            this._fillArray(s.timers_toff, parseInt(m[1]), m[2].split(',').map(Number));

        // U<idx>: CTU
        for (const m of text.matchAll(/U(\d+):(-?[\d,]+)/g))
            this._fillArray(s.ctu, parseInt(m[1]), m[2].split(',').map(Number));

        // D<idx>: CTD
        for (const m of text.matchAll(/D(\d+):(-?[\d,]+)/g))
            this._fillArray(s.ctd, parseInt(m[1]), m[2].split(',').map(Number));

        // K<idx>: CMP
        for (const m of text.matchAll(/K(\d+):(-?[\d,]+)/g))
            this._fillArray(s.cmp, parseInt(m[1]), m[2].split(',').map(Number));

        // V<idx>: VARS
        for (const m of text.matchAll(/V(\d+):(-?[\d,]+)/g))
            this._fillArray(s.vars, parseInt(m[1]), m[2].split(',').map(Number));

        // M<idx>: MATH
        for (const m of text.matchAll(/M(\d+):(-?[\d,]+)/g))
            this._fillArray(s.math, parseInt(m[1]), m[2].split(',').map(Number));

        // A<idx>: ADC
        for (const m of text.matchAll(/A(\d+):([\d,]+)/g))
            this._fillArray(s.adc, parseInt(m[1]), m[2].split(',').map(Number));

        // P<idx>: POT
        for (const m of text.matchAll(/P(\d+):(-?[\d,]+)/g))
            this._fillArray(s.pot, parseInt(m[1]), m[2].split(',').map(Number));

        // J<idx>: JOY
        for (const m of text.matchAll(/J(\d+):(-?[\d,]+)/g))
            this._fillArray(s.joy, parseInt(m[1]), m[2].split(',').map(Number));

        // RTC
        const mRTC = text.match(/RTC=(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        if (mRTC) s.rtc = mRTC[1];

        if (this.onStateUpdate) this.onStateUpdate({ ...s });
    }

    _fillArray(arr, startIdx, values) {
        for (let i = 0; i < values.length; i++) {
            arr[startIdx + i] = values[i];
        }
    }

    _log(msg) {
        if (this.onLog) this.onLog(msg);
    }
}
