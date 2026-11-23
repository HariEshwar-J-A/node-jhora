import { COUNTRY_NAMES } from './country-names';

export type PlaceLabelParts = {
    name: string;
    admin1: string;
    countryCode: string;
};

/** "Chennai, Tamil Nadu, India" — skips an empty region. */
export function formatPlaceLabel(place: PlaceLabelParts): string {
    const country = COUNTRY_NAMES[place.countryCode] ?? place.countryCode;
    const parts = [place.name];
    if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
    if (country) parts.push(country);
    return parts.join(', ');
}

export function formatCoord(value: number): string {
    const rounded = Math.round(value * 100000) / 100000;
    return String(rounded);
}
