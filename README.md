# RuleBridge

**Make your AI coding rules work everywhere.**

RuleBridge inspects, imports, compares, checks, and safely translates coding-agent instruction files across Codex, Claude Code, Cursor, and GitHub Copilot.

Instead of blindly copying Markdown between formats, RuleBridge understands path scoping and keeps generated content isolated from handwritten configuration.

## Why RuleBridge?

AI coding agents increasingly use different instruction formats:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/*.mdc`
- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`

Maintaining the same project conventions in several places gets messy fast. RuleBridge makes those rules portable and verifiable.

## Quick start

```bash
npm install
npm run build
node dist/cli.js inspect
node dist/cli.js import
node dist/cli.js diff
node dist/cli.js check
node dist/cli.js fix --dry-run
node dist/cli.js fix
```

## Commands

### `rulebridge inspect`

Discover supported coding-agent rule files in the current repository.

### `rulebridge import`

Normalize detected rule files into `.rulebridge/rules.json`, preserving source agent, source path, descriptions, Cursor `globs`, Copilot `applyTo`, always-apply semantics, and stable IDs.

### `rulebridge diff`

Compare normalized rules and surface cross-agent findings with explicit severity levels:

- `[info]` — useful differences such as agent-only rules that do not block CI by themselves
- `[warning]` — drift that should be reviewed, such as duplicate rules or stale path references
- `[error]` — direct conflicts, such as incompatible tool choices or opposite instructions

Current analysis detects:

- same instruction with different scopes
- duplicate rules inside one agent
- stale scope globs that match no repository files
- stale backticked file/path references
- agent-only coverage differences
- package-manager conflicts (`npm`, `pnpm`, `yarn`, `bun`)
- test-framework conflicts (`Jest`, `Vitest`, `Mocha`, `AVA`)
- formatter conflicts (`Prettier`, `Biome`, `dprint`)
- linter conflicts (`ESLint`, `Biome`, `StandardJS`)
- opposite directives such as `Use X` versus `Never use X`

### `rulebridge check`

Run the same analysis directly against the repository. Informational findings are allowed; warnings and errors return exit code `1`, making RuleBridge usable as a CI or pull-request gate.

```yaml
- run: npx rulebridge check
```

### `rulebridge fix`

Generate native configurations for all four supported agents while protecting handwritten content.

```bash
rulebridge fix --dry-run
rulebridge fix
```

`--dry-run` prints every planned create/update operation without touching disk.

RuleBridge currently generates or updates:

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/rulebridge-<id>.mdc`
- `.github/instructions/rulebridge-<id>.instructions.md`

Safety behavior:

- existing handwritten `AGENTS.md` and `CLAUDE.md` content stays outside a clearly marked RuleBridge-managed block
- Cursor and Copilot rules are generated into separate RuleBridge-owned files rather than replacing existing native files
- RuleBridge refuses to replace a generated-path file if it does not contain a RuleBridge ownership marker
- generated files are ignored during future discovery, preventing RuleBridge from recursively importing its own output
- repeated `fix` runs are designed to be idempotent
- agent-specific source content is carried into the managed output instead of being silently discarded

## Verification

RuleBridge includes reproducible mismatch fixtures and automated tests for discovery, import semantics, severity-aware analysis, stale paths, duplicate detection, opposite instructions, broader tool conflicts, CI exit codes, dry-run behavior, handwritten-content preservation, native generation, and repeated-fix idempotence.

Run the full verification suite locally with:

```bash
npm install
npm run verify
```

`npm run verify` runs TypeScript checking, automated tests, and a production build.

## Roadmap

- [x] `inspect` — discover existing agent configuration
- [x] `import` — normalize existing rules into a shared model
- [x] `diff` — compare rule semantics across agents
- [x] `check` — CI-friendly consistency validation
- [x] `fix` — generate compatible native configurations
- [x] `fix --dry-run`
- [x] preserve handwritten and agent-specific content
- [x] duplicate-rule detection
- [x] stale file/path reference detection
- [x] richer cross-tool conflict detection
- [x] opposite-instruction detection
- [x] info / warning / error severity levels
- [ ] generated-file cleanup manifest

## Supported agents

- OpenAI Codex
- Claude Code
- Cursor
- GitHub Copilot

## Philosophy

RuleBridge is local-first, predictable, and conservative around handwritten configuration. Generated output is explicitly marked and RuleBridge only replaces content it owns.

## Development

Requires Node.js 20+.

```bash
npm install
npm run verify
```

## License

MIT
