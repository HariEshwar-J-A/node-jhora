import { createDefaultEsmPreset } from 'ts-jest';

const defaultEsmPreset = createDefaultEsmPreset();

export default {
    ...defaultEsmPreset,
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/../../tools/jest-bsp-setup.mjs'],
    moduleNameMapper: {
        '^@node-jhora/core$': '<rootDir>/../core/src/index.ts',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    rootDir: '.',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    transform: {
        ...defaultEsmPreset.transform,
    },
    extensionsToTreatAsEsm: ['.ts'],
};
