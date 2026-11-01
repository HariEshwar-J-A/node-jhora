# Bun quickstart

Use the same install and build steps as [Node](./node.md). From `packages/core` (so Bun shares the package’s `luxon` resolution with the built engine), register the Node BSP loader and call the engine:

```bash
cd packages/core
export NODE_JHORA_EPHE_PATH="$(node -p "require.resolve('@node-jhora/ephe/de440s.bsp')")"
bun -e "
import { registerNodeBspLoaderFromCore } from './node/register.mjs';
await registerNodeBspLoaderFromCore();
import { EphemerisEngine } from './dist/index.js';
import { parseEngineDateTimeOrJsDate } from './dist/validation/input.js';
const eph = EphemerisEngine.getInstance();
await eph.initialize();
const when = parseEngineDateTimeOrJsDate(new Date('2000-01-01T12:00:00.000Z'));
console.log(eph.getPlanets(when, { latitude: 51.476852, longitude: -0.0005 }).length);
"
```

CI runs `node tools/runtime-smoke-bun.mjs` from the repo root after `pnpm build`.

Ephemeris data resolves via `@node-jhora/ephe` (postinstall download) or `NODE_JHORA_EPHE_PATH`.
