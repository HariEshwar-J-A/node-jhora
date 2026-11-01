import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Documents ESM-only publishing until a dual CJS emit + attw profile is added.
 * See ADR docs/decisions/0031-subpath-exports-and-esm-only.md.
 */
describe('CommonJS require', () => {
    test('createRequire(@node-jhora/core) fails without a require export', () => {
        const require = createRequire(
            fileURLToPath(new URL('../../package.json', import.meta.url)),
        );
        expect(() => {
            require('@node-jhora/core');
        }).toThrow(/ERR_PACKAGE_PATH_NOT_EXPORTED|Cannot find module/);
    });
});
