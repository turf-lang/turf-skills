# Projects, packages, and tests

See `examples/inventory/` for a complete project: an internal module, a program, passing tests, a compile-fail test and a runtime-abort test.

## 1. Layout

```text
myapp/
  turf.toml          manifest (required)
  turf.lock          written by turf on first build/run/check/fetch, commit it
  src/main.tr        present → the package is a PROGRAM (its only entry point)
  src/myapp.tr       present → the package is a LIBRARY; this is its ROOT module (named after the package)
  src/**/*.tr        internal modules, any depth; the module name is the file name, never a path
  tests/**/*.tr      tests, run by `turf test`
  build/             output (build/myapp, build/package-graph.json), don't commit
```

- `turf new NAME` creates a program. `turf new NAME --lib` creates a library plus a `src/main.tr` that uses it. `turf init` does the same in the current directory.
- Package names match `[A-Za-z_][A-Za-z0-9_]*`. They cannot be reserved words, and a library cannot share a stdlib module's name.
- **Internal modules:** `import shouter;` finds `src/util/text/shouter.tr`. Two files with the same name anywhere under `src/` is an ambiguity (E090).
- **Other packages see only the root module** `src/<name>.tr`. Internal modules are invisible to them (E091). A dependency's `src/main.tr` is ignored.

## 2. `turf.toml`

```toml
[package]
name = "myapp"
version = "0.1.0"        # required string; not interpreted
turf = "2.0"             # optional: minimum compiler "<major>.<minor>"

[dependencies]
geometry = { path = "../geometry" }
jsonx    = { git = "https://github.com/someone/jsonx", tag = "v1.2.0" }   # or branch = / rev =

[unsafe]
allow = ["cwrapper"]     # dependencies whose `unsafe module;` is honored
```

- Only these three tables exist. **Unknown keys are errors.**
- The dependency key must equal that package's own name.
- **Direct dependencies only:** you may import only packages you list yourself, not transitive ones (E091). There is one version per package name across the graph.
- **Commands:** `turf add NAME --path DIR`, `turf add NAME --git URL --tag v1`, `turf remove NAME`, `turf update` (git deps), `turf fetch`, `turf graph` (JSON).
- **CI flags:** `--locked` (fail if `turf.lock` would change) and `--offline`.

## 3. Everyday commands

```text
turf build            → build/<name> (and checks the library root as a module)
turf run [-- args]    → builds and runs src/main.tr; args via os::argc()/os::argv(i)
turf check            → all diagnostics, no output
turf test [paths]     → run tests
turf fmt --write      → format src/ and tests/ (indentation/whitespace only)
turf fmt --check      → CI gate; exit 1 if anything would change
turf clean            → delete build/
turf run file.tr      → run one file on its own, outside the package
```

Debug and release builds: `-O0 -g` for debugging, the default `-O2` for release. All runtime checks stay in both.

## 4. How a module is written

```turflang
// src/geometry.tr: a library's root module; what is `pub` is the API
pub struct Point {
    pub x: int,
    pub y: int
}

pub fn Point.new(x: int, y: int): void {
    self.x = x;
    self.y = y;
}

pub fn manhattan(a: Point, b: Point): int {
    return (a.x - b.x).abs() + (a.y - b.y).abs();
}

fn helper(): int { return 1; }      // private: invisible to other modules
```

- Mark every function, method, type, error, machine, `extern fn` **and field** that callers need with `pub`. Leave everything else private.
- A `pub` signature cannot mention a non-`pub` type (E089).
- Operators have no `pub`; they follow their types.
- Constants: `export immut MAX: int = 10;`.
- `turf migrate pub --write mod.tr` adds `pub` everywhere (the 1.x behaviour). Afterwards, remove it from internals.
- Check a module alone with `turf check --module src/geometry.tr`.

**Using it:**
- `import geometry;` → `geometry::manhattan(...)`, `geometry::Point::new(1, 2)`, type `geometry::Point`.
- `import geometry::Point;` → bare `Point`, `Point::new(...)`. Write both imports if you use both spellings.
- Methods and operators on a value work without importing anything; only *spelling* `m::name` needs the import.

