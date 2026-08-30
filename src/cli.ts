#!/usr/bin/env node

import { inspectRules } from './commands/inspect.js';

const command = process.argv[2] ?? 'help';

async function main() {
  switch (command) {
    case 'inspect':
      await inspectRules(process.cwd());
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
  console.log(`RuleBridge — make your AI coding rules work everywhere.\n\nUsage:\n  rulebridge inspect\n\nCommands:\n  inspect   Discover AI coding-rule files in the current repository\n\nComing next:\n  import    Normalize existing rule files\n  diff      Compare rule semantics across agents\n  fix       Generate compatible native configurations\n  check     CI-friendly consistency validation\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
