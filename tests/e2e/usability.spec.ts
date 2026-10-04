import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';

async function loadCsv(page: Page, contents: string) {
  await page.goto('/#/asset-labels');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'usability.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
  await expect(page.getByRole('heading', { name: 'Choose assets' })).toBeVisible();
}

async function openView(page: Page, view: string) {
  await page.goto(`/#/${view}`);
  await expect(page.locator(`nav[aria-label="Studio tools"] a[href="#/${view}"]`)).toHaveAttribute('aria-current', 'page');
}

test('text-only cable wrap has visible text in both opposite-facing panels', async ({ page }) => {
  await loadCsv(page, 'Asset ID,Source,Port,Target\nCABLE-1,SW01,P1,PC01\n');
  await openView(page, 'cable-labels');
  await page.getByLabel('Source endpoint').selectOption('Source');
  await page.getByLabel('Port', { exact: true }).selectOption('Port');
  await page.getByLabel('Target endpoint').selectOption('Target');
  await expect(page.getByLabel('Mirror for cable wrap')).toBeChecked();
  const image = page.getByRole('img', { name: /Label preview for/ }).first();
  await expect(image).toBeVisible();
  const pixels = await image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(element, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const ink = [0, 0];
    let mismatches = 0;
    for (let y = 14; y < canvas.height - 14; y++) {
      for (let x = 14; x < canvas.width / 2 - 14; x++) {
        const left = (y * canvas.width + x) * 4;
        const right = ((canvas.height - 1 - y) * canvas.width + canvas.width - 1 - x) * 4;
        if (data[left]! < 100) ink[0]!++;
        if (data[right]! < 100) ink[1]!++;
        if (Math.abs(data[left]! - data[right]!) > 30) mismatches++;
      }
    }
    return { ink, mismatches, width: canvas.width, height: canvas.height };
  });
  expect(pixels.width).toBe(560); expect(pixels.height).toBe(144);
  expect(pixels.ink[0]).toBeGreaterThan(300);
  expect(pixels.ink[1]).toBeGreaterThan(300);
  expect(pixels.mismatches).toBeLessThan(20);

  const previous = await image.getAttribute('src');
  await page.getByLabel('Add QR / barcode').check();
  // A source update guarantees the asynchronous preview has reached the QR layout.
  await expect(image).not.toHaveAttribute('src', previous!);
  const qr = await image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth / 2; canvas.height = element.naturalHeight;
    const context = canvas.getContext('2d')!; context.drawImage(element, 0, 0);
    return { data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data), width: canvas.width, height: canvas.height };
  });
  expect(jsQR(Uint8ClampedArray.from(qr.data), qr.width, qr.height)?.data).toBe('SW01');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(image).toBeVisible();
  expect(await image.evaluate(element => element.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
});

