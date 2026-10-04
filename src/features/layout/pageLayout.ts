import type { LabelTemplate, PageLayout, PageSettings } from '../../types';

export const mmToInches = (millimeters: number): number => millimeters / 25.4;
export const inchesToMm = (inches: number): number => inches * 25.4;

const MAX_RECORDS = 20_000;
const MAX_PAGE_MM = 2_000;
const MAX_POSITIONS = 40_000;
const FIT_EPSILON = 1e-9;

function positiveFinite(value: number, name: string, max: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be a finite number greater than 0 and no more than ${max} mm.`);
  }
}

export function calculateLayout(template: LabelTemplate, page: PageSettings, count: number): PageLayout {
  positiveFinite(template.widthMm, 'Label width', 200);
  positiveFinite(template.heightMm, 'Label height', 200);
  if (!Number.isFinite(template.paddingMm) || template.paddingMm < 0 || template.paddingMm > Math.min(template.widthMm, template.heightMm) / 3) {
    throw new Error('Label padding must be finite, non-negative, and no more than one third of the smaller label side.');
  }
  positiveFinite(page.widthMm, 'Page width', MAX_PAGE_MM);
  positiveFinite(page.heightMm, 'Page height', MAX_PAGE_MM);
  for (const [name, value] of [
    ['Top margin', page.marginTopMm], ['Bottom margin', page.marginBottomMm],
    ['Left margin', page.marginLeftMm], ['Right margin', page.marginRightMm],
    ['Horizontal gap', page.gapXMm], ['Vertical gap', page.gapYMm],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_PAGE_MM) {
      throw new Error(`${name} must be a finite number between 0 and ${MAX_PAGE_MM} mm.`);
    }
  }
  const offsetX = page.offsetXMm ?? 0;
  const offsetY = page.offsetYMm ?? 0;
  for (const [name, value] of [['Horizontal calibration offset', offsetX], ['Vertical calibration offset', offsetY]] as const) {
    if (!Number.isFinite(value) || Math.abs(value) > 100) throw new Error(`${name} must be a finite value between -100 and 100 mm.`);
  }
  if (!Number.isInteger(count) || count < 0 || count > MAX_RECORDS) {
    throw new Error(`Record count must be a whole number between 0 and ${MAX_RECORDS.toLocaleString()}.`);
  }

  const usableWidth = page.widthMm - page.marginLeftMm - page.marginRightMm;
  const usableHeight = page.heightMm - page.marginTopMm - page.marginBottomMm;
  if (usableWidth < template.widthMm || usableHeight < template.heightMm) {
    throw new Error('The label does not fit inside the page margins. Reduce the label size or margins.');
  }
  const columns = Math.floor((usableWidth + page.gapXMm + FIT_EPSILON) / (template.widthMm + page.gapXMm));
  const rows = Math.floor((usableHeight + page.gapYMm + FIT_EPSILON) / (template.heightMm + page.gapYMm));
  const labelsPerPage = columns * rows;
  if (labelsPerPage < 1) {
    throw new Error('No labels fit on this page. Reduce the label size, margins, or gaps.');
  }
  if (labelsPerPage > MAX_POSITIONS) throw new Error(`This page would require ${labelsPerPage.toLocaleString()} label positions. Increase label size or page margins.`);
  const positions = Array.from({ length: labelsPerPage }, (_, index) => ({
    xMm: page.marginLeftMm + (index % columns) * (template.widthMm + page.gapXMm) + offsetX,
    yMm: page.marginTopMm + Math.floor(index / columns) * (template.heightMm + page.gapYMm) + offsetY,
  }));
  if (positions.some(({ xMm, yMm }) => xMm < 0 || yMm < 0 || xMm + template.widthMm > page.widthMm || yMm + template.heightMm > page.heightMm)) {
    throw new Error('Printer calibration moves a label off the page. Adjust the offset or margins to prevent clipping.');
  }
  return { columns, rows, labelsPerPage, pages: count === 0 ? 0 : Math.ceil(count / labelsPerPage), positions };
}
