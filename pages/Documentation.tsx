import React from 'react';
import { DocsLayout } from '../components/DocsLayout';
import { ExternalLink, Info, AlertTriangle, CheckCircle2, Zap, Box, Shield, ChevronRight, ShieldCheck, LayoutIcon, Cpu, Terminal } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <DocsLayout>
      <div className="space-y-24 pb-32">
        {/* I. SYSTEM OVERVIEW */}
        <section id="overview" className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-6">
            <LayoutIcon className="text-yellow-500" size={32} />
            <h1 className="text-5xl font-black text-white tracking-tighter">System Overview</h1>
          </div>

          <p className="text-xl text-zinc-400 leading-relaxed max-w-3xl mb-12">
            NexOps is a comprehensive infrastructure layer for Bitcoin Cash (BCH), designed to unify human intention with cryptographically secure contract logic. This "Nexus" represents a paradigm shift from manual script writing to **Intent-Based Operations**.
          </p>

          {/* 1-Page Master Architecture Diagram */}
          <div className="relative p-12 bg-[#0d0d0f] border border-white/5 rounded-3xl overflow-hidden group mb-16 shadow-2xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/5 blur-[100px] rounded-full -mr-48 -mt-48 transition-all duration-1000 group-hover:bg-yellow-500/10"></div>

            <div className="relative z-10 flex flex-col gap-12">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center lg:items-start text-center">

                {/* Stage 1: The Input */}
                <div className="space-y-4">
                  <div className="h-44 bg-zinc-900/80 border border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 shadow-inner">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                      <Zap className="text-yellow-500" size={24} />
                    </div>
                    <span className="text-white font-bold text-lg">Natural Intent</span>
                    <span className="text-zinc-500 text-xs mt-1">Language / Wizard / API</span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono">BROADCAST_INTENT</div>
                </div>

                {/* Stage 2: The Core Processing */}
                <div className="lg:col-span-1 space-y-4 flex flex-col items-center">
                  <div className="w-full h-56 bg-gradient-to-br from-zinc-800 to-[#0a0a0c] border border-yellow-500/20 rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <div className="w-16 h-16 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4 border border-yellow-500/30">
                      <Cpu className="text-yellow-500 animate-pulse" size={32} />
                    </div>
                    <span className="text-yellow-500 font-black text-xl tracking-widest uppercase">The Nexus</span>
                    <span className="text-zinc-400 text-[10px] mt-2 text-center max-w-[150px] leading-tight">INFERENCE + TOLL GATE + AUDIT</span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono">REASONING_LOOP_v2</div>
                </div>

                {/* Stage 3: The Output */}
                <div className="space-y-4">
                  <div className="h-44 bg-zinc-900/80 border border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 shadow-inner">
                    <div className="w-12 h-12 bg-green-500/5 rounded-full flex items-center justify-center mb-3">
                      <ShieldCheck className="text-green-500" size={24} />
                    </div>
                    <span className="text-white font-bold text-lg">Execution</span>
                    <span className="text-zinc-500 text-xs mt-1">Transaction / Deploy / Monitor</span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono">BCH_NETWORK_FLUSH</div>
                </div>

              </div>

              <div className="hidden lg:flex justify-around items-center px-12 -mt-4 text-zinc-700">
                <ChevronRight className="animate-bounce-x" size={32} />
                <ChevronRight size={32} />
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inference Driven</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Zero-Trust Audit</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Native Utility</span>
              </div>
            </div>
          </div>
        </section>

        {/* II. INTRODUCTION */}
        <section id="intro" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🌌 1. Introduction</h2>
          <div className="prose prose-invert max-w-none space-y-6">
            <p className="text-zinc-400 leading-relaxed text-lg">
              NexOps isn't just an IDE or a library; it's a **living protocol** designed to act as the cognitive glue for the Bitcoin Cash ecosystem. As BCH matures with upgrades like **CashTokens (CHIP-2021-02)** and complex covenant capability, the barrier for entry for developers has paradoxically increased.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              We started NexOps to solve "The Script Problem": the reality that while the BCH VM is extremely powerful and deterministic, it is also notoriously difficult for non-specialist developers to work with safely. One misplaced opcode can mean the permanent loss of millions in value.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
              <div className="space-y-4">
                <h4 className="text-yellow-500 font-bold uppercase tracking-widest text-xs">The Vision</h4>
                <p className="text-sm text-zinc-500 leading-relaxed italic">
                  "To make Bitcoin Cash as programmable as Ethereum, but with the security and determinism of the UTXO model."
                </p>
              </div>
              <div className="space-y-4">
                <h4 className="text-zinc-300 font-bold uppercase tracking-widest text-xs">The Mission</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Provide a verified, AI-anchored development pipeline that guarantees every line of generated code has been audited against the latest security patterns.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* III. CORE CONCEPTS */}
        <section id="concepts" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">✨ 2. Core Concepts</h2>

          <div className="space-y-16">
            <div className="group">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 group-hover:text-yellow-500 transition-colors">
                <Zap size={20} />
                2.1 Intent-Based Development
              </h3>
              <p className="text-zinc-400 leading-relaxed mb-6">
                In the NexOps worldview, you don't write "scripts"—you broadcast "Intents". An Intent is a high-level, human-readable specification of a financial state transition.
              </p>
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Terminal size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1 space-y-4">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Example Intent</p>
                    <div className="bg-black/60 p-4 rounded-lg font-mono text-sm text-green-400 border border-green-500/10 italic">
                      "I need a recurring vault that allows Bob to withdraw 5 BCH every 30 days,
                      but Alice can cancel the entire flow at any point before the next epoch."
                    </div>
                  </div>
                  <div className="text-zinc-700">
                    <ChevronRight size={32} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">NexOps Artifact</p>
                    <div className="bg-black/60 p-4 rounded-lg font-mono text-[10px] text-yellow-500/80 border border-yellow-500/10 overflow-x-auto whitespace-pre">
                      {`contract RecurringVault(pubkey alice, pubkey bob) {
    function withdraw(sig s) {
        require(checkSig(s, bob));
        require(tx.age >= 30d);
        // ... complex covenant logic
    }
}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 group-hover:text-yellow-500 transition-colors">
                <Box size={20} />
                2.2 The UTXO Mental Model
              </h3>
              <p className="text-zinc-400 leading-relaxed mb-8">
                To build with NexOps, you must understand that Bitcoin Cash uses **UTXOs (Unspent Transaction Outputs)**, not Account Balances. Think of a UTXO as a physical "bill" or "coin" that is locked inside an envelope (the script). To spend it, you must satisfy the conditions written on that envelope.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-xl hover:border-yellow-500/20 transition-all">
                  <div className="w-8 h-8 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-yellow-500 font-bold text-xs">U</span>
                  </div>
                  <h4 className="text-white font-bold text-sm mb-2">Immutable Identity</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">Each UTXO has a unique TxID and Index. It exists until it is completely consumed as an input to a new transaction.</p>
                </div>
                <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-xl hover:border-blue-500/20 transition-all">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-blue-500 font-bold text-xs">S</span>
                  </div>
                  <h4 className="text-white font-bold text-sm mb-2">Script Logic</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">The script doesn't "run" on a server; it's a validation gate that the network nodes check before miners include the Tx in a block.</p>
                </div>
                <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-xl hover:border-purple-500/20 transition-all">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-purple-500 font-bold text-xs">D</span>
                  </div>
                  <h4 className="text-white font-bold text-sm mb-2">Determinism</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">BCH transactions are stateless. You know exactly if a Tx will succeed or fail locally before ever broadcasting it.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IV. PROTOCOL ARCHITECTURE */}
        <section id="architecture" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🏗️ 3. Protocol Architecture</h2>
          <p className="text-zinc-400 leading-relaxed mb-12">
            The NexOps architecture is designed as a **Multi-Tiered Cognitive Stack**. It separates the high-risk logic generation from the heavy-lifting verification and deployment layers.
          </p>

          <div className="space-y-12">
            {/* 3.1 Interface Layer */}
            <div className="border-l-4 border-yellow-500 pl-8 space-y-6">
              <h3 className="text-xl font-bold text-white">3.1 Nexus Interface Layer</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The Interface Layer (implemented in React + Vite) is the primary entry point for the {"Build \u2192 Fund \u2192 Run"} loop.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/80 rounded-lg border border-white/5">
                  <h5 className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight mb-2">State Management</h5>
                  <p className="text-xs text-zinc-400 leading-relaxed">Utilizes advanced React hooks and Context providers to sync blockchain state (UTXOs) with the AI inference state in real-time.</p>
                </div>
                <div className="p-4 bg-zinc-900/80 rounded-lg border border-white/5">
                  <h5 className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight mb-2">Visual Mapping</h5>
                  <p className="text-xs text-zinc-400 leading-relaxed">Transforms raw JSON data from the <strong>VisualFlow Execution Graph</strong> into a React FLOW workspace for interactive auditing.</p>
                </div>
              </div>
            </div>

            {/* 3.2 Inference Layer */}
            <div className="border-l-4 border-blue-500 pl-8 space-y-6">
              <h3 className="text-xl font-bold text-white">3.2 Cognitive Inference Layer</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                This layer coordinates multiple Large Language Models (LLMs) through a structured **RAG (Retrieval-Augmented Generation)** strategy.
              </p>
              <div className="h-64 bg-zinc-950 border border-white/5 rounded-2xl relative overflow-hidden p-8 flex items-center justify-center">
                {/* Visual Representation of Tiers */}
                <div className="relative flex flex-col items-center gap-2 w-full max-w-xs">
                  <div className="w-full h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-t-xl flex items-center justify-center text-[10px] font-bold text-yellow-500 tracking-widest uppercase">Tier A: Canonical Truth</div>
                  <div className="w-[90%] h-12 bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 tracking-widest uppercase italic">Tier B: Security Patterns</div>
                  <div className="w-[80%] h-12 bg-zinc-800/50 border border-white/5 rounded-b-xl flex items-center justify-center text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Tier C: Ecosystem FAQ</div>
                </div>
                <div className="absolute top-1/2 left-32 -translate-y-1/2 flex flex-col items-end gap-16 text-[8px] text-zinc-600 font-bold uppercase invisible md:visible">
                  <span>Logic Seeds</span>
                  <span>Safety Rails</span>
                  <span>Ecosystem Knowledge</span>
                </div>
              </div>
            </div>

            {/* 3.3 Network Interface */}
            <div className="border-l-4 border-green-500 pl-8 space-y-6">
              <h3 className="text-xl font-bold text-white">3.3 Blockchain Network Protocol</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Direct blockchain connectivity is brokered through the **Electrum-Cash Protocol**. Unlike standard HTTP-based explorers, NexOps maintains persistent WebSocket subscriptions to the network.
              </p>
              <div className="bg-black/40 p-6 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="px-2 py-1 bg-green-500/20 text-green-500 font-mono text-[10px] rounded">SUBSCRIPTION_ACTIVE</div>
                  <div className="text-xs text-zinc-400 font-mono italic">nexops:socket_pool#chipnet...</div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  When a scriptHash is subscribed, the network notifies the Nexus interface within 150ms of a mempool entry. This enables **0-Conf Operational Intelligence**—allowing developers to see funds arriving before the next block.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: MCP */}
        <section id="mcp">
          <h2 className="text-2xl font-semibold text-white mb-6">🔗 MCP Integration</h2>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle size={20} />
              <h4 className="font-bold uppercase tracking-tight text-sm">Experimental Section</h4>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Model Context Protocol (MCP) allows AI agents to act as "remote brains" for your local IDE. NexOps exposes its services via MCP tools.
            </p>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10">
              <tr>
                <th className="py-2 text-zinc-500 font-bold uppercase tracking-tight text-[10px]">Tool (Placeholder)</th>
                <th className="py-2 text-zinc-500 font-bold uppercase tracking-tight text-[10px]">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-3 font-mono text-yellow-500/80">compile_contract</td>
                <td className="py-3 text-zinc-400">Wraps cashc to provide ASM/ABI output to the agent.</td>
              </tr>
              <tr>
                <td className="py-3 font-mono text-yellow-500/80">run_audit</td>
                <td className="py-3 text-zinc-400">Triggers the 2-Phase security report.</td>
              </tr>
              <tr>
                <td className="py-3 font-mono text-yellow-500/80">get_utxos</td>
                <td className="py-3 text-zinc-400">Fetches unspent outputs for a Chipnet address.</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* V. INTENT EXECUTION PIPELINE */}
        <section id="pipeline" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🌀 4. Intent Execution Pipeline</h2>
          <p className="text-zinc-400 leading-relaxed mb-12">
            The NexOps Intent Pipeline is a high-availability, WebSocket-driven system that manages the lifecycle of a smart contract from natural language seed to on-chain confirmation.
          </p>

          <div className="space-y-16">
            {/* 4.1 Lifecycle Trace */}
            <div className="bg-[#050505] border border-white/5 rounded-2xl p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.02] -mr-8 -mt-8">
                <Cpu size={180} />
              </div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8">Intent Lifecycle Trace (Real-time Log)</h4>

              <div className="space-y-6 relative z-10">
                <div className="flex gap-4 items-start">
                  <div className="text-[10px] font-mono text-zinc-700 mt-1 whitespace-nowrap">00:00.000</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white mb-1">INTENT_BROADCAST</div>
                    <p className="text-[10px] text-zinc-500 font-mono">Payload: {"{ type: 'Escrow', users: ['alice', 'bob'], conditions: '2-of-2' }"}</p>
                    <p className="text-[9px] text-zinc-600 italic">Nexus receives the message via Secure WebSocket (WSS).</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start border-l-2 border-yellow-500/20 pl-4">
                  <div className="text-[10px] font-mono text-zinc-700 mt-1 whitespace-nowrap">00:00.245</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-yellow-500 mb-1">COGNITIVE_NEGOTIATION</div>
                    <p className="text-[10px] text-zinc-500 font-mono">RAG_Context: Multi-Sig, Time-Lock, Auth_Signer</p>
                    <p className="text-[9px] text-zinc-600 italic">Inference engine anchors the intent against verified pattern libraries.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start border-l-2 border-red-500/20 pl-4">
                  <div className="text-[10px] font-mono text-zinc-700 mt-1 whitespace-nowrap">00:00.890</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-red-500 mb-1">TOLL_GATE_AUDIT</div>
                    <p className="text-[10px] text-zinc-500 font-mono">Status: PASSED | Rules: TG-01, TG-02, TG-03</p>
                    <p className="text-[9px] text-zinc-600 italic">Deterministic linter verifies zero cross-chain evasion logic.</p>
                  </div>
                </div>

                <div className="flex gap-4 items-start border-l-2 border-green-500/20 pl-4">
                  <div className="text-[10px] font-mono text-zinc-700 mt-1 whitespace-nowrap">00:01.400</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-green-500 mb-1">NETWORK_FULFILLMENT</div>
                    <p className="text-[10px] text-zinc-500 font-mono">Action: OP_CHECKDATASIG_VERIFY | Target: Chipnet</p>
                    <p className="text-[9px] text-zinc-600 italic">Signed Transaction broadcasted to Electrum-Cash node pool.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-zinc-500 italic text-center">
              "Predictability is the primary feature of the NexOps Pipeline."
            </p>
          </div>
        </section>

        {/* VI. PROTOCOL SPECIFICATION */}
        <section id="spec" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🏛️ 5. Protocol Specification</h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mb-12">
            The formal specification ensures that independent implementations of NexOps remain compatible. Every data structure is strictly typed and versioned.
          </p>

          <div className="space-y-16">
            {/* 5.1 Intent Protocol (V1) */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">5.1 Intent Message Schema (V1.0.4)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-900 border-b border-white/10">
                    <tr>
                      <th className="p-4 text-zinc-500 font-bold text-[10px] uppercase">Property</th>
                      <th className="p-4 text-zinc-500 font-bold text-[10px] uppercase">Type</th>
                      <th className="p-4 text-zinc-500 font-bold text-[10px] uppercase">Requirement</th>
                      <th className="p-4 text-zinc-500 font-bold text-[10px] uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    <tr>
                      <td className="p-4 text-yellow-500">intent_id</td>
                      <td className="p-4 text-zinc-400 font-bold">UUID v4</td>
                      <td className="p-4 text-red-500/50">Required</td>
                      <td className="p-4 text-zinc-500 text-xs font-sans">Unique operational identifier.</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-yellow-500">context_tier</td>
                      <td className="p-4 text-zinc-400 font-bold">Enum[A, B, C]</td>
                      <td className="p-4 text-red-500/50">Required</td>
                      <td className="p-4 text-zinc-500 text-xs font-sans">Level of RAG ground truth required.</td>
                    </tr>
                    <tr>
                      <td className="p-4 text-yellow-500">gas_strategy</td>
                      <td className="p-4 text-zinc-400 font-bold">Object</td>
                      <td className="p-4 text-blue-500/30">Optional</td>
                      <td className="p-4 text-zinc-500 text-xs font-sans">Custom sat/byte distribution rules.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-zinc-950 border border-white/5 rounded-xl">
                <pre className="text-[10px] text-zinc-500 scrollbar-hide py-2">
                  {`{
  "version": "1.0.4",
  "payload": {
    "auth": "PKL_ADDR_...",
    "logic": "require(tx.age > 100)",
    "security_level": "Strict"
  }
}`}
                </pre>
              </div>
            </div>

            {/* 5.2 Deterministic Deployment Rules */}
            <div className="group border-t border-white/5 pt-12">
              <h3 className="text-xl font-bold text-white mb-4">5.2 Deterministic Deployment Rules</h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-6">
                Deployment in NexOps is not a random event. It follows the **Identity Mapping Theorem**: any given set of keys and contract code MUST result in the same deterministic scriptHash, regardless of the network (Mainnet vs. Chipnet).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-zinc-900 border border-white/5 rounded-2xl">
                  <h5 className="text-white font-bold text-xs mb-3 uppercase tracking-widest">Pre-Flight Rule #1</h5>
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">"No transaction shall be broadcast if the local scriptHash does not match the computed remote scriptHash."</p>
                </div>
                <div className="p-6 bg-zinc-900 border border-white/5 rounded-2xl">
                  <h5 className="text-white font-bold text-xs mb-3 uppercase tracking-widest">Pre-Flight Rule #2</h5>
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">"Identity Drift Protection must be enabled for all contracts handling > 10 BCH."</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VII. VISUALFLOW EXECUTION GRAPH */}
        <section id="visualflow" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">📊 6. VisualFlow Execution Graph</h2>
          <p className="text-zinc-400 leading-relaxed mb-12 max-w-3xl">
            VisualFlow is the protocol's primary transparency layer. It allows developers to "see" the branching logic of a CashScript contract before it is compiled into opaque BCH bytecode.
          </p>

          <div className="space-y-16">
            {/* 6.1 AST Extraction Logic */}
            <div className="flex flex-col lg:flex-row gap-12">
              <div className="lg:w-1/2 space-y-6">
                <h3 className="text-xl font-bold text-white">6.1 AST Decomposition</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  The NexOps parser traverses the Abstract Syntax Tree (AST) produced by the compiler. It identifies three critical node types:
                </p>
                <ul className="space-y-4">
                  <li className="flex gap-4">
                    <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold border border-blue-500/30">F</div>
                    <div>
                      <h6 className="text-white text-xs font-bold leading-6">Function Entries</h6>
                      <p className="text-[11px] text-zinc-600">The external interfaces through which the contract can be spent.</p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="w-6 h-6 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-[10px] font-bold border border-yellow-500/30">C</div>
                    <div>
                      <h6 className="text-white text-xs font-bold leading-6">Conditional Branches</h6>
                      <p className="text-[11px] text-zinc-600">Decision diamonds where script-path spending diverts based on boolean state.</p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold border border-red-500/30">V</div>
                    <div>
                      <h6 className="text-white text-xs font-bold leading-6">Validation Checkpoints</h6>
                      <p className="text-[11px] text-zinc-600">Mandatory opcodes such as OP_CHECKDATASIG or OP_CHECKSEQUENCEVERIFY.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="lg:w-1/2 bg-[#08080a] border border-white/5 rounded-3xl p-8 relative shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-full bg-zinc-900/80 p-4 rounded-xl border border-white/5 mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">AST Node Extraction</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
                      </div>
                    </div>
                    <code className="text-[10px] text-yellow-500/80 font-mono italic leading-relaxed">
                      const nodes = visit(ast, {"{"} <br />
                      {"  Function: (node) => process(node),"} <br />
                      {"  IfStatement: (node) => fork(node)"} <br />
                      {"}"});
                    </code>
                  </div>

                  {/* Simplified Visual Graph Mockup */}
                  <div className="relative w-full h-32 flex justify-center items-center">
                    <div className="absolute w-24 h-10 bg-zinc-800 border border-blue-500/30 rounded flex items-center justify-center text-[10px] font-bold text-white z-20 left-4">spend()</div>
                    <div className="absolute w-12 h-12 bg-zinc-900 border border-yellow-500/30 rotate-45 flex items-center justify-center z-10">
                      <span className="-rotate-45 text-[10px] font-bold text-yellow-500">?</span>
                    </div>
                    <div className="absolute w-24 h-10 bg-zinc-800 border border-green-500/30 rounded flex items-center justify-center text-[10px] font-bold text-white z-20 right-4">SUCCESS</div>

                    {/* SVG Connector Path */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                      <line x1="120" y1="64" x2="190" y2="64" stroke="white" strokeWidth="1" />
                      <line x1="260" y1="64" x2="330" y2="64" stroke="white" strokeWidth="1" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-zinc-500 italic text-center max-w-md mx-auto">
              "VisualFlow bridges the gap between trust and verification by making the AST human-accessible."
            </p>
          </div>
        </section>

        {/* VIII. AI AUDIT ENGINE */}
        <section id="audit" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🛡️ 7. AI Audit Engine</h2>
          <p className="text-zinc-400 leading-relaxed mb-12 max-w-2xl">
            The AI Audit Engine is the sentinel of the NexOps Protocol. It ensures that every contract generated or imported adheres to strict BCH security standards.
          </p>

          <div className="space-y-12">
            {/* 7.1 Two-Phase Audit Methodology */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 bg-blue-500/10 rounded-bl-xl text-[10px] font-bold text-blue-400 uppercase tracking-widest">Phase 1</div>
                <h4 className="text-white font-bold mb-4">Static Pattern Linter</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  A high-speed, deterministic pass that verifies syntax and catches "Low-Hanging Fruit" such as missing transaction fee padding or unauthorized use of experimental opcodes.
                </p>
              </div>
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 bg-yellow-500/10 rounded-bl-xl text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Phase 2</div>
                <h4 className="text-white font-bold mb-4">Semantic Reasoning</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Leveraging LLM reasoning and the Multi-Tier RAG context, this phase analyzes the **Intended Meaning** of the contract vs its **Actual Logic**, catching complex logical errors that static linters miss.
                </p>
              </div>
            </div>

            {/* 7.2 Security Rule Repository */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">7.2 Formal Audit Rule-Set (SEC-XXX)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-black/40 border border-red-500/20 rounded-xl">
                  <span className="text-[10px] font-mono text-red-500 font-bold">SEC-001</span>
                  <h6 className="text-white text-xs font-bold mt-1">Covenant Identity Drift</h6>
                  <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">Ensures the output contract's scriptHash is verified within the transaction itself to prevent redirection.</p>
                </div>
                <div className="p-4 bg-black/40 border border-red-500/20 rounded-xl">
                  <span className="text-[10px] font-mono text-red-500 font-bold">SEC-002</span>
                  <h6 className="text-white text-xs font-bold mt-1">Replay Attack Guard</h6>
                  <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">Mandates the use of unique nonce or sequence-based locktimes for recurring spending paths.</p>
                </div>
                <div className="p-4 bg-black/40 border border-red-500/20 rounded-xl">
                  <span className="text-[10px] font-mono text-red-500 font-bold">SEC-003</span>
                  <h6 className="text-white text-xs font-bold mt-1">Oracle Authenticity</h6>
                  <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">Validates that OP_CHECKDATASIG is tied to a verified public key from the NexOps Trust List.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IX. SECURITY MODEL */}
        <section id="security" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🛡️ 8. Security Model</h2>
          <p className="text-zinc-400 leading-relaxed mb-12 max-w-3xl">
            The NexOps security model is built on the principle of **Defense in Depth**. We assume that any single component (AI, Interface, or RPC) could be compromised.
          </p>

          <div className="space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-xl font-bold text-white">8.1 Trust Anchors</h3>
                <div className="space-y-4">
                  <div className="flex gap-4 p-6 bg-zinc-900 border border-white/5 rounded-2xl">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10">
                      <Shield className="text-blue-400" size={24} />
                    </div>
                    <div>
                      <h5 className="text-white font-bold text-sm mb-1">Covenant Containment</h5>
                      <p className="text-xs text-zinc-500 leading-relaxed">By enforcing strict spending rules on the transaction outputs, NexOps ensures that even if a private key is leaked, the funds can only flow to authorized destinations.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-6 bg-zinc-900 border border-white/5 rounded-2xl">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0 border border-white/10">
                      <ShieldCheck className="text-purple-400" size={24} />
                    </div>
                    <div>
                      <h5 className="text-white font-bold text-sm mb-1">Non-Custodial Logic</h5>
                      <p className="text-xs text-zinc-500 leading-relaxed">NexOps never stores private seeds. All signatures occur locally in the Nexus Interface or are brokered via secure WalletConnect sessions.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h3 className="text-xl font-bold text-white">8.2 Threat Identification (MITRE Mapping)</h3>
                <div className="bg-black/50 border border-white/5 rounded-2xl p-8 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-zinc-800 px-4 py-2 rounded-lg">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Malicious Prompting</span>
                      <span className="text-[10px] text-red-500 font-bold">Mitigated</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 px-4">Toll Gate rejects any intent attempting to bypass script security.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-zinc-800 px-4 py-2 rounded-lg">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Backend MITM</span>
                      <span className="text-[10px] text-red-500 font-bold">Mitigated</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 px-4">Transaction signing hash is verified against the local AST output.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* X. DEVELOPER GUIDE */}
        <section id="devguide" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🛠️ 9. Developer Guide</h2>
          <p className="text-zinc-400 leading-relaxed mb-12 max-w-2xl">
            Get started building on NexOps. These guides will take you from setting up your environment to deploying your first audited covenant.
          </p>
          <div className="space-y-16">
            {/* 9.1 The First Intent Walkthrough */}
            <div className="space-y-8">
              <h3 className="text-xl font-bold text-white">9.1 Creating Your First Intent</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <div className="text-3xl font-black text-yellow-500/20">01</div>
                  <h6 className="text-white font-bold text-sm">Formulate Requirement</h6>
                  <p className="text-xs text-zinc-600 leading-relaxed">Enter the "Nexus Lab" and describe your contract logic. Be as specific as possible about participants and lock-times.</p>
                </div>
                <div className="space-y-4">
                  <div className="text-3xl font-black text-blue-500/20">02</div>
                  <h6 className="text-white font-bold text-sm">Visual Verification</h6>
                  <p className="text-xs text-zinc-600 leading-relaxed">Review the VisualFlow graph to ensure the AI's understanding of your intent matches your expectations.</p>
                </div>
                <div className="space-y-4">
                  <div className="text-3xl font-black text-green-500/20">03</div>
                  <h6 className="text-white font-bold text-sm">Audit & Fund</h6>
                  <p className="text-xs text-zinc-600 leading-relaxed">Trigger the 2-Phase Audit. Once passed, use the built-in Faucet to fund your contract on Chipnet.</p>
                </div>
              </div>
            </div>

            {/* 9.2 Integrating MCP Tools */}
            <div className="p-8 bg-zinc-950 border border-white/5 rounded-3xl group">
              <h3 className="text-xl font-bold text-white mb-6 group-hover:text-yellow-500 transition-colors">9.2 Using NexOps MCP Tools</h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-8">
                If you use VSCode, Cursor, or Zed, you can integrate NexOps tools directly via the **Model Context Protocol (MCP)**. This allows your local AI agents to perform audits and fetch UTXO data.
              </p>
              <div className="bg-black p-6 rounded-xl border border-white/10 font-mono text-[11px] text-zinc-400 space-y-2">
                <div className="flex gap-4">
                  <span className="text-green-500">$</span>
                  <span>npx @nexops/mcp-server --network chipnet</span>
                </div>
                <div className="text-zinc-700 italic mt-4">// Available Tools:</div>
                <div className="text-yellow-500/60">- nexops.audit_contract(source: string)</div>
                <div className="text-yellow-500/60">- nexops.get_balance(addr: string)</div>
              </div>
            </div>
          </div>
        </section>

        {/* XI. DEPLOYMENT & OPERATIONS */}
        <section id="deployment" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">🚀 10. Deployment & Operations</h2>
          <p className="text-zinc-400 leading-relaxed mb-12 max-w-3xl">
            Transitioning from the Nexus Lab to a live production environment requires understanding the NexOps operational stack, including custodial-free burner management and identity drift protection.
          </p>

          <div className="space-y-16">
            {/* 10.1 Burner Wallets & Entropy */}
            <div className="group">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Box size={20} className="text-yellow-500" />
                10.1 Burner Core Management
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-6">
                For rapid testing and isolated operations, NexOps utilizes **Ephemeral Burner Wallets**. These are transient keypairs generated in-browser with high-entropy seeding.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-zinc-900 border border-white/5 rounded-2xl border-l-4 border-l-yellow-600">
                  <h5 className="text-white font-bold text-xs mb-3 uppercase tracking-widest">Entropy Source</h5>
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">"crypto.getRandomValues() is used to seed the BIP39 mnemonic, ensuring no server-side key exposure."</p>
                </div>
                <div className="p-6 bg-zinc-900 border border-white/5 rounded-2xl border-l-4 border-l-blue-600">
                  <h5 className="text-white font-bold text-xs mb-3 uppercase tracking-widest">Auto-Cleanup</h5>
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">"Burners are purged from session storage upon contract finalization or 24-hour timeout."</p>
                </div>
              </div>
            </div>

            {/* 10.2 Bridging & Liquidity Flows */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">10.2 Cross-Chain Intent Bridging</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                While NexOps is native to BCH, it facilitates bridging through **Lock-and-Swap Covenants**. An intent can be broadcast that locks BCH until a cryptographic proof is provided from an external chain (e.g., a Solana signature).
              </p>
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 text-center font-mono text-xs">
                  BCH Chain <span className="text-blue-500 mx-2">&harr;</span> Relayer Network <span className="text-blue-500 mx-2">&harr;</span> Destination Protocol
                </div>
              </div>
            </div>

            {/* 10.3 Identity Drift Mitigation */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white">10.3 Identity Drift Mitigation</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Production deployments monitor for **Identity Drift**—a scenario where the underlying UTXO state changes before the AI-audited transaction is mined. NexOps uses a "Pre-Broadcast Validation" check that re-runs the Phase 1 audit 500ms before submission to ensure the ScriptHash remains deterministic.
              </p>
            </div>
          </div>
        </section>

        {/* XII. REFERENCE & FAQ */}
        <section id="reference" className="scroll-mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/5 pb-4">📚 11. Reference & Roadmap</h2>

          <div className="space-y-16">
            {/* 11.1 FAQ */}
            <div className="space-y-8">
              <h3 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { q: "Is NexOps a bridge?", a: "No, it's a protocol to BUILD secure bridges and contracts. It provides the security primitives (Toll Gates, AI Audits) that bridges use." },
                  { q: "What is Chipnet?", a: "The official BCH staging network where all NexOps tests occur. It has a separate faucet and allows for risk-free experimentation." },
                  { q: "Are the audits 100% safe?", a: "Audits provide high-confidence security by catching common and complex logical errors, but users should always review the VisualFlow graph." },
                  { q: "Can I use NexOps on Mainnet?", a: "Yes, once your contract passes Phase 2 Audit on Chipnet, it can be seamlessly migrated to Mainnet by switching the provider URL." },
                  { q: "Does NexOps store my keys?", a: "Never. All signing happens locally in your browser or through 3rd-party wallets like Electrum Cash or Paytaca." },
                  { q: "What is the fee structure?", a: "The protocol is open-source. Application developers may implement their own fee logic within their intents." }
                ].map((item, idx) => (
                  <div key={idx} className="p-6 bg-zinc-900 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                    <h6 className="text-xs font-bold text-yellow-500 mb-2">{item.q}</h6>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 11.2 Detailed Roadmap */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-3xl p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[80px] -mr-32 -mt-32"></div>
              <h3 className="text-xl font-bold text-white mb-10 relative z-10">2026/27 Protocol Roadmap</h3>
              <div className="space-y-12 relative z-10">
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-zinc-500 italic">Q2 26</span>
                  </div>
                  <div>
                    <h5 className="text-white font-bold text-xs mb-1">VisualFlow v2: Real-time Debugging</h5>
                    <p className="text-[10px] text-zinc-600">Interactive breakpoint support during the VisualFlow trace execution. Step through script validation line-by-line.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-yellow-500 italic border-b border-yellow-500/30">Q4 26</span>
                  </div>
                  <div>
                    <h5 className="text-yellow-500 font-bold text-xs mb-1">Identity Mesh Integration</h5>
                    <p className="text-[10px] text-zinc-600">Direct integration with Decentralized ID (DID) providers for multi-party intents and reputation-based toll gates.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-400 italic">Q1 27</span>
                  </div>
                  <div>
                    <h5 className="text-blue-400 font-bold text-xs mb-1">ZKP Toll Gates</h5>
                    <p className="text-[10px] text-zinc-600">Experimental Zero-Knowledge Proof validation for private intent parameters, keeping sensitive data off-chain while maintaining verifiability.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* XIII. ECOSYSTEM */}
        <section id="ecosystem" className="scroll-mt-20">
          <div className="py-24 border-t border-white/5 text-center space-y-8">
            <div className="flex justify-center gap-4">
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Join the Nexus.</h2>
            <p className="text-zinc-500 max-w-lg mx-auto leading-relaxed text-sm">
              NexOps is an open-standard protocol. We invite developers, security researchers, and AI engineers to contribute to the future of Intent-Based Bitcoin Cash.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <button className="px-8 py-3 bg-white text-black font-bold rounded-full text-xs hover:bg-zinc-200 transition-colors">Github Repository</button>
              <button className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-full border border-white/10 text-xs hover:bg-zinc-800 transition-colors">Developer Discord</button>
            </div>
          </div>
        </section>

        {/* Footer info */}
        <footer className="pt-20 border-t border-white/5 text-center">
          <p className="text-zinc-600 text-[10px] uppercase tracking-[0.4em] font-black">
            NexOps Protocol © 2026 // Decentralized Context Layer
          </p>
        </footer>
      </div>
    </DocsLayout>
  );
};