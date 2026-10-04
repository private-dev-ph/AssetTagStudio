import { useEffect, useMemo, useRef, useState } from 'react';
import type { LabelTemplate, PageSettings } from '../../types';
import { DEFAULT_TEMPLATE } from '../../types';
import { clearEntries, deleteEntry, listEntries, putEntry, type LibraryEntry } from '../../features/storage/library';
import { mapTemplateFields, parseTemplateDocument, serializeTemplateDocument, type TemplateDocument } from '../../features/templates/documents';
import type { StudioPageProps } from '../contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../ui';

type Preset = { name: string; template: LabelTemplate; page?: PageSettings };

function preset(name: string, patch: Partial<LabelTemplate>, code: Partial<LabelTemplate['code']>, fields: LabelTemplate['fields']): Preset {
  return { name, template: { ...DEFAULT_TEMPLATE, ...patch, code: { ...DEFAULT_TEMPLATE.code, ...code }, fields } };
}

export const BUILT_IN_TEMPLATES: Preset[] = [
  preset('Standard Asset Tag', {}, { type: 'qr', field: 'Asset ID' }, [
    { source: 'Asset Name', label: 'Name', fontSize: 10, bold: true },
    { source: 'Location', label: 'Location', fontSize: 8, bold: false },
  ]),
  preset('Small Equipment', { widthMm: 40, heightMm: 20, paddingMm: 1 }, { type: 'qr', field: 'Asset ID', sizeMm: 13 }, [
    { source: 'Asset Name', label: '', fontSize: 8, bold: true },
  ]),
  preset('IT Laptop', { widthMm: 60, heightMm: 30 }, { type: 'qr', field: 'Serial Number', sizeMm: 18 }, [
    { source: 'Asset Name', label: 'Device', fontSize: 9, bold: true },
    { source: 'Serial Number', label: 'S/N', fontSize: 7, bold: false },
    { source: 'Assigned To', label: 'User', fontSize: 7, bold: false },
  ]),
  preset('Cable', { widthMm: 50, heightMm: 15, paddingMm: 1, mode: 'cable', textLayout: 'mirrored', border: false, alignment: 'center' }, { type: 'none', field: '', payload: '', sizeMm: 0, barcodeHeightMm: 0 }, [
    { source: 'From', label: '', fontSize: 8, bold: true },
    { source: 'To', label: '', fontSize: 8, bold: true },
    { source: 'Cable Type', label: '', fontSize: 6, bold: false },
  ]),
  preset('Warehouse Bin', { widthMm: 80, heightMm: 40, alignment: 'center' }, { type: 'code128', field: 'Bin Code', barcodeHeightMm: 14 }, [
    { source: 'Bin Code', label: '', fontSize: 14, bold: true },
    { source: 'Zone', label: 'Zone', fontSize: 8, bold: false },
  ]),
  preset('Location', { widthMm: 50, heightMm: 25, mode: 'location', alignment: 'center' }, { type: 'qr', field: 'Location Code', payload: 'location://{Location Code}', payloadMode: 'location' }, [
    { source: 'Location Name', label: '', fontSize: 10, bold: true },
    { source: 'Location Code', label: 'Code', fontSize: 8, bold: false },
  ]),
];

function references(template: LabelTemplate): string[] {
  return [...new Set([...(template.code.type !== 'none' && template.code.field ? [template.code.field] : []), ...template.fields.map((field) => field.source), ...[...template.code.payload.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])])];
}

