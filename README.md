# RuleBridge

**Make your AI coding rules work everywhere.**

RuleBridge inspects, imports, compares, and translates coding-agent instruction files across Codex, Claude Code, Cursor, and GitHub Copilot.

Instead of blindly copying Markdown between formats, RuleBridge is being built to understand how each agent scopes and structures rules so it can catch drift, conflicts, duplication, and incompatibilities.

## Why RuleBridge?

AI coding agents increasingly use different instruction formats:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/*.mdc`
- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`

Maintaining the same project conventions in several places gets messy fast. RuleBridge aims to make those rules portable and verifiable.

## Quick start

```bash
npm install
npm run build
node dist/cli.js inspect
node dist/cli.js import
```

Or during development:

```bash
npm run dev -- inspect
npm run dev -- import
```

## Commands

### `rulebridge inspect`

Discover coding-agent rule files in the current repository, including individual Cursor and Copilot instruction files.

```text
RuleBridge inspect

✓ Codex: AGENTS.md
✓ Claude Code: CLAUDE.md
✓ Cursor: .cursor/rules/react.mdc
· GitHub Copilot: no rules detected

3 rule sources detected.
```

### `rulebridge import`

Parse detected rule files into RuleBridge's shared normalized model.

```text
RuleBridge import

✓ codex   AGENTS.md
✓ cursor  .cursor/rules/react.mdc [src/**/*.tsx]
✓ copilot .github/instructions/tests.instructions.md [**/*.test.ts]

Imported 3 rule sources into .rulebridge/rules.json.
```

The importer currently preserves:

- source agent and source path
- instruction content
- descriptions
- path scoping from Cursor `globs` and Copilot `applyTo`
- always-apply semantics
- stable content-based rule IDs

`.rulebridge/rules.json` is generated output and is ignored by Git by default.

## Roadmap

- [x] `inspect` — discover existing agent configuration
- [x] `import` — normalize existing rules into a shared model
- [ ] `diff` — compare rule semantics across agents
- [ ] `fix` — generate compatible native configurations
- [ ] `check` — CI-friendly consistency validation
- [ ] conflict and duplicate detection
- [ ] stale file-reference detection
- [ ] preserve agent-specific instructions alongside shared rules

## Supported agents

Initial targets:

- OpenAI Codex
- Claude Code
- Cursor
- GitHub Copilot

## Philosophy

RuleBridge should be local-first, predictable, and safe around hand-written configuration. It should never silently destroy tool-specific rules just to make files look synchronized.

## Development

Requires Node.js 20+.

```bash
npm install
npm run check
npm run build
```

## License

MIT
