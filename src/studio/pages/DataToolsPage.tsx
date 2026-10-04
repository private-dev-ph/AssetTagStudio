import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dataset } from '../../types';
import { readValue } from '../../core/dataset';
import type { StudioPageProps } from '../contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../ui';
import { auditDataset, previewHealthFix, type HealthFix, type HealthPreview } from '../../features/data-health/logic';
import { applyIdsToColumn, previewIds, type IdGeneratorOptions, type IdPreviewRow } from '../../features/id-generator/logic';
import { applySerialPreview, PreviewGeneration, previewSerials, type SerialOptions, type SerialPreviewRow } from '../../features/serial-tools/logic';
import { selectBoundedRows } from './boundedSelection';

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
      <div className="tool-table health-findings"><table><thead><tr><th scope="col">Severity</th><th scope="col">Issue</th></tr></thead><tbody>{findings.map((item, index) => <tr key={`${item.code}-${item.rowIds?.join(',') ?? item.column ?? ''}-${index}`}><td>{item.severity}</td><td>{item.message}</td></tr>)}</tbody></table></div>
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
  const [batchStart, setBatchStart] = useState(1);
  const [batchCount, setBatchCount] = useState(() => Math.min(2_000, props.selectedIds.size));
  const [error, setError] = useState('');
  const [continuationNotice, setContinuationNotice] = useState('');
  const ownCommit = useRef<{ dataset: Dataset; batchStart: number; batchCount: number; nextSequence: number; appliedCount: number; sequenceLimitReached: boolean } | null>(null);
  const selectedCount = dataset.records.filter(record => props.selectedIds.has(record.id)).length;
  const populatedCount = dataset.records.filter(record => props.selectedIds.has(record.id) && Boolean(options.column && readValue(record, options.column).trim())).length;
  const blankCount = options.column ? selectedCount - populatedCount : 0;
  const eligibleCount = options.overwrite ? selectedCount : blankCount;
  useLayoutEffect(() => {
    const continuation = ownCommit.current?.dataset === dataset ? ownCommit.current : null;
    ownCommit.current = null;
    setOptions(current => ({ ...current, selectedIds: props.selectedIds, column: dataset.columns.includes(current.column) ? current.column : '', ...(continuation ? { start: continuation.nextSequence } : {}) }));
    if (continuation) {
      setBatchStart(continuation.batchStart); setBatchCount(continuation.batchCount);
      setContinuationNotice(continuation.sequenceLimitReached
        ? `Applied ${continuation.appliedCount} ID(s). The sequence limit was reached; choose a new sequence before continuing.`
        : `Applied ${continuation.appliedCount} ID(s). Next sequence is ${continuation.nextSequence}. Use Next batch, then Preview IDs to continue.`);
    } else {
      setBatchStart(1); setBatchCount(Math.min(2_000, dataset.records.filter(record => props.selectedIds.has(record.id)).length));
      setContinuationNotice('');
    }
    setPreview(null); setError('');
  }, [dataset, props.selectedIds, selectedCount, setPreview]);
  const update = <K extends keyof IdGeneratorOptions>(key: K, value: IdGeneratorOptions[K]) => { setOptions(current => ({ ...current, [key]: value })); if (key === 'start') setContinuationNotice(''); setPreview(null); };
  const updateBatch = (start: number, count: number) => { setBatchStart(start); setBatchCount(count); setPreview(null); setError(''); };
  const run = () => { try { setError(''); const batch = selectBoundedRows(dataset, props.selectedIds, batchStart, batchCount, 5_000); setPreview(previewIds(dataset, { ...options, selectedIds: batch.selectedIds })); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create an ID preview.'); setPreview(null); } };
  const apply = () => {
    if (!preview || props.busy) return;
    try {
      const next = applyIdsToColumn(dataset, options.column, preview);
      const requestedNextSequence = options.start + preview.length;
      const nextSequence = Math.min(requestedNextSequence, 999_999_999);
      ownCommit.current = { dataset: next, batchStart, batchCount, nextSequence, appliedCount: preview.length, sequenceLimitReached: requestedNextSequence > 999_999_999 };
      try { props.onCommitDataset(next, 'Generate asset identifiers'); }
      catch (reason) { ownCommit.current = null; throw reason; }
      setPreview(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply generated IDs.'); }
  };
  return <ToolFrame title="Asset ID Generator" description="Create consistent identifiers for selected rows and check collisions before applying.">
    <section className="tool-card"><h2>Pattern</h2><div className="tool-grid">
      <ColumnSelect label="Identifier column" dataset={dataset} value={options.column} onChange={value => update('column', value)} />
      <label className="tool-control">Pattern<input value={options.pattern} maxLength={500} onChange={event => update('pattern', event.target.value)} /><small>Tokens: {'{sequence}'}, {'{year}'}, {'{date}'}, or {'{Column Name}'}.</small></label>
      <label className="tool-control">Prefix<input value={options.prefix} maxLength={200} onChange={event => update('prefix', event.target.value)} /></label><label className="tool-control">Suffix<input value={options.suffix} maxLength={200} onChange={event => update('suffix', event.target.value)} /></label>
      <label className="tool-control">Start sequence<input type="number" min={0} max={999999999} value={options.start} onChange={event => update('start', Number(event.target.value))} /></label><label className="tool-control">Zero padding<input type="number" min={1} max={12} value={options.padding} onChange={event => update('padding', Number(event.target.value))} /></label>
      <label className="tool-control">Year<input value={options.year} maxLength={4} onChange={event => update('year', event.target.value)} /></label><label className="tool-control">Date<input type="date" value={options.date} onChange={event => update('date', event.target.value)} /></label>
    </div><div className="tool-row"><label><input type="checkbox" checked={options.blankOnly} onChange={event => { setOptions(current => ({ ...current, blankOnly: event.target.checked, overwrite: event.target.checked ? false : current.overwrite })); setPreview(null); }} /> Generate for blank IDs only</label><label><input type="checkbox" checked={options.overwrite} onChange={event => { setOptions(current => ({ ...current, overwrite: event.target.checked, blankOnly: event.target.checked ? false : true })); setPreview(null); }} /> Allow overwriting existing IDs</label></div>
    <p>{selectedCount} selected · {eligibleCount} eligible · {blankCount} blank · {populatedCount} populated. Blank-only is the safe default. Enable “Allow overwriting existing IDs” to include populated rows.</p>
    {continuationNotice && <p role="status">{continuationNotice}</p>}
    {selectedCount === 0 ? <p>Select rows to preview IDs.</p> : options.column && eligibleCount === 0 ? <p>All selected IDs are populated. Enable overwriting to generate replacements.</p> : null}
    <BatchControls disabled={props.busy} selectedCount={selectedCount} start={batchStart} count={batchCount} maxCount={5_000} onChange={updateBatch} />
    <button className="primary-button" disabled={props.busy || selectedCount === 0 || batchStart > selectedCount || !options.column} onClick={run}>Preview IDs</button><ErrorText message={error} />
    {preview && <div className="tool-preview"><p>{preview.length} ID(s) · {preview.filter(row => row.status === 'collision').length} collision(s)</p><p>Previewing {preview.length} of {selectedCount} selected row(s), starting at selected row {batchStart}.</p>{preview.length === 0 && eligibleCount > 0 ? <p>This batch has no blank IDs. Move to another batch or enable overwriting.</p> : null}<div className="tool-table"><table><thead><tr><th scope="col">Row</th><th scope="col">Before</th><th scope="col">Generated</th><th scope="col">Status</th></tr></thead><tbody>{preview.slice(0, 200).map(row => <tr key={row.rowId}><td>{row.rowId}</td><td>{row.before || '—'}</td><td>{row.after}</td><td>{row.message ?? row.status}</td></tr>)}</tbody></table></div><p>Apply affects only the {preview.length} rows in this preview.</p><button className="primary-button" disabled={props.busy || preview.length === 0 || preview.some(row => row.status === 'collision')} onClick={apply}>Apply IDs</button></div>}
    </section>
  </ToolFrame>;
}

function SerialPage(props: DataToolsPageProps & { dataset: Dataset }) {
  const { dataset } = props;
  const [options, setOptions] = useState<SerialOptions>(() => ({ ...emptySerial, column: fieldDefault(dataset, /serial|s\/n/i), selectedIds: props.selectedIds }));
  const [preview, setPreview] = useFreshPreview<SerialPreviewRow[]>(dataset);
  const [batchStart, setBatchStart] = useState(1);
  const [batchCount, setBatchCount] = useState(() => Math.min(2_000, props.selectedIds.size));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [continuationNotice, setContinuationNotice] = useState('');
  const ownCommit = useRef<{ dataset: Dataset; batchStart: number; batchCount: number; mode: SerialOptions['mode']; appliedCount: number } | null>(null);
  const requestGeneration = useRef(new PreviewGeneration());
  useLayoutEffect(() => {
    requestGeneration.current.invalidate(); setPending(false);
    const continuation = ownCommit.current?.dataset === dataset ? ownCommit.current : null;
    ownCommit.current = null;
    setOptions(current => ({ ...current, selectedIds: props.selectedIds, column: dataset.columns.includes(current.column) ? current.column : '' }));
    if (continuation?.mode !== 'deduplicate' && continuation) {
      setBatchStart(continuation.batchStart); setBatchCount(continuation.batchCount);
      setContinuationNotice(`Applied ${continuation.appliedCount} serial row(s). Use Next batch, then Preview serials to continue.`);
    } else {
      setBatchStart(1); setBatchCount(Math.min(2_000, dataset.records.filter(record => props.selectedIds.has(record.id)).length));
      setContinuationNotice('');
    }
    setPreview(null); setError('');
    return () => requestGeneration.current.invalidate();
  }, [dataset, props.selectedIds, setPreview]);
  const update = <K extends keyof SerialOptions>(key: K, value: SerialOptions[K]) => { requestGeneration.current.invalidate(); setPending(false); setOptions(current => ({ ...current, [key]: value })); setContinuationNotice(''); setPreview(null); };
  const updateBatch = (start: number, count: number) => { requestGeneration.current.invalidate(); setPending(false); setBatchStart(start); setBatchCount(count); setPreview(null); setError(''); setContinuationNotice(''); };
  const selectedCount = dataset.records.filter(record => props.selectedIds.has(record.id)).length;
  const run = async () => {
    if (pending) return;
    let batch: ReturnType<typeof selectBoundedRows>;
    try { batch = selectBoundedRows(dataset, props.selectedIds, batchStart, batchCount, 2_000); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create a serial preview.'); setPreview(null); return; }
    const generation = requestGeneration.current.begin();
    setPending(true); setError(''); setPreview(null);
    try {
      const result = await previewSerials(dataset, { ...options, selectedIds: batch.selectedIds });
      if (requestGeneration.current.isCurrent(generation)) setPreview(result);
    } catch (reason) {
      if (requestGeneration.current.isCurrent(generation)) setError(reason instanceof Error ? reason.message : 'Could not create a serial preview.');
    } finally {
      if (requestGeneration.current.isCurrent(generation)) setPending(false);
    }
  };
  const apply = () => {
    if (!preview || props.busy) return;
    try {
      const next = applySerialPreview(dataset, options.column, preview, options.mode === 'deduplicate');
      ownCommit.current = { dataset: next, batchStart, batchCount, mode: options.mode, appliedCount: preview.length };
      try { props.onCommitDataset(next, options.mode === 'deduplicate' ? 'Deduplicate serial numbers' : 'Normalize serial numbers'); }
      catch (reason) { ownCommit.current = null; throw reason; }
      setPreview(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not apply serial changes.'); }
  };
  const drops = preview?.filter(row => row.drop).length ?? 0;
  return <ToolFrame title="Serial Tools" description="Normalize and validate serial values with a before and after preview.">
    <section className="tool-card"><div className="tool-grid"><ColumnSelect label="Serial column" dataset={dataset} value={options.column} onChange={value => update('column', value)} />
      <label className="tool-control">Action<select value={options.mode} onChange={event => update('mode', event.target.value as SerialOptions['mode'])}><option value="normalize">Normalize</option><option value="extract">Extract serial from text</option><option value="validate">Validate only</option><option value="deduplicate">Deduplicate</option></select></label>
      <label className="tool-control">Casing<select value={options.casing} onChange={event => update('casing', event.target.value as SerialOptions['casing'])}><option value="upper">Uppercase</option><option value="lower">Lowercase</option><option value="preserve">Preserve</option></select></label>
      <label className="tool-control">Strip leading prefix<input maxLength={80} value={options.stripPrefix} onChange={event => update('stripPrefix', event.target.value)} placeholder="SN:" /></label>
      <label className="tool-control">Minimum length<input type="number" min={0} max={500} value={options.minLength} onChange={event => update('minLength', Number(event.target.value))} /></label><label className="tool-control">Maximum length<input type="number" min={0} max={500} value={options.maxLength} onChange={event => update('maxLength', Number(event.target.value))} /></label>
      <label className="tool-control">Known prefixes<input value={options.knownPrefixes} maxLength={1000} onChange={event => update('knownPrefixes', event.target.value)} placeholder="CZC, CC" /></label><label className="tool-control">Validation pattern<input value={options.pattern} maxLength={120} onChange={event => update('pattern', event.target.value)} placeholder="^[A-Z0-9]{6,20}$" /></label>
    </div><div className="tool-row"><label><input type="checkbox" checked={options.removeSeparators} onChange={event => update('removeSeparators', event.target.checked)} /> Remove spaces and separators</label></div>
    <p>{selectedCount} selected row(s). Previews are limited to 2,000 selected rows per batch.</p>
    {continuationNotice && <p role="status">{continuationNotice}</p>}
    <BatchControls disabled={props.busy} selectedCount={selectedCount} start={batchStart} count={batchCount} maxCount={2_000} onChange={updateBatch} />
    <button className="primary-button" disabled={props.busy || pending || !options.column || selectedCount === 0 || batchStart > selectedCount} onClick={run}>{pending ? 'Checking serials…' : 'Preview serials'}</button><ErrorText message={error} />
      {preview && <div className="tool-preview"><p>{preview.length} row(s) · {preview.filter(row => row.status === 'invalid').length} invalid · {preview.filter(row => row.status === 'duplicate').length} duplicates{drops ? ` · ${drops} row(s) will be removed` : ''}</p><p>Previewing {preview.length} of {selectedCount} selected row(s), starting at selected row {batchStart}.</p><div className="tool-table"><table><thead><tr><th scope="col">Row</th><th scope="col">Original</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead><tbody>{preview.slice(0, 200).map(row => <tr key={row.rowId}><td>{row.rowId}</td><td>{row.before || '—'}</td><td>{row.after || '—'}</td><td>{row.message ?? row.status}</td></tr>)}</tbody></table></div>{options.mode !== 'validate' && <><p>Apply affects only the {preview.length} rows in this preview.</p><button className="primary-button" disabled={props.busy || preview.some(row => row.status === 'invalid')} onClick={apply}>{drops ? `Apply and remove ${drops} duplicates` : 'Apply serial changes'}</button></>}{drops > 0 && <p>For each repeated normalized serial, the first dataset row is retained. Review the preview before applying.</p>}</div>}
    <p>Custom patterns are length limited and reject known high-risk constructs before validation.</p></section>
  </ToolFrame>;
}

function BatchControls({ disabled, selectedCount, start, count, maxCount, onChange }: { disabled: boolean; selectedCount: number; start: number; count: number; maxCount: number; onChange: (start: number, count: number) => void }) {
  const previousBatches = useRef<Array<{ start: number; count: number }>>([]);
  useEffect(() => { previousBatches.current = []; }, [selectedCount]);
  const validStart = Number.isInteger(start) && start >= 1 && start <= selectedCount;
  const maxForStart = validStart ? Math.min(maxCount, selectedCount - start + 1) : maxCount;
  const validCount = Number.isInteger(count) && count >= 1 && count <= maxForStart;
  const previous = () => { const prior = previousBatches.current.pop(); onChange(prior?.start ?? Math.max(1, start - count), prior?.count ?? count); };
  const next = () => {
    const nextStart = start + count;
    previousBatches.current.push({ start, count });
    onChange(nextStart, Math.min(count, selectedCount - nextStart + 1));
  };
  return <div className="tool-row">
    <label className="tool-control">Start position<input aria-label="Start position" type="number" min={1} max={Math.max(1, selectedCount)} step={1} value={start} disabled={disabled} onChange={event => { previousBatches.current = []; onChange(Number(event.target.value), count); }} /></label>
    <label className="tool-control">Preview count<input aria-label="Preview count" type="number" min={1} max={maxForStart} step={1} value={count} disabled={disabled} onChange={event => { previousBatches.current = []; onChange(start, Number(event.target.value)); }} /></label>
    <button className="secondary-button" disabled={disabled || !validStart || !validCount || start <= 1} onClick={previous}>Previous batch</button>
    <button className="secondary-button" disabled={disabled || !validStart || !validCount || start + count > selectedCount} onClick={next}>Next batch</button>
  </div>;
}
