import { discoverRuleSources } from '../discovery.js';

export async function inspectRules(root: string) {
  console.log('RuleBridge inspect\n');

  const sources = await discoverRuleSources(root);
  const agents = [
    { id: 'codex', name: 'Codex' },
    { id: 'claude', name: 'Claude Code' },
    { id: 'cursor', name: 'Cursor' },
    { id: 'copilot', name: 'GitHub Copilot' },
  ] as const;

  for (const agent of agents) {
    const matches = sources
      .filter((source) => source.agent === agent.id)
      .map((source) => source.relativePath);

    if (matches.length > 0) {
      console.log(`✓ ${agent.name}: ${matches.join(', ')}`);
    } else {
      console.log(`· ${agent.name}: no rules detected`);
    }
  }

  console.log(`\n${sources.length} rule source${sources.length === 1 ? '' : 's'} detected.`);
}
