import { describe, expect, test } from "bun:test"
import { Either } from "effect"
import { lex } from "@/lexer/lexer"
import { parse } from "@/parser/parser"
import { interpret } from "@/interpreter/eval"
import { display } from "@/interpreter/value"

const run = (source: string) => {
    const lexResult = lex(source, "test.luma")
    if (Either.isLeft(lexResult)) throw new Error(lexResult.left.render())
    const parseResult = parse(lexResult.right, source, "test.luma")
    if (Either.isLeft(parseResult)) throw new Error(parseResult.left.render())
    const result = interpret(parseResult.right)
    if (Either.isLeft(result)) throw new Error(result.left.render())
    return result.right
}

const eval_ = (source: string) => {
    const { value } = run(source)
    return display(value)
}

const fails = (source: string): boolean => {
    const lexResult = lex(source, "test.luma")
    if (Either.isLeft(lexResult)) return true
    const parseResult = parse(lexResult.right, source, "test.luma")
    if (Either.isLeft(parseResult)) return true
    return Either.isLeft(interpret(parseResult.right))
}

describe("interpreter - literals", () => {
    test("integer literal", () => {
        expect(eval_("42;")).toBe("42")
    })

    test("float literal", () => {
        expect(eval_("3.14;")).toBe("3.14")
    })

    test("string literal", () => {
        expect(eval_('"hello";')).toBe("hello")
    })

    test("bool true", () => {
        expect(eval_("true;")).toBe("true")
    })

    test("bool false", () => {
        expect(eval_("false;")).toBe("false")
    })

    test("nil literal", () => {
        expect(eval_("nil;")).toBe("nil")
    })
})

describe("interpreter - arithmetic", () => {
    test("addition", () => {
        expect(eval_("1 + 2;")).toBe("3")
    })

    test("subtraction", () => {
        expect(eval_("10 - 3;")).toBe("7")
    })

    test("multiplication", () => {
        expect(eval_("4 * 5;")).toBe("20")
    })

    test("integer division", () => {
        expect(eval_("10 / 3;")).toBe("3")
    })

    test("modulo", () => {
        expect(eval_("10 % 3;")).toBe("1")
    })

    test("power", () => {
        expect(eval_("2 ** 10;")).toBe("1024")
    })

    test("precedence: mul before add", () => {
        expect(eval_("2 + 3 * 4;")).toBe("14")
    })

    test("negative integer", () => {
        expect(eval_("-5;")).toBe("-5")
    })

    test("float arithmetic", () => {
        expect(eval_("1.5 + 2.5;")).toBe("4")
    })

    test("float subtraction", () => {
        expect(eval_("2.5 - 1.5;")).toBe("1")
    })

    test("float multiplication", () => {
        expect(eval_("2.5 * 2.0;")).toBe("5")
    })

    test("float power", () => {
        expect(eval_("2.0 ** 3.0;")).toBe("8")
    })

    test("float modulo", () => {
        expect(eval_("5.5 % 2.0;")).toBe("1.5")
    })

    test("float division", () => {
        expect(eval_("6.0 / 2.0;")).toBe("3")
    })

    test("float division by zero fails", () => {
        expect(fails("1.0 / 0.0;")).toBe(true)
    })

    test("negative float", () => {
        expect(eval_("-3.14;")).toBe("-3.14")
    })

    test("mixed int and float arithmetic", () => {
        expect(eval_("1 + 2.5;")).toBe("3.5")
    })

    test("division by zero fails", () => {
        expect(fails("1 / 0;")).toBe(true)
    })
})

describe("interpreter - comparison", () => {
    test("equal integers", () => {
        expect(eval_("1 == 1;")).toBe("true")
    })

    test("not equal", () => {
        expect(eval_("1 != 2;")).toBe("true")
    })

    test("less than", () => {
        expect(eval_("3 < 5;")).toBe("true")
    })

    test("greater than or equal", () => {
        expect(eval_("5 >= 5;")).toBe("true")
    })

    test("float less than", () => {
        expect(eval_("1.5 < 2.5;")).toBe("true")
    })

    test("float less equal", () => {
        expect(eval_("2.5 <= 2.5;")).toBe("true")
    })

    test("float greater than", () => {
        expect(eval_("3.5 > 2.5;")).toBe("true")
    })

    test("float greater equal", () => {
        expect(eval_("2.5 >= 2.5;")).toBe("true")
    })

    test("bool equality", () => {
        expect(eval_("true == true;")).toBe("true")
    })

    test("bool inequality", () => {
        expect(eval_("true == false;")).toBe("false")
    })

    test("nil equality", () => {
        expect(eval_("nil == nil;")).toBe("true")
    })
})

