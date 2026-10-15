# TurfLang standard library reference (2.x)

Lookup reference. Signatures are copied from `docs/reference/stdlib/*.md` and checked against `lib/std/**`. Fallible functions return `!T`.

## Conventions

- **Prelude (no import):** `int double bool char strings array` (methods/operators/`strings::x`, `array::x` only; bare `is_digit(c)` is E041) and `io math sys` (every public function also callable bare: `printline`, `abs`, `max`, `sqrt`, `exit`, `panic`). Constants stay qualified (`math::PI`). A user function with the same name hides the prelude's bare name; `math::max` still reaches it.
- **Need import:** `arrays list stack queue map set hashing net fs os time random mem json http test`.
- **Import forms:** `import list::List;` lets you write `List<int>` (not `list::List`); `import list;` lets you write `list::List<int>` (not `List`). Need both spellings => write both imports. Non-generic modules: `import fs;` then `fs::mkdir(...)`.
- **Naming:** functions/methods/fields `snake_case`; types `PascalCase`; constants `UPPER_CASE`. One spelling per name, no aliases.
- **Failure convention:**
  - environment/input failure (missing file, bad number, refused connection) => returns `!T` with an error variant carrying what failed; `err.message` gives text. Handle with `recover`.
  - violated precondition (empty pop, bad index, `random_int(7,3)`) => panic; message prefixed with the **caller's** `file:line:`.
  - question (is it there?) => `bool` or sentinel (`-1` from `index_of`, `""` from `os::env`).
- **Pairs:** `Map.get(k)` panics on miss / `Map.try_get(k): !V` / `Map.contains(k)`. `JsonValue.get(k)` panics / `JsonValue.has(k)`. `Request.get_header(n)` panics / `Request.has_header(n)`. `Server.get_route(p)` panics / `Server.has_route(p)`.
- **Recover forms:** `x recover produce DEFAULT`, `x recover run { ...; return ...; }`, `x recover as err run { ... }`. A `!void` is handled the same (`fs::mkdir(p) recover run {...};`). An unhandled `!void` silently discards the failure. Match error payloads: `compare err { matches io::FileError::NotFound(path): ... done otherwise: ... }`; `err == mod::Err::Variant` compares variant only.
- **Collections are handles:** `=`, passing, returning, storing in a field all SHARE one collection. `.copy()` makes an independent one. A struct holding a collection copies the handle. `immut` collection forbids mutating calls (E060). `T::default()` is an empty ready collection; `mut l: List<int>;` with no initializer is E008.
- **Resources:** no finalizers. Types owning an OS resource have `close()`; use `defer conn.close();` (runs on every exit incl. each loop pass). `io` file functions open/close per call, no close needed.
- **UFCS:** `s.length()` == `strings::length(s)`; `n.gcd(m)`; `c.is_digit()`; `a.sum(3)`; works on literals (`"hi".length()`, `(-12).gcd(18)` needs parens for negatives).
- **Strings:** bytes, not Unicode chars. Concatenation `"id " + 5` is E057: use `(5 to string)`.
- **2.x stability:** every `pub` item is frozen until 3.0.

---

## strings   (prelude)

Operators: `+` concat; `== != < > <= >=` compare contents bytewise. `s[i]`: byte as `char`, valid `-n..n-1` (negative counts from end), else panics `String index out of bounds`; write `s[i] = c;` checked only below zero.

| Signature | Notes |
|---|---|
| `length(s: string): int` | bytes |
| `strlen(s: string): int` | C binding; prefer `length` |
| `byte_at_unchecked(s: string, i: int): char` | no bounds check (UB if out of range); use in hot loops (`s[i]` is O(n) per access) |
| `contains(s: string, needle: string): bool` | empty needle -> true |
| `index_of(s: string, needle: string): int` | first offset or `-1`; `""` -> 0 |
| `last_index_of(s: string, needle: string): int` | last offset or `-1`; `""` -> `s.length()`; overlaps count |
| `starts_with(s: string, prefix: string): bool` | |
| `ends_with(s: string, suffix: string): bool` | |
| `count_char(s: string, ch: int): int` | `ch` is an int byte code: `s.count_char('l' to int)` |
| `substring(s: string, start: int, end: int): string` | `[start, end)`; PANICS if `start<0`, `end<start`, `end>length`; no negative indices |
| `repeat(s: string, n: int): string` | `""` if `n <= 0` |
| `replace(s: string, old: string, new_str: string): string` | all non-overlapping, left to right; unchanged if `old == ""` |
| `to_upper(s: string): string` / `to_lower(s: string): string` | ASCII only |
| `trim(s) / trim_start(s) / trim_end(s): string` | whitespace = space, tab, `\n`, `\r` |
| `pad_left(s: string, target_len: int, pad_char: char): string` | never truncates |
| `pad_right(s: string, target_len: int, pad_char: char): string` | |
| `split(s: string, delimiter: string): List<string>` | empty pieces kept; `""` or absent delimiter -> one-element list of `s` |
| `join(items: List<string>, sep: string): string` | `""` for empty list |
| `parse_int(s: string): !int` | base 10, optional leading `-`; rejects empty, bare `-`, leading `+`/space, trailing junk, out-of-range. `"007"` -> 7 |
| `parse_double(s: string): !double` | optional `-`, digits with at most one `.`, optional `e/E[+-]digits` (`".5"`, `"5."`, `"1e10"` ok); no inf/nan/hex |

