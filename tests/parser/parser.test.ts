import { describe, expect, test } from "bun:test"
import { Either } from "effect"
import { lex } from "@/lexer/lexer"
import { parse } from "@/parser/parser"
import {
    AssignExpr, BinaryExpr, BoolLiteral, CallExpr, ExprStmt,
    FloatLiteral, IfExpr, IntLiteral, LetStmt, MatchExpr,
    NilLiteral, RangeExpr, ReturnStmt, StringLiteral, UnaryExpr,
    Identifier, ArrayExpr,
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
const firstStmt = (source: string) => {
    const decl = firstDecl(source) as unknown as { expr?: unknown; stmts?: unknown }
    const program = parseSource(source)
    return (program.decls[0] as unknown as { expr: unknown }).expr
        ?? program.decls[0]
}
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

    test("bool literals", () => {
        expect(exprOf("true;")).toBeInstanceOf(BoolLiteral)
        expect((exprOf("true;") as BoolLiteral).value).toBe(true)
        expect((exprOf("false;") as BoolLiteral).value).toBe(false)
    })

    test("nil literal", () => {
        expect(exprOf("nil;")).toBeInstanceOf(NilLiteral)
    })

    test("hex integer", () => {
        const expr = exprOf("0xFF;")
        expect((expr as IntLiteral).value).toBe(255n)
    })

    test("binary integer", () => {
        const expr = exprOf("0b1010;")
        expect((expr as IntLiteral).value).toBe(10n)
    })

    test("array literal", () => {
        const expr = exprOf("[1, 2, 3];")
        expect(expr).toBeInstanceOf(ArrayExpr)
        expect((expr as ArrayExpr).elements).toHaveLength(3)
    })

    test("empty array literal", () => {
        const expr = exprOf("[];")
        expect(expr).toBeInstanceOf(ArrayExpr)
        expect((expr as ArrayExpr).elements).toHaveLength(0)
    })
})

