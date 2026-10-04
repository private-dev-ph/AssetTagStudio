# Expansion security review

Scope: integrated twelve-feature expansion on local feature-expansion; final source reviewed on expansion-workspace. Main/live deployment unchanged. Review date2026-10-05. Root architecture review plus independent Luna High read-only review. No credentials or production data added.

| Severity | Area / finding | Disposition / fix | Fix commit | Remaining risk |
|---|---|---|---|---|
| Medium | Data Health duplicate grouping copied arrays repeatedly, allowing quadratic work at20k rows | Fixed with linear counts and bounded sampled row IDs;20k duplicate regression | e8f3afa | Whole imported dataset remains memory-resident within import caps |
| Medium | Inspector image preprocessing ran before decoder deadline and could continue after Cancel | File read/bitmap/OffscreenCanvas/symbol decoding moved inside one terminable5sworker; decoded dimensions rechecked, bitmap closed on readback failures | 6c909a6 | Native browser codec behavior and worker support depend on browser; camera capture is a bounded local UI-thread frame copy |
| Medium | Synchronous IndexedDB callback write failure lost its original quota error | Capture nested get/put exceptions, abort the transaction and map the original error; regression asserts no partial save and a successful retry | fc7246c | Browser storage can still become unavailable; failures remain visible and recoverable |
| Low | Cable text-only preset incorrectly passed barcode-only numeric validation | Validate barcode dimensions only for Code128; zero unused barcode dimensions regression | 68285e9 | Physical legibility still needs real printing/scanning |
| Medium | Settings list used unbounded getAll before checking100-entry cap; overfilled printer store lacked recovery | Bound materialization to101entries and reject overflow; any initial profile-load failure exposes confirmed printers-only reset; browser negative covers retained templates | 743d55b / 68285e9 | Local compromised browser/storage can still corrupt individual entries; reset intentionally deletes saved profiles after confirmation |
| Medium | Initial print review found overlapping mirrored code/text regions and stale profile hydration | Independent half-width mirrored panels and one-shot hydration; manual changes persist until explicit update | 74de40d | Paper feed/scaling/driver behavior unverified |
| Low | FieldLens export could finish after navigation/cancellation | Abort on unmount, guards before both downloads, frozen job published only on success | 74de40d | Browser handling of multiple downloads requires normal user/browser permission |
| Low | Empty location hierarchy segments accepted | Reject double-slash/trailing empty segments; negative regression | 41fbc16 | Text-mode legacy payloads remain intentionally unrestricted plain text |
| Informational | Decoder dependency is in maintenance mode; development ESLint clean install emits unsupported-version warning | License texts bundled; audit0; retained existing lint major to avoid unrelated migration | f5904e0 (decoder) / baseline (lint) | Monitor maintenance/advisories; npm audit cannot prove absence of unknown defects or fully assess externally distributed packages |

## Boundaries inspected

Uploads: existing CSV/Excel worker byte/row/cell/archive limits preserved; PNG/JPEG10MiB/8MP header preflight before native bitmap,2048px decode canvas,5sworker deadline. No SVG images or remote decoder/CDN. Unsafe deserialization prevented through strict settings whitelists/version/numeric/cross-field bounds and unknown-property rejection. File reads use browser File/Blob APIs, no path access, extraction to disk or shell commands from data.

Data/privacy: own-property reads and null-prototype clones preserve special headers; stable internal row IDs; preview/apply/undo atomic and bounded24MiB/8entries. Imported rows, transformation previews and last print job stay in memory. IndexedDB persists settings only,100entries/store/128KiB documents, transactional writes. User-authored literal payloads/text are settings and may appear in explicitly exported templates. Storage failures surface; per-store recovery requires explicit confirmation.

Code/camera: content displayed as escaped React text, never href/HTML; mode-specific URI validation and component encoding. Camera requires explicit Start, secure origin, browser permission and audio=false. Late grants stop tracks; navigation/unmount/background/cancel releases streams/workers. Custom regex runs in terminable100msworker with bounded preview/pattern/input rules and rejects known expensive constructs; no evaluation on UI thread.

Exports: shared frozen PrintJob supplies PDF/manifest placements. Abort/failure does not replace successful snapshot. CSV cells quote/escape and neutralize formula prefixes; JSON keeps exact strings. FieldLens IDs reject formula-leading characters and receiver-incompatible escaping, so PDF codes and CSV IDs agree. No actual receiver CSV importer was verified. Print clipping and QR density are rejected rather than silently squeezed.

Hosting boundary: no publishing. Existing same-origin CSP/security headers preserved; only camera Permissions-Policy changed to self. No account/auth/API/server endpoints introduced. Inspector/payload tools make no outbound content requests. Existing licensed dependencies reused; pinned local ZXing is the only new runtime dependency.

## Verification checkpoint

npm audit --audit-level=moderate --json:0 vulnerabilities,292 dependencies. Clean npmci --ignore-scripts:242 packages installed,0 vulnerabilities (platform-specific installed count differs from lock graph). Independent integrated168unit/24files/types/lint/build passed before final security fixes. Focused inspector12tests and renderer10tests passed after remediation. Original16browser tests all passed; first new full pass29/30 with one invalid preset-mapping fixture corrected. Final full suites, upload recovery and storage quota/overflow regressions pending; update this section before completion. Secret/artifact scan and final read-only remediation confirmation pending.

## Accepted validation limits

No physical printer/scanner/camera trial; no Firefox/Safari run; no FieldLens receiver CSV ingestion test. Main JS bundle exceeds Vite500kB warning threshold; warning is retained. Decode supports one upright QR/Code128 in PNG/JPEG; other formats/symbologies unsupported. Browser workers/OffscreenCanvas/IndexedDB availability and storage restrictions can produce explicit failures. No critical/high unresolved finding identified in this review; final verification remains required.
