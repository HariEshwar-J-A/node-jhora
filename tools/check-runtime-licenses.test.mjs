/**
 * Unit tests for runtime licence guard.
 *   node --test tools/check-runtime-licenses.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isForbiddenCopyleftLicense } from './check-runtime-licenses.mjs';

test('detects GPL and AGPL SPDX ids', () => {
    assert.equal(isForbiddenCopyleftLicense('GPL-3.0-only'), true);
    assert.equal(isForbiddenCopyleftLicense('AGPL-3.0'), true);
    assert.equal(isForbiddenCopyleftLicense('GPL-2.0-or-later'), true);
    assert.equal(isForbiddenCopyleftLicense('(MIT OR GPL-3.0-only)'), true);
});

test('permits permissive licences', () => {
    assert.equal(isForbiddenCopyleftLicense('MIT'), false);
    assert.equal(isForbiddenCopyleftLicense('Apache-2.0'), false);
    assert.equal(isForbiddenCopyleftLicense('BSD-3-Clause'), false);
    assert.equal(isForbiddenCopyleftLicense('ISC'), false);
    assert.equal(isForbiddenCopyleftLicense('LicenseRef-NodeJHora-Source-Available'), false);
});

test('handles missing or UNLICENSED', () => {
    assert.equal(isForbiddenCopyleftLicense(undefined), false);
    assert.equal(isForbiddenCopyleftLicense('UNLICENSED'), false);
});
