/** Supported DE440s coverage (packages/core/src/browser/constants.ts, engine provider). */
export const KERNEL_DATE_MIN = '1849-12-26';
export const KERNEL_DATE_MAX = '2150-01-22';

export const NAMED_VARGA_DIVISIONS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144, 150,
] as const;

export const CONTACT_URL = 'https://harieshwar.dev/#contact';
export const CONTACT_EMAIL = 'harieshwar.dev@gmail.com';

export const EPHE_PATH = `${import.meta.env.BASE_URL}ephe/de440s.bsp`;

export const SAMPLE_CHART = {
    label: 'Sample (Greenwich, fictional)',
    date: '2000-01-01',
    time: '12:00',
    timezone: 'UTC',
    latitude: 51.4769,
    longitude: -0.0005,
};
