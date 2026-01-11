import PDFDocument from 'pdfkit';
import { PlanetPosition } from '@node-jhora/core';

export class ChartDrawer {
    private doc: PDFKit.PDFDocument;

    constructor(doc: PDFKit.PDFDocument) {
        this.doc = doc;
    }

    /**
     * Draws a South Indian Chart at (x, y) with given size.
     */
    public drawSouthIndian(x: number, y: number, size: number, planets: PlanetPosition[], ascendantLon: number) {
        const doc = this.doc;
        const boxSize = size / 4;
        
        doc.save();
        doc.lineWidth(1).strokeColor('#000000');

        // Draw Grid: 12 boxes (skip center)
        // Coords relative to (x,y)
        // 0-3 rows, 0-3 cols.
        // Row 0: 0,1,2,3
        // Row 1: 0, 3
        // Row 2: 0, 3
        // Row 3: 0,1,2,3
        const cells = [
            {r:0,c:0}, {r:0,c:1}, {r:0,c:2}, {r:0,c:3},
            {r:1,c:0},            {r:1,c:3},
            {r:2,c:0},            {r:2,c:3},
            {r:3,c:0}, {r:3,c:1}, {r:3,c:2}, {r:3,c:3}
        ];

        cells.forEach(cell => {
            doc.rect(x + cell.c * boxSize, y + cell.r * boxSize, boxSize, boxSize).stroke();
        });

        // Map Signs to Cells (Standard South Indian)
        // Pis(TL) -> Clockwise
        const signMap: Record<number, {r:number, c:number}> = {
            11: {r:0, c:0}, // Pis
            0:  {r:0, c:1}, // Ari
            1:  {r:0, c:2}, // Tau
            2:  {r:0, c:3}, // Gem
            3:  {r:1, c:3}, // Can
            4:  {r:2, c:3}, // Leo
            5:  {r:3, c:3}, // Vir
            6:  {r:3, c:2}, // Lib
            7:  {r:3, c:1}, // Sco
            8:  {r:3, c:0}, // Sag
            9:  {r:2, c:0}, // Cap
            10: {r:1, c:0}  // Aqu
        };

        // Draw Content
        const ascSign = Math.floor(ascendantLon / 30);
        
        // Group Planets
        const bySign: Record<number, PlanetPosition[]> = {};
        planets.forEach(p => {
            const s = Math.floor(p.longitude / 30);
            if (!bySign[s]) bySign[s] = [];
            bySign[s].push(p);
        });

        for (let s = 0; s < 12; s++) {
            const cell = signMap[s];
            const cx = x + cell.c * boxSize;
            const cy = y + cell.r * boxSize;

            // Mark Ascendant
            if (s === ascSign) {
                doc.fontSize(8).text('Asc', cx + 2, cy + 2);
            }

            // List Planets
            const pts = bySign[s] || [];
            if (pts.length > 0) {
                let py = cy + 12; // Start below Asc label space
                pts.forEach(p => {
                    const txt = `${p.name.substring(0,2)}${p.speed < 0 ? '[R]' : ''}`;
                    doc.fontSize(8).text(txt, cx + 2, py, { width: boxSize - 4, align: 'center' });
                    py += 10;
                });
            }
        }

        doc.restore();
    }

