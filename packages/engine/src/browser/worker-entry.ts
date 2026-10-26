import * as Comlink from 'comlink';

import { collectInWorker, collectOffline, initWorker } from './worker-api.js';

Comlink.expose({
    initWorker,
    collectInWorker,
    collectOffline,
});
