import { expect, test, type Download, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import jsQR from 'jsqr';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';

async function loadCsv(page: Page, name: string, contents: string) {
  await page.goto('/#/asset-labels');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(contents) });
  await expect(page.getByRole('heading', { name: 'Choose assets' })).toBeVisible();
}

async function openView(page: Page, view: string) {
  await page.goto(`/#/${view}`);
  await expect(page.locator(`nav[aria-label="Studio tools"] a[href="#/${view}"]`)).toHaveAttribute('aria-current', 'page');
}

async function downloadBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  expect(path).toBeTruthy();
  return readFile(path!);
}

async function readLibrary(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('assettag-studio-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ templates: unknown[]; printers: unknown[] }>((resolve, reject) => {
      const transaction = database.transaction(['templates', 'printers'], 'readonly');
      const templates = transaction.objectStore('templates').getAll();
      const printers = transaction.objectStore('printers').getAll();
      transaction.oncomplete = () => { database.close(); resolve({ templates: templates.result, printers: printers.result }); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  });
}

test('ID generation detects collisions, fills blanks only, and undoes as one workspace change', async ({ page }) => {
  await loadCsv(page, 'ids.csv', 'Asset ID,Name\n001,Occupied\n,Blank one\n,Blank two\n');
  await openView(page, 'id-generator');
  await page.getByLabel('Zero padding').fill('3');
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByText(/1 collision\(s\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply IDs' })).toBeDisabled();

  await page.getByLabel('Start sequence').fill('2');
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByText(/0 collision\(s\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply IDs' }).click();
  await expect(page.getByRole('button', { name: /Undo Generate asset identifiers/ })).toBeEnabled();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '002', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '003', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Undo Generate asset identifiers/ }).click();
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible();
  const blankOne = page.getByRole('row').filter({ hasText: 'Blank one' });
  const blankTwo = page.getByRole('row').filter({ hasText: 'Blank two' });
  await expect(blankOne.locator('td').nth(1)).toHaveText('—');
  await expect(blankTwo.locator('td').nth(1)).toHaveText('—');
});

test('Data Health remaps normalized headers, trims cells, and restores both changes with undo', async ({ page }) => {
  await loadCsv(page, 'health.csv', 'Asset  ID,  Asset Name  ,Serial Number\nHEALTH-1, Widget ,SN-1\n');
  await openView(page, 'data-health');
  await page.getByLabel('Fix', { exact: true }).selectOption('headers');
  await page.getByRole('button', { name: 'Preview fix' }).click();
  await expect(page.getByText(/Normalize headers/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply fix' }).click();
  await expect(page.getByRole('button', { name: /Undo Normalize headers/ })).toBeEnabled();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: /Asset ID/ })).toBeVisible();
  await expect(page.getByLabel('Unique identifier field')).toHaveValue('Asset ID');

  await page.getByRole('link', { name: 'Data health', exact: true }).click();
  await page.getByLabel('Fix', { exact: true }).selectOption('trim');
  await page.getByRole('button', { name: 'Preview fix' }).click();
  await page.getByRole('button', { name: 'Apply fix' }).click();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Widget', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Undo Trim cell whitespace/ }).click();
  await expect(page.getByRole('cell', { name: 'Widget', exact: true })).toHaveAttribute('title', ' Widget ');
  await page.getByRole('button', { name: /Undo Normalize headers/ }).click();
  expect(await page.locator('thead th button.sort-button').first().textContent()).toContain('Asset  ID');
  await expect(page.getByLabel('Unique identifier field')).toHaveValue('Asset  ID');
});

test('Serial Tools normalizes selected values and validates a regular expression', async ({ page }) => {
  await loadCsv(page, 'serials.csv', 'Asset ID,Serial Number\nSER-1,sn: ab-12 \nSER-2,sn: zz-34\n');
  await openView(page, 'serial-tools');
  await page.getByLabel('Strip leading prefix').fill('SN:');
  await page.getByLabel('Validation pattern').fill('^AB[0-9]{2}$');
  await page.getByRole('button', { name: 'Preview serials' }).click();
  await expect(page.getByText(/1 invalid/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply serial changes' })).toBeDisabled();

  await page.getByLabel('Validation pattern').fill('^[A-Z]{2}[0-9]{2}$');
  await page.getByRole('button', { name: 'Preview serials' }).click();
  await expect(page.getByText(/0 invalid/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply serial changes' }).click();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'AB12', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ZZ34', exact: true })).toBeVisible();
});

test('template library imports strictly, renames without replacing settings, duplicates, deletes, and persists settings only', async ({ page }) => {
  const secret = 'SECRET-ROW-92741';
  await loadCsv(page, 'private-template.csv', `Asset ID,Asset Name,Location\n${secret},Private equipment,Building 4\n`);
  await openView(page, 'templates');
  await expect(page.getByRole('button', { name: 'Standard Asset Tag' })).toBeVisible();
  await page.getByRole('button', { name: 'Standard Asset Tag' }).click();
  await page.getByRole('button', { name: 'Apply template' }).click();
  await page.getByLabel('Template name').fill('Quarterly labels');
  await page.getByRole('button', { name: 'Save current settings' }).click();
  const savedRow = page.getByRole('row').filter({ hasText: 'Quarterly labels' });
  await expect(savedRow).toBeVisible();
  const beforeRename = await readLibrary(page);
  const original = (beforeRename.templates[0] as { json: string }).json;
  expect(JSON.stringify(beforeRename)).not.toContain(secret);
  expect(JSON.stringify(await page.evaluate(() => ({ ...localStorage })))).not.toContain(secret);

  await savedRow.getByRole('button', { name: 'Quarterly labels', exact: true }).click();
  await page.getByLabel('Template name').fill('Quarterly labels renamed');
  await page.getByRole('button', { name: 'Rename saved template' }).click();
  const renamedRow = page.getByRole('row').filter({ hasText: 'Quarterly labels renamed' });
  await expect(renamedRow).toBeVisible();
  const afterRename = await readLibrary(page);
  const renamed = JSON.parse((afterRename.templates[0] as { json: string }).json) as { name: string; template: unknown; page?: unknown };
  const before = JSON.parse(original) as { template: unknown; page?: unknown };
  expect(renamed.name).toBe('Quarterly labels renamed');
  expect(renamed.template).toEqual(before.template);
  expect(renamed.page).toEqual(before.page);

  await renamedRow.getByRole('button', { name: 'Duplicate' }).click();
  const copyRow = page.getByRole('row').filter({ hasText: 'Quarterly labels renamed copy' });
  await expect(copyRow).toBeVisible();
  await copyRow.getByRole('button', { name: 'Delete' }).click();
  await expect(copyRow).toHaveCount(0);

  const badDocument = { version: 1, kind: 'template', name: 'Unsafe', template: {}, records: [{ id: 'secret', values: { [secret]: 'retained' } }] };
  await page.locator('input[type="file"][accept*=".assettag.json"]').setInputFiles({ name: 'unsafe.assettag.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(badDocument)) });
  await expect(page.getByRole('alert')).toContainText(/unsupported property/i);

  await page.reload();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'private-template.csv', mimeType: 'text/csv', buffer: Buffer.from(`Asset ID,Asset Name,Location\n${secret},Private equipment,Building 4\n`) });
  await page.getByRole('link', { name: 'Templates', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quarterly labels renamed', exact: true })).toBeVisible();
  const persisted = await readLibrary(page);
  expect(JSON.stringify(persisted)).not.toContain(secret);
  expect(persisted.templates).toHaveLength(1);
  expect(persisted.printers).toHaveLength(0);
});

test('template library enforces 100 entries and offers explicit template-only recovery for corrupt storage', async ({ page }) => {
  test.setTimeout(60_000);
  await loadCsv(page, 'library-capacity.csv', 'Asset ID,Name\nLIB-1,Router\n');
  await openView(page, 'templates');
  await page.getByRole('button', { name: 'Standard Asset Tag' }).click();
  await page.getByRole('button', { name: 'Apply template' }).click();
  await page.getByLabel('Template name').fill('Capacity seed');
  await page.getByRole('button', { name: 'Save current settings' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Capacity seed' })).toBeVisible();
  const seedJson = (await readLibrary(page).then(library => library.templates[0] as { json: string })).json;

  await page.evaluate(async json => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('assettag-studio-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['templates', 'printers'], 'readwrite');
      const templates = transaction.objectStore('templates');
      templates.clear();
      for (let index = 0; index < 100; index += 1) templates.put({ id: `capacity-${index}`, name: `Capacity ${index}`, json });
      transaction.objectStore('printers').put({ id: 'keep-printer', name: 'Preserved printer profile', json: '{}' });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  }, seedJson);

  await page.getByRole('button', { name: 'Standard Asset Tag' }).click();
  await page.getByRole('button', { name: 'Apply template' }).click();
  await page.getByLabel('Template name').fill('One too many');
  await page.getByRole('button', { name: 'Save current settings' }).click();
  await expect(page.getByRole('alert')).toContainText('already contains 100 items');

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('assettag-studio-library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('templates', 'readwrite');
      const store = transaction.objectStore('templates');
      const request = store.get('capacity-0');
      request.onsuccess = () => {
        const damaged = request.result as { id: string; name: string; json: string };
        store.delete(damaged.id);
        store.put({ ...damaged, id: '' });
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('corrupted');
  await page.getByRole('button', { name: 'Clear saved templates and retry' }).click();
  const recovered = await readLibrary(page);
  expect(recovered.templates).toHaveLength(0);
  expect(recovered.printers).toEqual([{ id: 'keep-printer', name: 'Preserved printer profile', json: '{}' }]);
});

test('payload builder encodes URL columns and rejects missing references and dense QR payloads', async ({ page }) => {
  await loadCsv(page, 'url-values.csv', 'Asset ID,Name\nA/B 1,Router\n');
  await openView(page, 'payload-builder');
  await page.getByLabel('Payload preset').selectOption('url');
  await expect(page.locator('.tool-preview')).toContainText('https://inventory.example/assets/A%2FB%201');
  await page.getByRole('button', { name: 'Validate selected payloads' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 valid / 1 selected. 0 invalid.' })).toBeVisible();

  await page.getByLabel('Payload builder template').fill('https://inventory.example/assets/{Missing Column}');
  await expect(page.getByRole('alert').filter({ hasText: 'not a column' })).toBeVisible();
  await page.getByLabel('Payload QR size').fill('8');
  await page.getByLabel('Payload builder template').fill(`https://inventory.example/${'A'.repeat(300)}`);
  await expect(page.getByRole('alert').filter({ hasText: 'too dense' })).toBeVisible();
});

test('cable and location layouts each export a local PDF from mapped dataset columns', async ({ page }) => {
  test.setTimeout(60_000);
  await loadCsv(page, 'special-labels.csv', 'Asset ID,From,Port,To,Site,Building\nASSET-1,Switch A,Gi1/0/1,Panel B,North,Main\nASSET-2,Switch C,Gi1/0/2,Panel D,South,Annex\n');

  await openView(page, 'cable-labels');
  await page.getByLabel('Source endpoint').selectOption('From');
  await page.getByLabel('Port').selectOption('Port');
  await page.getByLabel('Target endpoint').selectOption('To');
  await expect(page.getByLabel('Mirror for cable wrap')).toBeChecked();
  await page.getByRole('button', { name: 'Apply layout to workspace' }).click();
  const cableDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Create PDF' }).click();
  const cableDownload = await cableDownloadPromise;
  expect(cableDownload.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await PDFDocument.load(await downloadBytes(cableDownload))).getPageCount()).toBeGreaterThan(0);

  await openView(page, 'location-labels');
  await page.getByLabel('Site / warehouse').selectOption('Site');
  await page.getByLabel('Building').selectOption('Building');
  await page.getByRole('button', { name: 'Apply layout to workspace' }).click();
  const locationDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Create PDF' }).click();
  const locationDownload = await locationDownloadPromise;
  expect(locationDownload.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await PDFDocument.load(await downloadBytes(locationDownload))).getPageCount()).toBeGreaterThan(0);
});

test('printer profiles persist signed offsets and reset them for the active printer', async ({ page }) => {
  await openView(page, 'calibration');
  await page.getByLabel('Horizontal correction (mm)').fill('1.2');
  await page.getByLabel('Vertical correction (mm)').fill('-0.6');
  await page.getByLabel('New profile name').fill('Warehouse Zebra');
  await page.getByRole('button', { name: 'Save new profile' }).click();
  await expect(page.getByLabel('Active profile')).toHaveValue(/.+/);
  await expect(page.getByText('1.2 mm X · -0.6 mm Y')).toBeVisible();
  const database = await readLibrary(page);
  expect(database.printers).toHaveLength(1);
  expect(JSON.stringify(database.printers)).toContain('Warehouse Zebra');

  await page.getByRole('button', { name: 'Reset offsets' }).click();
  await expect(page.getByText('0 mm X · 0 mm Y')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Printer calibration' })).toBeVisible();
  await expect(page.getByLabel('Active profile')).toHaveValue(/.+/);
  await expect(page.getByText('0 mm X · 0 mm Y')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download calibration PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('printer-calibration.pdf');
  await page.getByRole('button', { name: 'Delete profile' }).click();
  await expect(page.getByLabel('Active profile')).toHaveValue('');
});

test('a successful print manifest retains its original IDs, pages, and coordinates after rows are removed', async ({ page }) => {
  test.setTimeout(60_000);
  await loadCsv(page, 'manifest.csv', 'Asset ID,Name\nTAG-1,One\nTAG-2,Two\nTAG-3,Three\n');
  await page.getByLabel('Paper size').selectOption('Custom');
  await page.getByLabel('Paper width').fill('100');
  await page.getByLabel('Paper height').fill('60');
  await expect(page.locator('.paper-label img')).toHaveCount(1);
  const previewPositions = await page.locator('.preview-paper').evaluate(element => {
    const scale = element.getBoundingClientRect().width / 100;
    return [...element.querySelectorAll<HTMLElement>('.paper-label')].map(label => ({ xMm: Number.parseFloat(label.style.left) / scale, yMm: Number.parseFloat(label.style.top) / scale }));
  });
  expect(previewPositions).toEqual([{ xMm: 10, yMm: 10 }]);

  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download PDF/ }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdf = await PDFDocument.load(await downloadBytes(pdfDownload));
  expect(pdf.getPageCount()).toBe(3);

  await page.getByRole('checkbox', { name: 'Select all matching assets' }).uncheck();
  await page.getByRole('checkbox', { name: 'Select TAG-1' }).check();
  await page.getByRole('button', { name: 'Remove selected' }).click();
  await expect(page.getByRole('cell', { name: 'TAG-1', exact: true })).toHaveCount(0);
  await openView(page, 'manifest');
  const jsonPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename() === 'asset-print-manifest.json' });
  const csvPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename() === 'asset-print-manifest.csv' });
  await page.getByRole('button', { name: 'Download JSON and CSV' }).click();
  const [jsonDownload, csvDownload] = await Promise.all([jsonPromise, csvPromise]);
  const manifest = JSON.parse((await downloadBytes(jsonDownload)).toString('utf8')) as { records: Array<{ assetId: string; page: number; labelIndex: number; xMm: number; yMm: number }> };
  const csv = (await downloadBytes(csvDownload)).toString('utf8');
  const csvRows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
  expect(manifest.records.map(label => label.assetId)).toEqual(['TAG-1', 'TAG-2', 'TAG-3']);
  expect(manifest.records.map(label => label.page)).toEqual([1, 2, 3]);
  expect(manifest.records.map(({ xMm, yMm }) => ({ xMm, yMm }))).toEqual(Array(3).fill(previewPositions[0]));
  expect(manifest.records.every(label => label.page <= pdf.getPageCount() && label.labelIndex >= 1)).toBe(true);
  expect(csvRows).toHaveLength(manifest.records.length);
  expect(csvRows.map(row => ({
    recordId: row.record_id,
    assetId: row.asset_id,
    labelIndex: Number(row.label_index),
    page: Number(row.page),
    row: Number(row.row),
    column: Number(row.column),
    xMm: Number(row.x_mm),
    yMm: Number(row.y_mm),
    payload: row.payload,
  }))).toEqual(manifest.records);
});

test('FieldLens PDF and CSV use matching IDs, and formula-leading IDs are rejected', async ({ page }) => {
  test.setTimeout(60_000);
  await loadCsv(page, 'fieldlens.csv', 'Asset ID,Name,Asset Type,Serial,Location\nFL-001,Laptop,Computer,S-1,Room 1\nFL-002,Tablet,Mobile,S-2,Room 2\n');
  await openView(page, 'fieldlens');
  await page.getByLabel('Asset ID').selectOption('Asset ID');
  await page.getByLabel('Name').selectOption('Name');
  await page.getByLabel('Asset type').selectOption('Asset Type');
  await page.getByLabel('Serial').selectOption('Serial');
  await page.getByLabel('Location').selectOption('Location');
  const pdfPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename() === 'fieldlens-labels.pdf' });
  const csvPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename() === 'fieldlens-assets.csv' });
  await page.getByRole('button', { name: 'Create FieldLens PDF and CSV' }).click();
  const [pdfDownload, csvDownload] = await Promise.all([pdfPromise, csvPromise]);
  expect(pdfDownload.suggestedFilename()).toBe('fieldlens-labels.pdf');
  const pdf = await PDFDocument.load(await downloadBytes(pdfDownload));
  expect(pdf.getPageCount()).toBe(1);
  const csv = (await downloadBytes(csvDownload)).toString('utf8');
  const csvIds = csv.split(/\r?\n/).filter(Boolean).slice(1).map(line => line.match(/^"([^"]+)"/)?.[1]);
  expect(csvIds).toEqual(['FL-001', 'FL-002']);

  await openView(page, 'payload-builder');
  await page.getByLabel('Payload preset').selectOption('fieldlens');
  await expect(page.locator('.tool-preview')).toContainText('fieldlens://asset/FL-001');
  await page.getByRole('button', { name: 'Apply to label' }).click();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  const image = page.getByRole('img', { name: /Rendered label for/ });
  await expect(image).toBeVisible();
  const pixels = await image.evaluate(element => {
    const img = element as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
    return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  const qr = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  expect(qr?.data).toBe(`fieldlens://asset/${csvIds[0]}`);

  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'formula-id.csv', mimeType: 'text/csv', buffer: Buffer.from('Asset ID,Name,Asset Type\n=1+1,Unsafe,Computer\n') });
  await openView(page, 'fieldlens');
  await page.getByLabel('Asset ID').selectOption('Asset ID');
  await page.getByLabel('Name').selectOption('Name');
  await page.getByLabel('Asset type').selectOption('Asset Type');
  await page.getByRole('button', { name: 'Create FieldLens PDF and CSV' }).click();
  await expect(page.getByRole('alert')).toContainText(/formula character/i);
});
