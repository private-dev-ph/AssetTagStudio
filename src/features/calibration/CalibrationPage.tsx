import { useEffect, useRef, useState } from 'react';
import type { StudioPageProps } from '../../studio/contracts';
import { ToolFrame } from '../../studio/ui';
import { downloadFile } from '../../core/download';
import { generateCalibrationPdf } from './calibrationPdf';
import { clearPrinterProfiles, exportPrinterProfile, importPrinterProfile, listPrinterProfiles, putPrinterProfile, readActivePrinterId, readPrinterProfileFile, removePrinterProfile, setActivePrinterId, type PrinterProfile } from './profiles';

export function CalibrationPage({ page, onPageChange, busy }: StudioPageProps) {
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [activeId, setActiveId] = useState(() => readActivePrinterId());
  const [name, setName] = useState('Office printer');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const pageRef = useRef(page); pageRef.current = page;
  const pageChangeRef = useRef(onPageChange); pageChangeRef.current = onPageChange;
  const disabled = busy || working || loadingProfiles;
  useEffect(() => {
    let current = true;
    void listPrinterProfiles().then(loaded => {
      if (!current) return;
      setProfiles(loaded);
      const savedId = readActivePrinterId();
      const active = loaded.find(item => item.id === savedId);
      setActiveId(active?.id ?? '');
      if (active) pageChangeRef.current({ ...pageRef.current, offsetXMm: active.offsetXMm, offsetYMm: active.offsetYMm });
      else setActivePrinterId('');
    }).catch(cause => { if (current) { setError(cause instanceof Error ? cause.message : 'Could not load printer profiles.'); setProfileLoadFailed(true); } }).finally(() => { if (current) setLoadingProfiles(false); });
    return () => { current = false; };
  }, []);
  const selectProfile = (id: string) => {
    setActiveId(id); setActivePrinterId(id);
    const profile = profiles.find(item => item.id === id);
    onPageChange({ ...page, offsetXMm: profile?.offsetXMm ?? 0, offsetYMm: profile?.offsetYMm ?? 0 });
  };
  const saveProfile = async (profile: PrinterProfile) => {
    setWorking(true); setError('');
    try {
      await putPrinterProfile(profile);
      setProfiles(await listPrinterProfiles());
      setActiveId(profile.id); setActivePrinterId(profile.id);
      onPageChange({ ...page, offsetXMm: profile.offsetXMm, offsetYMm: profile.offsetYMm });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save printer profile.'); }
    finally { setWorking(false); }
  };
  const saveCurrentProfile = () => {
    const existing = profiles.find(item => item.id === activeId);
    void saveProfile({ id: existing?.id ?? crypto.randomUUID(), name: existing?.name ?? name, offsetXMm: page.offsetXMm ?? 0, offsetYMm: page.offsetYMm ?? 0 });
  };
  const renameProfile = async (profile: PrinterProfile) => {
    const nextName = window.prompt('Printer profile name', profile.name);
    if (nextName === null) return;
    await saveProfile({ ...profile, name: nextName });
  };
  const reset = async () => {
    onPageChange({ ...page, offsetXMm: 0, offsetYMm: 0 });
    const active = profiles.find(item => item.id === activeId);
    if (active) await saveProfile({ ...active, offsetXMm: 0, offsetYMm: 0 });
  };
  const printSheet = async () => {
    setWorking(true); setError('');
    try { const bytes = await generateCalibrationPdf(page); downloadFile(bytes.slice().buffer as ArrayBuffer, 'application/pdf', 'printer-calibration.pdf'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not generate the calibration sheet.'); }
    finally { setWorking(false); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setWorking(true); setError('');
    try {
      const profile = await importPrinterProfile(await readPrinterProfileFile(file));
      setProfiles(current => [...current.filter(item => item.id !== profile.id), profile]);
      setActiveId(profile.id); setActivePrinterId(profile.id);
      onPageChange({ ...page, offsetXMm: profile.offsetXMm, offsetYMm: profile.offsetYMm });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import printer profile.'); }
    finally { setWorking(false); }
  };
  const remove = async () => {
    if (!activeId) return;
    setWorking(true); setError('');
    try { await removePrinterProfile(activeId); setProfiles(current => current.filter(item => item.id !== activeId)); setActivePrinterId(''); setActiveId(''); onPageChange({ ...page, offsetXMm: 0, offsetYMm: 0 }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove printer profile.'); }
    finally { setWorking(false); }
  };
  const recoverProfiles = async () => {
    if (!window.confirm('Clear all saved printer profiles and reset the printer library?')) return;
    setWorking(true); setError('');
    try { await clearPrinterProfiles(); setProfiles([]); setActiveId(''); setActivePrinterId(''); setProfileLoadFailed(false); onPageChange({ ...page, offsetXMm: 0, offsetYMm: 0 }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not clear the printer profile library.'); }
    finally { setWorking(false); }
  };
  const active = profiles.find(item => item.id === activeId);
  return <ToolFrame title="Printer calibration" description="Measure alignment once, then save offsets for each printer. Imported asset rows are never stored in profiles.">
    <div className="tool-grid">
      <section className="tool-card"><h2>Measure printer alignment</h2><p>Print at 100% / Actual Size. Measure the displacement, then enter the correction in millimeters.</p>
        <div className="tool-row"><label className="tool-control">Horizontal correction (mm)<input type="number" step="0.1" value={page.offsetXMm ?? 0} disabled={disabled} onChange={e => onPageChange({ ...page, offsetXMm: Number(e.target.value) })}/></label><label className="tool-control">Vertical correction (mm)<input type="number" step="0.1" value={page.offsetYMm ?? 0} disabled={disabled} onChange={e => onPageChange({ ...page, offsetYMm: Number(e.target.value) })}/></label></div>
        <div className="tool-row"><button className="secondary-button" disabled={disabled} onClick={() => void printSheet()}>Download calibration PDF</button><button className="secondary-button" disabled={disabled} onClick={() => void reset()}>Reset offsets</button></div>
      </section>
      <section className="tool-card"><h2>Printer profiles</h2><div className="tool-row"><label className="tool-control">Active profile<select value={activeId} disabled={disabled} onChange={e => selectProfile(e.target.value)}><option value="">No profile</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{active && <button className="secondary-button" disabled={disabled} onClick={() => void renameProfile(active)}>Rename</button>}</div>
        {active && <p>{active.offsetXMm} mm X · {active.offsetYMm} mm Y</p>}<div className="tool-row"><label className="tool-control">New profile name<input value={name} maxLength={100} disabled={disabled} onChange={e => setName(e.target.value)}/></label><button className="secondary-button" disabled={disabled || (!active && !name.trim())} onClick={saveCurrentProfile}>{active ? 'Update active profile' : 'Save new profile'}</button></div>
        <div className="tool-row"><button className="secondary-button" disabled={disabled || !active} onClick={() => active && downloadFile(exportPrinterProfile(active), 'application/json', `${active.name.replace(/[^a-z0-9_-]+/gi, '-')}.printer.json`)}>Export profile</button><label className="secondary-button">Import profile<input type="file" accept="application/json,.json" disabled={disabled} hidden onChange={e => { const input = e.currentTarget; const file = input.files?.[0]; input.value = ''; void importFile(file); }}/></label><button className="secondary-button" disabled={disabled || !active} onClick={() => void remove()}>Delete profile</button></div>
      </section>
    </div>{error && <p role="alert" className="tool-error">{error}</p>}{(profileLoadFailed || /corrupt/i.test(error)) && <button className="secondary-button" disabled={disabled} onClick={() => void recoverProfiles()}>Clear printer library and recover</button>}
  </ToolFrame>;
}
