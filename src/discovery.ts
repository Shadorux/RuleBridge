import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AgentId } from './types.js';

export type DiscoveredRuleSource = {
  agent: AgentId;
  displayName: string;
  relativePath: string;
};

async function exists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root: string, relativeDir: string, predicate: (name: string) => boolean) {
  const absoluteDir = path.join(root, relativeDir);
  if (!(await exists(absoluteDir))) return [];

  const info = await stat(absoluteDir);
  if (!info.isDirectory()) return [];

  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, relativePath, predicate)));
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function isGeneratedName(name: string) {
  return name.startsWith('rulebridge-');
}

export async function discoverRuleSources(root: string): Promise<DiscoveredRuleSource[]> {
  const sources: DiscoveredRuleSource[] = [];

  const addFile = async (agent: AgentId, displayName: string, relativePath: string) => {
    if (await exists(path.join(root, relativePath))) {
      sources.push({ agent, displayName, relativePath });
    }
  };

  await addFile('codex', 'Codex', 'AGENTS.md');
  await addFile('claude', 'Claude Code', 'CLAUDE.md');
  await addFile('cursor', 'Cursor', '.cursorrules');
  await addFile('copilot', 'GitHub Copilot', '.github/copilot-instructions.md');

  for (const relativePath of await collectFiles(
    root,
    '.cursor/rules',
    (name) => !isGeneratedName(name) && (name.endsWith('.mdc') || name.endsWith('.md')),
  )) {
    sources.push({ agent: 'cursor', displayName: 'Cursor', relativePath });
  }

  for (const relativePath of await collectFiles(
    root,
    '.github/instructions',
    (name) => !isGeneratedName(name) && (name.endsWith('.instructions.md') || name.endsWith('.md')),
  )) {
    sources.push({ agent: 'copilot', displayName: 'GitHub Copilot', relativePath });
  }

  // AGENTS.md is also consumed by some tools besides Codex. Keep one canonical
  // source entry to avoid importing identical content multiple times.
  return sources.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
