---
name: turflang
description: Write, read, debug, fix, test and port code in TurfLang (Turf), the statically typed LLVM-compiled language with `.tr` files, `turf`/`turfc` compilers, `turf.toml` projects and the `--smart` local-model diagnostics. Use whenever a task touches `.tr` files, Turf syntax, Turf compile errors (E001–E150), runtime panics, the Turf standard library, `turf test`, or rewriting code into or out of Turf.
---

# TurfLang

Turf is not C, Rust, Go or Python, even where it looks like them. Most mistakes agents make come from guessing syntax from those languages. This skill gives you the real rules. **Do not guess Turf syntax; check it here or in `references/`.**

Turf 2.1: static types, ahead-of-time compiled through LLVM, garbage-collected heap, checked references (`&T`, `&?T`), real monomorphized generics, error unions (`!T` with `recover`/`try`), `compare` pattern matching, `machine` state machines, and checked arithmetic and indexing. Release builds keep every runtime check.

## Files in this skill

| File | Read it when |
|---|---|
| `SKILL.md` (this file) | Always. It covers the workflow, the core syntax, and the traps. |
| `references/language.md` | Writing anything beyond the basics: the full rules for types, casts, operators, control flow, patterns, errors, functions, modules, structs, generics, arrays, references, `unsafe`/FFI. |
| `references/stdlib.md` | Calling any library function: exact signatures, which module to import, what panics, and which error variants come back. |
| `references/diagnostics.md` | A compile fails or a program panics. Covers the fix loop, how to read a diagnostic, `--smart`, warnings and runtime panics. |
| `references/error-codes.md` | You have an `E0NN` code and want its meaning and usual fix. |
| `references/projects-and-testing.md` | Working in a `turf.toml` project: layout, imports across modules and packages, dependencies, `turf test` conventions. |
| `references/porting.md` | Translating code from C/C++/Rust/Go/Python/JS/Java into Turf (or back), or upgrading Turf 1.x code. |
| `examples/*.tr`, `examples/inventory/` | You want a complete, compiling program to copy patterns from. All of them were compiled and run. |

## The working loop

1. **Find the toolchain.** Run `turf version`: it prints both `turf` (the front end) and `turfc` (the compiler), plus the install root and whether `smart` is built in. `turf file.tr [flags]` is the same as `turfc file.tr [flags]`. If `turf` is missing or stale, call `turfc` directly. Every single-file flag below works on both.
2. **Write the code** following the rules below. Put small, checkable pieces in their own functions.
3. **Check without building:** `turf check file.tr` (or `turfc --check file.tr`). Use `--module` for a file that has no `main` and is only imported. In a project, run `turf check` with no file.
4. **Read every diagnostic and fix it**: start with the first one. **If it ends with a `Fix:` block, apply that edit**: the compiler has already checked it. Otherwise consult `references/diagnostics.md`, and run `turf explain E0NN` when the message is not enough. Re-check after each round. Errors come in stages: until the syntax errors are fixed, type errors are not reported at all. Expect several rounds; that is normal, not a sign you are lost.
5. **Use `--smart` when you are stuck on an error that has no `Fix:`** and the smart build plus a model are installed (see below). Treat its output as a suggestion that has already been verified, not as gospel.
6. **Build and run:** `turf run file.tr` (or `turf file.tr -o prog && ./prog`). In a project, run `turf build`, `turf run` and `turf test`.
7. **Read runtime panics.** They name the file and line (`panic: runtime check: Array index out of bounds for 'a' (prog.tr:7)`, exit status 134). Fix the cause; there is nothing to catch.
8. **Format before committing:** `turf fmt --write <files or dirs>`. It only fixes indentation and whitespace, never re-spaces code.

Exit statuses: 0 means success, 1 means a reported problem (compile error, failed test), 2 means a bad command line. `turf run` returns the program's own status, and 134 means a panic.

### Compiler fixes, diagnostics and `--smart`

