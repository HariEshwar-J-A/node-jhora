// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import noBodyNumericLiteral from './tools/eslint/no-body-numeric-literal.cjs';

/** Browser-targeted library source (engine must run in the browser). */
const browserSourceFiles = [
    'packages/core/src/**/*.ts',
    'packages/testkit/src/compare.ts',
    'packages/testkit/src/report.ts',
];

const nodeOnlyImportPaths = [
    { name: 'fs', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'path', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'module', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:fs', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:path', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:module', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:crypto', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:buffer', message: 'Node built-in — not allowed in browser-targeted source.' },
    { name: 'node:process', message: 'Node built-in — not allowed in browser-targeted source.' },
];

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/*.bsp',
            '**/coverage/**',
            'packages/ephe/de440s.bsp',
            '**/tests/**',
            '**/*.test.ts',
            '**/*.spec.ts',
            'tools/**',
            'scripts/**',
            'packages/**/scripts/**',
            'packages/ephe/download.mjs',
            '**/jest.config.js',
            'packages/core/node/**/*.d.ts',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['**/*.{ts,mjs,cjs,js}'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/no-namespace': 'off',
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },
    {
        files: ['**/*.mjs', '**/*.cjs'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: browserSourceFiles,
        rules: {
            'no-restricted-imports': ['error', { paths: nodeOnlyImportPaths }],
            'no-restricted-globals': [
                'error',
                { name: 'Buffer', message: 'Use Uint8Array in browser-targeted source.' },
                { name: 'process', message: 'Not available in browser-targeted source.' },
            ],
        },
    },
    {
        files: ['packages/*/src/**/*.ts'],
        ignores: ['packages/core/src/**'],
        plugins: {
            'node-jhora': {
                rules: {
                    'no-body-numeric-literal': noBodyNumericLiteral,
                },
            },
        },
        rules: {
            'node-jhora/no-body-numeric-literal': 'error',
        },
    },
);