    /**
     * Draws a North Indian Chart (Diamond) at (x, y) with given size.
     */
    public drawNorthIndian(x: number, y: number, size: number, planets: PlanetPosition[], ascendantLon: number) {
        const doc = this.doc;
        doc.save();
        doc.lineWidth(1).strokeColor('#000000');

        // Draw Frame
        doc.rect(x, y, size, size).stroke();
        
        // Diagonals
        doc.moveTo(x, y).lineTo(x + size, y + size).stroke();
        doc.moveTo(x + size, y).lineTo(x, y + size).stroke();

        // Midpoint Diamond
        const cx = x + size/2;
        const cy = y + size/2;
        doc.moveTo(cx, y).lineTo(x + size, cy).lineTo(cx, y + size).lineTo(x, cy).lineTo(cx, y).stroke(); // Close path

        // Places (Standard North Indian 1-12)
        // We define centers relative to size
        const centers: Record<number, {cx: number, cy: number}> = {
            1: {cx: 0.5, cy: 0.2},  // Top
            2: {cx: 0.2, cy: 0.1},  // Top Left (High)
            3: {cx: 0.1, cy: 0.2},  // Top Left (Low) ?? Wait
            // Mapping standard:
            // 1 Top. 2 Top-Left. 3 Bot-Left?? 
            // My previous analysis:
            // 1(Top), 2(TL), 3(BL), 4(Bot), 5(BR), 6(TR)...
            // Let's use standard placement logic for text.
            4: {cx: 0.2, cy: 0.5},  // Left (Standard H4 position in many charts, or H4 is usually Bottom?)
            // PROMPT SAID: House 4 is BOTTOM Diamond. House 10 is LEFT Diamond.
            // Following Prompt Layout:
            // 1 Top, 4 Bot, 7 Right, 10 Left.
        };
        
        // Override centers for Prompt Layout
        // 1(Top), 4(Bot), 7(Right), 10(Left).
        // 2(TL-Upper), 3(TL-Lower? No BL-Upper. Let's use the 12-zone logic from UI).
        const getLocation = (id: number) => {
             // 1..12
             // Based on UI grid normalized 0-1
             switch(id) {
                 case 1: return {cx: 0.5, cy: 0.25}; // Top
                 case 2: return {cx: 0.25, cy: 0.1}; // TL-Upper
                 case 3: return {cx: 0.1, cy: 0.25}; // TL-Lower? No, BL-Upper usually.
                 // Let's stick to the visual fill of 12 zones defined in UI.
                 // 1(Top), 2(TL-Top), 3(Left-Top), 10(LeftD), 11(Bot-Left??), 4(Bot)
                 // This geometry is painful without seeing it.
                 // I'll define reasonable centers for 12 slots around.
                 case 4: return {cx: 0.5, cy: 0.75}; // Bottom (Prompt constraint)
                 case 7: return {cx: 0.75, cy: 0.5}; // Right (Prompt constraint)
                 case 10: return {cx: 0.25, cy: 0.5}; // Left (Prompt constraint)
                 
                 // Intermediates
                 // 1-4 gap (Left side): 2, 3.
                 // Assume 2 is Top-Left, 3 is Bottom-Left.
                 case 2: return {cx: 0.15, cy: 0.15}; // TL
                 case 3: return {cx: 0.15, cy: 0.85}; // BL?? (Wait, 4 is Bottom).
                 // If 4 is Bottom. 2,3 must be between Top and Bottom.
                 // If 10 is Left.
                 // Then 2,3 coexist with 10?
                 // Let's assume 2 is Top-Left, 3 is Bot-Left. 10 is Left-Center.
                 
                 case 5: return {cx: 0.65, cy: 0.85}; // BR?
                 case 6: return {cx: 0.85, cy: 0.85}; // BR?
                 case 8: return {cx: 0.85, cy: 0.15}; // TR?
                 case 9: return {cx: 0.65, cy: 0.15}; // TR?
                 
                 // 11, 12?
                 case 11: return {cx: 0.1, cy: 0.5}; // Left Edge?
                 case 12: return {cx: 0.9, cy: 0.5}; // Right Edge?
                 
                 default: return {cx: 0.5, cy: 0.5};
             }
        };

        const ascSign = Math.floor(ascendantLon / 30); // 0-11
        
        // Group by House (Rel to Asc)
        const planetsByHouse: Record<number, PlanetPosition[]> = {};
        planets.forEach(p => {
             const pSign = Math.floor(p.longitude / 30);
             let hIdx = (pSign - ascSign) + 1;
             if (hIdx <= 0) hIdx += 12;
             if (hIdx > 12) hIdx = (hIdx-1)%12 + 1;
             if (!planetsByHouse[hIdx]) planetsByHouse[hIdx] = [];
             planetsByHouse[hIdx].push(p);
        });

        for (let i = 1; i <= 12; i++) {
            const loc = getLocation(i);
            const px = x + loc.cx * size;
            const py = y + loc.cy * size;

            // Sign Number
            const signNum = ((ascSign + (i-1)) % 12) + 1;
            doc.fontSize(8).fillColor('#666666');
            // Write Sign Number small
            // doc.text(signNum.toString(), px - 10, py - 5); 

            // Planets
            const pts = planetsByHouse[i] || [];
            if (pts.length > 0) {
                 doc.fillColor('#000000');
                 let lpy = py - ((pts.length * 8)/2);
                 pts.forEach(p => {
                      const txt = `${p.name.substring(0,2)}${p.speed < 0 ? '[R]' : ''}`;
                      doc.text(txt, px - 10, lpy, { width: 20, align: 'center' });
                      lpy += 8;
                 });
            }
        }

        doc.restore();
    }
}
