import { useState } from 'react';
import { useI18n } from '../i18n';

export function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
    const { t } = useI18n();
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
                    {copied ? t('common.copied') : t('common.copy')}
                </button>
            </div>
            <pre>
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
}