* **The compiler's own diagnostics are the source of truth** and need nothing extra. Each one has a stable code `[E0NN · category]`, a plain-language message, `Note:` lines pointing at related places, often a `Hint:` with the exact fix, and a caret under the offending token. "Did you mean" hints for misspelled names are reliable: they come from edit distance over names actually in scope.
* **A `Fix:` block is a compiler-checked edit** (TurfLang 2.1.0 and later, every build, no flag, no model). When an error has exactly one right edit, the diagnostic ends with it:
  ```text
    Fix: replace 'countr' with 'counter'
    3 │     counter += 1;
      │     ~~~~~~~
  ```
  Before printing it, the compiler applied the edit to a copy of the program and checked it again: the error is gone and no new error appeared. **Apply it as written**, then re-check. It covers a misspelled name with one close match (variable, function, method, field, type, enum variant, module symbol, keyword), `.` vs `::`, a stray `static` or `pub`, `immut` → `mut` at the declaration of a variable you assign to, a missing `;` and a generic method's missing `<T>`. No `Fix:` means more than one edit is plausible: the `Hint:` names the candidates, and you choose.
  * It never edits your source. `--smart-write-fix=<path>` (any build, with `turf check`, `turf file.tr` or `turfc`) writes the whole program with every shown `Fix:` applied to `<path>`; diff it and copy it over.
  * Compiles is not the same as correct: a rename to the one close name is almost always the intent, but check it when two variables have similar names.
* **`--smart`** (`turf file.tr --smart`) is for an error **without** a `Fix:`. When the compiler has a fix, `--smart` shows that and never calls the model. Otherwise it sends the *first* error to a small local language model (llama.cpp, no network). Any suggested fix is applied to an isolated sandbox copy and kept **only if the error disappears and no new error appears**. Otherwise you see the normal diagnostic, unchanged. Up to 3 attempts, each retried with compiler feedback.
  * Output appears inside the diagnostic as `[Model Suggestion]`, with `Explanation:` and a `- line / + line` diff.
  * **It never edits your source.** Apply the diff yourself, or pass `--smart-write-fix=<path>` to write the whole patched file to `<path>`, then diff it against the original and copy it over if it is right.
  * It needs the smart build (`turfc --version` ends `smart built-in`) and **exactly one** `.gguf` file in `<root>/models/`. If either is missing, it prints a one-line note and falls back to the normal diagnostics. A model fix takes seconds to a minute or more, so do not put `--smart` in loops or CI.
  * The exit status is still 1, since the file on disk still has the error.
  * Strategy: apply `Fix:` blocks, fix other obvious errors yourself from the message and hint. Reach for `--smart` when a message is unclear or two attempts of yours have failed. A validated model suggestion is guaranteed to compile, **not** guaranteed to mean what you intended. Always check that the patch preserves the program's logic.

## Core syntax at a glance

