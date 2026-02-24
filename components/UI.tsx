import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, GitCommit, Minus, Plus, FileCode, FileJson, FileType, FileText, X } from 'lucide-react';
// Import Diff library for version control
import { diffLines, Change } from 'diff';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`glass-panel rounded-xl p-6 border border-nexus-700 shadow-xl ${className}`}>
    {children}
  </div>
);

// --- Buttons ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  icon,
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-nexus-900 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-nexus-cyan text-nexus-900 hover:bg-cyan-400 focus:ring-nexus-cyan shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    secondary: "bg-nexus-800 text-cyan-400 border border-nexus-700 hover:border-nexus-cyan/50 hover:text-cyan-300 focus:ring-nexus-700",
    danger: "bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20 focus:ring-red-500",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
    glass: "bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 hover:border-nexus-cyan/30"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

// --- Input ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    className="w-full bg-nexus-900/50 border border-nexus-700 rounded-lg px-4 py-2 text-gray-200 focus:border-nexus-cyan focus:ring-1 focus:ring-nexus-cyan outline-none transition-colors"
    {...props}
  />
);

// --- Tabs ---
export const Tabs: React.FC<{ tabs: string[]; activeTab: string; onChange: (tab: string) => void }> = ({ tabs, activeTab, onChange }) => (
  <div className="flex space-x-1 border-b border-nexus-700/50 mb-4 overflow-x-auto">
    {tabs.map(tab => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab
          ? 'border-nexus-cyan text-nexus-cyan bg-nexus-cyan/5'
          : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

// --- Icons Helper ---
export const getFileIcon = (fileName: string) => {
  if (fileName.endsWith('.sol') || fileName.endsWith('.cash')) return <FileCode size={14} className="text-nexus-cyan" />;
  if (fileName.endsWith('.json')) return <FileJson size={14} className="text-yellow-500" />;
  if (fileName.endsWith('.ts') || fileName.endsWith('.js')) return <FileType size={14} className="text-blue-400" />;
  return <FileText size={14} className="text-gray-400" />;
};

// --- Badge ---
export const Badge: React.FC<{ variant: 'high' | 'medium' | 'low' | 'info' | 'success'; children: React.ReactNode }> = ({ variant, children }) => {
  const styles = {
    high: "bg-red-900/30 text-red-400 border-red-800",
    medium: "bg-orange-900/30 text-orange-400 border-orange-800",
    low: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    info: "bg-blue-900/30 text-blue-400 border-blue-800",
    success: "bg-green-900/30 text-green-400 border-green-800",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- Code Block ---
export const CodeBlock: React.FC<{ code: string; language?: string; editable?: boolean; onChange?: (val: string) => void }> = ({ code, editable, onChange }) => (
  <div className="relative group h-full flex flex-col">
    {editable ? (
      <textarea
        value={code}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="flex-1 w-full bg-nexus-900 rounded-lg p-4 border border-nexus-700 font-mono text-sm text-gray-300 leading-relaxed outline-none focus:border-nexus-cyan resize-none custom-scrollbar"
        spellCheck={false}
      />
    ) : (
      <pre className="flex-1 w-full bg-nexus-900 rounded-lg p-4 overflow-auto border border-nexus-700 font-mono text-sm text-gray-300 leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    )}
  </div>
);

// --- Diff Viewer ---
interface DiffViewerProps {
  oldCode: string;
  newCode: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldCode, newCode }) => {
  const changes = useMemo(() => diffLines(oldCode, newCode), [oldCode, newCode]);

  return (
    <div className="flex-1 w-full bg-nexus-900 rounded-lg overflow-auto border border-nexus-700 font-mono text-xs md:text-sm leading-relaxed custom-scrollbar relative">
      <div className="sticky top-0 left-0 right-0 bg-nexus-800/80 backdrop-blur z-10 flex border-b border-nexus-700 p-2 text-xs text-gray-400">
        <div className="w-1/2 text-center border-r border-nexus-700">Previous</div>
        <div className="w-1/2 text-center">Current</div>
      </div>
      <div className="p-4">
        {changes.map((part: Change, index: number) => {
          const colorClass = part.added
            ? 'bg-green-900/20 text-green-300 border-l-2 border-green-500'
            : part.removed
              ? 'bg-red-900/20 text-red-300 border-l-2 border-red-500 line-through decoration-red-500/30 opacity-70'
              : 'text-gray-500';

          return (
            <span key={index} className={`block whitespace-pre-wrap ${colorClass} px-2`}>
              {part.value}
            </span>
          );
        })}
      </div>
    </div>
  );
};
// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-nexus-900 border border-nexus-700 rounded-xl shadow-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200 ${className.includes('max-w-') ? className : `max-w-lg ${className}`}`}>
        {(title || onClose) && (
          <div className="flex justify-between items-center p-4 border-b border-nexus-800 bg-nexus-800/30">
            {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};