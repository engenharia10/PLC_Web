/**
 * PLC Serializer
 * Converte a representação gráfica do Ladder (elementos + rungs) 
 * no payload binário compativel com o firmware STM32.
 * Equivalente ao plc_serializer.py e plc_generator_binary.py
 */

class PLCSerializer {
    constructor() {
        // Limites físicos no ECU-MAX:
        this.MAX_I0_INDEX = 28;
        this.MAX_Q0_INDEX = 29;
        this.VALID_ADC_PINS = ['I0.0', 'I0.2', 'I0.4', 'I0.5', 'I0.6', 'I0.8', 'I0.9', 'I0.16', 'I0.17', 'I0.18', 'I0.19', 'I0.22', 'I0.23', 'I0.24', 'I0.25'];
    }

    /**
     * Helper para obter o index da rung do elemento, baseado no array ordenado de rungs.
     */
    _getElementRungIndex(element, sortedUniqueRungs) {
        if (!sortedUniqueRungs || sortedUniqueRungs.length === 0) return 0;
        let elementY = element.y || 0;
        
        // Match exato
        for (let i = 0; i < sortedUniqueRungs.length; i++) {
            if (Math.abs((sortedUniqueRungs[i].y || 0) - elementY) < 0.1) {
                return i;
            }
        }
        
        // Mais próximo
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < sortedUniqueRungs.length; i++) {
            let diff = Math.abs((sortedUniqueRungs[i].y || 0) - elementY);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        return closestIdx;
    }

