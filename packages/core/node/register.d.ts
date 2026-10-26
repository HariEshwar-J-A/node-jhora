import type { ResolveDe440sOptions } from './ephemeris.js';

export function registerNodeBspLoader(
    setBspBytesLoader: (loader: () => Promise<Uint8Array>) => void,
    options?: ResolveDe440sOptions,
): void;

export function registerNodeBspLoaderFromCore(options?: ResolveDe440sOptions): Promise<void>;
