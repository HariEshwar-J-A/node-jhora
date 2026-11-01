export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/../../tools/jest-bsp-setup.mjs'],
    extensionsToTreatAsEsm: ['.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@node-jhora/core/chebyshev$': '<rootDir>/src/engine/chebyshev.ts',
        '^@node-jhora/core/vargas$': '<rootDir>/src/vedic/vargas.ts',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
};
