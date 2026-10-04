import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';

async function loadCsv(page: Page, name: string, contents: string) {
  await page.goto('/#/asset-labels');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(contents) });
  await expect(page.getByRole('heading', { name: 'Choose assets' })).toBeVisible();
}

async function pixelsFor(image: ReturnType<Page['getByRole']>) {
  return image.evaluate(element => {
    const img = element as HTMLImageElement;
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
    return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
}

test('the current QR and Code 128 labels decode to the selected identifier', async ({ page }) => {
  await loadCsv(page, 'decode.csv', 'Asset ID,Name\nSTUDIO-0042,Switch\n');
  const image = page.getByRole('img', { name: /Rendered label for/ });
  await expect(image).toBeVisible();
  let pixels = await pixelsFor(image);
  const qr = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  expect(qr?.data).toBe('STUDIO-0042');

  await page.getByRole('link', { name: 'Code inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect current label' }).click();
  await expect(page.locator('pre.tool-preview')).toHaveText('STUDIO-0042');
  await expect(page.locator('dd').first()).toHaveText('QR CODE');

  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  const qrSource = await image.getAttribute('src');
  await page.getByRole('button', { name: 'Code 128', exact: true }).click();
  await expect.poll(() => image.getAttribute('src')).not.toBe(qrSource);
  await expect(image).toBeVisible();
  pixels = await pixelsFor(image);
  const rgba = new Uint8ClampedArray(pixels.data);
  const luminance = new Uint8ClampedArray(pixels.width * pixels.height);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] = Math.round((rgba[offset]! * 0.299) + (rgba[offset + 1]! * 0.587) + (rgba[offset + 2]! * 0.114));
  }
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, pixels.width, pixels.height)));
  expect(reader.decode(bitmap).getText()).toBe('STUDIO-0042');
  reader.reset();

  await page.getByRole('link', { name: 'Code inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect current label' }).click();
  await expect(page.locator('pre.tool-preview')).toHaveText('STUDIO-0042');
  await expect(page.locator('dd').first()).toHaveText('CODE 128');
});

test('uploaded image bounds fail safely and a valid PNG recovers through worker preprocessing', async ({ page }) => {
  await loadCsv(page, 'image.csv', 'Asset ID,Name\nIMAGE-0042,Switch\n');
  const image = page.getByRole('img', { name: /Rendered label for/ });
  await expect(image).toBeVisible();
  const png = Buffer.from((await image.getAttribute('src'))!.split(',')[1]!, 'base64');
  await page.getByRole('link', { name: 'Code inspector', exact: true }).click();
  const oversized = Buffer.alloc(24); oversized.set([137, 80, 78, 71, 13, 10, 26, 10]);
  oversized.writeUInt32BE(9000, 16); oversized.writeUInt32BE(9000, 20);
  await page.getByLabel('Code image').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: oversized });
  await expect(page.getByRole('alert')).toContainText('8 megapixels');
  await page.getByLabel('Code image').setInputFiles({ name: 'malformed.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') });
  await expect(page.getByRole('alert')).toContainText('valid PNG or JPEG');
  await page.getByLabel('Code image').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('pre.tool-preview')).toHaveText('IMAGE-0042');
  await expect(page.locator('dd').first()).toHaveText('QR CODE');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('pasted unsafe content is displayed as text and never opened or executed', async ({ page }) => {
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => pageErrors.push(error.message));
  const popups: Page[] = [];
  page.on('popup', popup => popups.push(popup));
  await page.goto('/#/code-inspector');
  const content = 'javascript:alert(1) <img src=x onerror=alert(2)>';
  await page.getByLabel('Inspector content').fill(content);
  await page.getByRole('button', { name: 'Analyze pasted content' }).click();
  await expect(page.locator('pre.tool-preview')).toContainText(content);
  await expect(page.getByText(/Unsupported URI scheme: javascript/i)).toBeVisible();
  expect(popups).toHaveLength(0);
  expect(pageErrors).toEqual([]);
  expect(requests.some(url => /javascript:|src=x|onerror/i.test(url))).toBe(false);
  expect(await page.locator('img').count()).toBe(0);
});

test('camera denial is reported using a mocked browser permission failure', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('denied by test', 'NotAllowedError'); } },
    });
  });
  await page.goto('/#/code-inspector');
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByRole('alert')).toContainText('Camera access was denied or no camera is available');
  await expect(page.getByLabel('Local camera preview')).toHaveCount(0);
});

test('a late mocked camera grant after navigation immediately stops its tracks', async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as Window & { resolveCamera?: (stream: MediaStream) => void; cameraTrackStopped?: boolean };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => new Promise<MediaStream>(resolve => { scope.resolveCamera = resolve; }) },
    });
  });
  await page.goto('/#/code-inspector');
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByText('Waiting for camera permission…')).toBeVisible();
  await page.getByRole('link', { name: 'Asset labels', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose a file', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const scope = window as Window & { resolveCamera?: (stream: MediaStream) => void; cameraTrackStopped?: boolean };
    const track = { stop: () => { scope.cameraTrackStopped = true; } };
    scope.resolveCamera?.({ getTracks: () => [track] } as unknown as MediaStream);
  });
  await expect.poll(() => page.evaluate(() => (window as Window & { cameraTrackStopped?: boolean }).cameraTrackStopped)).toBe(true);
  await expect(page.getByLabel('Local camera preview')).toHaveCount(0);
});
