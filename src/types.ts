export type AssetRecord = { id: string; values: Record<string, string> };
export type Dataset = { columns: string[]; records: AssetRecord[]; warnings: string[]; importAudit?: { sourceHeaders: string[]; removedEmptyRows: number } };
export type LabelField = { source: string; label: string; fontSize: number; bold: boolean };
export type LabelTemplate = {
  widthMm: number; heightMm: number; paddingMm: number; border: boolean; alignment: 'left' | 'center' | 'right';
  mode?: 'asset' | 'cable' | 'location' | 'code';
  textLayout?: 'standard' | 'mirrored';
  code: { type: 'qr' | 'code128' | 'none'; field: string; sizeMm: number; payload: string; payloadMode?: 'text' | 'url' | 'fieldlens' | 'location'; barcodeHeightMm: number; barcodeScale?: number; barcodeText: boolean; barcodeTextPosition: 'top' | 'bottom' };
  fields: LabelField[];
};
export type PageSettings = { preset: 'A4' | 'Letter' | 'A5' | 'Custom'; widthMm: number; heightMm: number; marginTopMm: number; marginBottomMm: number; marginLeftMm: number; marginRightMm: number; gapXMm: number; gapYMm: number; offsetXMm?: number; offsetYMm?: number };
export type PageLayout = { columns: number; rows: number; labelsPerPage: number; pages: number; positions: { xMm: number; yMm: number }[] };
export const DEFAULT_TEMPLATE: LabelTemplate = { widthMm: 60, heightMm: 30, paddingMm: 2, border: true, alignment: 'left', code: { type: 'qr', field: '', sizeMm: 20, payload: '', barcodeHeightMm: 10, barcodeScale: 1, barcodeText: true, barcodeTextPosition: 'bottom' }, fields: [] };
export const DEFAULT_PAGE: PageSettings = { preset: 'A4', widthMm: 210, heightMm: 297, marginTopMm: 10, marginBottomMm: 10, marginLeftMm: 10, marginRightMm: 10, gapXMm: 3, gapYMm: 3 };
