# TurfLang 2.1 language reference (condensed)

Condensed from the official reference (`docs/reference/*.md` in the turf-lang repo). Every rule here comes from those pages. The codes in parentheses are what the compiler reports when you break the rule; look them up in `error-codes.md`.

Contents: 1 Lexical · 2 Variables & types · 3 Conversions · 4 Operators · 5 Control flow · 6 `compare` & patterns · 7 Errors · 8 Functions · 9 Modules & visibility · 10 Structs · 11 Enums · 12 State machines · 13 Generics · 14 Operator overloading · 15 Arrays & slices · 16 References & memory · 17 `unsafe` & FFI · 18 Built-ins

---

## 1. Lexical

- **Comments:** `//` to end of line only. There are no block comments.
- **Statements** end in `;`. Blocks use `{ }`. A `do { } while c;` loop needs its final `;`.
- **Reserved words:** `as bool break caller_location char compare continue defer do done double else elseif enum error export extern false float fn for give guess if immut immutable import in int int32 machine matches mut mutable null operator otherwise produce ptr pub public recover return run self sizeof static step string struct to true try unsafe void while`. `_` is the wildcard (E092 as a name).
  - Not reserved: `typeof`, `heap`, `hash_of`, `from`, `transition`.
  - Using a reserved word as a name is E108 (variables, functions) or E087 (`pub`).
- **Integer literals:** `42`, `1_000_000`, `0xFF`, `0b1010`, `0o17`.
  - `0755` is decimal 755, not octal.
  - No suffixes. A negative literal is unary `-`.
- **Float literals:** `1.5`, `.5`, `1e6`, `1.5e-3`. `5.` is E139.
- **Char literals:** exactly one byte: `'a'`, `'\n'`, `'\''`. `''` and `'ab'` are E101.
- **String literals:** `"..."`, single line only (E099 if unterminated).
- **Escapes:** `\n \t \r \0 \\ \' \" \a \b \f \v`. Any other escape is E100; there is no `\x41` or `\u`.
- **Literal range:** a literal must fit its destination type, and is never truncated (E076). An integer literal assigned to a `double` must be exactly representable (E077).

## 2. Variables and types

```text
(mut | mutable | immut | immutable) name [: Type] [= expr];
```

- `mut` variables can be reassigned; `immut` ones cannot (E060).
- `immut` requires an initializer (E128).
- **Inference** comes from the initializer: `mut n = 5;` gives `int`, and `mut x: guess = 2.5;` gives `double`.
  - Literal defaults: integer → `int`, float → `double`, `[a, b]` → `T[2]`.
  - Inference never applies to parameters, returns or fields.
  - `mut x = null;` and inferring from a `void` call are E129.
  - A generic type with nothing to infer from is E129 (`mut l = List::default();`).
  - An inferred type is fixed: `mut x = 5; x = 5.5;` is E066.
- **Definite assignment:** a `mut` declared without a value must be assigned on every path before it is read (E008).
  - A loop body may run zero times, so an assignment inside it does not count.
  - A struct counts as assigned only as a whole; writing a field of an unassigned struct is E008. Start from `T::default()`.
  - A fixed-size array `T[N]` is not tracked: it is zero-filled from its declaration, so `mut a: int[10];` can be read before any write (no E008). `(&T)[N]` and unsized `T[]` need an initializer (E128).
- **Shadowing** an outer variable is allowed but warns.

| Type | Notes |
|---|---|
| `int` | 64-bit signed. Overflow panics. |
| `int32` | 32-bit signed, a storage type for C interop. Arithmetic on it yields `int`. `++`, `--` and compound assignment on it are E126; write `n = (n + 1) to int32;`. Bitwise ops reject it (E057). |
| `double` | IEEE 754. Overflow gives `inf`, but division or remainder by zero **panics**. |
| `bool` | `true` / `false`. No numeric conversion at all. Only `==`/`!=`; ordering is E124. |
| `char` | One byte (0–255). No arithmetic (E057), no implicit conversion. Compare with char literals; `c to int` and `n to char` are the only casts. |
| `string` | Immutable NUL-terminated bytes, GC-allocated. `+` and comparisons come from stdlib operator overloads (always available). `s[i]` is a bounds-checked `char`, and negative indices count from the end. |
| `void` | Only valid as a return type (E112 elsewhere). |
| `T[N]`, `T[]` | Arrays and slices (§15). |
| `&T`, `&?T` | References (§16). |
| `T*`, `ptr` | Raw pointers, `unsafe` only (§17). |
| `fn(A, B): R` | Function types. |
| `!T` | Fallible result (§7). |

