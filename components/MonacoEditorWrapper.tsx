
import React, { useEffect, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';


interface MonacoEditorProps {
    code: string;
    language?: string;
    onChange: (value: string | undefined) => void;
    readOnly?: boolean;
    minimap?: boolean;
    diffMode?: boolean; // For Audit View
    originalCode?: string; // For Diff Mode
}

export const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
    code,
    language = 'cashscript',
    onChange,
    readOnly = false,
    minimap = true,
    diffMode = false,
    originalCode = ''
}) => {

    // Register CashScript Language on Mount
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        // Define CashScript Language
        if (!monaco.languages.getLanguages().some(l => l.id === 'cashscript')) {
            monaco.languages.register({ id: 'cashscript' });

            // Syntax Highlighting Rules
            monaco.languages.setMonarchTokensProvider('cashscript', {
                tokenizer: {
                    root: [
                        [/\b(contract|function|constructor|require|new|emit)\b/, 'keyword'],
                        [/\b(int|string|bool|bytes|pubkey|sig)\b/, 'type'],
                        [/\b(p2pkh|p2sh|checkSig|checkMultiSig|hash160|ripemd160|sha256)\b/, 'predefined'],
                        [/\b(true|false)\b/, 'constant'],
                        [/\d+/, 'number'],
                        [/"[^"]*"/, 'string'],
                        [/\/\/.*/, 'comment'],
                    ]
                }
            });

            // Auto-completion Provider (LSP-lite)
            monaco.languages.registerCompletionItemProvider('cashscript', {
                provideCompletionItems: (model, position) => {
                    const suggestions = [
                        {
                            label: 'contract',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'contract ${1:Name}(${2:params}) {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Define a new CashScript contract'
                        },
                        {
                            label: 'function',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'function ${1:name}(${2:params}) {\n\trequire(${3:check});\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Define a contract function'
                        },
                        {
                            label: 'require',
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: 'require(${1:condition});',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Assert a condition is true'
                        }
                    ];
                    return { suggestions: suggestions };
                }
            });
        }

        // Define NexOps Theme
        monaco.editor.defineTheme('nexops-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: '#00D8FF', fontStyle: 'bold' }, // Nexus Cyan
                { token: 'type', foreground: '#FF00FF' },
                { token: 'predefined', foreground: '#4ade80' }, // Green for built-ins
                { token: 'string', foreground: '#F4B658' },
                { token: 'comment', foreground: '#64748b', fontStyle: 'italic' }
            ],
            colors: {
                'editor.background': '#0f172a', // nexus-900
                'editor.lineHighlightBackground': '#1e293b',
                'editorCursor.foreground': '#00D8FF',
            }
        });

        monaco.editor.setTheme('nexops-dark');
    };

    const options = {
        readOnly,
        minimap: { enabled: minimap },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        wordWrap: 'on' as const, // Soft wrap by default
        automaticLayout: true,
        renderLineHighlight: 'all' as const,
    };

    if (diffMode) {
        return (
            <Editor
                height="100%"
                language={language}
                theme="nexops-dark"
                original={originalCode}
                modified={code}
                onMount={handleEditorDidMount}
                options={{ ...options, readOnly: true }} // Diff is usually read-only
            />
        );
    }

    return (
        <Editor
            height="100%"
            defaultLanguage="cashscript"
            language={language}
            theme="nexops-dark"
            value={code}
            onChange={onChange}
            onMount={handleEditorDidMount}
            options={options}
        />
    );
};
