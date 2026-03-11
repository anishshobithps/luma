import { describe, expect, test } from "bun:test"
import { Either, Option } from "effect"
import { lex } from "@/lexer/lexer"
import { parse } from "@/parser/parser"
import {
    ArrayExpr, AssignExpr, BinaryExpr, BlockExpr, BoolLiteral,
    CallExpr, ExprStmt, FieldExpr, FloatLiteral, IfExpr, IndexExpr,
    IntLiteral, LetStmt, MatchExpr, NilLiteral, RangeExpr,
    ReturnStmt, StringLiteral, UnaryExpr, Identifier,
} from "@/ast/expr"
import { EnumDecl, FnDecl, ImportDecl, StructDecl, TypeDecl } from "@/ast/decl"

const parseSource = (source: string) => {
    const lexResult = lex(source, "test.luma")
    if (Either.isLeft(lexResult)) throw new Error(lexResult.left.render())
    const parseResult = parse(lexResult.right, source, "test.luma")
    if (Either.isLeft(parseResult)) throw new Error(parseResult.left.render())
    return parseResult.right
}

const fails = (source: string): boolean => {
    const lexResult = lex(source, "test.luma")
    if (Either.isLeft(lexResult)) return true
    return Either.isLeft(parse(lexResult.right, source, "test.luma"))
}

const firstDecl = (source: string) => parseSource(source).decls[0]!

const exprOf = (source: string) => {
    const program = parseSource(source)
    const first = program.decls[0] as unknown as ExprStmt
    return first.expr
}

describe("parser - literals", () => {
    test("integer literal", () => {
        const expr = exprOf("42;")
        expect(expr).toBeInstanceOf(IntLiteral)
        expect((expr as IntLiteral).value).toBe(42n)
    })

    test("float literal", () => {
        const expr = exprOf("3.14;")
        expect(expr).toBeInstanceOf(FloatLiteral)
        expect((expr as FloatLiteral).value).toBeCloseTo(3.14)
    })

    test("string literal", () => {
        const expr = exprOf('"hello";')
        expect(expr).toBeInstanceOf(StringLiteral)
        expect((expr as StringLiteral).value).toBe("hello")
    })

    test("bool true", () => {
        expect((exprOf("true;") as BoolLiteral).value).toBe(true)
    })

    test("bool false", () => {
        expect((exprOf("false;") as BoolLiteral).value).toBe(false)
    })

    test("nil literal", () => {
        expect(exprOf("nil;")).toBeInstanceOf(NilLiteral)
    })

    test("hex integer parsed to correct value", () => {
        expect((exprOf("0xFF;") as IntLiteral).value).toBe(255n)
    })

    test("octal integer parsed to correct value", () => {
        expect((exprOf("0o10;") as IntLiteral).value).toBe(8n)
    })

    test("binary integer parsed to correct value", () => {
        expect((exprOf("0b1010;") as IntLiteral).value).toBe(10n)
    })

    test("array literal with elements", () => {
        const expr = exprOf("[1, 2, 3];") as ArrayExpr
        expect(expr).toBeInstanceOf(ArrayExpr)
        expect(expr.elements).toHaveLength(3)
        expect((expr.elements[0] as IntLiteral).value).toBe(1n)
    })

    test("empty array literal", () => {
        expect((exprOf("[];") as ArrayExpr).elements).toHaveLength(0)
    })
})

describe("parser - binary expressions", () => {
    test("addition", () => {
        const expr = exprOf("1 + 2;") as BinaryExpr
        expect(expr).toBeInstanceOf(BinaryExpr)
        expect(expr.op).toBe("+")
        expect((expr.left as IntLiteral).value).toBe(1n)
        expect((expr.right as IntLiteral).value).toBe(2n)
    })

    test("operator precedence: * before +", () => {
        const expr = exprOf("1 + 2 * 3;") as BinaryExpr
        expect(expr.op).toBe("+")
        expect((expr.right as BinaryExpr).op).toBe("*")
    })

    test("operator precedence: + before ==", () => {
        const expr = exprOf("1 + 2 == 3;") as BinaryExpr
        expect(expr.op).toBe("==")
        expect((expr.left as BinaryExpr).op).toBe("+")
    })

    test("operator precedence: & before |", () => {
        const expr = exprOf("a & b | c;") as BinaryExpr
        expect(expr.op).toBe("|")
        expect((expr.left as BinaryExpr).op).toBe("&")
    })

    test("operator precedence: comparison before logical", () => {
        const expr = exprOf("a < b and c > d;") as BinaryExpr
        expect(expr.op).toBe("and")
        expect((expr.left as BinaryExpr).op).toBe("<")
    })

    test("power is right-associative", () => {
        const expr = exprOf("2 ** 3 ** 4;") as BinaryExpr
        expect(expr.op).toBe("**")
        expect((expr.right as BinaryExpr).op).toBe("**")
    })

    test("shift operators", () => {
        expect((exprOf("a << 1;") as BinaryExpr).op).toBe("<<")
        expect((exprOf("a >> 1;") as BinaryExpr).op).toBe(">>")
    })

    test("logical and / or", () => {
        expect((exprOf("a and b;") as BinaryExpr).op).toBe("and")
        expect((exprOf("a or b;") as BinaryExpr).op).toBe("or")
    })

    test("bitwise xor", () => {
        expect((exprOf("a ^ b;") as BinaryExpr).op).toBe("^")
    })
})

