# RuleBridge

**ESLint for your AI coding-agent instructions.**

Detect contradictions and drift across `AGENTS.md`, `CLAUDE.md`, Cursor rules, and GitHub Copilot instructions—then safely reconcile them without destroying handwritten content.

## Install

```bash
npx @shadorux/rulebridge check
```

Or install the `rulebridge` command in a project:

```bash
npm install -D @shadorux/rulebridge
npx rulebridge check
```

## A real conflict

Three agents can quietly tell the same coding agent to use different package managers:

```text
.cursor/rules/typescript.mdc             → globs: src/**/*.ts
.github/instructions/ts.instructions.md  → applyTo: **/*.ts
CLAUDE.md                                → use pnpm
AGENTS.md                                → use npm
.github/copilot-instructions.md          → use yarn
```

Run the check from the repository root:

```text
$ npx rulebridge check
RuleBridge check

✖ [error] Conflicting package manager instructions: npm, pnpm, and yarn.
⚠ [warning] Same instruction, different scope: Use TypeScript strict mode.

RuleBridge check failed: 1 error and 1 warning found.
```

When you are ready to reconcile the instruction set, preview the safe plan first:

```bash
npx rulebridge fix --dry-run
```

RuleBridge creates native, ownership-marked outputs for each agent and preserves handwritten source files. Nothing is written during a dry run.

## CLI

```bash
rulebridge inspect             # find instruction files
rulebridge import              # write .rulebridge/rules.json
rulebridge diff                # inspect semantic drift
rulebridge check               # CI-friendly warnings/errors gate
rulebridge fix --dry-run       # show safe creates, updates, and cleanup
rulebridge fix                 # apply only RuleBridge-owned changes
```

`check` exits with code 1 for warnings or errors; informational findings do not block CI.

## Supported agents

| Agent | Handwritten inputs | Generated output |
| --- | --- | --- |
| Codex | `AGENTS.md` | managed section in `AGENTS.md` |
| Claude Code | `CLAUDE.md` | managed section in `CLAUDE.md` |
| Cursor | `.cursorrules`, `.cursor/rules/**/*.mdc` | `.cursor/rules/rulebridge-<id>.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md` | `.github/instructions/rulebridge-<id>.instructions.md` |

## Safety guarantees

- Handwritten `AGENTS.md` and `CLAUDE.md` content stays outside a marked managed block.
- Cursor and Copilot output is written to separate, ownership-marked files.
- A generated-path file without a RuleBridge marker is never overwritten or deleted.
- `.rulebridge/generated-files.json` records exactly which generated Cursor/Copilot files RuleBridge owns; stale owned files are cleaned up, including visibly in `--dry-run`.
- Generated output is ignored during later discovery, and repeated `fix` runs are idempotent.

## Why not just copy files?

The formats are not interchangeable. Cursor uses `globs` and `alwaysApply`; Copilot uses `applyTo`; Codex and Claude primarily use project Markdown. RuleBridge normalizes those choices, preserves them where each format supports them, and flags meaningful contradictions such as different package managers, test frameworks, formatters, linters, stale paths, duplicate rules, and opposite directives.

## Demo

Run the reproducible contradiction fixture locally:

```bash
npm run demo
```

It runs `check` and `fix --dry-run` against `demo/fixture`, without changing the fixture or your repository. The fixture contains contradictory npm, pnpm, and yarn instructions.

For a short animated terminal recording, install [VHS](https://github.com/charmbracelet/vhs) and run:

```bash
vhs scripts/demo.tape
```

The tape writes `demo/rulebridge-demo.gif`.

## Roadmap

- Gemini CLI support
- Windsurf support
- GitHub Action for pull-request checks
- Additional semantic conflict detectors

## Compared with basic sync tools

File-sync tools are excellent when files are intended to be identical. RuleBridge is for agent configurations that have different native formats and may contain agent-specific, handwritten content. It gives you a semantic comparison plus a conservative generated layer instead of treating every file as disposable.

## Terminal demo

```console
$ rulebridge check
RuleBridge check

⚠ [warning] Same instruction, different scope: Use TypeScript strict mode.
✖ [error] Conflicting package manager instructions

RuleBridge check failed: 1 error and 1 warning found.

$ rulebridge fix --dry-run
· update AGENTS.md
· create .cursor/rules/rulebridge-a1b2c3d4.mdc
· delete .github/instructions/rulebridge-stale.instructions.md
Dry run only. 3 file operations planned; nothing was written.
```

## Development

Requires Node.js 20+.

```bash
npm ci
npm run verify
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE)
