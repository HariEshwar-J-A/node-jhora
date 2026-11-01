// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import * as Comlink from 'comlink';

import { collectInWorker, collectOffline, initWorker } from './worker-api.js';

Comlink.expose({
    initWorker,
    collectInWorker,
    collectOffline,
});