Error: `error StringParseError { InvalidInt, InvalidDouble }` (no payload; `parse_int` -> `InvalidInt`, `parse_double` -> `InvalidDouble`).

`to` conversions: `n to string`, `x to string` (`%g` style), `b to string`; `s to int` / `s to double` PANIC on bad text (use `parse_*` for untrusted input); `c to int`, `n to char`.

### StringBuilder
`strings::StringBuilder::default()`; passed by value like a struct (take `&strings::StringBuilder`, call with `&sb`, to append in a callee). Fields private.

| Method | Notes |
|---|---|
| `append(s: string): void` | |
| `append_char(c: char): void` | |
| `reserve(extra: int): void` | optimisation; panics if `extra < 0` |
| `length(): int` | bytes so far |
| `clear(): void` | keeps storage |
| `to_string(): string` | a copy, `""` if empty |

```turflang
import list::List;

fn main(): int {
    mut parts: List<string> = "a,,b".split(",");
    printline(parts.length());              // 3
    printline(strings::join(parts, ";"));   // a;;b
    immut n: int = strings::parse_int("nope") recover produce -1;   // -1
    mut sb: strings::StringBuilder = strings::StringBuilder::default();
    sb.append("hello");
    sb.append_char(' ');
    printline(sb.to_string());
    return 0;
}
```

---

## int   (prelude; methods only: `n.gcd(m)`, never `int::gcd`)

| Signature | Notes |
|---|---|
| `is_even(n: int): bool` / `is_odd(n: int): bool` | `is_odd(-3)` true |
| `is_positive(n: int): bool` / `is_negative(n: int): bool` / `is_zero(n: int): bool` | |
| `gcd(a: int, b: int): int` | of `abs`; `gcd(0,0)=0` |
| `lcm(a: int, b: int): int` | never negative; 0 if either is 0 |

`gcd`/`lcm` panic `Integer overflow` if result doesn't fit. `abs/min/max/clamp/power` live in `math`.

## double   (prelude; methods only)

| Signature | Notes |
|---|---|
| `sign(x: double): double` | 1.0 / -1.0 / 0.0 (0.0 for NaN) |
| `is_positive(x: double): bool` / `is_negative(x: double): bool` / `is_zero(x: double): bool` | |
| `is_integer(x: double): bool` | finite whole number; false for NaN/inf |
| `round(x: double): double` | half away from zero |
| `floor(x: double): double` / `ceil(x: double): double` | |

round/floor/ceil delegate to libm: exact for all doubles, NaN/inf pass through. No `is_nan`: use `x != x`.

## bool   (prelude; methods only)

`logical_xor(a: bool, b: bool): bool`, `logical_nand(a: bool, b: bool): bool`, `logical_nor(a: bool, b: bool): bool`, `implies(a: bool, b: bool): bool` (`!a || b`). All evaluate both args. (`^` is bitwise on int; no bool xor operator.)

## char   (prelude; ASCII only; methods only)

`is_digit`, `is_upper`, `is_lower`, `is_alpha`, `is_alphanumeric`, `is_punctuation` (printable ASCII 33..126 non-alnum), `is_whitespace` (space, tab, `\n`, `\r`): each `(c: char): bool`. `to_upper(c: char): char`, `to_lower(c: char): char` (non-letters unchanged). `'a'.to_upper()` is char, `"a".to_upper()` is string. Arithmetic via `c to int` / `n to char`.

## array   (prelude; `a.sum(3)` or `array::sum(a, 3)`)

Every function takes `len: int` after the array and looks at the first `len` elements; `len` larger than the array panics `Array index out of bounds`. Pass `a.length()` for all. Overloads per element type (no generic version; use `List<T>` otherwise).

| Signature | Notes |
|---|---|
| `sum(arr: int[], len: int): int` / `sum(arr: double[], len: int): double` | `len<=0` -> 0 |
| `max(arr: int[], len: int): int` / `max(arr: double[], len: int): double` | starts at `arr[0]`; `len==0` returns `arr[0]`; empty array panics |
| `min(arr: int[], len: int): int` / `min(arr: double[], len: int): double` | same |
| `contains(arr: int[], len: int, val: int): bool` (also `double[]`, `string[]` with matching `val`) | string compares contents |
| `index_of(arr: int[], len: int, val: int): int` (also `double[]`, `string[]`) | first index or `-1` |

