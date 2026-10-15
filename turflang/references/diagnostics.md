# Diagnostics, `--smart`, and runtime failures

How to get from "it doesn't compile" or "it crashed" to a fix. For a specific code, see `error-codes.md` or run `turf explain E0NN`.

## 1. The fix loop

```text
turf check prog.tr            # or: turfc --check prog.tr        (no output file)
turf check --module lib.tr    # a file with no main that is only imported
turf check                    # in a project: every module + main
```

1. **Apply every `Fix:` block** (section 2): the compiler has already checked each one. Then fix the **first** remaining error of each file first. Later errors are often consequences of it, although the compiler already drops repeated diagnostics on the same line.
2. **Errors arrive in phases:** lexing/parsing → name resolution → type checking → flow analysis (missing returns, definite assignment, escapes, unreachable code). A file with a syntax error does not report its type errors yet. Expect new errors after each round; that is progress.
3. When the one-line message is not enough, `turf explain E0NN` prints the full page with a wrong example and its fix. Run it before patching any code whose footer says `Worth reading in full`: E010, E017, E018, E035, E036, E069, E086, E088, E089, E121, E130.
4. **E121 is an internal compiler error.** It is not your bug. Simplify the construct, work around it, and report it.
5. Re-check until it is clean. Warnings do not fail the build (exit status 0), but fix them anyway. There is no way to silence a warning except fixing it or prefixing an intentionally unused name with `_`.

## 2. Anatomy of a diagnostic

```text
prog.tr (1 error)                                   ← file header: path + counts

── error at line 4, col 30 [E057 · arithmetic]      ← position, CODE, category

  Operator applied to the wrong kind of value!     ← message
  Type mismatch: cannot apply '+' to 'string' and 'int'.
  Note: ...                                         ← related places (declared here, inferred here, ...)

  Hint: ... convert it first with `<expr> to string`.   ← the fix, often verbatim

  4 │     mut label: string = "x=" + p.x;
    │                              ^ Here!              ← exact token

  Run `turf --explain E057` for more details.
```

An error with exactly one right edit also ends with a `Fix:` block (TurfLang 2.1.0 and later, every build, no flag):

```text
── error at line 3, col 5 [E040 · undeclared variable]

  I can't find anything named 'countr'.

  Hint: It may be from the current file: 'counter'

  3 │     countr += 1;
    │     ^~~~~~ Here!

  Fix: replace 'countr' with 'counter'              ← the edit, in words
  3 │     counter += 1;                               ← the line as it reads after it
    │     ~~~~~~~                                     ← the text the edit wrote

  Run `turf --explain E040` for more details.
```

- **Categories:** type mismatch, undeclared variable, control flow, syntax error, arithmetic, string conversion, array error, declaration, function signature, builtin function, memory error, general.
- **Ordering:** files come in compile order (your file, then imported modules). Within a file, diagnostics are sorted by position. Paths are relative to where you ran the command.
- **Warnings** have the same shape, but often no code.
- **Stdlib warnings** are hidden unless you pass `--stdlib-warnings`. Errors are never hidden.
- **`Fix:` blocks** are checked before they are printed: the compiler applied the edit to a copy of the program, analysed it again, and the error was gone with no new error. Apply them as written. Wordings: `replace 'a' with 'b'`, `remove 'pub'`, `insert ';' at the end of line N`, `insert '<T>' after 'fn'`, `move 'pub' to just before 'fn'`. They exist for a misspelled name with **one** close match (variable, function, method, field, type, variant, module symbol, scope qualifier, keyword), `x::m` on an instance, `Type.m` on a type, a static method called through an instance, `static` on a constructor, a misplaced `pub`, assigning to an `immut` variable (its declaration becomes `mut`), a missing `;` and a generic struct's method without `<T>`. No `Fix:` means several edits are plausible; the hint lists them. `--smart-write-fix=<path>` writes the whole program with every shown `Fix:` applied, in any build.
- **"Did you mean" hints** (`Hint: It may be from the current file: 'counter'`) are edit-distance matches against names actually in scope. They are reliable for typos.
- **Errors inside generic code** are anchored at *your* call line. The `Note:` lines list the instantiation chain (`'Set<Big>.add' requires 'Set<Big>.contains' here ...`) down to the failing operation inside the library. Read them top to bottom. The fix is almost always on your side: give your type the operation it needs (typically `operator ==`) or pass a comparator.

## 3. Reading the common messages

