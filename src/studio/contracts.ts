import type { Dataset, LabelTemplate, PageSettings } from '../types';
import type { PrintJob } from '../core/printJob';

export type StudioView = 'asset-labels' | 'cable-labels' | 'location-labels' | 'codes' | 'data-health' | 'id-generator' | 'serial-tools' | 'templates' | 'payload-builder' | 'calibration' | 'code-inspector' | 'manifest' | 'fieldlens';
export type StudioPageProps = {
  dataset: Dataset | null; selectedIds: ReadonlySet<string>; idField: string;
  template: LabelTemplate; page: PageSettings; busy: boolean; previewImage: string; lastJob: PrintJob | null;
  onCommitDataset: (next: Dataset, description: string, columnMap?: Record<string, string>) => void;
  onApplyTemplate: (template: LabelTemplate, page?: PageSettings, name?: string) => void;
  onPageChange: (page: PageSettings) => void; onIdentifierChange: (field: string) => void;
  onNavigate: (view: StudioView) => void; onUndo: () => void; canUndo: boolean;
  onExportJob: () => Promise<PrintJob | null>;
};
