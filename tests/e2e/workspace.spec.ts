import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

expect.configure({ timeout: 12_000 });

test('sample CSV builds a QR label PDF locally', async ({ page }) => {
  test.setTimeout(60_000);
  const nonReadRequests: string[] = [];
  page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(`${request.method()} ${request.url()}`); });

  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data' }).click();
  await expect(page.getByRole('heading', { name: 'Choose assets' })).toBeVisible();
  await expect(page.getByText('8 rows · 5 columns')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  const prefixToggle = await page.getByRole('checkbox', { name: 'Show prefix 1' }).boundingBox();
  expect(prefixToggle?.width).toBeLessThanOrEqual(24);
  expect(prefixToggle?.height).toBeLessThanOrEqual(24);
  await page.getByRole('checkbox', { name: 'Show field 1' }).uncheck();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^asset-labels-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(nonReadRequests).toEqual([]);
  const storedKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storedKeys).toEqual(['asset-tag-studio.preferences.v1']);
  const storedValues = await page.evaluate(() => Object.values(localStorage).join(' '));
  expect(storedValues).not.toContain('AST-1001');
  expect(JSON.parse(storedValues).hiddenFields).toContain('Name');
});

test('Excel workbook selects a sheet and exports multipage Code 128 labels', async ({ page }) => {
  test.setTimeout(60_000);
  const workbook = XLSX.utils.book_new();
  const rows = [['Asset ID', 'Name', 'Serial'], ...Array.from({ length: 60 }, (_, index) => [`LAB-${String(index + 1).padStart(3, '0')}`, `Lab asset ${index + 1}`, `SER-${String(index + 1).padStart(3, '0')}`])];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Inventory');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Other ID', 'Notes'], ['OTHER-1', 'Second sheet']]), 'Other');
  const buffer = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));

  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'inventory.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByRole('combobox', { name: 'Worksheet' })).toHaveValue('Inventory');
  await expect(page.getByText('60 rows · 3 columns')).toBeVisible();
  await expect(page.getByText('60 selected')).toBeVisible();
  await expect(page.getByText('Showing 1–50 of 60 matching rows · 50 per page')).toBeVisible();
  await page.getByRole('button', { name: 'Next rows' }).click();
  await page.getByRole('checkbox', { name: 'Select LAB-060' }).uncheck();
  await expect(page.getByText('59 selected')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('LAB-060');
  await page.getByRole('checkbox', { name: 'Select all matching assets' }).check();
  await expect(page.getByText('60 selected')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search assets' }).fill('');
  await page.getByRole('combobox', { name: 'Identifier field', exact: true }).selectOption('Serial');
  await page.getByRole('button', { name: 'Code 128' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('combobox', { name: 'Paper size' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Unique identifier field' })).toBeDisabled();
  const download = await downloadPromise;
  await expect(page.getByText(/labels per page · 3 pages/)).toBeVisible();
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdf = await PDFDocument.load(await readFile(pdfPath!));
  expect(pdf.getPageCount()).toBe(3);
  const size = pdf.getPage(0).getSize();
  expect(size.width).toBeCloseTo(595.28, 0);
  expect(size.height).toBeCloseTo(841.89, 0);
});

test('selected rows without identifiers cannot be exported', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'missing-identifier.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Asset ID,Name\nAST-1,Named asset\n,Missing ID\n', 'utf-8'),
  });
  await expect(page.getByRole('status').filter({ hasText: 'missing an identifier' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Select Missing ID' }).uncheck();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});

test('failed worksheet changes clear stale data and allow recovery', async ({ page }) => {
  test.setTimeout(60_000);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Asset ID', 'Name'], ['SAFE-1', 'Valid sheet asset']]), 'Valid');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Empty');
  const buffer = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));

  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'two-sheets.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByText('1 rows · 2 columns')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Worksheet' }).selectOption('Empty');
  await expect(page.getByRole('alert').filter({ hasText: 'is empty' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Worksheet' }).selectOption('Valid');
  await expect(page.getByText('1 rows · 2 columns')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
});
