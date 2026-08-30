import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImportedRules, NormalizedRule } from '../types.js';

function canonicalContent(content: string) {
  return content
    .toLowerCase()
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scopeKey(rule: NormalizedRule) {
  if (rule.alwaysApply || !rule.scope?.globs.length) return '*';
  return [...rule.scope.globs].sort().join(',');
}

function short(text: string, max = 72) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

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

  const groups = new Map<string, NormalizedRule[]>();
  for (const rule of imported.rules) {
    const key = canonicalContent(rule.content);
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
  }

  let warnings = 0;
  let consistent = 0;

  for (const rules of groups.values()) {
    if (rules.length < 2) continue;
    const agents = [...new Set(rules.map((rule) => rule.sourceAgent))];
    if (agents.length < 2) continue;

    const scopes = [...new Set(rules.map(scopeKey))];
    if (scopes.length > 1) {
      warnings++;
      console.log(`⚠ Same instruction, different scope: ${short(rules[0].content)}`);
      for (const rule of rules) console.log(`  ${rule.sourceAgent.padEnd(7)} ${scopeKey(rule)}`);
    } else {
      consistent++;
      console.log(`✓ Shared rule consistent across ${agents.length} agents: ${short(rules[0].content)}`);
    }
  }

  const byAgent = new Map<string, NormalizedRule[]>();
  for (const rule of imported.rules) {
    const list = byAgent.get(rule.sourceAgent) ?? [];
    list.push(rule);
    byAgent.set(rule.sourceAgent, list);
  }

  for (const rule of imported.rules) {
    const key = canonicalContent(rule.content);
    const appearsElsewhere = imported.rules.some(
      (other) => other.sourceAgent !== rule.sourceAgent && canonicalContent(other.content) === key,
    );
    if (!appearsElsewhere && byAgent.size > 1) {
      warnings++;
      console.log(`⚠ ${rule.sourceAgent} only: ${short(rule.content)} (${rule.sourcePath})`);
    }
  }

  const packageManagerPattern = /\b(npm|pnpm|yarn|bun)\b/gi;
  const managers = new Map<string, Set<string>>();
  for (const rule of imported.rules) {
    const found = new Set((rule.content.match(packageManagerPattern) ?? []).map((value) => value.toLowerCase()));
    if (found.size) managers.set(rule.sourceAgent, found);
  }
  const allManagers = new Set([...managers.values()].flatMap((set) => [...set]));
  if (allManagers.size > 1 && managers.size > 1) {
    warnings++;
    console.log('⚠ Potential package-manager conflict');
    for (const [agent, values] of managers) console.log(`  ${agent.padEnd(7)} ${[...values].join(', ')}`);
  }

  if (warnings === 0 && consistent === 0) console.log('No comparable cross-agent rules found yet.');
  console.log(`\n${warnings} warning${warnings === 1 ? '' : 's'}, ${consistent} consistent shared rule${consistent === 1 ? '' : 's'}.`);
}
