/**
 * Child-process probe: CSV fold row UTC must not depend on host TZ or system clock.
 * Invoked from csv-dst-determinism.test.ts with TZ / fake-timer env vars.
 */
import { csvWizardImport } from '../../dist/index.js';

const header = 'name,date,time,timezone,latitude,longitude';
const csv = `${header}
Fold,2021-11-07,01:30:00,America/New_York,40.7,-74
`;

const { importResult } = csvWizardImport(csv);
const resolvedUtc = importResult.charts[0]?.birth.tzResolution.resolvedUtc;
console.log(JSON.stringify({ resolvedUtc, warnings: importResult.warnings.length }));
