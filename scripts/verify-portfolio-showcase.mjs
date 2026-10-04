import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reference = process.argv[2] && path.resolve(process.argv[2]);
assert(reference, 'Pass a local checkout of private-dev-ph/portfolio as the first argument.');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const manifest = await readJson(path.join(root, 'portfolio-showcase.json'));
const schema = await readJson(path.join(reference, 'docs/portfolio-showcase.schema.json'));

// The existing dev-tool Ajv is v6. This contract uses keywords it supports.
// Remove only the 2020-12 dialect declaration; local $defs JSON pointers work
// unchanged. Refuse a future contract with unevaluated/dynamic/new keywords
// rather than silently claiming validation under unsupported semantics.
const supported = new Set(['$schema', '$id', '$ref', '$defs', 'title', 'description', 'type', 'additionalProperties', 'required', 'properties', 'items', 'oneOf', 'enum', 'const', 'format', 'default', 'minLength', 'minItems']);
function checkKeywords(node) {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    assert(supported.has(key), `Unsupported schema keyword: ${key}. Use an updated validator before accepting this contract.`);
    if (key === 'properties' || key === '$defs') Object.values(value).forEach(checkKeywords);
    else if (key === 'items') checkKeywords(value);
    else if (key === 'oneOf') value.forEach(checkKeywords);
    else if (key === 'additionalProperties' && typeof value === 'object') checkKeywords(value);
  }
}
checkKeywords(schema);
const compatibleSchema = structuredClone(schema);
delete compatibleSchema.$schema;
const validate = new Ajv({ allErrors: true }).compile(compatibleSchema);
assert(validate(manifest), JSON.stringify(validate.errors, null, 2));
assert(!validate({ ...manifest, surpriseProperty: true }), 'Unknown properties must fail schema validation.');
assert(!validate({ ...manifest, internalDemoAvailable: 'true' }), 'Demo opt-in must be a boolean.');

// Exercise the actual upstream loader/URL resolver, without editing its source
// or calling its network functions. Type-only imports disappear on transpile.
const source = await readFile(path.join(reference, 'lib/github.ts'), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { normalizeShowcase, resolveShowcaseImageUrls, repoToProject };\n', {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loader = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const normalized = loader.normalizeShowcase(manifest);
assert(normalized, 'Upstream portfolio loader rejected the manifest.');
assert.equal(loader.normalizeShowcase({ name: 'Legacy manifest', summary: 'Missing story fields' }), undefined);
const repo = {
  id: 1403818768, name: 'AssetTagStudio', description: manifest.summary,
  html_url: manifest.githubUrl, homepage: manifest.liveDemoUrl, language: 'TypeScript',
  fork: false, archived: false, updated_at: '2026-10-04T00:00:00Z', pushed_at: null,
  stargazers_count: 0, forks_count: 0, topics: [], default_branch: 'main',
};
const resolved = loader.resolveShowcaseImageUrls(normalized, repo);
const project = loader.repoToProject(repo, repo.language, resolved);
assert.equal(project.liveUrl, 'https://tagstudio.zachcodes.dev');
assert.equal(project.showcase.title, 'AssetTag Studio');
assert.equal(project.showcase.sections.length, manifest.sections.length);
assert.equal(loader.repoToProject(repo, repo.language, { ...resolved, internalDemoAvailable: false }).liveUrl, undefined);

const images = [...(manifest.logo ? [manifest.logo] : []), ...manifest.images, ...manifest.sections.flatMap((section) => section.type === 'image' ? [section.image] : section.type === 'carousel' ? section.images : [])];
for (const image of images) {
  assert(image.alt.trim(), 'Every image needs meaningful alternative text.');
  assert(image.src.startsWith('docs/media/') || image.src.startsWith('public/branding/'), `Expected a local tracked showcase image: ${image.src}`);
  const absolute = path.resolve(root, image.src);
  assert(absolute.startsWith(root + path.sep), 'Image path escaped the project.');
  assert((await stat(absolute)).size > 0, `Empty image: ${image.src}`);
  execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'ls-files', '--error-unmatch', image.src], { cwd: root, stdio: 'pipe' });
}
assert.equal(resolved.images[0].src, 'https://raw.githubusercontent.com/private-dev-ph/AssetTagStudio/main/docs/media/workspace.png');
if (manifest.logo) assert.equal(resolved.logo.src, `https://raw.githubusercontent.com/private-dev-ph/AssetTagStudio/main/${manifest.logo.src}`);
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
assert(readme.includes('portfolio-showcase.json') && readme.includes('private'), 'README must explain metadata and private discovery status.');
assert(readme.includes('docs/media/sample-labels.pdf'), 'README must retain the sample PDF link.');
console.log('Portfolio schema constraints, real loader, Live gating, sections, tracked media and README references passed.');
console.log('Live portfolio discovery additionally requires a public repository and this manifest on its default branch.');
