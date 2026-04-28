import React from 'react';
import { MonacoEditorWrapper } from '../MonacoEditorWrapper';

interface CodePreviewProps {
  code: string;
  hash: string;
  warnings: string[];
}

export const CodePreview: React.FC<CodePreviewProps> = ({ code, hash, warnings }) => {
  const size = new TextEncoder().encode(code).length;
  const requires = (code.match(/\brequire\(/g) || []).length;
  const approxOps = requires * 3 + 10;

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="h-[600px] min-h-[600px] border border-white/10 rounded-md overflow-hidden">
        <MonacoEditorWrapper
          code={code}
          onChange={() => {}}
          readOnly={true}
          minimap={false}
        />
      </div>
      <div className="mt-3 text-[10px] text-slate-500 space-y-1 font-mono">
        <div>Hash: {hash.slice(0, 24)}...</div>
        <div>Size: {size} bytes</div>
        <div>Approx ops: {approxOps}/201</div>
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300 font-black">Warnings</div>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="text-[11px] text-amber-200">
                - {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
