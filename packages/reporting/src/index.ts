import PDFDocument from 'pdfkit';
import { PlanetPosition } from '@node-jhora/core';
import { YogaEngine, YOGA_LIBRARY, calculateShadbala, ChartData } from '@node-jhora/analytics';
import { ChartDrawer } from './drawers/ChartDrawer.js';
import { DateTime } from 'luxon';

// Define interface for input options if needed, e.g. Subject Details
export interface ReportOptions {
    subjectName?: string;
    birthDate?: string; // ISO String
    birthPlace?: string;
    chartStyle?: 'North' | 'South';
}

/**
 * Generates a full Vedic Astrology PDF Report.
 * @param chart The calculated chart data (Planets, Cusps, Ascendant).
 * @param options Metadata for the report.
 * @returns PDF Buffer.
 */
export async function generateFullReport(chart: ChartData, options: ReportOptions = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            const drawer = new ChartDrawer(doc);
            const PAGE_WIDTH = doc.page.width - 100;

            // --- Page 1: Basics & Chart ---
            doc.font('Helvetica-Bold').fontSize(24).text('Vedic Astrology Report', { align: 'center' });
            doc.moveDown();
            
            doc.font('Helvetica').fontSize(12);
            if (options.subjectName) doc.text(`Name: ${options.subjectName}`);
            if (options.birthDate) doc.text(`Date of Birth: ${DateTime.fromISO(options.birthDate || '').toLocaleString(DateTime.DATETIME_MED)}`);
            if (options.birthPlace) doc.text(`Place: ${options.birthPlace}`);
            doc.moveDown(2);

            // Chart Drawing
            doc.font('Helvetica-Bold').fontSize(16).text('Rashi Chart (D1)');
            doc.moveDown(0.5);
            
            const chartY = doc.y;
            // Defaults to South, can swap based on options
            if (options.chartStyle === 'North') {
                drawer.drawNorthIndian(50, chartY, 300, chart.planets, chart.ascendant);
            } else {
                drawer.drawSouthIndian(50, chartY, 300, chart.planets, chart.ascendant);
            }
            
            // Move cursor past chart
            doc.y = chartY + 320; 

            // Panchanga (Mock/Placeholder or calculated if engine available)
            // For now, we list Ascendant details
            doc.font('Helvetica-Bold').fontSize(14).text('Primary Details');
            doc.font('Helvetica').fontSize(10);
            doc.text(`Ascendant: ${(chart.ascendant % 30).toFixed(2)}° in Sign ${Math.floor(chart.ascendant / 30) + 1}`);

            // --- Page 2: Planetary Details ---
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(18).text('Planetary Positions');
            doc.moveDown();

            // Table Header
            const colX = [50, 150, 250, 350, 450];
            const headers = ['Planet', 'Longitude', 'Sign', 'Nakshatra', 'Status'];
            
            let y = doc.y;
            doc.font('Helvetica-Bold').fontSize(10);
            headers.forEach((h, i) => doc.text(h, colX[i], y));
            y += 15;
            doc.moveTo(50, y).lineTo(500, y).stroke();
            y += 10;

            doc.font('Helvetica').fontSize(10);
            chart.planets.forEach(p => {
                const sign = Math.floor(p.longitude / 30);
                const deg = p.longitude % 30;
                // Nakshatra Calc: (Lon * 27) / 360 = Lon / 13.333
                const nakIndex = Math.floor(p.longitude / (360/27));
                
                doc.text(p.name, colX[0], y);
                doc.text(`${Math.floor(deg)}° ${(deg%1*60).toFixed(0)}'`, colX[1], y);
                doc.text(getSignName(sign), colX[2], y);
                doc.text((nakIndex + 1).toString(), colX[3], y); // Nakshatra Number
                doc.text(p.speed < 0 ? 'Retrograde' : 'Direct', colX[4], y);
                y += 15;
            });

            // --- Page 3: Yogas & Analysis ---
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(18).text('Yoga Analysis');
            doc.moveDown();

            // Run Phase 12 Engine
            const yogas = YogaEngine.findYogas(chart, YOGA_LIBRARY);
            
            if (yogas.length === 0) {
                doc.font('Helvetica').fontSize(12).text('No major yogas computed in this subset.');
            } else {
                yogas.forEach(yogaRes => {
                    const yDef = yogaRes.yoga;
                    doc.font('Helvetica-Bold').fontSize(12).fillColor('#2c3e50').text(yDef.name);
                    doc.font('Helvetica').fontSize(10).fillColor('black');
                    
                    // Format Description
                    let desc = yDef.description_template || 'Special planetary combination.';
                    doc.text(desc);
                    doc.text(`Triggering Planets: ${[...yogaRes.triggeringPlanets].join(', ')}`, { oblique: true });
                    doc.moveDown(0.5);
                });
            }

            doc.moveDown(2);
            doc.font('Helvetica-Bold').fontSize(18).text('Shadbala Strength');
            doc.moveDown();
            
            // Phase 11/12 Shadbala (Mock call if implementation incomplete, or real)
            try {
                // Find Sun/Moon for inputs
                const sun = chart.planets.find(p => p.id === 0) || chart.planets[0];
                const moon = chart.planets.find(p => p.id === 1) || chart.planets[1];

                const shadbalaResults: any[] = []; // Use explicit type if available, else any for build safety
                
                // Mock Time/Varga (In real app, pass via options or calc)
                const mockTime = { sunrise: 6, sunset: 18, birthHour: 12 };
                const mockHouses = { ascendant: chart.ascendant, cusps: chart.cusps, mc: chart.cusps[9] }; // Approx MC

                chart.planets.forEach(p => {
                    // Skip nodes for Shadbala typically (Rahu/Ketu rules vary, simple engine usually skips)
                    if (p.id > 6) return; // Sun(0)..Sat(6). Rahu(7), Ketu(8) skipped

                    const input = {
                        planet: p,
                        allPlanets: chart.planets,
                        houses: mockHouses,
                        sun: sun,
                        moon: moon,
                        timeDetails: mockTime,
                        vargaPositions: [
                            // Mock D1 as a Varga
                            {
                                vargaName: 'D1',
                                sign: Math.floor(p.longitude / 30) + 1,
                                lordId: 0, // Mock: Would need Calc
                                lordRashiSign: 0
                            }
                        ]
                    };

                    // @ts-ignore - Ignore type mismatches for partial mock data
                    const result = calculateShadbala(input);
                    shadbalaResults.push({ planet: p.name, total: result.total });
                });
                
                const maxBarWidth = 300;
                
                shadbalaResults.forEach(s => {
                    doc.font('Helvetica').fontSize(10).text(s.planet, 50, doc.y);
                    const barW = Math.min((s.total / 10) * maxBarWidth, maxBarWidth); // Scale approximation
                    doc.rect(120, doc.y - 10, barW, 8).fill('#3498db');
                    doc.fill('black').text(s.total.toFixed(2), 125 + barW, doc.y - 10);
                    doc.moveDown();
                });
            } catch (e) {
                console.error(e);
                doc.fillColor('black').text('Shadbala calculation unavailable (Data missing).');
            }

            doc.end();

        } catch (e) {
            reject(e);
        }
    });
}

function getSignName(idx: number): string {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    return signs[idx % 12];
}

export { ChartDrawer };
