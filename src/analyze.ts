import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { NormalizedRule } from './types.js';

export type Severity = 'info' | 'warning' | 'error';

export type AnalysisFinding = {
  severity: Severity;
  code: string;
  message: string;
};

export type RuleAnalysis = {
  findings: AnalysisFinding[];
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

function addFinding(findings: AnalysisFinding[], severity: Severity, code: string, message: string) {
  findings.push({ severity, code, message });
}

function escapeRegex(value: string) {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob: string) {
  let pattern = '^';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        pattern += '.*';
        i++;
      } else {
        pattern += '[^/]*';
      }
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += escapeRegex(char);
    }
  }
  return new RegExp(`${pattern}$`);
}

async function collectRepositoryFiles(root: string) {
  const files: string[] = [];
  const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage', '.rulebridge']);

  async function walk(relativeDir: string) {
    const absoluteDir = path.join(root, relativeDir);
    let entries;
    try {
      entries = await readdir(absoluteDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && ignored.has(entry.name)) continue;
      const relativePath = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name).replace(/^\.\//, '');
      if (entry.isDirectory()) await walk(relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }

  await walk('.');
  return files;
}

function extractPathReferences(content: string) {
  const references = new Set<string>();
  const backticks = content.matchAll(/`([^`\n]+)`/g);
  for (const match of backticks) {
    const value = match[1].trim().replace(/^\.\//, '');
    if (
      value.includes('/') &&
      !value.includes(' ') &&
      !value.startsWith('http') &&
      !value.startsWith('npm ') &&
      !value.startsWith('pnpm ') &&
      !value.startsWith('yarn ') &&
      !value.startsWith('bun ')
    ) {
      references.add(value);
    }
  }
  return [...references];
}

function normalizeDirective(content: string) {
  return content
    .toLowerCase()
    .replace(/\b(do not|don't|never|avoid|must not|should not)\b/g, 'NEGATE')
    .replace(/\b(always|must|should|use|prefer|enable|require)\b/g, 'AFFIRM')
    .replace(/[^a-z0-9_./*-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function polarity(content: string): 'positive' | 'negative' | 'neutral' {
  const lower = content.toLowerCase();
  if (/\b(do not|don't|never|avoid|must not|should not|disable)\b/.test(lower)) return 'negative';
  if (/\b(always|must|should|use|prefer|enable|require)\b/.test(lower)) return 'positive';
  return 'neutral';
}

function directiveSubject(content: string) {
  return normalizeDirective(content)
    .replace(/\b(NEGATE|AFFIRM)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectChoiceConflicts(rules: NormalizedRule[], findings: AnalysisFinding[]) {
  const categories = [
    { name: 'package manager', values: ['npm', 'pnpm', 'yarn', 'bun'] },
    { name: 'test framework', values: ['jest', 'vitest', 'mocha', 'ava'] },
    { name: 'formatter', values: ['prettier', 'biome', 'dprint'] },
    { name: 'linter', values: ['eslint', 'biome', 'standardjs'] },
  ];

  for (const category of categories) {
    const byAgent = new Map<string, Set<string>>();
    for (const rule of rules) {
      const lower = rule.content.toLowerCase();
      const found = new Set(category.values.filter((value) => new RegExp(`\\b${escapeRegex(value)}\\b`, 'i').test(lower)));
      if (found.size) byAgent.set(rule.sourceAgent, found);
    }
    const choices = new Set([...byAgent.values()].flatMap((set) => [...set]));
    if (choices.size > 1 && byAgent.size > 1) {
      addFinding(
        findings,
        'error',
        `conflict.${category.name.replaceAll(' ', '_')}`,
        [`Conflicting ${category.name} instructions`, ...[...byAgent].map(([agent, values]) => `  ${agent.padEnd(7)} ${[...values].join(', ')}`)].join('\n'),
      );
    }
  }
}

export async function analyzeRules(rules: NormalizedRule[], root?: string): Promise<RuleAnalysis> {
  const findings: AnalysisFinding[] = [];
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
    const paths = [...new Set(group.map((rule) => rule.sourcePath))];
    const scopes = [...new Set(group.map(scopeKey))];

    if (agents.length === 1 && paths.length > 1) {
      addFinding(
        findings,
        'warning',
        'duplicate.same_agent',
        `Duplicate rule in ${agents[0]}: ${short(group[0].content)}\n  ${paths.join('\n  ')}`,
      );
    } else if (agents.length > 1 && scopes.length > 1) {
      addFinding(
        findings,
        'warning',
        'scope.drift',
        [`Same instruction, different scope: ${short(group[0].content)}`, ...group.map((rule) => `  ${rule.sourceAgent.padEnd(7)} ${scopeKey(rule)}`)].join('\n'),
      );
    } else if (agents.length > 1) {
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
      addFinding(findings, 'info', 'coverage.agent_only', `${rule.sourceAgent} only: ${short(rule.content)} (${rule.sourcePath})`);
    }
  }

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const left = rules[i];
      const right = rules[j];
      if (left.sourceAgent === right.sourceAgent) continue;
      const leftPolarity = polarity(left.content);
      const rightPolarity = polarity(right.content);
      if (leftPolarity === 'neutral' || rightPolarity === 'neutral' || leftPolarity === rightPolarity) continue;
      const leftSubject = directiveSubject(left.content);
      const rightSubject = directiveSubject(right.content);
      if (leftSubject && leftSubject === rightSubject) {
        addFinding(
          findings,
          'error',
          'conflict.opposite_instruction',
          `Opposite instructions detected\n  ${left.sourceAgent.padEnd(7)} ${short(left.content)}\n  ${right.sourceAgent.padEnd(7)} ${short(right.content)}`,
        );
      }
    }
  }

  detectChoiceConflicts(rules, findings);

  if (root) {
    const files = await collectRepositoryFiles(root);
    const fileSet = new Set(files);
    for (const rule of rules) {
      for (const glob of rule.scope?.globs ?? []) {
        const matches = files.some((file) => globToRegex(glob.replace(/^\.\//, '')).test(file));
        if (!matches) {
          addFinding(findings, 'warning', 'path.stale_scope', `Scope pattern matches no files: ${glob} (${rule.sourcePath})`);
        }
      }
      for (const reference of extractPathReferences(rule.content)) {
        if (reference.includes('*') || reference.includes('?')) {
          const matches = files.some((file) => globToRegex(reference).test(file));
          if (!matches) addFinding(findings, 'warning', 'path.stale_reference', `Referenced path matches no files: ${reference} (${rule.sourcePath})`);
        } else if (!fileSet.has(reference)) {
          addFinding(findings, 'warning', 'path.stale_reference', `Referenced file does not exist: ${reference} (${rule.sourcePath})`);
        }
      }
    }
  }

  const unique = new Map<string, AnalysisFinding>();
  for (const finding of findings) unique.set(`${finding.code}\0${finding.message}`, finding);
  return { findings: [...unique.values()], consistent };
}
