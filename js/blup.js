/**
 * BlupSender — Envio BLUP via Web Serial/BLE
 * Usa porta Serial independente (não depende do SerialComm principal).
 * Compatível com bootloader STM32 (F105/F407).
 */
class BlupSender {
    constructor() {
        this._port   = null;
        this._reader = null;
        this._rxBuf  = [];
        this._reading = false;
        this._bridgeSeq = 0;
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    _crc16(buf) {
        let crc = 0;
        for (let i = 0; i < buf.length; i++) {
            crc ^= (buf[i] << 8);
            for (let j = 0; j < 8; j++)
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        }
        return crc & 0xFFFF;
    }

    _crc32(buf) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < buf.length; i++) {
            crc ^= buf[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
            }
        }
        return (~crc) >>> 0;
    }

    /** Abre porta Serial dedicada para BLUP (mostra seletor ao usuário). */
    async openPort(baudRate = 115200) {
        this._port = await navigator.serial.requestPort();
        await this._port.open({ baudRate });
        this._rxBuf   = [];
        this._reading = true;
        this._bleComm = null;
        this._timeout = 6000;
        this._startReadLoop();
    }

    /** Usa BLE (NUS) como canal para o BLUP. */
    openBLE(bleComm) {
        this._bleComm = bleComm;
        this._port    = null;
        this._rxBuf   = [];
        this._reading = false;
        this._bridgeSeq = 0;
        this._timeout = 30000; // BLE é mais lento — timeout generoso
        this._origBleData = bleComm.onDataReceived;
        bleComm.onDataReceived = (bytes) => {
            for (const b of bytes) this._rxBuf.push(b);
        };
    }

    async closePort() {
        this._reading = false;
        if (this._reader) {
            try { await this._reader.cancel(); } catch (_) {}
            try { this._reader.releaseLock(); } catch (_) {}
            this._reader = null;
        }
        if (this._port) {
            try { await this._port.close(); } catch (_) {}
            this._port = null;
        }
        if (this._bleComm) {
            this._bleComm.onDataReceived = this._origBleData;
            this._bleComm = null;
        }
    }

    /** Loop de leitura em background (apenas para Serial). */
    async _startReadLoop() {
        while (this._reading && this._port?.readable) {
            this._reader = this._port.readable.getReader();
            try {
                while (this._reading) {
                    const { value, done } = await this._reader.read();
                    if (done) break;
                    if (value) for (const b of value) this._rxBuf.push(b);
                }
            } catch (_) {
            } finally {
                try { this._reader.releaseLock(); } catch (_) {}
            }
        }
    }

    async _write(data) {
        if (this._bleComm) {
            if (typeof this._bleComm.sendFast === 'function') {
                await this._bleComm.sendFast(data);
            } else {
                await this._bleComm.send(data);
            }
        } else {
            const writer = this._port.writable.getWriter();
            try { await writer.write(data); } finally { writer.releaseLock(); }
        }
    }

    /** Aguarda byte de controle esperado no buffer; descarta lixo. */
    async _waitCtrl(expects, timeoutMs) {
        timeoutMs = timeoutMs ?? this._timeout ?? 6000;
        const CTRL = [0x01, 0x02, 0x04, 0x06, 0x15, 0x18, 0x43];
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            for (let i = 0; i < this._rxBuf.length; i++) {
                const b = this._rxBuf[i];
                if (CTRL.includes(b)) {
                    this._rxBuf.splice(i, 1);
                    i--;  // corrige índice após remoção
                    if (b === 0x18) throw new Error('Cancelado pelo dispositivo (CAN)');
                    if (expects.includes(b)) return b;
                }
            }
            await this._sleep(10);
        }
        throw new Error(`Timeout aguardando resposta do bootloader (${expects.map(x=>'0x'+x.toString(16)).join('/')})`);
    }

    _buildBlFrame(cmd, seq, payload) {
        const SOF1 = 0x42, SOF2 = 0x4C;
        const len = payload.length;
        const out = new Uint8Array(len + 11);
        out[0] = SOF1; out[1] = SOF2;
        out[2] = cmd & 0xFF;
        out[3] = (seq >> 8) & 0xFF;
        out[4] = seq & 0xFF;
        out[5] = (len >> 8) & 0xFF;
        out[6] = len & 0xFF;
        out.set(payload, 7);
        const crc = this._crc32(out.slice(2, 7 + len));
        out[7 + len] = (crc >>> 24) & 0xFF;
        out[8 + len] = (crc >>> 16) & 0xFF;
        out[9 + len] = (crc >>> 8) & 0xFF;
        out[10 + len] = crc & 0xFF;
        return out;
    }

    async _waitBlResp(seq, expectCmd, timeoutMs) {
        const SOF1 = 0x42, SOF2 = 0x4C;
        const ACK = 0x90, NACK = 0x91;
        timeoutMs = timeoutMs ?? this._timeout ?? 6000;
        const t0 = Date.now();

        while (Date.now() - t0 < timeoutMs) {
            for (let i = 0; i + 12 < this._rxBuf.length; i++) {
                if (this._rxBuf[i] !== SOF1 || this._rxBuf[i + 1] !== SOF2) continue;
                const cmd = this._rxBuf[i + 2];
                const rseq = (this._rxBuf[i + 3] << 8) | this._rxBuf[i + 4];
                const len = (this._rxBuf[i + 5] << 8) | this._rxBuf[i + 6];
                const frameLen = 2 + 1 + 2 + 2 + len + 4;
                if (i + frameLen > this._rxBuf.length) break;

                const frame = this._rxBuf.slice(i, i + frameLen);
                const crcRx = (
                    (frame[frameLen - 4] << 24) |
                    (frame[frameLen - 3] << 16) |
                    (frame[frameLen - 2] << 8)  |
                     frame[frameLen - 1]
                ) >>> 0;
                const crcCalc = this._crc32(frame.slice(2, frameLen - 4)) >>> 0;
                this._rxBuf.splice(i, frameLen);
                if (crcRx !== crcCalc) continue;
                if (cmd !== ACK && cmd !== NACK) continue;
                if (rseq !== seq) continue;
                const ocmd = len >= 1 ? frame[7] : 0xFF;
                const code = len >= 2 ? frame[8] : 0xFF;
                if (ocmd !== expectCmd) continue;
                return { ack: cmd === ACK, code };
            }
            await this._sleep(5);
        }
        const rxSnapshot = this._rxBuf.slice(0, 32).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        this._onLog?.(`BLUP timeout seq=${seq} — rxBuf[0..32]: [${rxSnapshot || 'vazio'}]`, '#f59e0b');
        throw new Error(`Timeout resposta BLUP (seq=${seq})`);
    }

    async _sendBlCmd(cmd, seq, payload, retries = 5, timeoutMs = 3000) {
        const frame = this._buildBlFrame(cmd, seq, payload || new Uint8Array(0));
        for (let r = 0; r < retries; r++) {
            this._onLog?.(`BLUP TX cmd=0x${cmd.toString(16)} seq=${seq} tentativa ${r + 1}/${retries}`, '#64748b');
            await this._write(frame);
            try {
                const resp = await this._waitBlResp(seq, cmd, timeoutMs);
                if (resp.ack) {
                    this._onLog?.(`BLUP ACK cmd=0x${cmd.toString(16)} seq=${seq} code=${resp.code}`, '#4ade80');
                    return;
                }
                this._onLog?.(`BLUP NACK cmd=0x${cmd.toString(16)} seq=${seq} code=${resp.code}`, '#f59e0b');
            } catch (e) {
                this._onLog?.(`BLUP timeout cmd=0x${cmd.toString(16)} seq=${seq}`, '#f59e0b');
                if (r >= retries - 1) throw e;
            }
            await this._sleep(15);
        }
        throw new Error(`BLUP NACK persistente cmd=0x${cmd.toString(16)} seq=${seq}`);
    }

    /**
     * Executa transferência BLUP.
     * Requer que openPort() tenha sido chamado antes.
     * @param {Uint8Array} fileData
     * @param {string}     fileName
     * @param {Function}   onProgress(sent, total)
     * @param {Function}   onLog(msg, color)
     */
    async send(fileData, fileName, onProgress, onLog, onStatus) {
        this._onLog = onLog;  // para debug handler do BLE
        const CMD_HELLO = 0x01, CMD_BEGIN = 0x02, CMD_DATA = 0x03, CMD_END = 0x04;
        const isBLE = !!this._bleComm;
        const CHUNK = 256;
        const log    = (m,c) => onLog?.(m,c);
        const prog   = (s,t) => onProgress?.(s,t);
        const status = (icon,m,c) => onStatus?.(icon,m,c);
        log(`Modo: ${isBLE ? 'BLE (BLUP v1)' : 'Serial (BLUP v1)'}`, '#94a3b8');
        log(`Canal: bleComm=${!!this._bleComm}, port=${!!this._port}`, '#64748b');

        status('🔄', 'Sincronizando BLUP...', '#fbbf24');
        const fwCrc32 = this._crc32(fileData) >>> 0;
        let seq = 0;
        await this._sendBlCmd(CMD_HELLO, seq++, new Uint8Array(0), 10, 2500);

        status('📤', 'Enviando BEGIN...', '#60a5fa');
        const begin = new Uint8Array(8);
        const dv = new DataView(begin.buffer);
        dv.setUint32(0, fileData.length, true);
        dv.setUint32(4, fwCrc32, true);
        await this._sendBlCmd(CMD_BEGIN, seq++, begin, 10, 5000);

        const total = fileData.length;
        let sent = 0;
        while (sent < total) {
            const chunk = fileData.slice(sent, sent + CHUNK);
            await this._sendBlCmd(CMD_DATA, seq++, chunk, 8, 3500);
            sent += chunk.length;
            prog(sent, total);
            status('📤', `Enviando... ${Math.round(sent / total * 100)}%`, '#60a5fa');
        }

        status('⏳', 'Finalizando (END)...', '#94a3b8');
        await this._sendBlCmd(CMD_END, seq++, new Uint8Array(0), 10, 4000);
        log('BLUP concluído com ACK ✔', '#88ffcc');
        prog(total, total);
    }
}

window.BlupSender = BlupSender;
window.BLUPSender = BlupSender; // alias opcional