describe("interpreter - logic", () => {
    test("and true", () => {
        expect(eval_("true and true;")).toBe("true")
    })

    test("and false", () => {
        expect(eval_("true and false;")).toBe("false")
    })

    test("or", () => {
        expect(eval_("false or true;")).toBe("true")
    })

    test("not", () => {
        expect(eval_("not true;")).toBe("false")
    })
})

describe("interpreter - bitwise", () => {
    test("bitwise and", () => {
        expect(eval_("0xFF & 0x0F;")).toBe("15")
    })

    test("bitwise or", () => {
        expect(eval_("0xF0 | 0x0F;")).toBe("255")
    })

    test("bitwise xor", () => {
        expect(eval_("0xFF ^ 0xFF;")).toBe("0")
    })

    test("left shift", () => {
        expect(eval_("1 << 4;")).toBe("16")
    })

    test("right shift", () => {
        expect(eval_("16 >> 2;")).toBe("4")
    })

    test("bitwise not", () => {
        expect(eval_("~0;")).toBe("-1")
    })
})

describe("interpreter - string operations", () => {
    test("string concatenation", () => {
        expect(eval_('"hello" + " world";')).toBe("hello world")
    })

    test("string equality", () => {
        expect(eval_('"abc" == "abc";')).toBe("true")
    })
})

describe("interpreter - variables", () => {
    test("let binding", () => {
        expect(eval_("let x = 42; x;")).toBe("42")
    })

    test("let without initializer", () => {
        expect(eval_("let x; x;")).toBe("nil")
    })

    test("let mut and assignment", () => {
        expect(eval_("let mut x = 1; x = 2; x;")).toBe("2")
    })

    test("compound assignment +=", () => {
        expect(eval_("let mut x = 10; x += 5; x;")).toBe("15")
    })

    test("compound assignment -=", () => {
        expect(eval_("let mut x = 10; x -= 3; x;")).toBe("7")
    })

    test("compound assignment *=", () => {
        expect(eval_("let mut x = 3; x *= 4; x;")).toBe("12")
    })

    test("compound assignment /=", () => {
        expect(eval_("let mut x = 12; x /= 4; x;")).toBe("3")
    })

    test("compound assignment %=", () => {
        expect(eval_("let mut x = 10; x %= 3; x;")).toBe("1")
    })

    test("undefined variable fails", () => {
        expect(fails("x;")).toBe(true)
    })

    test("assign to non-identifier fails", () => {
        expect(fails("1 = 2;")).toBe(true)
    })
})

describe("interpreter - if expressions", () => {
    test("if true branch taken", () => {
        expect(eval_("if true { 1 } else { 2 };")).toBe("1")
    })

    test("if false branch taken", () => {
        expect(eval_("if false { 1 } else { 2 };")).toBe("2")
    })

    test("if without else returns nil", () => {
        expect(eval_("if false { 1 };")).toBe("nil")
    })

    test("if with condition expression", () => {
        expect(eval_("let x = 5; if x > 3 { 100 } else { 0 };")).toBe("100")
    })

    test("if else-if chain", () => {
        expect(eval_(`
            let x = 75;
            if x >= 90 { "A" } else if x >= 80 { "B" } else if x >= 70 { "C" } else { "F" };
        `)).toBe("C")
    })
})

