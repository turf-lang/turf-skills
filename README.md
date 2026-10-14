# turf-skills

Agent skills for working with [TurfLang](https://github.com/turf-lang/turf-lang).

| Skill | What it teaches |
|---|---|
| [`turflang/`](turflang/SKILL.md) | Turf 2.0 syntax and semantics, the standard library, the compile/fix loop with the compiler's diagnostics and `--smart`, projects and `turf test`, and porting code into Turf |

## Install

Copy or symlink a skill folder into your agent's skills directory. For Claude Code:

```sh
# personal (all projects)
ln -s "$PWD/turflang" ~/.claude/skills/turflang
# or per project
mkdir -p .claude/skills && cp -r turflang .claude/skills/
```

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

## Keeping it accurate

The content is derived from `docs/` in the turf-lang repository. Every `turflang` code block that is a complete program, and every file in `examples/`, compiles with `turfc` 2.0.x. The exception is the wrong/right fragments in `error-codes.md`. When the language changes, re-check the examples with `turfc --check`.
