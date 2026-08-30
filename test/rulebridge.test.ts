import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkRules } from '../src/commands/check.js';
import { diffRules } from '../src/commands/diff.js';
import { fixRules } from '../src/commands/fix.js';
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

async function readOptional(filePath: string) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function captureOutput(run: () => Promise<void>) {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  try {
    await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
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
    await captureOutput(() => importRules(root));
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
    await captureOutput(() => importRules(root));
    const output = await captureOutput(() => diffRules(root));

    assert.match(output, /Same instruction, different scope/);
    assert.match(output, /Potential package-manager conflict/);
    assert.match(output, /claude only:/);
    assert.match(output, /warning/);
  });
});

test('check returns a failing exit code when rule drift exists', async () => {
  await withFixture(async (root) => {
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      const output = await captureOutput(() => checkRules(root));
      assert.equal(process.exitCode, 1);
      assert.match(output, /RuleBridge check failed/);
      assert.match(output, /Potential package-manager conflict/);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});

test('fix dry-run plans changes without writing files', async () => {
  await withFixture(async (root) => {
    const beforeClaude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
    const output = await captureOutput(() => fixRules(root, { dryRun: true }));

    assert.match(output, /Dry run only/);
    assert.equal(await readOptional(path.join(root, 'AGENTS.md')), undefined);
    assert.equal(await readFile(path.join(root, 'CLAUDE.md'), 'utf8'), beforeClaude);
  });
});

test('fix preserves handwritten content and generates native rule files', async () => {
  await withFixture(async (root) => {
    const beforeClaude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
    await captureOutput(() => fixRules(root));

    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    const claude = await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
    assert.match(agents, /rulebridge:start/);
    assert.ok(claude.includes(beforeClaude.trim()));
    assert.match(claude, /rulebridge:start/);

    const sources = await discoverRuleSources(root);
    const generatedCursor = sources.filter((source) => source.relativePath.includes('rulebridge-') && source.agent === 'cursor');
    const generatedCopilot = sources.filter((source) => source.relativePath.includes('rulebridge-') && source.agent === 'copilot');
    assert.ok(generatedCursor.length >= 4);
    assert.ok(generatedCopilot.length >= 4);

    const firstPass = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    await captureOutput(() => fixRules(root));
    const secondPass = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    assert.equal(secondPass, firstPass);
  });
});
