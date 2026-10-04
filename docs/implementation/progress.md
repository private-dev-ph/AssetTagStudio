# Implementation progress

## QR branding follow-up — 2026-10-04

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| QR-inspired A/tag identity and webpage branding | qr-branding | Testing | public/branding, src/App.tsx, src/styles.css, index.html, portfolio-showcase.json, README, branding guide/render script, refreshed synthetic media | Feature6ca9281; type/lint/build/100unit/16Edge(38.4s)/audit0 and actual portfolio loader/schema/logo pass; independent review clean; light/dark/mobile/card/icon visually reviewed; GIF6frames9.6s;7SVG/4PNG and11served assets verified; post-merge diff/portfolio pass | Merged without conflicts; final CI/live acceptance next; no dependency changes; icon/card caches may delay refresh | e8d56c5 into web-deployment; main fast-forwarded |


All requested MVP features and follow-ups are complete and integrated into main and web-deployment. Original main was 27d0582aae742990d2c25c0ef752896ac420becd; the owner subsequently authorized updating main and serving it. Accepted main release: ac3fa0e58255be4fb54e8b2f34e74dfaa970b277. Exact final documentation tip: `git rev-parse HEAD`; synchronized refs and final pipeline are recorded in the final report. The older milestones below retain historical verification evidence; the latest release evidence supersedes their branch/license/test-count status.

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Foundation | application-foundation | Complete | Config/types/CI | d494d36; types/lint/build | No existing data migration | 378cdfd |
| Static hosting | static-deployment | Complete | Headers/CI/deployment docs | 1f9b927; headers tested | Live deployment below | 5bae5ed |
| Spreadsheet import | spreadsheet-import | Complete | Import/normalize/worker | 275845a; initial 18 tests | Hardening below | 8c1722a |
| Label/layout/PDF | label-print-engine | Complete | Renderer/layout/export | b2123cf; initial21 tests | Physical print/scanner untested | 3bf791f |
| PDF memory | reduce-pdf-memory | Complete | PDF/export tests | 0f8c35e; focused 5 tests | Compressed final output retained | 7a06fe4 |
| Workspace/editor/polish | label-workspace | Complete | App/styles/preferences/examples/E2E | 1db4214; focused polish/count regressions; full 16-browser suite | Mobile/checkbox visually reviewed | b203510 / ebd4333 / beaa0a6 |
| Workbook/worker bounds | bound-workbook-imports | Complete | ZIP/CFB/parser/client/tests | 931f5b0; 35 independent tests and source review | Documented residual parser resource risk | 0ff9609 |
| Integrated verification | verification-hardening | Complete | Tests/renderer/static test server | 808eb6e; 64/64 unit, 16/16 local browser, 16/16 CI Chromium, 16/16 hosted browser; types/lint/build/audit 0 | Edge locally; Chromium in CI | 71f5616 /372d90f |
| Portfolio/docs/licenses | portfolio-documentation | Complete | README/5ADRs/media/scripts/notices/showcase | 49edd99; lint/syntax/JSON/visual/Poppler review | Live URL verified; no project license chosen | 95cac68 |
| Final security review | web-deployment | Complete | security-review.md/integrated system | da1ef10; independent source+portfolio review, audit 0, secret scans 0 | Accepted local resource limits and dev linter maintenance | Integrated |
| Live custom hostname | web-deployment | Complete | Cloudflare/README/showcase/deployment docs | 372d90f; Active SSL/HTTPS/headers/bundle; 16 hosted tests | Scoped Disable RUM rule required and active | Deployed |

Final clean dependency install completed. Final applicable commands: npm run typecheck, npm run lint, npm test (64 tests, 8 files), npm run test:e2e with PLAYWRIGHT_CHANNEL=msedge (16 tests, 53.6s; production build included), npm audit --audit-level=moderate (0 vulnerabilities). All nine feature tips are ancestors of integration. No source merge conflicts or outstanding implementation branch. Handoff contains setup failures, their resolutions and exact next action.

Completed preview-copy regression: merged in beaa0a6. The note now compares rendered preview labels with actual records on the page, not empty grid capacity. Sample 8-label and capped 80-label regressions passed 2/2 on production build; typecheck/lint passed.

Completed deployed-suite support: verification-hardening merged in 372d90f. PLAYWRIGHT_BASE_URL skips the local server and binds privacy checks to the configured origin. Typecheck/lint/build and 2 focused production security tests passed.

Live verification on 372d90f: 15/16 passed including CSV/XLSX/XLS, QR/Code128 PDF downloads, 834-page boundary and error paths. Privacy check caught a Cloudflare Web Analytics script injected only on the custom-domain zone (provider mirror clean). No inventory POST/value URL detected. The initial privacy failure was resolved by the scoped provider rule below.

