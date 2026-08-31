# RuleBridge

**One rule set. Native instructions for every coding agent.**

RuleBridge is a local-first TypeScript CLI that inspects, compares, and safely translates project instructions between Codex, Claude Code, Cursor, and GitHub Copilot. It translates scope semantics instead of blindly copying Markdown, and it never silently replaces handwritten configuration.

## Before / after

Before, a project can drift into several slightly different rule files:

```text
.cursor/rules/typescript.mdc             → globs: src/**/*.ts
.github/instructions/ts.instructions.md  → applyTo: **/*.ts
CLAUDE.md                                → use pnpm
```

After `rulebridge check`, drift is explicit. After `rulebridge fix`, each agent gets native RuleBridge-owned output while the original handwritten files remain intact.

```text
AGENTS.md                                      + managed section
CLAUDE.md                                      + managed section
.cursor/rules/rulebridge-<id>.mdc             + native Cursor rule
.github/instructions/rulebridge-<id>.instructions.md + native Copilot rule
```

## Install

```bash
npm install -D @shadorux/rulebridge
# or, before publishing: npm install -D ./rulebridge-0.1.0.tgz
```

The unscoped `rulebridge` package name is already owned on npm. This package uses the available scoped name `@shadorux/rulebridge` while keeping the `rulebridge` CLI command.

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

## Supported formats

| Agent | Handwritten inputs | Generated output |
| --- | --- | --- |
| Codex | `AGENTS.md` | managed section in `AGENTS.md` |
| Claude Code | `CLAUDE.md` | managed section in `CLAUDE.md` |
| Cursor | `.cursorrules`, `.cursor/rules/**/*.mdc` | `.cursor/rules/rulebridge-<id>.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md` | `.github/instructions/rulebridge-<id>.instructions.md` |

## Safety model

- Handwritten `AGENTS.md` and `CLAUDE.md` content stays outside a marked managed block.
- Cursor and Copilot output is written to separate, ownership-marked files.
- A generated-path file without a RuleBridge marker is never overwritten or deleted.
- `.rulebridge/generated-files.json` records exactly which generated Cursor/Copilot files RuleBridge owns; stale owned files are cleaned up, including visibly in `--dry-run`.
- Generated output is ignored during later discovery, and repeated `fix` runs are idempotent.

## Why not just copy files?

The formats are not interchangeable. Cursor uses `globs` and `alwaysApply`; Copilot uses `applyTo`; Codex and Claude primarily use project Markdown. RuleBridge normalizes those choices, preserves them where each format supports them, and flags meaningful contradictions such as different package managers, test frameworks, formatters, linters, stale paths, duplicate rules, and opposite directives.

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
