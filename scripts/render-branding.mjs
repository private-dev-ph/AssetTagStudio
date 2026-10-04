import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/branding');
const source = await readFile(path.join(output, 'assettag-mark-currentcolor.svg'), 'utf8');
const mark = source.match(/<g id="mark" fill="currentColor">([\s\S]*?)<\/g>/)?.[1];
if (!mark || /<(script|image|foreignObject)\b|\b(?:href|on\w+)\s*=/i.test(source)) throw new Error('Expected a self-contained vector mark.');
const svg = (viewBox, title, body, style = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">AssetTag Studio: a tag-shaped A with QR finder motifs. Decorative branding, not an encoded QR code.</desc>${style ? `<style>${style}</style>` : ''}${body}</svg>\n`;
const themed = ':root{--accent:#147d78;--ink:#20313b;--muted:#75838a}@media(prefers-color-scheme:dark){:root{--accent:#70c4b5;--ink:#e5eceb;--muted:#9eadaa}}';
const font = 'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;';
const variants = {
  'assettag-mark-light.svg': svg('0 0 256 256', 'AssetTag Studio — light background', `<g fill="#147d78">${mark}</g>`),
  'assettag-mark-dark.svg': svg('0 0 256 256', 'AssetTag Studio — dark background', `<g fill="#70c4b5">${mark}</g>`),
  'assettag-mark.svg': svg('0 0 256 256', 'AssetTag Studio QR mark', `<g fill="var(--accent)">${mark}</g>`, themed),
  'assettag-logo-horizontal.svg': svg('0 0 880 220', 'AssetTag Studio', `<g transform="translate(8 8) scale(.8)" fill="var(--accent)">${mark}</g><text x="234" y="137" fill="var(--ink)" font-size="72" font-weight="750" letter-spacing="-3">AssetTag<tspan fill="var(--muted)" font-weight="450"> Studio</tspan></text>`, `${themed}text{${font}}`),
  'favicon.svg': svg('0 0 64 64', 'AssetTag Studio icon', `<rect class="tile" width="64" height="64" rx="15"/><g class="glyph" transform="translate(4 4) scale(.21875)">${mark}</g>`, '.tile{fill:#147d78}.glyph{fill:#fff}@media(prefers-color-scheme:dark){.tile{fill:#70c4b5}.glyph{fill:#17211f}}'),
  'social-card.svg': svg('0 0 1200 630', 'AssetTag Studio — spreadsheets in, labels out', `<defs><linearGradient id="wash" x2="1" y2="1"><stop stop-color="#f7f9f8"/><stop offset="1" stop-color="#e7f3f0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#wash)"/><path d="M0 0H1200V8H0Z" fill="#147d78"/><text x="80" y="80" font-size="18" font-weight="700" letter-spacing="3" fill="#147d78">QR + CODE 128</text><text x="1120" y="80" text-anchor="end" font-size="20" fill="#536a70">tagstudio.zachcodes.dev</text><rect x="76" y="149" width="288" height="288" rx="48" fill="#147d78"/><g transform="translate(92 165)" fill="#fff">${mark}</g><text x="434" y="248" font-size="65" font-weight="750" letter-spacing="-3" fill="#20313b">AssetTag<tspan font-weight="450" fill="#536a70"> Studio</tspan></text><text x="438" y="316" font-size="38" font-weight="600" letter-spacing="-1" fill="#147d78">Spreadsheets in. Labels out.</text><text x="440" y="377" font-size="25" fill="#536a70">Create print-ready QR and barcode labels.</text><text x="440" y="417" font-size="25" fill="#536a70">Your inventory stays on your device.</text><path d="M80 505H1120" stroke="#ccddd7"/><text x="80" y="556" font-size="21" fill="#536a70">CSV + Excel</text><text x="600" y="556" text-anchor="middle" font-size="21" fill="#536a70">Actual-size PDF sheets</text><text x="1120" y="556" text-anchor="end" font-size="21" fill="#536a70">No login. No uploads.</text>`, `text{${font}}`),
};
await mkdir(output, { recursive: true });
for (const [name, content] of Object.entries(variants)) await writeFile(path.join(output, name), content);

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
try {
  const page = await browser.newPage({ colorScheme: 'light' });
  // No file:// navigation or external font/network request; render only fixed local SVG sources.
  for (const [input, name, width, height] of [
    ['social-card.svg', 'social-card.png', 1200, 630],
    ['favicon.svg', 'favicon-32.png', 32, 32],
    ['favicon.svg', 'apple-touch-icon.png', 180, 180],
    ['favicon.svg', 'assettag-logo.png', 512, 512],
  ]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style></head><body>${variants[input]}</body></html>`);
    await page.screenshot({ path: path.join(output, name), omitBackground: true });
  }
  console.log('Rendered QR branding SVG variants, 1200×630 social PNG, favicon, touch icon and portfolio logo.');
} finally { await browser.close(); }
