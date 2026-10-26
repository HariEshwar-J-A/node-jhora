# Security audit log

This document records `pnpm audit` triage for the node-jhora monorepo. CI runs
`pnpm audit --audit-level=high` on every pull request (see
`.github/workflows/security.yml`).

## 2026-10-26 — E1-S5-T4 baseline

| Severity | Count (before) | Count (after) | Action |
| --- | ---: | ---: | --- |
| critical | 0 | 0 | — |
| high | 1 | 0 | Resolved |
| moderate | 0 | 0 | — |
| low | 0 | 0 | — |

### Resolved: GHSA-mrhx-c7xc-m3w5 (Zod memory exhaustion)

- **Module:** `zod` (versions before 4.6.6)
- **Paths:** `@node-jhora/api`, `@node-jhora/core`, and transitive copies under
  `fastify-type-provider-zod` / `zod-to-json-schema`.
- **Fix:** Pin `zod@4.6.7` across workspace packages and upgrade
  `fastify-type-provider-zod` to v7 (Zod 4 peer). API error handler updated for
  Zod 4 (`ZodError.issues` instead of `.errors`).
- **Verification:** `pnpm audit` reports no known vulnerabilities; API integration
  tests and golden suites unchanged.

### Documented exceptions

None at this time. Any high or critical advisory that cannot be patched safely
must be listed here with GHSA id, affected paths, risk acceptance, and planned
remediation.

## Runtime licence policy

Production dependencies must not ship AGPL or GPL code (Swiss Ephemeris and
similar stacks are explicitly out of scope for this engine). CI enforces this
with `pnpm run check:licenses` and `tools/runtime-license-allowlist.json`.
