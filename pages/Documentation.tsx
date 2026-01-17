import React from 'react';
import { Card } from '../components/UI';

export const Documentation: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="prose prose-invert prose-nexus max-w-none p-8">
        <h1 className="text-3xl font-bold text-white mb-6">NexusAI Documentation</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold text-nexus-cyan mb-4">Getting Started</h2>
          <p className="text-gray-300 mb-4">
            NexusAI streamlines the development of smart contracts using generative AI. 
            We integrate the Gemini 2.5 Flash model to provide high-speed code generation and real-time security auditing.
          </p>
          <div className="bg-nexus-900 p-4 rounded-lg border-l-4 border-nexus-cyan">
            <strong>Prerequisite:</strong> Ensure you have a Web3 wallet (like MetaMask or CashPay) installed to interact with the deployment module.
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-nexus-cyan mb-4">BCH (Bitcoin Cash) Integration</h2>
          <p className="text-gray-300 mb-2">
            NexusAI treats Bitcoin Cash as a first-class citizen via the <strong>CashScript</strong> adapter.
          </p>
          <ul className="list-disc pl-5 text-gray-300 space-y-2">
             <li>Select <strong>BCH Testnet (Chipnet)</strong> in the deployment tab.</li>
             <li>The AI Auditor is trained on specific UTXO-model vulnerabilities.</li>
             <li>Gas fees are estimated in Satoshis.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-nexus-cyan mb-4">AI Security Audit Scoring</h2>
          <p className="text-gray-300 mb-4">
            Our scoring engine analyzes 5 key vectors:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-nexus-800 p-3 rounded border border-nexus-700">
                <h4 className="font-bold text-white">Logic Integrity</h4>
                <p className="text-xs text-gray-400">Ensures state transitions are valid.</p>
             </div>
             <div className="bg-nexus-800 p-3 rounded border border-nexus-700">
                <h4 className="font-bold text-white">Access Control</h4>
                <p className="text-xs text-gray-400">Validates `onlyOwner` and modifier usage.</p>
             </div>
          </div>
        </section>
      </Card>
    </div>
  );
};