Hosted milestone complete: 16/16 after hostname-scoped Disable RUM rule 40df1295ed1e4564be60aee5c2d8ed5a, privacy 1/1 focused, app HTML no beacon, portfolio beacon retained. GitHub372d90f CI 64 unit/16 Chromium/build/audit 0 passed. No required implementation or deployment work remains. Final document-only pipeline results are recorded in the final report.

## Post-release sample-data request

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Synthetic manual test pack and deferred roadmap | sample-test-datasets | Complete | scripts/generate-test-datasets.*, tests/sample-datasets.test.ts, docs/test-data/README.md, docs/roadmap.md, README/package scripts | Feature4d722d0; full100/100 unit (36 new checks), types/lint/build pass; post-merge36/36 sample checks; archive checksums verified | No application/runtime changes; 30 generated fixtures ignored and remain local; unique export stress not benchmarked | d310520 |

2026-10-04: Generated 30 files / 27,108,825 input bytes; ZIP 842,718 bytes with all file-size/SHA-256 checks matching the manifest. Independent read-only review found no material correctness/security issue. Existing sandbox esbuild parent scan failed; authorized elevated npm test/build passed. No dependency changes. Production bundle remains index-DpM43OgR.js, so existing hosted/browser behavior is unchanged.

Integrated in d310520 without conflicts; final diff is limited to generator/tests/guides/package scripts/ignore/tracking. The feature tip is an ancestor of web-deployment; main remains27d0582aae742990d2c25c0ef752896ac420becd. Local fixtures/archive are deliverables, deliberately untracked and reproducible; tracking update follows the feature merge. All ten feature branches are integrated.

## Portfolio contract and main-production request

Owner now explicitly authorizes merging web-deployment into main and serving main; the initial no-main-merge rule applied to the first implementation and is superseded for this release. GitHub reported private then public during preparation without any session visibility action; owner explicitly confirmed Keep public. Owner selected Apache-2.0, installed on its own feature branch.

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Portfolio README and showcase contract | portfolio-showcase-contract | Complete | README, portfolio-showcase.json, scripts/verify-portfolio-showcase.mjs, docs/portfolio-integration.md, deployment/tracking docs | Feature0f6421a; upstream schema constraints/actual loader atc2661ae and tracked media verified; independent review clean; types/lint/100unit pass | Public default-branch discovery follows main merge | e4f6fb0 |
| Serve main from Cloudflare Pages | web-deployment → main | Complete | Git branches/provider production setting, deployment/handoff/security docs | Accepted ac3fa0e; main production d6235e92; 100 unit/16 local Edge/16 CI Chromium/16 hosted Edge; types/lint/build/audit0; both-host legal/headers/privacy pass | Portfolio card awaits cache refresh; physical/unique-export/cross-browser limits retained; cold local startup resolved with explicit built server | Fast-forwardf051880, trackingac3fa0e |
| Apply Apache-2.0 | apache-license | Complete | LICENSE, NOTICE, package metadata, build-copy script, README/integration docs | Featuree0d6451; official text/attribution, matching metadata, exact dist copies and third-party notices verified; build/lint/portfolio verifier pass; audit0; independent review clean | No dependency version changes; generated dist legal files ignored | 13b3413 |

2026-10-04 license verification: source/worker/CSS bundle hashes unchanged; the build adds only LICENSE.txt and NOTICE.txt. User confirmed the already-public repository should stay public. No visibility mutation was performed. Main merge uses fast-forward only after integration, preserving all feature history and avoiding force updates. Main before merge27d0582.

Both requested feature branches merged without conflicts. Integrated portfolio verification passes and all12feature branch tips are ancestors of main/web-deployment. Owner-authorized main fast-forward, production branch switch and full browser/host/legal/privacy acceptance are complete. Final documentation checkpoint synchronizes and pushes both branches; no required implementation remains.

Main cutover verified2026-10-04: main/web-deployment/origin refs matchedac3fa0e. Cloudflare production main/ac3fa0e deploymentd6235e92 serves both hostnames. Main CI run37206304887 passed clean install/types/lint/100unit/16Chromium/build/audit0. Local Edge16/16 and hosted Edge16/16 passed, including privacy, headers and834-page export. All public main JSON and six image references are anonymously accessible; actual upstream loader accepts all sections and enables Live. Portfolio displayed an older cached list after reload, so actual card rendering awaits its documented one-hour cache refresh. Initial60second local automatic webServer startup timeout occurred before tests; explicitly serving built output then using PLAYWRIGHT_BASE_URL passed all unchanged assertions. License/notices and the absence of analytics are verified on both production hostnames. No runtime/dependency version changes.
