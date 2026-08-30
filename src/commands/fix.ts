import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverRuleSources } from '../discovery.js';
import {
  isRuleBridgeGenerated,
  renderCopilotRule,
  renderCursorRule,
  renderManagedMarkdown,
} from '../generate.js';
import { parseRuleSource } from '../parsers.js';
import type { NormalizedRule } from '../types.js';

type PlannedWrite = {
  relativePath: string;
  content: string;
  mode: 'create' | 'update';
};

async function readOptional(filePath: string) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function generatedCursorPath(rule: NormalizedRule) {
  return `.cursor/rules/rulebridge-${rule.id}.mdc`;
}

function generatedCopilotPath(rule: NormalizedRule) {
  return `.github/instructions/rulebridge-${rule.id}.instructions.md`;
}

async function planManagedMarkdown(root: string, relativePath: string, rules: NormalizedRule[]): Promise<PlannedWrite> {
  const absolutePath = path.join(root, relativePath);
  const existing = await readOptional(absolutePath);
  return {
    relativePath,
    content: renderManagedMarkdown(existing, rules),
    mode: existing === undefined ? 'create' : 'update',
  };
}

async function planGeneratedFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<PlannedWrite> {
  const absolutePath = path.join(root, relativePath);
  const existing = await readOptional(absolutePath);

  if (existing !== undefined && !isRuleBridgeGenerated(existing)) {
    throw new Error(
      `Refusing to overwrite handwritten file ${relativePath}. Move it or choose a different generated path.`,
    );
  }

  return {
    relativePath,
    content,
    mode: existing === undefined ? 'create' : 'update',
  };
}

export async function fixRules(root: string, options: { dryRun?: boolean } = {}) {
  const sources = await discoverRuleSources(root);
  console.log(`RuleBridge fix${options.dryRun ? ' --dry-run' : ''}\n`);

  if (sources.length === 0) {
    console.log('No supported coding-agent rule files found.');
    return;
  }

  const parsed = await Promise.all(sources.map((source) => parseRuleSource(root, source)));
  const rules = parsed.filter((rule) => rule.content.trim().length > 0);
  if (rules.length === 0) {
    console.log('No handwritten rules remain outside RuleBridge-managed sections.');
    return;
  }

  const plans: PlannedWrite[] = [];
  plans.push(await planManagedMarkdown(root, 'AGENTS.md', rules));
  plans.push(await planManagedMarkdown(root, 'CLAUDE.md', rules));

  for (const rule of rules) {
    plans.push(
      await planGeneratedFile(root, generatedCursorPath(rule), renderCursorRule(rule)),
      await planGeneratedFile(root, generatedCopilotPath(rule), renderCopilotRule(rule)),
    );
  }

  for (const plan of plans) {
    console.log(`${options.dryRun ? '·' : '✓'} ${plan.mode.padEnd(6)} ${plan.relativePath}`);
  }

  if (options.dryRun) {
    console.log(`\nDry run only. ${plans.length} file operation${plans.length === 1 ? '' : 's'} planned; nothing was written.`);
    return;
  }

  for (const plan of plans) {
    const absolutePath = path.join(root, plan.relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, plan.content, 'utf8');
  }

  console.log(
    `\nApplied ${plans.length} safe file operation${plans.length === 1 ? '' : 's'}. Handwritten content outside RuleBridge-managed sections was preserved.`,
  );
}
