/**
 * Módulo para comunicação BLE (Bluetooth Low Energy)
 * Usa o Nordic UART Service (NUS) para emular SPP
 */
class BLEComm {
    constructor() {
        this.device = null;
        this.server = null;
        this.txCharacteristic = null; // EPS32 -> PC
        this.rxCharacteristic = null; // PC -> ESP32
        
        this.isConnected = false;
        
        // NUS UUIDs
        this.SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
        this.CHAR_UUID_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // RX from our perspective
        this.CHAR_UUID_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // TX from our perspective

        // Callbacks
        this.onConnect = null;
        this.onDisconnect = null;
        this.onDataReceived = null;
        this.onError = null;
    }

    get isAvailable() {
        return navigator.bluetooth && true;
    }

    async connect() {
        if (!this.isAvailable) {
            throw new Error("Web Bluetooth API não é suportada por este navegador. Use Chrome ou Edge.");
        }

        try {
            // Solicita permissão e emparelhamento
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [this.SERVICE_UUID] }],
                optionalServices: [this.SERVICE_UUID]
                // Você também pode filtrar por nome: 
                // filters: [{ namePrefix: "ESP32" }], optionalServices: [this.SERVICE_UUID]
            });

            this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

            // Conecta ao servidor GATT
            this.server = await this.device.gatt.connect();

            // Pega o serviço Nordic UART
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);

            // Característica para receber dados (TX do ESP32)
            this.txCharacteristic = await service.getCharacteristic(this.CHAR_UUID_TX);
            await this.txCharacteristic.startNotifications();
            this.txCharacteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));

            // Característica para enviar dados (RX do ESP32)
            this.rxCharacteristic = await service.getCharacteristic(this.CHAR_UUID_RX);

            this.isConnected = true;
            if (this.onConnect) this.onConnect();

            return true;
        } catch (error) {
            this.disconnect();
            throw error;
        }
    }

    async disconnect() {
        if (this.txCharacteristic) {
            try {
                await this.txCharacteristic.stopNotifications();
                this.txCharacteristic.removeEventListener('characteristicvaluechanged', this.handleCharacteristicValueChanged.bind(this));
            } catch(e) {}
        }

        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }

        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.txCharacteristic = null;
        this.rxCharacteristic = null;

        if (this.onDisconnect) this.onDisconnect();
    }

    handleDisconnection() {
        this.isConnected = false;
        if (this.onDisconnect) this.onDisconnect();
    }

    handleCharacteristicValueChanged(event) {
        const value = event.target.value; // DataView
        // Converte DataView para Uint8Array
        const dataBytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        
        if (this.onDataReceived) {
            this.onDataReceived(dataBytes);
        }
    }

    /**
     * Envia os bytes com limite de 20 bytes por pacote de BLE (MTU seguro).
     */
    async send(data) {
        if (!this.isConnected || !this.rxCharacteristic) {
            throw new Error("BLE não está conectado.");
        }

        let arrayData;
        if (data instanceof Uint8Array) {
            arrayData = data;
        } else if (Array.isArray(data)) {
            arrayData = new Uint8Array(data);
        } else if (typeof data === 'string') {
            arrayData = new TextEncoder().encode(data);
        } else {
            throw new Error("Tipo de dado não suportado para envio BLE");
        }

        const max_chunk = 20; // MTU Limite conservador para BLE regular

        for (let i = 0; i < arrayData.length; i += max_chunk) {
            const chunk = arrayData.slice(i, i + max_chunk);
            await this.rxCharacteristic.writeValueWithoutResponse(chunk);
            // Pequeno atraso pode ser necessário dependendo do stack do sistema
            await new Promise(r => setTimeout(r, 10)); 
        }
    }

    async sendText(text) {
        await this.send(text + "\n");
    }
}
