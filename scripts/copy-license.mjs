import { copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
await stat(path.join(output, 'index.html'));
await Promise.all([
  copyFile(path.join(root, 'LICENSE'), path.join(output, 'LICENSE.txt')),
  copyFile(path.join(root, 'NOTICE'), path.join(output, 'NOTICE.txt')),
]);
