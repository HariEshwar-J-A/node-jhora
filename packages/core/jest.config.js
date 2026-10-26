export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/../../tools/jest-bsp-setup.mjs'],
    extensionsToTreatAsEsm: ['.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
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