Slices are arrays: `ints[1..4].sum(3)`.

## arrays   (`import arrays;`; qualified calls only; NOT the prelude `array` above)

Builds whole fixed-size arrays. Each returns a new `T[N]` and changes nothing it is given. `N` is never written: it comes from an array argument, or from the type the result is stored into (written declaration type, assignment target, non-generic parameter, `return` with a written return type); otherwise E129 (`mut w = arrays::fill(0);`). Wrong target type is E004.

| Signature | Notes |
|---|---|
| `fill(value: T): T[N]` | `N` copies of `value`; `T` needs a zero value (not `&T`: `(&Node)[2]` is E128; use a `(&?Node)[N]` from a `&?Node`) |
| `generate(f: fn(int): T): T[N]` | `f(0)`, ..., `f(N - 1)` |
| `reversed(a: T[N]): T[N]` | last element first |
| `map(a: T[N], f: fn(T): U): U[N]` | same length, element type may change |

```turflang
import arrays;
import io;

fn square(i: int): int {
    return i * i;
}

fn label(i: int): string {
    return "n" + (i to string);
}

fn main(): int {
    mut zeros: int[1000] = arrays::fill(0);
    mut sq: int[5] = arrays::generate(square);
    mut back: int[5] = arrays::reversed(sq);
    mut texts: string[5] = arrays::map(sq, label);
    io::printline(back[0] + zeros[999]);   // 16
    return 0;
}
```

---

## io   (prelude; bare or `io::`)

| Signature | Notes |
|---|---|
| `print(val)` / `printline(val)` for `int`, `double`, `bool`, `char`, `string` | other types: E025; convert with `to string`. double is `%g` style, NaN is `nan`, bool `true`/`false` |
| `flush(): void` | stdout is buffered; flushed on main return, exit, abort, panic. Call before waiting for input |
| `eprint(val: string): void` / `eprintline(val: string): void` | stderr, unbuffered, string only |
| `input(): string` / `input(msg: string): string` | one line without newline; `""` at EOF (cannot distinguish from empty line); `\r` kept; `msg` printed and flushed first |
| `read_to_string(path: string): !string` | `NotFound(path)` if cannot open (any reason); `ReadFailed(path)` on short read |
| `read_lines(path: string): !List<string>` | all failures reported as `NotFound(path)`; split at `\n`, no trailing empty element (`"a\nb\n"` -> `["a","b"]`, `"a\n\n"` -> `["a",""]`), `\r` kept, empty file -> empty list |
| `write_string(path: string, content: string): !void` | creates or OVERWRITES; `WriteFailed(path)` if cannot open (missing dir/permission) or short write |
| `exists(path: string): bool` | can be opened for reading; true for dirs on Linux (use `fs::is_dir`) |

```turflang
error FileError {
    NotFound(path: string),
    ReadFailed(path: string),
    WriteFailed(path: string),
}
```

No file handle (whole-file ops, nothing to close). Files are bytes, no newline translation; a string ends at its first NUL.

```turflang
import list::List;

fn main(): int {
    io::write_string("notes.txt", "first\nsecond\n") recover as err run {
        compare err {
            matches io::FileError::WriteFailed(path):
            eprintline("cannot write " + path);
            done
            otherwise:
            eprintline("write failed");
        }
        return 1;
    };
    immut lines: List<string> = io::read_lines("notes.txt") recover run {
        eprintline("cannot read notes.txt");
        return 1;
    };
    mut i: int = 0;
    while i < lines.length() {
        printline((i + 1 to string) + ": " + lines.get(i));
        i = i + 1;
    }
    immut text: string = io::read_to_string("missing.txt") recover produce "(none)";
    printline(text);
    return 0;
}
```

(`defer` is not needed for `io` file calls; use it for `net` sockets, see net section.)

## sys   (prelude)

| Signature | Notes |
|---|---|
| `exit(code: int): void` | immediate; does NOT run pending `defer`; flushes stdout |
| `abort(): void` | SIGABRT (status 134 on Linux/macOS); flushes stdout |
| `panic(msg: string): void` | writes `msg` + newline to stderr, then aborts; no `file:line:` prefix added |
| `STDERR_FD: int` | `2` |

---

## math   (prelude; bare or `math::`; constants qualified)

Constants: `PI: double`, `E: double`.

