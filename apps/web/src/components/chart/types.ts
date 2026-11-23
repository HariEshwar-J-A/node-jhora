export interface ChartPlanet {
    name: string;
    longitude: number;
    /** Degrees within sign (0–30) when available */
    degree?: number;
    /** 1–12 sidereal sign */
    sign?: number;
    speed?: number;
    isAscendant?: boolean;
}

export interface ChartMeta {
    title: string;
    subtitle?: string;
    place?: string;
    dateLabel?: string;
}

export interface ChartTooltipPayload {
    name: string;
    longitude: number;
    signName: string;
    degreeDms: string;
    retrograde: boolean;
    house?: number;
}
