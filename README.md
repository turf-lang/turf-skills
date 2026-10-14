# turf-skills

Agent skills for working with [TurfLang](https://github.com/turf-lang/turf-lang).

| Skill | What it teaches |
|---|---|
| [`turflang/`](turflang/SKILL.md) | Turf 2.0 syntax and semantics, the standard library, the compile/fix loop with the compiler's diagnostics and `--smart`, projects and `turf test`, and porting code into Turf |

## Install

```sh
npx turflang-skills
```

or, with the generic [skills](https://github.com/vercel-labs/skills) CLI:

```sh
npx skills@latest add turf-lang/turf-skills
```

Either command asks:
- which agents to install for (Claude Code, Cursor, Codex, OpenCode, GitHub Copilot, Windsurf and 70+ others);
- whether to install for this project or for your user (global);
- whether to symlink or copy.

Requires Node.js 22.20 or newer.

Non-interactive examples:

```sh
npx turflang-skills -g -a claude-code -y          # global, Claude Code only
npx turflang-skills -a claude-code cursor codex -y   # this project, three agents
npx turflang-skills --github                      # latest from GitHub instead of the npm-bundled copy
npx turflang-skills update                        # update installed skills
npx turflang-skills remove turflang               # uninstall
```

`npx turflang-skills` installs the copy bundled with that npm version. `npx skills add turf-lang/turf-skills` (or `--github`) installs whatever is on `master`.

**Manual install:** copy the `turflang/` folder into your agent's skills directory, for example `~/.claude/skills/turflang` for Claude Code.

A skill is `SKILL.md` (always read) plus `references/` and `examples/`, which the agent opens when it needs them.

## Layout of `turflang/`

```text
SKILL.md                         workflow, core syntax, the traps
references/language.md           full language rules (condensed reference)
references/stdlib.md             every stdlib module and signature
references/diagnostics.md        fix loop, diagnostic anatomy, --smart, runtime panics
references/error-codes.md        E001–E149: trigger and usual fix
references/projects-and-testing.md  turf.toml, modules, packages, turf test
references/porting.md            idiom map from other languages, 1.x → 2.0
examples/*.tr                    complete programs (compiled and run)
examples/inventory/              a small project with tests
```

## Releasing to npm

```sh
npm version patch      # or minor / major: bumps package.json and tags
npm publish
git push --follow-tags
```

`npm pack --dry-run` lists what gets published: `bin/`, `turflang/`, `README.md` and `LICENSE`.

## Keeping it accurate

The content is derived from `docs/` in the turf-lang repository. Every `turflang` code block that is a complete program, and every file in `examples/`, compiles with `turfc` 2.0.x. The exception is the wrong/right fragments in `error-codes.md`. When the language changes, re-check the examples with `turfc --check`.