describe("parser - expressions", () => {
    test("binary arithmetic", () => {
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

    test("power is right-associative", () => {
        const expr = exprOf("2 ** 3 ** 4;") as BinaryExpr
        expect(expr.op).toBe("**")
        expect((expr.right as BinaryExpr).op).toBe("**")
    })

    test("unary minus", () => {
        const expr = exprOf("-42;") as UnaryExpr
        expect(expr).toBeInstanceOf(UnaryExpr)
        expect(expr.op).toBe("-")
    })

    test("unary not", () => {
        const expr = exprOf("not true;") as UnaryExpr
        expect(expr.op).toBe("not")
    })

    test("grouped expression", () => {
        const expr = exprOf("(1 + 2) * 3;") as BinaryExpr
        expect(expr.op).toBe("*")
        expect((expr.left as BinaryExpr).op).toBe("+")
    })

    test("call expression", () => {
        const expr = exprOf("foo(1, 2);") as CallExpr
        expect(expr).toBeInstanceOf(CallExpr)
        expect((expr.callee as Identifier).name).toBe("foo")
        expect(expr.args).toHaveLength(2)
    })

    test("call with no args", () => {
        const expr = exprOf("foo();") as CallExpr
        expect(expr.args).toHaveLength(0)
    })

    test("assignment", () => {
        const expr = exprOf("x = 1;") as AssignExpr
        expect(expr).toBeInstanceOf(AssignExpr)
        expect(expr.op).toBe("=")
    })

    test("compound assignment", () => {
        const expr = exprOf("x += 1;") as AssignExpr
        expect(expr.op).toBe("+=")
    })

    test("range exclusive", () => {
        const expr = exprOf("0..10;") as RangeExpr
        expect(expr).toBeInstanceOf(RangeExpr)
        expect(expr.inclusive).toBe(false)
    })

    test("range inclusive", () => {
        const expr = exprOf("0..=10;") as RangeExpr
        expect(expr.inclusive).toBe(true)
    })
})

describe("parser - statements", () => {
    test("let statement", () => {
        const program = parseSource("let x = 42;")
        const stmt = program.decls[0] as unknown as LetStmt
        expect(stmt).toBeInstanceOf(LetStmt)
        expect(stmt.name).toBe("x")
        expect(stmt.mutable).toBe(false)
    })

    test("let mut statement", () => {
        const program = parseSource("let mut x = 0;")
        const stmt = program.decls[0] as unknown as LetStmt
        expect(stmt.mutable).toBe(true)
    })

    test("return statement with value", () => {
        const program = parseSource("fn f() { return 42; }")
        const fn_ = program.decls[0] as FnDecl
        const ret = fn_.body.stmts[0] as ReturnStmt
        expect(ret).toBeInstanceOf(ReturnStmt)
    })
})

describe("parser - if expression", () => {
    test("if without else", () => {
        const expr = exprOf("if x { 1 };") as IfExpr
        expect(expr).toBeInstanceOf(IfExpr)
        expect(expr.else_._tag).toBe("None")
    })

    test("if with else", () => {
        const expr = exprOf("if x { 1 } else { 2 };") as IfExpr
        expect(expr.else_._tag).toBe("Some")
    })

    test("if else-if chain", () => {
        const expr = exprOf("if a { 1 } else if b { 2 } else { 3 };") as IfExpr
        expect(expr.else_._tag).toBe("Some")
        const elseIf = (expr.else_ as { value: IfExpr }).value
        expect(elseIf).toBeInstanceOf(IfExpr)
    })
})

describe("parser - match expression", () => {
    test("basic match", () => {
        const expr = exprOf('match x { 0 => "zero", _ => "other" };') as MatchExpr
        expect(expr).toBeInstanceOf(MatchExpr)
        expect(expr.arms).toHaveLength(2)
    })

    test("match arm pattern and body", () => {
        const expr = exprOf("match x { 1 => 2 };") as MatchExpr
        const arm = expr.arms[0]!
        expect((arm.pattern as IntLiteral).value).toBe(1n)
        expect((arm.body as IntLiteral).value).toBe(2n)
    })
})

describe("parser - declarations", () => {
    test("function declaration", () => {
        const decl = firstDecl("fn add(a, b) { return a; }") as FnDecl
        expect(decl).toBeInstanceOf(FnDecl)
        expect(decl.name).toBe("add")
        expect(decl.params).toHaveLength(2)
        expect(decl.exported).toBe(false)
    })

    test("exported function", () => {
        const decl = firstDecl("export fn greet() {}") as FnDecl
        expect(decl.exported).toBe(true)
    })

    test("struct declaration", () => {
        const decl = firstDecl("struct Point { x, y }") as StructDecl
        expect(decl).toBeInstanceOf(StructDecl)
        expect(decl.name).toBe("Point")
        expect(decl.fields).toHaveLength(2)
    })

    test("enum declaration", () => {
        const decl = firstDecl("enum Dir { North, South }") as EnumDecl
        expect(decl).toBeInstanceOf(EnumDecl)
        expect(decl.variants).toHaveLength(2)
    })

    test("type alias", () => {
        const decl = firstDecl("type Alias = Point;") as TypeDecl
        expect(decl).toBeInstanceOf(TypeDecl)
        expect(decl.alias).toBe("Point")
    })

    test("import", () => {
        const decl = firstDecl("import math;") as ImportDecl
        expect(decl).toBeInstanceOf(ImportDecl)
        expect(decl.path).toBe("math")
        expect(decl.alias._tag).toBe("None")
    })

    test("import with alias", () => {
        const decl = firstDecl("import math as m;") as ImportDecl
        expect((decl.alias as { value: string }).value).toBe("m")
    })
})

describe("parser - errors", () => {
    test("unclosed paren", () => {
        expect(fails("(1 + 2")).toBe(true)
    })

    test("missing fn name", () => {
        expect(fails("fn () {}")).toBe(true)
    })

    test("export non-fn", () => {
        expect(fails("export struct Foo {}")).toBe(true)
    })
})
