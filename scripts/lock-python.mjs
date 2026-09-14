import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const inputs = ['python/requirements.txt', 'python/requirements-extract.txt', 'python/build-requirements.txt'];
const digest = createHash('sha256');
for (const file of inputs) digest.update(file).update('\0').update(fs.readFileSync(file)).update('\0');
const stamp = `# requirements-sha256: ${digest.digest('hex')}`;
const output = 'python/constraints.txt';
if (process.argv.includes('--check')) {
  if (!fs.readFileSync(output, 'utf8').split('\n').includes(stamp)) {
    throw new Error('Python dependency inputs changed. Run pnpm lock:python and review the resolution.');
  }
} else {
  execFileSync('uv', ['pip', 'compile', ...inputs, '--python-version', '3.13', '--universal',
    '--no-annotate', '--output-file', output, '--custom-compile-command', 'pnpm lock:python'], { stdio: 'inherit' });
  fs.appendFileSync(output, `\n${stamp}\n`);
}
