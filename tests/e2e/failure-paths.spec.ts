import { expect, test } from '@playwright/test';

test('payload and Code 128 errors recover without downloading a misleading PDF', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'unicode.csv', mimeType: 'text/csv', buffer: Buffer.from('asset_id,name\n工具箱,Tool box\n') });
  await expect(page.getByRole('img', { name: /Rendered label for/ })).toBeVisible();
  await page.getByRole('button', { name: 'Code 128', exact: true }).click();
  await expect(page.locator('.single-preview')).toContainText('printable ASCII');
  await page.getByRole('button', { name: /Download PDF/ }).click();
  await expect(page.locator('.export-error')).toContainText('printable ASCII');
  await page.getByRole('button', { name: 'QR code', exact: true }).click();
  await page.getByLabel('QR content mode').selectOption('template');
  await page.getByLabel('Payload template').fill('A'.repeat(500));
  await page.getByRole('button', { name: 'Code 128', exact: true }).click();
  await expect(page.locator('.single-preview')).toContainText('too wide');
  await page.getByRole('button', { name: 'QR code', exact: true }).click();
  await page.getByLabel('Code size', { exact: true }).fill('8');
  await expect(page.locator('.single-preview')).toContainText('too dense');
  await page.getByLabel('Code size', { exact: true }).fill('20');
  await page.getByLabel('Payload template').fill('https://inventory.example/{missing}');
  await expect(page.locator('.single-preview')).toContainText('not a column');
  await page.getByLabel('Payload template').fill('https://inventory.example/{asset_id}');
  await expect(page.getByRole('img', { name: /Rendered label for/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Download PDF/ })).toBeEnabled();
});

test('large datasets keep DOM bounded and PDF cancellation is recoverable', async ({ page }) => {
  await page.goto('/');
  const rows = ['asset_id,name', ...Array.from({ length: 1000 }, (_, i) => `A-${i},Tool ${i}`)].join('\n');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(rows) });
  await expect(page.getByText('1,000 rows · 2 columns')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  expect(await page.locator('.paper-label').count()).toBeLessThanOrEqual(36);
  await page.getByRole('button', { name: /Download PDF/ }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: /Download PDF/ })).toBeEnabled();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('.export-error')).toHaveCount(0);
});

test('malformed saved preferences fall back and an invalid layout can be repaired', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('asset-tag-studio.preferences.v1', '{"page":{"widthMm":-1}}'));
  await page.reload();
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('60');
  await page.getByLabel('Paper width', { exact: true }).fill('50');
  await expect(page.getByRole('button', { name: /Download PDF/ })).toBeDisabled();
  await page.getByLabel('Paper size', { exact: true }).selectOption('A4');
  await expect(page.getByRole('button', { name: /Download PDF/ })).toBeEnabled();
});

test('the 20000-row boundary exports a complete PDF with repeated labels', async ({ page }) => {
  test.setTimeout(120_000);
  const { PDFDocument } = await import('pdf-lib');
  const { readFile } = await import('node:fs/promises');
  await page.goto('/');
  const rows = ['asset_id,name', ...Array.from({ length: 20_000 }, () => 'SHARED-1,Shared tool')].join('\n');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'boundary.csv', mimeType: 'text/csv', buffer: Buffer.from(rows) });
  await expect(page.getByText('20,000 rows · 2 columns')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download PDF/ }).click();
  const download = await downloadPromise;
  const pdf = await PDFDocument.load(await readFile((await download.path())!));
  expect(pdf.getPageCount()).toBe(834);
});
