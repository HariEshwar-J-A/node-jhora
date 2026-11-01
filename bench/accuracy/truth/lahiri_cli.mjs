#!/usr/bin/env node
/** Bench Lahiri (IAE / CRC 1955) ayanamsa from production definition code. */
import { readFileSync } from 'node:fs';
import { getAyanamsa } from '../../../packages/core/dist/engine/ayanamsa.js';
import { AYANAMSA } from '../../../packages/core/dist/engine/ephemeris.js';

const { jdUt } = JSON.parse(readFileSync(0, 'utf8'));
const ayan = getAyanamsa(AYANAMSA.LAHIRI, jdUt, 'geometric', 'modern');
process.stdout.write(JSON.stringify({ jdUt, lahiriIaeAyanamsaDeg: ayan }));
