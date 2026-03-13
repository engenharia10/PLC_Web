/**
 * Modulo para protocolo de comunicacao com PLC.
 * Alinhado ao protocolo binario do firmware e do desktop Python.
 */

class PLCProtocol {
    static MAGIC_COMMAND_1 = 0x55;
    static MAGIC_COMMAND_2 = 0xAA;
    static MAGIC_PROGRAM_1 = 0xAA;
    static MAGIC_PROGRAM_2 = 0x55;
    
    static PONG_MAGIC1 = 0xCC;
    static PONG_MAGIC2 = 0x33;

    // Comandos suportados pelo firmware
    static CMD_START = 0x01;
    static CMD_STOP = 0x02;
    static CMD_PING = 0x03;
    static CMD_SAVE_TO_FLASH = 0x10;
    static CMD_ERASE_FLASH = 0x11;
    static CMD_READ_FLASH = 0x12;
    
    // Status packet prefix
    static STATUS_MAGIC1 = 0xBB;
    static STATUS_MAGIC2 = 0x66;

    /**
     * Calcula checksum XOR dos dados
     */
    static calculateChecksum(dataArray) {
        let checksum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            checksum ^= dataArray[i];
        }
        return checksum;
    }

    /**
     * Cria pacote de COMANDO para o PLC.
     * Formato: [0x55][0xAA][SIZE_L][SIZE_H][PAYLOAD][CHECKSUM]
     * PAYLOAD[0] = cmd
     */
    static createCommandPacket(cmd, data = []) {
        const payload = [cmd, ...data];
        const payloadSize = payload.length;

        const packet = [
            this.MAGIC_COMMAND_1,
            this.MAGIC_COMMAND_2,
            payloadSize & 0xFF,          // Size low
            (payloadSize >> 8) & 0xFF,   // Size high
            ...payload
        ];

        // Adiciona checksum XOR no final
        const checksum = this.calculateChecksum(packet);
        packet.push(checksum);

        return new Uint8Array(packet);
    }

    /**
     * Cria pacote para carregar programa no PLC (upload do canvas)
     * Formato: [0xAA][0x55][SIZE_L][SIZE_H][...PROGRAM_DATA...][CHECKSUM]
     */
    static createLoadProgramPacket(programData) {
        const payloadSize = programData.length;
        
        const packet = [
            this.MAGIC_PROGRAM_1,
            this.MAGIC_PROGRAM_2,
            payloadSize & 0xFF,
            (payloadSize >> 8) & 0xFF,
            ...programData
        ];

        const checksum = this.calculateChecksum(packet);
        packet.push(checksum);

        return new Uint8Array(packet);
    }

    static createStartPacket() {
        return this.createCommandPacket(this.CMD_START);
    }

    static createStopPacket() {
        return this.createCommandPacket(this.CMD_STOP);
    }

    static createPingPacket() {
        return this.createCommandPacket(this.CMD_PING);
    }

    /**
     * Helper to decode string array from data
     */
    static bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
}
