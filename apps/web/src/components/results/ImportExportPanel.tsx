import { useRef, useState } from 'react';
import { getWorker } from '../../lib/worker-client';

export function ImportExportPanel() {
    const [status, setStatus] = useState<string>();
    const [error, setError] = useState<string>();
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
                <h3>JHD import / export</h3>
                <p className="import-hint">
                    Upload a .jhd file to validate and download a round-trip.
                </p>
                <input ref={jhdInput} type="file" accept=".jhd,text/plain" />
                <div className="import-actions">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={async () => {
                            setError(undefined);
                            const file = jhdInput.current?.files?.[0];
                            if (!file) {
                                setError('Choose a JHD file first.');
                                return;
                            }
                            try {
                                const text = await readFile(file);
                                const parsed = await getWorker().parseJhdText(text);
                                const out = await getWorker().writeJhdText(parsed);
                                download(file.name.replace(/\.jhd$/i, '') + '-roundtrip.jhd', out);
                                setStatus('JHD round-trip downloaded.');
                            } catch (e) {
                                setError(String(e));
                            }
                        }}
                    >
                        Validate &amp; download
                    </button>
                </div>
            </div>
            <div>
                <h3>NJH import / export</h3>
                <p className="import-hint">Upload a .njh chart file to serialize and download.</p>
                <input ref={njhInput} type="file" accept=".njh,text/plain" />
                <div className="import-actions">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={async () => {
                            setError(undefined);
                            const file = njhInput.current?.files?.[0];
                            if (!file) {
                                setError('Choose an NJH file first.');
                                return;
                            }
                            try {
                                const text = await readFile(file);
                                const parsed = await getWorker().parseNjhText(text);
                                const out = await getWorker().serializeNjhText(parsed);
                                download(file.name.replace(/\.njh$/i, '') + '-serialized.njh', out);
                                setStatus('NJH serialize downloaded.');
                            } catch (e) {
                                setError(String(e));
                            }
                        }}
                    >
                        Parse &amp; download
                    </button>
                </div>
            </div>
            {status && <p className="import-status">{status}</p>}
            {error && (
                <p role="alert" className="form-error">
                    {error}
                </p>
            )}
        </div>
    );
}