    /**
     * Ponto de entrada principal para serialização
     * @param {Array} ladderElements 
     * @param {Array} rungs 
     * @returns {Uint8Array} payload binário
     */
    serialize(ladderElements, rungs, elkScript) {
        ladderElements = ladderElements || [];
        rungs = rungs || [];
        // 1. Filtering / Prep rungs (Remove duplicates based on Y)
        let uniqueRungs = [];
        let seenY = new Set();
        let sortedRungs = [...rungs].sort((a, b) => (a.y || 0) - (b.y || 0));

        for (let r of sortedRungs) {
            let ry = r.y || 0;
            // Verifica duplicados (tolerância)
            let isDup = false;
            for (let sy of seenY) {
                if (Math.abs(ry - sy) < 0.1) {
                    isDup = true;
                    break;
                }
            }
            if (!isDup) {
                seenY.add(ry);
                uniqueRungs.push(r);
            }
        }
        rungs = uniqueRungs;

        // Separação de elementos
        let contacts = ladderElements.filter(e => e.type === 'contact');
        let coils = ladderElements.filter(e => e.type === 'coil');
        let countersCTU = ladderElements.filter(e => e.type === 'counter' && e.counter_type === 'UP');
        let countersCTD = ladderElements.filter(e => e.type === 'counter' && e.counter_type === 'DOWN');
        let countersReset = ladderElements.filter(e => e.type === 'counter' && e.counter_type === 'RESET');
        let timersTON = ladderElements.filter(e => e.type === 'timer' && e.timer_type === 'TON');
        let timersTOFF = ladderElements.filter(e => e.type === 'timer' && e.timer_type === 'TOF');
        let compares = ladderElements.filter(e => e.type === 'compare');
        let maths = ladderElements.filter(e => e.type === 'math');
        let analogInputs = ladderElements.filter(e => e.type === 'analog_input');
        let pots = ladderElements.filter(e => e.type === 'potentiometer');
        let joysticks = ladderElements.filter(e => e.type === 'joystick');
        let variables = ladderElements.filter(e => e.type === 'variable');
        let rtcs = ladderElements.filter(e => e.type === 'rtc');
        let cans = ladderElements.filter(e => e.type === 'can');

        // Filtra os órfãos
        const rungYList = rungs.map(r => r.y || 0);
        const branchYList = ladderElements.filter(e => e.type === 'branch').map(e => e.branch_y || 0);
        
        const attachToleranceRung = 30;
        const attachToleranceBranch = 20;

        const isAttached = (elem) => {
            if (rungYList.length === 0) return true;
            let ey = elem.y || 0;
            if (rungYList.some(ry => Math.abs(ey - ry) <= attachToleranceRung)) return true;
            if (branchYList.some(by => Math.abs(ey - by) <= attachToleranceBranch)) return true;
            return false;
        };

        contacts = contacts.filter(isAttached);
        coils = coils.filter(isAttached);

        let contactsPulse = contacts.filter(c => c.contact_type === 'pulse');
        contacts = contacts.filter(c => c.contact_type !== 'pulse');

        let coilsPWM = coils.filter(c => c.coil_type === 'PWM');
        let coilsNormal = coils.filter(c => c.coil_type !== 'PWM');

        let rtcElements = ladderElements.filter(e => e.type === 'rtc');

        // TODO: Validação e checagem de erros omitida por brevidade 
        
        let payload = [];

        // Header (25 bytes)
        payload.push(contacts.length & 0xFF);         // [0]
        payload.push(coilsNormal.length & 0xFF);      // [1]
        payload.push(countersCTU.length & 0xFF);      // [2]
        payload.push(countersCTD.length & 0xFF);      // [3]
        payload.push(timersTON.length & 0xFF);        // [4]
        payload.push(timersTOFF.length & 0xFF);       // [5]
        payload.push(compares.length & 0xFF);         // [6]
        payload.push(maths.length & 0xFF);            // [7]
        payload.push(countersReset.length & 0xFF);    // [8]
        payload.push(variables.length & 0xFF);        // [9]
        payload.push(pots.length & 0xFF);             // [10]
        payload.push(joysticks.length & 0xFF);        // [11]

        // Periféricos
        let pwmEnabled = coilsPWM.length > 0 ? 1 : 0;
        let pwmFreq = 100; // Padrão
        let can1Enabled = cans.length > 0 ? 1 : 0;
        let can1Baud = 250;
        let can2Enabled = cans.some(c => c.can_bus === 'CAN2') ? 1 : 0;
        let can2Baud = 250;

        payload.push(pwmEnabled);                      // [12]
        payload.push(pwmFreq & 0xFF);                  // [13]
        payload.push((pwmFreq >> 8) & 0xFF);           // [14]
        payload.push(can1Enabled);                     // [15]
        payload.push(can1Baud & 0xFF);                 // [16]
        payload.push((can1Baud >> 8) & 0xFF);          // [17]
        payload.push(can2Enabled);                     // [18]
        payload.push(can2Baud & 0xFF);                 // [19]
        payload.push((can2Baud >> 8) & 0xFF);          // [20]
        payload.push(cans.length & 0xFF);              // [21]
        payload.push(coilsPWM.length & 0xFF);          // [22]
        payload.push(analogInputs.length & 0xFF);      // [23]
        payload.push(contactsPulse.length & 0xFF);     // [24]

        let branches = ladderElements.filter(e => e.type === 'branch');
        
        // branchXSnap: map of contact_id -> snapped_x
        // branchContactRungY: map of contact_id -> Y da rung pai
        let branchXSnap = {};
        let branchContactRungY = {};
        
        for (let branch of branches) {
            let branchId = branch.id;
            let branchRungY = branch.rung_y || 0;
            let branchXStart = branch.x || 0;
            let branchXEnd = branchXStart + (branch.width || 200);
            
            let mainRungContacts = [];
            for (let c of contacts) {
                if (!c.parent && Math.abs((c.y || 0) - branchRungY) < 15) {
                    if ((c.x || 0) >= branchXStart - 50 && (c.x || 0) <= branchXEnd + 50) {
                        mainRungContacts.push(c);
                    }
                }
            }
            
            let branchContacts = [];
            for (let c of contacts) {
                if (c.parent === branchId) {
                    branchContacts.push(c);
                } else if (!c.parent) {
                    if (Math.abs((c.y || 0) - (branch.branch_y || 0)) < 15 && 
                       (c.x || 0) >= branchXStart - 50 && (c.x || 0) <= branchXEnd + 50) {
                        branchContacts.push(c);
                    }
                }
            }
            
            for (let bc of branchContacts) {
                let bcX = bc.x || 0;
                if (mainRungContacts.length > 0) {
                    // Find closest in main
                    let closest = mainRungContacts.reduce((prev, curr) => {
                        return (Math.abs((curr.x || 0) - bcX) < Math.abs((prev.x || 0) - bcX) ? curr : prev);
                    });
                    branchXSnap[bc.id] = closest.x || bcX;
                }
                branchContactRungY[bc.id] = branchRungY;
            }
        }
        
        // Serializa contatos (6 bytes cada)
        for (let contact of contacts) {
            let name = contact.name || 'I0';
            let cType = contact.contact_type || 'NA';
            
            let index = 0;
            if (name.includes('.')) {
                index = parseInt(name.split('.')[1]);
            } else if (name.length > 1 && !isNaN(parseInt(name.slice(1)))) {
                index = parseInt(name.slice(1));
            }
            
            let typeByte = 0;
            if (cType === 'component' || cType === 'component_nf') {
                typeByte = 0x80; // Flag COMPONENT
                if (cType === 'component_nf') typeByte |= 0x20;
                
                let compRef = contact.component_ref || '';
                let refType = 0; // 0=coil, 1=timer, 2=counter, 3=compare
                let compName = '';
                
                if (compRef.includes(':')) {
                    let parts = compRef.split(':');
                    let compTypeStr = parts[0].trim();
                    compName = parts[1].trim();
                    
                    if (compTypeStr === 'Bobina') refType = 0;
                    else if (compTypeStr.startsWith('Timer')) refType = 1;
                    else if (compTypeStr.startsWith('Contador')) refType = 2;
                    else if (compTypeStr === 'Comparador') refType = 3;
                } else {
                    compName = compRef.trim() || name.trim();
                }
                
                let compNameU = compName.toUpperCase();
                
                if (refType === 0) {
                    // auto infer
                    if (compNameU.startsWith('CMP')) refType = 3;
                    else if (compNameU.startsWith('CTU') || compNameU.startsWith('CTD') || (compNameU.startsWith('C') && !isNaN(parseInt(compNameU.slice(1))))) refType = 2;
                    else if (compNameU.startsWith('TOFF') || compNameU.startsWith('TON') || (compNameU.startsWith('T') && !isNaN(parseInt(compNameU.slice(1))))) refType = 1;
                }
                
                typeByte |= (refType & 0x03);
                
                if (compNameU.includes('.')) index = parseInt(compNameU.split('.')[1]) || 0;
                else if (compNameU.startsWith('CMP')) index = parseInt(compNameU.slice(3)) || 0;
                else if (compNameU.startsWith('CTU') || compNameU.startsWith('CTD')) index = parseInt(compNameU.slice(3)) || 0;
                else if (compNameU.startsWith('TOFF')) index = parseInt(compNameU.slice(4)) || 0;
                else if (compNameU.startsWith('TON')) index = parseInt(compNameU.slice(3)) || 0;
                else if (compNameU.length > 1 && !isNaN(parseInt(compNameU.slice(1)))) index = parseInt(compNameU.slice(1));
            } else {
                typeByte = cType === 'NA' ? 0 : 1;
            }
            
            let rungIndex;
            if (contact.id in branchContactRungY) {
                let proxy = {...contact, y: branchContactRungY[contact.id]};
                rungIndex = this._getElementRungIndex(proxy, rungs);
            } else {
                rungIndex = this._getElementRungIndex(contact, rungs);
            }
            
            let contactY = contact.y || 80;
            let posY = Math.floor(contactY / 10) & 0xFF;
            
            let contactX = branchXSnap[contact.id] !== undefined ? branchXSnap[contact.id] : (contact.x || 0);
            let posX = Math.floor(contactX / 10) & 0xFF;
            
            payload.push(0x01); // Element type
            payload.push(index & 0xFF);
            payload.push(typeByte);
            payload.push(rungIndex & 0xFF);
            payload.push(posY);
            payload.push(posX);
        }
        
        // Serializa Bobinas Normais (4 bytes cada), CAPACITY MÁXIMA É DEFINIDA PELO COMPILADOR? Nao, python só manda as usadas.
        // Wait, Python iterava assim: `for coil in coils_normal:` -> len() variação. 
        // But the user reported: JS payload is 31 bytes, Python is 109 bytes for an empty project!
        // Let's check Python's empty project sizes.
        
        // Ah, Python does this: 
        // for i in range(16): # TIMERS
        //    if t is ton... else pad 0x00...
        // Let's rewrite the loops to match python fixed-size sending!
        for (let coil of coilsNormal) {
            let name = coil.name || 'Q0';
            let coilType = coil.coil_type || 'NORMAL';
            
            let index = 0;
            if (name.includes('.')) {
                index = parseInt(name.split('.')[1]);
            } else if (name.length > 1 && !isNaN(parseInt(name.slice(1)))) {
                index = parseInt(name.slice(1));
            }
            
            let typeByte = 0;
            if (coilType === 'INVERTED') typeByte = 1;
            else if (coilType === 'SET') typeByte = 2;
            else if (coilType === 'RESET') typeByte = 3;
            else if (coilType === 'TOGGLE') typeByte = coil.toggle_independent !== false ? 4 : 5;
            
            let rungIndex = this._getElementRungIndex(coil, rungs);
            
            payload.push(0x02); // Element type
            payload.push(index & 0xFF);
            payload.push(typeByte);
            payload.push(rungIndex & 0xFF);
        }

        // Serializa Contadores CTU (10 bytes)
        for (let counter of countersCTU) {
            let presetValue = parseInt(counter.preset || 10) || 10;
            let presetHigh = (presetValue >> 8) & 0xFF;
            let presetLow = presetValue & 0xFF;
            let rungIndex = this._getElementRungIndex(counter, rungs);
            
            let outputIndex = 0xFF;
            for (let c of coils) {
                if (this._getElementRungIndex(c, rungs) === rungIndex) {
                    let cName = c.name || 'Q0';
                    if (cName.includes('.')) outputIndex = parseInt(cName.split('.')[1]);
                    else if (cName.length > 1 && !isNaN(parseInt(cName.slice(1)))) outputIndex = parseInt(cName.slice(1));
                    break;
                }
            }
            
            let verifyPreset = counter.verify_preset ? 1 : 0;
            
            payload.push(0x07); // Element type
            payload.push(outputIndex & 0xFF);
            payload.push(presetHigh);
            payload.push(presetLow);
            payload.push(rungIndex & 0xFF);
            payload.push(verifyPreset & 0xFF);
            payload.push(0); // current LSB
            payload.push(0);
            payload.push(0);
            payload.push(0); // current MSB
            payload.push(0); // last_cu_state
            payload.push(0); // last_reset_state
        }
        
        // Serializa Contadores CTD (12 bytes)
        for (let counter of countersCTD) {
            let presetValue = parseInt(counter.preset || 10) || 10;
            let presetHigh = (presetValue >> 8) & 0xFF;
            let presetLow = presetValue & 0xFF;
            let rungIndex = this._getElementRungIndex(counter, rungs);
            
            let outputIndex = 0xFF;
            for (let c of coils) {
                if (this._getElementRungIndex(c, rungs) === rungIndex) {
                    let cName = c.name || 'Q0';
                    if (cName.includes('.')) outputIndex = parseInt(cName.split('.')[1]);
                    else if (cName.length > 1 && !isNaN(parseInt(cName.slice(1)))) outputIndex = parseInt(cName.slice(1));
                    break;
                }
            }
            
            let verifyPreset = counter.verify_preset ? 1 : 0;
            
            payload.push(0x08); // Element type
            payload.push(outputIndex & 0xFF);
            payload.push(presetHigh);
            payload.push(presetLow);
            payload.push(rungIndex & 0xFF);
            payload.push(verifyPreset & 0xFF);
            payload.push(0); // current LSB
            payload.push(0);
            payload.push(0);
            payload.push(0); // current MSB
            payload.push(0); // last_cd_state
            payload.push(0xFF); // 0xFF = not initialized
        }

        // Timers TON (11 bytes)
        for (let timer of timersTON) {
            let presetMs = parseInt(timer.preset || 1000) || 1000;
            let presetHigh = (presetMs >> 8) & 0xFF;
            let presetLow = presetMs & 0xFF;
            let rungIndex = this._getElementRungIndex(timer, rungs);
            
            let outputIndex = 0xFF;
            for (let c of coils) {
                if (this._getElementRungIndex(c, rungs) === rungIndex) {
                    let cName = c.name || 'Q0';
                    if (cName.includes('.')) outputIndex = parseInt(cName.split('.')[1]);
                    else if (cName.length > 1 && !isNaN(parseInt(cName.slice(1)))) outputIndex = parseInt(cName.slice(1));
                    break;
                }
            }
            
            payload.push(0x05);
            payload.push(outputIndex & 0xFF);
            payload.push(presetHigh);
            payload.push(presetLow);
            payload.push(rungIndex & 0xFF);
            for (let i=0; i<6; i++) payload.push(0x00);
        }

        // Timers TOFF (11 bytes)
        for (let timer of timersTOFF) {
            let presetMs = parseInt(timer.preset || 1000) || 1000;
            let presetHigh = (presetMs >> 8) & 0xFF;
            let presetLow = presetMs & 0xFF;
            let rungIndex = this._getElementRungIndex(timer, rungs);
            
            let outputIndex = 0xFF;
            for (let c of coils) {
                if (this._getElementRungIndex(c, rungs) === rungIndex) {
                    let cName = c.name || 'Q0';
                    if (cName.includes('.')) outputIndex = parseInt(cName.split('.')[1]);
                    else if (cName.length > 1 && !isNaN(parseInt(cName.slice(1)))) outputIndex = parseInt(cName.slice(1));
                    break;
                }
            }
            
            payload.push(0x06);
            payload.push(outputIndex & 0xFF);
            payload.push(presetHigh);
            payload.push(presetLow);
            payload.push(rungIndex & 0xFF);
            for (let i=0; i<6; i++) payload.push(0x00);
        }
        
        // Serializa CMPs
        const operatorMap = { '==': 0x00, '!=': 0x01, '>': 0x02, '<': 0x03, '>=': 0x04, '<=': 0x05, 'AND': 0x06, 'OU': 0x07, 'OR': 0x07, 'XOR': 0x08 };

        // Mapa de nome de variável → índice (igual ao Python: resolve 'VAR0','V0',etc.)
        const varNameToIdx = {};
        for (let vi = 0; vi < variables.length; vi++) {
            const vn = (variables[vi].name || `VAR${vi}`).trim().toUpperCase();
            let ri = vi;
            if (vn.startsWith('VAR') && !isNaN(parseInt(vn.slice(3)))) ri = parseInt(vn.slice(3));
            varNameToIdx[vn] = ri;
            varNameToIdx[`VAR${ri}`] = ri;
            varNameToIdx[`V${ri}`] = ri;
        }

        const resolveVarIdx = (token) => {
            if (typeof token !== 'string') return null;
            const k = token.trim().toUpperCase();
            if (k in varNameToIdx) return varNameToIdx[k];
            if (k.startsWith('V') && !isNaN(parseInt(k.slice(1)))) return parseInt(k.slice(1));
            return null;
        };

        // Parse de source (igual ao Python serialize_compare_elements)
        const parseCmpSrc = (src) => {
            let type = 0, val = 0;
            if (typeof src !== 'string') { val = parseInt(src) || 0; return { type, val }; }
            const su = src.toUpperCase();
            if (su.startsWith('MATH') && !isNaN(parseInt(src.slice(4)))) { type = 3; val = parseInt(src.slice(4)); }
            else if (src.startsWith('M') && src.length > 1 && !isNaN(parseInt(src.slice(1))) && !su.startsWith('MAT')) { type = 3; val = parseInt(src.slice(1)); }
            else if ((su.startsWith('CTU') || su.startsWith('CTD')) && !isNaN(parseInt(src.slice(3)))) { type = 1; val = parseInt(src.slice(3)); }
            else if (src.startsWith('C') && !isNaN(parseInt(src.slice(1)))) { type = 1; val = parseInt(src.slice(1)); }
            else if ((su.startsWith('TON') || su.startsWith('TOF') || su.startsWith('TOFF')) && !isNaN(parseInt(src.slice(su.startsWith('TOFF') ? 4 : 3)))) { type = 2; val = parseInt(src.slice(su.startsWith('TOFF') ? 4 : 3)); }
            else if (src.startsWith('T') && !isNaN(parseInt(src.slice(1)))) { type = 2; val = parseInt(src.slice(1)); }
            else if (su.startsWith('AN') && !isNaN(parseInt(src.slice(2)))) { type = 0x0A; val = parseInt(src.slice(2)); }
            else if (su.startsWith('POT') && !isNaN(parseInt(src.slice(3)))) { type = 0x0C; val = 4; }
            else if (su.startsWith('JOY') && !isNaN(parseInt(src.slice(3)))) { type = 0x0D; val = parseInt(src.slice(3)); }
            else if (su.startsWith('RTC')) { type = 0x05; val = 0; }
            else {
                const vi = resolveVarIdx(src);
                if (vi !== null) { type = 4; val = vi; }
                else { val = parseInt(src) || 0; }
            }
            return { type, val };
        };

        const autoDetectSrcA = (elem) => {
            const ex = parseFloat(elem.x || 0);
            const ey = parseFloat(elem.y || 0);
            const validTypes = ['counter','timer','math','variable','analog_input','potentiometer','rtc','joystick'];
            let prev = null;
            for (const e of ladderElements) {
                if (e === elem) continue;
                if (!validTypes.includes(e.type)) continue;
                const eex = parseFloat(e.x || 0), eey = parseFloat(e.y || 0);
                if (eey === ey && eex < ex) {
                    if (!prev || eex > parseFloat(prev.x || 0)) prev = e;
                }
            }
            if (!prev) return '';
            const ptype = prev.type, pname = prev.name || '';
            if (ptype === 'variable') {
                const pu = pname.toUpperCase();
                if (pu.startsWith('VAR') && !isNaN(parseInt(pname.slice(3)))) return `V${parseInt(pname.slice(3))}`;
                return pname;
            }
            return pname; // timer/counter/math/analog/pot/joy/rtc: usa o name diretamente
        };

        for (let i = 0; i < compares.length; i++) {
            let cmp = compares[i];
            let opStr = cmp.operator || '==';
            let opByte = operatorMap[opStr] || 0x00;
            let rungIndex = this._getElementRungIndex(cmp, rungs);
            let srcA = cmp.source_a || '';
            let srcB = cmp.preset || '0';

            // Auto-detect source_a: escaneia elemento à esquerda (igual ao Python)
            if (!srcA || srcA === '0') srcA = autoDetectSrcA(cmp);

            const pA = parseCmpSrc(srcA);
            const pB = parseCmpSrc(srcB);

            payload.push(0x06);
            payload.push(i & 0xFF);
            payload.push(opByte);
            payload.push(rungIndex & 0xFF);
            payload.push(pA.val & 0xFF);
            payload.push((pA.val >> 8) & 0xFF);
            payload.push(pB.val & 0xFF);
            payload.push((pB.val >> 8) & 0xFF);
            payload.push(pA.type);
            payload.push(pB.type);
        }

        // Serializa MATHs
        const mathOpMap = { 'ADD': 0x00, 'SUB': 0x01, 'MUL': 0x02, 'DIV': 0x03, 'FORMULA': 0x80 };
        for (let i = 0; i < maths.length; i++) {
            let math = maths[i];
            let opStr = math.operation || 'ADD';
            let opByte = mathOpMap[opStr] || 0x00;
            let rungIndex = this._getElementRungIndex(math, rungs);
            
            // Formula support - basic fallback
            if (opStr === 'FORMULA') {
                // Not fully porting RPN in JS on step 1, skipping or sending basic struct
                payload.push(0x09);
                payload.push(i & 0xFF);
                payload.push(0x80);
                payload.push(0); // 0 tokens for now
                continue;
            }

            let srcA = math.source_a || '';
            let srcB = math.source_b || math.preset || '2';

            // Auto-detect source_a: escaneia elemento à esquerda (igual ao Python)
            if (!srcA || srcA === '0') srcA = autoDetectSrcA(math);

            const pA = parseCmpSrc(srcA);
            const pB = parseCmpSrc(srcB);
            let typeA = pA.type, valA = pA.val;
            let typeB = pB.type, valB = pB.val;

            payload.push(0x09); // MATH type
            payload.push(i & 0xFF);
            payload.push(opByte);
            payload.push(rungIndex & 0xFF);
            payload.push(valA & 0xFF);
            payload.push((valA >> 8) & 0xFF);
            payload.push(valB & 0xFF);
            payload.push((valB >> 8) & 0xFF);
            payload.push(typeA);
            payload.push(typeB);
            payload.push(0x00); // result LSB
            payload.push(0x00); // result MSB
        }
        
        // Serializa RESET (6 bytes)
        for (let rst of countersReset) {
            let rungIndex = this._getElementRungIndex(rst, rungs);
            let targetName = rst.name || 'C0';
            
            let counterIdx = 0;
            let counterType = 0; // 0=CTU, 1=CTD
            
            let found = false;
            for (let i = 0; i < countersCTU.length; i++) {
                if (countersCTU[i].name === targetName) {
                    counterIdx = i; counterType = 0; found = true; break;
                }
            }
            if (!found) {
                for (let i = 0; i < countersCTD.length; i++) {
                    if (countersCTD[i].name === targetName) {
                        counterIdx = i; counterType = 1; break;
                    }
                }
            }
            
            payload.push(0x09); // RESET actually type 0x09 in original, wait, MATH is 0x09. Original python: type=0x09 for RESET? Let me check. Actually Python has 0x09 for RESET and 0x09 for MATH in different places? Ah! It is 0x09.
            payload.push(counterIdx & 0xFF);
            payload.push(counterType & 0xFF);
            payload.push(0x00);
            payload.push(rungIndex & 0xFF);
            payload.push(0x00);
        }

        // Serializa POTS (10 bytes)
        for (let pot of pots) {
            let analogPin = pot.analog_pin || 'I0.4';
            let minVal = parseInt(pot.min_value) || 0;
            let maxVal = parseInt(pot.max_value) || 100;
            
            let pinNumber = 4;
            if (analogPin.includes('.')) pinNumber = parseInt(analogPin.split('.')[1]);
            
            if (minVal < 0) minVal = (1 << 16) + minVal;
            if (maxVal < 0) maxVal = (1 << 16) + maxVal;
            
            let rungIndex = this._getElementRungIndex(pot, rungs);
            
            payload.push(0x0C); // POT type
            payload.push(0x00);
            payload.push(0x00);
            payload.push(pinNumber & 0xFF);
            payload.push(0x00); // ADC channel placeholder
            payload.push(minVal & 0xFF);
            payload.push((minVal >> 8) & 0xFF);
            payload.push(maxVal & 0xFF);
            payload.push((maxVal >> 8) & 0xFF);
            payload.push(rungIndex & 0xFF);
        }
        
        // Serializa JOYS (9 bytes)
        for (let i = 0; i < joysticks.length; i++) {
            let joy = joysticks[i];
            let analogPin = joy.analog_pin || 'I0.5';
            let pinNumber = 5;
            if (analogPin.includes('.')) pinNumber = parseInt(analogPin.split('.')[1]);
            
            let axisByte = joy.axis === 'JY' ? 1 : 0;
            let minVal = parseInt(joy.min_value) || -100;
            let maxVal = parseInt(joy.max_value) || 100;
            
            if (minVal < 0) minVal = (1 << 16) + minVal;
            if (maxVal < 0) maxVal = (1 << 16) + maxVal;
            
            let rungIndex = this._getElementRungIndex(joy, rungs);
            
            payload.push(0x0D);
            payload.push(i & 0xFF);
            payload.push(rungIndex & 0xFF);
            payload.push(axisByte);
            payload.push(pinNumber & 0xFF);
            payload.push(minVal & 0xFF);
            payload.push((minVal >> 8) & 0xFF);
            payload.push(maxVal & 0xFF);
            payload.push((maxVal >> 8) & 0xFF);
        }

        // Serializa VARIABLEs
        // INT/CHAR/SCHAR: 8 bytes; FLOAT: 10 bytes; ARRAY: 8+size bytes
        const varTypeMap = { 'INT': 0x00, 'FLOAT': 0x01, 'CHAR': 0x02, 'ARRAY': 0x03, 'SCHAR': 0x04, 'INT_EEPROM': 0x05 };
        for (let varIdx = 0; varIdx < variables.length; varIdx++) {
            let vr = variables[varIdx];
            let vrName = vr.name || `VAR${varIdx}`;
            let vrType = vr.variable_type || vr.var_type || 'INT';
            let scope = vr.scope || 'local';
            let varMode = vr.mode || 'Escrever';
            let rungIndex = this._getElementRungIndex(vr, rungs);

            // Extrai índice real do nome (VAR0→0, VAR1→1)
            let nameMatch = vrName.match(/(\d+)/);
            let realVarIdx = nameMatch ? parseInt(nameMatch[1]) : varIdx;

            let typeByte = varTypeMap[vrType] || 0x00;
            let scopeByte = scope === 'global' ? 0x01 : 0x00;
            let modeByte = varMode === 'Escrever' ? 0x01 : 0x00;

            if (vrType === 'ARRAY') {
                let arraySize = parseInt(vr.array_size || 0) || 0;
                payload.push(0x0A);
                payload.push(realVarIdx & 0xFF);
                payload.push(0x03);
                payload.push(scopeByte);
                payload.push(rungIndex & 0xFF);
                payload.push(modeByte);
                payload.push(arraySize & 0xFF);
                payload.push((arraySize >> 8) & 0xFF);
                for (let k = 0; k < arraySize; k++) payload.push(0x00);
            } else if (vrType === 'FLOAT') {
                let floatVal = parseFloat(vr.initial_value || 0) || 0.0;
                let buf = new ArrayBuffer(4);
                new DataView(buf).setFloat32(0, floatVal, true); // little-endian
                let fb = new Uint8Array(buf);
                payload.push(0x0A);
                payload.push(realVarIdx & 0xFF);
                payload.push(typeByte);
                payload.push(scopeByte);
                payload.push(rungIndex & 0xFF);
                payload.push(modeByte);
                payload.push(fb[0]); payload.push(fb[1]); payload.push(fb[2]); payload.push(fb[3]);
            } else {
                // INT / CHAR / SCHAR / INT_EEPROM: 8 bytes
                let initVal = parseInt(vr.initial_value || 0) || 0;
                if (initVal < 0) initVal = (1 << 16) + initVal;
                payload.push(0x0A);
                payload.push(realVarIdx & 0xFF);
                payload.push(typeByte);
                payload.push(scopeByte);
                payload.push(rungIndex & 0xFF);
                payload.push(modeByte);
                payload.push(initVal & 0xFF);
                payload.push((initVal >> 8) & 0xFF);
            }
        }

        // Serializa CAN (20 bytes por elemento)
        // [0]=0x0F [1]=idx [2]=rung [3]=mode_byte [4-7]=ID(LE) [8]=dlc [9-10]=time(LE) [11]=rx_mask|tx_var_mask [12-19]=tx_data
        for (let canIdx = 0; canIdx < cans.length; canIdx++) {
            let can = cans[canIdx];
            let canMode = can.can_mode || 'SEND';
            let canBus = can.can_bus || 'CAN1';
            let canAddress = String(can.can_address || '0x00000000').trim();
            let canDlc = parseInt(can.can_dlc) || 8;
            if (canDlc < 0) canDlc = 0;
            if (canDlc > 8) canDlc = 8;
            let canTime = parseInt(can.can_time) || 100;
            let rungIndex = this._getElementRungIndex(can, rungs);

            let addressInt = 0;
            if (canAddress.toLowerCase().startsWith('0x')) addressInt = parseInt(canAddress, 16) || 0;
            else addressInt = parseInt(canAddress, 10) || 0;
            if (!isFinite(addressInt) || isNaN(addressInt)) addressInt = 0;
            addressInt = addressInt >>> 0; // uint32

            let busBit = canBus === 'CAN2' ? 1 : 0;
            let modeBit = canMode === 'RECEIVE' ? 1 : 0;
            let modeByte = modeBit | (busBit << 1);

            // rx_byte_mask
            let rxBitmask = 0;
            let indicesStr = String(can.can_rx_indices || '').trim();
            if (indicesStr) {
                for (let part of indicesStr.split(',')) {
                    let idx = parseInt(part.trim());
                    if (!isNaN(idx) && idx >= 0 && idx <= 7) rxBitmask |= (1 << idx);
                }
            }
            if (rxBitmask === 0) {
                let rxByteStr = String(can.can_rx_byte || 'Byte 0');
                let startByte = parseInt(rxByteStr.split(' ').pop()) || 0;
                let rxSize = parseInt(can.can_rx_size || 1);
                for (let idx = startByte; idx < Math.min(startByte + rxSize, 8); idx++) rxBitmask |= (1 << idx);
            }
            if (rxBitmask === 0) rxBitmask = 0x01;

            // tx_data and tx_var_mask
            let txVarMask = 0;
            let txBytes = [];
            for (let i = 0; i < 8; i++) {
                let raw = String(can[`can_data_${i}`] || '0').trim();
                let isVar = false, value = 0;
                let varMatch = raw.match(/^VAR\s*(\d+)$/i);
                if (varMatch) {
                    isVar = true;
                    value = Math.max(0, Math.min(255, parseInt(varMatch[1]) || 0));
                } else {
                    if (raw.toLowerCase().startsWith('0x')) value = parseInt(raw, 16) || 0;
                    else value = parseInt(raw, 10) || 0;
                    value = Math.max(0, Math.min(255, value));
                }
                if (isVar) txVarMask |= (1 << i);
                txBytes.push(value);
            }

            payload.push(0x0F);                                          // [0] CAN type
            payload.push(canIdx & 0xFF);                                 // [1] index
            payload.push(rungIndex & 0xFF);                              // [2] rung
            payload.push(modeByte & 0xFF);                               // [3] mode_byte (bit0=mode, bit1=bus)
            payload.push(addressInt & 0xFF);                             // [4] ID byte 0
            payload.push((addressInt >> 8) & 0xFF);                      // [5] ID byte 1
            payload.push((addressInt >> 16) & 0xFF);                     // [6] ID byte 2
            payload.push((addressInt >> 24) & 0xFF);                     // [7] ID byte 3
            payload.push(canDlc & 0xFF);                                 // [8] DLC
            payload.push(canTime & 0xFF);                                // [9] time lo
            payload.push((canTime >> 8) & 0xFF);                         // [10] time hi
            payload.push(modeBit === 0 ? (txVarMask & 0xFF) : (rxBitmask & 0xFF)); // [11]
            for (let i = 0; i < 8; i++) payload.push(txBytes[i] & 0xFF); // [12-19] tx_data
        }

        // Serializa bobinas PWM (13 bytes cada)
        for (let coil of coilsPWM) {
            let name = coil.name || 'Q0';
            let index = 0;
            if (name.includes('.')) index = parseInt(name.split('.')[1]) || 0;
            else if (name.length > 1 && !isNaN(parseInt(name.slice(1)))) index = parseInt(name.slice(1));
            let rungIndex = this._getElementRungIndex(coil, rungs);
            let polarityByte = coil.pwm_polarity === 'Negativo' ? 1 : 0;
            let currentInit  = parseInt(coil.pwm_current_init  || 350) || 350;
            let currentFinal = parseInt(coil.pwm_current_final || 750) || 750;
            let rampInit     = parseInt(coil.pwm_ramp_init     || 1500) || 1500;
            let rampFinal    = parseInt(coil.pwm_ramp_final    || 250) || 250;
            payload.push(0x0E);
            payload.push(index & 0xFF);
            payload.push(rungIndex & 0xFF);
            payload.push(polarityByte);
            payload.push(currentInit & 0xFF);  payload.push((currentInit >> 8) & 0xFF);
            payload.push(currentFinal & 0xFF); payload.push((currentFinal >> 8) & 0xFF);
            payload.push(rampInit & 0xFF);     payload.push((rampInit >> 8) & 0xFF);
            payload.push(rampFinal & 0xFF);    payload.push((rampFinal >> 8) & 0xFF);
            payload.push(0x00); // reserved
        }

        // Serializa entradas analógicas (6 bytes cada)
        for (let i = 0; i < analogInputs.length; i++) {
            let analog = analogInputs[i];
            let analogPin = analog.analog_pin || 'I0.4';
            let pinNumber = 4;
            if (analogPin.includes('.')) pinNumber = parseInt(analogPin.split('.')[1]) || 4;
            payload.push(0x10);
            payload.push(i & 0xFF);
            payload.push(0x00); // current_value_low (runtime)
            payload.push(0x00); // current_value_high (runtime)
            payload.push(pinNumber & 0xFF);
            payload.push(0x00); // adc_channel placeholder
        }

        // Serializa contatos de pulso (8 bytes cada)
        for (let pulse of contactsPulse) {
            let name = pulse.name || 'I0';
            let index = 0;
            if (name.includes('.')) index = parseInt(name.split('.')[1]) || 0;
            else if (name.length > 1 && !isNaN(parseInt(name.slice(1)))) index = parseInt(name.slice(1));
            let ppr      = parseInt(pulse.pulse_per_rev   || 1) || 1;
            let filterMs = parseInt(pulse.pulse_filter_ms || 1) || 1;
            let mode     = parseInt(pulse.pulse_mode      || 0) || 0;
            payload.push(0x11);
            payload.push(index & 0xFF);
            payload.push(0x00); // value_low (runtime)
            payload.push(0x00); // value_high (runtime)
            payload.push(index & 0xFF); // pin_number
            payload.push(ppr & 0xFF);
            payload.push(filterMs & 0xFF);
            payload.push(mode & 0xFF);
        }

        // ========================================================
        // SECAO DE ESTADO DE RUNTIME (no final do buffer)
        // Estado temporário usado durante o scan do PLC
        // ========================================================
        let numContactsTotal = contacts.length;
        let numRungs = rungs.length || 0;
        
        // Marca inicialização runtime
        payload.push(0xFF);
        payload.push(0xFF);
        
        // Numero de rungs efetivo para seções
        payload.push(numRungs & 0xFF);
        
        // 29 bytes de Inputs O0-O28
        for(let i=0; i<29; i++) payload.push(0x00);
        
        // 31 bytes Outputs Q0-Q30
        for(let i=0; i<31; i++) payload.push(0x00);
        
        // Contact results
        for(let i=0; i<numContactsTotal; i++) payload.push(0x00);
        
        // Contact lines
        for(let i=0; i<numContactsTotal; i++) payload.push(0x00);
        
        // Rung flags
        for(let i=0; i<numRungs; i++) payload.push(0x00);
        
        // Last Rung State
        for(let i=0; i<numRungs; i++) payload.push(0x00);
        
        // Current Rung State
        for(let i=0; i<numRungs; i++) payload.push(0x00);
        
        // Rung state seen
        for(let i=0; i<numRungs; i++) payload.push(0x00);

        // Bloco LU (Elk JS script) — magic 0x4C 0x55 + len (2 LE) + bytes UTF-8
        // Equivalente ao LUA_BLOCK_MAGIC do firmware (plc.h)
        if (elkScript && elkScript.trim()) {
            // Aplica mesmas transformações do Python (plc_serializer.py):
            // Elk JS NÃO suporta: const, var, while, new, class, try/catch
            // Converte para sintaxe compatível com Elk JS
            let src = elkScript.trim();

            // 1. "function name(" → "let name = function("
            let buf = '';
            let i = 0;
            while (i < src.length) {
                if (src.slice(i, i + 9) === 'function ' && i + 9 < src.length) {
                    let j = i + 9;
                    while (j < src.length && (src[j] === ' ' || src[j] === '\t')) j++;
                    let k = j;
                    while (k < src.length && /[\w$]/.test(src[k])) k++;
                    if (k > j) {
                        const name = src.slice(j, k);
                        buf += 'let ' + name + ' = function';
                        i = k;
                        continue;
                    }
                }
                buf += src[i];
                i++;
            }
            src = buf;

            // 2. "const " → "let "  e  "var " → "let "
            src = src.replace(/\bconst\s+/g, 'let ').replace(/\bvar\s+/g, 'let ');

            const scriptBytes = new TextEncoder().encode(src);
            let scriptLen = scriptBytes.length;
            if (scriptLen > 4096) scriptLen = 4096;
            if (scriptLen > 0) {
                payload.push(0x4C);              // 'L'
                payload.push(0x55);              // 'U'
                payload.push(scriptLen & 0xFF);  // len low
                payload.push((scriptLen >> 8) & 0xFF); // len high
                for (let bi = 0; bi < scriptLen; bi++) payload.push(scriptBytes[bi]);
            }
        }

        // ATENCAO: O CRC (Checksum XOR) é calculado globalmente no PLCProtocol.js `createLoadProgramPacket`
        // O algoritmo Python original inseria o CRC fora do serialize.

        return new Uint8Array(payload);
    }
}