| Signature | Notes |
|---|---|
| `pow(base: double, exp: double): double` | libm; NaN/inf, never fails |
| `sqrt(val: double): double`, `sin`, `cos`, `tan`, `floor`, `ceil`, `round`, `fabs`, `log`, `log2`, `log10`, `exp` (all `(val: double): double`) | libm. `sqrt(-1.0)`=nan, `log(0.0)`=-inf; `round` half away from zero |
| `abs(val: int): int` / `abs(val: double): double` | `abs(int)` of min int panics `Integer overflow` |
| `min(a: int, b: int): int` / `min(a: double, b: double): double` | |
| `max(a: int, b: int): int` / `max(a: double, b: double): double` | |
| `clamp(val: int, min_val: int, max_val: int): int` / `clamp(val: double, min_val: double, max_val: double): double` | need `min_val <= max_val` |
| `power(base: int, exp: int): int` | via float pow, TRUNCATES toward zero (`power(2,-1)`=0), inexact beyond 2^53, panics `Integer overflow` if too big |
| `power(base: double, exp: double): double`, `power(base: int, exp: double): double`, `power(base: double, exp: int): double` | |
| `divide(a: int, b: int): !int` / `divide(a: double, b: double): !double` | `MathError::DivisionByZero` when `b` is 0/0.0; int division truncates toward zero. (`/` on ints panics on zero) |

Error: `error MathError { DivisionByZero }`.

---

## list   (`import list::List;`)  `List<T>`

Growable array. `mut l: List<int> = List::default();`. **Gotchas:** `for x in l` is E005; iterate by index (`while i < l.length()`). `l[i].f = v` / `l[i].method-that-assigns-self()` is E098: do `mut e: T = l[i]; e.f = v; l[i] = e;` (but `grid[i][j] = v` and `outer[i].push(v)` are fine, elements that are collections are handles). Fields private (E088).

| Signature | Notes |
|---|---|
| `push(item: T): void` | append, amortised O(1) |
| `pop(): T` | removes last; PANICS if empty |
| `length(): int` | |
| `get(i: int): T` / `set(i: int, value: T): void` | `0 <= i < length()` only (negative panics) |
| `l[i]` / `l[i] = v` | `-length() <= i < length()`; negative counts from end; panics otherwise |
| `copy(): List<T>` | independent, shallow-by-value |
| `sort(cmp: fn(T, T): int): void` | in place, stable insertion sort O(n^2); cmp returns <0/0/>0 |
| `binary_search(target: T, cmp: fn(T, T): int): int` | index or `-1`; list MUST be pre-sorted by same cmp (unchecked) |
| `find(predicate: fn(T): bool): int` | first matching index or `-1` |

Function args are passed by name (`people.sort(by_age)`); wrong shape is E056. No sort on Stack/Queue/Map/Set.

```turflang
import list::List;

struct Person { name: string, age: int }

fn Person.new(name: string, age: int): void { self.name = name; self.age = age; }
fn by_age(a: Person, b: Person): int { return a.age - b.age; }
fn is_adult(p: Person): bool { return p.age >= 18; }

fn main(): int {
    mut l: List<int> = List::default();
    l.push(1); l.push(2); l.push(3);
    l[1] = 20;
    l.set(2, 30);
    printline(l[-1]);                 // 30
    for i in 0..l.length() { printline(l.get(i)); }
    mut c: List<int> = l.copy();      // independent; `= l` would share
    c.push(4);

    mut people: List<Person> = List::default();
    people.push(Person::new("ada", 36));
    people.push(Person::new("kid", 9));
    people.sort(by_age);              // kid, ada
    printline(people[0].name);        // kid
    printline(people.find(is_adult)); // 1
    return 0;
}
```

## stack   (`import stack::Stack;`)  `Stack<T>`
`push(item: T): void`; `pop(): T` (panics if empty); `peek(): T` (panics if empty); `length(): int`; `copy(): Stack<T>`. Create `Stack::default()`.

## queue   (`import queue::Queue;`)  `Queue<T>`
`enqueue(item: T): void`; `dequeue(): T` (panics if empty); `peek(): T` (panics if empty); `length(): int`; `copy(): Queue<T>`. Create `Queue::default()`.

## map   (`import map::Map;`)  `Map<K, V>`

Hash map. `mut m: Map<string, int> = Map::default();`. Keys: int/char/bool/enum/double by value (`-0.0`==`0.0`; NaN never found); string by CONTENT; struct needs `operator ==` (else E011) and `a == b` must imply same hash; arrays cannot be keys.

| Signature | Notes |
|---|---|
| `put(key: K, value: V): void` | insert or overwrite |
| `get(key: K): V` | PANICS `Map.get: no such key` if absent |
| `try_get(key: K): !V` | `MapError::KeyNotFound` on miss |
| `contains(key: K): bool` | |
| `index_of(key: K): int` | position among `keys()` or `-1` |
| `remove(key: K): void` | no-op if absent; last entry fills hole, so order is insertion order only until first remove |
| `length(): int` | |
| `keys(): List<K>` / `values(): List<V>` | COPIES, same order |
| `copy(): Map<K, V>` | |
| `m[key]` / `m[key] = v` | `get` / `put`. `m[k] += 1` is E126: write `m[k] = m[k] + 1` |

