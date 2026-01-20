
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

            // Auto-completion Provider
            monaco.languages.registerCompletionItemProvider('cashscript', {
                provideCompletionItems: (model, position) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };

                    const suggestions = [
                        // -- Keywords --
                        {
                            label: 'contract',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'contract ${1:Name}(${2:params}) {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Define a new CashScript contract',
                            range
                        },
                        {
                            label: 'function',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'function ${1:name}(${2:params}) {\n\trequire(${3:check});\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Define a contract function',
                            range
                        },
                        {
                            label: 'constructor',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'constructor(${1:params}) {\n\t$0\n}',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Contract constructor',
                            range
                        },
                        {
                            label: 'require',
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: 'require(${1:condition});',
                            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Assert a condition is true. If false, the script fails.',
                            range
                        },
                        // -- Types --
                        { label: 'int', kind: monaco.languages.CompletionItemKind.Class, insertText: 'int', range },
                        { label: 'string', kind: monaco.languages.CompletionItemKind.Class, insertText: 'string', range },
                        { label: 'bool', kind: monaco.languages.CompletionItemKind.Class, insertText: 'bool', range },
                        { label: 'bytes', kind: monaco.languages.CompletionItemKind.Class, insertText: 'bytes', range },
                        { label: 'pubkey', kind: monaco.languages.CompletionItemKind.Class, insertText: 'pubkey', range },
                        { label: 'sig', kind: monaco.languages.CompletionItemKind.Class, insertText: 'sig', range },
                        { label: 'datasig', kind: monaco.languages.CompletionItemKind.Class, insertText: 'datasig', range },

                        // -- Global Functions --
                        { label: 'hash160', kind: monaco.languages.CompletionItemKind.Function, insertText: 'hash160(${1:data})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'sha256', kind: monaco.languages.CompletionItemKind.Function, insertText: 'sha256(${1:data})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'checkSig', kind: monaco.languages.CompletionItemKind.Function, insertText: 'checkSig(${1:sig}, ${2:pubkey})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'checkMultiSig', kind: monaco.languages.CompletionItemKind.Function, insertText: 'checkMultiSig([${1:sigs}], [${2:pubkeys}])', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                    ];
                    return { suggestions: suggestions };
                }
            });

            // Hover Provider
            monaco.languages.registerHoverProvider('cashscript', {
                provideHover: (model, position) => {
                    const word = model.getWordAtPosition(position);
                    if (!word) return null;

                    const terms: Record<string, string> = {
                        'hash160': 'Returns the RIPEMD-160 hash of the SHA-256 hash of the input.',
                        'sha256': 'Returns the SHA-256 hash of the input.',
                        'checkSig': 'Checks that the transaction signature matches the public key.',
                        'require': 'Asserts that the condition is true. Fails the script if false.',
                        'int': 'Signed 64-bit integer type.',
                        'string': 'UTF-8 string type.',
                        'pubkey': 'Public key type (33 bytes).',
                        'sig': 'Signature type (65+ bytes).',
                        'contract': 'Defines a new smart contract.',
                        'function': 'Defines a callable function within the contract.',
                        'constructor': 'Initializes the contract with parameters.'
                    };

                    if (terms[word.word]) {
                        return {
                            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                            contents: [
                                { value: `**${word.word}**` },
                                { value: terms[word.word] }
                            ]
                        };
                    }
                    return null;
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