test('all tool tables keep headers horizontal at desktop and mobile widths', async ({ page }) => {
  await loadCsv(page, 'Asset ID,Name,Serial\nOLD-1,mixed Name,sn: a-1\nOLD-2,mixed Name,sn: a-1\n');
  for (const width of [1280, 650, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['data-health', 'id-generator', 'serial-tools', 'templates']) {
      await openView(page, view);
      if (view === 'id-generator') {
        await page.getByLabel('Allow overwriting existing IDs').check();
        await page.getByRole('button', { name: 'Preview IDs' }).click();
      } else if (view === 'serial-tools') {
        await page.getByRole('button', { name: 'Preview serials' }).click();
        await expect(page.getByRole('columnheader', { name: 'Original', exact: true })).toBeVisible();
      } else if (view === 'templates') {
        await page.getByLabel('Template name').fill(`Readable table ${width}`);
        await page.getByRole('button', { name: 'Save current settings' }).click();
      }
      const headers = page.locator('.tool-table th');
      await expect(headers.first()).toBeVisible();
      for (const header of await headers.all()) {
        expect(await header.evaluate(element => getComputedStyle(element).whiteSpace)).toBe('nowrap');
        expect((await header.boundingBox())!.width).toBeGreaterThan(40);
      }
      if (view === 'data-health') {
        expect((await page.getByRole('columnheader', { name: 'Severity' }).boundingBox())!.width).toBeGreaterThanOrEqual(90);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test('footer explains local storage and links the project with themed scrollbars', async ({ page, request }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer).toContainText('never uploads or collects');
  await expect(footer).toContainText('stored only on this device');
  await expect(footer.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/private-dev-ph');
  await expect(footer.getByRole('link', { name: 'Portfolio', exact: true })).toHaveAttribute('href', 'https://zachcodes.dev');
  await expect(footer.getByRole('link', { name: 'Apache License 2.0' })).toHaveAttribute('href', '/LICENSE.txt');
  expect(await (await request.get('/LICENSE.txt')).text()).toContain('Apache License');
  const scrollbar = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor);
  const light = await scrollbar();
  expect(light).not.toBe('auto');
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  expect(await scrollbar()).not.toBe(light);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await scrollbar()).toBe('auto');
});

test('ID guidance explains protected populated cells and the blank fixture generates three IDs', async ({ page, request }) => {
  await loadCsv(page, 'Asset ID,Asset Name\nOLD-1,First\nOLD-2,Second\n');
  await openView(page, 'id-generator');
  await expect(page.getByText(/0 eligible/)).toBeVisible();
  await page.getByLabel('Pattern').fill('TEST-{sequence}');
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByRole('button', { name: 'Apply IDs', exact: true })).toBeDisabled();
  await expect(page.getByText(/Enable.*Allow overwriting existing IDs/).first()).toBeVisible();
  await page.getByLabel('Generate for blank IDs only').uncheck();
  await expect(page.getByLabel('Allow overwriting existing IDs')).not.toBeChecked();
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByRole('button', { name: 'Apply IDs', exact: true })).toBeDisabled();
  await page.getByLabel('Allow overwriting existing IDs').check();
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByRole('cell', { name: 'TEST-001', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'TEST-002', exact: true })).toBeVisible();

  const fixture = await request.get('/examples/id-generator.csv');
  expect(fixture.ok()).toBe(true);
  await loadCsv(page, await fixture.text());
  await openView(page, 'id-generator');
  await page.getByLabel('Identifier column', { exact: true }).selectOption('Asset ID');
  await expect(page.getByLabel('Generate for blank IDs only')).toBeChecked();
  await page.getByLabel('Pattern').fill('TEST-{sequence}');
  await page.getByLabel('Preview count', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByRole('cell', { name: 'TEST-002', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply IDs', exact: true }).click();
  await expect(page.getByLabel('Start sequence', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: 'Next batch', exact: true }).click();
  await expect(page.getByLabel('Start position', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Preview count', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Preview IDs' }).click();
  await expect(page.getByRole('cell', { name: 'TEST-003', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply IDs', exact: true }).click();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  for (const id of ['TEST-001', 'TEST-002', 'TEST-003']) await expect(page.getByRole('cell', { name: id, exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Undo Generate asset identifiers/ }).click();
  await expect(page.getByRole('cell', { name: 'TEST-003', exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'TEST-001', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Undo Generate asset identifiers/ }).click();
  await expect(page.getByRole('cell', { name: 'TEST-001', exact: true })).toHaveCount(0);
});

test('20k selected serials preview and apply only the chosen 2000-row batch with undo', async ({ page }) => {
  await loadCsv(page, 'Asset ID,Serial Number\n' + Array.from({ length: 20_000 }, (_, index) => `ASSET-${String(index + 1).padStart(5, '0')},sn: ab-${index + 1}`).join('\n'));
  await openView(page, 'serial-tools');
  await expect(page.getByLabel('Preview count', { exact: true })).toHaveValue('2000');
  await page.getByLabel('Strip leading prefix').fill('SN:');
  await page.getByLabel('Preview count', { exact: true }).fill('2001');
  await page.getByRole('button', { name: 'Preview serials' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next batch', exact: true })).toBeDisabled();
  await page.getByLabel('Preview count', { exact: true }).fill('2000');
  await page.getByRole('button', { name: 'Next batch', exact: true }).click();
  await expect(page.getByLabel('Start position', { exact: true })).toHaveValue('2001');
  await page.getByRole('button', { name: 'Preview serials' }).click();
  await expect(page.getByRole('cell', { name: 'AB2001', exact: true })).toBeVisible();
  await page.getByLabel('Remove spaces and separators').uncheck();
  await expect(page.getByRole('button', { name: 'Apply serial changes', exact: true })).toHaveCount(0);
  await page.getByLabel('Remove spaces and separators').check();
  await page.getByRole('button', { name: 'Preview serials' }).click();
  await page.getByRole('button', { name: 'Apply serial changes', exact: true }).click();
  await expect(page.getByLabel('Start position', { exact: true })).toHaveValue('2001');
  await expect(page.locator('.workspace-status')).toContainText('selection 20,000');
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  for (const [number, value] of [[2000, 'sn: ab-2000'], [2001, 'AB2001'], [4000, 'AB4000'], [4001, 'sn: ab-4001']] as const) {
    await page.getByRole('textbox', { name: 'Search assets' }).fill(`ASSET-${String(number).padStart(5, '0')}`);
    await expect(page.getByRole('cell', { name: value, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: /Undo Normalize serial numbers/ }).click();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('ASSET-02001');
  await expect(page.getByRole('cell', { name: 'sn: ab-2001', exact: true })).toBeVisible();
});
