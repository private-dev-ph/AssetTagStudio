import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset, LabelField, LabelTemplate, PageSettings } from './types';
import { inspectFile, readSheet } from './features/import/client';
import { validateIdentifiers } from './features/import/normalize';
import { calculateLayout, inchesToMm, mmToInches } from './features/layout/pageLayout';
import { renderLabel, validateTemplate } from './features/labels/renderer';
import { generatePdf } from './features/export/pdf';
import { loadPreferences, savePreferences, type Preferences } from './features/preferences/store';
import './styles.css';

const PAGE_PRESETS: Record<string, [number, number]> = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4] };
const PAGE_FIELDS: { key: keyof PageSettings; label: string }[] = [
  { key: 'marginTopMm', label: 'Top' }, { key: 'marginBottomMm', label: 'Bottom' },
  { key: 'marginLeftMm', label: 'Left' }, { key: 'marginRightMm', label: 'Right' },
];

function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [search, setSearch] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: '', dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [idField, setIdField] = useState('');
  const [template, setTemplate] = useState<LabelTemplate>(() => loadPreferences().template);
  const [page, setPage] = useState<PageSettings>(() => loadPreferences().page);
  const [pageNumber, setPageNumber] = useState(0);
  const [previewData, setPreviewData] = useState<string>('');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState('');
  const [exportController, setExportController] = useState<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewVersion = useRef(0);
  const sheetVersion = useRef(0);
  const importVersion = useRef(0);


  const chosenRecords = useMemo(() => dataset?.records.filter((record) => selected.has(record.id)) ?? [], [dataset, selected]);
  const diagnostics = useMemo(() => dataset && idField ? validateIdentifiers(dataset, idField) : [], [dataset, idField]);
  const noIdCount = chosenRecords.filter((record) => !record.values[idField]?.trim()).length;
  const visibleRecords = useMemo(() => {
    if (!dataset) return [];
    const term = search.trim().toLocaleLowerCase();
    const rows = dataset.records.filter((record) => !term || Object.values(record.values).some((value) => value.toLocaleLowerCase().includes(term)) || record.id.toLocaleLowerCase().includes(term));
    if (sort.key) rows.sort((a, b) => ((a.values[sort.key] ?? '').localeCompare(b.values[sort.key] ?? '', undefined, { numeric: true }) || a.id.localeCompare(b.id)) * sort.dir);
    return rows;
  }, [dataset, search, sort]);
  const tablePages = Math.max(1, Math.ceil(visibleRecords.length / 50));
  const displayRows = visibleRecords.slice(tablePage * 50, tablePage * 50 + 50);
  const pageLayout = useMemo(() => {
    try { return chosenRecords.length ? calculateLayout(template, page, chosenRecords.length) : null; }
    catch { return null; }
  }, [template, page, chosenRecords.length]);
  const layoutError = useMemo(() => {
    if (!chosenRecords.length) return '';
    try { calculateLayout(template, page, chosenRecords.length); return ''; }
    catch (reason) { return reason instanceof Error ? reason.message : 'These labels do not fit on the selected paper size.'; }
  }, [template, page, chosenRecords.length]);
  const pages = pageLayout?.pages ?? 0;
  const previewRecords = useMemo(() => {
    if (!pageLayout || !chosenRecords.length) return [];
    const start = pageNumber * pageLayout.labelsPerPage;
    return chosenRecords.slice(start, start + pageLayout.labelsPerPage).slice(0, 36);
  }, [chosenRecords, pageLayout, pageNumber]);
  const selectedPreview = previewRecords[0] ?? chosenRecords[0] ?? null;
  const [sheetImages, setSheetImages] = useState<Record<string, string>>({});
  const [sheetPreviewError, setSheetPreviewError] = useState('');
  const effectiveTemplate = useMemo(() => ({ ...template, fields: template.fields.filter((field) => !hiddenFields.has(field.source)) }), [template, hiddenFields]);
  useEffect(() => { savePreferences({ ...preferences, template: effectiveTemplate, page }); document.documentElement.dataset.theme = preferences.theme; }, [preferences, effectiveTemplate, page]);
  const templateError = useMemo(() => {
    try { validateTemplate(effectiveTemplate); return ''; } catch (reason) { return reason instanceof Error ? reason.message : 'Check the label settings.'; }
  }, [effectiveTemplate]);

  useEffect(() => {
    const version = ++previewVersion.current;
    if (!selectedPreview || templateError) { setPreviewData(''); setPreviewError(templateError); return; }
    setPreviewData(''); setPreviewError('');
    void renderLabel(selectedPreview, effectiveTemplate).then((data) => {
      if (previewVersion.current === version) setPreviewData(data);
    }).catch((reason: unknown) => {
      if (previewVersion.current === version) setPreviewError(reason instanceof Error ? reason.message : 'The label preview could not be rendered.');
    });
    return () => { previewVersion.current += 1; };
  }, [selectedPreview, effectiveTemplate, templateError]);

  useEffect(() => {
    const version = ++sheetVersion.current;
    if (!previewRecords.length || templateError) { setSheetImages({}); setSheetPreviewError(''); return; }
    setSheetImages({}); setSheetPreviewError('');
    void (async () => {
      const rendered: Record<string, string> = {};
      try {
        for (let index = 0; index < previewRecords.length; index += 1) {
          const record = previewRecords[index];
          rendered[record.id] = await renderLabel(record, effectiveTemplate);
          if (sheetVersion.current !== version) return;
          setSheetImages({ ...rendered });
          if (index % 4 === 3) await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
      } catch (reason) {
        if (sheetVersion.current === version) setSheetPreviewError(reason instanceof Error ? `Sheet preview stopped at label ${Object.keys(rendered).length + 1}: ${reason.message}` : 'A label could not be rendered in the sheet preview.');
      }
    })();
    return () => { sheetVersion.current += 1; };
  }, [previewRecords, effectiveTemplate, templateError]);

  async function importFile(nextFile: File, replaceBusy = false) {
    if ((busy || progress !== null) && !replaceBusy) return;
    const version = ++importVersion.current;
    setError(''); setExportError(''); setDataset(null); setFile(nextFile); setSelected(new Set()); setSheets([]); setSheet('');
    setBusy(true);
    try {
      const result = await inspectFile(nextFile);
      if (version !== importVersion.current) return;
      if (result.kind === 'csv') applyDataset(result.dataset);
      else {
        setSheets(result.sheets); setSheet(result.sheets[0] ?? '');
        if (result.sheets[0]) {
          const next = await readSheet(nextFile, result.sheets[0]);
          if (version === importVersion.current) applyDataset(next);
        }
      }
    } catch (reason) {
      if (version === importVersion.current) setError(reason instanceof Error ? reason.message : 'Could not open this file. Try the CSV template or another workbook.');
    } finally { if (version === importVersion.current) setBusy(false); }
  }

  function applyDataset(next: Dataset) {
    setDataset(next);
    const preferred = next.columns.find((column) => /asset\s*id|serial|identifier|\bid\b/i.test(column)) ?? next.columns[0] ?? '';
    setIdField(preferred);
    setSelected(new Set(next.records.map((record) => record.id)));
    setSearch(''); setSort({ key: '', dir: 1 }); setPageNumber(0); setTablePage(0);
    setHiddenFields(new Set());
    setTemplate((current) => {
      const fields = current.fields.filter((field) => next.columns.includes(field.source)).slice(0, 6);
      const payloadIsCompatible = [...current.code.payload.matchAll(/\{([^{}]+)\}/g)].every((match) => next.columns.includes(match[1]));
      return { ...current, code: { ...current.code, field: next.columns.includes(current.code.field) ? current.code.field : preferred, payload: payloadIsCompatible ? current.code.payload : '' }, fields: fields.length ? fields : next.columns.filter((column) => column !== preferred).slice(0, 2).map((source, index) => ({ source, label: '', fontSize: index === 0 ? 10 : 8, bold: index === 0 })) };
    });
  }

  async function chooseSheet(nextSheet: string) {
    const version = ++importVersion.current;
    setSheet(nextSheet); setError(''); setBusy(true);
    try { if (file) { const next = await readSheet(file, nextSheet); if (version === importVersion.current) applyDataset(next); } }
    catch (reason) { if (version === importVersion.current) setError(reason instanceof Error ? reason.message : 'Could not read this worksheet. Select another sheet or file.'); }
    finally { if (version === importVersion.current) setBusy(false); }
  }

  async function loadDemo() {
    setError(''); setBusy(true);
    try {
      const response = await fetch('/examples/demo-assets.csv');
      if (!response.ok) throw new Error('The sample file could not be loaded.');
      const blob = await response.blob();
      const demo = new File([blob], 'demo-assets.csv', { type: 'text/csv' });
      await importFile(demo, true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The sample file could not be loaded.'); }
    finally { setBusy(false); }
  }

  function updateTemplate(patch: Partial<LabelTemplate>) { setTemplate((current) => ({ ...current, ...patch })); }
  function updateCode(patch: Partial<LabelTemplate['code']>) { setTemplate((current) => ({ ...current, code: { ...current.code, ...patch } })); }
  function updatePage(patch: Partial<PageSettings>) { setPage((current) => ({ ...current, ...patch })); }
  function updateField(index: number, patch: Partial<LabelField>) { setTemplate((current) => ({ ...current, fields: current.fields.map((field, i) => i === index ? { ...field, ...patch } : field) })); }

  function addField() {
    const source = dataset?.columns.find((column) => column !== idField && !template.fields.some((field) => field.source === column));
    if (source) setTemplate((current) => ({ ...current, fields: [...current.fields, { source, label: source, fontSize: 8, bold: false }] }));
  }
  function moveField(index: number, by: number) {
    setTemplate((current) => { const fields = [...current.fields]; const target = index + by; if (target < 0 || target >= fields.length) return current; [fields[index], fields[target]] = [fields[target], fields[index]]; return { ...current, fields }; });
  }

  function toggleRecord(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (visibleRecords.every((record) => next.has(record.id))) visibleRecords.forEach((record) => next.delete(record.id));
      else visibleRecords.forEach((record) => next.add(record.id));
      return next;
    });
  }
  function removeSelected() {
    if (!dataset) return;
    const records = dataset.records.filter((record) => !selected.has(record.id));
    setDataset({ ...dataset, records }); setSelected(new Set()); setPageNumber(0); setTablePage(0);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { const next = event.currentTarget.files?.[0]; if (next) void importFile(next); event.currentTarget.value = ''; }
  function onDrop(event: DragEvent<HTMLElement>) { event.preventDefault(); setDragging(false); const next = event.dataTransfer.files[0]; if (next && !busy && progress === null) void importFile(next); }

  async function exportPdf() {
    if (!dataset || !chosenRecords.length || !idField || noIdCount > 0 || templateError) return;
    setExportError(''); setProgress(0);
    const controller = new AbortController(); setExportController(controller);
    try {
      const bytes = await generatePdf(chosenRecords, effectiveTemplate, page, { signal: controller.signal, onProgress: (complete, total) => setProgress(total ? Math.round((complete / total) * 100) : 100) });
      const pdfBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(pdfBuffer).set(bytes);
      const url = URL.createObjectURL(new Blob([pdfBuffer], { type: 'application/pdf' }));
      const anchor = document.createElement('a');
      const now = new Date(); const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      anchor.href = url; anchor.download = `asset-labels-${localDate}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setProgress(null);
    } catch (reason) {
      if (!controller.signal.aborted) setExportError(reason instanceof Error ? reason.message : 'PDF export failed. Check the page and label settings.');
      setProgress(null);
    } finally { setExportController(null); }
  }

  function setDimension(key: 'widthMm' | 'heightMm' | 'paddingMm' | 'sizeMm' | 'barcodeHeightMm', displayed: number) {
    const value = preferences.unit === 'in' ? inchesToMm(displayed) : displayed;
    if (key === 'sizeMm' || key === 'barcodeHeightMm') updateCode({ [key]: value });
    else updateTemplate({ [key]: value });
  }
  const shown = (mm: number) => preferences.unit === 'in' ? Number(mmToInches(mm).toFixed(2)) : mm;
  const paperScale = Math.min(600 / page.widthMm, 500 / page.heightMm);
  useEffect(() => { setPageNumber((value) => Math.min(value, Math.max(0, pages - 1))); }, [pages]);
  function setPageDimension(key: 'widthMm' | 'heightMm', displayed: number) { updatePage({ [key]: preferences.unit === 'in' ? inchesToMm(displayed) : displayed, preset: 'Custom' }); }
  function setMargin(key: keyof PageSettings, displayed: number) { updatePage({ [key]: preferences.unit === 'in' ? inchesToMm(displayed) : displayed }); }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AssetTag Studio home"><span className="brand-mark">A</span><span>AssetTag <b>Studio</b></span></a>
      <div className="topbar-actions">
        {dataset && <span className="privacy-note"><span className="status-dot" /> Files stay on this device</span>}
        <button className="icon-button" aria-label={`Switch to ${preferences.theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setPreferences((value) => ({ ...value, theme: value.theme === 'light' ? 'dark' : 'light' }))}>{preferences.theme === 'light' ? '◐' : '☼'}</button>
        <a className="quiet-link" href="/examples/asset-template.csv" download>Get CSV template</a>
      </div>
    </header>

    <main className="workspace" id="top">
      <section className="intro-row"><div><div className="eyebrow">LOCAL-FIRST LABEL WORKSPACE</div><h1>Turn your asset list into<br /><span>print-ready labels.</span></h1><p>Choose your data, make a label, then export a sheet you can print at actual size.</p></div><div className="step-track" aria-label="Workflow"><span className={dataset ? 'done' : 'active'}><i>1</i> Data</span><b /><span className={dataset ? 'active' : ''}><i>2</i> Design</span><b /><span><i>3</i> Export</span></div></section>

      {!dataset ? <section className={`welcome-card ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,.xlsx,.xls" aria-label="Choose a CSV or Excel file" onChange={onFileChange} />
        <div className="drop-icon">↥</div><h2>{busy ? 'Opening your file…' : 'Start with your asset list'}</h2><p>Drop a CSV or Excel workbook here, or choose a file from your device.</p>
        <div className="welcome-actions"><button className="primary-button" disabled={busy} onClick={() => fileInput.current?.click()}>Choose a file</button><button className="secondary-button" disabled={busy} onClick={() => void loadDemo()}>Try sample data</button></div>
        <div className="file-hint">CSV, XLSX, or XLS · up to 10 MB · processed locally</div>
        {sheets.length > 0 && <label className="inline-control landing-sheet">Worksheet<select aria-label="Worksheet" value={sheet} onChange={(event) => void chooseSheet(event.target.value)} disabled={busy}>{sheets.map((name) => <option key={name}>{name}</option>)}</select></label>}
        {error && <div className="alert error-alert" role="alert">{error}</div>}
      </section> : <>
        <section className="data-strip panel">
          <div className="file-summary"><span className="file-badge">▤</span><div><b>{file?.name ?? 'Asset list'}</b><small>{dataset.records.length.toLocaleString()} rows · {dataset.columns.length} columns</small></div></div>
          {sheets.length > 0 && <label className="inline-control">Worksheet<select aria-label="Worksheet" value={sheet} onChange={(event) => void chooseSheet(event.target.value)} disabled={busy}>{sheets.map((name) => <option key={name}>{name}</option>)}</select></label>}
          <button className="text-button" onClick={() => fileInput.current?.click()}>Replace file</button>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".csv,.xlsx,.xls" aria-label="Choose a CSV or Excel file" onChange={onFileChange} />
          <span className="local-chip">● Local only</span>
        </section>
        {busy && <div className="alert info-alert" role="status">Reading worksheet…</div>}
        {error && <div className="alert error-alert" role="alert">{error}</div>}
        {dataset.warnings.length > 0 && <div className="alert warning-alert" role="status">{dataset.warnings.join(' ')}</div>}

        <div className="workspace-grid">
          <aside className="editor panel" aria-label="Label settings">
            <div className="panel-heading"><div><div className="eyebrow">LABEL EDITOR</div><h2>Make it yours</h2></div><label className="unit-switch">Units<select aria-label="Measurement units" value={preferences.unit} onChange={(event) => setPreferences((value) => ({ ...value, unit: event.target.value as Preferences['unit'] }))}><option value="mm">mm</option><option value="in">inches</option></select></label></div>
            <section className="control-section"><h3>Label size <small>{preferences.unit}</small></h3><div className="two-inputs"><NumberControl label="Width" value={shown(template.widthMm)} min={shown(10)} max={shown(250)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setDimension('widthMm', value)} /><NumberControl label="Height" value={shown(template.heightMm)} min={shown(10)} max={shown(250)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setDimension('heightMm', value)} /></div>
              <div className="label-presets" aria-label="Label size presets">{[['60 × 30 mm', 60, 30], ['50 × 25 mm', 50, 25], ['40 × 20 mm', 40, 20], ['80 × 40 mm', 80, 40], ['Cable 50 × 15 mm', 50, 15]].map(([name, width, height]) => <button key={name} className={template.widthMm === width && template.heightMm === height ? 'selected' : ''} onClick={() => updateTemplate({ widthMm: Number(width), heightMm: Number(height), code: { ...template.code, sizeMm: Math.min(template.code.sizeMm, Number(height) - 2 * template.paddingMm), barcodeHeightMm: Math.min(template.code.barcodeHeightMm, Number(height) - 2 * template.paddingMm) } })}>{name}</button>)}</div>
              <div className="two-inputs compact"><NumberControl label="Inner padding" value={shown(template.paddingMm)} min={0} max={shown(30)} step={preferences.unit === 'in' ? 0.02 : 1} unit={preferences.unit} onChange={(value) => setDimension('paddingMm', value)} /><label className="check-control"><input type="checkbox" checked={template.border} onChange={(event) => updateTemplate({ border: event.target.checked })} /> Show border</label></div>
              <label className="stack-control">Text alignment<select aria-label="Text alignment" value={template.alignment} onChange={(event) => updateTemplate({ alignment: event.target.value as LabelTemplate['alignment'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            </section>

            <section className="control-section"><h3>Code <small>scan to identify</small></h3>
              <div className="segmented" role="group" aria-label="Code type"><button className={template.code.type === 'qr' ? 'selected' : ''} onClick={() => updateCode({ type: 'qr' })}>QR code</button><button className={template.code.type === 'code128' ? 'selected' : ''} onClick={() => updateCode({ type: 'code128' })}>Code 128</button></div>
              <label className="stack-control">Identifier field<select aria-label="Identifier field" value={idField} onChange={(event) => { const next = event.target.value; setIdField(next); updateCode({ field: next }); }}><option value="">Choose a field</option>{dataset.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
              <label className="stack-control">QR content<select aria-label="QR content mode" value={template.code.payload ? 'template' : 'field'} onChange={(event) => updateCode({ payload: event.target.value === 'field' ? '' : `{${idField || 'Asset ID'}}` })}><option value="field">Identifier value</option><option value="template">Text template</option></select></label>
              {template.code.payload && <label className="stack-control">Payload template<input aria-label="Payload template" maxLength={2000} value={template.code.payload} onChange={(event) => updateCode({ payload: event.target.value })} placeholder="https://inventory.example/{Asset ID}" /><small>Use {`{${idField || 'Asset ID'}}`} to insert a column value.</small></label>}
              {template.code.type === 'qr' ? <NumberControl label="Code size" value={shown(template.code.sizeMm)} min={shown(8)} max={shown(60)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setDimension('sizeMm', value)} /> : <><NumberControl label="Barcode height" value={shown(template.code.barcodeHeightMm)} min={shown(5)} max={shown(40)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setDimension('barcodeHeightMm', value)} /><NumberControl label="Barcode scale" value={template.code.barcodeScale ?? 1} min={0.8} max={3} step={0.1} unit="×" onChange={(value) => updateCode({ barcodeScale: value })} /><div className="two-inputs compact"><label className="check-control"><input type="checkbox" checked={template.code.barcodeText} onChange={(event) => updateCode({ barcodeText: event.target.checked })} /> Show readable text</label><label className="stack-control">Text position<select aria-label="Barcode text position" value={template.code.barcodeTextPosition} onChange={(event) => updateCode({ barcodeTextPosition: event.target.value as 'top' | 'bottom' })}><option value="bottom">Below</option><option value="top">Above</option></select></label></div></>}
            </section>

            <section className="control-section"><div className="section-title-row"><div><h3>Printed details <small>up to 6 fields</small></h3></div><button className="mini-button" onClick={addField} disabled={template.fields.length >= 6 || dataset.columns.every((column) => column === idField || template.fields.some((field) => field.source === column))}>+ Add field</button></div>
              {template.fields.map((field, index) => <div className="field-editor" key={`${field.source}-${index}`}><div className="field-top"><select aria-label={`Printed field ${index + 1}`} value={field.source} onChange={(event) => updateField(index, { source: event.target.value, label: event.target.value })}>{dataset.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><button className="icon-button small" aria-label={`Move field ${index + 1} up`} disabled={index === 0} onClick={() => moveField(index, -1)}>↑</button><button className="icon-button small" aria-label={`Move field ${index + 1} down`} disabled={index === template.fields.length - 1} onClick={() => moveField(index, 1)}>↓</button><button className="icon-button small danger-icon" aria-label={`Remove field ${index + 1}`} onClick={() => setTemplate((current) => ({ ...current, fields: current.fields.filter((_, i) => i !== index) }))}>×</button></div>
                <div className="field-options"><label className="check-control"><input aria-label={`Show field ${index + 1}`} type="checkbox" checked={!hiddenFields.has(field.source)} onChange={(event) => setHiddenFields((current) => { const next = new Set(current); if (event.target.checked) next.delete(field.source); else next.add(field.source); return next; })} /> Show</label><label className="prefix-control"><span><input aria-label={`Show prefix ${index + 1}`} type="checkbox" checked={Boolean(field.label)} onChange={(event) => updateField(index, { label: event.target.checked ? field.source : '' })} /> Prefix</span><input aria-label={`Field ${index + 1} prefix`} maxLength={200} value={field.label} disabled={!field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder="Optional" /></label><NumberControl label={`Field ${index + 1} font size`} value={field.fontSize} min={5} max={30} step={1} unit="pt" onChange={(value) => updateField(index, { fontSize: value })} /><label className="check-control"><input aria-label={`Field ${index + 1} bold`} type="checkbox" checked={field.bold} onChange={(event) => updateField(index, { bold: event.target.checked })} /> Bold</label></div>
              </div>)}
              {!template.fields.length && <p className="muted-note">Add a field to show asset details beneath the code.</p>}
            </section>

            <section className="control-section"><div className="section-title-row"><div><h3>Paper sheet <small>layout</small></h3></div><span className="page-unit">{preferences.unit}</span></div>
              <label className="stack-control">Paper size<select aria-label="Paper size" value={page.preset} onChange={(event) => { const preset = event.target.value as PageSettings['preset']; updatePage(preset === 'Custom' ? { preset } : { preset, widthMm: PAGE_PRESETS[preset][0], heightMm: PAGE_PRESETS[preset][1] }); }}><option>A4</option><option>Letter</option><option>A5</option><option>Custom</option></select></label>
              <div className="two-inputs"><NumberControl label="Paper width" value={shown(page.widthMm)} min={shown(50)} max={shown(500)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setPageDimension('widthMm', value)} /><NumberControl label="Paper height" value={shown(page.heightMm)} min={shown(50)} max={shown(700)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setPageDimension('heightMm', value)} /></div>
              <div className="margin-grid">{PAGE_FIELDS.map(({ key, label }) => <NumberControl key={key} label={`${label} margin`} value={shown(page[key] as number)} min={0} max={shown(100)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => setMargin(key, value)} />)}</div>
              <div className="two-inputs"><NumberControl label="Horizontal gap" value={shown(page.gapXMm)} min={0} max={shown(50)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => updatePage({ gapXMm: preferences.unit === 'in' ? inchesToMm(value) : value })} /><NumberControl label="Vertical gap" value={shown(page.gapYMm)} min={0} max={shown(50)} step={preferences.unit === 'in' ? 0.05 : 1} unit={preferences.unit} onChange={(value) => updatePage({ gapYMm: preferences.unit === 'in' ? inchesToMm(value) : value })} /></div>
            </section>
          </aside>

          <div className="main-column">
          <section className="panel table-panel"><div className="panel-heading table-heading"><div><div className="eyebrow">YOUR DATA</div><h2>Choose assets <span className="count-pill">{selected.size} selected</span></h2></div><div className="table-actions"><label className="search-box"><span>⌕</span><input aria-label="Search assets" value={search} onChange={(event) => { setSearch(event.target.value); setTablePage(0); }} placeholder="Search assets" /></label><button className="secondary-button small-button" onClick={removeSelected} disabled={!selected.size}>Remove selected</button></div></div>
              <div className="id-diagnostic"><span className="diagnostic-icon">i</span><label>Unique identifier<select aria-label="Unique identifier field" value={idField} onChange={(event) => { setIdField(event.target.value); updateCode({ field: event.target.value }); }}><option value="">Choose a field</option>{dataset.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>{noIdCount > 0 ? <span className="diagnostic-warning" role="status">{noIdCount} selected row{noIdCount === 1 ? '' : 's'} missing an identifier</span> : <span className="diagnostic-ok">Selected identifiers are present</span>}{diagnostics.some((message) => /duplicate/i.test(message)) && <span className="diagnostic-warning" role="status">Duplicate identifiers found</span>}</div>
              {diagnostics.length > 0 && <details className="diagnostic-details"><summary>Data checks: {diagnostics.length} note{diagnostics.length === 1 ? '' : 's'}</summary><ul>{diagnostics.slice(0, 5).map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul></details>}
              <div className="table-wrap"><table><thead><tr><th className="select-col"><input aria-label="Select all matching assets" type="checkbox" checked={visibleRecords.length > 0 && visibleRecords.every((record) => selected.has(record.id))} onChange={toggleAll} /></th>{dataset.columns.map((column) => <th key={column}><button className="sort-button" onClick={() => { setTablePage(0); setSort((current) => ({ key: column, dir: current.key === column ? current.dir === 1 ? -1 : 1 : 1 })); }}>{column}<span>{sort.key === column ? sort.dir === 1 ? ' ↑' : ' ↓' : ' ↕'}</span></button></th>)}</tr></thead><tbody>{displayRows.map((record, rowIndex) => <tr key={record.id}><td><input aria-label={`Select ${record.values[idField]?.trim() || dataset.columns.map((column) => record.values[column]?.trim()).find(Boolean) || `row ${tablePage * 50 + rowIndex + 1}`}`} type="checkbox" checked={selected.has(record.id)} onChange={() => toggleRecord(record.id)} /></td>{dataset.columns.map((column) => <td key={column} title={record.values[column]}>{record.values[column] || <span className="empty-cell">—</span>}</td>)}</tr>)}</tbody></table>
                {!displayRows.length && <div className="empty-state">No matching assets. Try a different search.</div>}
              </div><div className="table-footer"><span>Showing {visibleRecords.length ? tablePage * 50 + 1 : 0}–{tablePage * 50 + displayRows.length} of {visibleRecords.length} matching rows · 50 per page</span><span>{dataset.records.length - selected.size} excluded</span></div>{visibleRecords.length > 50 && <div className="table-pagination"><button className="secondary-button small-button" disabled={tablePage === 0} onClick={() => setTablePage((value) => Math.max(0, value - 1))}>Previous rows</button><span>Page {tablePage + 1} of {tablePages}</span><button className="secondary-button small-button" disabled={tablePage >= tablePages - 1} onClick={() => setTablePage((value) => Math.min(tablePages - 1, value + 1))}>Next rows</button></div>}
            </section>

            <section className="panel preview-panel"><div className="panel-heading preview-heading"><div><div className="eyebrow">LIVE PREVIEW</div><h2>Your print sheet</h2></div><div className="preview-meta">{pageLayout ? <><strong>{pageLayout.columns} × {pageLayout.rows}</strong> labels per page · {pages} page{pages === 1 ? '' : 's'}</> : 'Select assets to see the layout'}</div></div>
              {templateError && <div className="alert error-alert" role="alert">{templateError}</div>}{layoutError && <div className="alert error-alert" role="alert">{layoutError}</div>}{sheetPreviewError && <div className="alert warning-alert" role="status">{sheetPreviewError} The PDF export will report this row before creating the file.</div>}
              {!chosenRecords.length ? <div className="empty-preview">Select at least one row to preview your sheet.</div> : <>
                <div className="preview-board-wrap"><div className="preview-paper" aria-label={`Page ${pageNumber + 1} label layout`} style={{ width: page.widthMm * paperScale, height: page.heightMm * paperScale }}>
                  {previewRecords.map((record, index) => { const position = pageLayout?.positions[index]; return position ? <div className={`paper-label ${template.border ? 'with-border' : ''}`} key={record.id} aria-label={`Preview label ${index + 1}`} style={{ left: position.xMm * paperScale, top: position.yMm * paperScale, width: template.widthMm * paperScale, height: template.heightMm * paperScale }}>{sheetImages[record.id] ? <img src={sheetImages[record.id]} alt={`Label for ${record.values[idField] || record.id}`} /> : <span className="loading-placeholder">Rendering</span>}</div> : null; })}
                </div></div>
                <div className="label-preview-row"><div className="single-preview" style={{ width: `${Math.min(400, Math.max(190, template.widthMm * 2.6))}px`, aspectRatio: `${template.widthMm} / ${template.heightMm}` }} aria-label="Rendered label preview">
                  {previewData ? <img src={previewData} alt={`Rendered label for ${selectedPreview?.values[idField] ?? ''}`} /> : previewError ? <span className="preview-error">{previewError}</span> : <span className="loading-placeholder">Drawing label…</span>}
                </div><div className="preview-caption"><span>Single label</span><b>{selectedPreview?.values[idField] || selectedPreview?.id}</b><small>{template.widthMm} × {template.heightMm} mm</small></div></div>
                {pageLayout && pageLayout.labelsPerPage > previewRecords.length && <p className="preview-limit-note">Showing the first {previewRecords.length} labels in the sheet preview for performance. The PDF includes all {pageLayout.labelsPerPage} labels on this page.</p>}
                <div className="pagination"><button className="icon-button" aria-label="Previous preview page" disabled={pageNumber <= 0} onClick={() => setPageNumber((value) => Math.max(0, value - 1))}>←</button><span>Preview page <b>{Math.min(pageNumber + 1, Math.max(1, pages))}</b> of {Math.max(1, pages)}</span><button className="icon-button" aria-label="Next preview page" disabled={pageNumber >= pages - 1} onClick={() => setPageNumber((value) => Math.min(pages - 1, value + 1))}>→</button></div>
              </>}
            </section>
            <section className="export-bar"><div><strong>Ready to print?</strong><span>{chosenRecords.length} labels · print at 100% / actual size</span>{progress !== null && <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}{exportError && <span className="export-error" role="alert">{exportError}</span>}</div><div className="export-actions">{progress !== null && <button className="secondary-button" onClick={() => exportController?.abort()}>Cancel</button>}<button className="primary-button export-button" disabled={!chosenRecords.length || noIdCount > 0 || !idField || Boolean(templateError) || Boolean(layoutError) || busy || progress !== null} onClick={() => void exportPdf()}>{progress !== null ? `Preparing PDF ${progress}%` : 'Download PDF ↓'}</button></div></section>
          </div>
        </div>
      </>}
    </main>
    <footer>AssetTag Studio <span>·</span> Your data stays in this browser session</footer>
  </div>;
}

function NumberControl({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return <label className="number-control"><span>{label}</span><div><input aria-label={label} type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(event) => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) onChange(next); }} /><small>{unit}</small></div></label>;
}

export default App;
