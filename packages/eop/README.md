# @node-jhora/eop

Optional IERS Earth-orientation data for the **`truth`** precision profile:

- **UT1−UTC** from IERS `finals2000A.all` (observed + Bulletin A predictions)
- **Polar motion** xp / yp (arcseconds) from the same table

Without this package, `precisionProfile: 'truth'` keeps UTC in place of UT1 for sidereal time (~14″ bound documented in ADR 0028).

## Install

```bash
npm install @node-jhora/eop
```

## Node usage

```javascript
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseEopBin, setIersEopTable } from '@node-jhora/eop';
import { EphemerisEngine } from '@node-jhora/core';

const require = createRequire(import.meta.url);
const binPath = require.resolve('@node-jhora/eop/eop.bin');
setIersEopTable(parseEopBin(readFileSync(binPath)));

await EphemerisEngine.getInstance().initialize();
```

## Refresh

Maintainers:

```bash
pnpm --filter @node-jhora/eop run fetch
pnpm --filter @node-jhora/eop run pack-data
```

Commit updated `eop.bin` when source SHA pins change.
