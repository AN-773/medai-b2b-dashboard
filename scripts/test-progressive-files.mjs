import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Use the existing TypeScript compiler and Node runner: no added dependencies.
const output = mkdtempSync(join(tmpdir(), 'medai-progressive-tests-'));
try {
  const compile = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '-p', 'tsconfig.progressive-tests.json', '--outDir', output,
  ], { stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
    const test = spawnSync(process.execPath, ['--test', join(output, 'tests/progressive-files.test.js')], { stdio: 'inherit' });
    process.exitCode = test.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
