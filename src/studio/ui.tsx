import type { ReactNode } from 'react';
import type { Dataset } from '../types';

export function ToolFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="studio-page" aria-label={title}><div className="tool-heading"><div className="eyebrow">ASSET IDENTITY TOOLKIT</div><h1>{title}</h1><p>{description}</p></div>{children}</section>;
}
export function NoDataset({ onImport }: { onImport: () => void }) {
  return <div className="tool-card"><h2>Start with a dataset</h2><p>Import a CSV or Excel workbook, or try the sample assets. Your rows stay in memory.</p><button className="primary-button" onClick={onImport}>Go to Asset Labels</button></div>;
}
export function ColumnSelect({ label, dataset, value, onChange, optional = false, disabled = false }: { label: string; dataset: Dataset; value: string; onChange: (value: string) => void; optional?: boolean; disabled?: boolean }) {
  return <label className="tool-control">{label}<select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}><option value="">{optional ? 'Not mapped' : 'Choose a column'}</option>{dataset.columns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>;
}
