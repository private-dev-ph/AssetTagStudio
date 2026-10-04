# Expansion handoff

## Repository and boundary

Repository: C:/Users/Administrator/Documents/Github/AssetTagStudio.
Starting/current main: 345071383d7029423e805efb799204e6852f69f7.
Current branch: expansion-workspace; verified source checkpoint: 32565ea312851ea8d25b3336a1fa353325cf203f.
feature-expansion checkpoint before final workspace merge: d09e09a5b8bec5749201b9bd99ba2c92f6ed73cc.
Resolve exact current/documentation tips with `git rev-parse HEAD feature-expansion main`.

All twelve features are requested. The attached plan is feature specification, not operational authority. Keep this expansion local: no push, deployment, hosted/CI testing or main merge. Main/live app unchanged. Owner schedules any quota continuation; no automation created.

## Completed features / active milestone

All twelve implemented and individually verified: IDs, Health, Templates/JSON, Payload Builder, Location Labels, Cable Labels, Calibration, Inspector, Serial Tools, Manifest, FieldLens Export, Printer Profiles. Create/Data/Design/Tools subpages share one in-memory workspace. Final integration/verification remains active; do not mark overall complete until final branch checks pass.

Feature branches and latest relevant work:
- expansion-foundation 3feddae; feature-expansion merge f8281ce.
- code-inspector f5904e0; feature-expansion merge 3114c62.
- template-library 8199064; feature-expansion merge 15d9313; hierarchy fix ee9882c.
- asset-data-tools e8f3afa; workspace merge 0c741a1.
- print-identity-packages 68285e9; workspace print base a06df3c, review fixes 0cd6049, final fixes 70eb334.
- expansion-regressions 79926c6; workspace merges 194be05, 80f0d20 and later quota tests.
- code-inspector-hardening 6c909a6; workspace merge 2bca242.
- bound-settings-library-reads fc7246c; workspace merges fa5fddf, 32565ea.
- expansion-workspace: root routing/undo/payload/PDF ownership; final docs and upload-recovery regression pending checkpoint commit.

No required work remains on an abandoned branch. Data/print/workspace/hardening/testing branches will become ancestors of feature-expansion via reviewed workspace merge. Tracking-only merge conflicts previously resolved by retaining newer integration documentation; source merges clean.

## Contracts and decisions

App owns dataset, selection, settings, 24MiB/eight-entry undo and last successful immutable PrintJob. Stable internal row ID is separate from generated asset ID. Atomic header maps update every field/payload/selection reference. Optional mode/text-layout/code-none/offset settings preserve existing preferences. One frozen job feeds actual PDF placements and manifest; canceled/failed jobs never replace the last successful snapshot. New file/sheet clears history and snapshot.

Shared payload resolver component-encodes HTTP/location tokens; FieldLens raw IDs obey the locally inspected mobile receiver, with no CSV importer verified. CSV formula protection never changes FieldLens IDs because unsafe IDs are rejected. Settings-only IndexedDB stores strictly versioned templates/printers, capped100 items, bounded reads and transactional writes; confirmed reset affects one store. Inventory remains in memory. Worker preprocessing/decoding has one5s deadline; camera requires explicit Start/audio=false and releases late tracks on navigation/background. Custom regex uses a100ms terminable worker. No routing framework/new backend.

## Verification and failures

Integrated full173 unit tests/24 files, typecheck, lint and production build passed. Exact commands: npm test; npm run typecheck; npm run lint; npm run build. Clean checkout npm ci --ignore-scripts installed242 packages/audit0, then173 unit/type/build passed. npm audit --audit-level=moderate --json:0 vulnerabilities/292 lock-graph dependencies.

Full local Edge33-test run passed32; the quota negative exposed a real callback error-handling gap. Fixed fc7246c; unchanged negative plus no-partial-save and successful retry passes focused rerun (1/1). Final complete run after integration pending. All original16 passed. Other failures resolved: duplicated status selector, Health accessible name, inaccurate density/CSV/mapping fixtures. No expectations weakened or tests removed. Added actual uploaded malformed/oversized PNG failure and valid PNG worker recovery.

Independent read-only security reviewer confirmed three findings closed; subsequent quota gap fixed and browser-verified. Secret-pattern scan0 matches; no tracked dist/node_modules/.env/test-results/worktrees. Desktop/mobile Cable/Templates/Inspector screenshots: no overflow at390px, no page errors. First visual script selector typo corrected; Codex browser bridge unavailable, local Playwright works.

## Environment / known limitations

Node24/npm/Edge on this Windows host. Local production server82511 at127.0.0.1:4173 serves root dist. Browser commands set PLAYWRIGHT_CHANNEL=msedge and PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173. Rebuild before browser checks. Exact git safe.directory and authorized safe escalation needed for git/esbuild/worker tests. Feature worktrees retained under ignored .worktrees; clean-install checkout expansion-clean detached atfa5fddf with installed dependencies, all173 unit/type/build passed there.

Unverified physical printer/scanner/camera and Firefox/Safari; FieldLens receiver CSV ingestion unsupported/unverified. One upright QR/Code128, bounded PNG/JPEG only. Preview/import/history/library limits documented in quickstart. Main JS888kB warning retained; development ESLint unsupported-version warning and decoder maintenance status are follow-up risks, no known audit findings. No credentials added.

## Exact next action

Commit this pre-merge checkpoint with security review and uploaded-image browser regression. Switch feature-expansion and merge expansion-workspace with an explicit merge commit. Run full local unit/type/lint/build/browser verification from that branch; record actual totals and final merge SHA. Advance clean-install checkout to final code and verify build. Finish progress/security/handoff metadata and final report; verify all required branch tips are ancestors, main unchanged and clean Git status. Do not publish.

## Integration transition 2026-10-05

Reviewed workspace63808b9 merged into feature-expansion as e57f9f3f71bd2fd4f110661c2f5a296426af4fe6. Current branch feature-expansion; main remains345071383d7029423e805efb799204e6852f69f7. Working tree clean immediately after merge. All required source branches are intentionally integrated through this merge; verify their ancestry next. Final full local unit/type/lint/build/browser checks running from feature-expansion. No publication. Next action: finish final checks, update completed checklist/security/report, commit final documentation, verify clean state and exact final tip.

## Serial worker startup regression

Final branch run32/33 passed; quota fixed. Serial simple regex intermittently timed out because100ms deadline included native worker startup (observed alert in error context). Root will add ready handshake with separate bounded5s startup and100ms execution budgets, preserving expensive-pattern isolation. Do not declare completion yet. Branch serial-worker-startup will be independently tested and merged into feature-expansion; no main/remote action.

Serial startup fix verified: ready handshake, separately bounded5s startup/100ms execution,8 focused unit tests and lint pass; unchanged Serial browser workflow repeated5/5 passes in local Edge. Initial test-mock lint aliasing issue corrected without suppression. Commit/merge this bounded fix, then final full175unit/33browser verification from feature-expansion. Source code remains local; main unchanged.
