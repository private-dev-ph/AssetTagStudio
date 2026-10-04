import { useMemo, useState } from 'react';
import type { LabelField, LabelTemplate } from '../../types';
import type { StudioPageProps } from '../../studio/contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../../studio/ui';
import { DEFAULT_TEMPLATE } from '../../types';
import { validateTemplate } from '../labels/renderer';

type Props = StudioPageProps & { mode: 'cable' | 'location' | 'code' };
const field = (source: string, label: string, fontSize: number, bold = true): LabelField => ({ source, label, fontSize, bold });

export function SpecialLabelsPage(props: Props) {
  const { dataset, selectedIds, template, page, busy, mode, onApplyTemplate, onExportJob, onNavigate } = props;
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [useCode, setUseCode] = useState(mode !== 'cable');
  const [mirrored, setMirrored] = useState(mode === 'cable');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const current = useMemo(() => {
    if (!dataset) return DEFAULT_TEMPLATE;
    const fields: LabelField[] = [];
    const map = (...specs: Array<[string, string, number, boolean?]>) => specs.forEach(([key, label, size, bold]) => { const source = columns[key]; if (source) fields.push(field(source, label, size, bold)); });
    if (mode === 'cable') map(['source', 'From', 8], ['port', 'Port', 7, false], ['target', 'To', 8]);
    else if (mode === 'location') map(['site', 'Site', 17], ['building', 'Building', 15], ['floor', 'Floor', 14], ['room', 'Room', 18], ['rack', 'Rack', 16], ['shelf', 'Shelf', 15], ['bin', 'Bin', 15]);
    else map(['value', 'Code value', 14]);
    const codeType = useCode ? (mode === 'code' && columns.symbology === 'code128' ? 'code128' : 'qr') : 'none';
    const hierarchy = ['site', 'building', 'floor', 'room', 'rack', 'shelf', 'bin'].map(key => columns[key]).filter(Boolean);
    const locationPayload = mode === 'location' && useCode && hierarchy.length ? `location://site/${hierarchy.map(key => `{${key}}`).join('/')}` : '';
    const codeField = mode === 'code' ? columns.value ?? '' : mode === 'location' ? (hierarchy[0] ?? '') : columns.source ?? '';
    return {
      ...DEFAULT_TEMPLATE,
      widthMm: mode === 'cable' ? 70 : mode === 'location' ? 70 : 50,
      heightMm: mode === 'cable' ? 18 : mode === 'location' ? 45 : 25,
      paddingMm: 2, border: true, alignment: 'center' as const, mode,
      textLayout: mirrored ? 'mirrored' as const : 'standard' as const,
      fields,
      code: {
        ...DEFAULT_TEMPLATE.code, type: codeType as LabelTemplate['code']['type'], field: codeField,
        sizeMm: mode === 'location' ? 18 : mode === 'cable' ? 10 : 16,
        barcodeHeightMm: 8, barcodeText: true, payload: locationPayload,
        ...(mode === 'location' && useCode ? { payloadMode: 'location' as const } : {}),
      },
    } satisfies LabelTemplate;
  }, [dataset, columns, mode, useCode, mirrored]);
  if (!dataset) return <ToolFrame title={mode === 'cable' ? 'Cable labels' : mode === 'location' ? 'Location labels' : 'QR and barcode labels'} description="Create batch labels from the imported dataset."><NoDataset onImport={() => onNavigate('asset-labels')}/></ToolFrame>;
  const selectedRecords = selectedIds.size ? dataset.records.filter(record => selectedIds.has(record.id)) : dataset.records;
  const templateReady = JSON.stringify(template) === JSON.stringify(current);
  const apply = () => {
    setError('');
    try {
      if (!selectedRecords.length) throw new Error('Select at least one row or clear the selection to print all records.');
      validateTemplate(current);
      onApplyTemplate(current, page, mode === 'cable' ? 'Cable wrap label' : mode === 'location' ? 'Location label' : 'Code label');
      setNotice('Template applied to the workspace. Create PDF now uses this layout and updates the last successful print job.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not apply this label layout.'); }
  };
  const print = async () => { setError(''); try { if (!templateReady) throw new Error('Apply this layout to the workspace first.'); const job = await onExportJob(); if (!job) throw new Error('The print job did not complete. Review its settings and try again.'); setNotice(`${job.labels.length} physical labels exported from an immutable print snapshot.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this print job.'); } };
  const choose = (key: string, label: string, optional = false) => <ColumnSelect key={key} label={label} dataset={dataset} value={columns[key] ?? ''} optional={optional} disabled={busy} onChange={value => setColumns(old => ({ ...old, [key]: value }))}/>;
  return <ToolFrame title={mode === 'cable' ? 'Cable labels' : mode === 'location' ? 'Location labels' : 'QR and barcode labels'} description={mode === 'cable' ? 'Format cable endpoints and port names on narrow mirrored wrap labels.' : mode === 'location' ? 'Print high contrast location labels from mapped hierarchy fields.' : 'Make text-only, QR, or Code 128 labels from any dataset column.'}>
    <section className="tool-card"><div className="tool-row"><strong>{selectedRecords.length} labels</strong><span>{mode === 'cable' ? 'Mirrored sides are part of one physical label.' : 'Locations use the shared URI and payload validation path.'}</span></div><div className="tool-row">
      {mode === 'cable' ? <>{choose('source', 'Source endpoint')}{choose('port', 'Port', true)}{choose('target', 'Target endpoint')}</> : mode === 'location' ? <>{choose('site', 'Site / warehouse')}{choose('building', 'Building', true)}{choose('floor', 'Floor', true)}{choose('room', 'Room', true)}{choose('rack', 'Rack', true)}{choose('shelf', 'Shelf', true)}{choose('bin', 'Bin', true)}</> : <>{choose('value', 'Code value')}{<label className="tool-control">Barcode format<select disabled={busy} value={columns.symbology ?? 'qr'} onChange={e => setColumns(old => ({ ...old, symbology: e.target.value }))}><option value="qr">QR Code</option><option value="code128">Code 128</option></select></label>}</>}
    </div><div className="tool-row">{mode !== 'code' && <label className="tool-control"><input type="checkbox" checked={useCode} disabled={busy} onChange={e => setUseCode(e.target.checked)}/> Add QR code</label>}{mode === 'cable' && <label className="tool-control"><input type="checkbox" checked={mirrored} disabled={busy} onChange={e => setMirrored(e.target.checked)}/> Mirror for cable wrap</label>}<button className="secondary-button" disabled={busy} onClick={apply}>Apply layout to workspace</button><button className="primary-button" disabled={busy || !templateReady} onClick={() => void print()}>Create PDF</button></div>
    </section>{notice && <p role="status" className="tool-note">{notice}</p>}{error && <p role="alert" className="tool-error">{error}</p>}
  </ToolFrame>;
}
