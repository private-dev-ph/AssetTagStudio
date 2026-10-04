# Implementation progress

All requested MVP features are integrated into web-deployment. main remains 27d0582aae742990d2c25c0ef752896ac420becd. Final tested application/deployment checkpoint: 372d90f; exact documentation tip: git rev-parse HEAD. All required milestones are complete. Documentation-only commits trigger the same automatic verification; the final report records the exact final branch SHA and workflow result.

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

Owner now explicitly authorizes merging web-deployment into main and serving main; the initial no-main-merge rule applied to the first implementation and is superseded for this release. Owner initially requested preparation for future public publication. GitHub reported private then public during preparation without any session visibility action; clarification is pending. Owner selected Apache-2.0, to be installed on its own feature branch.

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Portfolio README and showcase contract | portfolio-showcase-contract | Ready to merge | README, portfolio-showcase.json, scripts/verify-portfolio-showcase.mjs, docs/portfolio-integration.md, deployment/tracking docs | Based on740b46d; upstream schema constraints/actual loader atc2661ae and tracked media verified; independent review clean; types/lint/100unit pass | Visibility decision pending; metadata works for public release | Pending |
| Serve main from Cloudflare Pages | web-deployment → main | Not started | Git branches/provider production setting | main before cutover27d0582 | Depends on reviewed contract branch and verified release | Pending |
| Apply Apache-2.0 | apache-license | Not started | LICENSE, NOTICE, package metadata, README/integration docs | Explicit owner selection2026-10-04 | Retain third-party notices | Pending |
