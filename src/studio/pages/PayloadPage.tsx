import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioPageProps } from '../contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../ui';
import { checkPayload, payloadPreset } from '../../features/payload-builder/model';

export function PayloadPage(props: StudioPageProps) {
  const [code, setCode] = useState({ ...props.template.code, type: 'qr' as const });
  const [batch, setBatch] = useState('');
  const [message, setMessage] = useState('');
  const [validating, setValidating] = useState(false);
  const validation = useRef<AbortController | null>(null);
  const rows = useMemo(() => props.dataset?.records.filter(record => props.selectedIds.has(record.id)) ?? [], [props.dataset, props.selectedIds]);
  useEffect(() => { validation.current?.abort(); setValidating(false); setBatch(''); return () => validation.current?.abort(); }, [rows, code]);
  const preview = useMemo(() => {
    if (!rows[0]) return { error: 'Select a row in Asset labels to preview a payload.' };
    try { return { result: checkPayload(rows[0], code) }; } catch (reason) { return { error: reason instanceof Error ? reason.message : 'Check the payload.' }; }
  }, [rows, code]);
  if (!props.dataset) return <NoDataset onImport={() => props.onNavigate('asset-labels')} />;
  async function validateBatch() {
    validation.current?.abort(); const controller = new AbortController(); validation.current = controller; setValidating(true);
    let failures = 0; const notes: string[] = [];
    for (const [index, record] of rows.entries()) {
      if (controller.signal.aborted) return;
      try { checkPayload(record, code); } catch (reason) { failures += 1; if (notes.length < 10) notes.push(`${record.id}: ${reason instanceof Error ? reason.message : 'Invalid payload'}`); }
      if (index % 16 === 15) { setBatch(`Checking ${index + 1} / ${rows.length}…`); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
    if (controller.signal.aborted) return;
    setBatch(`${rows.length - failures} valid / ${rows.length} selected. ${failures} invalid. ${notes.join(' ')}`);
    setValidating(false);
  }
  return <ToolFrame title="QR payload builder" description="Compose and validate the exact content encoded on your labels. Column values are encoded safely in URI modes; everything stays local.">
    <div className="tool-grid"><section className="tool-card"><h2>Build content</h2><fieldset disabled={props.busy} className="editor-controls">
      <label className="tool-control">Preset<select aria-label="Payload preset" defaultValue="" onChange={event => { setCode(current => ({ ...current, ...payloadPreset(event.target.value as Parameters<typeof payloadPreset>[0], current.field || props.idField) })); setBatch(''); setMessage(''); }}><option value="" disabled>Choose a starting point</option><option value="raw">Raw identifier</option><option value="text">Custom text</option><option value="url">HTTP / HTTPS URL</option><option value="fieldlens">FieldLens asset URI</option><option value="structured">Structured key/value text</option></select></label>
      <ColumnSelect label="Payload identifier column" dataset={props.dataset} value={code.field} onChange={field => { setCode(current => ({ ...current, field })); setBatch(''); }} />
      <label className="tool-control">Validation mode<select aria-label="Payload validation mode" value={code.payloadMode ?? 'text'} onChange={event => { setCode(current => ({ ...current, payloadMode: event.target.value as typeof code.payloadMode })); setBatch(''); }}><option value="text">Text</option><option value="url">HTTP / HTTPS</option><option value="fieldlens">FieldLens</option><option value="location">Location hierarchy</option></select></label>
      <label className="tool-control">Content template<textarea aria-label="Payload builder template" maxLength={2000} rows={5} value={code.payload} placeholder="Leave empty to encode the identifier value" onChange={event => { setCode(current => ({ ...current, payload: event.target.value })); setBatch(''); }} /></label>
      <div className="tool-row" aria-label="Insert payload column">{props.dataset.columns.map(column => <button className="mini-button" key={column} onClick={() => { setCode(current => ({ ...current, payload: (current.payload + `{${column}}`).slice(0, 2000) })); setBatch(''); }}>Insert {column}</button>)}</div>
      <label className="tool-control">QR size (mm)<input aria-label="Payload QR size" type="number" min={8} max={200} value={code.sizeMm} onChange={event => { setCode(current => ({ ...current, sizeMm: event.target.valueAsNumber })); setBatch(''); }} /></label>
      <div className="tool-row"><button className="secondary-button" disabled={!rows.length || validating} onClick={() => void validateBatch()}>Validate selected payloads</button>{validating && <button className="secondary-button" onClick={() => { validation.current?.abort(); setValidating(false); setBatch('Validation cancelled.'); }}>Cancel validation</button>}<button className="primary-button" disabled={!preview.result || validating} onClick={() => { try { props.onApplyTemplate({ ...props.template, code }); setMessage('Payload applied to the label.'); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Could not apply payload.'); } }}>Apply to label</button></div>
    </fieldset></section><section className="tool-card"><h2>Live payload preview</h2>{preview.error ? <p role="alert" className="alert error-alert">{preview.error}</p> : <><pre className="tool-preview">{preview.result?.payload}</pre><p>{preview.result?.length} characters · {preview.result?.modules} modules including quiet zone · {preview.result?.moduleMm.toFixed(3)} mm per module</p>{preview.result?.warning && <p className="alert warning-alert">{preview.result.warning}</p>}</>}
      <p>HTTP templates encode inserted column values, including slashes and spaces. FieldLens requires one unescaped identifier and rejects those characters. Structured text uses one key=value pair per line.</p>
      {message && <p role="status">{message}</p>}{batch && <p role="status">{batch}</p>}
    </section></div>
  </ToolFrame>;
}
