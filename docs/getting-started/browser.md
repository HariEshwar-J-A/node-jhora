# Browser quickstart

Import `@node-jhora/core/browser` and initialize with fetched kernel bytes (no Node `fs`):

```js
import { EphemerisEngine } from '@node-jhora/core/browser';

const eph = EphemerisEngine.getInstance();
await eph.initialize({ kernel: new Uint8Array(await (await fetch('/de440s.bsp')).arrayBuffer()) });
```

Playwright parity: `pnpm run test:browser` (`apps/browser-harness`).

Bundle size budget (excluding `de440s.bsp`): `pnpm run check:browser-bundle`.
