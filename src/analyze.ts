import type { NormalizedRule } from './types.js';

export type RuleAnalysis = {
  warnings: string[];
  consistent: string[];
};

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

export function analyzeRules(rules: NormalizedRule[]): RuleAnalysis {
  const warnings: string[] = [];
  const consistent: string[] = [];
  const groups = new Map<string, NormalizedRule[]>();

  for (const rule of rules) {
    const key = canonicalContent(rule.content);
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const agents = [...new Set(group.map((rule) => rule.sourceAgent))];
    if (agents.length < 2) continue;

    const scopes = [...new Set(group.map(scopeKey))];
    if (scopes.length > 1) {
      warnings.push(
        [`Same instruction, different scope: ${short(group[0].content)}`,
          ...group.map((rule) => `  ${rule.sourceAgent.padEnd(7)} ${scopeKey(rule)}`),
        ].join('\n'),
      );
    } else {
      consistent.push(`Shared rule consistent across ${agents.length} agents: ${short(group[0].content)}`);
    }
  }

  const agents = new Set(rules.map((rule) => rule.sourceAgent));
  for (const rule of rules) {
    const key = canonicalContent(rule.content);
    const appearsElsewhere = rules.some(
      (other) => other.sourceAgent !== rule.sourceAgent && canonicalContent(other.content) === key,
    );
    if (!appearsElsewhere && agents.size > 1) {
      warnings.push(`${rule.sourceAgent} only: ${short(rule.content)} (${rule.sourcePath})`);
    }
  }

  const packageManagerPattern = /\b(npm|pnpm|yarn|bun)\b/gi;
  const managers = new Map<string, Set<string>>();
  for (const rule of rules) {
    const found = new Set((rule.content.match(packageManagerPattern) ?? []).map((value) => value.toLowerCase()));
    if (found.size) managers.set(rule.sourceAgent, found);
  }
  const allManagers = new Set([...managers.values()].flatMap((set) => [...set]));
  if (allManagers.size > 1 && managers.size > 1) {
    warnings.push(
      ['Potential package-manager conflict',
        ...[...managers].map(([agent, values]) => `  ${agent.padEnd(7)} ${[...values].join(', ')}`),
      ].join('\n'),
    );
  }

  return { warnings, consistent };
}
