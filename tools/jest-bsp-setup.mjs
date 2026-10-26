/**
 * Shared Jest setup: register Node BSP loader for EphemerisEngine tests.
 */
import { registerNodeBspLoader } from '../packages/core/node/register.mjs';
import { setBspBytesLoader } from '../packages/core/src/engine/bsp-bytes-provider.js';

registerNodeBspLoader(setBspBytesLoader);
