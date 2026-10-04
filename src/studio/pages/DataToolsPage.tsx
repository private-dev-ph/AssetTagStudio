import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dataset } from '../../types';
import type { StudioPageProps } from '../contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../ui';
import { auditDataset, previewHealthFix, type HealthFix, type HealthPreview } from '../../features/data-health/logic';
import { applyIdsToColumn, previewIds, type IdGeneratorOptions, type IdPreviewRow } from '../../features/id-generator/logic';
import { applySerialPreview, PreviewGeneration, previewSerials, type SerialOptions, type SerialPreviewRow } from '../../features/serial-tools/logic';

export type DataToolsPageProps = StudioPageProps & { view: 'data-health' | 'id-generator' | 'serial-tools' };
const emptyIds: IdGeneratorOptions = { column: '', pattern: '{sequence}', prefix: '', suffix: '', start: 1, padding: 3, year: String(new Date().getFullYear()), date: new Date().toISOString().slice(0, 10), selectedIds: new Set(), blankOnly: true, overwrite: false };
const emptySerial: SerialOptions = { column: '', selectedIds: new Set(), mode: 'normalize', casing: 'upper', stripPrefix: '', removeSeparators: true, minLength: 1, maxLength: 100, knownPrefixes: '', pattern: '' };

export function DataToolsPage(props: DataToolsPageProps) {
  const { view, dataset, onNavigate } = props;
  if (!dataset) return <ToolFrame title={viewTitle(view)} description={viewDescription(view)}><NoDataset onImport={() => onNavigate('asset-labels')} /></ToolFrame>;
  if (view === 'data-health') return <HealthPage {...props} dataset={dataset} />;
  if (view === 'id-generator') return <IdPage {...props} dataset={dataset} />;
  return <SerialPage {...props} dataset={dataset} />;
}

function viewTitle(view: DataToolsPageProps['view']) { return view === 'data-health' ? 'Data Health' : view === 'id-generator' ? 'Asset ID Generator' : 'Serial Tools'; }
function viewDescription(view: DataToolsPageProps['view']) { return view === 'data-health' ? 'Review data quality and preview reversible cleanup before it reaches labels.' : view === 'id-generator' ? 'Create consistent identifiers for selected rows and check collisions before applying.' : 'Normalize and validate serial values with a before and after preview.'; }
function useFreshPreview<T>(dataset: Dataset) {
  const [entry, setEntry] = useState<{ source: Dataset; value: T } | null>(null);
  useEffect(() => { setEntry(null); }, [dataset]);
  const setValue = useCallback((value: T | null) => setEntry(value === null ? null : { source: dataset, value }), [dataset]);
  return [entry?.source === dataset ? entry.value : null, setValue] as const;
}
function fieldDefault(dataset: Dataset, expression: RegExp) { return dataset.columns.find(column => expression.test(column)) ?? ''; }
function ErrorText({ message }: { message: string }) { return message ? <p className="tool-error" role="alert">{message}</p> : null; }

