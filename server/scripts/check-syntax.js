import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) check(filename);
    else if (filename.endsWith('.js')) execFileSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
  }
}
for (const directory of ['src', 'scripts', 'test']) check(path.join(root, directory));
console.log('Backend JavaScript syntax checks passed.');
