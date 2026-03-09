import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LucideIcon, ChevronRight, Book, Shield, Zap, Layout as LayoutIcon, Cpu,
  Terminal, FileCode, Globe, Activity, Code2, Database, Layers, Binary,
  Box, Lock, AlertTriangle, Wrench, Search
} from 'lucide-react';

interface NavItem { id: string; label: string; icon: LucideIcon; section: string; }

const NAV_ITEMS: NavItem[] = [
  { id: 'introduction',       label: 'Introduction',             icon: Book,        section: 'Getting Started' },
  { id: 'what-is-nexops',    label: 'What is NexOps',           icon: LayoutIcon,  section: 'Getting Started' },
  { id: 'why-nexops',        label: 'Why NexOps Exists',        icon: Zap,         section: 'Getting Started' },
  { id: 'architecture-overview', label: 'Architecture Overview', icon: Layers,     section: 'Getting Started' },

  { id: 'intent-spec',       label: 'Intent Specification',     icon: FileCode,    section: 'Core Protocol' },
  { id: 'nexir',             label: 'NexIR',                    icon: Binary,      section: 'Core Protocol' },
  { id: 'logic-injection',   label: 'Logic Injection',          icon: Cpu,         section: 'Core Protocol' },
  { id: 'tollgate',          label: 'TollGate Verification',    icon: Shield,      section: 'Core Protocol' },
  { id: 'deployment',        label: 'Deterministic Deployment', icon: Zap,         section: 'Core Protocol' },

  { id: 'writing-intents',   label: 'Writing Intents',          icon: Code2,       section: 'Developer Guide' },
  { id: 'compiling',         label: 'Compiling Contracts',      icon: Terminal,    section: 'Developer Guide' },
  { id: 'security-verification', label: 'Security Verification', icon: Shield,    section: 'Developer Guide' },
  { id: 'deploying',         label: 'Deploying Contracts',      icon: Globe,       section: 'Developer Guide' },
  { id: 'interaction',       label: 'Contract Interaction',     icon: Activity,    section: 'Developer Guide' },

  { id: 'workbench',         label: 'NexOps Workbench',         icon: Wrench,      section: 'Tools' },
  { id: 'nexhub',            label: 'NexHub Registry',          icon: Database,    section: 'Tools' },
  { id: 'nexwizard',         label: 'NexWizard Builder',        icon: Box,         section: 'Tools' },
  { id: 'abi-visualizer',    label: 'ABI Visualizer',           icon: Search,      section: 'Tools' },
  { id: 'flow-palette',      label: 'Flow Palette',             icon: Layers,      section: 'Tools' },

  { id: 'ex-escrow',         label: 'Escrow Contract',          icon: Lock,        section: 'Examples' },
  { id: 'ex-multisig',       label: 'Multisig Contract',        icon: Shield,      section: 'Examples' },
  { id: 'ex-timelock',       label: 'Timelock Contract',        icon: Zap,         section: 'Examples' },
  { id: 'ex-covenant',       label: 'Covenant Patterns',        icon: Layers,      section: 'Examples' },

  { id: 'security-model',    label: 'Security Model',           icon: Shield,      section: 'Security' },
  { id: 'tollgate-checks',   label: 'TollGate Checks',          icon: AlertTriangle, section: 'Security' },
  { id: 'deterministic-verify', label: 'Deterministic Verification', icon: Lock,  section: 'Security' },
  { id: 'threat-model',      label: 'Threat Model',             icon: AlertTriangle, section: 'Security' },

  { id: 'intent-schema',     label: 'Intent Schema',            icon: FileCode,    section: 'Reference' },
  { id: 'nexir-spec',        label: 'NexIR Specification',      icon: Binary,      section: 'Reference' },
  { id: 'cli-commands',      label: 'CLI Commands',             icon: Terminal,    section: 'Reference' },
  { id: 'terminology',       label: 'Protocol Terminology',     icon: Book,        section: 'Reference' },
];

interface DocsLayoutProps { activeId: string; children: React.ReactNode; }

export const DocsLayout: React.FC<DocsLayoutProps> = ({ activeId, children }) => {
  const navigate = useNavigate();
  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];
  const currentIndex = NAV_ITEMS.findIndex(i => i.id === activeId);
  const prevItem = NAV_ITEMS[currentIndex - 1];
  const nextItem = NAV_ITEMS[currentIndex + 1];
  const activeItem = NAV_ITEMS[currentIndex];
  const handleNav = (id: string) => navigate(`/docs/${id}`);

  return (
    <div className="flex bg-[#050605]" style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 240, flexShrink: 0 }} className="border-r border-white/[0.04] sticky top-0 h-screen overflow-y-auto py-8 px-3">
        <div className="mb-10 px-4">
          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.2em', color: '#3f3f46', textTransform: 'uppercase', marginBottom: 4 }}>Protocol Docs</p>
          <p style={{ fontSize: 9, color: '#27272a' }}>v4.0 · Whitepaper Edition</p>
        </div>
        <nav>
          {sections.map(section => (
            <div key={section} style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', padding: '0 16px', marginBottom: 10 }}>{section}</p>
              {NAV_ITEMS.filter(i => i.section === section).map(item => {
                const Icon = item.icon;
                const active = item.id === activeId;
                const G = '#00D855';
                return (
                  <button key={item.id} onClick={() => handleNav(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 16px', borderRadius: 8, textAlign: 'left', border: 'none', cursor: 'pointer',
                      background: active ? `${G}15` : 'transparent',
                      color: active ? G : '#fafafa', marginBottom: 2,
                      fontSize: 16, fontWeight: active ? 650 : 450, transition: 'all 0.2s',
                      lineHeight: 1.2,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Icon size={18} style={{ flexShrink: 0, opacity: active ? 1 : 0.8 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {active && <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content — CAN SCROLL ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', height: '100vh' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 48px 120px' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#52525b', fontFamily: 'monospace', marginBottom: 32 }}>
            <span>docs</span>
            <ChevronRight size={10} />
            <span style={{ color: '#a1a1aa' }}>{activeItem?.section}</span>
            <ChevronRight size={10} />
            <span style={{ color: '#00D855' }}>{activeItem?.label}</span>
          </div>

          {/* Page content */}
          <div className="docs-content">
            {children}
          </div>

          {/* Pagination */}
          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16, justifyContent: 'space-between' }}>
            {prevItem ? (
              <button onClick={() => handleNav(prevItem.id)} style={{ flex: 1, maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>← Previous</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{prevItem.label}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{prevItem.section}</p>
              </button>
            ) : <div />}
            {nextItem ? (
              <button onClick={() => handleNav(nextItem.id)} style={{ flex: 1, maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', cursor: 'pointer', textAlign: 'right', transition: 'all 0.2s', marginLeft: 'auto' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,216,85,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,216,85,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>Next →</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{nextItem.label}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{nextItem.section}</p>
              </button>
            ) : <div />}
          </div>
        </div>
      </main>
    </div>
  );
};
