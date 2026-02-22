import {
    createVirtualMachineBch,
    hexToBin,
    binToHex,
    decodeAuthenticationInstructions,
} from '@bitauth/libauth';

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
 * A Real VM Service using Libauth for consensus-valid Bitcoin Script execution.
 * Pre-calculates the trace for smooth UI stepping.
 */
export class DebuggerService {
    private state: DebuggerState = {
        stack: [],
        altStack: [],
        programCounter: 0,
        opcodeHistory: [],
        nextOpcode: '',
        isHalting: false
    };

    private trace: any[] = [];
    private traceIndex: number = 0;
    private decodedInstructions: any[] = [];

    async load(lockingHex: string, unlockingHex?: string) {
        if (!lockingHex) return this.state;

        try {
            const vminstance = createVirtualMachineBch();

            const lockingBytecode = hexToBin(lockingHex);
            const unlockingBytecode = unlockingHex
                ? hexToBin(unlockingHex)
                : new Uint8Array();

            this.decodedInstructions = decodeAuthenticationInstructions(lockingBytecode) as any[];

            // Create a program with full transaction context to satisfy Libauth types
            const program: any = {
                lockingBytecode,
                unlockingBytecode,
                inputIndex: 0,
                sourceOutputs: [{
                    satoshis: 1000n,
                    lockingBytecode
                }],
                transaction: {
                    version: 2,
                    locktime: 0,
                    inputs: [{
                        outpointIndex: 0,
                        outpointTransactionHash: new Uint8Array(32),
                        sequenceNumber: 0xffffffff,
                        unlockingBytecode,
                    }],
                    outputs: [{
                        satoshis: 500n,
                        lockingBytecode: new Uint8Array(),
                    }]
                }
            };

            // Fully evaluate and get trace
            this.trace = vminstance.debug(program);
            this.traceIndex = 0;

            this.updateStateFromTrace();

            this.state.opcodeHistory = ['[Real VM] Trace Loaded'];
            this.state.error = undefined;
        } catch (e: any) {
            this.state.error = e.message || "Failed to initialize VM";
            this.state.isHalting = true;
        }

        return this.state;
    }

    private updateStateFromTrace() {
        if (!this.trace || this.traceIndex >= this.trace.length) {
            this.state.isHalting = true;
            this.state.nextOpcode = 'END';
            return;
        }

        const current = this.trace[this.traceIndex];

        // Map Libauth state to our UI state
        // In Libauth v3, program state usually has 'stack' and 'alternateStack'
        this.state.stack = (current.stack || []).map((bin: Uint8Array) => binToHex(bin));
        this.state.altStack = (current.alternateStack || []).map((bin: Uint8Array) => binToHex(bin));
        this.state.programCounter = current.instructionPointer || 0;

        // peekOpcode logic: use pre-decoded instructions
        this.state.nextOpcode = this.peekOpcode(this.decodedInstructions, this.state.programCounter);

        // We are halting if we reached the last state in the trace
        if (this.traceIndex >= this.trace.length - 1) {
            this.state.isHalting = true;
        } else {
            this.state.isHalting = false;
        }
    }

    getState(): DebuggerState {
        return { ...this.state };
    }

    step(): DebuggerState {
        if (this.state.isHalting) return this.state;

        this.traceIndex++;
        this.updateStateFromTrace();

        this.state.opcodeHistory.push(`Step: ${this.traceIndex}`);
        if (this.state.opcodeHistory.length > 5) this.state.opcodeHistory.shift();

        return this.state;
    }

    private peekOpcode(instructions: any[], ip: number): string {
        if (!instructions || ip >= instructions.length) return 'END';
        const inst = instructions[ip];
        if (!inst) return 'END';
        return inst.opcode !== undefined ? `0x${inst.opcode.toString(16).toUpperCase().padStart(2, '0')}` : '???';
    }

    reset() {
        this.traceIndex = 0;
        this.updateStateFromTrace();
        this.state.opcodeHistory = ['[Real VM] Reset'];
    }

    private encodeSmallInt(n: number): string {
        if (n >= 1 && n <= 16) {
            return (0x50 + n).toString(16);
        }
        if (n === 0) return "00";
        throw new Error("Only small integers (0–16) supported in debugger for now.");
    }

    buildUnlockingFromNumbers(values: number[]): string {
        return values
            .slice()
            .reverse()
            .map(v => this.encodeSmallInt(v))
            .join('');
    }
}
