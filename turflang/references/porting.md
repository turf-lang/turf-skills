# Porting code into (and out of) TurfLang

Turf has no classes, inheritance, interfaces, exceptions, closures, iterators, threads, unsigned integers, implicit conversions, or null strings. Everything below shows what to use instead. Port **module by module**, `turf check` each file as you go (`--module` for non-main files), and carry the original test cases over as Turf tests (`projects-and-testing.md`). Diff program outputs against the original.

## 1. Idiom map

| Source concept | Turf |
|---|---|
| `let x = 1` / `int x = 1` / `x := 1` | `mut x: int = 1;` (or `immut` if it never changes) |
| `const` / `static final` | `immut` local, or top-level `export immut NAME: int = 10;` (literal values only) |
| `class` with fields + methods | `struct` + `fn Type.method(...)` (implicit `self` by reference) |
| constructor | `fn Type.new(args): void { self.f = ...; }` called `Type::new(args)` (must set every field) |
| default / zero object | `Type::default()` |
| static method / class method | `fn Type.m(...) static: R`, called `Type::m(...)` |
| object literal `{x: 1, y: 2}` | `mut p: P = P::default(); p.x = 1; p.y = 2;` or `P::new(1, 2)` (no struct literals) |
| inheritance | composition: embed the "base" struct as a field; forward methods explicitly |
| interface / trait / virtual dispatch | (a) an `enum` tag + `compare` (closed set); (b) a struct holding function values `fn(...)` (open set); (c) generic `fn<T>` taking the operation as a parameter |
| generics `<T>` with bounds | `fn<T>` without bounds: the body is checked per type. Pass comparators/operations as `fn(T, T): R` |
| `x == y` on objects | declare `operator ==(a: T, b: T): bool` (and `!=`, `<` separately) |
| `toString()` / `__str__` | your own `fn T.to_string(): string` (or `describe`) building with `+` / `StringBuilder` |
| exceptions `throw` / `raise` | return an `error` variant from a `!T` function |
| `try/catch` | `call() recover as err run { compare err { matches E::V(p): ... done otherwise: ... } }` |
| rethrow / `?` operator | `try call()` (the function must return `!V`) |
| `finally` / RAII / `using` / `with` | `defer cleanup();` (block-scoped; not run on panic) |
| `assert` / precondition | `sys::panic(...)` in a `@caller_location` function, or `test::assert` in tests |
| `null` / `None` / `nil` / `Option<T>` | `&?T` (must be null-checked through a local variable); for values: a `bool` flag + value, or a fallible `!T` |
| pointer to struct `T*` / `&mut T` | `&T` parameter, pass `&x` |
| heap allocation `new T` / `Box::new` | `heap(value)` → `&T` (GC-managed, never freed by hand) |
| linked structures | fields of type `&?Node`, nodes made with `heap(...)` |
| `std::vector` / `ArrayList` / `list` / `[]T` | `List<T>` (`import list::List;`) |
| `HashMap` / `dict` / `map` | `Map<K, V>` (`import map::Map;`); struct keys need `operator ==` |
| `HashSet` / `set` | `Set<T>` |
| fixed C array `int a[10]` | `int[10]` (value type: copied on assignment and when passed) |
| array parameter / slice / span | `T[]` parameter or local view `a[lo..hi]` (cannot be returned or stored) |
| iterator / `for x in coll` | arrays: `for v in arr`; collections: `for i in 0..l.length() { l[i] }`; maps: `immut ks = m.keys(); for i in 0..ks.length() { m[ks[i]] }` |
| `enumerate` | `for (i, v) in arr` (arrays only) |
| `range(a, b, s)` | `for i in a..b step i += s` |
| C `for(;;)`, `while(1)` | `while true { ... }` |
| `switch` / `match` | `compare x { matches A: ... done otherwise: ... }` (no fallthrough; stack headers for "case A: case B:") |
| ternary `c ? a : b` | `c give a otherwise b` (parenthesize inside assignments) |
| lambda / closure | named top-level function + function value. Captured state becomes an explicit parameter or a struct field |
| callbacks with context | a struct `{ ctx: Data, f: fn(Data, int): int }`, call `s.f(s.ctx, x)` |
| `(int)x`, `int(x)`, `x as i64` | `x to int` |
| `str(n)`, `n.toString()` | `n to string` |
| `int("42")` / `parseInt` | `strings::parse_int(s)` returns `!int` (or `s to int`, which panics on bad text) |
| f-strings / `printf` / `format!` | concatenation: `"x=" + (x to string)`; padding: `strings::pad_left(s, n, ' ')` |
| string builder | `strings::StringBuilder` (`append`, `append_char`, `to_string`) |
| `s.charAt(i)` / `s[i]` | `s[i]` is a `char` (a byte). Compare with `'a'`. Code point: `s[i] to int` |
| `substr` / slicing | `strings::substring(s, start, end)` (end exclusive) |
| `split` / `join` / `trim` / `replace` / `find` | `strings::split(s, sep)` (→ `List<string>`), `strings::join(list, sep)`, `strings::trim`, `strings::replace`, `strings::index_of` (−1 if absent) |
| `print` / `println` / `console.log` | `print(x)` / `printline(x)` (int/double/bool/char/string only; convert others) |
| `stderr` | `io::eprintline(s)` (string only) |
| reading stdin | `input()` / `input("prompt")` (`""` at EOF) |
| files | `io::read_to_string(p)`, `io::read_lines(p)`, `io::write_string(p, s)` (all `!T`); directories in `fs` |
| `argv` / `env` | `os::argc()`, `os::argv(i)`, `os` env functions (`import os;`) |
| `exit(n)` | `exit(n)` (prelude `sys`) |
| JSON | `import json;` (`json::parse(text)` → `!JsonValue`; see `stdlib.md`) |
| HTTP / sockets | `import http;` / `import net;` |
| time / sleep / random | `import time;` / `import random;` (not cryptographic) |
| threads / async / goroutines | **none**: the runtime is single-threaded. Restructure as sequential code or an event loop |
| unsigned ints (`u8`, `uint32_t`, `size_t`) | `int` (64-bit signed); mask explicitly: `x & 0xFF`, `x & 0xFFFFFFFF` |
| wrapping arithmetic (hashes, PRNGs, C `unsigned` math) | Turf **panics on overflow**. Keep values in range by masking after each step (`(h * 31 + c) & 0xFFFFFFFF` stays far below 2^63), or use `double` where approximate is fine |
| `float` (32-bit) | `double` (there is no `float`; it is a reserved word) |
| `bool` ↔ int (`if (n)`, `sum += cond`) | `n != 0`; `cond give 1 otherwise 0` |
| `char` arithmetic `c - '0'` | `(c to int) - ('0' to int)` |
| bit fields / packed structs | plain `int` fields + masks; `sizeof` includes padding |
| `goto`, labeled break | restructure: extract a function and `return`, or use a flag (there are no labels) |
| macros / templates | functions, generics |
| global mutable variables | none (only `export immut` constants): pass state explicitly, usually in a struct by `&` |

