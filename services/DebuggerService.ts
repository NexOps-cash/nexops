
import { ContractArtifact } from './compilerService';

export interface DebuggerState {
    stack: string[]; // Hex strings
    altStack: string[];
    programCounter: number;
    opcodeHistory: string[];
    nextOpcode: string;
    isHalting: boolean;
    error?: string;
}

/**
 * A Mock VM Service that approximates Bitcoin Script execution for visualization.
 * NOTE: This is NOT a consensus-valid parser. It is for UI demo purposes.
 */
export class DebuggerService {
    private bytecode: Uint8Array = new Uint8Array(0);
    private state: DebuggerState = {
        stack: [],
        altStack: [],
        programCounter: 0,
        opcodeHistory: [],
        nextOpcode: '',
        isHalting: false
    };

    load(bytecodeHex: string) {
        // Convert hex to byte array
        if (!bytecodeHex) {
            this.bytecode = new Uint8Array(0);
        } else {
            // Simple hex parse
            const matches = bytecodeHex.match(/.{1,2}/g);
            this.bytecode = new Uint8Array(matches ? matches.map(byte => parseInt(byte, 16)) : []);
        }

        this.state = {
            stack: [],
            altStack: [],
            programCounter: 0,
            opcodeHistory: [],
            nextOpcode: this.peekOpcode(0),
            isHalting: false
        };

        return this.state;
    }

    getState(): DebuggerState {
        return { ...this.state };
    }

    step(): DebuggerState {
        if (this.state.isHalting || this.state.programCounter >= this.bytecode.length) {
            this.state.isHalting = true;
            return this.state;
        }

        const pc = this.state.programCounter;
        const op = this.bytecode[pc];

        // Advance PC initially (args might advance it further)
        let nextPc = pc + 1;
        let opName = `OP_UNKNOWN(0x${op.toString(16)})`;
        let stackPush: string | null = null;

        // -- Mock Logic: Handle common opcodes --

        // Push Data (0x01 - 0x4b: 1-75 bytes)
        // 0x01-0x4b are direct pushes.
        if (op >= 0x01 && op <= 0x4b) {
            const len = op;
            // Check bounds
            if (pc + 1 + len <= this.bytecode.length) {
                const data = this.bytecode.slice(pc + 1, pc + 1 + len);
                stackPush = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
                opName = `PUSH(${len})`;
                nextPc += len;
            } else {
                this.state.error = "Unexpected EOF reading push data";
                this.state.isHalting = true;
                return this.state;
            }
        }
        else if (op === 0x00) { opName = 'OP_0'; stackPush = '00'; }
        else if (op === 0x51) { opName = 'OP_1'; stackPush = '01'; }
        else if (op === 0x52) { opName = 'OP_2'; stackPush = '02'; }
        // Arithmetic
        else if (op === 0x93) { // OP_ADD
            opName = 'OP_ADD';
            if (this.state.stack.length >= 2) {
                const a = parseInt(this.state.stack.pop() || '0', 16);
                const b = parseInt(this.state.stack.pop() || '0', 16);
                stackPush = (a + b).toString(16);
            }
        }
        else if (op === 0x87) { // OP_EQUAL
            opName = 'OP_EQUAL';
            if (this.state.stack.length >= 2) {
                const a = this.state.stack.pop();
                const b = this.state.stack.pop();
                stackPush = (a === b) ? '01' : '00';
            }
        }
        else if (op === 0xa9) {
            opName = 'OP_HASH160'; /* Mock: pop 1, push hash */
            if (this.state.stack.length > 0) {
                this.state.stack.pop();
                stackPush = 'dead...beef'; // Mock hash
            }
        }
        else if (op === 0xac) {
            opName = 'OP_CHECKSIG';
            // Consume sig and pubkey
            if (this.state.stack.length >= 2) {
                this.state.stack.pop();
                this.state.stack.pop();
                stackPush = '01'; // Always valid in simulation
            }
        }

        // Apply stack effect
        if (stackPush !== null) {
            this.state.stack.push(stackPush);
        }

        // Update History
        this.state.opcodeHistory.push(opName);
        if (this.state.opcodeHistory.length > 5) this.state.opcodeHistory.shift();

        // Advance
        this.state.programCounter = nextPc;
        this.state.nextOpcode = this.peekOpcode(this.state.programCounter);

        return this.state;
    }

    private peekOpcode(pc: number): string {
        if (pc >= this.bytecode.length) return 'END';
        const op = this.bytecode[pc];
        // Return friendly name if known lookahead, else hex
        return `0x${op.toString(16).padStart(2, '0')}`;
    }

    reset() {
        this.state.programCounter = 0;
        this.state.stack = [];
        this.state.altStack = [];
        this.state.isHalting = false;
        this.state.error = undefined;
        this.state.nextOpcode = this.peekOpcode(0);
    }
}