```turflang
import list::List;              // stdlib modules other than the prelude need an import
import map::Map;

struct Point { x: int, y: int }                 // fields: name: Type, comma-separated

fn Point.new(x: int, y: int): void {            // constructor = method named `new`
    self.x = x;                                 // must assign every field on every path
    self.y = y;
}
fn Point.len2(): int { return self.x * self.x + self.y * self.y; }   // method, implicit self (by reference)
fn Point.origin() static: Point { return Point::default(); }        // static method: `static` before `:`

enum Color { Red, Green, Blue }

error ParseError { Empty, Bad(at: int, text: string) }   // error type; variants may carry data

fn parse(s: string): !int {                     // !T = T or an error value
    if s == "" { return ParseError::Empty; }
    return strings::parse_int(s) recover run { return ParseError::Bad(0, s); };
}

fn<T> first(items: List<T>): T { return items[0]; }    // generic: <T> right after fn

fn main(): int {                                // main returns int (exit status) or void
    mut n: int = 5;                             // mut = reassignable, immut = not
    immut name = "turf";                        // type inferred (string); `: guess` is the same
    n = n + 1;                                  // reassign: no keyword, no type
    n += 2; n++;

    immut d: double = n to double;              // ALL conversions use `to`
    immut label: string = "n=" + (n to string); // + needs strings on both sides; parenthesize `to`
    immut size: string = n > 3 give "big" otherwise "small";   // the conditional expression

    if n > 10 { n = 0; } elseif n < 0 { n = 1; } else { n = 2; }   // braces always required
    while n < 10 { n++; }
    do { n--; } while n > 5;                    // note the trailing ;
    for i in 0..5 { n += i; }                   // half-open range 0,1,2,3,4
    for i in 10..0 step i -= 2 { n += i; }      // a descending range needs an explicit step
    immut arr: int[3] = [1, 2, 3];
    for v in arr { n += v; }                    // for-each: arrays only (not List/Map)
    for (i, v) in arr { n += i * v; }

    mut p: Point = Point::new(3, 4);            // or Point::default(): every field zero
    p.x = 7;
    mut c: Color = Color::Green;
    compare c {                                 // `compare` is the switch/match
        matches Color::Red:
            n = 1;
        done                                    // every `matches` arm ends in `done`
        matches Color::Green:
        matches Color::Blue:                    // stacked headers share one body
            n = 2;
        done
    }                                           // enums: cover every variant or add `otherwise:`

    immut v: int = parse("42") recover produce -1;          // fallback value
    immut w: int = parse("7") recover as err run {          // bind the error
        printline("failed: " + err.message);
        return 1;                               // `return` here would leave main, not the recover
    };

    mut xs: List<int> = List::default();        // the declared type supplies <int>
    xs.push(v);
    for i in 0..xs.length() { n += xs[i]; }     // iterate collections by index
    mut ages: Map<string, int> = Map::default();
    ages["ada"] = 36;

    printline(name + " " + label + " " + size + " " + (d to string) + " " + (w to string));
    return 0;
}
```

Comments are `//` only: there are **no `/* */` block comments** (E103). Statements end in `;`. Identifiers are `snake_case` or `camelCase` (the stdlib uses `snake_case`), and types are `PascalCase`.

## The traps (read these before writing Turf)

**Declarations and types**
- A declaration always starts with `mut`/`mutable` or `immut`/`immutable`: `mut x: int = 1;`. You cannot write `int x`, `let`, `var`, or `x := 1`.
- `immut` needs an initializer. A `mut` scalar or struct declared without one (`mut x: int;`) must be assigned on **every** path before it is read (E008). There is no implicit zero. A fixed-size array `mut a: int[N];` is the exception: it is zero-filled from its declaration, so reading it is never E008. `(&T)[N]` and unsized `T[]` still need an initializer (E128).
- Inference comes from the initializer only (`mut x = 5;`). Parameters, return types and fields always have written types.
- Numeric types: `int` (64-bit, signed), `int32` (for C interop only), `double`. There is no `float` (it is a reserved word), and there are no unsigned types or other widths.
- `char` is one byte, not a number and not a string: `'a' + 1` is E057; write `(c to int) + 1`. `s[i]` is a `char`; compare it with `'x'`, not with `120`.
- `bool` never converts to or from a number. Write `cond give 1 otherwise 0`, and `n != 0` for truthiness. `if n { }` is an error.
- Implicit conversions are exactly `int32 → int`, `int32 → double`, and `int → double`. Everything else needs `to`: `x to int`, `x to string`, `"42" to int` (panics on bad text; prefer `strings::parse_int`, which returns `!int`), `c to int`, `65 to char`, `v to Color`, `Color::Red to string`.
- **`to` binds looser than arithmetic.** `"a" + n to string` parses as `("a" + n) to string`, which is an error. Write `"a" + (n to string)`. Also `(x to double) * 2`, never `x to double * 2`.
- `null` only fits `&?T` and raw pointers. A `string` is never null; `""` is the empty value.

