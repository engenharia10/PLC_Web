/**
 * Módulo para comunicação Web Serial (USB)
 */
class SerialComm {
    constructor() {
        this.port = null;
        this.writer = null;
        this.reader = null;
        this.isConnected = false;
        this.keepReading = true;
        
        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onDataReceived = null;
        this.onError = null;
        
        // Accumulator buffer for binary packets
        this.rxBuffer = new Uint8Array(0);
    }

    get isAvailable() {
        return 'serial' in navigator;
    }

    /**
     * Abre dialog para selecionar porta e conecta
     */
    async connect(baudRate = 115200) {
        if (!this.isAvailable) {
            throw new Error("Web Serial API não é suportada por este navegador. Use Chrome ou Edge Desktop.");
        }

        try {
            // Requisita a porta do usuário
            this.port = await navigator.serial.requestPort();
            
            // Abre a porta
            await this.port.open({ baudRate: baudRate });
            
            this.isConnected = true;
            this.keepReading = true;
            
            if (this.onConnect) this.onConnect();

            // Inicia o loop de leitura
            this.readLoop();
            
            return true;
        } catch (error) {
            this.isConnected = false;
            this.port = null;
            throw error;
        }
    }

    /**
     * Tenta conectar em uma porta já pareada anteriormente (sem dialog)
     */
    async connectPersisted(baudRate = 115200) {
        if (!this.isAvailable) return false;
        
        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                this.port = ports[0];
                await this.port.open({ baudRate: baudRate });
                this.isConnected = true;
                this.keepReading = true;
                if (this.onConnect) this.onConnect();
                this.readLoop();
                return true;
            }
        } catch (e) {
            console.warn("Falha ao recuperar conexão serial anterior:", e);
        }
        return false;
    }

    async disconnect() {
        this.keepReading = false;
        this.isConnected = false;
        
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch(e) {}
        }
        
        if (this.writer) {
            try {
                this.writer.releaseLock();
            } catch(e) {}
        }

        if (this.port) {
            try {
                await this.port.close();
            } catch(e) {}
            this.port = null;
        }
        
        if (this.onDisconnect) this.onDisconnect();
    }

    /**
     * Loop assíncrono para ler dados continuamente
     */
    async readLoop() {
        while (this.port && this.port.readable && this.keepReading) {
            this.reader = this.port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) {
                        break; // Reader foi cancelado
                    }
                    if (value && value.length > 0) {
                        this.processReceivedData(value);
                    }
                }
            } catch (error) {
                if (this.onError) this.onError(error);
                break;
            } finally {
                this.reader.releaseLock();
            }
        }
        
        if (this.keepReading && this.isConnected) {
            this.disconnect();
        }
    }

    /**
     * Processa os fragmentos recebidos
     */
    processReceivedData(dataBytes) {
        if (this.onDataReceived) {
            this.onDataReceived(dataBytes);
        }
    }

    /**
     * Envia dados Uint8Array ou Array via Serial
     */
    async send(data) {
        if (!this.isConnected || !this.port || !this.port.writable) {
            throw new Error("Não conectado à porta serial");
        }

        let arrayData;
        if (data instanceof Uint8Array) {
            arrayData = data;
        } else if (Array.isArray(data)) {
            arrayData = new Uint8Array(data);
        } else if (typeof data === 'string') {
            arrayData = new TextEncoder().encode(data);
        } else {
            throw new Error("Tipo de dado não suportado para envio");
        }

        const writer = this.port.writable.getWriter();
        try {
            await writer.write(arrayData);
        } finally {
            writer.releaseLock();
        }
    }

    /**
     * Envia string adicionando quebra de linha (se quiser enviar texto puro)
     */
    async sendText(text) {
        await this.send(text + "\n");
    }
}