describe("interpreter - match expressions", () => {
    test("matches integer literal", () => {
        expect(eval_("match 1 { 1 => 100, _ => 0 };")).toBe("100")
    })

    test("wildcard fallthrough", () => {
        expect(eval_("match 99 { 1 => 100, _ => 0 };")).toBe("0")
    })

    test("matches string", () => {
        expect(eval_('"ok" == "ok";')).toBe("true")
    })

    test("no matching arm returns nil", () => {
        expect(eval_("match 5 { 1 => 1 };")).toBe("nil")
    })

    test("matches float literal", () => {
        expect(eval_("match 3.14 { 3.14 => 1, _ => 0 };")).toBe("1")
    })

    test("matches string literal", () => {
        expect(eval_('match "hi" { "hi" => 1, _ => 0 };')).toBe("1")
    })

    test("matches bool literal", () => {
        expect(eval_("match true { true => 1, _ => 0 };")).toBe("1")
    })

    test("matches nil literal", () => {
        expect(eval_("match nil { nil => 1, _ => 0 };")).toBe("1")
    })
})

describe("interpreter - functions", () => {
    test("define and call a function", () => {
        expect(eval_("fn double(n) { return n * 2; } double(21);")).toBe("42")
    })

    test("function with multiple params", () => {
        expect(eval_("fn add(a, b) { return a + b; } add(3, 4);")).toBe("7")
    })

    test("recursive function", () => {
        expect(eval_(`
            fn fact(n) {
                if n <= 1 { return 1; }
                return n * fact(n - 1);
            }
            fact(5);
        `)).toBe("120")
    })

    test("function closes over outer scope", () => {
        expect(eval_(`
            let base = 100;
            fn offset(x) { return base + x; }
            offset(42);
        `)).toBe("142")
    })

    test("function returns nil when no return", () => {
        expect(eval_("fn noop() {} noop();")).toBe("nil")
    })

    test("wrong arity fails", () => {
        expect(fails("fn f(a) { a; } f(1, 2);")).toBe(true)
    })

    test("call non-callable fails", () => {
        expect(fails("let x = 42; x();")).toBe(true)
    })

    test("native fn wrong arity fails", () => {
        expect(fails("len(1, 2);")).toBe(true)
    })

    test("break in function body returns nil", () => {
        expect(eval_("fn f() { break; } f();")).toBe("nil")
    })
})

describe("interpreter - arrays", () => {
    test("array literal", () => {
        expect(eval_("[1, 2, 3];")).toBe("[1, 2, 3]")
    })

    test("empty array", () => {
        expect(eval_("[];")).toBe("[]")
    })

    test("array index", () => {
        expect(eval_("let a = [10, 20, 30]; a[1];")).toBe("20")
    })

    test("array index out of bounds fails", () => {
        expect(fails("[1, 2][5];")).toBe(true)
    })

    test("negative array index", () => {
        expect(eval_("let a = [10, 20, 30]; a[-1];")).toBe("30")
    })

    test("index non-array fails", () => {
        expect(fails("let x = 42; x[0];")).toBe(true)
    })

    test("len() on array", () => {
        expect(eval_("len([1, 2, 3]);")).toBe("3")
    })
})

describe("interpreter - ranges", () => {
    test("exclusive range", () => {
        expect(eval_("0..5;")).toBe("0..5")
    })

    test("inclusive range", () => {
        expect(eval_("0..=5;")).toBe("0..=5")
    })

    test("len() on range", () => {
        expect(eval_("len(0..5);")).toBe("5")
    })

    test("len() on inclusive range", () => {
        expect(eval_("len(0..=4);")).toBe("5")
    })
})

describe("interpreter - while loops", () => {
    test("while loop runs body", () => {
        expect(eval_(`
            let mut i = 0;
            let mut s = 0;
            while i < 5 {
                s += i;
                i += 1;
            }
            s;
        `)).toBe("10")
    })

    test("while with false condition never runs", () => {
        expect(eval_(`
            let mut ran = false;
            while false { ran = true; }
            ran;
        `)).toBe("false")
    })

    test("break exits while loop", () => {
        expect(eval_(`
            let mut i = 0;
            while true {
                if i == 3 { break; }
                i += 1;
            }
            i;
        `)).toBe("3")
    })

    test("continue skips iteration in while loop", () => {
        expect(eval_(`
            let mut sum = 0;
            let mut i = 0;
            while i < 5 {
                i += 1;
                if i == 3 { continue; }
                sum += i;
            }
            sum;
        `)).toBe("12")
    })
})

