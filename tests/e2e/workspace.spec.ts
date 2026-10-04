import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';

test('sample CSV builds a QR label PDF locally', async ({ page }) => {
  const nonReadRequests: string[] = [];
  page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) nonReadRequests.push(`${request.method()} ${request.url()}`); });

  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data' }).click();
  await expect(page.getByRole('heading', { name: 'Choose assets' })).toBeVisible();
  await expect(page.getByText('8 rows · 5 columns')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^asset-labels-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(nonReadRequests).toEqual([]);
  const storedKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storedKeys).toEqual(['asset-tag-studio.preferences.v1']);
  const storedValues = await page.evaluate(() => Object.values(localStorage).join(' '));
  expect(storedValues).not.toContain('AST-1001');
});

test('Excel workbook selects a sheet and exports multipage Code 128 labels', async ({ page }) => {
  const workbook = XLSX.utils.book_new();
  const rows = [['Asset ID', 'Name'], ...Array.from({ length: 60 }, (_, index) => [`LAB-${String(index + 1).padStart(3, '0')}`, `Lab asset ${index + 1}`])];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Inventory');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Other ID', 'Notes'], ['OTHER-1', 'Second sheet']]), 'Other');
  const buffer = Buffer.from(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));

  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'inventory.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByRole('combobox', { name: 'Worksheet' })).toHaveValue('Inventory');
  await expect(page.getByText('60 rows · 2 columns')).toBeVisible();
  await expect(page.getByText('60 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Code 128' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeEnabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
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