## 2. Patterns worth copying

### Interface → enum dispatch (closed set)

```turflang
enum ShapeKind { Circle, Rect }

struct Shape {
    kind: ShapeKind,
    a: double,
    b: double
}

fn Shape.circle(r: double) static: Shape {
    mut s: Shape = Shape::default();
    s.kind = ShapeKind::Circle;
    s.a = r;
    return s;
}

fn Shape.rect(w: double, h: double) static: Shape {
    mut s: Shape = Shape::default();
    s.kind = ShapeKind::Rect;
    s.a = w;
    s.b = h;
    return s;
}

fn Shape.area(): double {
    compare self.kind {
        matches ShapeKind::Circle:
            return math::PI * self.a * self.a;
        done
        matches ShapeKind::Rect:
            return self.a * self.b;
        done
    }
}

fn main(): int {
    immut shapes: Shape[2] = [Shape::circle(1.0), Shape::rect(2.0, 3.0)];
    mut total: double = 0.0;
    for s in shapes {
        total += s.area();
    }
    printline(total);
    return 0;
}
```

### Interface → function values (open set) and closures → explicit context

```turflang
struct Scaler {
    factor: int,
    apply: fn(int, int): int      // (context, input) -> output
}

fn mul(factor: int, x: int): int { return factor * x; }

fn invoke(s: Scaler, x: int): int {
    immut f: fn(int, int): int = s.apply;
    return f(s.factor, x);
}

fn main(): int {
    mut s: Scaler = Scaler::default();
    s.factor = 3;
    s.apply = mul;
    printline(invoke(s, 14));        // 42
    return 0;
}
```

### Exceptions → error unions

