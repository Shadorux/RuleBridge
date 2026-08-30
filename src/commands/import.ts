import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverRuleSources } from '../discovery.js';
import { parseRuleSource } from '../parsers.js';
import type { ImportedRules } from '../types.js';

export async function importRules(root: string) {
  const sources = await discoverRuleSources(root);

  if (sources.length === 0) {
    console.log('RuleBridge import\n\nNo supported coding-agent rule files found.');
    return;
  }

  const parsed = await Promise.all(sources.map((source) => parseRuleSource(root, source)));
  const rules = parsed.filter((rule) => rule.content.trim().length > 0);

  if (rules.length === 0) {
    console.log('RuleBridge import\n\nNo handwritten rules remain outside RuleBridge-managed sections.');
    return;
  }

  const output: ImportedRules = {
    version: 1,
    generatedAt: new Date().toISOString(),
    root: '.',
    rules,
  };

  const outputDir = path.join(root, '.rulebridge');
  const outputPath = path.join(outputDir, 'rules.json');
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('RuleBridge import\n');
  for (const rule of rules) {
    const scope = rule.scope?.globs.length ? ` [${rule.scope.globs.join(', ')}]` : '';
    console.log(`✓ ${rule.sourceAgent.padEnd(7)} ${rule.sourcePath}${scope}`);
  }
  console.log(`\nImported ${rules.length} rule source${rules.length === 1 ? '' : 's'} into .rulebridge/rules.json.`);
}
