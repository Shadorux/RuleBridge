import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'demo', 'fixture');
const cli = path.join(root, 'dist', 'cli.js');

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: fixture,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

console.log(`Running RuleBridge against ${path.relative(root, fixture)} (read-only demo)`);
const checkStatus = run(['check']);
if (checkStatus !== 1) {
  throw new Error(`Expected the contradictory fixture to fail check with status 1; received ${checkStatus}.`);
}

const dryRunStatus = run(['fix', '--dry-run']);
if (dryRunStatus !== 0) {
  throw new Error(`Expected fix --dry-run to succeed with status 0; received ${dryRunStatus}.`);
}

console.log('Demo complete. The fixture was not modified.');
