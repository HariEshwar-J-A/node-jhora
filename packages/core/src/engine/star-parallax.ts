/**
 * Modern geometric True Citra annual parallax mode (star-defined ayanamsa only).
 *
 * @see docs/decisions/0023-geometric-parallax-long-range.md
 */

import type { StarParallaxId } from '../settings/schema.js';
import { getDeltaTContext } from './deltat.js';

/** Default: match main / full-range oracle geometric star path (DE440 parallax inside kernel only). */
export const DEFAULT_STAR_PARALLAX: StarParallaxId = 'oracle-compat';

export function effectiveStarParallaxMode(): StarParallaxId {
    return getDeltaTContext().starParallax ?? DEFAULT_STAR_PARALLAX;
}
