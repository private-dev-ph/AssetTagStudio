# Implementation progress

All requested MVP features are integrated into web-deployment. main remains 27d0582aae742990d2c25c0ef752896ac420becd. Implementation checkpoint: 95cac68; documentation checkpoint: use git rev-parse HEAD. Live hosting is the active remaining milestone.

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit / tests | Unresolved issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Foundation | application-foundation | Complete | Config/types/CI | d494d36; types/lint/build | No existing data migration | 378cdfd |
| Static hosting | static-deployment | Complete | Headers/CI/deployment docs | 1f9b927; headers tested | Live deployment below | 5bae5ed |
| Spreadsheet import | spreadsheet-import | Complete | Import/normalize/worker | 275845a; initial18 tests | Hardening below | 8c1722a |
| Label/layout/PDF | label-print-engine | Complete | Renderer/layout/export | b2123cf; initial21 tests | Physical print/scanner untested | 3bf791f |
| PDF memory | reduce-pdf-memory | Complete | PDF/export tests | 0f8c35e; focused5 tests | Compressed final output retained | 7a06fe4 |
| Workspace/editor/polish | label-workspace | Complete | App/styles/preferences/examples/E2E | 410da15; focused1 built-browser polish check; full suite below | Mobile/checkbox visually reviewed | b203510 / ebd4333 |
| Workbook/worker bounds | bound-workbook-imports | Complete | ZIP/CFB/parser/client/tests | 931f5b0;35 independent tests and source review | Documented residual parser resource risk | 0ff9609 |
| Integrated verification | verification-hardening | Complete | Tests/renderer/static test server | b7f584e; final64/64 unit and15/15 production browser; types/lint/build/audit0 | Edge locally; Chromium in CI | 71f5616 |
| Portfolio/docs/licenses | portfolio-documentation | Complete | README/5ADRs/media/scripts/notices/showcase | 49edd99; lint/syntax/JSON/visual/Poppler review | Live URL pending; no project license chosen | 95cac68 |
| Final security review | web-deployment | Complete | security-review.md/integrated system | da1ef10; independent source+portfolio review, audit0, secret scans0 | Accepted local resource limits and dev linter maintenance | Integrated |
| Live custom hostname | web-deployment | In progress | Cloudflare/README/showcase/deployment docs | Local release fully verified | Push branch, provider build/CI, add domain, verify live | Pending |

Final clean dependency install completed. Final applicable commands: npm run typecheck, npm run lint, npm test (64 tests,8 files), npm run test:e2e with PLAYWRIGHT_CHANNEL=msedge (15 tests,55.8s; production build included), npm audit --audit-level=moderate (0 vulnerabilities). All nine feature tips are ancestors of integration. No source merge conflicts or outstanding implementation branch. Handoff contains setup failures, their resolutions and exact next action.

Live-smoke preview-copy regression: Ready to merge. The note now compares rendered preview labels with actual records on the page, not empty grid capacity. Sample8-label and capped80-label regressions passed2/2 on production build; typecheck/lint passed.

Deployed-suite support: Ready to merge on verification-hardening. PLAYWRIGHT_BASE_URL skips the local server and binds privacy checks to the configured origin. Typecheck/lint/build and2 focused production security tests passed.