**Operators**
- There is no `?:`. Use `cond give a otherwise b`. It is the loosest operator, so in a plain assignment write `r = (c give a otherwise b);`.
- Bitwise operators bind **tighter** than comparison (unlike C): `x & 1 == 1` means `(x & 1) == 1`.
- `**` is power: `int ** int` gives an exact `int`, and a `double` on either side gives a `double`. `-2 ** 2` is `4`. `^` is XOR.
- Integer overflow, division by zero and an out-of-range `double to int` **panic** at run time; nothing wraps. A constant expression that overflows is a compile error (E076).
- Structs have no `==` or `<` unless you declare `operator ==` (each operator separately). Arrays have no `==`. Enums support `==`/`!=` but not `<`.
- `string + string` concatenates. A string plus anything else is E057.

**Control flow**
- Every `if`/`elseif`/`else`/`while`/`for`/`do` body needs braces. Conditions need no parentheses. Write `elseif` (`else if` also works).
- A range `for` is `for i in a..b` (end excluded), with an optional `step <expr>` (default `i++`). There is no C-style `for(;;)` and no `..=`. For a descending range, write a decreasing `step`, or the loop never ends.
- **Reserved words catch ordinary names.** These cannot be variable, parameter, field or function names (E108):
  - `step`, `run`, `to`, `in`, `as`, `do`, `done`, `give`, `produce`, `recover`, `try`, `error`, `float`, `ptr`, `string`, `self`, `static`, `export`, `extern`, `machine`, `matches`, `compare`, `otherwise`, `operator`, `guess`, `defer`, `public`, `pub`, `unsafe`, `null`, `caller_location`;
  - plus the type names (`int`, `int32`, `double`, `bool`, `char`, `void`) and the usual keywords.
  - Typical renames: `from`/`to` → `src`/`dst`, `run` → `invoke`, `step` → `advance`, `string` → `text`.
- **`compare` syntax:** `compare x { matches P: stmts done ... otherwise: stmts }`. Each `matches` arm ends with `done`. `otherwise` comes last and has **no** `done`.
  - An enum, `bool` or declared error type must be covered completely, or the compare needs an `otherwise:` (E093).
  - Guards: `matches Point { x, y } if x == y:`. A bare name inside a struct pattern **binds**; it does not compare.
- `break`/`continue` have no labels. Inside a `compare` arm or a `recover` block, they act on the surrounding loop.
- `defer stmt;` runs when the **enclosing block** exits (LIFO), on return/break/continue/error paths, **but not on a panic**. Use it to close sockets and release resources.

**Functions, methods, modules**
- `fn name(a: T, b: U): R { }`. The return type is mandatory (`: void`). A non-void function must return on every path (E009). Nested functions are not allowed, and neither are lambdas or closures. Pass a named function as a value: `fn(int, int): int`.
- Parameters are **copies**, structs and fixed arrays included. To mutate the caller's value, take `&T` and pass `&v`. Methods receive `self` by reference. An unsized array parameter `T[]` is a view, so writes reach the caller.
- Methods are declared outside the struct as `fn Type.method(...)`. Methods of a generic struct repeat the type parameters: `fn<T> Box.get(): T` (E138 without them).
- Structs are built only with `T::default()` or `T::new(...)` (when you wrote `fn T.new`). **Struct literals such as `Point { x: 1 }` do not exist** (E113).
- `::` is for namespaces (modules, enum variants, static methods, constructors), and `.` is for values. `io.printline` is E048, and `p::x` is E029.
- **Prelude** (no import needed): `int double bool char strings array io math sys`. Functions from `io`, `math` and `sys` can be called bare: `printline`, `print`, `input`, `abs`, `max`, `sqrt`, `exit`, `panic`. Functions from `strings`/`char`/`int`/... are reached as methods (`s.length()`, `c.is_digit()`, `n.abs()`) or qualified (`strings::trim(s)`).
- Everything else needs `import`: `list map set stack queue json http net fs os time random mem test`.
  - `import list::List;` makes `List` usable bare. `import list;` makes `list::List` available. They are separate grants, so write both if you use both spellings.
  - A file may write `m::` only for modules it imports itself (E145).
