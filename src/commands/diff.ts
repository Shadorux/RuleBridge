import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { analyzeRules } from '../analyze.js';
import type { ImportedRules } from '../types.js';

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

  const analysis = analyzeRules(imported.rules);
  for (const item of analysis.consistent) console.log(`✓ ${item}`);
  for (const item of analysis.warnings) console.log(`⚠ ${item}`);

  if (analysis.warnings.length === 0 && analysis.consistent.length === 0) {
    console.log('No comparable cross-agent rules found yet.');
  }

  console.log(
    `\n${analysis.warnings.length} warning${analysis.warnings.length === 1 ? '' : 's'}, ` +
      `${analysis.consistent.length} consistent shared rule${analysis.consistent.length === 1 ? '' : 's'}.`,
  );
}
