import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeRules } from '../analyze.js';
import type { ImportedRules } from '../types.js';

const ICONS = { info: 'ℹ', warning: '⚠', error: '✖' } as const;

export async function diffRules(root: string) {
  const inputPath = path.join(root, '.rulebridge', 'rules.json');
  let imported: ImportedRules;

  try {
    imported = JSON.parse(await readFile(inputPath, 'utf8')) as ImportedRules;
  } catch {
    console.error('RuleBridge diff\n\nNo .rulebridge/rules.json found. Run `rulebridge import` first.');
    process.exitCode = 1;
    return;
  }

  console.log('RuleBridge diff\n');
  if (imported.rules.length < 2) {
    console.log('Only one rule source is imported. Add another agent configuration to compare.');
    return;
  }

  const analysis = await analyzeRules(imported.rules, root);
  for (const item of analysis.consistent) console.log(`✓ ${item}`);
  for (const finding of analysis.findings) {
    console.log(`${ICONS[finding.severity]} [${finding.severity}] ${finding.message}`);
  }

  if (analysis.findings.length === 0 && analysis.consistent.length === 0) {
    console.log('No comparable cross-agent rules found yet.');
  }

  const counts = { info: 0, warning: 0, error: 0 };
  for (const finding of analysis.findings) counts[finding.severity]++;
  console.log(
    `\n${counts.error} error${counts.error === 1 ? '' : 's'}, ${counts.warning} warning${counts.warning === 1 ? '' : 's'}, ` +
      `${counts.info} info, ${analysis.consistent.length} consistent shared rule${analysis.consistent.length === 1 ? '' : 's'}.`,
  );
}
