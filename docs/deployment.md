# Static deployment

The app builds to `dist` and has no backend, database, account or runtime secret. Node 24 LTS and the checked-in lockfile are the build contract.

## Cloudflare Pages (recommended)

1. Connect this GitHub repository in Cloudflare Pages.
2. Choose `web-deployment` as the production branch for this implementation. Do not merge into main as part of setup.
3. Select React/Vite, build command `npm run build`, output directory `dist`. Set NODE_VERSION to 24 if the environment does not provide it.
4. Deploy and verify the resulting HTTPS URL; configure a custom domain only if desired.

Cloudflare's Git integration automatically builds branch changes after the project is connected. No deployment token goes into this repository. CI runs independently on pull requests and pushes to main/web-deployment. This repository currently provides deployment configuration; a live URL must be recorded only after a provider deploy is actually verified.

`public/_headers` is copied to the build and applies to Cloudflare static responses. It disallows remote scripts, framing, objects and forms, and restricts workers to the same origin. Inline styles are needed for physical preview dimensions; scripts remain external. No Functions are used. Other providers must configure equivalent headers themselves.

## Verify a deployment

- Load root URL and refresh; inspect console for errors.
- Confirm `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy and Permissions-Policy in response headers.
- Import CSV and a multiple-sheet Excel workbook, change sheets, create QR and Code128 PDFs.
- Confirm Network shows only static app assets; no inventory values leave the device.
- Open downloaded PDF and print at **actual size / 100%**, disable fit-to-page.
- Run `npm ci && npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run build` in a clean checkout (install Playwright Chromium first).
- Ensure dist contains its worker bundle and _headers. Do not upload node_modules, source inventory files or credentials.

## Alternatives

Vercel/Netlify can host dist with equivalent build settings and provider-specific response headers. GitHub Pages serves static files but does not apply Cloudflare _headers and requires setting Vite base for a repository subpath. This project targets root hosting; do not assume subpath deployment works without configuring base and testing worker/sample URLs.

Sources: [Cloudflare build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use).

Local browser fallback: if the Chromium CDN is unavailable and Microsoft Edge is installed, use PLAYWRIGHT_CHANNEL=msedge for npm run test:e2e. CI uses bundled Chromium by default.

To verify a deployed build with the same synthetic-data suite, set `PLAYWRIGHT_BASE_URL` to its HTTPS root URL and run `npm run test:e2e`. This skips the local build/server and keeps the privacy assertion tied to the configured origin. Clear this variable to return to local production testing. The suite performs no server writes; imported fixtures and generated PDFs stay in the test browser.
