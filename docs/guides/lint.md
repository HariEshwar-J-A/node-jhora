# Lint and format

## ESLint (flat config)

Root config: `eslint.config.js` (ESLint 9 flat config, `typescript-eslint` recommended rules with `no-floating-promises` and import sorting). Stricter `strict-type-checked` rules land progressively in follow-up tasks; legacy `no-unused-vars` findings are warnings until cleaned up.

From the repository root:

```bash
pnpm lint          # every workspace package: eslint .
pnpm --filter @node-jhora/core lint
```

### Rule highlights

| Rule                                              | Purpose                                                                                                                      |
| :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-floating-promises`         | Unhandled async work must be awaited or voided explicitly.                                                                   |
| `simple-import-sort/*`                            | Stable import/export ordering.                                                                                               |
| `no-restricted-imports` / `no-restricted-globals` | **Browser-targeted source only** — blocks `fs`, `path`, `node:*`, `Buffer`, and `process`.                                   |
| `node-jhora/no-body-numeric-literal`              | **Non-core packages** — use `Body` from `@node-jhora/core` instead of raw `0`–`6`, `10`, or `99` in `planet.id` comparisons. |

Browser-targeted paths (engine must run in the browser):

- `packages/core/src/**`
- `packages/testkit/src/compare.ts`, `packages/testkit/src/report.ts`

Node-only code (filesystem BSP loader, API, CLI, `tools/`, `scripts/`, tests) is outside those paths and may use Node built-ins.

### Node ephemeris kernel

`EphemerisEngine.initialize()` loads in-memory BSP bytes. In Node, register the filesystem loader once before `initialize()`:

```js
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register.mjs';

await registerNodeBspLoaderFromCore();
await EphemerisEngine.getInstance().initialize();
```

In the browser, pass `initialize({ kernel: Uint8Array })` from `fetch(...).arrayBuffer()`.

## Prettier

Config: `.prettierrc.json`, ignore: `.prettierignore`.

```bash
pnpm run format:check   # Prettier --check on the whole tree (.prettierignore applies)
pnpm exec prettier --write .   # apply formatting locally
```
