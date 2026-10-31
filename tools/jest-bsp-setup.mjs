/**
 * Shared Jest setup: register Node BSP loader for EphemerisEngine tests.
 * Package tests compile core from src; tools/oracles may import dist — register both.
 */
import { registerNodeBspLoader } from '../packages/core/node/register.mjs';
import { setBspBytesLoader as setDistBspBytesLoader } from '../packages/core/dist/engine/bsp-bytes-provider.js';
import { setBspBytesLoader as setSrcBspBytesLoader } from '../packages/core/src/engine/bsp-bytes-provider.js';

registerNodeBspLoader(setSrcBspBytesLoader);
registerNodeBspLoader(setDistBspBytesLoader);
