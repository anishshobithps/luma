# Luma

> **Work in Progress** — Luma is under active development. Expect breaking changes, missing features, and rough edges. There is currently no editor support (no syntax highlighting, intellisense, LSP, or formatter).

A small, expressive programming language built with [Bun](https://bun.sh) and TypeScript.

## Quick Start

### 1. Install [Bun](https://bun.sh)

### 2. Clone & Build

```bash
git clone https://github.com/anishshobithps/luma.git
cd luma
bun install
bun run build        # produces ./luma (luma.exe on Windows)
```

### 3. Run Your First Program

Create a file called `hello.luma`:

```luma
print("Hello, Luma!");
```

Run it:

```bash
./luma hello.luma
```

Output:

```
Hello, Luma!
```

---

## Language Guide

### Comments

```luma
// Single-line comments start with //
// There are no multi-line comments yet.
```

### Variables

Use `let` to declare an immutable variable. Add `mut` to make it mutable:

```luma
// hello.luma
let name = "Luma";
print("Hello, " + name + "!");

let mut counter = 0;
counter = counter + 1;
print("counter = " + str(counter));
```

```bash
./luma hello.luma
# Hello, Luma!
# counter = 1
```

### Data Types

#### Integers

Integers are arbitrary-precision. Multiple literal formats are supported:

```luma
// integers.luma
let dec = 255;
let hex = 0xFF;
let oct = 0o377;
let bin = 0b11111111;

print("dec = " + str(dec));
print("hex = " + str(hex));
print("oct = " + str(oct));
print("bin = " + str(bin));
```

```bash
./luma integers.luma
# dec = 255
# hex = 255
# oct = 255
# bin = 255
```

#### Floats

```luma
// floats.luma
let pi = 3.14;
let half = 1.0 / 2.0;
print("pi = " + str(pi));
print("half = " + str(half));
```

```bash
./luma floats.luma
# pi = 3.14
# half = 0.5
```

#### Strings

Strings are double-quoted and support escape sequences (`\n`, `\t`, `\\`, `\"`):

```luma
// strings.luma
let greeting = "Hello\tWorld";
let multiline = "Line 1\nLine 2";
let escaped = "She said \"hi\"";

print(greeting);
print(multiline);
print(escaped);
```

```bash
./luma strings.luma
# Hello	World
# Line 1
# Line 2
# She said "hi"
```

#### Booleans & Nil

```luma
// booleans.luma
let yes = true;
let no = false;
let nothing = nil;

print("yes = " + str(yes));
print("no = " + str(no));
print("nothing = " + str(nothing));
```

```bash
./luma booleans.luma
# yes = true
# no = false
# nothing = nil
```

#### Arrays

```luma
// arrays.luma
let nums = [10, 20, 30, 40, 50];

print("first = " + str(nums[0]));
print("last  = " + str(nums[4]));
print("length = " + str(len(nums)));

// iterate over an array
for n in nums {
    print(str(n));
}
```

```bash
./luma arrays.luma
# first = 10
# last  = 50
# length = 5
# 10
# 20
# 30
# 40
# 50
```

#### Ranges

Ranges produce sequences of integers. `..` is exclusive, `..=` is inclusive:

```luma
// ranges.luma
let exclusive = 0..5;
let inclusive = 0..=5;

print("exclusive length = " + str(len(exclusive)));
print("inclusive length = " + str(len(inclusive)));

print("exclusive:");
for i in 0..5 {
    print("  " + str(i));
}

print("inclusive:");
for i in 0..=5 {
    print("  " + str(i));
}
```

```bash
./luma ranges.luma
# exclusive length = 5
# inclusive length = 6
# exclusive:
#   0
#   1
#   2
#   3
#   4
# inclusive:
#   0
#   1
#   2
#   3
#   4
#   5
```

### Operators

#### Arithmetic

```luma
// arithmetic.luma
let a = 10 + 3;
let b = 10 - 3;
let c = 10 * 3;
let d = 10 / 3;
let e = 10 % 3;
let f = 2 ** 10;

print("10 + 3  = " + str(a));
print("10 - 3  = " + str(b));
print("10 * 3  = " + str(c));
print("10 / 3  = " + str(d));
print("10 % 3  = " + str(e));
print("2 ** 10 = " + str(f));
```

```bash
./luma arithmetic.luma
# 10 + 3  = 13
# 10 - 3  = 7
# 10 * 3  = 30
# 10 / 3  = 3
# 10 % 3  = 1
# 2 ** 10 = 1024
```

#### Comparison

```luma
// comparison.luma
print("3 == 3 : " + str(3 == 3));
print("3 != 4 : " + str(3 != 4));
print("5 > 2  : " + str(5 > 2));
print("5 < 2  : " + str(5 < 2));
print("5 >= 5 : " + str(5 >= 5));
print("4 <= 3 : " + str(4 <= 3));
```

```bash
./luma comparison.luma
# 3 == 3 : true
# 3 != 4 : true
# 5 > 2  : true
# 5 < 2  : false
# 5 >= 5 : true
# 4 <= 3 : false
```

#### Logical

```luma
// logical.luma
print("true and false : " + str(true and false));
print("true or false  : " + str(true or false));
print("not true       : " + str(not true));
```

```bash
./luma logical.luma
# true and false : false
# true or false  : true
# not true       : false
```

#### Bitwise

```luma
// bitwise.luma
print("0xFF & 0x0F = " + str(0xFF & 0x0F));
print("0xF0 | 0x0F = " + str(0xF0 | 0x0F));
print("0xFF ^ 0x0F = " + str(0xFF ^ 0x0F));
print("~0          = " + str(~0));
print("1 << 8      = " + str(1 << 8));
print("256 >> 4    = " + str(256 >> 4));
```

```bash
./luma bitwise.luma
# 0xFF & 0x0F = 15
# 0xF0 | 0x0F = 255
# 0xFF ^ 0x0F = 240
# ~0          = -1
# 1 << 8      = 256
# 256 >> 4    = 16
```

#### Unary

```luma
// unary.luma
let x = 42;
print("-x     = " + str(-x));
print("not true = " + str(not true));
print("~0xFF  = " + str(~0xFF));
```

```bash
./luma unary.luma
# -x     = -42
# not true = false
# ~0xFF  = -256
```

#### Compound Assignment

```luma
// compound.luma
let mut x = 10;

x += 5;
print("after += 5 : " + str(x));

x -= 3;
print("after -= 3 : " + str(x));

x *= 2;
print("after *= 2 : " + str(x));

x /= 4;
print("after /= 4 : " + str(x));

x %= 3;
print("after %= 3 : " + str(x));
```

```bash
./luma compound.luma
# after += 5 : 15
# after -= 3 : 12
# after *= 2 : 24
# after /= 4 : 6
# after %= 3 : 0
```

#### String Concatenation

```luma
// concat.luma
let first = "Hello";
let second = "World";
print(first + ", " + second + "!");
```

```bash
./luma concat.luma
# Hello, World!
```

### Functions

#### Basic Functions

```luma
// functions.luma
fn add(a, b) {
    return a + b;
}

fn greet(name) {
    return "Hello, " + name + "!";
}

print(str(add(3, 4)));
print(greet("Luma"));
```

```bash
./luma functions.luma
# 7
# Hello, Luma!
```

#### Recursion

```luma
// fibonacci.luma
fn fibonacci(n) {
    if n <= 1 { return n; }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

for i in 0..10 {
    print("fib(" + str(i) + ") = " + str(fibonacci(i)));
}
```

```bash
./luma fibonacci.luma
# fib(0) = 0
# fib(1) = 1
# fib(2) = 1
# fib(3) = 2
# fib(4) = 3
# fib(5) = 5
# fib(6) = 8
# fib(7) = 13
# fib(8) = 21
# fib(9) = 34
```

#### First-Class Functions & Closures

Functions are values. They capture their defining scope (closures):

```luma
// closures.luma
fn make_counter() {
    let mut count = 0;
    fn increment() {
        count += 1;
        return count;
    }
    return increment;
}

let counter = make_counter();
print("call 1: " + str(counter()));
print("call 2: " + str(counter()));
print("call 3: " + str(counter()));
```

```bash
./luma closures.luma
# call 1: 1
# call 2: 2
# call 3: 3
```

#### Higher-Order Functions

```luma
// higher_order.luma
fn apply(f, x) {
    return f(x);
}

fn square(n) {
    return n * n;
}

fn negate(n) {
    return -n;
}

print("square(5)  = " + str(apply(square, 5)));
print("negate(42) = " + str(apply(negate, 42)));
```

```bash
./luma higher_order.luma
# square(5)  = 25
# negate(42) = -42
```

### Control Flow

#### If / Else If / Else

`if` is an expression — the last value in a branch is the result:

```luma
// if_else.luma
let score = 85;

let grade = if score >= 90 {
    "A"
} else if score >= 80 {
    "B"
} else if score >= 70 {
    "C"
} else {
    "F"
};

print("score " + str(score) + " => grade " + grade);
```

```bash
./luma if_else.luma
# score 85 => grade B
```

#### While Loop

```luma
// while.luma
let mut n = 1;
while n <= 5 {
    print("n = " + str(n));
    n += 1;
}
```

```bash
./luma while.luma
# n = 1
# n = 2
# n = 3
# n = 4
# n = 5
```

#### For Loop

```luma
// for.luma
// iterate a range
print("range:");
for i in 1..=3 {
    print("  " + str(i));
}

// iterate an array
print("array:");
let colors = ["red", "green", "blue"];
for c in colors {
    print("  " + c);
}
```

```bash
./luma for.luma
# range:
#   1
#   2
#   3
# array:
#   red
#   green
#   blue
```

#### Break & Continue

```luma
// break_continue.luma

// break exits the loop early
print("break example:");
let mut i = 0;
while true {
    if i == 3 { break; }
    print("  " + str(i));
    i += 1;
}

// continue skips to the next iteration
print("continue example (skip 2):");
for i in 0..5 {
    if i == 2 { continue; }
    print("  " + str(i));
}
```

```bash
./luma break_continue.luma
# break example:
#   0
#   1
#   2
# continue example (skip 2):
#   0
#   1
#   3
#   4
```

#### Match

Pattern match on values with `match`. Supports integer, float, string, boolean, `nil`, and `_` (wildcard) patterns:

```luma
// match.luma
fn describe(n) {
    return match n {
        0     => "zero",
        1     => "one",
        2     => "two",
        _     => "many",
    };
}

for i in 0..5 {
    print(str(i) + " is " + describe(i));
}

// matching on other types
let active = true;
let status = match active {
    true  => "enabled",
    false => "disabled",
};
print("status: " + status);

let val = nil;
let label = match val {
    nil => "nothing here",
    _   => "something",
};
print("val: " + label);
```

```bash
./luma match.luma
# 0 is zero
# 1 is one
# 2 is two
# 3 is many
# 4 is many
# status: enabled
# val: nothing here
```

### Blocks & Scoping

Blocks `{ }` create a new scope. The last expression in a block is its value:

```luma
// scoping.luma
let x = 10;

let result = {
    let y = 20;
    x + y
};

print("result = " + str(result));
// y is not accessible here
```

```bash
./luma scoping.luma
# result = 30
```

### Structs & Enums

> **Note:** Struct and enum declarations are parsed but interpreter support for instantiating and using them is still being built.

```luma
struct Point { x, y }
enum Direction { North, South, East, West }
type Position = Point;
```

### Built-in Functions

| Function     | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `print(v)`   | Print a value to stdout                                          |
| `println(v)` | Print a value followed by a newline                              |
| `int(v)`     | Convert to integer (from float, string, or int)                  |
| `str(v)`     | Convert any value to its string representation                   |
| `len(v)`     | Length of an array, string, or range (returns 0 for other types) |

```luma
// builtins.luma

// print & println
print("hello ");
println("world");

// str — convert anything to a string
print("The answer is " + str(42));

// int — convert to integer
let from_float = int(3.99);
let from_string = int("123");
print("int(3.99)  = " + str(from_float));
print("int(\"123\") = " + str(from_string));

// len — get length
print("len(\"hello\")   = " + str(len("hello")));
print("len([1, 2, 3]) = " + str(len([1, 2, 3])));
print("len(0..10)     = " + str(len(0..10)));
```

```bash
./luma builtins.luma
# hello world
# The answer is 42
# int(3.99)  = 3
# int("123") = 123
# len("hello")   = 5
# len([1, 2, 3]) = 3
# len(0..10)     = 10
```

### Array Indexing

```luma
// indexing.luma
let fruits = ["apple", "banana", "cherry"];
print("fruits[0] = " + fruits[0]);
print("fruits[1] = " + fruits[1]);
print("fruits[2] = " + fruits[2]);
```

```bash
./luma indexing.luma
# fruits[0] = apple
# fruits[1] = banana
# fruits[2] = cherry
```

### Mixed-Type Arithmetic

Integers and floats can be mixed — the result is promoted to float:

```luma
// mixed.luma
let a = 10 + 2.5;
let b = 3 * 1.5;
print("10 + 2.5 = " + str(a));
print("3 * 1.5  = " + str(b));
```

```bash
./luma mixed.luma
# 10 + 2.5 = 12.5
# 3 * 1.5  = 4.5
```

### Putting It All Together

```luma
// fizzbuzz.luma
for i in 1..=20 {
    let result = if i % 15 == 0 {
        "FizzBuzz"
    } else if i % 3 == 0 {
        "Fizz"
    } else if i % 5 == 0 {
        "Buzz"
    } else {
        str(i)
    };
    print(result);
}
```

```bash
./luma fizzbuzz.luma
# 1
# 2
# Fizz
# 4
# Buzz
# Fizz
# 7
# 8
# Fizz
# Buzz
# 11
# Fizz
# 13
# 14
# FizzBuzz
# 16
# 17
# Fizz
# 19
# Buzz
```

---

## Current Limitations

Luma is a **work in progress**. Here's what's not yet supported:

- No editor/IDE support (no syntax highlighting, intellisense, LSP, or formatter)
- No REPL / interactive mode
- No module system at runtime (`import`/`export` are parsed but not interpreted)
- Struct and enum values cannot be instantiated yet (declarations are parsed)
- No standard library beyond the built-in functions listed above
- No string interpolation
- No multi-line comments
- Error messages may be unhelpful in some edge cases

---

## Development

Everything below is for contributing to or hacking on Luma itself.

### Prerequisites

- [Bun](https://bun.sh) v1.3.8 or later

### Setup

```bash
git clone https://github.com/anishshobithps/luma.git
cd luma
bun install
```

### Scripts

| Script                | Purpose                            |
| --------------------- | ---------------------------------- |
| `bun start <file>`    | Run a `.luma` file via Bun         |
| `bun run build`       | Compile to a standalone executable |
| `bun test`            | Run the test suite                 |
| `bun test --watch`    | Run tests in watch mode            |
| `bun test --coverage` | Run tests with coverage            |
| `bun run typecheck`   | Type-check with `tsc`              |

### Debug Scripts

These dump internal representations and are useful when working on the compiler internals:

```bash
bun run scripts/run_lexer.ts examples/01_lexer.luma       # dump tokens
bun run scripts/run_parser.ts examples/02_parser.luma      # dump AST
bun run scripts/run_interpreter.ts examples/03_interpreter.luma  # run via script
```

### Project Structure

```
index.ts             CLI entry point
src/
  ast/               Expression & declaration AST nodes
  diagnostic/        Error rendering with labeled spans
  error/             Lex, parse, and runtime error types
  interpreter/       Tree-walking interpreter, environment, values
  lexer/             Tokenizer and token definitions
  parser/            Recursive-descent parser
  utils/             Character helpers, escape sequences, keywords
tests/               Mirror of src/ with comprehensive tests
examples/            Sample .luma programs
scripts/             Dev-only debug runners (lexer, parser, interpreter)
```

## License

Licensed under the [Apache License 2.0](LICENSE).