**Zero values** (what `T::default()` gives each field, and what an unwritten array element reads as):
- `0`, `0.0`, `false`, `'\0'` and `""` for the primitives;
- an enum's first variant;
- `null` for `&?T`, pointers and functions;
- a fresh default object for `&T`;
- recursive defaults for nested structs and arrays (a declared `T[N]` starts as these);
- empty, ready-to-use collections.

## 3. Conversions: `to`

`expr to Type` is the only explicit conversion. There is no `int(x)`, `x.to_string()` or `(int)x`.

| from \ to | int | int32 | double | bool | char | string | enum |
|---|---|---|---|---|---|---|---|
| int | | ok (low 32 bits) | ok | – | ok (low byte) | ok | ok (panics if out of range) |
| int32 | ok | | ok | – | – | – | – |
| double | ok (truncates; NaN/inf/out-of-range panics) | ok | | – | – | ok (`%g`) | – |
| bool | – | – | – | | – | ok | – |
| char | ok (0–255) | – | – | – | | – | – |
| string | ok (panics on bad text) | – | ok (panics on bad text) | – | – | | ok (by name; panics on unknown) |
| enum | ok (ordinal) | – | – | – | – | ok (name) | |

- **Implicit conversions** are only `int32 → int`, `int32 → double` and `int → double`. They apply to assignment, arguments and returns, never to operator overloads or generic inference.
- **Bad text:** `"abc" to int` with a literal is a compile error (E149). With run-time text it panics. For untrusted text use `strings::parse_int(s)` / `parse_double(s)`, which return `!int` / `!double`.
- **Text conversions:** there is no `char → string` cast and no struct or array `to string` (E065). Build a string from a char with `strings::StringBuilder.append_char`.
- **Precedence:** `to` binds looser than all arithmetic and bitwise operators and tighter than comparison, logic and assignment. So:
  - `1 + 2 to double` is `(1 + 2) to double`;
  - `"n=" + (n to string)` needs its parentheses;
  - `x to double * 2` is wrong (the `*` is read as a pointer type). Write `(x to double) * 2`.
- **References:** `r to T` copies the value out of a reference. `&?T to &T` is allowed only after a null check (E082).

## 4. Operators

Precedence from tightest to loosest:

1. postfix `[] () . ++ --`
2. prefix `- ! ~ ++ --`
3. `**` (right-associative)
4. `* / %`
5. `+ -`
6. `<< >>`
7. `&`
8. `^`
9. `|`
10. `to`
11. `< > <= >=`
12. `== !=`
13. `&&`
14. `||`
15. assignment (`= += -= *= /= %= &= |= ^= <<= >>= **=`, right-associative)
16. `c give a otherwise b`

Points that differ from C:

- **Bitwise binds tighter than comparison:** `x & 1 == 1` is `(x & 1) == 1`.
- **Unary binds tighter than `**`:** `-2 ** 2 == 4`.
- **`give/otherwise` is looser than assignment:** write `r = (c give a otherwise b);`. Both branches must have the same type (E066), and `otherwise` is mandatory.
- **Assignment** is an expression; its right side is evaluated first.
- **`&&` / `||`** short-circuit and take only `bool` (E057 for numbers). They cannot be overloaded.
- **Arithmetic:** `int op int` gives `int` and any `double` operand gives `double`. Integer `/` truncates toward zero, and `%` takes the dividend's sign. `%` works on doubles.
- **`**`:** `int ** int` gives an exact `int` (overflow panics, a negative exponent panics). A double on either side gives a double: `2 ** -1.0`.
- **Checked at run time:** `+ - *`, unary `-`, `++ --`, `<<` and `**` on `int` panic on overflow; `/ %` by zero panic (for doubles too); shift counts outside 0–63 panic. `>>` is arithmetic.
- **Comparison:** `int` vs `double` compares numerically. `char` vs `int` is E124. Strings compare by content and bytes. Structs need `operator ==` and friends, each declared separately.
- **`++` / `--`:** the postfix form yields the old value and the prefix form the new one. `---x` is a token error, so write `- - -x`.
- **Compound assignment** has the same checks as the base operator. There is no `~=`.

## 5. Control flow

```turflang
fn main(): int {
    mut n: int = 7;
    if n > 10 { n = 1; } elseif n > 5 { n = 2; } else { n = 3; }
    while n < 10 { n++; }
    do { n--; } while n > 3;                  // body runs at least once; ends with ;
    for i in 0..4 { n += i; }                 // 0,1,2,3
    for i in 0..10 step i += 3 { n += i; }    // 0,3,6,9
    for i in 5..0 step i-- { n += i; }        // 5,4,3,2,1 (descending needs a decreasing step)
    for x in 0.0..1.0 step x += 0.25 { n += 1; }   // a double loop variable
    immut a: int[3] = [1, 2, 3];
    for v in a { n += v; }                    // v is a copy
    for (i, v) in a { n += i * v; }
    return n;
}
```

