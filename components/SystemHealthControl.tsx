import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Activity, ChevronDown } from 'lucide-react';
import { useInfraHealth, HealthState, InfraHealthValue } from '../contexts/InfraHealthContext';
import { websocketService } from '../services/websocketService';

function healthDotClass(h: HealthState): string {
    switch (h) {
        case 'ok':
            return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]';
        case 'degraded':
            return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]';
        case 'down':
            return 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.45)]';
        default:
            return 'bg-slate-600';
    }
}

/** HTTP service can be up while the WebSocket bridge is still connecting — avoid showing full “down” in that case. */
function mcpCompositeHealth(api: HealthState, ws: boolean): HealthState {
    const configured = !!(import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
    if (!configured) return ws ? 'ok' : 'unknown';
    if (api === 'ok') return ws ? 'ok' : 'degraded';
    if (api === 'degraded') return 'degraded';
    if (api === 'down') return 'down';
    return ws ? 'degraded' : 'unknown';
}

function aggregateHealth(
    electrum: HealthState,
    mcpApi: HealthState,
    mcpWs: boolean,
    cloud: HealthState
): HealthState {
    const mcp = mcpCompositeHealth(mcpApi, mcpWs);
    const ranks: Record<HealthState, number> = { down: 0, degraded: 1, unknown: 2, ok: 3 };
    let worst: HealthState = 'ok';
    for (const h of [electrum, mcp, cloud]) {
        if (ranks[h] < ranks[worst]) worst = h;
    }
    return worst;
}

function electrumLine(
    connection: InfraHealthValue['electrum']['connection'],
    host: string | null
): string {
    switch (connection) {
        case 'connected':
            return host ? `Connected · ${host}` : 'Connected';
        case 'connecting':
            return 'Connecting…';
        case 'error':
            return 'Unavailable (all nodes failed)';
        default:
            return 'Idle';
    }
}

function cloudSyncLabel(status: HealthState): { label: string } {
    switch (status) {
        case 'ok':
            return { label: 'On' };
        case 'degraded':
            return { label: 'Limited' };
        case 'down':
            return { label: 'Off' };
        default:
            return { label: 'Unknown' };
    }
}

export type SystemHealthVariant = 'topBar' | 'statusBar';

interface SystemHealthControlProps {
    /** `topBar` = main window menu (default); `statusBar` = thinner workbench footer */
    variant?: SystemHealthVariant;
}

export const SystemHealthControl: React.FC<SystemHealthControlProps> = ({ variant = 'topBar' }) => {
    const infra = useInfraHealth();
    const [mcpActive, setMcpActive] = useState(() => websocketService.isConnected());
    const [healthOpen, setHealthOpen] = useState(false);
    /** Browser timers use numeric IDs (`window.setTimeout`); avoids DOM vs NodeJS.Timeout clash under `@types/node`. */
    const healthLeaveTimer = useRef<number | null>(null);

    useEffect(() => {
        const onConnect = () => setMcpActive(true);
        const onDisconnect = () => setMcpActive(false);
        websocketService.on('connected', onConnect);
        websocketService.on('disconnected', onDisconnect);
        setMcpActive(websocketService.isConnected());
        return () => {
            websocketService.off('connected', onConnect);
            websocketService.off('disconnected', onDisconnect);
        };
    }, []);

    const openHealthPanel = () => {
        if (healthLeaveTimer.current) {
            clearTimeout(healthLeaveTimer.current);
            healthLeaveTimer.current = null;
        }
        setHealthOpen(true);
    };

    const scheduleCloseHealthPanel = () => {
        healthLeaveTimer.current = window.setTimeout(() => setHealthOpen(false), 160);
    };

    const overall = aggregateHealth(infra.electrum.status, infra.api.status, mcpActive, infra.supabase.status);
    const cloud = cloudSyncLabel(infra.supabase.status);

    const isTop = variant === 'topBar';
    const iconSize = isTop ? 12 : 10;
    const btnClass = isTop
        ? 'flex items-center gap-1.5 px-2 py-1 rounded-md border border-transparent hover:border-white/10 hover:bg-white/[0.06] text-slate-400 hover:text-slate-100 text-xs transition-colors h-[26px]'
        : 'flex items-center gap-1.5 h-full px-1.5 -my-px rounded border border-transparent hover:border-white/10 hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-colors';

    return (
        <div
            className="relative flex items-center shrink-0"
            onMouseEnter={openHealthPanel}
            onMouseLeave={scheduleCloseHealthPanel}
        >
            <button
                type="button"
                className={btnClass}
                aria-expanded={healthOpen}
                aria-haspopup="dialog"
            >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${healthDotClass(overall)}`} />
                <Activity size={iconSize} className="shrink-0 opacity-80" />
                <span className={isTop ? 'font-semibold tracking-tight' : 'uppercase tracking-tight font-bold text-[9px]'}>
                    System health
                </span>
                <ChevronDown
                    size={iconSize}
                    className={`shrink-0 opacity-60 transition-transform ${healthOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {healthOpen && (
                <div
                    className="absolute right-0 top-full pt-0.5 z-[130] min-w-[240px]"
                    onMouseEnter={openHealthPanel}
                    onMouseLeave={scheduleCloseHealthPanel}
                >
                    <div className="rounded-md border border-white/10 bg-[#101014] shadow-[0_12px_40px_rgba(0,0,0,0.55)] px-3 py-2.5 text-left font-mono">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            Status
                        </div>

                        <div className="space-y-2.5 text-[10px] leading-snug">
                            <div>
                                <div className="text-slate-500 mb-0.5">Chipnet Electrum</div>
                                <div className="text-slate-200 break-all">
                                    {electrumLine(infra.electrum.connection, infra.electrum.host)}
                                </div>
                                <div className="text-[9px] text-slate-600 mt-1">
                                    Fallbacks: {infra.electrum.fallbacks.join(' → ')}
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-2.5">
                                <div className="text-slate-500 mb-0.5">MCP service (HTTP)</div>
                                <div
                                    className={
                                        infra.api.status === 'ok'
                                            ? 'text-emerald-400/90'
                                            : infra.api.status === 'down'
                                              ? 'text-red-400/90'
                                              : 'text-amber-400/85'
                                    }
                                >
                                    {infra.api.status === 'ok'
                                        ? 'Reachable'
                                        : infra.api.status === 'unknown'
                                          ? 'Not configured'
                                          : infra.api.detail || infra.api.status}
                                </div>
                                <div className="text-slate-500 mt-2 mb-0.5">Live bridge (WebSocket)</div>
                                <div className={mcpActive ? 'text-emerald-400/90' : 'text-amber-400/90'}>
                                    {mcpActive ? 'Connected' : 'Disconnected'}
                                </div>
                                <div className="text-[9px] text-slate-600 mt-0.5">
                                    Slash commands need the live bridge; HTTP only means the host is up.
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-2.5">
                                <div className="text-slate-500 mb-0.5">Cloud sync</div>
                                <div className="text-slate-200">
                                    {cloud.label}
                                    {infra.supabase.detail && infra.supabase.status !== 'ok' && (
                                        <span className="text-slate-500">
                                            {' '}
                                            — {infra.supabase.detail}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => void infra.refresh()}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 rounded border border-white/10 bg-white/[0.03] py-1 text-[9px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
                        >
                            <RefreshCw size={10} />
                            Recheck
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
