import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';

test('rendered QR decodes correctly and inventory stays local', async ({ page }) => {
  const requests: { url: string; method: string; body: string | null }[] = [];
  const failures: string[] = [];
  page.on('request', request => requests.push({url: request.url(),method: request.method(),body: request.postData()}));
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await page.getByLabel('Choose a CSV or Excel file').setInputFiles({name:'private-assets.csv',mimeType:'text/csv',buffer:Buffer.from('asset_id,name\nPRIVATE-QR-7381,工具箱\n')});
  const image = page.getByRole('img', {name: /Rendered label for/});
  await expect(image).toBeVisible();
  const pixels = await image.evaluate((element) => {
    const img = element as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const context=canvas.getContext('2d')!;
    context.drawImage(img,0,0);
    return {width:canvas.width,height:canvas.height,data:Array.from(context.getImageData(0,0,canvas.width,canvas.height).data)};
  });
  const decoded=jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
  expect(decoded?.data).toBe('PRIVATE-QR-7381');
  expect(failures).toEqual([]);
  expect(requests.every(r=>r.method==='GET' && !r.body && !r.url.includes('PRIVATE-QR-7381'))).toBe(true);
  expect(requests.every(r=>new URL(r.url).origin==='http://127.0.0.1:4173')).toBe(true);
  const saved=await page.evaluate(()=>JSON.stringify({...localStorage}));
  expect(saved).not.toContain('PRIVATE-QR-7381');
  await page.reload();
  await expect(page.getByRole('button',{name:/Choose a file/i})).toBeVisible();
});

test('malformed headers recover without injecting spreadsheet HTML', async ({page})=>{
  await page.goto('/');
  const input=page.getByLabel('Choose a CSV or Excel file');
  await input.setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('id,id\n1,2')});
  await expect(page.getByRole('alert')).toContainText('Duplicate header');
  await input.setInputFiles({name:'safe.csv',mimeType:'text/csv',buffer:Buffer.from('asset_id,name\nA-1,<img src=x onerror=alert(1)>')});
  await expect(page.getByRole('cell',{name:'<img src=x onerror=alert(1)>',exact:true})).toBeVisible();
  expect(await page.locator('td img').count()).toBe(0);
});

test('production response applies restrictive security headers',async({request})=>{
  const response=await request.get('/');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("worker-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
});