Error: `error MapError { KeyNotFound }`.

```turflang
import map;
import map::Map;
import list::List;

fn lookup(m: Map<string, int>, key: string): int {
    return m.try_get(key) recover as err run {
        if err == map::MapError::KeyNotFound { return -1; }
        return -2;
    };
}

fn main(): int {
    mut m: Map<string, int> = Map::default();
    m.put("a", 1);
    m.put("a", 100);                                    // still one entry
    immut x: int = m.try_get("a") recover produce -1;   // 100
    if m.contains("a") { printline(m.get("a")); }
    immut ks: List<string> = m.keys();                  // List<K>; needs import list::List;
    return lookup(m, "zz");                             // -1
}
```

## set   (`import set::Set;`)  `Set<T>`
Same key rules as Map. `Set::default()`.

| Signature | Notes |
|---|---|
| `add(item: T): void` | no-op if present |
| `contains(item: T): bool` | |
| `index_of(item: T): int` | position in stored order or `-1` |
| `remove(item: T): bool` | true if it was present; last element takes freed slot |
| `length(): int` | |
| `copy(): Set<T>` | |
| `s[i]` | read-only, `0 <= i < length()` (NO negatives), panics out of range; `s[i] = v` is E056 |

## hashing   (`import hashing;`)
`hash(x: string): int`, `hash<T>(x: T): int`: the hash Map/Set use; equal values equal hashes; don't store (may change between compiler versions).

---

## os   (`import os;`)

| Signature | Notes |
|---|---|
| `env(name: string): string` | `""` if unset (cannot tell unset from empty); never fails |
| `set_env(name: string, value: string, overwrite: int): !void` | `overwrite` nonzero replaces; `0` keeps existing and still succeeds. `OsError::SetEnvFailed(name)` for empty name or name containing `=` |
| `argc(): int` | includes program itself (no args => 1) |
| `argv(index: int): string` | `argv(0)` program path; out-of-range/negative => `""`, never panics |

Error: `error OsError { SetEnvFailed(name: string) }`.

## fs   (`import fs;`)

Path functions work on strings, never touch disk, never fail; `/` is the only separator on all platforms.

| Signature | Notes |
|---|---|
| `join(a: string, b: string): string` | exactly one `/` between (`join("a","")`=`a/`, `join("a","/b")`=`a//b`, `join("","b")`=`/b`) |
| `dirname(path: string): string` | before last `/`; `dirname("c.txt")`=`.`; `dirname("/c.txt")`=`/` |
| `basename(path: string): string` | after last `/`; trailing `/` gives `""` |
| `extension(path: string): string` | after last `.` of basename, `""` if none; `.gitignore` -> `""` |
| `is_absolute(path: string): bool` | starts with `/` |
| `mkdir(path: string): !void` | one level, mode 0755; fails if parent missing, exists, or no permission |
| `remove_file(path: string): !void` | |
| `remove_dir(path: string): !void` | EMPTY dirs only |
| `is_dir(path: string): bool` | false for file/missing/unreadable |

Error: `error FsError { MkdirFailed(path: string), RemoveFileFailed(path: string), RemoveDirFailed(path: string) }`. No directory listing, sizes, times, or recursion. (A raw `pub extern fn mkdir(path: string, mode: int32): int32` binding is also public; use the `!void` overload.)

## time   (`import time;`)

Wall clock vs CPU time are different clocks. `elapsed_*` measure CPU time (does not advance while sleeping). Nothing here fails or panics; negative durations are zero.

| Signature | Notes |
|---|---|
| `now_seconds(): int` | Unix epoch seconds (whole seconds) |
| `clock_ticks(): int` | CPU microseconds consumed; a reading to subtract |
| `elapsed_ms(start_clock_ticks: int): int` | CPU ms since a `clock_ticks()` value, rounded down |
| `elapsed_seconds(start_clock_ticks: int): int` | CPU seconds |
| `sleep_seconds(n: int): void` | wall clock; `n<=0` returns at once |
| `sleep_ms(n: int): void` | large `n` safe |

Constants: `CLOCKS_PER_SEC: int` (1000000), `MAX_USLEEP_USEC: int` (1000000). Public C bindings: `time(t: ptr): int` (pass `null`), `clock(): int`, `usleep(usec: int32): int32`; prefer the wrappers.

## random   (`import random;`)

Not cryptographic. One global generator seeded from OS entropy; seed cannot be chosen (no reproducible sequences).

| Signature | Notes |
|---|---|
| `random_int(min: int, max: int): int` | BOTH inclusive; PANICS if `max < min` |
| `random_double(): double` | `[0.0, 1.0)` |
| `random_bool(): bool` | |
| `reseed(): void` | fresh seed from OS |

