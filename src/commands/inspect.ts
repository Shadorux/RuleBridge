import { access } from 'node:fs/promises';
import path from 'node:path';

type AgentRuleTarget = {
  agent: string;
  paths: string[];
};

const TARGETS: AgentRuleTarget[] = [
  { agent: 'Codex', paths: ['AGENTS.md'] },
  { agent: 'Claude Code', paths: ['CLAUDE.md'] },
  { agent: 'Cursor', paths: ['.cursor/rules', '.cursorrules', 'AGENTS.md'] },
  { agent: 'GitHub Copilot', paths: ['.github/copilot-instructions.md', '.github/instructions', 'AGENTS.md'] },
];

async function exists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function inspectRules(root: string) {
  console.log('RuleBridge inspect\n');

  let found = 0;

  for (const target of TARGETS) {
    const matches: string[] = [];

    for (const relativePath of target.paths) {
      if (await exists(path.join(root, relativePath))) {
        matches.push(relativePath);
      }
    }

    if (matches.length > 0) {
      found += matches.length;
      console.log(`✓ ${target.agent}: ${matches.join(', ')}`);
    } else {
      console.log(`· ${target.agent}: no rules detected`);
    }
  }

  console.log(`\n${found} rule source${found === 1 ? '' : 's'} detected.`);
}
