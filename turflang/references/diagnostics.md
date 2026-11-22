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
5. Re-check until it is clean. Warnings do not fail the build by default (exit status 0), but fix them anyway. To change how the build treats one warning, give its code a lint level (section 5): `--allow E163` hides it, `--deny E163` makes it an error. A name starting with `_` is the convention for an intentionally unused variable.

## 2. Anatomy of a diagnostic

```text
p.tr (1 error)                                      ← file header: path + counts

── error at line 4, col 30 [E057 · operator applied to the wrong kind of value]
                                                    ← position, CODE, the code's name

  I cannot use `+` on a `string` and an `int`.      ← message: what the compiler cannot do, in plain words
  Note: ...                                         ← related places not shown in the snippet

  Hint: Convert the operand that is not a `string` first, e.g. `n to string`: ...   ← the fix, often verbatim

  4 │     mut label: string = "x=" + p.x;
    │                              ^ this operator does not apply to these operands   ← labelled span

  Run `turf --explain E057` for more details.
```

The snippet's **primary span** (`^~~~`) is the code that is wrong and carries a label saying what is wrong with it. **Secondary spans** (`---`) mark related places in the same file with their own labels (`` `s` is a `string` because of this ``, `candidate`); `┊` marks lines left out between spans. Read the labels before the hint: they say which two things disagree.

An error with exactly one right edit also ends with a `Fix:` block (TurfLang 2.1.0 and later, every build, no flag):

```text
── error at line 3, col 5 [E040 · unknown name]

  I cannot find anything named `countr`.

  Hint: Use a name from this file: `counter`

  3 │     countr += 1;
    │     ^~~~~~ nothing of this name is in scope

  Fix: replace 'countr' with 'counter'              ← the edit, in words
  3 │     counter += 1;                               ← the line as it reads after it
    │     ~~~~~~~                                     ← the text the edit wrote

  Run `turf --explain E040` for more details.
```

