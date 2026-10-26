import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewriteLinksForTest } from './prepare-content.mjs';

test('rewrites docs and ADR links for Starlight routes', () => {
  const input = [
    '[Arch](./docs/ARCHITECTURE.md)',
    '[ADR](0002-clean-room-policy.md)',
    '[policy](../CLEAN_ROOM.md)',
    '[decisions](decisions/0001-record-architecture-decisions.md)',
  ].join('\n');
  const out = rewriteLinksForTest(input);
  assert.ok(out.includes('](/guides/architecture'));
  assert.ok(out.includes('](/guides/decisions-0002-clean-room-policy'));
  assert.ok(out.includes('](/guides/clean-room'));
  assert.ok(out.includes('](/guides/decisions-0001-record-architecture-decisions'));
});