| You see | It usually means | Do |
|---|---|---|
| `I can't find anything named 'x'` (E040) | typo, out of scope (declared inside a block or loop), or never declared | apply the `Fix:` if there is one; else take the hint, or declare with `mut`/`immut` |
| `Unknown function` (E041) | typo; prelude function called bare when it is not `io`/`math`/`sys` (`is_digit(c)`); missing `import test;` for `assert` | use the method form `c.is_digit()`, qualify it, or import |
| `Module 'm' has no function named 'f'` (E026) | wrong name for a stdlib function | check `stdlib.md` |
| `Module 'm' is not imported in this file` (E145) | wrote `m::x` without `import m;` | add `import m;` |
| `No matching overload!` (E056) | argument types fit no overload; passed `T` where `&T` expected (missing `&`); a generic argument's type disagrees | read the candidate list in the message |
| `Operator applied to the wrong kind of value` (E057) | `string + int`; arithmetic on `char`/`bool`; operands of a user `operator` don't match exactly | `(x to string)`, `(c to int)`, exact operand types |
| `Type mismatch!` (E066) | wrong type assigned; a `!T` used as `T`; `int` var given a `double`; the branches of `give/otherwise` differ | `to`, `recover`, fix the declaration |
| E064 | returned value doesn't match the return type, including a return inside `recover` checked against the enclosing function | |
| `before it has a value` (E008) | some path reads it before assigning (not for `T[N]` arrays, which start zero-filled) | initialize at declaration (`T::default()` for structs) |
| `promises to give back a result, but sometimes it doesn't` (E009) | a path with no `return` | add the final `return`, or make the `compare` exhaustive |
| `Non-exhaustive ... comparison` (E093) | `compare` misses enum variants / `true`/`false` / error variants, or a `compare err` without `otherwise` | add the listed arms or `otherwise:` |
| `Expected 'done' after matches arm body` (E058) | missing `done`, or `otherwise` not last | |
| `Possible null dereference` (E081) | read through `&?T` without a check, or through a field/call result | copy into a local, check `!= null` |
| `can't be returned -- it would dangle` (E086) | returned or stored `&local` | `heap(local)` |
| `is private to module` (E088) | missing `pub` on a function, type **or field** in the other module | add `pub` there, or use the public API |
| `exposes the private type` (E089) | a `pub` signature mentions a non-`pub` type | make that type `pub` |
| `Writing into part of an index result` (E098) | `list[i].f = v`, `m[k][j] = v` | read, modify, write back |
| `Raw pointer ... outside an 'unsafe' block` (E130) | pointer types or casts outside `unsafe`, or in a function signature | use `&T`/`&?T`; wrap the FFI in `unsafe { }` |
| `Expected ...` / `Unexpected token` (E102, E103, E107, E108, E110) | syntax: missing `;`, `{`, `:` return type, a reserved word as a name (`step`, `float`, `guess`, ...), `f<int>(x)`, `/* */` comment | see `error-codes.md` |
| `Missing type parameters!` (E138) | `fn Box.get()` on a generic struct, or a type used without its arguments | `fn<T> Box.get()`, `Box<int>` |
| `Nothing to infer!` (E129) | `mut l = List::default();`; a size parameter no array argument or target type gives (`mut d = fill(0);`) | `mut l: List<int> = List::default();`; `mut d: int[4] = fill(0);` |
| E150 | size parameter (`N: size`) on a struct/method/operator, used as a type, or assigned | free function only; copy it first: `mut n: int = N;` |
| `No entry point found` (E119) | checked a module as a program | add `--module`, or write `fn main(): int` |

## 4. `--smart`: model-assisted fixes

```text
turf prog.tr --smart                        # compile; on error, try to get a validated fix
turf prog.tr --smart --smart-write-fix=prog.fixed.tr   # also write the patched file
turfc --check prog.tr --smart               # works with --check too
```

**What happens, step by step:**

1. The compile runs normally. A clean compile never starts the model, and warnings never trigger it.
2. On error, only the **first** error is handled.
3. **The compiler's own fix first.** If the error has a `Fix:` (section 2), `--smart` shows it and the model is never called. It takes milliseconds, and the output is the same as without `--smart`.
4. **Otherwise, the local model** (llama.cpp, CPU/Metal, no network) is prompted with the error, its category, the surrounding code and a Turf syntax card. Its proposed edit is applied to an **isolated sandbox copy** and recompiled.
5. **Validation rule:** the suggestion is shown only if the original error is gone **and no new error appears**. A failed attempt is retried with the compiler's feedback, up to 3 attempts (`[Sandbox] Attempt 1/3 failed validation, retrying...`). If none validates, you get the plain diagnostic, unchanged.
6. **Output** appears inside the diagnostic:
   ```text
   [Model Suggestion]  ...
   Explanation: ...
   Suggested fix:
     - 4 |     mut label: string = "x=" + p.x;
     + 4 |     mut label: string = "x=" + (p.x to string);
   ```
7. **Your file is never modified.** The exit status is still 1. Apply the `+` lines yourself, or use `--smart-write-fix=<path>` (the whole corrected file at `<path>`), review the diff, and move it into place.

