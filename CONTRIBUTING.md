# Contributing to RuleBridge

Thanks for helping make coding-agent rules safer to maintain.

## Setup

Use Node.js 20 or later, then run:

```bash
npm ci
npm run verify
```

## Development guidelines

- Keep changes small and dependency-light.
- Preserve handwritten configuration; generated files must have RuleBridge ownership markers.
- Add or update fixture-based tests for parsing, analysis, and generated output behavior.
- Run `npm run verify` before opening a pull request.

## Good first contributions

- Add unit tests for brace-expanded or negated glob handling.
- Improve frontmatter diagnostics without changing the safe fallback behavior.
- Add a `rulebridge init` command that creates a minimal example configuration.
- Add support for another documented agent-rule format with fixtures and safety tests.
- Improve wording or coverage of analysis findings.

Please open an issue first for larger format or behavior changes so the safety model stays deliberate.