- Conditions are `bool` with no truthiness (E066 for `if n`). Parentheses are optional, but braces are mandatory (E107).
- `elseif` is the preferred spelling (`else if` works). An `if` is a statement; for a value, use `give/otherwise`.
- **Range `for`:** `a..b` is half-open, and the bounds are evaluated once. The default step is `i++`. If start > end the loop runs while `i > end`, so give it a decreasing `step`.
  - The compiler warns about provably endless ranges.
  - `continue` still runs the `step`.
  - The loop variable is local to the loop.
  - `(i, v)` on a range is E120.
- **For-each** works only on arrays, slices and array literals. `List`, `Map`, strings and structs are E005; iterate them by index.
- **`break` / `continue`:** no labels. They act on the innermost loop, including from inside a `compare` arm or a `recover` block. Outside a loop they are E007.
- **A statement after `return/break/continue`** in the same block is E012. An unreachable block is warning E074.
- **`defer stmt;`** runs when the enclosing block exits (not the function):
  - deferred statements run LIFO, once per loop iteration if inside a loop;
  - the statement is evaluated when it runs;
  - a `return` value is computed before the defers run;
  - they do **not** run on a panic;
  - you cannot defer a block or a declaration;
  - a deferred statement cannot `return`/`break`/`continue` out of itself (E083) or use `try` (E095). Resolve fallible cleanup inside it: `defer close(f) recover run { ... };`;
  - a deferred loop needs a `;` after its `}`.

## 6. `compare` and patterns

```turflang
struct Point { x: int, y: int }
enum Color { Red, Green, Blue }

fn describe(p: Point): string {
    compare p {
        matches Point { x: 0, y: 0 }:
            return "origin";
        done
        matches Point { x, y } if x == y:      // bind both fields, then guard
            return "diagonal";
        done
        matches Point { x: 0, .. }:            // test x, ignore the rest
            return "on y axis";
        done
        otherwise:                             // last; no `done`
            return "elsewhere";
    }
}

fn warm(c: Color): bool {
    compare c {
        matches Color::Red:
        matches Color::Green:                  // stacked headers share a body
            return true;
        done
        matches Color::Blue:
            return false;
        done
    }                                          // exhaustive, so no return needed after it
}

fn main(): int {
    printline(describe(Point::default()));
    printline(warm(Color::Blue));
    return 0;
}
```

- **Arm syntax:** `matches <pattern> [if <guard>]: stmts done`. Each arm needs at least one statement, and a missing `done` is E058. `otherwise:` is optional, must come last, appears once, and has no `done`. A `compare` is a statement, not an expression.
- **Subjects:** `int`, `char`, `string`, `bool`, enum, machine, struct, `&T`, error value. A pattern of the wrong type is E059.
- **Top-level headers:**
  - a literal;
  - `Enum::Variant`;
  - a variable or expression (compared by equality; a bare name at the top level never binds);
  - `_` (anything);
  - a struct pattern `Name { field: pat, field, .. }`;
  - an error-variant pattern `Err::Variant(p1, p2, ..)`.
- **Inside struct and variant patterns:**
  - a bare name **binds** the field (it never compares with an outer variable; use a guard for that);
  - `_` ignores the field;
  - a literal or enum variant tests the field;
  - patterns nest;
  - `double` literals are not allowed (E092);
  - list every field or end with `..` (E092);
  - another module's private field cannot be named (E088).
- **Bindings** are immutable copies (E060 if assigned), scoped to that arm and its guard.
- **Stacked headers** must bind the same names and types.
- **Exhaustiveness without `otherwise`:**
  - enum, machine and `bool` subjects need every value covered by an unguarded arm;
  - a declared `error` type needs every variant covered by an unguarded pattern whose fields all match anything;
  - the `err` from `recover as err` always needs `otherwise:` or `matches _:`;
  - all of these are E093;
  - `int`, `string` and struct subjects need no coverage (an unmatched value does nothing).
- **Guarded arms** never count toward coverage.
- **Duplicate value patterns** are E133. An arm after a catch-all is warning E094.
- **Order:** headers are tried top to bottom, and the first match (including its guard) wins. The subject is evaluated once.

## 7. Errors: `error`, `!T`, `recover`, `try`