Constant: `RAND_MAX: int` (2147483647).

---

## json   (`import json;`)

```text
enum JsonType { Null, Bool, Number, String, Array, Object }

struct JsonValue {
    pub kind: JsonType,
    pub bool_val: bool,
    pub num_val: double,
    pub str_val: string,
    pub arr_val: List<JsonValue>,
    pub obj_keys: List<string>,
    pub obj_vals: List<JsonValue>,
}
```

Only the fields for `kind` are meaningful. Numbers are always `double`. Objects keep insertion order; `set` of an existing key replaces in place. JsonValue is shared like a collection (putting one inside another and mutating later shows through).

| Signature | Notes |
|---|---|
| `JsonValue::null_value(): JsonValue` | static |
| `JsonValue::from_bool(b: bool): JsonValue` | static |
| `JsonValue::from_number(n: double): JsonValue` | static |
| `JsonValue::from_string(s: string): JsonValue` | static |
| `JsonValue::new_array(): JsonValue` / `JsonValue::new_object(): JsonValue` | static; create the container before push/set |
| `push(item: JsonValue): void` | append to array; NOT kind-checked (push on a number is silently ignored by stringify) |
| `set(key: string, value: JsonValue): void` | on object; not kind-checked; linear scan |
| `get(key: string): JsonValue` | PANICS if key missing or value not an object |
| `has(key: string): bool` | false on non-objects |
| `get_string(key: string): string` / `get_number(key: string): double` / `get_int(key: string): int` / `get_bool(key: string): bool` | missing key PANICS; wrong kind returns default (`""`,`0.0`,`0`,`false`); `get_int` truncates toward zero |
| `at(index: int): JsonValue` | array element; PANICS if index <0 or >= length, or not an array |
| `length(): int` | array len or object key count; 0 otherwise; never panics |
| `parse(s: string): !JsonValue` | free function `json::parse` |
| `stringify(v: JsonValue): string` | compact; ints within +-2^53 written as integers; round-trip doubles; inf/nan written as `inf`/`nan` (invalid JSON) |
| `escape_string(s: string): string` | body of a JSON string literal, no quotes; use when hand-building JSON |

Type checking: no kind errors are raised; check `kind` when it matters (`compare v.kind { matches json::JsonType::Number: ... otherwise: ... }`), and use `has` before optional `get`.

```turflang
error JsonError {
    UnexpectedEnd(offset: int),
    UnexpectedChar(offset: int),
    InvalidNumber(offset: int),
    InvalidLiteral(offset: int),
    UnterminatedString(offset: int),
    ExpectedColon(offset: int),
    ExpectedComma(offset: int),
}
```
`offset` = byte offset (from 0) where parsing gave up (UnexpectedEnd: `""`->0, `"[1,"`->3; UnexpectedChar: `"@"`->0, `"{a:1}"`->1, `"[1,]"`->3; ExpectedComma `"[1 2]"`->3).

Parser leniencies: text after the first value is ignored (`1 2` -> 1); leading zeros ok; `1.` ok; duplicate keys keep last. Known limitation: `\uXXXX` is NOT decoded (backslash dropped, reads `u0041`); `\b`/`\f` read as letters `b`/`f`. Not part of the stability surface.

```turflang
import json;

fn main(): int {
    immut text: string = "{\"name\":\"Ada\",\"visits\":3,\"tags\":[\"admin\",\"dev\"]}";
    mut doc: json::JsonValue = json::parse(text) recover as err run {
        compare err {
            matches json::JsonError::UnexpectedEnd(at):
            eprintline("ended early at byte " + (at to string));
            done
            otherwise:
            eprintline("not valid JSON");
        }
        return 1;
    };
    printline(doc.get_string("name"));         // Ada
    printline(doc.get_int("visits"));          // 3
    printline(doc.get("tags").length());       // 2
    printline(doc.get("tags").at(1).str_val);  // dev

    doc.set("visits", json::JsonValue::from_number(doc.get_number("visits") + 1.0));
    if !doc.has("active") {
        doc.set("active", json::JsonValue::from_bool(true));
    }
    doc.get("tags").push(json::JsonValue::from_string("ops"));
    printline(json::stringify(doc));
    return 0;
}
```

## http   (`import http;`; add `import net;` if you run your own accept loop)

HTTP/1.1 over `net`: one request per connection (`Connection: close`), one 8192-byte read per request (`Content-Length` not consulted, body = whatever arrived with the headers), one request at a time, no TLS/chunked/query parsing.

```text
struct Request {
    pub method: string,
    pub path: string,                  // exact as sent, query string included
    pub headers: Map<string, string>,  // case-sensitive names, values trimmed, last duplicate wins
    pub body: string,
}
struct Response { pub conn: net::TcpConnection }
```