describe("parser - unary expressions", () => {
    test("unary minus", () => {
        const expr = exprOf("-42;") as UnaryExpr
        expect(expr).toBeInstanceOf(UnaryExpr)
        expect(expr.op).toBe("-")
        expect((expr.operand as IntLiteral).value).toBe(42n)
    })

    test("unary not keyword", () => {
        expect((exprOf("not true;") as UnaryExpr).op).toBe("not")
    })

    test("unary bang", () => {
        expect((exprOf("!true;") as UnaryExpr).op).toBe("!")
    })

    test("unary tilde", () => {
        const expr = exprOf("~x;") as UnaryExpr
        expect(expr).toBeInstanceOf(UnaryExpr)
        expect(expr.op).toBe("~")
        expect((expr.operand as Identifier).name).toBe("x")
    })

    test("double negation", () => {
        const expr = exprOf("--x;") as UnaryExpr
        expect(expr.op).toBe("-")
        expect(expr.operand).toBeInstanceOf(UnaryExpr)
    })
})

describe("parser - postfix expressions", () => {
    test("function call", () => {
        const expr = exprOf("foo(1, 2);") as CallExpr
        expect(expr).toBeInstanceOf(CallExpr)
        expect((expr.callee as Identifier).name).toBe("foo")
        expect(expr.args).toHaveLength(2)
    })

    test("call with no args", () => {
        expect((exprOf("foo();") as CallExpr).args).toHaveLength(0)
    })

    test("nested call as argument", () => {
        const expr = exprOf("f(g(1));") as CallExpr
        expect(expr.args[0]).toBeInstanceOf(CallExpr)
    })

    test("chained call", () => {
        const expr = exprOf("f()();") as CallExpr
        expect(expr).toBeInstanceOf(CallExpr)
        expect(expr.callee).toBeInstanceOf(CallExpr)
    })

    test("index expression", () => {
        const expr = exprOf("arr[0];") as IndexExpr
        expect(expr).toBeInstanceOf(IndexExpr)
        expect((expr.target as Identifier).name).toBe("arr")
        expect((expr.index as IntLiteral).value).toBe(0n)
    })

    test("chained index", () => {
        const expr = exprOf("arr[0][1];") as IndexExpr
        expect(expr.target).toBeInstanceOf(IndexExpr)
    })

    test("field access", () => {
        const expr = exprOf("obj.x;") as FieldExpr
        expect(expr).toBeInstanceOf(FieldExpr)
        expect((expr.target as Identifier).name).toBe("obj")
        expect(expr.field).toBe("x")
    })

    test("chained field access", () => {
        const expr = exprOf("a.b.c;") as FieldExpr
        expect(expr.field).toBe("c")
        expect(expr.target).toBeInstanceOf(FieldExpr)
        expect((expr.target as FieldExpr).field).toBe("b")
    })

    test("method call: field then call", () => {
        const expr = exprOf("obj.method();") as CallExpr
        expect(expr).toBeInstanceOf(CallExpr)
        expect(expr.callee).toBeInstanceOf(FieldExpr)
        expect((expr.callee as FieldExpr).field).toBe("method")
    })
})

describe("parser - grouped and block expressions", () => {
    test("grouped expression overrides precedence", () => {
        const expr = exprOf("(1 + 2) * 3;") as BinaryExpr
        expect(expr.op).toBe("*")
        expect((expr.left as BinaryExpr).op).toBe("+")
    })

    test("standalone block expression", () => {
        const expr = exprOf("{ 1 };") as BlockExpr
        expect(expr).toBeInstanceOf(BlockExpr)
        expect(expr.stmts).toHaveLength(1)
    })

    test("empty block expression", () => {
        expect((exprOf("{};") as BlockExpr).stmts).toHaveLength(0)
    })
})

