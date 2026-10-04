import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PageSettings } from '../../types';
import { mmToInches } from '../layout/pageLayout';

const PT_PER_MM = 72 / 25.4;
export async function generateCalibrationPdf(page: PageSettings): Promise<Uint8Array> {
  const width = mmToInches(page.widthMm) * 72;
  const height = mmToInches(page.heightMm) * 72;
  const doc = await PDFDocument.create();
  doc.setTitle('Printer calibration sheet');
  const sheet = doc.addPage([width, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0.05, 0.08, 0.08);
  const mm = (value: number) => value * PT_PER_MM;
  const cross = (xMm: number, yMm: number, sizeMm = 3) => {
    const x = mm(xMm), y = height - mm(yMm), size = mm(sizeMm);
    sheet.drawLine({ start: { x: x - size, y }, end: { x: x + size, y }, thickness: 0.7, color: black });
    sheet.drawLine({ start: { x, y: y - size }, end: { x, y: y + size }, thickness: 0.7, color: black });
    sheet.drawCircle({ x, y, size: 1.2, borderColor: black, borderWidth: 0.6 });
  };
  const inset = 10;
  cross(inset, inset); cross(page.widthMm - inset, inset); cross(inset, page.heightMm - inset); cross(page.widthMm - inset, page.heightMm - inset);
  cross(page.widthMm / 2, page.heightMm / 2, 5);
  const rulerY = page.heightMm - 23;
  sheet.drawLine({ start: { x: mm(inset), y: height - mm(rulerY) }, end: { x: mm(page.widthMm - inset), y: height - mm(rulerY) }, thickness: 0.7, color: black });
  for (let tick = inset; tick <= page.widthMm - inset; tick += 1) {
    const major = tick % 10 === 0;
    const y = height - mm(rulerY);
    sheet.drawLine({ start: { x: mm(tick), y }, end: { x: mm(tick), y: y + mm(major ? 4 : 1.5) }, thickness: 0.45, color: black });
    if (major) sheet.drawText(String(tick - inset), { x: mm(tick) + 1, y: y + mm(5), size: 7, font, color: black });
  }
  const rulerX = page.widthMm - 23;
  sheet.drawLine({ start: { x: mm(rulerX), y: height - mm(inset) }, end: { x: mm(rulerX), y: height - mm(page.heightMm - inset) }, thickness: 0.7, color: black });
  for (let tick = inset; tick <= page.heightMm - inset; tick += 1) {
    const major = tick % 10 === 0;
    const y = height - mm(tick);
    sheet.drawLine({ start: { x: mm(rulerX), y }, end: { x: mm(rulerX - (major ? 4 : 1.5)), y }, thickness: 0.45, color: black });
    if (major) sheet.drawText(String(tick - inset), { x: mm(rulerX - 11), y: y - 2, size: 7, font, color: black });
  }
  const box = Math.min(100, page.widthMm - 2 * inset, page.heightMm - 2 * inset - 34);
  if (box > 15) {
    const x = (page.widthMm - box) / 2;
    const y = (page.heightMm - box) / 2;
    sheet.drawRectangle({ x: mm(x), y: height - mm(y + box), width: mm(box), height: mm(box), borderColor: black, borderWidth: 0.8 });
    sheet.drawText(`${box.toFixed(1)} mm reference box`, { x: mm(x + 2), y: height - mm(y + box / 2), size: 9, font, color: black });
  }
  sheet.drawText('PRINTER CALIBRATION — print at 100% / Actual Size', { x: mm(inset), y: height - mm(18), size: 12, font, color: black });
  sheet.drawText('Measure the center cross and corner marks against the printed page. Enter the measured X/Y shift in Printer Calibration.', { x: mm(inset), y: mm(10), size: 8, font, color: black, maxWidth: width - mm(inset * 2) });
  sheet.drawText('Ruler ticks are 1 mm apart; numbered marks are 10 mm apart.', { x: mm(inset), y: mm(5), size: 7, font, color: black });
  return doc.save();
}