- Across modules, everything is **private unless `pub`**, and that includes struct fields inside a `pub struct` (E088). A `pub` function cannot expose a non-`pub` type (E089). A single-file program needs no `pub`.
- Generic type arguments are never written at a use site: `identity<int>(3)` and `Box<int>::default()` do not parse (E110). Put the type on the declaration instead: `mut b: Box<int> = Box::default();`. `mut l = List::default();` is E129.
- An array length can be a generic parameter: `fn<T, N: size> fill(v: T): T[N]`. `N` is never written at a call; it comes from an array argument or from the type the result is stored into (`mut z: int[8] = fill(0);`), else E129. Free functions only: on a struct, method or operator, as a type, or assigned, it is E150.

**Errors**
- Fallible functions return `!T`. A `!T` is not a `T`; resolve it with one of:
  - `expr recover produce fallback`
  - `expr recover run { ...must return/break/continue unless T is void... }`
  - `expr recover as err run { ... err.message ... compare err { ... } }`
  - or propagate it with `try expr` (only inside a function that itself returns `!V`, never in `main`, E095).
- `recover` binds more loosely than any operator, `=` and `+=` included: write `1 + (f() recover produce 0)` and `v = (f() recover run { ... });` (`v = f() recover ...` is E066).
- Payloads are read **only** by destructuring: `matches ParseError::Bad(at, text):`. Use `err.message` for the optional message string. `err == ParseError::Bad` compares only the variant.
- A `compare` on the `err` from `recover as err` always needs `otherwise:`, because the error union is open.
- Panics (bounds, overflow, `sys::panic`, a failed `test::assert`) abort the process with exit status 134. You cannot catch them.

**Collections, arrays, strings**
- `T[N]` is a fixed-size value type. Assignment copies it, and its size is part of the type. `mut a: int[1000];` reads as all zeros until written; `import arrays;` has `arrays::fill(0)`, `generate`, `reversed`, `map` (length from the target type; not the prelude `array`).
- Indexing accepts negative indices (`a[-1]` is the last element) and is bounds-checked. A constant out-of-range index is a compile error (E001).
- `arr[a..b]` is a view (`T[]`). A `T[]` cannot be returned or stored (E140); return `T[N]` or a `List<T>`.
- `List`, `Map`, `Set`, `Stack` and `Queue` are **handles**: assigning one shares it, so call `.copy()` for an independent one. `List::default()` is ready to use, and so is a defaulted struct field of collection type.
- `for v in list` is E005. Loop over `0..list.length()` and use `list[i]`.
- `list[i].field = v` is E098, because the index returns a copy. Read the element, change it and store it back: `mut e = l[i]; e.f = v; l[i] = e;`.
- `Map.get` / `map[k]` **panic** on a missing key. Use `m.try_get(k) recover produce dflt`, or check `m.contains(k)` first.
- Strings are immutable byte strings: `s.length()`, `s[i]` gives a `char`, and `strings::substring(s, start, end)` has an exclusive end. To build a string in a loop, use `strings::StringBuilder` (`append`, `append_char`, `to_string`), not repeated `+`.

**References and memory**
- `&T` is never null. `&?T` may be null and can only be used after a null check on a **variable**. For a field such as `node.next`, copy it into a local variable and check that (E081).
- Returning `&local` is E086. Return `heap(local)` instead, which copies the value to the GC heap and gives back a `&T`.
- A struct cannot contain itself by value (E069). Link nodes through `&?Node`.
- Raw pointers (`T*`, `ptr`), `extern fn` and pointer casts belong inside `unsafe { }` only. Ordinary functions may not take or return raw pointers (E130). You almost never need them; reach for `&T`/`&?T`, `List`, and `heap()` first.

## Writing complex logic well

