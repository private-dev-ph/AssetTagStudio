# Implementation progress

**Resumed at the user's request — 2026-10-04.** Import and workspace work continue on their saved branches. Starting main27d0582aae742990d2c25c0ef752896ac420becd remains unchanged after another fetch. Primary checkout verification-hardening while renderer/test additions are verified.

| Milestone | Feature branch | Status | Related files | Latest commit / tests | Issues / dependencies | Merge |
|---|---|---|---|---|---|---|
| Architecture/toolchain | application-foundation | Complete | configs,types,implementation docs | d494d36;types/lint/build pass | Patched Vitest4.1.11 | 378cdfd |
| CSV/Excel import | spreadsheet-import | Complete | src/features/import,import-format.md | 275845a;18 tests/types/lint/build pass | Additional hardening tracked separately | 8c1722a |
| Label/layout/PDF engine | label-print-engine | Complete | labels,layout,export,types,docs | b2123cf;21 focused tests,39 integrated tests/types/lint/build pass | Distinct-image PDF memory grows with output | 3bf791f |
| Workspace/editor | label-workspace | Testing (paused) | App,styles,preferences,examples,workspace E2E | 8a9dd09 checkpoint;agent reported45 tests/types/lint pass before newest changes | E2E config-loader access issue; primary checkout validation pending | Not merged; import+engine dependencies merged locally |
| CI/static hosting | static-deployment | Complete | CI,headers,deployment/privacy docs,Playwright config | 1f9b927;types/lint/build,audit0 | Cloudflare setup unsaved;live deployment pending | 5bae5ed |
| Workbook/worker bounds | bound-workbook-imports | In progress (paused) | import client/parser/ZIP preflight/tests,import docs | f29d5bc checkpoint;latest checks pending | Legacy CFB preflight still required;ZIP declared bounds residualCPU risk | Not merged |
| Integrated tests/security | verification-hardening | Testing (paused) | production test server,security E2E,jsqr dev dep | 0f41de6;header E2E1/1 pass | Full UI/negative browser tests,final audit/review pending | Not merged |
| Portfolio artifacts | portfolio-documentation | In progress (paused) | README,architecture,showcase,media | 7a59dd5 draft | Real screenshots/GIF/samplePDF missing | Not merged |
| Live subdomain deployment | web-deployment | Not started (paused) | Cloudflare Pages / tagstudio.zachcodes.dev | No remote push or deploy | Finish checks,push verified integration,select production branch,add hostname | Not deployed |

See handoff.md for exact SHAs, worktree paths, failed checks, contracts and next action.

Resume milestone: verification-hardening merged the latest saved integration as4d8e838, retaining current handoff plus verification scope when resolving its documentation-only conflict. Narrow-glyph rejection implemented and verified:40 unit tests, typecheck, lint and build pass. New browser negative-path tests remain pending UI verification. No deployment/push.


| PDF peak memory | reduce-pdf-memory | Ready to merge | export/pdf.ts, PDF tests/docs | 40 unit tests, types/lint/build pass | Eager public image.embed releases decoded channels; compressed final PDF remains in memory | Pending |
