import { useState } from 'react';

export function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);
    async function copy() {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    return (
        <div className="code-block">
            <div className="code-block__bar">
                <span className="mono">{language}</span>
                <button type="button" className="code-block__copy" onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre>
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
}
