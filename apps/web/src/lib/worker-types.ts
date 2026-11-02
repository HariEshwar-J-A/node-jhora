export interface InitProgress {
    phase: 'checking-cache' | 'downloading' | 'ready' | 'error';
    loadedBytes?: number;
    totalBytes?: number;
    message?: string;
}

export interface BirthInput {
    instantIso: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    settings: import('@node-jhora/core').SettingsInput;
    houseSystem?: string;
    ephemerisUrl: string;
    timezone: string;
    customVarga?: number;
    dashaDepth?: number;
}
