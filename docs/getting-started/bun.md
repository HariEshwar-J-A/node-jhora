# Bun quickstart

Use the same install and build steps as [Node](./node.md). Bun runs the ESM packages directly after `pnpm build`:

```bash
bun --eval "
import { EphemerisEngine } from '@node-jhora/core';
const eph = EphemerisEngine.getInstance();
await eph.initialize();
console.log(eph.getPlanets('2000-01-01T12:00:00+05:30', { latitude: 13.0827, longitude: 80.2707 }).length);
"
```

Ephemeris data resolves via `@node-jhora/ephe` (postinstall download) or `NODE_JHORA_EPHE_PATH`.
