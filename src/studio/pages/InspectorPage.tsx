import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudioPageProps } from '../contracts';
import { ToolFrame } from '../ui';
import type { DecodedCode } from '../../features/code-inspector/decode';
import { decodeImageData, decodeImageFile } from '../../features/code-inspector/client';
import { analyzeContent } from '../../features/code-inspector/analyze';
import { previewBlob, sourcePixels } from '../../features/code-inspector/image';

export function InspectorPage(props: StudioPageProps) {
  const [text, setText] = useState(''); const [result, setResult] = useState<DecodedCode | { text: string; format: 'PASTED' } | null>(null);
  const [error, setError] = useState(''); const [inspecting, setInspecting] = useState(false); const [camera, setCamera] = useState(false); const [requesting, setRequesting] = useState(false);
  const decodeController = useRef<AbortController | null>(null); const stream = useRef<MediaStream | null>(null); const video = useRef<HTMLVideoElement>(null); const cameraVersion = useRef(0);
  function stopCamera() { cameraVersion.current += 1; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; if (video.current) video.current.srcObject = null; setCamera(false); setRequesting(false); }
  useEffect(() => {
    const hidden = () => { if (document.hidden) { stopCamera(); decodeController.current?.abort(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); cameraVersion.current += 1; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; decodeController.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!camera || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    void video.current.play().catch(() => { setError('Camera preview could not start. Stop the camera and retry.'); stopCamera(); });
  }, [camera]);
  const analysis = useMemo(() => {
    if (!result) return null;
    try { return analyzeContent(result.text, props.dataset, props.template); } catch { return null; }
  }, [result, props.dataset, props.template]);
  async function inspect(source: () => Blob | ImageData) {
    decodeController.current?.abort(); const controller = new AbortController(); decodeController.current = controller;
    setInspecting(true); setError(''); setResult(null);
    try { const image = source(); if (controller.signal.aborted) return; const decoded = await (image instanceof Blob ? decodeImageFile(image, controller.signal) : decodeImageData(image, controller.signal)); if (!controller.signal.aborted) { setResult(decoded); setText(decoded.text); } }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Inspection failed. Use another image.'); }
    finally { if (decodeController.current === controller) setInspecting(false); }
  }
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access requires a supported browser on HTTPS or localhost. You can inspect an uploaded image instead.'); return; }
    stopCamera(); const version = ++cameraVersion.current; setRequesting(true); setError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (version !== cameraVersion.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (version === cameraVersion.current) setError('Camera access was denied or no camera is available. Check browser permissions, or upload an image.'); }
    finally { if (version === cameraVersion.current) setRequesting(false); }
  }
  return <ToolFrame title="Code inspector" description="Decode one upright QR or Code 128 from a PNG/JPEG, the current label, or a camera frame. Images and decoded content stay on this device.">
    <div className="tool-grid"><section className="tool-card"><h2>Inspect a code</h2>
      <label className="tool-control">Image (PNG / JPEG, up to 10 MiB and 8 megapixels)<input aria-label="Code image" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" disabled={inspecting} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void inspect(() => file); event.currentTarget.value = ''; }} /></label>
      <div className="tool-row"><button className="secondary-button" disabled={!props.previewImage || inspecting} onClick={() => void inspect(() => previewBlob(props.previewImage))}>Inspect current label</button>{inspecting && <button className="secondary-button" onClick={() => { decodeController.current?.abort(); setInspecting(false); }}>Cancel inspection</button>}</div>
      <label className="tool-control">Or paste content<textarea aria-label="Inspector content" maxLength={2000} rows={4} value={text} onChange={event => setText(event.target.value)} /></label>
      <button className="primary-button" disabled={!text.trim() || inspecting} onClick={() => { try { analyzeContent(text, props.dataset, props.template); setResult({ text, format: 'PASTED' }); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid content.'); } }}>Analyze pasted content</button>
      <p>Pasted content has no known symbol format. Image decoding detects the format. URLs are displayed as text and are never opened.</p>
      <h3>Camera</h3><div className="tool-row"><button className="secondary-button" disabled={requesting || camera} onClick={() => void startCamera()}>Start camera</button>{(camera || requesting) && <button className="secondary-button" onClick={stopCamera}>Stop camera</button>}{camera && <button className="secondary-button" disabled={inspecting} onClick={() => { const element = video.current; if (element) void inspect(() => sourcePixels(element, element.videoWidth, element.videoHeight)); }}>Inspect camera frame</button>}</div>
      {camera && <video className="inspector-camera" ref={video} autoPlay muted playsInline aria-label="Local camera preview" />}
      {requesting && <p role="status">Waiting for camera permission…</p>}{inspecting && <p role="status">Decoding locally…</p>}
      {error && <p className="alert error-alert" role="alert">{error}</p>}
    </section><section className="tool-card"><h2>Decoded content</h2>{result && analysis ? <><pre className="tool-preview">{result.text}</pre><dl><dt>Detected symbol</dt><dd>{result.format.replace('_', ' ')}</dd><dt>Length</dt><dd>{analysis.length} characters</dd><dt>Content type</dt><dd>{analysis.scheme}</dd><dt>Matching rows</dt><dd>{analysis.matches}</dd></dl>{analysis.issues.map((issue, index) => <p className="alert warning-alert" key={index}>{issue}</p>)}</> : <p>Choose an image or paste content to begin. Crop images around one complete code for best results.</p>}</section></div>
  </ToolFrame>;
}
