import { analyzeRules } from '../analyze.js';
import { discoverRuleSources } from '../discovery.js';
import { parseRuleSource } from '../parsers.js';

const ICONS = { info: 'ℹ', warning: '⚠', error: '✖' } as const;

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

  const analysis = await analyzeRules(rules, root);

  for (const item of analysis.consistent) console.log(`✓ ${item}`);
  for (const finding of analysis.findings) {
    console.log(`${ICONS[finding.severity]} [${finding.severity}] ${finding.message}`);
  }

  const errors = analysis.findings.filter((finding) => finding.severity === 'error').length;
  const warnings = analysis.findings.filter((finding) => finding.severity === 'warning').length;

  if (errors > 0 || warnings > 0) {
    console.error(
      `\nRuleBridge check failed: ${errors} error${errors === 1 ? '' : 's'} and ${warnings} warning${warnings === 1 ? '' : 's'} found.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nRuleBridge check passed: ${analysis.consistent.length} shared rule${analysis.consistent.length === 1 ? '' : 's'} consistent.`);
}
