/**
 * Registry catalogues for the docs site. Ayanamsas are derived from @node-jhora/core
 * source (loaded via jiti). Varga, dasa, and yoga catalogues are stubs until
 * E4-S1 registry generators land.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jiti from 'jiti';
import { REPO_ROOT, GENERATED_CATALOGUES } from './lib/paths.mjs';

const jitiImport = jiti(import.meta.url, { interopDefault: true });

const schema = jitiImport(path.join(REPO_ROOT, 'packages/core/src/settings/schema.ts'));
const ayanamsaModule = jitiImport(path.join(REPO_ROOT, 'packages/core/src/engine/ayanamsa.ts'));
const { AYANAMSA_IDS, AYANAMSA_MODE_BY_ID } = schema;
const { AYANAMSA_MODELS } = ayanamsaModule;

const AYANAMSA_TS = await fs.readFile(
    path.join(REPO_ROOT, 'packages/core/src/engine/ayanamsa.ts'),
    'utf8',
);

/** Pull inline // comments on the same line as a model entry. */
function lineCommentForMode(mode) {
    const re = new RegExp(`^\\s*${mode}:\\s*\\{[^}]+\\},?\\s*//\\s*(.+)$`, 'm');
    const m = AYANAMSA_TS.match(re);
    return m ? m[1].trim() : null;
}

function describeModel(mode, model) {
    if (!model)
        return {
            kind: 'fallback',
            detail: 'No registry entry; `getAyanamsa` uses True Chitrapaksha (mode 27).',
        };
    if (model.kind === 'star') {
        return {
            kind: 'star-defined',
            detail: `${model.label}. Sidereal zero point pinned by placing the named star at ${model.atLongitude}°.`,
            citation:
                'Star catalogue and proper-motion handling: `packages/core/src/engine/ayanamsa.ts` (`STARS`, `starLongitudeOfDate`). IAU 2006 precession via `precession.ts`.',
        };
    }
    const src = model.source ?? 'definition';
    const line = lineCommentForMode(mode);
    return {
        kind: 'epoch-defined',
        detail: `${model.label}. Anchor ${model.value}° at JD ${model.jd}.`,
        citation: line
            ? `Engine note: ${line}`
            : `Provenance tag in code: \`source: '${src}'\` on the epoch model in \`ayanamsa.ts\`.`,
    };
}

function mdTable(rows) {
    const header = '| Setting id | SE mode | Kind | Summary |\n| --- | ---: | --- | --- |';
    const lines = rows.map((r) => `| \`${r.id}\` | ${r.mode} | ${r.kind} | ${r.summary} |`);
    return [header, ...lines].join('\n');
}

async function writeAyanamsaCatalogue() {
    const rows = [];
    const sections = [];

    for (const id of AYANAMSA_IDS) {
        const mode = AYANAMSA_MODE_BY_ID[id];
        const model = AYANAMSA_MODELS[mode];
        const info = describeModel(mode, model);
        rows.push({
            id,
            mode,
            kind: info.kind,
            summary: model?.label ?? 'Falls back to True Chitrapaksha',
        });

        sections.push(
            `### \`${id}\` (mode ${mode})\n\n${info.detail}\n\n${info.citation ? `**Citation:** ${info.citation}\n` : ''}`,
        );
    }

    const body = `---
title: Ayanamsa catalogue
description: Supported sidereal zero-point models, generated from the core engine registry.
---

This page is generated at docs build time from \`packages/core/src/settings/schema.ts\` and \`packages/core/src/engine/ayanamsa.ts\`. Edit those files; do not edit this page by hand.

## Overview

Star-defined models derive the ayanamsa from a fixed star at a declared sidereal longitude (Drik / observational). Epoch-defined models anchor a value at a Julian day and propagate by precession. The project default is **True Chitrapaksha** (\`true_citra\`, mode 27).

${mdTable(rows)}

## Per-model notes

${sections.join('\n')}
`;

    await fs.mkdir(GENERATED_CATALOGUES, { recursive: true });
    await fs.writeFile(path.join(GENERATED_CATALOGUES, 'ayanamsas.md'), body, 'utf8');
}

async function writeStub(name, title, blurb) {
    const body = `---
title: ${JSON.stringify(title)}
description: Placeholder catalogue; a generator script will replace this content.
---

${blurb}

> **Stub:** This catalogue will be filled automatically once the varga, dasa, and yoga registries (E4-S1) expose machine-readable metadata in \`packages/core\`.
`;
    await fs.writeFile(path.join(GENERATED_CATALOGUES, `${name}.md`), body, 'utf8');
}

export async function generateCatalogues() {
    await fs.mkdir(GENERATED_CATALOGUES, { recursive: true });
    await writeAyanamsaCatalogue();
    await writeStub(
        'vargas',
        'Varga catalogue',
        'Divisional chart definitions (D1–D60 and variants) will be listed here with scheme ids and literature citations.',
    );
    await writeStub(
        'dasas',
        'Dasa catalogue',
        'Vimshottari, Yogini, Narayana, Chara, and future dasa systems will be listed here with year-length options and seed rules.',
    );
    await writeStub(
        'yogas',
        'Yoga catalogue',
        'Rule-based yogas from `@node-jhora/analytics` will be exported here with predicate summaries and sources.',
    );
}

if (import.meta.url === `file://${process.argv[1]}`) {
    generateCatalogues().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
