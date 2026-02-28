import { EventEmitter } from 'events';

export interface WSMessage {
    type: 'intent' | 'update' | 'success' | 'error';
    // intent (NexOps -> External)
    prompt?: string;
    history?: any[];

    // update (External -> NexOps)
    stage?: string;
    status?: string;
    message?: string;
    attempt?: number;

    // success (External -> NexOps)
    data?: {
        code: string;
        contract_name: string;
        toll_gate: {
            passed: boolean;
            score: number;
            violations: string[];
        };
        intent_model: {
            contract_type: string;
            features: string[];
        };
        fallback_used?: boolean;
        metadata?: {
            lint_soft_fail?: boolean;
            soft_fail_count?: number;
        };
    };

    // context (BYOK)
    context?: {
        groq_key?: string;
        openrouter_key?: string;
        security_level?: 'low' | 'medium' | 'high';
        use_rag?: boolean;
    };

    // error (External -> NexOps)
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

class WebSocketService extends EventEmitter {
    private socket: WebSocket | null = null;
    private url: string = 'ws://localhost:3005/ws/generate'; // Updated to user-specified port
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;

    constructor() {
        super();
    }

    connect(url?: string) {
        if (url) this.url = url;

        try {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                console.log('🚀 MCP WebSocket Connected');
                this.reconnectAttempts = 0;
                this.emit('connected');
            };

            this.socket.onmessage = (event) => {
                try {
                    const data: WSMessage = JSON.parse(event.data);
                    console.log("🛰️ Incoming WebSocket Message:", data);
                    this.emit('message', data);

                    if (data.type === 'success') {
                        this.emit('generation_complete', data);
                    }
                } catch (e) {
                    console.error('Failed to parse WS message', e);
                }
            };

            this.socket.onclose = () => {
                console.log('🔌 MCP WebSocket Disconnected');
                this.emit('disconnected');
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket Error:', error);
                this.emit('error', error);
            };
        } catch (e) {
            console.error('Connection failed:', e);
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            setTimeout(() => this.connect(), 3000);
        }
    }

    sendIntent(prompt: string, history: any[] = [], context?: any) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return false;
        }

        const payload: WSMessage = {
            type: 'intent',
            prompt,
            history,
            context
        };

        this.socket.send(JSON.stringify(payload));
        return true;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    isConnected() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
}

export const websocketService = new WebSocketService();
