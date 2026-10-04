import { useEffect, useRef, useState } from 'react';
import type { StudioPageProps } from '../../studio/contracts';
import { ColumnSelect, NoDataset, ToolFrame } from '../../studio/ui';
import { downloadFile } from '../../core/download';
import { generatePrintJobPdf } from '../export/pdf';
import { manifestCsv, manifestJson } from './manifest';
import { fieldLensCsv, prepareFieldLensJob, type FieldLensMapping } from '../integrations/fieldlens/export';
import type { PrintJob } from '../../core/printJob';

type Props = StudioPageProps & { mode: 'manifest' | 'fieldlens'; onPrintJobCompleted?: (job: PrintJob) => void };
export function ExportToolsPage(props: Props) {
  const { mode, lastJob, dataset, selectedIds, idField, template, page, busy } = props;
  const [mapping, setMapping] = useState<FieldLensMapping>({ idField, nameField: '', assetTypeField: '', serialField: '', locationField: '' });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  const disabled = busy || working;
  const manifestMode = mode === 'manifest';
  const downloadManifest = () => {
    if (!lastJob) return;
    setError(''); setNotice('');
    try {
      downloadFile(manifestJson(lastJob), 'application/json', 'asset-print-manifest.json');
      downloadFile(manifestCsv(lastJob), 'text/csv;charset=utf-8', 'asset-print-manifest.csv');
      setNotice(`Downloaded manifest for ${lastJob.labels.length} labels from the last successful print job.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export the print manifest.'); }
  };
  const runFieldLens = async () => {
    if (!dataset) return;
    if (selectedIds.size === 0) { setError('Select at least one asset in Asset Labels before creating the FieldLens package.'); return; }
    setWorking(true); setError(''); setNotice('');
    const aborter = new AbortController(); controller.current = aborter;
    try {
      const job = prepareFieldLensJob(dataset, selectedIds, mapping, template, page);
      const pdf = await generatePrintJobPdf(job, { signal: aborter.signal });
      if (aborter.signal.aborted || !mounted.current) return;
      const csv = fieldLensCsv(job, mapping);
      await Promise.resolve();
      if (aborter.signal.aborted || !mounted.current) return;
      downloadFile(pdf.slice().buffer as ArrayBuffer, 'application/pdf', 'fieldlens-labels.pdf');
      downloadFile(csv, 'text/csv;charset=utf-8', 'fieldlens-assets.csv');
      props.onPrintJobCompleted?.(job);
      setNotice(`Created a PDF and CSV for ${job.labels.length} assets from one frozen print snapshot. FieldLens exchange uses the asset_id column and fieldlens://asset/ID QR payload; this build does not claim a verified CSV importer.`);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof Error && cause.name === 'AbortError') setNotice('FieldLens export canceled.');
      else setError(cause instanceof Error ? cause.message : 'Could not create the FieldLens export.');
    } finally { if (controller.current === aborter) controller.current = null; if (mounted.current) setWorking(false); }
  };
  const cancel = () => controller.current?.abort();
  if (!manifestMode && !dataset) return <ToolFrame title="FieldLens export" description="Create matching asset labels and a CSV data package."><NoDataset onImport={() => props.onNavigate('asset-labels')}/></ToolFrame>;
  const choose = (key: keyof FieldLensMapping, label: string, optional = false) => <ColumnSelect label={label} dataset={dataset!} value={mapping[key] ?? ''} optional={optional} disabled={disabled} onChange={value => setMapping(old => ({ ...old, [key]: value }))}/>;
  return <ToolFrame title={manifestMode ? 'Print manifest' : 'FieldLens export'} description={manifestMode ? 'Download the placements from the last successful print job for audit and recreation.' : 'Create a PDF and data CSV whose asset IDs exactly match the QR payloads.'}>
    {manifestMode ? <section className="tool-card"><h2>Last successful print job</h2>{lastJob ? <><p>{lastJob.templateName} · {lastJob.labels.length} physical labels · {new Date(lastJob.generatedAt).toLocaleString()}</p><button className="primary-button" disabled={disabled} onClick={downloadManifest}>Download JSON and CSV</button></> : <p>No successful print job is available yet. Create a PDF from Asset Labels or a specialized label page first.</p>}</section> : <section className="tool-card"><h2>Map FieldLens asset data</h2><p>Choose columns for the five CSV fields. Serial and location may be left unmapped. IDs are checked against the current FieldLens mobile URI rules.</p><div className="tool-row">{choose('idField', 'Asset ID')}{choose('nameField', 'Name')}{choose('assetTypeField', 'Asset type')}</div><div className="tool-row">{choose('serialField', 'Serial', true)}{choose('locationField', 'Location', true)}</div><div className="tool-row"><button className="primary-button" disabled={disabled || selectedIds.size === 0} onClick={() => void runFieldLens()}>Create FieldLens PDF and CSV</button>{working && <button className="secondary-button" onClick={cancel}>Cancel</button>}</div></section>}
    {notice && <p role="status" className="tool-note">{notice}</p>}{error && <p role="alert" className="tool-error">{error}</p>}
  </ToolFrame>;
}