```turflang
error BankError {
    Insufficient(balance: int, wanted: int),
    Frozen
}

struct Account { balance: int, frozen: bool }

fn Account.withdraw(amount: int): !int {
    if self.frozen { return BankError::Frozen; }
    if amount > self.balance { return BankError::Insufficient(self.balance, amount); }
    self.balance -= amount;
    return self.balance;
}

fn transfer(src: &Account, dst: &Account, amount: int): !void {
    try src.withdraw(amount);      // like `?` / rethrow
    dst.balance += amount;
    return;
}

fn main(): int {
    mut a: Account = Account::default();
    mut b: Account = Account::default();
    a.balance = 100;
    transfer(&a, &b, 150) recover as err run {
        compare err {
            matches BankError::Insufficient(have, want):
                printline("only " + (have to string) + ", wanted " + (want to string));
            done
            otherwise:
                printline("transfer failed");
        }
    };
    printline(b.balance);
    return 0;
}
```

### Wrapping hash (no overflow panics)

```turflang
fn hash(s: string): int {
    mut h: int = 5381;
    for i in 0..s.length() {
        h = (h * 33 + (s[i] to int)) & 0xFFFFFFFF;   // mask keeps h < 2^32, so *33 never overflows
    }
    return h;
}

fn main(): int {
    printline(hash("turf"));
    return 0;
}
```

### Optional value without null

Return `!T` (with an error such as `error NotFound;`) and let the caller choose `recover produce default`, or return a `bool` and write the value through a `&` parameter or struct. Use `&?T` only for genuinely nullable references (links, optional children).

## 3. Porting workflow for a whole codebase

1. **Inventory:** list the modules, data types, external dependencies (files, network, C libraries), and anything without a Turf equivalent (threads, reflection, dynamic typing, closures).
2. **Design the data first:** structs, enums, `error` types, ownership (what is a value, what is shared via `&T` or `heap`, what is a collection handle).
3. **Map files to modules:** one `.tr` per source module, with names that don't clash with stdlib modules (`list`, `map`, `json`, `strings`, `io`, `os`, `fs`, `time`, `random`, `mem`, `test`, `http`, `net`, `set`, `stack`, `queue`, `math`, `sys`, `array`, `char`, `int`, `double`, `bool`, `hashing`). Mark the API `pub`, fields included.
4. **Port leaf modules first** (no dependencies), and `turf check --module` each one before moving up.
5. **Translate tests** into `tests/*.tr` (one behaviour per file) and run `turf test`.
6. **Check runtime semantics that silently differ:**
   - integer overflow panics;
   - integer `/` truncates toward zero and `%` takes the dividend's sign;
   - double division by zero panics;
   - string indexing is by byte;
   - struct and array assignment copies, while collection assignment shares;
   - `defer` does not run on panic;
   - `Map` iteration order is whatever `keys()` returns, so sort if order matters.
7. **Remove leftovers:** `turf fmt --write`, then clear the warnings (unused variables, dead stores, shadowing).

## 4. Turf 1.x → 2.0

1. Run `turf migrate pub --write` on every module (not the main file), then remove `pub` from internals.
2. Add `import m;` for every `m::` use (E145).
3. Rename modules that clash with stdlib names (E090).
4. Rename identifiers called `guess`, `defer`, `caller_location`, `pub`, `public`, `try` or `_`.
5. Initialize every declared-but-unassigned variable (often with `T::default()`) (E008).
6. Fix literals and constants that don't fit their type (E076).
7. Change `s[i]` used as an int to `s[i] to int`.
8. Change `return &local;` to `return heap(local);` (E086).
9. Break by-value struct cycles with `&?T` (E069).
10. Move raw-pointer code into `unsafe` or an `unsafe module;`, and use `l[i]`/`l.get(i)` on collections.
11. Rewrite `int32` increments as `n = (n + 1) to int32;`.
12. Add the missing `bool` arms, and `otherwise` to every `compare` over a caught error (E093).
13. Apply the stdlib renames:
    - camelCase char methods become `is_digit` etc.;
    - `indexOf` becomes `index_of`, `tryGet` becomes `try_get`;
    - list wrappers become `l.sort(cmp)` / `l.binary_search(x, cmp)` / `l.find(pred)`;
    - `io::write_string`, `fs::mkdir/remove_*` and `os::set_env` now return `!void`, so handle them with `recover`.
14. Re-test for the runtime changes:
    - overflow panics;
    - out-of-range string-index panics;
    - qualified `typeof` strings;
    - `+=` using user operators;
    - `mem::free` of GC memory panics.

## 5. Porting out of Turf

- `!T` maps to `Result`/exceptions, and `recover produce` to `unwrap_or`.
- `&?T` maps to `Option<&T>` / nullable pointers, and `heap()` to `Box`/`new`.
- `List`/`Map` handles map to reference types (shared on assignment).
- Remember Turf's checked arithmetic: the target language may wrap or have UB where Turf panicked.