describe("interpreter - for loops", () => {
    test("for over array", () => {
        expect(eval_(`
            let mut sum = 0;
            for x in [1, 2, 3, 4, 5] {
                sum += x;
            }
            sum;
        `)).toBe("15")
    })

    test("for over exclusive range", () => {
        expect(eval_(`
            let mut sum = 0;
            for i in 0..5 {
                sum += i;
            }
            sum;
        `)).toBe("10")
    })

    test("for over inclusive range", () => {
        expect(eval_(`
            let mut sum = 0;
            for i in 1..=5 {
                sum += i;
            }
            sum;
        `)).toBe("15")
    })

    test("break exits for loop early", () => {
        expect(eval_(`
            let mut count = 0;
            for i in 0..100 {
                if i == 5 { break; }
                count += 1;
            }
            count;
        `)).toBe("5")
    })

    test("for over non-iterable fails", () => {
        expect(fails("for x in 42 { x; }")).toBe(true)
    })

    test("continue in for loop", () => {
        expect(eval_(`
            let mut sum = 0;
            for i in 0..5 {
                if i == 2 { continue; }
                sum += i;
            }
            sum;
        `)).toBe("8")
    })

    test("continue in for over array", () => {
        expect(eval_(`
            let mut sum = 0;
            for x in [1, 2, 3, 4, 5] {
                if x == 3 { continue; }
                sum += x;
            }
            sum;
        `)).toBe("12")
    })
})

describe("interpreter - structs", () => {
    test("struct construction and field access", () => {
        expect(eval_(`
            struct Point { x, y }
            let p = Point(3, 4);
            p.x;
        `)).toBe("3")
    })

    test("struct field y", () => {
        expect(eval_(`
            struct Point { x, y }
            let p = Point(10, 20);
            p.y;
        `)).toBe("20")
    })

    test("field access on non-struct returns nil", () => {
        expect(eval_("let x = 42; x.field;")).toBe("nil")
    })

    test("struct display", () => {
        expect(eval_(`
            struct Point { x, y }
            let p = Point(1, 2);
            str(p);
        `)).toBe("Point { x: 1, y: 2 }")
    })

    test("field not found on struct fails", () => {
        expect(fails(`
            struct Point { x, y }
            let p = Point(1, 2);
            p.z;
        `)).toBe(true)
    })
})

describe("interpreter - enums", () => {
    test("enum variant value", () => {
        expect(eval_("enum Color { Red, Green, Blue } Color_Red;")).toBe("Color::Red")
    })
})

describe("interpreter - builtins", () => {
    test("str() converts int to string", () => {
        expect(eval_("str(42);")).toBe("42")
    })

    test("str() converts bool to string", () => {
        expect(eval_("str(true);")).toBe("true")
    })

    test("int() converts float to int", () => {
        expect(eval_("int(3.9);")).toBe("3")
    })

    test("int() converts string to int", () => {
        expect(eval_('int("42");')).toBe("42")
    })

    test("len() on string", () => {
        expect(eval_('"hello".len;')).toBe("nil")
        expect(eval_('len("hello");')).toBe("5")
    })

    test("len() on non-collection returns 0", () => {
        expect(eval_("len(true);")).toBe("0")
    })

    test("int() on bool returns nil", () => {
        expect(eval_("int(true);")).toBe("nil")
    })

    test("int() on int returns same value", () => {
        expect(eval_("int(42);")).toBe("42")
    })

    test("int() on unparseable string returns nil", () => {
        expect(eval_('int("abc");')).toBe("nil")
    })

    test("unary minus on string fails", () => {
        expect(fails('-"hello";')).toBe(true)
    })

    test("unsupported binary operator fails", () => {
        expect(fails('"hello" - "world";')).toBe(true)
    })
})

describe("interpreter - type and import declarations", () => {
    test("type declaration is accepted", () => {
        expect(eval_("type Point = Vec2;")).toBe("nil")
    })

    test("import declaration is accepted", () => {
        expect(eval_("import math;")).toBe("nil")
    })
})