```turflang
error IOError {
    NotFound(path: string),
    Denied(path: string, mode: int),
    Timeout
}
error GeneralError;                      // bare form: one variant, GeneralError::DEFAULT

fn open(p: string, m: int): !int {
    if m == 0 { return IOError::NotFound(p); }
    if m == 1 { return IOError::Denied(p, 7, "no permission"); }   // N fields + optional message
    if m == 2 { return IOError::Timeout("took too long"); }         // message only
    return m;
}

fn load(p: string): !int {
    immut v: int = try open(p, 5);        // on failure: return the same error from load
    return v * 2;
}

fn code(p: string, m: int): int {
    return open(p, m) recover as err run {
        compare err {
            matches IOError::NotFound(path):
                printline("missing " + path);
                return 1;
            done
            matches IOError::Denied(_, mode) if mode == 7:
                return 2;
            done
            otherwise:
                printline(err.message);
                return 99;
        }
    };
}

fn main(): int {
    printline(code("a", 0) + code("b", 1) + code("c", 2));
    printline(load("x") recover produce -1);
    return 0;
}
```

- **Declaration:** `error Name { V1, V2(field: Type, ...), ... }`.
  - Fields can be any sized type except errors, `!T` and `void` (E096).
  - A variant with fields is not a value on its own (E096), except in `==` and patterns.
  - A fieldless variant is a value. `V()` is E135.
- **Construction:** positional, N arguments or N+1 where the last is the `string` message. Anything else is E096.
- **`!T`:** any `T`, including `!void` (return with a bare `return;`). The error union is **open**: any error type may be returned.
  - A `!T` cannot be used as `T` (E066 on assignment, E064 on return). Resolve it first.
  - The compiler warns when a `!T` function never returns an error.
- **Three `recover` forms** (E132 if `recover` follows a non-fallible expression):
  - `e recover produce v`: `v` must be exactly `T` (no widening; E066). Not allowed on `!void`.
  - `e recover run { ... }`: the block runs only on failure. Unless `T` is `void`, every path must leave with `return`/`break`/`continue` (E132).
  - `e recover as err run { ... }`: same rules, with the error bound as `err`. Inside it you can use `err.message`, `err == Type::Variant` (variant only) and `compare err { ... otherwise: }`. If every possible error is a bare `error X;`, this form is E016.
- **Inside a recover block,** `return` returns from the **enclosing function** and is checked against *its* return type (E064). `break`/`continue` act on the enclosing loop.
- **Precedence:** `recover` binds looser than every operator, `=` and `+=` too: `1 + (f() recover produce 0)`, `v = (f() recover run { ... });`. Unparenthesized `v = f() recover ...` is `(v = f()) recover ...` (E066). A declaration initializer needs no parentheses.
- **`try e`:** evaluates to the success value; on failure it returns the same error (same variant, payload and message) from the enclosing function, running pending defers.
  - The enclosing function must return `!V` for some `V` (any `V`).
  - E095 in `main`, in plain-returning functions, in `defer`, and on non-fallible operands.
  - It is a prefix operator, so `try a() + try b()` is fine.
- **`return f();`** with `f(): !T` inside a `!T` function passes the result through. It does not convert between `!T` types (E064).
- **Panics:** `sys::panic(msg)`, failed runtime checks and `test::assert` print to stderr, abort with exit status 134, and skip defers. They are uncatchable.
- **`@caller_location`** on a function (or `operator`) makes the keyword `caller_location` (a `"file.tr:line"` string) available inside it. Marked functions forward the location through chains of marked functions. They cannot be used as function values (E137). Using `caller_location` elsewhere is E084.

## 8. Functions

- **Shape:** `fn name(p: T, ...): R { }`. The return type is mandatory (E106). Non-void functions must return on every path (E009).
  - `void` parameters are E112, duplicate parameter names are E033, nested functions are E038.
  - Declaration order does not matter, and recursion and mutual recursion are fine.
  - Infinite self-recursion on every path is E010.
