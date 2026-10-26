/**
 * Human-readable and machine-readable golden diff reports (browser-safe).
 */

import type { GoldenCompareResult, PathCompareResult } from './compare.js';

export interface GoldenReportJson {
    id: string;
    pass: boolean;
    failureCount: number;
    paths: PathCompareResult[];
    worstByFeature: GoldenCompareResult['worstByFeature'];
}

export function goldenCompareResultToJson(result: GoldenCompareResult): GoldenReportJson {
    return {
        id: result.id,
        pass: result.pass,
        failureCount: result.failures.length,
        paths: result.paths,
        worstByFeature: result.worstByFeature,
    };
}

function formatPathLine(row: PathCompareResult): string {
    if (row.pass) {
        return `  ✓ ${row.path}`;
    }
    const delta = row.delta === null ? '' : ` Δ=${row.delta.toFixed(4)}${row.toleranceType === 'arcsec' ? '″' : row.toleranceType === 'seconds' ? ' s' : ''}`;
    const limit = row.toleranceLimit === null ? '' : ` (limit ${row.toleranceLimit}${row.toleranceType === 'arcsec' ? '″' : row.toleranceType === 'seconds' ? ' s' : ''})`;
    return `  ✗ ${row.path}${delta}${limit} — ${row.message}\n      expected ${JSON.stringify(row.expected)} actual ${JSON.stringify(row.actual)}`;
}

/** Plain-text report suitable for Jest assertion failures and CI logs. */
export function formatGoldenReportText(result: GoldenCompareResult): string {
    const lines = [
        `Golden case ${result.id}: ${result.pass ? 'PASS' : 'FAIL'} (${result.failures.length} path(s) out of tolerance)`,
    ];
    if (result.worstByFeature.length > 0) {
        lines.push('', 'Worst offenders by feature:');
        for (const row of result.worstByFeature) {
            const unit = row.toleranceType === 'arcsec' ? '″' : ' s';
            lines.push(
                `  • ${row.featureId}: ${row.path} |Δ|=${Math.abs(row.delta).toFixed(4)}${unit} / limit ${row.toleranceLimit}${unit} (${row.ratio.toFixed(2)}×)`,
            );
        }
    }
    if (!result.pass) {
        lines.push('', 'Failures:');
        for (const row of result.failures) {
            lines.push(formatPathLine(row));
        }
    }
    return `${lines.join('\n')}\n`;
}

/** Markdown fragment for PR comments and CI artifacts. */
export function formatGoldenReportMarkdown(result: GoldenCompareResult): string {
    const lines = [
        `## Golden \`${result.id}\``,
        '',
        `**${result.pass ? 'PASS' : 'FAIL'}** — ${result.failures.length} path(s) out of tolerance.`,
    ];
    if (result.worstByFeature.length > 0) {
        lines.push('', '### Worst offenders by feature', '', '| Feature | Path | |Δ| | Limit | Ratio |', '| --- | --- | ---: | ---: | ---: |');
        for (const row of result.worstByFeature) {
            lines.push(
                `| \`${row.featureId}\` | \`${row.path}\` | ${Math.abs(row.delta).toFixed(4)} | ${row.toleranceLimit} | ${row.ratio.toFixed(2)}× |`,
            );
        }
    }
    if (!result.pass) {
        lines.push('', '### Failures', '', '| Path | Message | Expected | Actual |', '| --- | --- | --- | --- |');
        for (const row of result.failures) {
            lines.push(
                `| \`${row.path}\` | ${row.message} | ${JSON.stringify(row.expected)} | ${JSON.stringify(row.actual)} |`,
            );
        }
    }
    return `${lines.join('\n')}\n`;
}

/** Minimal HTML table for CI artifact upload. */
export function formatGoldenReportHtml(result: GoldenCompareResult): string {
    const esc = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const rows = result.paths.map((row) => {
        const status = row.pass ? 'pass' : 'fail';
        return `<tr class="${status}"><td>${esc(row.path)}</td><td>${status}</td><td>${esc(String(row.delta ?? ''))}</td><td>${esc(row.message)}</td><td>${esc(JSON.stringify(row.expected))}</td><td>${esc(JSON.stringify(row.actual))}</td></tr>`;
    }).join('\n');
    const worst = result.worstByFeature.map((row) =>
        `<li><strong>${esc(row.featureId)}</strong> <code>${esc(row.path)}</code> ratio ${row.ratio.toFixed(2)}×</li>`,
    ).join('\n');
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Golden ${esc(result.id)}</title>
<style>body{font-family:system-ui,sans-serif;margin:1rem} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:.35rem .5rem;font-size:.9rem} tr.fail{background:#fee} tr.pass{color:#363}</style>
</head><body>
<h1>Golden case ${esc(result.id)}</h1>
<p><strong>${result.pass ? 'PASS' : 'FAIL'}</strong> (${result.failures.length} failures)</p>
${worst ? `<h2>Worst by feature</h2><ul>${worst}</ul>` : ''}
<table><thead><tr><th>Path</th><th>Status</th><th>Δ</th><th>Message</th><th>Expected</th><th>Actual</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>\n`;
}