| Signature | Notes |
|---|---|
| `parse_request(conn: net::TcpConnection): Request` | never fails; malformed -> `method`/`path` are `""` |
| `Request.has_header(name: string): bool` | exact name |
| `Request.get_header(name: string): string` | PANICS if absent |
| `Response.send_text(status: int, body: string): void` | `text/plain` |
| `Response.send_json(status: int, body: string): void` | `application/json`; body is JSON text you made |
| `Response.send_raw(status: int, content_type: string, body: string): void` | the base function |
| `status_text(status: int): string` | `"200 OK"`, `"201 Created"`, `"400 Bad Request"`, `"404 Not Found"`, `"500 Internal Server Error"`, else `"<n> Unknown"` |
| `Server.get(path: string, handler: fn(Request, Response): void): void` | register (same path replaces) |
| `Server.has_route(path: string): bool` | |
| `Server.get_route(path: string): fn(Request, Response): void` | PANICS if none |
| `Server.listen(port: int): void` | never returns; 404 `Not Found` if no route; bind failure prints message and exits status 1 |

`Request::default()`, `Response::default()`, `Server::default()` create values (`mut app: http::Server;` is E008). Call exactly ONE `send_*` per request; it does not close the connection. Handler shape is `fn(http::Request, http::Response): void`. Routing is EXACT on path and ignores method (`/users` != `/users/7` != `/users?page=2`; read `req.method` yourself). For manual routing: `res.conn = conn;`. Escape user text in hand-built JSON with `json::escape_string`.

```turflang
import http;
import json;

fn home(req: http::Request, res: http::Response): void {
    res.send_text(200, "Welcome to Turf");
}

fn greet(req: http::Request, res: http::Response): void {
    mut reply: json::JsonValue = json::JsonValue::new_object();
    reply.set("greeting", json::JsonValue::from_string("hello"));
    reply.set("method", json::JsonValue::from_string(req.method));
    if req.has_header("User-Agent") {
        reply.set("agent", json::JsonValue::from_string(req.get_header("User-Agent")));
    }
    res.send_json(200, json::stringify(reply));
}

fn main(): int {
    mut app: http::Server = http::Server::default();
    app.get("/", home);
    app.get("/greet", greet);
    app.listen(8080);
    return 0;
}
```

Manual accept loop core: `net::TcpListener::bind(8080) recover run {...}`; `defer listener.close();` then loop `listener.accept() recover run { continue; }`, `defer conn.close();`, `http::parse_request(conn)`, `mut res: http::Response = http::Response::default(); res.conn = conn;`, branch on `req.method`/`req.path`.

## net   (`import net;`)

IPv4 TCP only; calls block, no timeouts. Addresses are four int octets (`connect(127, 0, 0, 1, 8080)`), not strings. Listener binds all interfaces.

| Signature | Notes |
|---|---|
| `resolve_hostname(host: string): !string` | first IPv4 as dotted text; `ResolutionFailed` |
| `TcpConnection::connect(a: int, b: int, c: int, d: int, port: int) static: !TcpConnection` | errors `SocketCreationFailed`, `ConnectionRefused` (any connect failure); octets mod 256 |
| `TcpConnection.read(max_bytes: int): string` | blocks; one receive, may be partial; `""` on peer close/failure; ends at first NUL |
| `TcpConnection.write(data: string): void` | failure silent |
| `TcpConnection.close(): void` | idempotent |
| `TcpConnection.raw_fd(): int` | `-1` once closed |
| `TcpConnection::new(fd: int)` | wrap a descriptor you own |
| `TcpListener::bind(port: int) static: !TcpListener` | errors `SocketCreationFailed`, `BindFailed`, `ListenFailed`; sets SO_REUSEADDR, backlog 128 |
| `TcpListener.accept(): !TcpConnection` | `AcceptFailed` (usually transient: `recover run { continue; }`) |
| `TcpListener.close(): void`, `TcpListener.raw_fd(): int`, `TcpListener::new(fd: int)` | as for TcpConnection |

Error (no payloads): `error NetworkError { SocketCreationFailed, ConnectionRefused, BindFailed, ListenFailed, AcceptFailed, ResolutionFailed }`. Constants `AF_INET`(2) `SOCK_STREAM`(1) `SOL_SOCKET`(1) `SO_REUSEADDR`(2) are Linux values for your own `extern fn` socket code.

```turflang
import net;

fn main(): int {
    mut conn: net::TcpConnection = net::TcpConnection::connect(127, 0, 0, 1, 9091) recover as err run {
        if err == net::NetworkError::ConnectionRefused {
            eprintline("nothing is listening");
        } else {
            eprintline("could not create a socket");
        }
        return 1;
    };
    defer conn.close();
    conn.write("hello");
    printline(conn.read(1024));
    return 0;
}
```