- **Names:** the text after `·` is the code's registered name, a short lowercase noun phrase (`unknown name`, `missing return`, `wrong number of arguments`). Wording is not stable between releases; the code is. A tool reads `--diagnostics=json` (section 5), where `category` is one of: type mismatch, undeclared variable, control flow, syntax error, arithmetic, string conversion, array error, declaration, function signature, builtin function, memory error, general.
- **Ordering:** files come in compile order (your file, then imported modules). Within a file, diagnostics are sorted by position. Paths are relative to where you ran the command.
- **Warnings** have the same shape and the same header with a code: `── warning at line 2, col 5 [E163 · unused variable]`. Every warning has a code (E074, E075, E094, E152-E197), and the code is what a lint level names.
- **Stdlib warnings** are hidden unless you pass `--stdlib-warnings`. Errors are never hidden.
- **`Fix:` blocks** are checked before they are printed: the compiler applied the edit to a copy of the program, analysed it again, and the error was gone with no new error. Apply them as written. Wordings: `replace 'a' with 'b'`, `remove 'pub'`, `insert ';' at the end of line N`, `insert '<T>' after 'fn'`, `move 'pub' to just before 'fn'`, `pass 'b' as argument 2`, `declare the return type ': void'`, `write '(1.5)'`. They exist for a misspelled name with **one** close match (variable, function, method, field, type, variant, module symbol, scope qualifier, keyword), `x::m` on an instance, `Type.m` on a type, a static method called through an instance, `static` on a constructor, a misplaced `pub`, assigning to an `immut` variable (its declaration becomes `mut`), a missing `;`, a generic struct's method without `<T>`, **a call with the wrong argument count (E044)** and **a function with no return type (E106)**. No `Fix:` means several edits are plausible; the hint lists them.
  - **E044:** with one argument too many, the compiler tries removing each in turn and prints a `Fix:` only if exactly one removal fits (`add(2, 3, 4)` gets none: any removal fits). With one too few, it passes a variable named like the missing parameter (`pass 'height' as argument 2`) if one is in scope. Otherwise the message lists the overloads and the snippet marks the one candidate (`- candidate`).
  - **E106:** the fix writes the return type the body and the callers compile with (`: void`, `: int`, ...).
  - **Warnings** carry fixes too: E174 (parentheses), E175 (move `static`), E176 (`export` → `pub`), E177 (write the type arguments), E179 (remove the import).
  - **Fix Score.** Each fix is scored on what the edit does and shown with a tier. `proven` (the compiler's own) and `verified` (a `--smart` model fix) print as they are. `plausible` prints a second line, `Check before applying: it changes the declaration `fn total(): int`.`, when the fix removes calls/`return`s/assignments, changes another declaration or adds a `pub` item, adds `unsafe`/`extern`/`mem::` or imports `os`/`fs`/`http`/`io`, adds a warning, rewrites more than 6 tokens, or is one of several that pass. Apply a plausible fix only after reading that line and checking it against what you meant.
  - **No fix after a parse error:** an error reported while the parser recovers from a syntax error (from that line to the next declaration at column 1) gets no `Fix:`. Fix the first error and re-check. `--smart-write-fix=<path>` writes the whole program with every shown `Fix:` applied, in any build.
- **"Did you mean" hints** (`Hint: It may be from the current file: 'counter'`) are edit-distance matches against names actually in scope. They are reliable for typos.
- **Errors inside generic code** are anchored at *your* call line. The `Note:` lines list the instantiation chain (`'Set<Big>.add' requires 'Set<Big>.contains' here ...`) down to the failing operation inside the library. Read them top to bottom. The fix is almost always on your side: give your type the operation it needs (typically `operator ==`) or pass a comparator.

## 3. Reading the common messages

| You see | It usually means | Do |
|---|---|---|
| `` I cannot find anything named `x` `` (E040) | typo, out of scope (declared inside a block or loop), or never declared | apply the `Fix:` if there is one; else take the hint, or declare with `mut`/`immut` |
| `` I cannot find a function named `f` `` (E041) | typo; prelude function called bare when it is not `io`/`math`/`sys` (`is_digit(c)`); missing `import test;` for `assert` | use the method form `c.is_digit()`, qualify it, or import |
| `` I cannot find a function named `f` in the module `m` `` (E026) | wrong name for a stdlib function | check `stdlib.md` |
| `` I cannot find an import of module `m` in this file `` (E145) | wrote `m::x` without `import m;` | add `import m;` |
| `` No overload of `f` takes the argument types (int) `` (E056) | argument types fit no overload; passed `T` where `&T` expected (missing `&`); a generic argument's type disagrees | read the candidate list in the message |
| `` I cannot use `+` on a `string` and an `int` `` (E057) | `string + int`; arithmetic on `char`/`bool`; operands of a user `operator` don't match exactly | `(x to string)`, `(c to int)`, exact operand types |
| `` I cannot assign a `double` to `n`, which is an `int` `` (E066) | wrong type assigned; a `!T` used as `T`; `int` var given a `double`; the branches of `give/otherwise` differ | `to`, `recover`, fix the declaration |
| E064 | returned value doesn't match the return type, including a return inside `recover` checked against the enclosing function | |
| `` I cannot use `x` (type `int`) before it has a value `` (E008) | some path reads it before assigning (not for `T[N]` arrays, which start zero-filled) | initialize at declaration (`T::default()` for structs) |
| `` I found a path through `f` that ends without returning a result `` (E009) | a path with no `return` | add the final `return`, or make the `compare` exhaustive |
| `` This `compare` on `E` does not cover every case `` (E093) | `compare` misses enum variants / `true`/`false` / error variants, or a `compare err` without `otherwise` | add the listed arms or `otherwise:` |
| `` I expected `done` after the body of this `matches` arm `` (E058) | missing `done`, or `otherwise` not last | |
| `` I cannot access the field `val` of `b`, which might be `null` here `` (E081) | read through `&?T` without a check, after a call that may have changed the checked field, or through a call result | check `!= null` on the variable or field path first; after a call, re-check or copy into a local |
| `I cannot let a reference into this function's own local storage be returned` (E086) | returned or stored `&local` | `heap(local)` |
| `` ... which is private to module `m` `` (E088) | missing `pub` on a function, type **or field** in the other module | add `pub` there, or use the public API |
| `` I cannot let the public ... expose the private type `T` `` (E089) | a `pub` signature mentions a non-`pub` type | make that type `pub` |
| `` I cannot update part of what an `operator[]` read returned `` (E098) | `list[i].f = v`, `m[k][j] = v` | read, modify, write back |
| `` I cannot use the raw pointer type `T*` outside an `unsafe` block `` (E130) | pointer types or casts outside `unsafe`, or in a function signature | use `&T`/`&?T`; wrap the FFI in `unsafe { }` |
| `I expected ...` / `I did not expect ...` (E102, E103, E107, E108, E110) | syntax: missing `;`, `{`, `:` return type, a reserved word as a name (`step`, `float`, `guess`, ...), `f<int>(x)`, `/* */` comment | see `error-codes.md` |
| `` `Box` is generic, so I need type arguments here `` (E138) | `fn Box.get()` on a generic struct, a type used without its arguments, or `Box::default().get()` | `fn<T> Box.get()`, `Box<int>`, declare `mut b: Box<int> = Box<int>::default();` first |
| `` I cannot infer the type of `l` ... `` (E129) | `mut l = List::default();`; a size parameter no array argument or target type gives (`mut d = fill(0);`) | `mut l: List<int> = List<int>::default();`; `mut d: int[4] = fill(0);` |
| `` I found no overload of `f` that takes 3 arguments `` (E044) | wrong argument count; for a `static` method called with `.`, the hidden self | apply the `Fix:` if shown; else match one of the listed overloads (the snippet marks the candidate) |
| `` I expected a `:` followed by a return type after the parameter list `` (E106) | `fn f(a: int) { }` | apply the `Fix:` (`: void` or the type the body returns) |
| E150 | size parameter (`N: size`) on a struct/method/operator, used as a type, or assigned | free function only; copy it first: `mut n: int = N;` |
| E151 | `struct Box<T>` declared inside a function | move it to the top level, or drop `<T>` and use concrete field types |
| `I found no entry point` (E119) | checked a module as a program | add `--module`, or write `fn main(): int` |

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
   Checked: it compiles, adds no warning, is a small edit, removes no call, `return` or assignment, changes no declaration, ...
   ```
   The `Checked:` line lists what the compiler verified about the whole edit (Fix Score, section 2). A suggestion that trips one of those facts is shown as plausible, with the reason spelled out: read it before applying.
7. **Your file is never modified.** The exit status is still 1. Apply the `+` lines yourself, or use `--smart-write-fix=<path>` (the whole corrected file at `<path>`), review the diff, and move it into place.

**Requirements:**
- the smart build (`turfc --version` → `smart built-in`, from the `-smart` release archive or a source build without `--no-smart`);
- exactly one `.gguf` model in `<root>/models/` (`<root>` is the `root` line of `turf version`; e.g. `~/.turf/models`). `qwen2.5-coder-1.5b-instruct-q4_k_m.gguf` is the development model.
- With zero or several models, or the plain build, you get a one-line `note:` and the normal diagnostics. `Fix:` blocks need none of this.
- A model not on the qualified list prints one `note:` and runs anyway. One `--smart` run has a 180-second wall-clock budget and 512-token answers; past the budget it falls back to the compiler's diagnostics.
- `--smart=thorough` asks for two more sampled answers and shows the suggestion as plausible (`2 different fixes pass these checks`) when passing answers differ. It takes about three times as long.

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
| unused variable (E163) / dead store (E160) / initializer overwritten before any read (E161, "initial value ... never read": declare `mut x: int;`) | warning (prefix `_` to mark intentional); none are reported falsely inside `recover run { }` blocks or for single-element array writes |
| `while true` with no exit (a `break`/`return` inside `recover`, `compare` or `unsafe` counts as an exit) | warning ×3: E157, E159 and E074 for the code after it (fine for a server loop) |
| infinite self-recursion (every path recurses) | E010 error |
| constant index out of bounds / bad constant slice | E001 / E143 error |
| double free / use after free (only `@ownership`-annotated allocators) | E017/E018 error; E171/E170 warning on some paths |
| cyclomatic complexity > 15 | E158 warning |
| unused private function (E178), unused import (E179), unused `pub` function in the program's root file (E180) | opt-in warnings (start at `allow`) |
| `int` to `double` outside ±2^53 (E181) | opt-in warning |
| functions that call each other on every path (E182), a recursive base case the value ranges prove unreachable (E183) | opt-in warnings |
| loop test nothing changes (E184), every loop exit provably never taken (E185), every loop exit behind `sys::panic`/`exit` (E186) | opt-in warnings |
| `mem::alloc` memory never freed or handed on (E187); unsafe checks E188-E194 (maybe-null raw dereference, freeing a variable's address, write through a pointer into an `immut` array, unbounded pointer index, int-to-pointer cast, unneeded or over-40-statement `unsafe` block) | opt-in warnings |
| empty loop body (E195), empty function body (E196), empty `recover` block (E197); a comment in the body marks it deliberate | warnings, on by default |
| `x / 0` literal (E167), `k = k;` (E156), `x == x` (E166), `x == true` (E155), shadowing (E152), empty `then` (E165), identical `if`/`else` bodies (E168), empty `compare` (E154), a `for` whose variable never changes (E164), a range that never ends (E162), a `!T` that never fails (E169), a machine state with no incoming edge (E153) | warnings |

### Lint levels

Each warning code has a **level**: `allow` (not reported), `warn` (reported) or `deny` (reported as an error: status 1, no program). Most warnings start at `warn`. A warning for a check still collecting its false-positive record, and every opt-in lint, starts at `allow` and prints only after `--warn`/`--deny` of its code or a `[lints]` entry: E174-E194 in 2.3. E195-E197 start at `warn`. The level is chosen by whoever builds the program; there is no source syntax for it.

```text
turf check prog.tr --deny E163          # fail on an unused variable (turfc takes the same flags)
turf build --allow E157 --warn E163     # flags repeat; a later flag for a code wins
turfc prog.tr --check --lint-set 2.1    # warnings added after 2.1 start at allow
```

```toml
# turf.toml
[lints]
lint-set = "2.1"
E163 = "allow"
E158 = "deny"
```

- `turf` passes the `[lints]` table to the compiler as flags ahead of the ones you type, so a command-line flag beats the file. The compiler itself never reads `turf.toml`: a script that drives `turfc` passes the flags (driver interface 1.8 or later; `turfc --version`, second line).
- A denied warning prints with the `error` header and keeps its `Warning:` text, plus the line `E163 is a warning by default; its lint level here is deny.`
- `--lint-set 2.N` (or `lint-set = "2.N"`) starts every warning added after release 2.N at `allow`; a level named for the code still wins. A set newer than the compiler is an error.
- A code that does not exist, a word that is not a code, or `--allow`/`--warn` of an error's code is a usage error (status 2). `--deny` of an error's code is accepted and changes nothing.
- A warning inside the standard library is hidden unless `--stdlib-warnings`, and is never denied unless that flag is given.
- The `[lints]` table has no effect in a single-file compile; pass the flags.

### Machine-readable output

- `turfc prog.tr --check --diagnostics=json` writes each diagnostic to stderr as one line holding one JSON object (code, severity, category, message, hint, span, related locations, the checked fix as edits, `denied`), schema `"version": "1.2"` (1.1 added `label`, the text under the primary span; 1.2 added the fix's `tier` (`proven` or `plausible`) and `flags`, one sentence per reason a plausible fix needs a look); no headers, no colour. The exit status is the same as for text.
- `turfc --version --json` prints one JSON object: `turfc`, `interface`, `schemas`, `features`. A tool reads it instead of the text of `--version`.

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