**Library design (the stdlib's conventions):**
- `snake_case` names.
- `!T` with a payload-carrying `pub error` type for failures caused by input or the environment.
- A `@caller_location` panic for caller bugs: `sys::panic(caller_location + ": Stack.pop: empty")`.
- `bool` for questions.
- `get` / `try_get` / `contains` triples.
- Collections as handles.
- `defer` for closing resources.

## 5. Tests: `turf test`

A test is a **whole program** in `tests/` (any depth). One file is one test, and it passes or fails as a unit. The first failed assertion aborts the file.

| File name | Passes when |
|---|---|
| `name.tr` | it compiles and exits 0 |
| `fail_name.tr` | it **fails to compile** (pin the reason with `// EXPECT-DIAG: E0NN`) |
| `fail_name.tr` + `// RUNTIME_ABORT_EXPECTED` | it compiles and exits non-zero (pin it with `// EXPECT-RUNTIME: text` or `// EXPECT-EXIT: 134`) |
| `name_module.tr` | never run; a shared helper any test can `import name_module;` (its functions must be `pub`) |

| Directive (comment at top of file) | Meaning |
|---|---|
| `// EXPECT-DIAG: E066` | compiler output contains that code |
| `// EXPECT-DIAG: some text` | ... or that text (warnings have no code) |
| `// EXPECT-NO-DIAG: warning` | output must NOT contain the text (keeps a library warning-free) |
| `// EXPECT-FIX: replace 'nmae' with 'name'` | the compiler printed exactly that `Fix:` line (2.1.0+); the runner also applies the printed fixes and checks the fixed program has fewer errors and none new. Optional: a test without it is unaffected by fixes |
| `// EXPECT-RUNTIME: msg` | the aborting program printed `msg` (pin the part after `file:line:`) |
| `// EXPECT-EXIT: 134` | the aborting program's exit status |

- **Tips:**
  - Always pin `fail_` tests. An unpinned one passes on *any* compile error, including a typo in the test itself.
  - To discover the code, run the file without the `fail_` prefix and read the header, or pin `E000` to have the failure message print the diagnostic.
  - Keep each `fail_` test to one mistake.
- **Environment:** tests run in parallel, each in its own directory (data files beside the test can be opened by relative path), with no stdin and a 5 s timeout. Flags: `--jobs N`, `--timeout S`, `--exclude PATH`, `-O0…`.
- **Imports:** a test can import the package's own modules (including internal ones), its direct dependencies, the stdlib and `*_module.tr` helpers.
- **Errors:** a project with no `tests/` directory, or with no tests, is an error, not a pass.
- **Outside a project:** `turfc --test DIR` runs a directory of tests.

**Assertions** (`import test;`; a bare `assert` is E041):
- `test::assert(cond)` / `test::assert(cond, "msg")` and `test::fail("msg")` report **your** line.
- `test::assert_eq(a, b, "msg")` / `assert_neq` work for `int`, `double`, `bool` and `string` only, and report a line inside the library. Always pass a message.
- Doubles are compared exactly, so use a tolerance: `test::assert(math::abs(x - 0.3) < 1e-9, "x")`.
- Structs need fields compared one by one, or an `operator ==` declared in the struct's own module (a test cannot add one, E080).

**Testing fallible code:**

```turflang
import test;

error E { Bad(code: int) }

fn f(n: int): !int {
    if n < 0 { return E::Bad(n, "negative"); }
    return n * 2;
}

// "" on success, otherwise a description: the `return` inside recover leaves this helper.
fn failure(n: int): string {
    immut _v: int = f(n) recover as err run {
        compare err {
            matches E::Bad(code):
                return "bad " + (code to string) + ": " + err.message;
            done
            otherwise:
                return "other";
        }
    };
    return "";
}

fn main(): int {
    immut ok: int = f(4) recover as err run {
        test::fail("f(4) failed: " + err.message);   // never `recover produce 0`: it hides failures
        return 1;
    };
    test::assert_eq(ok, 8, "doubles");
    test::assert_eq(failure(-3), "bad -3: negative", "error path");
    test::assert_eq(failure(1), "", "success path");
    return 0;
}
```

**Determinism:** seed `random` explicitly, and don't assert on wall-clock values (`time`). See `stdlib.md`.

## 6. Single-file mode vs project mode

- `turf file.tr` / `turf run file.tr` / `turfc file.tr`: modules are found in the stdlib, installed packages (`lib/usr`), the file's own directory and the current directory. `[dependencies]` are **not** visible; for those, use `turf build`/`turf run` in the project.
- `turfc` never reads `turf.toml`. `turf build` writes `build/package-graph.json` and runs `turfc --package-graph` with it.
- **To test a module quickly without the project machinery:** put a scratch `main` file next to the module and compile it in single-file mode. Imports resolve from the file's directory.