- **Model data with structs, enums and `error` types first**, then write functions over them. Use a `machine` when a value moves through states with legal transitions. Match on a local copy of the state so the compiler proves each `.transition(...)` (see `examples/generic_stack_machine.tr`).
- **Follow the stdlib failure convention in your own code:**
  - return `!T` with a descriptive error variant for bad input or a bad environment;
  - `sys::panic` (from a `@caller_location` function, so the message names the caller's line) for a broken precondition, i.e. a bug in the caller;
  - `bool` or a sentinel for plain questions.
- Handle errors close to where you can do something about them. Otherwise use `try`. Put complex error handling in a small helper that turns the error into that helper's return value, since `return` inside `recover` leaves the enclosing function.
- **Generics have no trait bounds.** A generic body is checked separately for each concrete type. When `T` might lack an operation, pass the operation in as a function parameter (`less: fn(T, T): bool`), the way `List.sort(cmp: fn(T, T): int)` does.
- **Mutation through helpers:** pass `&value`, or make the helper a method, since `self` is a reference. Return new values for small structs.
- **Avoid deep recursion over big inputs**; stack overflow panics. Use loops with a `List` as an explicit stack.
- **Performance:** string `+` in a loop is quadratic, so use `StringBuilder`. `s.length()` and every checked `s[i]` measure the string (O(n)). In byte loops over long strings:
  - hoist the length (`immut n: int = s.length();`; a range `for` evaluates its bounds once, but a `while` condition re-evaluates on every pass);
  - read with `strings::byte_at_unchecked(s, i)` once the index is known to be in range. `List.push` is amortized O(1), and `Map`/`Set` are hash-based (struct keys need `operator ==`). Release builds keep all safety checks, and `-O2` is the default.
- Keep functions small. Cyclomatic complexity above 15 triggers a warning.

## Fixing bugs in existing Turf code

1. Reproduce: `turf check` for compile errors, `turf run` for behaviour. For runtime panics, the message names `file:line`. Debug with `-O0 -g` plus `gdb`/`lldb` (breakpoints by `file.tr:line`, locals by name), or add `printline` / `io::eprintline` traces (stdout is flushed before a panic message).
2. Read the diagnostic's `Fix:` (apply it), Hint and Notes. For generic code, the Notes list the instantiation chain from your call down to the failing line inside the library.
3. Fix the root cause rather than silencing the symptom. **There are no flags to disable checks or warnings**; the only way to silence a warning is to fix what it points at. Prefix intentionally unused variables with `_`.
4. Add a regression test (`tests/<name>.tr` that exits 0, or a `fail_<name>.tr` with `// EXPECT-DIAG: E0NN` for "must not compile"). See `references/projects-and-testing.md`.

## Rewriting or porting a codebase

Read `references/porting.md`. In short:
- map classes to a struct plus `fn Type.method` plus `new`;
- map exceptions to `error` types plus `!T`/`recover`/`try`;
- map null to `&?T`, and lambdas to named functions plus function values;
- map dynamic arrays to `List<T>` and dicts to `Map<K, V>`;
- map C pointers to `&T`, `&?T` or indices into a `List`.

Port module by module, `turf check` each file (`--module` for non-main files), keep the original's tests as Turf tests, and diff outputs.

## Quick command reference

```text
turf new NAME [--lib]          create a project (program, or library + program)
turf run [file.tr] [-- args]   build to a temp exe and run (project: src/main.tr)
turf build                     build the project → build/NAME
turf check [file.tr] [--module]  all diagnostics, no output file
turf test [paths]              run tests/ (see projects-and-testing.md)
turf fmt --write|--check [paths]  indentation/whitespace only
turf explain E0NN              long explanation of an error code
turf dump ast|resolved|typechecked|modules|symbols|instantiations file.tr
turf file.tr -o out [-O0..-O3|-Os] [-g] [--emit-llvm] [--emit-obj] [--link lib]
turf check file.tr --smart-write-fix=fixed.tr   (write the program with every Fix: applied)
turf file.tr --smart [--smart-write-fix=fixed.tr]
turf add NAME --path ../x | --git URL --tag v1   (project dependencies)
turf migrate pub [--write] mod.tr   (1.x → 2.0: add pub)
```
