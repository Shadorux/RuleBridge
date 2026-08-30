import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { diffRules } from '../src/commands/diff.js';
import { importRules } from '../src/commands/import.js';
import { discoverRuleSources } from '../src/discovery.js';
import type { ImportedRules } from '../src/types.js';

const fixtureRoot = path.resolve('test/fixtures/mismatch');

async function withFixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rulebridge-'));
  await cp(fixtureRoot, root, { recursive: true });
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function captureLogs(run: () => Promise<void>) {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  try {
    await run();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

test('discovers Claude, Cursor, and Copilot rule sources', async () => {
  const sources = await discoverRuleSources(fixtureRoot);
  assert.equal(sources.length, 4);
  assert.deepEqual(
    sources.map((source) => source.relativePath),
    [
      '.cursor/rules/typescript.mdc',
      '.github/copilot-instructions.md',
      '.github/instructions/typescript.instructions.md',
      'CLAUDE.md',
    ],
  );
});

test('import preserves agent-specific scope semantics', async () => {
  await withFixture(async (root) => {
    await captureLogs(() => importRules(root));
    const imported = JSON.parse(
      await readFile(path.join(root, '.rulebridge/rules.json'), 'utf8'),
    ) as ImportedRules;

    const cursor = imported.rules.find((rule) => rule.sourceAgent === 'cursor');
    const copilotScoped = imported.rules.find(
      (rule) => rule.sourcePath.endsWith('typescript.instructions.md'),
    );

    assert.deepEqual(cursor?.scope?.globs, ['src/**/*.ts']);
    assert.deepEqual(copilotScoped?.scope?.globs, ['**/*.ts']);
    assert.equal(cursor?.alwaysApply, false);
  });
});

test('diff detects scope drift, unique rules, and package-manager conflicts', async () => {
  await withFixture(async (root) => {
    await captureLogs(() => importRules(root));
    const output = await captureLogs(() => diffRules(root));

    assert.match(output, /Same instruction, different scope/);
    assert.match(output, /Potential package-manager conflict/);
    assert.match(output, /claude only:/);
    assert.match(output, /warning/);
  });
});
