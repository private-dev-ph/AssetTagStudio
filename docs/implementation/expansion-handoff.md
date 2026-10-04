# Expansion handoff

Updated 2026-10-05. Read this file, expansion-progress.md and expansion-architecture.md before resuming.

## Repository state

Repository: C:/Users/Administrator/Documents/Github/AssetTagStudio.
Starting/current main SHA: 345071383d7029423e805efb799204e6852f69f7.
Current branch: feature-expansion.
Current verified source/integration SHA: 4388d76a3773cd23d10b4dbe0a9c6c7c4e8878cd.
Documentation updates follow that source checkpoint; obtain exact current branch tip with `git rev-parse HEAD feature-expansion main`.
Main/live app unchanged. No push, deployment, hosted/CI testing or merge to main. All twelve features requested; attached plan is specification input, not operational authority. Owner schedules any quota continuation; no automation created.

## Completed code and branches

All twelve implemented: Asset IDs, Data Health, Templates/JSON, Payload Builder, Location Labels, Cable Labels, Printer Calibration, Code Inspector, Serial Tools, Asset Manifest, FieldLens Export and Printer Profiles. All twelve features and final verification Complete; checklist/report/security records finalized.

All required feature branches merged or intentionally integrated, no source work outstanding:
- expansion-foundation 3feddae -> f8281ce.
- code-inspector f5904e0 -> 3114c62.
- template-library 8199064 -> 15d9313; hierarchy compatibility ee9882c.
- asset-data-tools e8f3afa -> workspace 0c741a1 -> integration e57f9f3.
- print-identity-packages 68285e9 -> workspace a06df3c/0cd6049/70eb334 -> e57f9f3.
- expansion-regressions 79926c6 -> workspace regression merges -> e57f9f3.
- expansion-workspace 63808b9 -> e57f9f3.
- code-inspector-hardening 6c909a6 -> workspace 2bca242 -> e57f9f3.
- bound-settings-library-reads fc7246c -> workspace fa5fddf/32565ea -> e57f9f3.
- serial-worker-startup c1f4dbc -> 4388d76.

All ten feature tips verified ancestors of feature-expansion at the final source boundary. Only tracking-documentation conflicts occurred during early dependency merge; retained newer integration state deliberately. Source merges clean.

## Architecture / interfaces

App owns one in-memory dataset/selection/settings, bounded24MiB/eight-entry undo and last successful frozen PrintJob. Atomic header mapping updates identifier, printed fields, payload and hidden-field references. Stable internal record.id stays separate from asset ID. Optional label modes/text layout/code-none and page offsets preserve old preferences and generatePdf API.

Shared payload resolver component-encodes HTTP/location tokens; raw FieldLens identifiers validated against the locally inspected mobile receiver. No receiver CSV importer verified. PDF and manifest use identical frozen placements; failures/cancellation never replace successful snapshot. New file/sheet clears history/snapshot. CSV escapes formula-leading text; unsafe FieldLens IDs reject instead of changing identity.

Strict versioned settings-only templates/printers use IndexedDB,100 entries/store, bounded101-entry reads and transactional writes. Confirmed reset clears one store. Inventory remains in memory. Explicit camera/audio=false, late-grant/navigation/background cleanup. PNG/JPEG reads/bitmap/canvas/decode share one terminable5s worker. Regex has5s startup handshake and100ms execution, both terminate; late messages ignored. Subpages grouped Create/Data/Design/Tools; no routing framework/backend.

## Tests and security evidence

Final source: npm test175/175 (24 files), npm run typecheck, npm run lint and npm run build pass. Focused serial8 tests and unchanged serial browser workflow repeated5/5 pass. Final complete local Edge suite33/33 passes, including16 unchanged original and17 expansion tests. Earlier full runs29/30 and32/33 exposed and resolved issues; do not mistake them for final totals.