describe("parser - assignment expressions", () => {
    test("simple assignment", () => {
        const expr = exprOf("x = 1;") as AssignExpr
        expect(expr).toBeInstanceOf(AssignExpr)
        expect(expr.op).toBe("=")
    })

    test("compound assignment +=", () => {
        expect((exprOf("x += 1;") as AssignExpr).op).toBe("+=")
    })

    test("compound assignment -=", () => {
        expect((exprOf("x -= 1;") as AssignExpr).op).toBe("-=")
    })

    test("compound assignment *=", () => {
        expect((exprOf("x *= 2;") as AssignExpr).op).toBe("*=")
    })

    test("compound assignment /=", () => {
        expect((exprOf("x /= 2;") as AssignExpr).op).toBe("/=")
    })

    test("compound assignment %=", () => {
        expect((exprOf("x %= 3;") as AssignExpr).op).toBe("%=")
    })
})

describe("parser - range expressions", () => {
    test("exclusive range", () => {
        const expr = exprOf("0..10;") as RangeExpr
        expect(expr).toBeInstanceOf(RangeExpr)
        expect(expr.inclusive).toBe(false)
        expect((expr.from as IntLiteral).value).toBe(0n)
        expect((expr.to as IntLiteral).value).toBe(10n)
    })

    test("inclusive range", () => {
        expect((exprOf("0..=10;") as RangeExpr).inclusive).toBe(true)
    })

    test("range with identifier bounds", () => {
        const expr = exprOf("start..end;") as RangeExpr
        expect((expr.from as Identifier).name).toBe("start")
        expect((expr.to as Identifier).name).toBe("end")
    })
})

describe("parser - statements", () => {
    test("let statement with value", () => {
        const stmt = parseSource("let x = 42;").decls[0] as unknown as LetStmt
        expect(stmt).toBeInstanceOf(LetStmt)
        expect(stmt.name).toBe("x")
        expect(stmt.mutable).toBe(false)
        expect(Option.isSome(stmt.value)).toBe(true)
    })

    test("let mut statement", () => {
        const stmt = parseSource("let mut x = 0;").decls[0] as unknown as LetStmt
        expect(stmt.mutable).toBe(true)
    })

    test("let without value", () => {
        const stmt = parseSource("let x;").decls[0] as unknown as LetStmt
        expect(stmt).toBeInstanceOf(LetStmt)
        expect(Option.isNone(stmt.value)).toBe(true)
    })

    test("return with value", () => {
        const fn_ = parseSource("fn f() { return 42; }").decls[0] as FnDecl
        const ret = fn_.body.stmts[0] as ReturnStmt
        expect(ret).toBeInstanceOf(ReturnStmt)
        expect(Option.isSome(ret.value)).toBe(true)
    })

    test("return without value", () => {
        const fn_ = parseSource("fn f() { return; }").decls[0] as FnDecl
        const ret = fn_.body.stmts[0] as ReturnStmt
        expect(Option.isNone(ret.value)).toBe(true)
    })

    test("multiple statements in function body", () => {
        const fn_ = parseSource("fn f() { let x = 1; let y = 2; return x; }").decls[0] as FnDecl
        expect(fn_.body.stmts).toHaveLength(3)
    })
})

describe("parser - if expression", () => {
    test("if without else", () => {
        const expr = exprOf("if x { 1 };") as IfExpr
        expect(expr).toBeInstanceOf(IfExpr)
        expect(Option.isNone(expr.else_)).toBe(true)
    })

    test("if with else", () => {
        expect(Option.isSome((exprOf("if x { 1 } else { 2 };") as IfExpr).else_)).toBe(true)
    })

    test("if else-if chain", () => {
        const expr = exprOf("if a { 1 } else if b { 2 } else { 3 };") as IfExpr
        const elseIf = Option.getOrThrow(expr.else_)
        expect(elseIf).toBeInstanceOf(IfExpr)
    })

    test("if condition is a binary expression", () => {
        const expr = exprOf("if x > 0 { 1 };") as IfExpr
        expect(expr.condition).toBeInstanceOf(BinaryExpr)
    })

    test("if then-branch is a BlockExpr", () => {
        expect((exprOf("if x { 1 };") as IfExpr).then).toBeInstanceOf(BlockExpr)
    })
})

