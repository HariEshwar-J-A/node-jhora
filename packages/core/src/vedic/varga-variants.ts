/**
 * Maps persisted `vargaVariants` settings to {@link VargaOptions}.
 *
 * JHora stores factory indexes (`index:0`, `index:1`, …); node-jhora names schemes
 * explicitly. Unknown keys are ignored so presets stay forward-compatible.
 */

import type { VargaOptions } from './vargas.js';

const INDEX = /^index:(\d+)$/;

function variantIndex(value: string | undefined): number | undefined {
    if (value == null) return undefined;
    if (value === 'parashara' || value === 'bphs' || value === 'harmonic') return 0;
    if (value === 'parivritti' || value === 'jhora_5_8' || value === 'alternate') return 1;
    const m = INDEX.exec(value);
    return m ? Number(m[1]) : undefined;
}

/**
 * Build per-call varga options from resolved settings plus explicit overrides.
 */
export function vargaOptionsFromVariants(
    variants: Record<string, string> | undefined,
    overrides: VargaOptions = {},
): VargaOptions {
    const v = variants ?? {};
    const out: VargaOptions = { ...overrides };

    const d2 = variantIndex(v.d2 ?? overrides.horaScheme);
    if (d2 === 6 || d2 === 1) out.horaScheme = 'parivritti';
    else if (overrides.horaScheme) out.horaScheme = overrides.horaScheme;
    else if (d2 === 0) out.horaScheme = 'parashara';

    const d10 = variantIndex(v.d10 ?? overrides.dasamsaScheme);
    if (d10 === 1) out.dasamsaScheme = 'jhora_5_8';
    else if (overrides.dasamsaScheme) out.dasamsaScheme = overrides.dasamsaScheme;
    else if (d10 === 0) out.dasamsaScheme = 'parashara';

    const mapScheme = (key: string, field: keyof VargaOptions, zero: string, one: string): void => {
        const idx = variantIndex(v[key]);
        if (idx === 1) (out as Record<string, string>)[field] = one;
        else if (idx === 0) (out as Record<string, string>)[field] = zero;
    };

    mapScheme('d3', 'd3Scheme', 'parashara', 'parivritti');
    mapScheme('d4', 'd4Scheme', 'parashara', 'parivritti');
    mapScheme('d5', 'd5Scheme', 'bphs', 'bphs');
    mapScheme('d8', 'd8Scheme', 'parashara', 'fixed_from_sagittarius');
    mapScheme('d9', 'd9Scheme', 'harmonic', 'kendra');
    mapScheme('d11', 'd11Scheme', 'parashara', 'forward_from_sign');
    mapScheme('d30', 'd30Scheme', 'parashara', 'even_reverse');
    mapScheme('d81', 'd81Scheme', 'nav_navamsa', 'parivritti_81');
    mapScheme('d108', 'd108Scheme', 'astottaramsa', 'nav_dwadasamsa');
    mapScheme('d150', 'd150Scheme', 'parivritti_150', 'nadi_equal');

    return out;
}