**Requirements:**
- the smart build (`turfc --version` → `smart built-in`, from the `-smart` release archive or a source build without `--no-smart`);
- exactly one `.gguf` model in `<root>/models/` (`<root>` is the `root` line of `turf version`; e.g. `~/.turf/models`). `qwen2.5-coder-1.5b-instruct-q4_k_m.gguf` is the development model.
- With zero or several models, or the plain build, you get a one-line `note:` and the normal diagnostics. `Fix:` blocks need none of this.

**How an agent should use it:**
- **Default to the compiler's diagnostics.** Apply `Fix:` blocks; for the rest, the message and Hint are exact, instant and usually name the fix.
- **Use `--smart`** for an error with no `Fix:`, when:
  - a message is unclear to you;
  - your own two attempts at an error failed;
  - you are learning an unfamiliar construct and want to see the idiomatic fix.
- **Validated means it compiles, not that it is correct.** The model can "fix" an error by deleting or changing logic. Compare the diff with your intent and keep only semantically faithful patches.
- **Cost:** each model call takes seconds to over a minute. Run `--smart` on one file at a time, never in loops or CI, and never in `turf test`.
- **Loop:** it handles one error per run. After applying a fix, re-run `turf check` (not `--smart` again) to see the next error, then decide.

## 5. Static analysis that runs on every compile

| Check | Severity |
|---|---|
| statement after `return`/`break`/`continue` | E012 error |
| unreachable block | E074/E075 warning |
| missing return on some path | E009 error |
| read before assignment | E008 error |
| `new` doesn't assign every field on every path | E049 error |
| unused variable / dead store / initializer overwritten before any read ("initial value ... never read": declare `mut x: int;`) | warning (prefix `_` to mark intentional); none are reported falsely inside `recover run { }` blocks or for single-element array writes |
| `while true` with no exit (a `break`/`return` inside `recover`, `compare` or `unsafe` counts as an exit) | warning ×3 (fine for a server loop) |
| infinite self-recursion (every path recurses) | E010 error |
| constant index out of bounds / bad constant slice | E001 / E143 error |
| double free / use after free (only `@ownership`-annotated allocators) | E017/E018 error, warning on some paths |
| cyclomatic complexity > 15 | warning |
| `x / 0` literal, `k = k;`, `x == x`, shadowing, empty `then`, a `for` whose variable never changes, a range that never ends, a `!T` that never fails, a machine state with no incoming edge | warnings |

## 6. When a compiled program fails

Every language-detected failure is a **panic**: one line on stderr, then exit status **134** (SIGABRT). There is no unwinding, and deferred statements **do not run**. Stdout written before the panic is flushed.

| Message | Cause |
|---|---|
| `panic: runtime check: Array index out of bounds for 'a' (prog.tr:7)` | run-time index outside `-N..N-1` |
| `Slice range out of bounds for 'a'` | bad slice bounds |
| `String index out of bounds` / `Cannot write into this string` | `s[i]` out of range; a write into a literal |
| `Division by zero` / `Modulo by zero` | integer **or double** `/` / `%` by zero |
| `Integer overflow` | `+ - * ** << ++ --` or negation overflowed; `double to int` of NaN/inf/out-of-range; bad shift count |
| `Invalid string to int conversion` (also double/enum) | `"12a" to int` at run time; use `strings::parse_int` instead |
| `Invalid int to enum conversion` | `n to Enum` out of range |
| `M::transition(S) -- no such transition from the current state.` | run-time-checked machine move along an undeclared edge |
| `prog.tr:12: List.get: index out of bounds`, `Map.get: ...` | a checked stdlib call; the location is **your** calling line |
| `panic: stack overflow: ...` | unbounded or too-deep recursion |
| `panic: out of memory` | an allocation could not be satisfied |
| `panic: cross-heap free: ...` | `mem::free` on GC memory (unsafe code) |
| `panic: segmentation fault (this is a bug in unsafe code or in TurfLang)` | a raw-pointer bug in `unsafe`/FFI code |
| your text | `sys::panic(msg)`, `test::fail(msg)`, failed `test::assert` (`file:line: msg`) |

**Debugging:**
- `turf prog.tr -O0 -g -o prog && lldb ./prog` (or `gdb`). Set breakpoints with `break prog.tr:LINE` and print locals by name. Imported types appear as `module.Name`.
- `printline(...)` / `io::eprintline(...)` traces are fine. stdout is buffered but flushed before a panic, on exit, and by `io::flush()`.
- Optimization level never changes behaviour: all checks stay at `-O2`/`-O3`.
- `turf dump typechecked prog.tr` / `turf dump instantiations prog.tr` show what the compiler inferred.