## mem   (`import mem;`)

Manual heap; most code needs `unsafe { }` (raw pointers outside unsafe: E130). GC values (string, `heap(...)`, collection storage) must NEVER be passed to `mem::free` (runtime panics "cross-heap free"). Wrappers panic on out-of-memory; none return `!T`. Parameter named `p` (not `ptr`, a type keyword). Compiler checks double free (E017) and use after free (E018).

| Signature | Notes |
|---|---|
| `alloc(size: int): void*` | uninitialised |
| `alloc_zeroed(count: int, elem_size: int): void*` | |
| `grow(p: void*, new_size: int): void*` | use returned pointer |
| `dup(src: void*, n: int): void*` | |
| `zero(p: void*, n: int): void` | |
| `alloc_aligned(alignment: int, size: int): void*` | alignment power of two and multiple of 8, else panics |
| `free(p: void*): void` | once only; `null` ok |
| `usable_size(p: void*): int` | platform-dependent (not in stability surface) |
| `root(p: void*): void` / `unroot(p: void*): void` | pin a GC object held only in manual/C memory; nests; `unroot` without pin panics |
| `Pool` (struct, `Pool::default()`): `track(item: void*): void`, `length(): int` | shared handle, no `copy()`; holds `void*` only (GC values E056) |
| `free_pool(pool: Pool): void` | frees every tracked pointer and pool storage; pool reusable |
| C bindings: `malloc(size: int): void*`, `calloc(count: int, size: int): void*`, `realloc(p: void*, new_size: int): void*`, `posix_memalign(memptr: void*, alignment: int, size: int): int`, `malloc_usable_size(p: void*): int`, `memcpy(dst: void*, src: void*, n: int): void*`, `memmove(dst: void*, src: void*, n: int): void*`, `memset(p: void*, val: int, n: int): void*`, `memcmp(a: void*, b: void*, n: int): int` | no null check |

```turflang
import mem;

fn main(): int {
    unsafe {
        mut buf: int* = mem::alloc(sizeof(int) * 4) to int*;
        buf[0] = 12;
        buf[3] = 30;
        printline(buf[0] + buf[3]);   // 42
        mem::free(buf to void*);
    }
    return 0;
}
```

## test   (`import test;`; bare `assert` is E041)

A test is a normal program that asserts and returns `0`. Failure prints to stderr and aborts (exit 134 on Linux/macOS); `turf test` reports it. One file = one test.

| Signature | Fails when |
|---|---|
| `assert(cond: bool): void` / `assert(cond: bool, msg: string): void` | `cond` false |
| `assert_eq(left, right): void` / `assert_eq(left, right, msg: string): void` | `left != right` |
| `assert_neq(left, right): void` / `assert_neq(left, right, msg: string): void` | `left == right` |
| `fail(msg: string): void` | always |
| `assert_fail_eq(left: string, right: string, msg: string): void` | always (for custom compare helpers) |
| `assert_fail_neq(left: string, right: string, msg: string): void` | always |

`assert_eq`/`assert_neq` exist only for `int`, `double`, `bool`, `string` (both sides same type); `char` and others are E025: use `assert(a == b, "msg")`. Doubles compare exactly (use `assert(math::abs(a - b) < 0.000001, "msg")`). `assert`/`fail` report YOUR call's `file:line:`; `assert_eq`/`assert_neq` report a line inside the library, so always pass a `msg`.

`turf test` (in a project) compiles/runs every file under `tests/`; `turfc --test <dir>` outside a project. Files named `fail_*` are expected to be rejected/abort: `// EXPECT-DIAG: E025`, `// RUNTIME_ABORT_EXPECTED`, `// EXPECT-RUNTIME: <message>`.

```turflang
import list::List;
import test;

fn main(): int {
    mut words: List<string> = strings::split("a,b,c", ",");
    test::assert_eq(words.length(), 3, "three fields");
    test::assert_eq(words.get(1), "b", "the middle field");
    test::assert_neq(words.get(0), words.get(2));
    test::assert(strings::contains("turf", "ur"), "substring found");
    printline("all checks passed");
    return 0;
}
```

---

## Quick panic list

`List.pop/get/set/[]`, `Stack.pop/peek`, `Queue.dequeue/peek`, `Map.get/[]`, `Set[]`, `strings::substring` (bad range), `s[i]` (out of range), `s to int/double` (bad text), `array` funcs (`len` too big; max/min of empty), `random_int(max<min)`, `JsonValue.get/get_*/at`, `Request.get_header`, `Server.get_route`, `abs(int)`/`power(int,int)`/`gcd`/`lcm` overflow, `StringBuilder.reserve(<0)`, `mem` allocation failure, int `/` by zero (use `math::divide`).
