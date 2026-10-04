import { useEffect, useMemo, useState } from 'react';
import type { LabelField, LabelTemplate } from '../../types';
import { DEFAULT_TEMPLATE } from '../../types';
import type { StudioPageProps } from '../../studio/contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../../studio/ui';
import { renderLabel, validateTemplate } from '../labels/renderer';

type Props = StudioPageProps & { mode: 'cable' | 'location' | 'code' };
const makeField = (source: string, label: string, fontSize: number, bold = true): LabelField => ({ source, label, fontSize, bold });

export function SpecialLabelsPage(props: Props) {
  const { dataset, selectedIds, template, page, busy, mode, onApplyTemplate, onExportJob, onNavigate } = props;
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [useCode, setUseCode] = useState(mode !== 'cable');
  const [codeKind, setCodeKind] = useState<'qr' | 'code128'>('qr');
  const [mirrored, setMirrored] = useState(mode === 'cable');
  const [widthInput, setWidthInput] = useState(String(mode === 'code' ? 50 : 70));
  const [heightInput, setHeightInput] = useState(String(mode === 'cable' ? 18 : mode === 'location' ? 60 : 25));
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<Array<{ id: string; src: string }>>([]);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    setUseCode(mode !== 'cable'); setCodeKind('qr'); setMirrored(mode === 'cable');
    setWidthInput(String(mode === 'code' ? 50 : 70)); setHeightInput(String(mode === 'cable' ? 18 : mode === 'location' ? 60 : 25));
  }, [mode]);

  const current = useMemo(() => {
    if (!dataset) return DEFAULT_TEMPLATE;
    const fields: LabelField[] = [];
    const append = (...items: Array<[string, string, number, boolean?]>) => items.forEach(([key, label, size, bold]) => {
      const source = columns[key]; if (source) fields.push(makeField(source, label, size, bold));
    });
    if (mode === 'cable') append(['source', 'From', 8], ['port', 'Port', 7, false], ['target', 'To', 8]);
    else if (mode === 'location') append(['site', 'Site', 12], ['building', 'Building', 10], ['floor', 'Floor', 9], ['room', 'Room', 12], ['rack', 'Rack', 11], ['shelf', 'Shelf', 10], ['bin', 'Bin', 10]);
    else append(['value', 'Code value', 14]);
    const hierarchy = ['site', 'building', 'floor', 'room', 'rack', 'shelf', 'bin'].map(key => columns[key]).filter((value): value is string => Boolean(value));
    const codeType: LabelTemplate['code']['type'] = useCode ? (mode !== 'location' ? codeKind : 'qr') : 'none';
    const locationPayload = mode === 'location' && useCode && hierarchy.length ? `location://site/${hierarchy.map(key => `{${key}}`).join('/')}` : '';
    const codeField = mode === 'code' ? columns.value ?? '' : mode === 'location' ? hierarchy[0] ?? '' : columns.source ?? '';
    return {
      ...DEFAULT_TEMPLATE,
      widthMm: Math.max(10, Math.min(200, Number(widthInput) || 10)),
      heightMm: Math.max(10, Math.min(200, Number(heightInput) || 10)),
      paddingMm: 2, border: true, alignment: 'center' as const, mode,
      textLayout: mirrored ? 'mirrored' as const : 'standard' as const,
      fields,
      code: {
        ...DEFAULT_TEMPLATE.code, type: codeType, field: codeField,
        sizeMm: mode === 'location' ? 18 : mode === 'cable' ? 10 : 16,
        barcodeHeightMm: 8, barcodeText: true, payload: locationPayload,
        ...(mode === 'location' && useCode ? { payloadMode: 'location' as const } : {}),
      },
    } satisfies LabelTemplate;
  }, [dataset, columns, mode, useCode, codeKind, mirrored, widthInput, heightInput]);

  const selectedRecords = useMemo(() => dataset ? dataset.records.filter(record => selectedIds.has(record.id)) : [], [dataset, selectedIds]);
  useEffect(() => {
    let live = true;
    setPreviews([]); setPreviewError('');
    if (!dataset) return () => { live = false; };
    void (async () => {
      try {
        const result: Array<{ id: string; src: string }> = [];
        for (const record of selectedRecords.slice(0, 36)) {
          const src = await renderLabel(record, current);
          if (!live) return;
          result.push({ id: record.id, src }); setPreviews([...result]);
        }
      } catch (cause) {
        if (live) setPreviewError(cause instanceof Error ? cause.message : 'Could not render the label preview.');
      }
    })();
    return () => { live = false; };
  }, [dataset, mode, selectedRecords, current]);

  const templateReady = JSON.stringify(template) === JSON.stringify(current);
  const apply = () => {
    setError('');
    try {
      if (!selectedRecords.length) throw new Error('Select at least one row before preparing specialized labels.');
      validateTemplate(current);
      onApplyTemplate(current, page, mode === 'cable' ? 'Cable wrap label' : mode === 'location' ? 'Location label' : 'Code label');
      setNotice('Template applied. Create PDF after the workspace reflects this layout.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not apply this label layout.'); }
  };
  const print = async () => {
    setError('');
    try {
      if (!templateReady) throw new Error('Apply this layout to the workspace first.');
      if (!selectedRecords.length) throw new Error('Select at least one row before creating labels.');
      const job = await onExportJob();
      if (!job) throw new Error('The print job did not complete. Review its settings and try again.');
      setNotice(`${job.labels.length} physical labels exported from an immutable print snapshot.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this print job.'); }
  };
  const choose = (key: string, label: string, optional = false) => <ColumnSelect key={key} label={label} dataset={dataset!} value={columns[key] ?? ''} optional={optional} disabled={busy} onChange={value => setColumns(old => ({ ...old, [key]: value }))}/>;
  if (!dataset) return <ToolFrame title={mode === 'cable' ? 'Cable labels' : mode === 'location' ? 'Location labels' : 'QR and barcode labels'} description="Create batch labels from the imported dataset."><NoDataset onImport={() => onNavigate('asset-labels')}/></ToolFrame>;
  const description = mode === 'cable' ? 'Format cable endpoints and ports on narrow mirrored wrap labels.' : mode === 'location' ? 'Print high contrast labels from mapped location hierarchy fields.' : 'Prepare text-only, QR, or Code 128 labels from a selected column.';
  return <ToolFrame title={mode === 'cable' ? 'Cable labels' : mode === 'location' ? 'Location labels' : 'QR and barcode labels'} description={description}>
    <section className="tool-card"><div className="tool-row"><strong>{selectedRecords.length} selected labels</strong><span>{mode === 'cable' ? 'The mirrored pair is one physical label.' : 'Choose rows in Asset Labels to preview or export.'}</span></div><div className="tool-row">
      {mode === 'cable' ? <>{choose('source', 'Source endpoint')}{choose('port', 'Port', true)}{choose('target', 'Target endpoint')}</> : mode === 'location' ? <>{choose('site', 'Site / warehouse')}{choose('building', 'Building', true)}{choose('floor', 'Floor', true)}{choose('room', 'Room', true)}{choose('rack', 'Rack', true)}{choose('shelf', 'Shelf', true)}{choose('bin', 'Bin', true)}</> : choose('value', 'Code value')}
    </div><div className="tool-row"><label className="tool-control">Label width (mm)<input type="number" min="10" max="200" step="1" value={widthInput} disabled={busy} onChange={e => setWidthInput(e.target.value)}/></label><label className="tool-control">Label height (mm)<input type="number" min="10" max="200" step="1" value={heightInput} disabled={busy} onChange={e => setHeightInput(e.target.value)}/></label><label className="tool-control"><input type="checkbox" checked={useCode} disabled={busy} onChange={e => setUseCode(e.target.checked)}/> Add QR / barcode</label>{useCode && <label className="tool-control">Code type<select disabled={busy || mode === 'location'} value={mode === 'location' ? 'qr' : codeKind} onChange={e => setCodeKind(e.target.value as 'qr' | 'code128')}><option value="qr">QR Code</option><option value="code128">Code 128</option></select></label>}{mode === 'cable' && <label className="tool-control"><input type="checkbox" checked={mirrored} disabled={busy} onChange={e => setMirrored(e.target.checked)}/> Mirror for cable wrap</label>}<button className="secondary-button" disabled={busy || !selectedRecords.length} onClick={apply}>Apply layout to workspace</button><button className="primary-button" disabled={busy || !templateReady || !selectedRecords.length} onClick={() => void print()}>Create PDF</button></div></section>
    <section className="tool-card"><h2>Label preview</h2><p>Previewing up to 36 selected labels.</p>{previewError && <p role="alert" className="tool-error">{previewError}</p>}<div className="tool-table">{previews.map(item => <figure key={item.id}><img src={item.src} alt={`Label preview for ${item.id}`}/><figcaption>{item.id}</figcaption></figure>)}{!previews.length && !previewError && <p>Select rows to preview their labels.</p>}</div></section>
    {notice && <p role="status" className="tool-note">{notice}</p>}{error && <p role="alert" className="tool-error">{error}</p>}
  </ToolFrame>;
}
