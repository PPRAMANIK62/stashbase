import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const python = process.platform === 'win32'
  ? path.join(root, 'python', '.venv.nosync', 'Scripts', 'python.exe')
  : path.join(root, 'python', '.venv.nosync', 'bin', 'python');

if (!fs.existsSync(python)) {
  throw new Error(`Missing Python venv at ${path.relative(root, python)}. Run \`pnpm setup:python\` first.`);
}

execFileSync(python, ['-m', 'unittest', 'discover', '-s', 'python', '-p', '*_test.py'], {
  cwd: root,
  stdio: 'inherit',
});
