#!/usr/bin/env node
/**
 * Parse the GitHub issue forms and check the PR template and CODEOWNERS.
 * Uses js-yaml from node_modules when it is installed, otherwise PyYAML.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = join(root, '.github', 'ISSUE_TEMPLATE');
const REQUIRED_IDS = [
    'context',
    'goal',
    'acceptance-criteria',
    'files-likely-touched',
    'test-requirements',
    'dependencies',
    'size',
];
const BODY_TYPES = new Set(['markdown', 'textarea', 'input', 'dropdown', 'checkboxes']);
const FORM_FILES = ['epic.yml', 'story.yml', 'task.yml', 'bug.yml'];

const failures = [];

function fail(message) {
    failures.push(message);
}

function parseYaml(text, file) {
    try {
        const require = createRequire(import.meta.url);
        const yaml = require('js-yaml');
        return yaml.load(text);
    } catch {
        const py = spawnSync(
            'python3',
            ['-c', 'import json, sys, yaml\njson.dump(yaml.safe_load(sys.stdin.read()), sys.stdout)'],
            { input: text, encoding: 'utf8' },
        );
        if (py.status !== 0) {
            throw new Error(`${file}: YAML parse failed\n${py.stderr || py.stdout}`);
        }
        return JSON.parse(py.stdout);
    }
}

function load(file) {
    const text = readFileSync(file, 'utf8');
    if (!text.trim()) {
        fail(`${file}: empty file`);
        return undefined;
    }
    try {
        return parseYaml(text, file);
    } catch (error) {
        fail(String(error.message || error));
        return undefined;
    }
}

function checkForm(file, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        fail(`${file}: root must be a mapping`);
        return;
    }
    if (typeof data.name !== 'string' || !data.name.trim()) fail(`${file}: name must be a string`);
    if (typeof data.description !== 'string' || !data.description.trim()) {
        fail(`${file}: description must be a string`);
    }
    if (!Array.isArray(data.body) || data.body.length === 0) {
        fail(`${file}: body must be a non-empty list`);
        return;
    }

    const ids = new Set();
    for (const [index, item] of data.body.entries()) {
        const where = `${file} body[${index}]`;
        if (!item || typeof item !== 'object') {
            fail(`${where}: must be a mapping`);
            continue;
        }
        if (!BODY_TYPES.has(item.type)) fail(`${where}: unsupported type ${String(item.type)}`);
        const attrs = item.attributes;
        if (!attrs || typeof attrs !== 'object') {
            fail(`${where}: missing attributes`);
            continue;
        }
        if (item.type === 'markdown') {
            if (typeof attrs.value !== 'string' || !attrs.value.trim()) {
                fail(`${where}: markdown needs attributes.value`);
            }
            continue;
        }
        if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.id)) {
            fail(`${where}: id must match [A-Za-z0-9_-]+`);
        } else if (ids.has(item.id)) {
            fail(`${where}: duplicate id ${item.id}`);
        } else {
            ids.add(item.id);
        }
        if (typeof attrs.label !== 'string' || !attrs.label.trim()) {
            fail(`${where}: missing attributes.label`);
        }
        if (item.type === 'dropdown') {
            if (!Array.isArray(attrs.options) || attrs.options.length === 0) {
                fail(`${where}: dropdown needs options`);
            } else if (attrs.options.some((option) => typeof option !== 'string')) {
                fail(`${where}: dropdown options must be strings`);
            }
        }
        if (item.type === 'checkboxes') {
            if (!Array.isArray(attrs.options) || attrs.options.length === 0) {
                fail(`${where}: checkboxes need options`);
            }
        }
    }

    for (const id of REQUIRED_IDS) {
        if (!ids.has(id)) fail(`${file}: missing field id ${id}`);
    }
}

let present;
try {
    present = new Set(readdirSync(templateDir));
} catch {
    fail(`missing directory ${templateDir}`);
    present = new Set();
}

for (const name of FORM_FILES) {
    if (!present.has(name)) {
        fail(`missing ${name}`);
        continue;
    }
    const data = load(join(templateDir, name));
    if (data !== undefined) checkForm(name, data);
}

if (!present.has('config.yml')) {
    fail('missing config.yml');
} else {
    const config = load(join(templateDir, 'config.yml'));
    if (config === undefined) {
        // load() already recorded the parse error.
    } else if (!config || typeof config !== 'object' || Array.isArray(config)) {
        fail('config.yml: root must be a mapping');
    } else if (typeof config.blank_issues_enabled !== 'boolean') {
        fail('config.yml: blank_issues_enabled must be a boolean');
    } else if (config.blank_issues_enabled === false) {
        if (!Array.isArray(config.contact_links) || config.contact_links.length === 0) {
            fail('config.yml: contact_links required when blank issues are disabled');
        } else {
            for (const [index, link] of config.contact_links.entries()) {
                for (const key of ['name', 'url', 'about']) {
                    if (typeof link?.[key] !== 'string' || !link[key].trim()) {
                        fail(`config.yml contact_links[${index}]: missing ${key}`);
                    }
                }
                if (typeof link?.url === 'string' && !/^https:\/\//.test(link.url)) {
                    fail(`config.yml contact_links[${index}]: url must be https`);
                }
            }
        }
    }
}

function readRequired(relativePath) {
    try {
        return readFileSync(join(root, relativePath), 'utf8');
    } catch {
        fail(`missing ${relativePath}`);
        return '';
    }
}

const prTemplate = readRequired('.github/pull_request_template.md');
for (const heading of [
    '## Linked issue',
    'Closes #',
    'Backlog ID',
    '## Tests',
    'Golden cases',
    'Changeset',
    '## Docs',
    '## Screenshots',
    '## Risk / rollback notes',
]) {
    if (prTemplate && !prTemplate.includes(heading)) {
        fail(`pull_request_template.md missing ${heading}`);
    }
}

const owners = readRequired('.github/CODEOWNERS');
if (owners && !owners.split('\n').some((line) => /^\*\s+@HariEshwar-J-A\b/.test(line.trim()))) {
    fail('CODEOWNERS must assign * to @HariEshwar-J-A');
}

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}

console.log(`github templates ok (${FORM_FILES.length} issue forms)`);
