import { expect, test } from '@playwright/test';

test('table filters, sorting and removal keep the selected output explicit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name: 'controls.csv', mimeType: 'text/csv', buffer: Buffer.from('asset_id,name\nB-2,Second\nA-1,First\nC-3,Third\n') });
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: /asset_id/ }).click();
  await expect(page.locator('tbody tr').first()).toContainText('A-1');
  await page.getByRole('checkbox', { name: 'Select all matching assets' }).uncheck();
  await page.getByLabel('Search assets').fill('Second');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Select all matching assets' }).check();
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove selected', exact: true }).click();
  await page.getByLabel('Search assets').fill('');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Download PDF/ })).toBeDisabled();
});

test('theme, units and hidden field settings survive reload without records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.getByLabel('Measurement units').selectOption('in');
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('2.36');
  await page.getByLabel('Show field 1', { exact: true }).uncheck();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Choose a file', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await expect(page.getByLabel('Measurement units')).toHaveValue('in');
  await expect(page.getByLabel('Show field 1', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Printed field 1')).toHaveValue('Name');
});

test('workspace fits a narrow viewport and retains labelled controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sample data', exact: true }).click();
  await expect(page.getByLabel('Search assets')).toBeVisible();
  await expect(page.getByLabel('Identifier field', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