function HealthPage(props: DataToolsPageProps & { dataset: Dataset }) {
  const { dataset } = props;
  const [id, setId] = useState(() => props.idField && dataset.columns.includes(props.idField) ? props.idField : fieldDefault(dataset, /asset\s*id|identifier|\bid\b/i));
  const [serial, setSerial] = useState(() => fieldDefault(dataset, /serial|s\/n/i));
  const [name, setName] = useState(() => fieldDefault(dataset, /name|description/i));
  const [fix, setFix] = useState<HealthFix>('trim');
  const [fixColumn, setFixColumn] = useState('');
  const [preview, setPreview] = useFreshPreview<HealthPreview>(dataset);
  const [error, setError] = useState('');
  const findings = useMemo(() => auditDataset(dataset, id, serial, name, props.template.code.type === 'none' ? undefined : props.template.code), [dataset, id, serial, name, props.template.code]);
  const runPreview = () => { try { setError(''); setPreview(previewHealthFix(dataset, fix, fixColumn || undefined)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not preview this cleanup.'); setPreview(null); } };
  const apply = () => {
    if (!preview || preview.dataset === dataset || props.busy) return;
    try { props.onCommitDataset(preview.dataset, preview.description, preview.columnMap); setPreview(null); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply this data fix.'); }
  };
  return <ToolFrame title="Data Health" description="Review data quality and preview reversible cleanup before it reaches labels.">
    <div className="tool-grid"><section className="tool-card"><h2>{dataset.records.length} records · {dataset.columns.length} columns</h2><div className="tool-row">
      <ColumnSelect label="Identifier column" dataset={dataset} value={id} onChange={setId} optional />
      <ColumnSelect label="Serial column" dataset={dataset} value={serial} onChange={setSerial} optional />
      <ColumnSelect label="Asset name column" dataset={dataset} value={name} onChange={setName} optional />
    </div><p>{findings.length ? `${findings.length} finding${findings.length === 1 ? '' : 's'}${findings.length === 100 ? ' (showing first 100)' : ''}` : 'No issues found for the selected fields.'}</p>
      <div className="tool-table"><table><thead><tr><th>Severity</th><th>Issue</th></tr></thead><tbody>{findings.map((item, index) => <tr key={`${item.code}-${item.rowIds?.join(',') ?? item.column ?? ''}-${index}`}><td>{item.severity}</td><td>{item.message}</td></tr>)}</tbody></table></div>
      {dataset.importAudit?.removedEmptyRows ? <p>Import skipped {dataset.importAudit.removedEmptyRows} empty data row(s); the original rows are not retained.</p> : null}
    </section><section className="tool-card"><h2>Preview a safe fix</h2><div className="tool-row"><label className="tool-control">Fix<select aria-label="Fix" value={fix} onChange={event => { setFix(event.target.value as HealthFix); setPreview(null); }}><option value="trim">Trim cell whitespace</option><option value="headers">Normalize header whitespace</option><option value="empty-columns">Remove empty columns</option><option value="case">Uppercase a column</option></select></label>{fix === 'case' && <ColumnSelect label="Column" dataset={dataset} value={fixColumn} onChange={value => { setFixColumn(value); setPreview(null); }} />}</div>
      <button className="secondary-button" disabled={props.busy} onClick={runPreview}>Preview fix</button><ErrorText message={error} />
      {preview && <div className="tool-preview"><p>{preview.description}</p><button className="primary-button" disabled={props.busy || preview.changed === 0} onClick={apply}>Apply fix</button></div>}
      <button className="secondary-button" onClick={() => props.onNavigate('id-generator')}>Generate missing IDs</button>
    </section></div>
  </ToolFrame>;
}

function IdPage(props: DataToolsPageProps & { dataset: Dataset }) {
  const { dataset } = props;
  const [options, setOptions] = useState<IdGeneratorOptions>(() => ({ ...emptyIds, column: props.idField && dataset.columns.includes(props.idField) ? props.idField : fieldDefault(dataset, /asset\s*id|identifier|\bid\b/i), selectedIds: props.selectedIds }));
  const [preview, setPreview] = useFreshPreview<IdPreviewRow[]>(dataset);
  const [error, setError] = useState('');
  useEffect(() => { setOptions(current => ({ ...current, selectedIds: props.selectedIds, column: dataset.columns.includes(current.column) ? current.column : '' })); setPreview(null); setError(''); }, [dataset, props.selectedIds, setPreview]);
  const update = <K extends keyof IdGeneratorOptions>(key: K, value: IdGeneratorOptions[K]) => { setOptions(current => ({ ...current, [key]: value })); setPreview(null); };
  const run = () => { try { setError(''); setPreview(previewIds(dataset, options)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create an ID preview.'); setPreview(null); } };
  const apply = () => { if (!preview || props.busy) return; try { props.onCommitDataset(applyIdsToColumn(dataset, options.column, preview), 'Generate asset identifiers'); setPreview(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply generated IDs.'); } };
  return <ToolFrame title="Asset ID Generator" description="Create consistent identifiers for selected rows and check collisions before applying.">
    <section className="tool-card"><h2>Pattern</h2><div className="tool-grid">
      <ColumnSelect label="Identifier column" dataset={dataset} value={options.column} onChange={value => update('column', value)} />
      <label className="tool-control">Pattern<input value={options.pattern} maxLength={500} onChange={event => update('pattern', event.target.value)} /><small>Tokens: {'{sequence}'}, {'{year}'}, {'{date}'}, or {'{Column Name}'}.</small></label>
      <label className="tool-control">Prefix<input value={options.prefix} maxLength={200} onChange={event => update('prefix', event.target.value)} /></label><label className="tool-control">Suffix<input value={options.suffix} maxLength={200} onChange={event => update('suffix', event.target.value)} /></label>
      <label className="tool-control">Start sequence<input type="number" min={0} max={999999999} value={options.start} onChange={event => update('start', Number(event.target.value))} /></label><label className="tool-control">Zero padding<input type="number" min={1} max={12} value={options.padding} onChange={event => update('padding', Number(event.target.value))} /></label>
      <label className="tool-control">Year<input value={options.year} maxLength={4} onChange={event => update('year', event.target.value)} /></label><label className="tool-control">Date<input type="date" value={options.date} onChange={event => update('date', event.target.value)} /></label>
    </div><div className="tool-row"><label><input type="checkbox" checked={options.blankOnly} onChange={event => update('blankOnly', event.target.checked)} /> Generate for blank IDs only</label><label><input type="checkbox" checked={options.overwrite} onChange={event => { setOptions(current => ({ ...current, overwrite: event.target.checked, blankOnly: event.target.checked ? false : current.blankOnly })); setPreview(null); }} /> Allow overwriting existing IDs</label><span>{props.selectedIds.size} selected rows</span></div>
    <button className="primary-button" disabled={props.busy || props.selectedIds.size === 0 || !options.column} onClick={run}>Preview IDs</button><ErrorText message={error} />
    {preview && <div className="tool-preview"><p>{preview.length} ID(s) · {preview.filter(row => row.status === 'collision').length} collision(s)</p><div className="tool-table"><table><thead><tr><th>Row</th><th>Before</th><th>Generated</th><th>Status</th></tr></thead><tbody>{preview.slice(0, 200).map(row => <tr key={row.rowId}><td>{row.rowId}</td><td>{row.before || '—'}</td><td>{row.after}</td><td>{row.message ?? row.status}</td></tr>)}</tbody></table></div><button className="primary-button" disabled={props.busy || preview.length === 0 || preview.some(row => row.status === 'collision')} onClick={apply}>Apply IDs</button></div>}
    </section>
  </ToolFrame>;
}

function SerialPage(props: DataToolsPageProps & { dataset: Dataset }) {
  const { dataset } = props;
  const [options, setOptions] = useState<SerialOptions>(() => ({ ...emptySerial, column: fieldDefault(dataset, /serial|s\/n/i), selectedIds: props.selectedIds }));
  const [preview, setPreview] = useFreshPreview<SerialPreviewRow[]>(dataset);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const requestGeneration = useRef(new PreviewGeneration());
  useLayoutEffect(() => {
    requestGeneration.current.invalidate(); setPending(false); setOptions(current => ({ ...current, selectedIds: props.selectedIds, column: dataset.columns.includes(current.column) ? current.column : '' })); setPreview(null); setError('');
    return () => requestGeneration.current.invalidate();
  }, [dataset, props.selectedIds, setPreview]);
  const update = <K extends keyof SerialOptions>(key: K, value: SerialOptions[K]) => { requestGeneration.current.invalidate(); setPending(false); setOptions(current => ({ ...current, [key]: value })); setPreview(null); };
  const run = async () => {
    if (pending) return;
    const generation = requestGeneration.current.begin();
    setPending(true); setError(''); setPreview(null);
    try {
      const result = await previewSerials(dataset, options);
      if (requestGeneration.current.isCurrent(generation)) setPreview(result);
    } catch (reason) {
      if (requestGeneration.current.isCurrent(generation)) setError(reason instanceof Error ? reason.message : 'Could not create a serial preview.');
    } finally {
      if (requestGeneration.current.isCurrent(generation)) setPending(false);
    }
  };
  const apply = () => { if (!preview || props.busy) return; try { props.onCommitDataset(applySerialPreview(dataset, options.column, preview, options.mode === 'deduplicate'), options.mode === 'deduplicate' ? 'Deduplicate serial numbers' : 'Normalize serial numbers'); setPreview(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply serial changes.'); } };
  const drops = preview?.filter(row => row.drop).length ?? 0;
  return <ToolFrame title="Serial Tools" description="Normalize and validate serial values with a before and after preview.">
    <section className="tool-card"><div className="tool-grid"><ColumnSelect label="Serial column" dataset={dataset} value={options.column} onChange={value => update('column', value)} />
      <label className="tool-control">Action<select value={options.mode} onChange={event => update('mode', event.target.value as SerialOptions['mode'])}><option value="normalize">Normalize</option><option value="extract">Extract serial from text</option><option value="validate">Validate only</option><option value="deduplicate">Deduplicate</option></select></label>
      <label className="tool-control">Casing<select value={options.casing} onChange={event => update('casing', event.target.value as SerialOptions['casing'])}><option value="upper">Uppercase</option><option value="lower">Lowercase</option><option value="preserve">Preserve</option></select></label>
      <label className="tool-control">Strip leading prefix<input maxLength={80} value={options.stripPrefix} onChange={event => update('stripPrefix', event.target.value)} placeholder="SN:" /></label>
      <label className="tool-control">Minimum length<input type="number" min={0} max={500} value={options.minLength} onChange={event => update('minLength', Number(event.target.value))} /></label><label className="tool-control">Maximum length<input type="number" min={0} max={500} value={options.maxLength} onChange={event => update('maxLength', Number(event.target.value))} /></label>
      <label className="tool-control">Known prefixes<input value={options.knownPrefixes} maxLength={1000} onChange={event => update('knownPrefixes', event.target.value)} placeholder="CZC, CC" /></label><label className="tool-control">Validation pattern<input value={options.pattern} maxLength={120} onChange={event => update('pattern', event.target.value)} placeholder="^[A-Z0-9]{6,20}$" /></label>
    </div><div className="tool-row"><label><input type="checkbox" checked={options.removeSeparators} onChange={event => update('removeSeparators', event.target.checked)} /> Remove spaces and separators</label><span>{props.selectedIds.size} selected rows</span></div>
    <button className="primary-button" disabled={props.busy || pending || !options.column || props.selectedIds.size === 0} onClick={run}>{pending ? 'Checking serials…' : 'Preview serials'}</button><ErrorText message={error} />
      {preview && <div className="tool-preview"><p>{preview.length} row(s) · {preview.filter(row => row.status === 'invalid').length} invalid · {preview.filter(row => row.status === 'duplicate').length} duplicates{drops ? ` · ${drops} row(s) will be removed` : ''}</p><div className="tool-table"><table><thead><tr><th>Row</th><th>Original</th><th>Result</th><th>Status</th></tr></thead><tbody>{preview.slice(0, 200).map(row => <tr key={row.rowId}><td>{row.rowId}</td><td>{row.before || '—'}</td><td>{row.after || '—'}</td><td>{row.message ?? row.status}</td></tr>)}</tbody></table></div>{options.mode !== 'validate' && <button className="primary-button" disabled={props.busy || preview.some(row => row.status === 'invalid')} onClick={apply}>{drops ? `Apply and remove ${drops} duplicates` : 'Apply serial changes'}</button>}{drops > 0 && <p>For each repeated normalized serial, the first dataset row is retained. Review the preview before applying.</p>}</div>}
    <p>Custom patterns are length limited and reject known high-risk constructs before validation.</p></section>
  </ToolFrame>;
}
