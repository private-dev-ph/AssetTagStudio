import type { AssetRecord, LabelTemplate, PageLayout, PageSettings } from '../types';

export type PrintPlacement = {
  recordId: string; assetId: string; labelIndex: number; page: number; row: number; column: number;
  payload: string; position: { xMm: number; yMm: number }; widthMm: number; heightMm: number;
};
export type PrintJob = {
  version: 1; generatedAt: string; templateName: string; idField: string;
  records: AssetRecord[]; template: LabelTemplate; page: PageSettings; layout: PageLayout; labels: PrintPlacement[];
};