- **`main`** takes no parameters and returns `int` or `void`. Program arguments come from `os::argc()` / `os::argv(i)`.
- **Parameters are copies,** including structs and fixed arrays. To mutate the caller's struct, take `&T` and pass `&x`, then use `p.field` (there is no `*`).
  - For a primitive, the idiomatic approach is to return the new value, or keep it in a struct that you pass by `&`.
  - A `T[]` parameter is a view, so element writes reach the caller (E141 if the caller's array is `immut`).
- **Overloading** is by parameter count and types; the return type is ignored.
  - An exact match beats a widening match. Otherwise the first matching overload in the file wins.
  - No match is E056, a wrong argument count is E044, an unknown function is E041.
  - The same name with the same parameters is E011.
- **Function values:** `fn(A, B): R`. You can pass, store, return and put them in arrays: `(fn(int): int)[2]`.
  - They must be plain names that are visible bare. Overloaded names are E125, and qualified names like `m::f` are E137 (import the name or wrap it).
  - A generic function can be used as a value where the target function type fixes `T`.
  - There are **no lambdas or closures**. State must travel as explicit arguments or struct fields.
- **UFCS:** `x.f(args)` calls `f(x, args)` when `x`'s type has no method named `f`.
  - The receiver must match the first parameter exactly (except that `T[N]` fits `T[]`). Other arguments may widen.
  - Dot syntax reaches any visible (`pub`) free function in the program, not only those imported by this file.
  - This is how `s.length()`, `c.is_digit()`, `n.abs()` and `a.sum(3)` work.
- **Annotations** go on the line before `fn`, `operator` or `extern fn`, and before `pub`:
  - `@caller_location`;
  - `@ownership(acquires)` / `@ownership(releases: p)` (raw-memory tracking);
  - `@ffi(linux: sym)`.

```turflang
struct Counter { n: int }

fn bump(c: &Counter, by: int): void { c.n = c.n + by; }   // mutate through &
fn combine(a: int, b: int): int { return a * 10 + b; }
fn fold(xs: int[], f: fn(int, int): int, init: int): int {
    mut acc: int = init;
    for v in xs { acc = f(acc, v); }
    return acc;
}

fn main(): int {
    mut c: Counter = Counter::default();
    bump(&c, 5);
    immut digits: int[3] = [1, 2, 3];
    printline(fold(digits, combine, 0));   // 123
    printline(c.n);                        // 5
    return 0;
}
```

## 9. Modules and visibility

- **One file is one module**, named after the file (`shapes.tr` is `shapes`). The compiled file is the program (it has `main`). Top-level code consists only of declarations; nothing executes at the top level.
- **Imports:**
  - `import m;` gives `m::name`;
  - `import m::name;` gives bare `name`;
  - `import m::[a, b];`;
  - `import m::[*];` (all `pub` names, bare).
  - Each form grants only what it says. Imports are per-file and never re-exported.
  - Using `m::` without `import m;` in this file is E145.
- **Prelude:**
  - `int double bool char strings array io math sys` are always available.
  - Free functions of `io`, `math` and `sys` can be called bare (`printline`, `abs`, `max`, `sqrt`, `exit`, `panic`). Their constants stay qualified (`math::PI`).
  - The rest are reached by UFCS or qualified (`strings::trim(s)`).
  - A bare call checks this file's functions first, then this module's, then imported names, and the prelude last. So if you declare your own `max`, the prelude's `max` needs `math::max`.
- **Lookup:**
  - Single file: stdlib, then installed packages, then the importing file's directory, then the current directory.
  - Project: own `src/**`, then direct dependencies, then stdlib.
  - Exactly one file must answer to the name (E090 if two do), and module names are never paths.
  - A module must not share a name with a stdlib module (e.g. `list.tr`). Missing modules are E027, circular imports E019.
- **`::` vs `.`:** `::` names namespace members: `m::f()`, `Enum::V`, `Type::static_m()`, `Type::new()`, `m::Type::default()`. `.` reaches into values. E048 for `io.printline`, E029 for `var::x`, E052 for calling a static method through a value.
- **Constants:** `export immut LIMIT: int = 10;` must be top-level, must have a literal or foldable value, and is always public.
- **Visibility:** everything is private to its module unless marked `pub` (or `public`).
  - Applies to functions, methods, structs, enums, errors, machines, `extern fn`s **and each struct field**.
  - Enum variants and machine states follow their type. Operators follow their operand types; `pub operator` is E087.
  - Private use from another module is E088. A `pub` signature or field exposing a private type is E089.
  - `T::default()` works for any visible type.
  - In a single-file program, `pub` is irrelevant.
- **Types belong to their module:** `a::Node` and `b::Node` are different types. A bare name that could mean both is E085. Redeclaring a name in the same file is E034. `typeof` prints imported types qualified (`list::List<int>`).

## 10. Structs

```turflang
struct Account {
    owner: string,
    balance: int,
}

fn Account.new(owner: string): void {        // constructor: assign every field on every path (E049)
    self.owner = owner;
    self.balance = 0;
}
fn Account.deposit(amount: int): void { self.balance += amount; }      // self is a reference
fn Account.describe(): string { return self.owner + ": " + (self.balance to string); }
fn Account.bank_name() static: string { return "Turf Bank"; }          // no self; call with ::

fn main(): int {
    mut a: Account = Account::new("ada");
    a.deposit(50);
    immut b: Account = a;                   // a full copy (value semantics)
    a.deposit(1);
    printline(a.describe() + " / " + b.describe() + " @ " + Account::bank_name());
    return 0;
}
```

- **Declaration:** `struct Name { field: Type, ... }` (trailing comma optional). An empty `struct NS {}` works as a namespace for static methods. Duplicate fields are E114, `void` fields E112.
- **Construction:** only `T::default()` (zeroed, always available, cannot be declared; E051) or `T::new(args)` (your `fn T.new`, which returns `void` and assigns `self`). There is **no** `T { ... }` literal (E113).
  - `new` without a declaration is E050. `p.new()` is E045. `static new` is E046.
- **Methods:** `fn T.m(params): R` takes an implicit `self` by reference. Static methods are written `fn T.m(params) static: R` and called as `T::m()`.
  - `fn T::m` is the old syntax (E113). Unknown methods are E054.
  - Methods can be declared anywhere in the file.
  - An `immut` struct cannot call a method that mutates `self` (E060).
- **Value semantics:** assignment, parameters and returns copy the struct, nested structs and fixed arrays included. Collection fields are handles, so the copy shares them.
- **Comparison:** `==` is undefined unless you declare `operator ==` (E124).
- **No by-value self-containment** (E069): use `&?T` for links. A cycle through `&T` fields has no default (E147).
- **Local types:** structs, enums, machines and errors may be declared inside a function body. They have no methods, and names must be unique per file.

## 11. Enums

- **Declaration:** `enum Dir { North, East, South, West }`. Variants are bare names with ordinals 0, 1, ... in order. There are no explicit values or payloads (E105); payloads belong on `error` types.
- **Access:** `Dir::East`. `==`/`!=` work, but ordering does not (E124; cast to `int`). `Dir::default()` is E135. A struct field of enum type defaults to the first variant.
- **Conversions:** `d to int`, `d to string`, `"South" to Dir`, `2 to Dir`. Invalid run-time values panic, and an invalid constant is E127/E149.
- **Built-in members:** `Dir::COUNT`, `Dir::VALUES` (`Dir*`) and `Dir::NAMES` (`string*`). The last two are raw pointers and need `unsafe` to read. To loop over every variant safely, use `for i in 0..Dir::COUNT { immut d: Dir = i to Dir; }`.

## 12. State machines

```turflang
machine Door {
    Closed -> Open,
    Open -> Closed,
    Closed -> Locked,
    Locked -> Closed
}

fn main(): int {
    mut d: Door = Door::Closed;
    compare d {
        matches Door::Closed:
            d.transition(Door::Open);     // proven legal at compile time
        done
        otherwise:
            printline("not closed");
    }
    printline(d to string);
    return 0;
}
```

- **States** exist by appearing in edges, and their ordinal is the order of first appearance. A machine is an enum, so `==`, `to int/string`, `COUNT` and exhaustive `compare` all work. There is no `::default()`, so initialize with a state.
- **`v.transition(M::State)`:**
  - the receiver must be `mut`;
  - the argument must be written literally as a state of the same machine. A variable is E036; to choose the target at run time, `compare` and write one transition per arm.
- **Static checking:** inside a single-pattern `matches M::S:` arm over a **plain local variable**, the transition is checked at compile time (E035 if the edge does not exist). Everywhere else (fields like `self.state`, stacked arms, loops) it is checked at run time and panics on an illegal edge.
  - To get the compile-time proof for a struct field: copy it into a local, `compare` on the local, transition, then store it back.
- **Start states:** the warning "state X has no incoming transitions" is expected for a start state.

## 13. Generics

```turflang
import list::List;

struct Pair<A, B> { first: A, second: B }

fn<A, B> Pair.swap(): Pair<B, A> {          // methods repeat the struct's type params (E138)
    mut r: Pair<B, A> = Pair::default();
    r.first = self.second;
    r.second = self.first;
    return r;
}

fn<T> max_by(items: List<T>, less: fn(T, T): bool): T {
    mut best: T = items[0];
    for i in 1..items.length() {
        if less(best, items[i]) { best = items[i]; }
    }
    return best;
}

fn shorter(a: string, b: string): bool { return a.length() < b.length(); }

fn main(): int {
    mut p: Pair<int, string> = Pair::default();   // the type args come from the declaration
    p.first = 1;
    p.second = "one";
    immut q: Pair<string, int> = p.swap();
    mut words: List<string> = List::default();
    words.push("a");
    words.push("abc");
    printline(q.first + " " + max_by(words, shorter));
    return 0;
}
```

- **Monomorphized:** each instantiation is compiled and type-checked on its own, with no boxing. `sizeof(T)` is the real size. Unused instantiations are never compiled.
- **Declaration:** `fn<T, U> f(...)`, `struct S<T> { }`, `fn<T> S.method()`, `operator<T> + (...)`. A method can add type parameters of its own: `fn<A, B, U> Pair.pick(x: U): U`.
- **Inference only:**
  - For functions, type arguments are inferred from the arguments. Every type parameter must appear in the parameter list (`fn<T> make(): T` is E129). Arguments must agree exactly, with no widening (`pair(1, 2.5)` is E056).
  - For generic structs, type arguments come from the declared type of the destination (variable, field, parameter, return, element).
  - **Size parameters:** `fn<T, N: size> fill(value: T): T[N] { mut r: T[N]; for i in 0..N { r[i] = value; } return r; }`. `N` is an array length that reads as an `int` in the body and is a free-function-only parameter. A call gets `N` from an array argument (`reversed(a)`) or else from the type the result goes into: a written declaration type, an assignment target, a non-generic parameter, a `return` with a written return type (`mut z: int[8] = fill(0);`). Nothing gives `N` (`mut d = fill(0);`, a bare `fill(0);`): E129. `N` on a struct, method or operator, `N` used as a type, a same-named value parameter, or `N = 3` / `N++` / `&N`: E150. Copy it to change it: `mut n: int = N;`.
  - **Never write `f<int>(x)` or `S<int>::default()`** (E110).
  - Generic types without arguments are E138; the wrong argument count is E148.
- **No constraints or traits:** the body may use any operation; the instantiation fails at your call site if `T` lacks it. The error is the normal code (E124, E057, E068, E131), with `Note:` lines showing the instantiation chain. To accept types without an operation, take a function parameter.
- **Limits:** recursion depth 64 or too many instantiations is E079. A by-value cycle through instantiation is E069.

## 14. Operator overloading

- **Top-level declarations:** `operator +(a: V, b: V): V { ... }`. Binary: `+ - * / % ** & | ^ << >> == != < > <= >=`. Unary: `- ! ~`. Indexing: `[]` `(container, index)` and `[]=` `(container, index, value)`.
- **Matching:** operands must match **exactly**, with no widening and order significant. `v + 1.0` against `operator +(V, int)` is E057, and `1 + v` needs its own declaration.
- **Each comparison is separate:** `==` does not give `!=`, and `<` does not give `<=`.
- **Compound forms:** `a += b` uses `operator +`, and the result type must equal `a`'s type (E066). `x++`/`x--` call `+`/`-` with the int `1`. There is no `operator +=`.
- **Not overloadable:** `&& || = . () to` (E110).
- **Ownership:** at least one operand must be a struct or enum declared in **this module** (E080 orphan rule). All-primitive operands are E028. There is no `pub` (E087); operators are visible wherever their types are.
- **Indexing:** declare the `[]=` container as `&T` so writes reach the caller. `x[i].field = v` on a user `[]` result is E098. `x[i] += 1` through `operator []` is E126; write `x[i] = x[i] + 1`.
- **Generic operators:** `operator<T> [](l: List<T>, i: int): T`. Every type parameter must appear in an operand (E097).

## 15. Arrays and slices

- **Fixed arrays:** `T[N]`, where `N` is a positive literal (0 is E123). The size is part of the type. Literals: `[1, 2, 3]`. Literal size and element types are checked (E003, E004).
  - `mut a: int[] = [1, 2];` infers `int[2]`.
  - Multi-dimensional: `int[2][3]` with nested literals. Only the outermost size can be inferred.
- **Value semantics:** assignment and `T[N]` parameters copy. Returning a `T[N]` is fine.
- **Indexing:** `a[i]` with `-N <= i < N`. A constant out-of-range index is E001, a run-time one panics. Compound assignment on elements works.
- **`T[]` (unsized):**
  - Allowed only as a parameter type or a local view variable.
  - Never as a field, return, generic argument, function type, reference target or `extern` parameter (E140).
  - A parameter `T[]` accepts any length and knows it (`a.length()`, for-each). Only the outermost dimension may be unsized (`int[][3]`).
- **Slices:** `a[lo..hi]`, `a[lo..]`, `a[..hi]`, `a[..]` are O(1) views sharing storage.
  - Negative bounds count from the end. `a[4..2]` is an error; `a[i..i]` is an empty slice.
  - A constant bad range is E143, a run-time one panics.
  - A `mut` view of an `immut` array is E144. A slice is not an assignment target (E061).
  - Strings and `List` cannot be sliced (E142); use `strings::substring`.
  - A `T[]` cannot become a `T[N]` (E003/E056).
- **`a.copy()`:** an independent GC-backed `T[]`. `length()` and `copy()` are the only built-in array methods. The prelude `array` module adds `sum/max/min/contains/index_of(arr, len[, val])` for `int`, `double` and `string` arrays. To build a whole array use the (non-prelude) `arrays` module: `import arrays;` `arrays::fill/generate/reversed/map` (see stdlib.md).
- **Zero fill:** `mut a: int[N];` reads as zeros (`0`, `0.0`, `false`, `""`, `null`, zeroed structs) until written; no initializer needed.
- **Arrays of references:** `(&Node)[N]` must be initialized (E128). `(&?Node)[N]` starts all-null. An array literal of `null`s (`[null, null]`) or of `&n` takes a `(&?Node)[N]` type in an assignment, argument, `return` or field value, not only a declaration. Function-value arrays: `(fn(int): int)[N]`.

## 16. References and memory

- **Storage:** the stack (primitives, structs, `T[N]`, collection handles), the GC heap (produced strings, collection storage, `heap(expr)`), and the manual heap (`mem::alloc`, inside `unsafe` only). There are no finalizers; use `defer` for OS resources.
- **`&T`:** a non-null reference made with `&var`, `&s.field`, `&a[i]`, or `heap(expr)`. Use it like the value: `r.field`, `r.method()`. Assigning `null` to it is E062.
- **`&?T`:** nullable. Before reading through it, a **local variable** must be null-checked (`if r != null { }`, `if r == null { return; }`, `while r != null`, `&&` chains). Otherwise E081.
  - A field such as `n.next` must first be copied: `mut nx: &?Node = n.next; if nx != null { ... }`.
  - `&T` widens to `&?T` implicitly.
- **`heap(expr)`:** copies the value to the GC heap and returns a `&T` that lives as long as it is reachable. Use it to return or store anything you built locally.
- **Escape rules (E086):** a reference to a local (or into a local array) cannot be:
  - returned;
  - stored into a field that outlives the call;
  - pushed into a collection;
  - boxed with `heap`;
  - put in an error payload;
  - smuggled out inside a struct or array.
  - Use `heap(local)` instead, or a reference you received as a parameter.
  - This is per-function analysis, not a borrow checker: references passed into another function and stored there are not tracked.
- **Collections are GC handles:** `List`, `Map`, `Set`, `Stack` and `Queue` values share storage on assignment; use `.copy()` for an independent one.
- **Guarantees in code without `unsafe`:** no out-of-bounds access, no use of a collected object, no null dereference of `&?T`, and overflow and division-by-zero always panic. Stack overflow and out-of-memory also panic with a message.

## 17. `unsafe` and FFI

- **`extern fn`:**
  - `extern fn strlen(s: string): int;` binds a libc symbol. `extern from "m" fn sqrt(x: double): double;` also links `-lm`.
  - `...` declares a variadic function. `--link lib` adds further libraries.
  - Declare C `int` as `int32`, `long`/`size_t` as `int`, `char*` as `string`, `void*` as `ptr`/`void*`, callbacks as function types.
  - The compiler trusts the signature; getting it wrong is undefined behaviour.
- **Raw pointers:** `T*` and `ptr` (untyped) may only be declared, cast or dereferenced inside an `unsafe { }` block, including structs with pointer fields (declare them inside `unsafe { }`). Otherwise E130.
  - `p[i]` is unchecked.
  - Ordinary functions may never take or return raw pointers, even inside `unsafe` (E130); use `&T`/`&?T`.
- **`unsafe module;`** at the top of a file lifts the gate for that file. A single-file compile honors it only with `--allow-unsafe-modules`; in a project, it requires `[unsafe] allow = ["pkg"]` in the dependent's manifest.
- **Manual memory:**
  - `mem::alloc`/`mem::free` belong inside `unsafe`.
  - Calling `mem::free` on GC memory panics (cross-heap free).
  - `@ownership(acquires)` / `@ownership(releases: p)` on `extern fn`s enable compile-time double-free (E017) and use-after-free (E018) detection within one function.
  - `mem::root(p)` / `mem::unroot(p)` pin GC objects that only C can see.

## 18. Built-ins (no import)

- `sizeof(Type)` takes a type, not a variable (E109/E042) and returns an `int` constant. Results include padding.
- `typeof(expr)` returns the static type name as a `string`, qualified for imported types: `"list::List<int>"`.
- `hash_of(expr)` returns an `int` that is equal for `==` values. `Map`/`Set` use it, so struct keys need a field-wise `operator ==`.
- `heap(expr)` returns a `&T` (§16).
- `caller_location` is a keyword, valid only inside `@caller_location` functions.
