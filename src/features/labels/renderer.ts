import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { AssetRecord, LabelField, LabelTemplate } from '../../types';

const MAX_LABEL_MM = 200;
const MAX_FONT_PT = 48;
const PIXELS_PER_MM = 8;
const MAX_CANVAS_EDGE = 1_800;
const MAX_FIELDS = 32;
const MIN_QR_MODULE_MM = 0.2;
const PLACEHOLDER = /\{([^{}]+)\}/g;

export function validateTemplate(template: LabelTemplate): void {
  if (!template || typeof template !== 'object') throw new Error('Choose a label template before rendering.');
  const finiteInRange = (value: number, label: string, min: number, max: number) => {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${label} must be between ${min} and ${max} mm.`);
    }
  };
  finiteInRange(template.widthMm, 'Label width', 10, MAX_LABEL_MM);
  finiteInRange(template.heightMm, 'Label height', 10, MAX_LABEL_MM);
  finiteInRange(template.paddingMm, 'Padding', 0, Math.min(template.widthMm, template.heightMm) / 3);
  if (template.widthMm * PIXELS_PER_MM > MAX_CANVAS_EDGE || template.heightMm * PIXELS_PER_MM > MAX_CANVAS_EDGE) {
    throw new Error('Label dimensions are too large to render safely. Reduce the label size.');
  }
  if (!['left', 'center', 'right'].includes(template.alignment)) throw new Error('Choose left, center, or right alignment.');
  if (typeof template.border !== 'boolean') throw new Error('Label border setting must be on or off.');
  if (!Array.isArray(template.fields) || template.fields.length > MAX_FIELDS) {
    throw new Error(`A label can contain at most ${MAX_FIELDS} text fields.`);
  }
  for (const [index, field] of template.fields.entries()) {
    if (!field || typeof field.source !== 'string' || !field.source.trim() || field.source.length > 200) throw new Error(`Text field ${index + 1} needs a source column name up to 200 characters.`);
    if (!Number.isFinite(field.fontSize) || field.fontSize < 5 || field.fontSize > MAX_FONT_PT) {
      throw new Error(`Text field ${index + 1} font size must be between 5 and ${MAX_FONT_PT} pt.`);
    }
    if (typeof field.label !== 'string' || field.label.length > 200) throw new Error(`Text field ${index + 1} label must be text with no more than 200 characters.`);
    if (typeof field.bold !== 'boolean') throw new Error(`Text field ${index + 1} bold setting must be on or off.`);
  }
  const code = template.code;
  if (!code || !['qr', 'code128'].includes(code.type)) throw new Error('Choose QR or Code 128 as the label code.');
  if (typeof code.field !== 'string' || !code.field.trim() || code.field.length > 200) throw new Error('Choose a code column with a name up to 200 characters.');
  if (typeof code.payload !== 'string' || code.payload.length > 2_000) {
    throw new Error('Code payload must be text with no more than 2,000 characters.');
  }
  if (typeof code.barcodeText !== 'boolean') throw new Error('Barcode text setting must be on or off.');
  if (/[{}]/.test(code.payload.replace(PLACEHOLDER, ''))) {
    throw new Error('Payload placeholders must use the form {columnName}. Remove unmatched braces.');
  }
  if ([...code.payload.matchAll(PLACEHOLDER)].some((match) => !match[1]!.trim())) {
    throw new Error('Payload placeholders need a column name, such as {Asset ID}.');
  }
  if (code.type === 'qr') {
    finiteInRange(code.sizeMm, 'QR size', 8, Math.min(template.widthMm, template.heightMm));
  } else {
    finiteInRange(code.barcodeHeightMm, 'Barcode height', 5, Math.min(40, template.heightMm));
    const scale = code.barcodeScale ?? 1;
    if (!Number.isFinite(scale) || scale < 0.8 || scale > 3) throw new Error('Barcode scale must be between 0.8 and 3.');
    if (code.barcodeTextPosition !== 'top' && code.barcodeTextPosition !== 'bottom') {
      throw new Error('Barcode text position must be top or bottom.');
    }
  }
}

function readStringValue(record: AssetRecord, key: string): string | undefined {
  if (!Object.hasOwn(record.values, key)) return undefined;
  const value: unknown = record.values[key];
  return typeof value === 'string' ? value : undefined;
}

export function interpolatePayload(record: AssetRecord, template: LabelTemplate): string {
  validateTemplate(template);
  if (!template.code.payload) {
    const value = readStringValue(record, template.code.field);
    if (!value?.trim()) throw new Error(`Record “${record.id}” has no value in “${template.code.field}”. Fill that cell or choose another code column.`);
    if (value.length > 2_000) throw new Error(`Record “${record.id}” produces a code value over 2,000 characters. Shorten the value or payload.`);
    return value;
  }
  let unknown: string | undefined;
  let missingValue: string | undefined;
  const result = template.code.payload.replace(PLACEHOLDER, (_match, key: string) => {
    const value = readStringValue(record, key);
    if (!Object.hasOwn(record.values, key)) unknown = key;
    else if (!value?.trim()) missingValue = key;
    return value ?? '';
  });
  if (unknown) throw new Error(`Payload placeholder “{${unknown}}” is not a column in the records. Fix the template placeholder.`);
  if (missingValue) throw new Error(`Record “${record.id}” has no value in “${missingValue}”. Fill that cell or change the payload.`);
  if (!result.trim()) throw new Error(`Record “${record.id}” produces an empty code value. Add a value or change the payload.`);
  if (result.length > 2_000) throw new Error(`Record “${record.id}” produces a code value over 2,000 characters. Shorten the value or payload.`);
  return result;
}

export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) throw new Error('Text area must have a positive width. Increase label width or reduce code size and padding.');
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph === '') { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      line = '';
      for (const char of Array.from(word)) {
        if (measure(char) > maxWidth) throw new Error('Text cannot fit at this font size. Reduce the font size or increase the label area.');
        if (line && measure(line + char) > maxWidth) { lines.push(line); line = ''; }
        line += char;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not create a label canvas. Try another browser.');
  return context;
}

function drawWrappedField(context: CanvasRenderingContext2D, field: LabelField, value: string, x: number, y: number, width: number, bottom: number, alignment: LabelTemplate['alignment']): number {
  const fontPx = field.fontSize * (25.4 / 72) * PIXELS_PER_MM;
  const lineHeight = fontPx * 1.2;
  context.font = `${field.bold ? '700' : '400'} ${fontPx}px Arial, sans-serif`;
  const text = field.label ? `${field.label}: ${value}` : value;
  const lines = wrapText(text, width, (line) => context.measureText(line).width);
  if (y + lines.length * lineHeight > bottom + 0.5) {
    throw new Error(`Text for “${field.label || field.source}” does not fit. Shorten the value, reduce its font size, or increase the label area.`);
  }
  context.textAlign = alignment;
  const drawX = alignment === 'left' ? x : alignment === 'center' ? x + width / 2 : x + width;
  for (const line of lines) {
    context.fillText(line, drawX, y + fontPx);
    y += lineHeight;
  }
  return y;
}

function pngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export async function renderLabel(record: AssetRecord, template: LabelTemplate): Promise<string> {
  validateTemplate(template);
  let payload: string;
  try {
    payload = interpolatePayload(record, template);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Could not prepare the code value. Check the selected column and payload.');
  }
  if (template.code.type === 'code128' && !/^[\x20-\x7e]+$/.test(payload)) {
    throw new Error(`Record “${record.id}” contains characters Code 128 cannot print here. Use printable ASCII text or select QR.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(template.widthMm * PIXELS_PER_MM);
  canvas.height = Math.round(template.heightMm * PIXELS_PER_MM);
  const context = canvasContext(canvas);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const pad = template.paddingMm * PIXELS_PER_MM;
  const innerRight = canvas.width - pad;
  const innerBottom = canvas.height - pad;
  if (template.border) {
    context.strokeStyle = '#111';
    context.lineWidth = Math.max(1, PIXELS_PER_MM / 8);
    context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, canvas.width - context.lineWidth, canvas.height - context.lineWidth);
  }

  if (template.code.type === 'qr') {
    if (template.code.sizeMm + pad / PIXELS_PER_MM * 2 > template.widthMm || template.code.sizeMm + pad / PIXELS_PER_MM * 2 > template.heightMm) {
      throw new Error('QR code does not fit inside the padded label. Reduce padding or QR size.');
    }
    let qr: ReturnType<typeof QRCode.create>;
    try { qr = QRCode.create(payload, { errorCorrectionLevel: 'M' }); }
    catch { throw new Error(`QR value for record “${record.id}” is too dense. Shorten the payload and try again.`); }
    const availableModules = Math.floor(template.code.sizeMm / MIN_QR_MODULE_MM) - 8;
    if (qr.modules.size > availableModules) {
      throw new Error(`QR value for record “${record.id}” is too dense for ${template.code.sizeMm} mm. Shorten the payload or increase the QR size.`);
    }
    const side = Math.round(template.code.sizeMm * PIXELS_PER_MM);
    const x = pad;
    const y = Math.max(pad, (canvas.height - side) / 2);
    const cell = side / (qr.modules.size + 8);
    context.fillStyle = '#fff';
    context.fillRect(x, y, side, side);
    context.fillStyle = '#000';
    for (let row = 0; row < qr.modules.size; row++) {
      for (let column = 0; column < qr.modules.size; column++) {
        if (qr.modules.data[row * qr.modules.size + column]) {
          context.fillRect(Math.round(x + (column + 4) * cell), Math.round(y + (row + 4) * cell), Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
    const textX = x + side + pad;
    const textWidth = innerRight - textX;
    if (template.fields.length && textWidth <= 0) throw new Error('There is no room for text beside the QR code. Reduce QR size or padding.');
    let textY = pad;
    for (const field of template.fields) {
      const fieldValue = readStringValue(record, field.source) ?? '';
      if (fieldValue.length > 2_000 || field.label.length > 200) throw new Error(`Text for “${field.source}” is too long to render safely. Shorten the cell or label.`);
      textY = drawWrappedField(context, field, fieldValue, textX, textY, textWidth, innerBottom, template.alignment);
    }
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, payload, {
        format: 'CODE128', width: 2 * (template.code.barcodeScale ?? 1), height: Math.round(template.code.barcodeHeightMm * PIXELS_PER_MM),
        displayValue: false, margin: 0, marginLeft: 20 * (template.code.barcodeScale ?? 1), marginRight: 20 * (template.code.barcodeScale ?? 1), lineColor: '#000', background: '#fff',
      });
    } catch {
      throw new Error(`Record “${record.id}” is not a valid Code 128 value. Use printable ASCII characters and check the value.`);
    }
    const rawSvg = new XMLSerializer().serializeToString(svg);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not rasterize the barcode. Check the value and try again.'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
    });
    const barcodeWidth = innerRight - pad;
    if (image.width > barcodeWidth) {
      throw new Error(`Barcode for record “${record.id}” is too wide for this label. Shorten the value or increase label width.`);
    }
    const x = pad + (barcodeWidth - image.width) / 2;
    const showBarcodeText = template.code.barcodeText;
    const barcodeY = showBarcodeText && template.code.barcodeTextPosition === 'top' ? pad + PIXELS_PER_MM * 4.5 : pad;
    if (showBarcodeText && template.code.barcodeTextPosition === 'top') {
      context.font = `${10 * (25.4 / 72) * PIXELS_PER_MM}px Arial, sans-serif`;
      if (context.measureText(payload).width > barcodeWidth) throw new Error(`Barcode text for record “${record.id}” is too wide. Shorten the value or hide barcode text.`);
      context.textAlign = 'center';
      context.fillStyle = '#000';
      context.fillText(payload, canvas.width / 2, pad + PIXELS_PER_MM * 3.5, barcodeWidth);
    }
    context.drawImage(image, x, barcodeY, image.width, image.height);
    let textY = barcodeY + image.height + pad;
    if (showBarcodeText && template.code.barcodeTextPosition === 'bottom') {
      context.font = `${9 * (25.4 / 72) * PIXELS_PER_MM}px Arial, sans-serif`;
      if (context.measureText(payload).width > barcodeWidth) throw new Error(`Barcode text for record “${record.id}” is too wide. Shorten the value or hide barcode text.`);
      context.textAlign = 'center';
      context.fillStyle = '#000';
      context.fillText(payload, canvas.width / 2, textY + PIXELS_PER_MM * 3.5, barcodeWidth);
      textY += PIXELS_PER_MM * 4.5;
    }
    for (const field of template.fields) {
      const fieldValue = readStringValue(record, field.source) ?? '';
      if (fieldValue.length > 2_000 || field.label.length > 200) throw new Error(`Text for “${field.source}” is too long to render safely. Shorten the cell or label.`);
      textY = drawWrappedField(context, field, fieldValue, pad, textY, barcodeWidth, innerBottom, template.alignment);
    }
    if (textY > innerBottom + 0.5) throw new Error('Barcode and text do not fit. Reduce the barcode height or font sizes, or increase label height.');
  }
  return pngDataUrl(canvas);
}