describe("parser - match expression", () => {
    test("basic match", () => {
        const expr = exprOf('match x { 0 => "zero", _ => "other" };') as MatchExpr
        expect(expr).toBeInstanceOf(MatchExpr)
        expect(expr.arms).toHaveLength(2)
    })

    test("arm pattern and body", () => {
        const arm = (exprOf("match x { 1 => 2 };") as MatchExpr).arms[0]!
        expect((arm.pattern as IntLiteral).value).toBe(1n)
        expect((arm.body as IntLiteral).value).toBe(2n)
    })

    test("scrutinee is an expression", () => {
        const expr = exprOf("match x + 1 { 0 => 1 };") as MatchExpr
        expect(expr.scrutinee).toBeInstanceOf(BinaryExpr)
    })

    test("wildcard arm via identifier", () => {
        const expr = exprOf("match x { _ => 0 };") as MatchExpr
        expect((expr.arms[0]!.pattern as Identifier).name).toBe("_")
    })
})

describe("parser - declarations", () => {
    test("function with no params", () => {
        const decl = firstDecl("fn greet() {}") as FnDecl
        expect(decl).toBeInstanceOf(FnDecl)
        expect(decl.name).toBe("greet")
        expect(decl.params).toHaveLength(0)
        expect(decl.exported).toBe(false)
    })

    test("function with one param", () => {
        const decl = firstDecl("fn inc(n) { return n; }") as FnDecl
        expect(decl.params).toHaveLength(1)
        expect(decl.params[0]!.name).toBe("n")
    })

    test("function with multiple params", () => {
        const decl = firstDecl("fn add(a, b) { return a; }") as FnDecl
        expect(decl.params).toHaveLength(2)
        expect(decl.params[0]!.name).toBe("a")
        expect(decl.params[1]!.name).toBe("b")
    })

    test("exported function", () => {
        expect((firstDecl("export fn greet() {}") as FnDecl).exported).toBe(true)
    })

    test("struct with fields", () => {
        const decl = firstDecl("struct Point { x, y }") as StructDecl
        expect(decl).toBeInstanceOf(StructDecl)
        expect(decl.name).toBe("Point")
        expect(decl.fields).toHaveLength(2)
        expect(decl.fields[0]!.name).toBe("x")
    })

    test("empty struct", () => {
        expect((firstDecl("struct Unit {}") as StructDecl).fields).toHaveLength(0)
    })

    test("enum with variants", () => {
        const decl = firstDecl("enum Dir { North, South }") as EnumDecl
        expect(decl).toBeInstanceOf(EnumDecl)
        expect(decl.variants).toHaveLength(2)
        expect(decl.variants[0]!.name).toBe("North")
    })

    test("empty enum", () => {
        expect((firstDecl("enum Empty {}") as EnumDecl).variants).toHaveLength(0)
    })

    test("type alias", () => {
        const decl = firstDecl("type Alias = Point;") as TypeDecl
        expect(decl).toBeInstanceOf(TypeDecl)
        expect(decl.name).toBe("Alias")
        expect(decl.alias).toBe("Point")
    })

    test("import without alias", () => {
        const decl = firstDecl("import math;") as ImportDecl
        expect(decl).toBeInstanceOf(ImportDecl)
        expect(decl.path).toBe("math")
        expect(Option.isNone(decl.alias)).toBe(true)
    })

    test("import with alias", () => {
        const decl = firstDecl("import math as m;") as ImportDecl
        expect(Option.getOrThrow(decl.alias)).toBe("m")
    })

    test("multiple top-level declarations", () => {
        expect(parseSource("fn f() {} fn g() {}").decls).toHaveLength(2)
    })

    test("mixed top-level declarations and statements", () => {
        expect(parseSource("let x = 1; fn f() {}").decls).toHaveLength(2)
    })
})

describe("parser - errors", () => {
    test("unclosed parenthesis", () => {
        expect(fails("(1 + 2")).toBe(true)
    })

    test("missing function name", () => {
        expect(fails("fn () {}")).toBe(true)
    })

    test("export on non-function", () => {
        expect(fails("export struct Foo {}")).toBe(true)
    })

    test("missing closing brace on block", () => {
        expect(fails("fn f() { let x = 1;")).toBe(true)
    })

    test("missing closing bracket on array", () => {
        expect(fails("[1, 2, 3")).toBe(true)
    })

    test("field access with non-identifier after dot", () => {
        expect(fails("obj.42;")).toBe(true)
    })
})
