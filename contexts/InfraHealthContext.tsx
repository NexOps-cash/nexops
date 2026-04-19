import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { supabase } from '../lib/supabase';
import {
    getElectrumConnectionSnapshot,
    subscribeElectrumConnection,
    probeElectrumConnection,
    ELECTRUM_FALLBACK_SERVERS,
} from '../services/blockchainService';

export type HealthState = 'ok' | 'degraded' | 'down' | 'unknown';

export interface InfraHealthValue {
    electrum: {
        status: HealthState;
        host: string | null;
        /** Raw manager status */
        connection: 'idle' | 'connecting' | 'connected' | 'error';
        fallbacks: readonly string[];
    };
    supabase: {
        status: HealthState;
        detail?: string;
    };
    api: {
        status: HealthState;
        detail?: string;
    };
    lastFullCheck: number;
    refresh: () => Promise<void>;
}

const defaultValue: InfraHealthValue = {
    electrum: {
        status: 'unknown',
        host: null,
        connection: 'idle',
        fallbacks: ELECTRUM_FALLBACK_SERVERS,
    },
    supabase: { status: 'unknown' },
    api: { status: 'unknown' },
    lastFullCheck: 0,
    refresh: async () => {},
};

const InfraHealthContext = createContext<InfraHealthValue>(defaultValue);

async function checkSupabaseHealth(): Promise<{ status: HealthState; detail?: string }> {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url) {
        return { status: 'degraded', detail: 'Not configured' };
    }
    try {
        const { error } = await supabase.auth.getSession();
        if (error) {
            return { status: 'degraded', detail: error.message };
        }
        return { status: 'ok' };
    } catch (e: any) {
        return { status: 'down', detail: e?.message || 'Unreachable' };
    }
}

/** NexOps MCP on Render often exposes `GET /` with `{"status":"ok",...}` while `/health` may be absent. */
async function checkApiHealth(): Promise<{ status: HealthState; detail?: string }> {
    const base = import.meta.env.VITE_BACKEND_URL as string | undefined;
    if (!base?.trim()) {
        return { status: 'unknown', detail: 'Optional backend not set' };
    }
    const root = base.replace(/\/$/, '');
    const paths = ['/health', '/'];
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 5000);

    try {
        for (const path of paths) {
            try {
                const res = await fetch(`${root}${path}`, { signal: ctrl.signal });
                if (!res.ok) continue;

                const ct = res.headers.get('content-type') || '';
                if (ct.includes('json')) {
                    const j = (await res.json()) as { status?: string; service?: string };
                    if (j.status === 'ok' || (typeof j.service === 'string' && j.service.length > 0)) {
                        return { status: 'ok' };
                    }
                    continue;
                }
                return { status: 'ok' };
            } catch {
                /* try next path */
            }
        }
        return { status: 'down', detail: 'Unreachable' };
    } catch (e: any) {
        if (e?.name === 'AbortError') {
            return { status: 'down', detail: 'Timeout' };
        }
        return { status: 'down', detail: e?.message || 'Unreachable' };
    } finally {
        clearTimeout(t);
    }
}

function mapElectrumToHealth(
    snap: ReturnType<typeof getElectrumConnectionSnapshot>
): InfraHealthValue['electrum'] {
    const { host, status: conn } = snap;
    let health: HealthState = 'unknown';
    if (conn === 'connected' && host) health = 'ok';
    else if (conn === 'connecting') health = 'degraded';
    else if (conn === 'error') health = 'down';
    else health = 'unknown';

    return {
        status: health,
        host,
        connection: conn,
        fallbacks: ELECTRUM_FALLBACK_SERVERS,
    };
}

export const InfraHealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [electrumSnap, setElectrumSnap] = useState(() => getElectrumConnectionSnapshot());
    const [supabaseH, setSupabaseH] = useState<InfraHealthValue['supabase']>({ status: 'unknown' });
    const [apiH, setApiH] = useState<InfraHealthValue['api']>({ status: 'unknown' });
    const [lastFullCheck, setLastFullCheck] = useState(0);

    useEffect(() => {
        return subscribeElectrumConnection(() => {
            setElectrumSnap(getElectrumConnectionSnapshot());
        });
    }, []);

    const runChecks = useCallback(async () => {
        const [sb, api] = await Promise.all([checkSupabaseHealth(), checkApiHealth()]);
        setSupabaseH(sb);
        setApiH(api);
        await probeElectrumConnection();
        setElectrumSnap(getElectrumConnectionSnapshot());
        setLastFullCheck(Date.now());
    }, []);

    useEffect(() => {
        runChecks();
        const id = window.setInterval(runChecks, 60000);
        return () => window.clearInterval(id);
    }, [runChecks]);

    const value = useMemo<InfraHealthValue>(
        () => ({
            electrum: mapElectrumToHealth(electrumSnap),
            supabase: supabaseH,
            api: apiH,
            lastFullCheck,
            refresh: runChecks,
        }),
        [electrumSnap, supabaseH, apiH, lastFullCheck, runChecks]
    );

    return <InfraHealthContext.Provider value={value}>{children}</InfraHealthContext.Provider>;
}

export function useInfraHealth(): InfraHealthValue {
    return useContext(InfraHealthContext);
}
