# Turf error-code index

Turf compiler diagnostics carry stable identifiers `E001` through `E150`: a code is never reassigned, and retired codes are kept so old logs still resolve. The code appears in the diagnostic header, for example `── error at line 4, col 18 [E001 · array error]`, as `[E0NN · category]`. Run `turf explain E0NN` (or `turfc --explain E0NN`) to print the full page: what it means, a wrong example and the fix. Below, codes are grouped by category (the compiler's `SLM::ErrorCategory`, shown as `UPPER_CASE`; the diagnostic header prints it lowercased with spaces). "Class name" is the compiler's error class for the code. Rows marked "Warning" do not stop compilation. 144 codes are active; 6 are retired (see the retired table). Facts come from `docs/errors/codes/E0NN.txt`; class names and categories come from `src/diagnostics/ErrorCodes.h`, because the code pages themselves carry no header.

## TYPE_MISMATCH (Type mismatch)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E035 | InvalidTransitionError | `.transition(X)` to a state with no edge from the current state in a `compare` arm. | Add the edge to the `machine` (`Idle -> Closing,`) or pick a reachable state. |
| E036 | InvalidTransitionTargetError | `.transition(...)` target is another machine's state, or a variable rather than a written state. | Pass a state of the same machine; for runtime choice, `compare` and write one `.transition(M::X)` per arm. |
| E056 | ArgumentTypeError | Call argument type differs from the parameter type, e.g. `greet(3, "Ada")`. | Match each argument to its declared parameter type and order. |
| E059 | CompareTypeError | `matches` arm literal type differs from `compare` subject type (`"404"` vs `int`). | Make every arm the subject's type; drop or add quotes. |
| E062 | NullAssignmentError | `null` assigned to non-pointer type, e.g. `mut n: int = null;`. | Use a real value (`""` for strings, `0`, `T::default()`); for "maybe nothing" use a nullable reference `&?T` (raw `T*` needs `unsafe`). |
| E064 | ReturnTypeMismatchError | `return` value (or bare `return;`) does not match the function's declared return type. | Return the declared type, or change `: Type`; use `return 0;` or declare `void`. |
| E066 | TypeError | General type mismatch, e.g. `mut bad: int = "five";`; also struct literal missing fields. | Make the value the expected type, or fix the declared type. Read the detail line. |
| E082 | UnnarrowedNullableCastError | `to &Box` or `to Box` on a `&?Box` without a null check. | Convert inside `if b != null { ... }`; store field/call results in a variable first. |
| E098 | OperatorTemporaryWriteError | Assigning into a field of an `operator[]` result, e.g. `bs[0].a = 50;` (writes a copy). | Copy out, modify, store back: `mut e: Big = bs[0]; e.a = 50; bs[0] = e;`. |
| E124 | InvalidComparisonError | Comparison between different types (`x == null` on int, `x == "5"`), structs, or ordering enums. | Compare like types; compare struct fields; use `(a to int) < (b to int)` for enums. |
| E126 | UnsupportedOperationError | Unsupported form: `x += 1` or `x++` on `int32`, `[]=` compound on custom operator, indexing non-indexable, `sizeof(void)`. | Write it out: `x = (x + 1) to int32;`, `grid[i] = grid[i] + 1;`; add `operator []`; use `sizeof(void*)`. |
| E134 | InvalidCastError | `to` conversion with no defined meaning, e.g. `5 to bool`, `true to int`. | Compare instead: `n != 0`; or choose numbers: `give 1 otherwise 0`. |
| E149 | LiteralNeverConvertsError | String literal that always fails run-time conversion, e.g. `"abc" to int`, `"Purple" to Color`. | Write the value: `42`, `Color::Green`; use `strings::parse_int` / `parse_double` with `recover`. |

## UNDECLARED_VAR (Undeclared variable / unknown name)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E008 | DefiniteAssignmentError | Scalar/struct declared without value is read on a path where it may be unassigned (`if` with no `else`). Never for a fixed-size `T[N]`, which is zero-filled from its declaration. | Initialize at declaration (`mut x: int = 0;`) or assign in every branch. |
| E040 | ReferenceError | Name used as a value is not declared anywhere (typo, undeclared, or a type name used as value). | Fix spelling, declare with `mut`/`immut` first, or build a value with `Node::default()`. |
| E041 | UnknownFunctionError | Called function name unknown: typo, missing module import, or constructor-call syntax `Node(5)`. | Fix spelling, `import` its module, or use `Node::new(5)` / `Node::default()`. |
| E043 | UseBeforeDeclarationError | Variable used above the line that declares it in the same block. | Move the `mut`/`immut` declaration before first use. |
| E054 | StructMethodNotFoundError | Method called on a struct does not exist, e.g. `c.incrament()`. | Fix spelling, check receiver and `static`, or declare `fn Counter.name(...)`. |
| E068 | UnknownStructFieldError | `.field` not declared on the struct, or `.field` on a non-struct (string, int). | Fix spelling, add the field to the struct, or call a method with `()` like `s.length()`. |
| E131 | MethodOnNonStructError | Method call on non-struct, e.g. `x.foo()` on int, `a.reverse()` on array, `s.copy()` on string. | Call as `module::fn(x)` (e.g. `math::abs(x)`), check spelling/import; arrays only have `length()`, `copy()`. |

## CONTROL_FLOW (Control flow)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E007 | ControlFlowError | `break` or `continue` outside any `while` or `for` loop (an `if` block is not a loop). | Wrap in a `while`/`for`, or delete the stray `break`/`continue`. |
| E009 | MissingReturnError | Non-void function has a path reaching the end without `return`. | Add a final `return` or an `else` branch that returns. |
| E010 | RecursionWithoutBaseError | Recursive function has no non-recursive path; every path calls itself. | Add a base case: `if n <= 1 { return 1; }` before the recursive call. |
| E012 | StatementAfterTerminatorError | Statement after `return`, `break` or `continue` in the same block (dead code; also covers declarations). | Delete it, or move it before the `return`. |
| E016 | BareErrorAsBindingError | `recover as err run` on a function that fails only with a bare `error X;`. | Use `recover produce <value>` or `recover run { ... }` instead. |
| E058 | CompareError | Malformed `compare`: arm missing `done`, duplicate `otherwise`, or `otherwise` not last. | End each `matches` arm with `done`; use one `otherwise:` as the final arm. |
| E074 | UnreachableBlockWarning | Warning: a whole block no path reaches (e.g. code after `while true { return 1; }`). | Give the loop a real exit (`break`) or delete the dead tail. |
| E075 | DeadBranchWarning | Warning: an `if` or branch inside already-unreachable code. | Same as E074: add a loop exit or delete the dead code. |
| E083 | DeferControlFlowError | `defer` statement contains `return`, `break` or `continue`. | Keep defer to cleanup: `defer cleanup();`; leave via normal flow. |
| E092 | InvalidPatternError | Illegal `compare` pattern header: struct pattern omits a field, non-literal field pattern, wrong type, bad guard. | List every field or end with `..`: `Point { x, .. }`; use a guard: `Point { x, .. } if x == limit:`. |
| E093 | NonExhaustiveCompareError | `compare` over enum, machine, bool or error value does not cover all cases and has no `otherwise`. | Add arms for missing variants, or `otherwise:` / `matches _:`. |
| E094 | UnreachableArmWarning | Warning: `compare` arm after an unguarded catch-all (`matches _:`) can never run. | Delete the dead arm or move it above the catch-all. |
| E095 | TryMisuseError | `try` in a function not returning `!V`, inside `defer`, on a non-fallible call, or at top level. | Handle with `f() recover as err run { ... }`, or declare the function `!T`; drop `try` on plain calls. |
| E120 | InvalidLoopFormError | Unsupported `for` form, e.g. `for (i, x) in 0..10`. | Ranges take one variable; arrays take `for v in arr` or `for (i, v) in arr`. |
| E132 | InvalidRecoverError | `recover` on a call that can't fail, or `recover run { }` block that does not `return`. | Drop `recover` or declare `fn f(): !int`; end the block with `return` or use `recover produce <v>`. |
| E133 | DuplicateMatchArmError | Same value matched twice in one `compare`. | Change the duplicate value, delete the arm, or stack headers to share one body. |

## SYNTAX_ERROR (Syntax error)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E014 | KeywordError | Misspelled keyword where a keyword is expected, e.g. `iff`. | Fix the spelling; the message usually suggests the real keyword. |
| E070 | MalformedRadixPrefixError | `0x`, `0b` or `0o` with no digit after it. | Finish the literal (`0xFF`) or write plain decimal. |
| E071 | InvalidRadixDigitError | Digit invalid for the radix, e.g. `0b012`, `0o8`, `0xZZ`. | Correct the digit (`0b010`) or drop the prefix. |
| E072 | MisplacedSeparatorError | Number starts or ends with `_` (`_5`, `5_`, `0x_FF`). | Remove the stray underscore; keep `_` only between digits. |
| E073 | MalformedExponentError | `e`/`E` exponent with no digits, e.g. `1.5e`, `1.5e+`. | Finish the exponent (`1.5e3`) or remove the `e`. |
| E099 | UnterminatedLiteralError | String or char literal opened but never closed on the line. | Add the closing `"` or `'`; use `\n` for line breaks and `\"` inside text. |
| E100 | InvalidEscapeSequenceError | Unknown escape sequence in a string or char, e.g. `\q` or `"C:\temp\q"`. | Use known escapes; double the backslash: `"C:\\temp\\q"`. |
| E101 | InvalidCharLiteralError | Char literal empty or holding more than one character (`''`, `'ab'`). | Use exactly one char `'a'`, or a string `"ab"`; `'\''` for a quote. |
| E102 | MissingSemicolonError | Statement not ended with `;` (reported at the next statement's start). | Add `;` at the end of the line above the reported position. |
| E103 | UnexpectedTokenError | Token that cannot appear here: missing operand (`mut x: int = ;`), stray `;`, keyword as value, top-level `mut`. | Delete the stray token or add the missing operand; check earlier lines for an unclosed bracket. |
| E104 | UnclosedDelimiterError | `(`, `[`, `{` or `<` never closed, e.g. `add(1, 2;`. | Add the missing closing bracket; for `{` the error points at the unclosed opener. |
| E105 | MissingCommaError | Missing comma between list items (struct fields, enum variants, call args, array items). | Add commas between items: `add(1, 2)`; or close the list if it should end. |
| E106 | MissingColonError | Missing `:` before a return type, or in a parameter or struct field. | Write `fn add(a: int, b: int): int`, `name: string`, `age: int`. |
| E107 | MissingOpeningDelimiterError | Missing `{` for a block body or `(` for a parameter list; braceless `if x > 0 return 1;`. | Always use braces: `if x > 0 { return 1; }`; write `fn main(): int`. |
| E108 | ExpectedNameError | A name is expected but absent or a reserved word, e.g. `mut : int = 5;`, `fn (a: int)`. | Give a name: `mut count: int = 5;`. Rename identifiers that are reserved words. |
| E109 | ExpectedTypeError | A type is expected but missing, e.g. `b:`, `fn get(): {`, `List<>`, `sizeof(a)`. | Write the type: `b: int`; use `void` for no return; `sizeof(int)` takes a type. |
| E110 | ExpectedKeywordError | Fixed-shape construct missing its next word or symbol (`in`, `while`, `otherwise`, `matches`, `run`, `->`). | Add the piece the message names: `for i in 0..10`, `do { ... } while c;`, `give a otherwise b`. |
| E111 | NestingTooDeepError | Brackets, `<` or `!` nested beyond the parser's depth limit, usually accidental repetition. | Delete the repeated characters; name inner pieces with `mut` and build step by step. |
| E118 | StatementOutsideFunctionError | Statement (call, assignment, variable, `return`, `if`) at file top level. | Move it into `fn main(): int { ... return 0; }`. |
| E139 | MalformedNumberError | Malformed decimal: second `.` (`3.14.15`), trailing `.` (`5.`), or `.` on hex/binary/octal. | Use one point with digits after it: `5.0`, `3.14`; plain decimal instead of `0xFF.5`. |

## ARITHMETIC (Arithmetic and literal range)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E057 | ArithmeticError | Operator applied to unsupported types, e.g. `3 + "4"`, `!n` on int, `&&` on ints. | Make operands the kind the operator needs; use `n != 0` for ints; `+` joins two strings. |
| E076 | IntegerLiteralOutOfRangeError | Integer literal (or constant expression) too big for `int` or `int32`. | Use a smaller literal; check `int32` range or use `int`. |
| E077 | IntegerLiteralNotExactAsDoubleError | Large integer literal assigned to `double` cannot round-trip exactly. | Use `int`, or write an explicit float literal like `9223372036854775807.0`. |
| E078 | FloatLiteralOverflowError | Float literal beyond `double` range, e.g. `1e400`. | Fix the exponent typo or pick a value that fits `double`. |
| E127 | EnumValueOutOfRangeError | Literal number outside the enum's variant range, e.g. `7 to Color`. | Use the variant name `Color::Green`, or a number within the printed range. |

## STRING_CONVERSION (String conversion)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E065 | StringConversionError | `to string` applied to a type other than int, double or bool (e.g. a struct). | Build the string yourself: `"x=" + (p.x to string)`, or write a helper function. |

## ARRAY_ERROR (Array error)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E001 | ArrayBoundsError | Literal array index outside `0..size-1` (or `-size..-1`), e.g. `primes[3]` on `int[3]`. | Use an in-range index, or enlarge the array: `int[4]`. |
| E002 | ArrayNonIntegerIndexError | Array index is a `double`, `char`, string or bool instead of an `int`. | Convert explicitly: `primes[d to int]`, `counts[word[i] to int]`. |
| E003 | ArraySizeMismatchError | Initializer list length differs from declared size, e.g. 4 values for `int[3]`. | Make list length and size agree: change `int[3]` to `int[4]` or trim the list. |
| E004 | ArrayTypeMismatchError | One initializer element has the wrong type, e.g. `"five"` in an `int[3]`. | Make every element the array's element type; fix the offending value. |
| E005 | ForEachNonArrayError | `for v in x` where `x` is not a built-in array (int, struct, `List<T>`). | Loop over a real array, or use `for i in 0..my_list.length() step i += 1`. |
| E123 | InvalidArraySizeError | Array size is zero, negative, non-integer, or `int[] = []` empty literal. | Use a positive whole size or at least one element; use `List<T>` for growable. |
| E140 | UnsizedArrayPlacementError | `T[]` used outside a function parameter or local view: field, return type, `&int[]`, `List<int[]>`, extern. | Use a sized array `int[5]` or `List<T>`; write unsized only as a parameter `arr: int[]`. |
| E141 | ImmutableArrayWrittenThroughSliceError | `immut` array (or slice, field) passed to a function that writes its `T[]` parameter. | Declare the array `mut`, or pass a copy: `fill(a.copy(), 0);`. |
| E142 | SliceOfNonArrayError | Range slice `x[a..b]` on a string, `List`, int or struct. | Slice only arrays; use `strings::substring(s, start, end)` for strings. |
| E143 | SliceRangeOutOfBoundsError | Slice bounds out of range or `start > end`, e.g. `a[1..4]` on `int[3]`, `a[2..1]`. | Keep `0 <= start <= end <= length`; omit end for the tail: `arr[2..]`. |
| E144 | MutableViewOfImmutableArrayError | `mut` view (`mut t: int[] = a[1..]`) of an `immut` array. | Declare the view `immut`, make the array `mut`, or take `a.copy()`. |

## DECLARATION (Declaration, modules and visibility)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E019 | CircularImportError | Two modules `import` each other (import cycle). | Remove an unneeded import, or move shared code into a third module both import. |
| E020 | ConflictingExternDeclarationError | Same `extern fn` name declared with different parameter or return types. | Make every `extern fn` declaration of that name identical, or rename one on the Turf side. |
| E021 | ExportMutNotSupportedError | `export mut` used; only constants can be exported. | Use `export immut NAME: T = value;`, or keep it local and add getter/setter functions. |
| E022 | ExportNonConstantInitializerError | `export immut` initializer is not a literal (expression) or is missing. | Write the literal value: `export immut total: int = 20;`. |
| E023 | ExportOutsideTopLevelError | `export` written inside a function body. | Move to top level, or drop `export` for a local `immut`. |
| E150 | SizeParameterError | Size parameter `N: size` on a struct, method or operator; a kind other than `size`; `N` used as a type; a value parameter named `N`; `N` assigned (`N = 3`, `N++`, `&N`). | Free generic functions only: `fn<T, N: size> f(a: T[N])`; use `N` as a length (`0..N`, `T[N]`); copy first: `mut n: int = N;`. |
| E024 | ImportSymbolCollisionError | Two `import mod::name;` bring in the same bare name. | Qualify calls (`shapes::area(...)`) or narrow with `import geometry::[perimeter];`. |
| E027 | ModuleNotFoundError | `import name;` finds no `name.tr` in stdlib or project. | Fix the module name (`import strings;`, not `strnigs`) or create/rename the file. |
| E028 | OperatorBuiltinPairError | `operator` overload where both operands are builtin types (`int`, `string`, ...). | Make one operand your struct type, or delete it and use the builtin operator. |
| E029 | ScopeOperatorOnInstanceError | `::` used on a variable, e.g. `p::sum()`. | Use `.` on instances: `p.sum()`. |
| E030 | UnknownModuleSymbolError | `module::name` where the module has no such function or type, e.g. `io::printlne`. | Fix spelling (message suggests) or check the module that really declares it. |
| E031 | UnknownScopeQualifierError | Name before `::` is not a known enum, struct or imported module, e.g. `io::` without import. | Add the import (`import io;`) or fix the name's spelling and case. |
| E032 | UnqualifiedTypeNotVisibleError | Short type name like `List` used while it lives in module `list`, unimported by name. | `import list::List;` or write `list::List<int>` with `import list;`. |
| E033 | DuplicateDeclarationError | Second `mut`/`immut` declaration of a name in the same scope. | Assign instead (`count = 5;`) or use a different name. |
| E034 | DuplicateTypeNameError | Two structs, enums or error types with the same name in one file. | Rename one of the declarations. |
| E039 | NoSuchVariantError | `Type::Variant` where the enum or error type has no such variant. | Fix variant spelling (case-sensitive) or add it to the type's declaration. |
| E042 | UnknownTypeError | Type annotation names no known struct, enum or builtin type, e.g. `Piont`. | Fix spelling, declare the type, or import it. |
| E045 | ConstructorCalledOnInstanceError | `.new(...)` or `.default()` called on an instance. | Construct on the type: `Point::new(1, 2)`, `Point::default()`. |
| E046 | ConstructorCannotBeStaticError | `new` declared `static`. | Remove `static`: `fn Point.new(x: int, y: int): void { ... }`. |
| E048 | DotOperatorOnNonInstanceError | `.` used on a module or bare type name, e.g. `io.printline`, `Point.origin()`. | Use `::`: `io::printline("hi")`, `Point::origin()`. |
| E049 | IncompleteConstructorError | `.new` constructor leaves some field unassigned on some path. | Assign every field on every path, e.g. add the `else` branch or set a default first. |
| E050 | NoConstructorDefinedError | `Type::new(...)` on a struct with no `.new` constructor. | Write `fn Point.new(...): void { ... }` or use `Point::default()`. |
| E051 | ReservedConstructorNameError | User-written `fn Point.default()`; name reserved for auto-generated one. | Delete it and use `Point::default()`, or rename it to `.new` with parameters. |
| E052 | StaticMethodCalledOnInstanceError | `static` method called with `.` on an instance. | Call on the type: `Point::origin()`. |
| E053 | StaticOutsideStructError | `static` on a free function not bound to a struct. | Delete `static`, or make it a method: `fn Point.add(...) static: int`. |
| E060 | ImmutableAssignmentError | Assignment to an `immut` variable. | Declare it `mut`, or use a new variable instead of reassigning. |
| E061 | InvalidAssignmentTargetError | Assignment target is not a variable, field or array element, e.g. `(x + 1) = 5;`. | Assign to a variable, `p.x` or `arr[i]`; check for `=` versus `==` mix-up. |
| E069 | StructLayoutCycleError | Struct contains itself by value (directly, in a cycle, or via array). | Make one field a pointer or reference: `next: Node*`, `&Node` or `&?Node`. |
| E079 | GenericInstantiationDepthError | Generic keeps instantiating with ever-growing type (64-deep chain), e.g. `wrap<Box<T>>`. | Use a pointer or reference (`T*`, `&T`) so the type stays fixed across recursion. |
| E080 | OperatorOrphanRuleError | `operator` declared on two types the module does not own. | Move it to the module owning a type, or use a named function like `fn add_vecs(...)`. |
| E084 | CallerLocationOutsideMarkedFunctionError | `caller_location` used in a function not marked `@caller_location`. | Put `@caller_location` on the line before `fn`, or remove the use. |
| E085 | AmbiguousTypeReferenceError | Bare type name could mean local type or imported one (`import shapes::[*];` plus own `Point`). | Import only needed names (`import shapes::[Circle, area];`) and write `shapes::Point` qualified. |
| E087 | MisplacedVisibilityError | `pub`/`public` placed where it does nothing (operator, import, parameter, local, `export`) or used as a name. | Remove `pub` there; put it before top-level `fn`/`struct`/`enum`/`error`/`machine`/`extern fn` or a field. |
| E088 | PrivateSymbolAccessError | Using another module's non-`pub` function, type, field or method (e.g. `util::helper()`). | Add `pub` in that module's file (`pub fn helper()`) or use its public API. |
| E089 | PrivateInPublicError | `pub` function, method or field mentions a non-`pub` type (parameter, return, `!T`, generic arg). | Make the type `pub` (`pub struct Hidden`), or remove `pub` from the leaking item. |
| E090 | AmbiguousModuleError | Module name matches more than one file (e.g. local `list.tr` vs stdlib `list`). | Rename one file, e.g. `my_list.tr`, and import by the new name. |
| E091 | ModuleNotImportableError | Import of a transitive dependency or another package's internal (non-root) module. | Add the package to your `[dependencies]` in `turf.toml`; import its root module and use its `pub` items. |
| E096 | ErrorPayloadError | Error variant payload wrong: bad declaration, wrong argument count/type, bare variant with fields as value. | Pass one argument per field in order (plus optional trailing `string` message); read payload via `compare`. |
| E097 | GenericOperatorError | Generic `operator<T>` whose type parameter is not tied to operands, or all operands bare `T`. | Mention `T` in an operand and make one operand a type you own: `operator<T> [](p: Cell<T>, i: int): T`. |
| E112 | VoidTypeNotAllowedError | `void` used as the type of a variable, field or parameter. | Use a real type; `void` only as return type; use `ptr` or `void*` for untyped pointers in extern code. |
| E113 | RemovedSyntaxError | Removed old syntax: `Point { x: 1, y: 2 }` literal or `fn Point::origin()`. | Use `Point::new(1, 2)` / `Point::default()`; declare `fn Point.origin() static: Point`. |
| E114 | DuplicateMemberError | Same member name twice in a struct, enum, error or machine (duplicate field, variant, transition). | Rename or delete the duplicate member. |
| E115 | InvalidOperatorDeclarationError | `operator` declared with wrong operand count for its symbol. | Match arity: binary operators take two parameters, `!`/`~` one, `[]` takes `(self, index)`. |
| E116 | ExternFunctionBodyError | `extern fn` written with a `{ ... }` body. | End with a semicolon: `extern fn malloc(size: int): ptr;`, or drop `extern` to define it. |
| E117 | InvalidErrorDeclarationError | `error` declaration mixing bare `;` form with a `{ ... }` variant list. | Pick one: `error NotFound;` or `error IOError { NotFound, Closed }`. |
| E119 | MissingEntryPointError | No `main` function in the compiled file (missing, misspelled, or file is a module). | Define `fn main(): int { return 0; }`; for a module use `turf check --module file.tr`. |
| E128 | MissingInitializerError | `immutable` without value, or `guess` without initializer or in parameter, return type or field; also an array of non-null references `(&T)[N]` or an unsized local `T[]` with no initializer. | Give a value: `mut x: guess = 5;`; otherwise write the type: `mut x: int;`. |
| E129 | NothingToInferError | `guess` initializer has no usable type (`null`, void call, `List::default()`), or generic `T` unused in parameters; or a size parameter `N` that no array argument or target type fixes (`mut d = fill(0);`). | State the type: `mut a: &?Point = null;`, `List<int>`, `mut d: int[4] = fill(0);`; use `T` in a parameter. |
| E136 | InvalidModuleQualifierError | Two module names in a row, e.g. `mem::io::printline`. | Use the module that has the function: `io::printline("hi")`. |
| E138 | MissingTypeArgumentsError | Generic type used without type arguments, e.g. `mut b: Box = ...`. | Give type arguments: `Box<int>`; methods of generic structs repeat parameters: `fn<T> Box.get(): T`. |
| E145 | ModuleNotImportedError | `module::name` spelled in a file that never imported the module itself. | Add the exact import the error prints, e.g. `import list;`; `import list::List;` does not allow `list::List`. |
| E146 | InvalidAnnotationError | Unknown `@annotation` or arguments not fitting the declaration (e.g. `@ffi` on non-extern). | Fix spelling (`@ownership`, `@ffi`, `@caller_location`), correct arguments, or remove it. |
| E147 | DefaultThroughReferenceCycleError | `T::default()` on a type reaching itself through `&` fields, e.g. `next: &Node`. | Make a field `&?Node` (defaults to null), or build with `Node::new(...)`. |
| E148 | WrongTypeArgumentCountError | Wrong number of type arguments, e.g. `Point<int>` or `Box<int, int>`. | Match the declaration: `Point`, `Box<int>`. |

## FUNCTION_SIGNATURE (Function signature)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E025 | ModuleArityOrTypeError | Module function exists but no overload accepts the argument types, e.g. `math::abs(true)`. | Pass a supported type (`int` or `double` for `math::abs`) or convert the value first. |
| E038 | NestedFunctionError | `fn` declared inside another function body. | Move it to top level, or make it a struct method `fn S.name(...)`. |
| E044 | WrongArityError | Call has an argument count no overload accepts, e.g. `add(2, 3, 4)`. | Match one of the "Known overloads" the error prints; for `static` methods called with `.`, use `::`. |
| E047 | DefaultConstructorArityError | Arguments passed to `Type::default()`. | Call `Point::default()` with no args, or use `Point::new(1, 2)`. |
| E067 | VoidValueError | Result of a `: void` function used as a value. | Call it as a statement, or change its return type and add a `return`. |
| E125 | AmbiguousCallError | Two visible definitions (functions or operators) fit the call equally well. | Drop one import, import only needed names (`import a::[f];`), call `a::f(n)`, or rename. |
| E135 | NotCallableError | Parentheses after a non-function, e.g. `Color::Red()` on an enum variant. | Drop the parentheses: `Color::Red`; construct structs with `Point::new(...)`. |
| E137 | NotAValueError | Qualified function name (`io::printline`) or static method used as a value. | Import by name and use the bare name (`import helper::twice;`), or wrap in a plain function. |

## MEMORY_ERROR (Memory error)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E017 | DoubleFreeError | Same pointer passed to `mem::free` twice. | Free once; set `buf = null;` after freeing. |
| E018 | UseAfterFreeError | Pointer read or written after `mem::free` on it. | Use the memory before `mem::free(buf)`; null the pointer after freeing. |
| E081 | PossibleNullDereferenceError | Field or method use on a `&?T` not proven non-null. | Check first: `if b != null { return b.val; }`; copy fields/calls into a variable before checking. |
| E086 | DanglingReferenceEscapeError | Reference to a local (`&n`) returned or stored where it outlives the function. | Copy to the heap: `return heap(n);`. |
| E130 | RawPointerOutsideUnsafeError | Raw pointer (`ptr`, `int*`) used outside `unsafe`, in a non-extern signature, or reference cast. | Wrap in `unsafe { ... }`, or use `&T` / `&?T`; only `extern fn` may take raw pointers. |

## GENERAL (General)

| Code | Class name | What triggers it | Usual fix |
|---|---|---|---|
| E011 | SemanticError | Misc rule break: calling `main`, giving `main` parameters, non-constant `compare` pattern. | Do not call `main`; declare `fn main(): int`; use compile-time constant patterns. Follow the message. |
| E026 | ModuleMethodNotFoundError | Function name after `module::` not in that module, e.g. `io::pritn`. | Fix spelling (message suggests `printline`) or call it from the module that declares it. |
| E121 | InternalCompilerError | Compiler bug: internal state that earlier checks should rule out. | Report with minimal repro and `turf --version`; try naming intermediates with `mut` or adding type annotations. |
| E122 | NonAddressableExpressionError | `&` applied to a temporary such as `&(x + 1)` or `&compute()`. | Store it first: `mut tmp: int = x + 1; mut r: &int = &tmp;`. |

## Retired codes

These are never produced by the compiler and never reused.

| Code | Replaced by |
|---|---|
| E006 | none (feature now works: `for v in arr` over `T[]` parameter is legal); E140 is the current unsized-array error (`T[]` outside a parameter or local view) |
| E013 | E012 |
| E015 | E099-E123 (specific syntax codes; see `turf --explain` of the code shown) |
| E037 | E041 |
| E055 | E056 or E025 (E025 for `math::abs` with wrong type) |
| E063 | E056 or E025 (E025 for `math::power` with wrong type) |

## Most common in practice

Codes an agent writing new Turf code is most likely to hit, each with a minimal wrong then right example (taken from, or adapted from, the code's own page).

### E040 ReferenceError: Name not declared anywhere

```turflang
// wrong
mut n: int = undeclared_variable;
// right
mut undeclared_variable: int = 5;
mut n: int = undeclared_variable;
```

### E041 UnknownFunctionError: Unknown function (typo or missing import)

```turflang
// wrong
grete("world");
// right
greet("world");
```

### E056 ArgumentTypeError: Argument of the wrong type or order

```turflang
// wrong
greet(3, "Ada");   // greet(name: string, times: int)
// right
greet("Ada", 3);
```

### E057 ArithmeticError: Operator on unsupported types

```turflang
// wrong
mut bad: int = 3 + "4";
// right
mut sum: int = 3 + 4;
```

### E066 TypeError: General type mismatch

```turflang
// wrong
mut bad: int = "five";
// right
mut n: int = 5;
```

### E064 ReturnTypeMismatchError: Return value does not match declared type

```turflang
// wrong
fn square(n: int): int { return "nine"; }
// right
fn square(n: int): int { return n * n; }
```

### E008 DefiniteAssignmentError: Read of a possibly-unassigned variable

```turflang
// wrong
mut x: int;
if some_condition { x = 1; }
mut y: int = x;
// right
mut x: int = 0;   // or add an `else` that assigns x
mut y: int = x;
```

### E009 MissingReturnError: Not every path returns

```turflang
// wrong
fn abs(x: int): int { if x < 0 { return -x; } }
// right
fn abs(x: int): int { if x < 0 { return -x; } return x; }
```

### E088 PrivateSymbolAccessError: Private name from another module

```turflang
// wrong
return util::helper();   // helper has no `pub`
// right
pub fn helper(): int { return 41; }   // in util.tr
```

### E145 ModuleNotImportedError: `module::` spelled without importing it

```turflang
// wrong
mut l: list::List<int> = list::List::default();
// right
import list;
mut l: list::List<int> = list::List::default();
```

### E093 NonExhaustiveCompareError: `compare` not exhaustive

```turflang
// wrong
compare c { matches Color::Red: ... done  matches Color::Green ... done }
// right
// add `matches Color::Blue: ... done` or:
otherwise:
    ...
done
```

### E092 InvalidPatternError: Illegal `compare` pattern

```turflang
// wrong
matches Point { x }:   // omits field y
// right
matches Point { x, .. }:
```

### E098 OperatorTemporaryWriteError: Write into a copy returned by `operator[]`

```turflang
// wrong
bs[0].a = 50;
// right
mut e: Big = bs[0];
e.a = 50;
bs[0] = e;
```

### E086 DanglingReferenceEscapeError: Reference to a local escapes

```turflang
// wrong
return &n;   // n is local
// right
return heap(n);
```

### E081 PossibleNullDereferenceError: Possibly-null `&?T` used without check

```turflang
// wrong
fn bad(b: &?Box): int { return b.val; }
// right
fn good(b: &?Box): int {
    if b != null { return b.val; }
    return 0;
}
```

### E128 MissingInitializerError: Variable with no starting value

```turflang
// wrong
mut x: guess;
immutable PI: double;
// right
mut x: guess = 5;   // or: mut x: int; x = 5;
immutable PI: double = 3.14159;
// also E128: mut refs: (&Node)[3];   // needs an initializer; (&?Node)[3] and int[3] do not
```

### E129 NothingToInferError: Nothing to infer a type from

```turflang
// wrong
mut a: guess = null;
mut c: guess = List::default();
// right
mut a: &?Point = null;
mut c: List<int> = List::default();
```

### E110 ExpectedKeywordError: A specific word or symbol is missing (message names it)

```turflang
// wrong
for i 0..10 { ... }   // adapted: `in` is missing
// right
for i in 0..10 { ... }
do { ... } while keep_going;
give a otherwise b
```

### E102 MissingSemicolonError: Missing `;`

```turflang
// wrong
mut x: int = 5
return x;
// right
mut x: int = 5;
return x;
```

### E103 UnexpectedTokenError: Token that cannot appear here

```turflang
// wrong
mut x: int = ;
// right
mut x: int = 5;
```

### E107 MissingOpeningDelimiterError: Missing `{` (braces are mandatory)

```turflang
// wrong
if x > 0 return 1;
// right
if x > 0 {
    return 1;
}
```

### E095 TryMisuseError: `try` where it cannot work

```turflang
// wrong
fn main(): int { immut n: int = try open("x"); return n; }
// right
immut n: int = open("x") recover as err run { ... };   // or make the enclosing fn return `!T`
```

### E132 InvalidRecoverError: `recover` on a call that cannot fail

```turflang
// wrong
fn f(): int { return 1; }
mut v: int = f() recover produce 0;
// right
mut v: int = f();   // or declare `fn f(): !int`
```

### E124 InvalidComparisonError: Values can't be compared

```turflang
// wrong
if x == "5" { ... }   // x is int
// right
if x == 5 { ... }
```

### E060 ImmutableAssignmentError: Assign to an `immut` variable

```turflang
// wrong
immut pi: double = 3.14159;
pi = 3.14;
// right
mut pi: double = 3.14159;
pi = 3.14;
```

### E050 NoConstructorDefinedError: `Type::new` with no constructor declared

```turflang
// wrong
mut p: Point = Point::new(1, 2);   // no `fn Point.new`
// right
mut p: Point = Point::default();
// or declare: fn Point.new(x: int, y: int): void { self.x = x; self.y = y; }
```

### E138 MissingTypeArgumentsError: Generic type without type arguments

```turflang
// wrong
mut b: Box = Box::default();
// right
mut b: Box<int> = Box::default();
```
