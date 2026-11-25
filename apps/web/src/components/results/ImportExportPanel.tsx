import { useRef, useState } from 'react';
import { useI18n, type MessageKey } from '../../i18n';
import { getWorker } from '../../lib/worker-client';

export function ImportExportPanel() {
    const { t } = useI18n();
    // Keys (not text) so a language switch re-words the last message.
    const [status, setStatus] = useState<MessageKey>();
    const [error, setError] = useState<{ key: MessageKey } | { raw: string }>();
    const jhdInput = useRef<HTMLInputElement>(null);
    const njhInput = useRef<HTMLInputElement>(null);

    const readFile = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });

    const download = (filename: string, text: string) => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="card grid-2" data-testid="panel-import">
            <div>
                <h3>{t('io.jhdTitle')}</h3>
                <p className="import-hint">{t('io.jhdHint')}</p>
                <input ref={jhdInput} type="file" accept=".jhd,text/plain" />
                <div className="import-actions">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={async () => {
                            setError(undefined);
                            const file = jhdInput.current?.files?.[0];
                            if (!file) {
                                setError({ key: 'io.jhdChoose' });
                                return;
                            }
                            try {
                                const text = await readFile(file);
                                const parsed = await getWorker().parseJhdText(text);
                                const out = await getWorker().writeJhdText(parsed);
                                download(file.name.replace(/\.jhd$/i, '') + '-roundtrip.jhd', out);
                                setStatus('io.jhdDone');
                            } catch (e) {
                                setError({ raw: String(e) });
                            }
                        }}
                    >
                        {t('io.jhdRun')}
                    </button>
                </div>
            </div>
            <div>
                <h3>{t('io.njhTitle')}</h3>
                <p className="import-hint">{t('io.njhHint')}</p>
                <input ref={njhInput} type="file" accept=".njh,text/plain" />
                <div className="import-actions">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={async () => {
                            setError(undefined);
                            const file = njhInput.current?.files?.[0];
                            if (!file) {
                                setError({ key: 'io.njhChoose' });
                                return;
                            }
                            try {
                                const text = await readFile(file);
                                const parsed = await getWorker().parseNjhText(text);
                                const out = await getWorker().serializeNjhText(parsed);
                                download(file.name.replace(/\.njh$/i, '') + '-serialized.njh', out);
                                setStatus('io.njhDone');
                            } catch (e) {
                                setError({ raw: String(e) });
                            }
                        }}
                    >
                        {t('io.njhRun')}
                    </button>
                </div>
            </div>
            {status && <p className="import-status">{t(status)}</p>}
            {error && (
                <p role="alert" className="form-error">
                    {'key' in error ? t(error.key) : error.raw}
                </p>
            )}
        </div>
    );
}
