// mqtt_comm.js v=8
// Cliente MQTT (WebSocket) para HiveMQ Cloud + parser ST: telemetria

class MQTTComm {
    constructor() {
        this.client       = null;
        this.isConnected  = false;
        this.deviceId     = '';
        this.topicRx      = '';
        this.topicTx      = '';
        this._connTimeout = null;

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

    connect(host, user, pass, deviceId) {
        if (typeof mqtt === 'undefined') {
            this._log('⚠️ Biblioteca MQTT não carregada — recarregue a página');
            return false;
        }
        this.deviceId = deviceId.toUpperCase().replace(/:/g, '');
        this.topicRx  = `plc/${this.deviceId}/rx`;
        this.topicTx  = `plc/${this.deviceId}/tx`;

        // HiveMQ Cloud usa 8884; EMQX usa 8084
        let wssPort = 8084; // Padrão EMQX e maioria dos brokers
        if (host.includes('hivemq.cloud')) {
            wssPort = 8884;
        }
        const url = `wss://${host}:${wssPort}/mqtt`;
        const clientId = 'plcweb_' + Math.random().toString(16).slice(2, 8);

        this._log(`Conectando: ${url}`);

        // Igual ao MQTT_Test que funcionou no Android:
        // não enviar username/password vazios — alguns brokers rejeitam silenciosamente
        const opts = {
            clientId,
            clean: true,
            reconnectPeriod: 0,        // Sem auto-reconecta — evita race condition na subscription
            connectTimeout: 15000,
            protocolVersion: 4,        // MQTT 3.1.1
            protocolId: 'MQTT',
            keepalive: 60,
            rejectUnauthorized: false
        };
        if (user) { opts.username = user; opts.password = pass; }

        this.client = mqtt.connect(url, opts);

        // Timeout visível: se em 15s nada acontecer, avisa o usuário
        this._connTimeout = setTimeout(() => {
            if (!this.isConnected) {
                this._log('⏱️ Tempo limite — verifique host, usuário, senha e se a porta 8884 não está bloqueada na sua rede');
                this.disconnect();
                if (this.onDisconnected) this.onDisconnected();
            }
        }, 15000);

        this.client.on('connect', () => {
            clearTimeout(this._connTimeout);
            this.isConnected = true;
            this.client.subscribe(this.topicRx, { qos: 1 }, (err) => {
                if (err) this._log(`❌ Subscribe falhou: ${err.message}`);
                else     this._log(`📥 Inscrito: ${this.topicRx}`);
            });
            this._log(`✅ Conectado | Device: ${this.deviceId}`);
            if (this.onConnected) this.onConnected();
        });

        this.client.on('message', (topic, message) => {
            const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);
            const text  = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
            this._log(`📨 msg [${bytes.length}b] ${text.slice(0, 60)}`);
            if (topic === this.topicRx) {
                if (this.onData) this.onData(bytes);
                this._processRaw(text);
            } else {
                this._log(`(tópico ignorado: ${topic})`);
            }
        });

        this.client.on('error', (e) => {
            clearTimeout(this._connTimeout);
            this._log(`❌ Erro: ${e.message || e}`);
        });

        this.client.on('close', () => {
            clearTimeout(this._connTimeout);
            this.isConnected = false;
            this._log('🔌 Desconectado');
            if (this.onDisconnected) this.onDisconnected();
        });

        this.client.on('offline', () => {
            this._log('📡 Sem rede — verifique sua conexão');
        });

        return true;
    }

    disconnect() {
        clearTimeout(this._connTimeout);
        if (this.client) { this.client.end(true); this.client = null; }
        this.isConnected = false;
    }

    // Loopback: publica mensagem ST: no próprio topicRx para testar recepção sem o ESP32
    sendTest() {
        if (!this.isConnected || !this.topicRx) return;
        const testMsg = 'ST:I:0FQ:03N0:1234\n';
        const bytes = new TextEncoder().encode(testMsg);
        let payload;
        if (typeof mqtt !== 'undefined' && mqtt.Buffer && mqtt.Buffer.from) {
            payload = mqtt.Buffer.from(bytes);
        } else {
            payload = bytes;
        }
        this._log('📡 Teste loopback → ' + this.topicRx);
        this.client.publish(this.topicRx, payload, { qos: 1 });
    }

    send(dataBytes) {
        if (!this.isConnected || !this.topicTx) return;
        // Fix para Android Chrome: mqtt.js prefere `Buffer` polifilado em vez de Uint8Array puro
        // Algumas versões do Chrome mobile falham silenciosamente ao enviar Uint8Array pelo WSS do mqtt.js
        let payload;
        if (typeof mqtt !== 'undefined' && mqtt.Buffer && mqtt.Buffer.from) {
            payload = mqtt.Buffer.from(dataBytes);
        } else {
            payload = dataBytes instanceof Uint8Array ? dataBytes : new Uint8Array(dataBytes);
        }
        
        this.client.publish(this.topicTx, payload, { qos: 1 });
    }

    // ---- Parser ST: ----
    // Mensagens MQTT são unidades completas — parse direto, sem buffer
    _processRaw(text) {
        if (!text || !text.includes('ST:')) return;
        // Split em blocos ST: (suporte a múltiplos blocos por mensagem)
        const blocks = text.split(/(?=ST:)/);
        for (const block of blocks) {
            if (block.trimStart().startsWith('ST:')) {
                try { this._parseBlock(block); } catch (_) { /* ignora bloco malformado */ }
            }
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
