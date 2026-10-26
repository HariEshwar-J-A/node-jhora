export function registerNodeBspLoader(
    setBspBytesLoader: (loader: () => Promise<Uint8Array>) => void,
): void;

export function registerNodeBspLoaderFromCore(): Promise<void>;
