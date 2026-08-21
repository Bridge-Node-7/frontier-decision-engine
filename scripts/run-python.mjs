import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function pythonCandidates(platform = process.platform) {
  const windows = [
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
    { command: 'python3', prefix: [] },
  ];
  const posix = [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ];
  return platform === 'win32' ? windows : posix;
}

export function resolvePython({ platform = process.platform, spawn = spawnSync } = {}) {
  for (const candidate of pythonCandidates(platform)) {
    const result = spawn(candidate.command, [...candidate.prefix, '--version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status === 0) return candidate;
  }
  return null;
}

export function runPython(args, options = {}) {
  if (!args.length) {
    process.stderr.write('Usage: node scripts/run-python.mjs <script-or-module-arguments...>\n');
    return 2;
  }
  const candidate = resolvePython(options);
  if (!candidate) {
    process.stderr.write('Python 3 was not found. Install Python 3.11+ and expose python3, python, or py -3.\n');
    return 1;
  }
  const result = (options.spawn || spawnSync)(candidate.command, [...candidate.prefix, ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`Unable to run Python: ${result.error.message}\n`);
    return 1;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = runPython(process.argv.slice(2));
