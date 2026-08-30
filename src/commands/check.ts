import { analyzeRules } from '../analyze.js';
import { discoverRuleSources } from '../discovery.js';
import { parseRuleSource } from '../parsers.js';

export async function checkRules(root: string) {
  const sources = await discoverRuleSources(root);
  console.log('RuleBridge check\n');

  if (sources.length < 2) {
    console.log('Need at least two supported agent rule sources to check consistency.');
    return;
  }

  const parsed = await Promise.all(sources.map((source) => parseRuleSource(root, source)));
  const rules = parsed.filter((rule) => rule.content.trim().length > 0);

  if (rules.length < 2) {
    console.log('Need at least two handwritten rule sources outside RuleBridge-managed sections to check consistency.');
    return;
  }

  const analysis = analyzeRules(rules);

  for (const item of analysis.consistent) console.log(`✓ ${item}`);
  for (const item of analysis.warnings) console.log(`⚠ ${item}`);

  if (analysis.warnings.length > 0) {
    console.error(
      `\nRuleBridge check failed: ${analysis.warnings.length} consistency warning${analysis.warnings.length === 1 ? '' : 's'} found.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nRuleBridge check passed: ${analysis.consistent.length} shared rule${analysis.consistent.length === 1 ? '' : 's'} consistent.`);
}