function setFieldMapping(current: Record<string, string>, source: string, value: string): Record<string, string> {
  const next = Object.assign(Object.create(null) as Record<string, string>, current);
  next[source] = value;
  return next;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadDocument(name: string, template: LabelTemplate, page?: PageSettings) {
  const json = serializeTemplateDocument(name, template, page);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'template'}.assettag.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TemplatesPage({ dataset, template, page, busy, onApplyTemplate, onNavigate }: StudioPageProps) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [selected, setSelected] = useState<TemplateDocument | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const datasetColumns = dataset?.columns ?? [];
  const refs = useMemo(() => selected ? references(selected.template) : [], [selected]);
  const mapped = useMemo(() => selected ? mapTemplateFields(selected.template, datasetColumns, fieldMap) : null, [selected, datasetColumns, fieldMap]);
  const disabled = busy || loading;

  async function refresh() {
    setLoading(true);
    try {
      const next = await listEntries('templates');
      setEntries(next);
      setLoadFailed(false);
      if (selectedId && !next.some((entry) => entry.id === selectedId)) setSelectedId('');
    } catch (reason) { setEntries([]); setLoadFailed(true); setError(reason instanceof Error ? reason.message : 'Saved templates could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  function selectDocument(document: TemplateDocument, id = '') {
    setSelected(document); setSelectedId(id); setNewName(document.name); setError(''); setNotice('');
    const nextMap = Object.create(null) as Record<string, string>;
    for (const source of references(document.template)) nextMap[source] = datasetColumns.includes(source) ? source : '';
    setFieldMap(nextMap);
  }

  function selectPreset(item: Preset) {
    selectDocument({ version: 1, kind: 'template', name: item.name, template: item.template, ...(item.page ? { page: item.page } : {}) });
  }

  async function importFile(file: File) {
    setError(''); setNotice('');
    if (file.size > 128 * 1024) { setError('Template file must be 128 KiB or smaller.'); return; }
    try {
      const document = parseTemplateDocument(await file.text());
      selectDocument(document);
      setNotice('Template imported. Map its fields to this dataset before applying or saving it.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Template file could not be imported.'); }
  }

  function applySelected() {
    if (!selected || !mapped) return;
    if (mapped.missing.length) { setError(`Map every template field before applying: ${mapped.missing.join(', ')}.`); return; }
    try {
      onApplyTemplate(mapped.template, selected.page, selected.name);
      setError(''); setNotice(`${selected.name} applied to the current dataset.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'This template could not be applied. Check its label and page settings.'); }
  }

  async function saveCurrent() {
    const name = newName.trim();
    if (!name || name.length > 100) { setError('Enter a template name from 1 to 100 characters.'); return; }
    try {
      const json = serializeTemplateDocument(name, template, page);
      const entry = { id: selectedId || makeId(), name, json };
      await putEntry('templates', entry);
      setNotice(selectedId ? 'Template updated in your library.' : 'Template saved to your library.'); setError('');
      await refresh();
      setSelectedId(entry.id); setSelected(parseTemplateDocument(json));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Template could not be saved.'); }
  }

  async function duplicateEntry(entry: LibraryEntry) {
    try {
      const document = parseTemplateDocument(entry.json);
      const name = `${document.name} copy`.slice(0, 100);
      const json = serializeTemplateDocument(name, document.template, document.page);
      await putEntry('templates', { id: makeId(), name, json });
      await refresh(); setNotice(`${name} added to your library.`); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Template could not be duplicated.'); }
  }

  async function renameSavedEntry() {
    if (!selected || !selectedId) return;
    const name = newName.trim();
    if (!name || name.length > 100) { setError('Enter a template name from 1 to 100 characters.'); return; }
    try {
      const json = serializeTemplateDocument(name, selected.template, selected.page);
      await putEntry('templates', { id: selectedId, name, json });
      setSelected({ ...selected, name });
      await refresh(); setError(''); setNotice('Saved template renamed. Its label and page settings were preserved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Saved template could not be renamed.'); }
  }

  async function resetTemplateLibrary() {
    setResetting(true);
    try {
      await clearEntries('templates');
      setEntries([]); setSelected(null); setSelectedId(''); setLoadFailed(false); setError('');
      setNotice('Saved template library cleared.');
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Saved template library could not be cleared.'); }
    finally { setResetting(false); }
  }

  async function removeEntry(entry: LibraryEntry) {
    try {
      await deleteEntry('templates', entry.id);
      if (selectedId === entry.id) { setSelectedId(''); setSelected(null); }
      await refresh(); setNotice(`${entry.name} deleted from your library.`); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Template could not be deleted.'); }
  }

  if (!dataset) return <ToolFrame title="Templates" description="Save, import, and apply reusable label and page settings.">
    {error && <div className="alert error-alert" role="alert">{error}{loadFailed && <button className="secondary-button" disabled={loading || resetting} onClick={() => void resetTemplateLibrary()}>{resetting ? 'Resetting…' : 'Clear saved templates and retry'}</button>}</div>}
    <NoDataset onImport={() => onNavigate('asset-labels')} />
  </ToolFrame>;

  return <ToolFrame title="Templates" description="Save reusable label and page settings. Map every field to this dataset before applying a template.">
    {(error || notice) && <div className={`alert ${error ? 'error-alert' : 'success-alert'}`} role={error ? 'alert' : 'status'}>{error || notice}{loadFailed && <button className="secondary-button" disabled={disabled || resetting} onClick={() => void resetTemplateLibrary()}>{resetting ? 'Resetting…' : 'Clear saved templates and retry'}</button>}</div>}
    <div className="tool-grid">
      <section className="tool-card">
        <h2>Built-in templates</h2>
        <p>Choose a starting layout, then map its fields to the columns in your dataset.</p>
        <div className="tool-row">{BUILT_IN_TEMPLATES.map((item) => <button key={item.name} className="secondary-button" disabled={disabled} onClick={() => selectPreset(item)}>{item.name}</button>)}</div>
        <div className="tool-row"><button className="secondary-button" disabled={disabled} onClick={() => input.current?.click()}>Import .assettag.json</button><input ref={input} type="file" accept=".json,.assettag.json,application/json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} /></div>
      </section>
      <section className="tool-card">
        <h2>Your template library</h2>
        {loading ? <p role="status">Loading saved templates…</p> : entries.length ? <div className="tool-table"><table><thead><tr><th scope="col">Name</th><th scope="col">Actions</th></tr></thead><tbody>{entries.map((entry) => {
          let parseError = '';
          try { parseTemplateDocument(entry.json); } catch (reason) { parseError = reason instanceof Error ? reason.message : 'Invalid saved document'; }
          return <tr key={entry.id}><td><button className="text-button" disabled={disabled || Boolean(parseError)} onClick={() => { try { selectDocument(parseTemplateDocument(entry.json), entry.id); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Saved template is invalid.'); } }}>{entry.name}</button>{parseError && <small role="alert">{parseError}</small>}</td><td className="tool-row"><button className="secondary-button" disabled={disabled || Boolean(parseError)} onClick={() => void duplicateEntry(entry)}>Duplicate</button><button className="secondary-button" disabled={disabled} onClick={() => void removeEntry(entry)}>Delete</button></td></tr>;
        })}</tbody></table></div> : <p>No saved templates yet.</p>}
      </section>
      {selected && <section className="tool-card">
        <h2>Map and apply: {selected.name}</h2>
        <p>Each source field must point to a column in the current dataset. Imported field references are kept until you choose a mapping.</p>
        {refs.length ? <div className="tool-grid">{refs.map((source) => <ColumnSelect key={source} label={source} dataset={dataset} value={fieldMap[source] ?? ''} optional onChange={(value) => setFieldMap((current) => setFieldMapping(current, source, value))} disabled={disabled} />)}</div> : <p>This template has no dataset field references.</p>}
        {mapped?.missing.length ? <p className="diagnostic-warning" role="status">Needs mapping: {mapped.missing.join(', ')}</p> : <p className="diagnostic-ok">All template fields are mapped.</p>}
        <div className="tool-row"><button className="primary-button" disabled={disabled || Boolean(mapped?.missing.length)} onClick={applySelected}>Apply template</button><button className="secondary-button" disabled={disabled} onClick={() => { try { downloadDocument(selected.name, mapped?.template ?? selected.template, selected.page); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Template export failed.'); } }}>Export JSON</button></div>
      </section>}
      <section className="tool-card">
        <h2>Save current settings</h2>
        <p>Only label and page settings are saved. Dataset rows stay in the current browser session.</p>
        <label className="tool-control">Template name<input value={newName} maxLength={100} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Receiving labels" disabled={disabled} /></label>
        <div className="tool-row"><button className="primary-button" disabled={disabled} onClick={() => void saveCurrent()}>{selectedId ? 'Replace saved settings with current settings' : 'Save current settings'}</button>{selectedId && <><button className="secondary-button" disabled={disabled} onClick={() => void renameSavedEntry()}>Rename saved template</button><button className="secondary-button" disabled={disabled} onClick={() => { setSelectedId(''); setNewName(`${newName} copy`.slice(0, 100)); }}>Save current settings as a copy</button></>}</div>
      </section>
    </div>
  </ToolFrame>;
}
