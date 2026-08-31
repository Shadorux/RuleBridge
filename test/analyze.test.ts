import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { analyzeRules } from '../src/analyze.js';
import type { NormalizedRule } from '../src/types.js';

function rule(overrides: Partial<NormalizedRule>): NormalizedRule {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    sourceAgent: overrides.sourceAgent ?? 'cursor',
    sourcePath: overrides.sourcePath ?? '.cursor/rules/test.mdc',
    alwaysApply: overrides.alwaysApply ?? true,
    content: overrides.content ?? 'Use TypeScript.',
    ...overrides,
  };
}

test('detects duplicate rules inside one agent', async () => {
  const analysis = await analyzeRules([
    rule({ sourceAgent: 'cursor', sourcePath: '.cursor/rules/a.mdc', content: 'Use TypeScript strict mode.' }),
    rule({ sourceAgent: 'cursor', sourcePath: '.cursor/rules/b.mdc', content: 'Use TypeScript strict mode.' }),
  ]);

  assert.ok(analysis.findings.some((finding) => finding.code === 'duplicate.same_agent' && finding.severity === 'warning'));
});

test('detects opposite instructions across agents', async () => {
  const analysis = await analyzeRules([
    rule({ sourceAgent: 'cursor', content: 'Use Prettier.' }),
    rule({ sourceAgent: 'claude', sourcePath: 'CLAUDE.md', content: 'Never use Prettier.' }),
  ]);

  assert.ok(analysis.findings.some((finding) => finding.code === 'conflict.opposite_instruction' && finding.severity === 'error'));
});

test('detects tool-choice conflicts beyond package managers', async () => {
  const analysis = await analyzeRules([
    rule({ sourceAgent: 'cursor', content: 'Use Jest for tests.' }),
    rule({ sourceAgent: 'copilot', sourcePath: '.github/copilot-instructions.md', content: 'Use Vitest for tests.' }),
  ]);

  assert.ok(analysis.findings.some((finding) => finding.code === 'conflict.test_framework' && finding.severity === 'error'));
});

test('detects stale scopes and referenced file paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rulebridge-analysis-'));
  try {
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src/index.ts'), 'export {};\n');

    const analysis = await analyzeRules(
      [
        rule({
          sourceAgent: 'cursor',
          scope: { globs: ['missing/**/*.ts'] },
          alwaysApply: false,
          content: 'Keep `src/missing.ts` updated.',
        }),
        rule({ sourceAgent: 'claude', sourcePath: 'CLAUDE.md', content: 'Use TypeScript.' }),
      ],
      root,
    );

    assert.ok(analysis.findings.some((finding) => finding.code === 'path.stale_scope'));
    assert.ok(analysis.findings.some((finding) => finding.code === 'path.stale_reference'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('agent-only rules are informational rather than blocking by themselves', async () => {
  const analysis = await analyzeRules([
    rule({ sourceAgent: 'cursor', content: 'Prefer named exports.' }),
    rule({ sourceAgent: 'claude', sourcePath: 'CLAUDE.md', content: 'Keep functions small.' }),
  ]);

  const agentOnly = analysis.findings.filter((finding) => finding.code === 'coverage.agent_only');
  assert.equal(agentOnly.length, 2);
  assert.ok(agentOnly.every((finding) => finding.severity === 'info'));
});
