import { AYANAMSA_IDS, HOUSE_SYSTEM_IDS } from '@node-jhora/core';
import { SAMPLE_CHART } from './constants';
import { parseBirthInstant } from './format';

export type NodeType = 'true' | 'mean';

export type BirthDraft = {
    name: string;
    date: string;
    time: string;
    timezone: string;
    latitude: string;
    longitude: string;
    place: string;
    ayanamsa: (typeof AYANAMSA_IDS)[number];
    houseSystem: (typeof HOUSE_SYSTEM_IDS)[number];
    nodeType: NodeType;
    customVarga: string;
};

export type BirthProfile = BirthDraft & { id: string };

export type BirthFieldErrors = Partial<Record<keyof BirthDraft, string>>;

const STORAGE_KEY = 'njh-birth-profiles';
const ACTIVE_KEY = 'njh-birth-active';

export function sampleDraft(): BirthDraft {
    return {
        name: 'Chennai sample',
        date: SAMPLE_CHART.date,
        time: SAMPLE_CHART.time,
        timezone: SAMPLE_CHART.timezone,
        latitude: String(SAMPLE_CHART.latitude),
        longitude: String(SAMPLE_CHART.longitude),
        place: SAMPLE_CHART.place,
        ayanamsa: 'true_citra',
        houseSystem: 'whole_sign',
        nodeType: 'true',
        customVarga: '',
    };
}

export function createProfileId(): string {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function draftFromUnknown(value: unknown): BirthDraft | null {
    if (!isRecord(value)) return null;
    const base = sampleDraft();
    const str = (key: keyof BirthDraft, fallback: string) => {
        const raw = value[key];
        if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
        if (typeof raw === 'string') return raw;
        return fallback;
    };
    const ayanamsa = str('ayanamsa', base.ayanamsa);
    const houseSystem = str('houseSystem', base.houseSystem);
    const nodeType = str('nodeType', base.nodeType);
    return {
        name: str('name', ''),
        date: str('date', ''),
        time: str('time', ''),
        timezone: str('timezone', ''),
        latitude: str('latitude', ''),
        longitude: str('longitude', ''),
        place: str('place', ''),
        ayanamsa: (AYANAMSA_IDS as readonly string[]).includes(ayanamsa)
            ? (ayanamsa as BirthDraft['ayanamsa'])
            : base.ayanamsa,
        houseSystem: (HOUSE_SYSTEM_IDS as readonly string[]).includes(houseSystem)
            ? (houseSystem as BirthDraft['houseSystem'])
            : base.houseSystem,
        nodeType: nodeType === 'mean' ? 'mean' : 'true',
        customVarga: str('customVarga', ''),
    };
}

export function readProfileStore(): { profiles: BirthProfile[]; activeId: string } {
    if (typeof localStorage === 'undefined') {
        const seeded = { id: 'sample', ...sampleDraft() };
        return { profiles: [seeded], activeId: seeded.id };
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        const profiles = Array.isArray(parsed)
            ? parsed
                  .map((row) => {
                      if (!isRecord(row) || typeof row.id !== 'string') return null;
                      const draft = draftFromUnknown(row);
                      return draft ? { ...draft, id: row.id } : null;
                  })
                  .filter((row): row is BirthProfile => row !== null)
            : [];
        if (profiles.length === 0) {
            const seeded = { id: createProfileId(), ...sampleDraft() };
            const activeId = seeded.id;
            localStorage.setItem(STORAGE_KEY, JSON.stringify([seeded]));
            localStorage.setItem(ACTIVE_KEY, activeId);
            return { profiles: [seeded], activeId };
        }
        const storedActive = localStorage.getItem(ACTIVE_KEY);
        const activeId = profiles.some((p) => p.id === storedActive)
            ? storedActive!
            : profiles[0]!.id;
        return { profiles, activeId };
    } catch {
        const seeded = { id: createProfileId(), ...sampleDraft() };
        return { profiles: [seeded], activeId: seeded.id };
    }
}

export function writeProfileStore(profiles: BirthProfile[], activeId: string) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    localStorage.setItem(ACTIVE_KEY, activeId);
}

export function validateBirth(draft: BirthDraft): BirthFieldErrors {
    const errors: BirthFieldErrors = {};
    if (!draft.date.trim()) errors.date = 'Enter a date.';
    if (!draft.time.trim()) errors.time = 'Enter a time.';
    if (!errors.date && !errors.time && draft.timezone.trim()) {
        const parsed = parseBirthInstant(draft.date, draft.time, draft.timezone);
        if (!parsed.ok) {
            if (/time zone/i.test(parsed.message)) errors.timezone = parsed.message;
            else if (/date/i.test(parsed.message)) errors.date = parsed.message;
            else errors.time = parsed.message;
        }
    } else if (!draft.timezone.trim()) {
        errors.timezone = 'Time zone is required. Pick a place or open Advanced.';
    }
    const lat = Number(draft.latitude);
    const lon = Number(draft.longitude);
    if (!draft.latitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90) {
        errors.latitude = 'Latitude must be a number from −90 to 90.';
    }
    if (!draft.longitude.trim() || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        errors.longitude = 'Longitude must be a number from −180 to 180.';
    }
    if (draft.customVarga.trim()) {
        const n = Number(draft.customVarga);
        if (!Number.isInteger(n) || n < 1 || n > 300) {
            errors.customVarga = 'Custom varga must be a whole number from 1 to 300.';
        }
    }
    return errors;
}

export function birthSummary(draft: BirthDraft): string {
    const place = draft.place.split(',')[0]?.trim() || draft.name.trim() || 'Chart';
    const when = [draft.date, draft.time].filter(Boolean).join(' ');
    return when ? `${place} · ${when}` : place;
}

export function profileToJson(draft: BirthDraft): string {
    return JSON.stringify(
        {
            name: draft.name,
            date: draft.date,
            time: draft.time,
            timezone: draft.timezone,
            latitude: Number(draft.latitude),
            longitude: Number(draft.longitude),
            place: draft.place,
            ayanamsa: draft.ayanamsa,
            houseSystem: draft.houseSystem,
            nodeType: draft.nodeType,
            customVarga: draft.customVarga,
        },
        null,
        2,
    );
}