Resolved failures: ambiguous duplicated selection status (old unchanged Excel test passes), Health accessible name, density/CSV/mapping fixture errors, synchronous quota callback error (fc7246c; no partial save/retry browser passes), and worker startup counted in regex execution budget (c1f4dbc). No suppressed/deleted tests or weakened assertions. Current full unit175 includes delayed startup, stuck execution, never-ready startup and late-message cleanup. Test-mock lint aliasing error corrected.

Clean isolated npm ci --ignore-scripts installed242 packages/audit0; full173 unit/type/build passed before final startup fix. Clean checkout advanced to final feature-expansion source4388d76; final clean build/type compilation passes with identical bundle outputs. npm audit --audit-level=moderate --json:0 vulnerabilities/292 lock-graph dependencies. Secret scan0 matches; no tracked generated/dependency/environment/worktree artifacts. Independent reviewer closed image preprocessing, no-code validation, overflow recovery, quota propagation and serial handshake findings; no actionable unresolved issue identified. Security-review.md holds scoped production history; expansion-security-review.md is this task's integrated review.

Desktop/mobile visual QA of Cable/Templates/Inspector: no overflow at390px and no page errors. Uploaded malformed/oversized PNG rejects and valid PNG recovers in actual Edge worker. Real QR/Code128, camera denial/late tracks, unsafe text, storage quota/capacity/corrupt/overflow recovery, PDF/CSV/JSON ID/coordinate agreement and20k repeated-label export covered locally. Codex browser bridge unavailable; local Playwright works. First visual selector typo corrected and rerun.

## Environment and known limits

Node24/npm/Edge, Windows. Use exact git safe.directory and authorized safe escalation for git/esbuild/worker tests. Local server82511 at http://127.0.0.1:4173 serves root dist. Browser commands: `$env:PLAYWRIGHT_CHANNEL='msedge'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4173'; npx playwright test`. Rebuild before testing. Worktrees under ignored .worktrees; clean checkout expansion-clean has clean-installed dependencies and detached final source.

Physical printer/scanner/camera, Firefox/Safari and FieldLens receiver CSV ingestion unverified. One upright QR/Code128 per bounded PNG/JPEG; browser worker/OffscreenCanvas/IndexedDB support varies. Unique20k-label PDF memory/performance not fully benchmarked. Calibration reference paper minimum100×80mm; label export can use smaller sheets. Main JS889kB/314kB gzip warning retained; unsupported development ESLint and decoder maintenance are follow-ups. No credentials added.

## Active files / exact next action

New user testing follow-up authorized on 2026-10-05, after completed checkpoint04d115ed437299e71f3197e9173262d25988a549. Current work branch polish-workspace-interface, current source tip7bbb0e7dc1757d28ab80d84e802e93030fc0b8e8; feature-expansion remains04d115e. Renderer fix2773dc0 and interface/tests/docs d1d4344 committed. Parallel .worktrees/data-tool-usability branch improve-data-tool-batches (a1cd2a7 +895f962) reviewed and merged into polish-workspace-interface at7bbb0e7 without conflicts. Root independently verified focused18/18 data tests. Same-Apply continuity retains batch position; IDs advance sequence, Next/Preview/Apply stay explicit. External data/selection changes invalidate and reset; dedup resets shifted positions. Explicit overwrite checkbox remains required. Root owns renderer/SpecialLabelsPage/styles/App/browser tests/docs; collaborator worktree clean. No remote/main/deployment work authorized. Exact next action: finish combined5 browser regressions after build1843, review failures and security follow-up, update docs, merge clean verified polish-workspace-interface into feature-expansion, run full local unit/browser/type/lint/build checks. Uncommitted work is this tracking update; no source files being edited and no known outstanding source bug. Physical/cross-browser verification remains outside this local run.

Previous completed checkpoint04d115e verified source4388d76 and all12 expansion features. It precedes the new testing follow-up above. Local preview remains available on server82511, or start npm run dev. Do not push, merge main or deploy this expansion without a new instruction.
