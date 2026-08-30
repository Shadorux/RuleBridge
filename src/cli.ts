#!/usr/bin/env node

import { diffRules } from './commands/diff.js';
import { importRules } from './commands/import.js';
import { inspectRules } from './commands/inspect.js';

const command = process.argv[2] ?? 'help';

async function main() {
  switch (command) {
    case 'inspect':
      await inspectRules(process.cwd());
      break;
    case 'import':
      await importRules(process.cwd());
      break;
    case 'diff':
      await diffRules(process.cwd());
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    case '--version':
    case '-v':
      console.log('0.1.0');
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`RuleBridge — make your AI coding rules work everywhere.\n\nUsage:\n  rulebridge inspect\n  rulebridge import\n  rulebridge diff\n\nCommands:\n  inspect   Discover AI coding-rule files in the current repository\n  import    Normalize detected rule files into .rulebridge/rules.json\n  diff      Compare normalized rules across coding agents\n\nComing next:\n  fix       Generate compatible native configurations\n  check     CI-friendly consistency validation\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
