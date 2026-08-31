import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
import type { GeneratedFileManifest } from '../types.js';

const MANIFEST_PATH = '.rulebridge/generated-files.json';

type PlannedWrite = {
  relativePath: string;
  content: string;
  mode: 'create' | 'update';
};

type PlannedDelete = {
  relativePath: string;
  mode: 'delete';
};

type PlannedOperation = PlannedWrite | PlannedDelete;

async function readOptional(filePath: string) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function isManagedGeneratedPath(relativePath: string) {
  return (
    (/^\.cursor\/rules\/rulebridge-[^/]+\.mdc$/.test(relativePath)) ||
    (/^\.github\/instructions\/rulebridge-[^/]+\.instructions\.md$/.test(relativePath))
  );
}

async function readManifest(root: string): Promise<GeneratedFileManifest> {
  const raw = await readOptional(path.join(root, MANIFEST_PATH));
  if (!raw) return { version: 1, files: [] };
  try {
    const manifest = JSON.parse(raw) as Partial<GeneratedFileManifest>;
    if (manifest.version === 1 && Array.isArray(manifest.files) && manifest.files.every((file) => typeof file === 'string')) {
      return { version: 1, files: manifest.files.filter(isManagedGeneratedPath) };
    }
  } catch {
    // A malformed manifest must never cause RuleBridge to delete files.
  }
  return { version: 1, files: [] };
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

  const parsed = await Promise.all(sources.map((source) => parseRuleSource(root, source)));
  const rules = parsed.filter((rule) => rule.content.trim().length > 0);

  const plans: PlannedOperation[] = [];
  const desiredGeneratedFiles = new Set<string>();

  if (rules.length > 0) {
    plans.push(await planManagedMarkdown(root, 'AGENTS.md', rules));
    plans.push(await planManagedMarkdown(root, 'CLAUDE.md', rules));

    for (const rule of rules) {
      const cursorPath = generatedCursorPath(rule);
      const copilotPath = generatedCopilotPath(rule);
      desiredGeneratedFiles.add(cursorPath);
      desiredGeneratedFiles.add(copilotPath);
      plans.push(
        await planGeneratedFile(root, cursorPath, renderCursorRule(rule)),
        await planGeneratedFile(root, copilotPath, renderCopilotRule(rule)),
      );
    }
  }

  const manifest = await readManifest(root);
  for (const relativePath of manifest.files) {
    if (desiredGeneratedFiles.has(relativePath)) continue;
    const existing = await readOptional(path.join(root, relativePath));
    if (existing !== undefined && isRuleBridgeGenerated(existing)) {
      plans.push({ relativePath, mode: 'delete' });
    }
  }

  const manifestContent = `${JSON.stringify({ version: 1, files: [...desiredGeneratedFiles].sort() }, null, 2)}\n`;
  const existingManifest = await readOptional(path.join(root, MANIFEST_PATH));
  if (existingManifest !== manifestContent) {
    plans.push({ relativePath: MANIFEST_PATH, content: manifestContent, mode: existingManifest === undefined ? 'create' : 'update' });
  }

  if (plans.length === 0) {
    console.log('No changes needed. Generated files already match the current handwritten rules.');
    return;
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
    if (plan.mode === 'delete') {
      await rm(absolutePath, { force: true });
      continue;
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, plan.content, 'utf8');
  }

  console.log(
    `\nApplied ${plans.length} safe file operation${plans.length === 1 ? '' : 's'}. Handwritten content outside RuleBridge-managed sections was preserved.`,
  );
}
