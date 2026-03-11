import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import {
    IntLiteral, FloatLiteral, StringLiteral, BoolLiteral, NilLiteral,
    Identifier, BinaryExpr, UnaryExpr, CallExpr, IndexExpr, FieldExpr,
    AssignExpr, RangeExpr, ArrayExpr, BlockExpr, IfExpr, MatchArm,
    MatchExpr, WhileExpr, ForExpr, BreakExpr, ContinueExpr,
    LetStmt, ReturnStmt, ExprStmt, ExprSchema, StmtSchema,
} from "@/ast/expr"
import { Span } from "@/diagnostic/span"

const span = new Span({ file: "test.luma", line: 0, column: 0, length: 1 })

const intLit = (value: bigint) => new IntLiteral({ value, span })
const floatLit = (value: number) => new FloatLiteral({ value, span })
const strLit = (value: string) => new StringLiteral({ value, span })
const boolLit = (value: boolean) => new BoolLiteral({ value, span })
const nilLit = () => new NilLiteral({ span })
const ident = (name: string) => new Identifier({ name, span })

describe("IntLiteral", () => {
    test("stores bigint value and tag", () => {
        const n = intLit(42n)
        expect(n._tag).toBe("IntLiteral")
        expect(n.value).toBe(42n)
        expect(n.span).toBe(span)
    })

    test("handles zero", () => {
        expect(intLit(0n).value).toBe(0n)
    })

    test("handles large values", () => {
        expect(intLit(2n ** 64n).value).toBe(2n ** 64n)
    })

    test("handles negative values", () => {
        expect(intLit(-1n).value).toBe(-1n)
    })
})

describe("FloatLiteral", () => {
    test("stores float value and tag", () => {
        const f = floatLit(3.14)
        expect(f._tag).toBe("FloatLiteral")
        expect(f.value).toBeCloseTo(3.14)
        expect(f.span).toBe(span)
    })

    test("handles zero", () => {
        expect(floatLit(0.0).value).toBe(0.0)
    })
})

describe("StringLiteral", () => {
    test("stores string value and tag", () => {
        const s = strLit("hello")
        expect(s._tag).toBe("StringLiteral")
        expect(s.value).toBe("hello")
    })

    test("handles empty string", () => {
        expect(strLit("").value).toBe("")
    })

    test("handles escape sequences in value", () => {
        expect(strLit("hello\nworld").value).toBe("hello\nworld")
    })
})

describe("BoolLiteral", () => {
    test("stores true", () => {
        const b = boolLit(true)
        expect(b._tag).toBe("BoolLiteral")
        expect(b.value).toBe(true)
    })

    test("stores false", () => {
        expect(boolLit(false).value).toBe(false)
    })
})

describe("NilLiteral", () => {
    test("has correct tag and span", () => {
        const n = nilLit()
        expect(n._tag).toBe("NilLiteral")
        expect(n.span).toBe(span)
    })
})

describe("Identifier", () => {
    test("stores name and tag", () => {
        const id = ident("myVar")
        expect(id._tag).toBe("Identifier")
        expect(id.name).toBe("myVar")
        expect(id.span).toBe(span)
    })

    test("handles underscore identifier", () => {
        expect(ident("_").name).toBe("_")
    })
})

describe("BinaryExpr", () => {
    test("stores op, left, right and tag", () => {
        const expr = new BinaryExpr({ op: "+", left: intLit(1n), right: intLit(2n), span })
        expect(expr._tag).toBe("BinaryExpr")
        expect(expr.op).toBe("+")
        expect((expr.left as IntLiteral).value).toBe(1n)
        expect((expr.right as IntLiteral).value).toBe(2n)
    })

    test("supports arithmetic operators", () => {
        for (const op of ["+", "-", "*", "/", "%", "**"]) {
            const expr = new BinaryExpr({ op, left: intLit(1n), right: intLit(2n), span })
            expect(expr.op).toBe(op)
        }
    })

    test("supports comparison operators", () => {
        for (const op of ["==", "!=", "<", "<=", ">", ">="]) {
            const expr = new BinaryExpr({ op, left: intLit(1n), right: intLit(2n), span })
            expect(expr.op).toBe(op)
        }
    })

    test("supports logical operators", () => {
        for (const op of ["and", "or", "&&", "||"]) {
            const expr = new BinaryExpr({ op, left: boolLit(true), right: boolLit(false), span })
            expect(expr.op).toBe(op)
        }
    })

    test("supports bitwise operators", () => {
        for (const op of ["&", "|", "^", "<<", ">>"]) {
            const expr = new BinaryExpr({ op, left: intLit(1n), right: intLit(2n), span })
            expect(expr.op).toBe(op)
        }
    })

    test("can be nested", () => {
        const inner = new BinaryExpr({ op: "*", left: intLit(2n), right: intLit(3n), span })
        const outer = new BinaryExpr({ op: "+", left: intLit(1n), right: inner, span })
        expect((outer.right as BinaryExpr).op).toBe("*")
    })
})

describe("UnaryExpr", () => {
    test("stores op and operand", () => {
        const expr = new UnaryExpr({ op: "-", operand: intLit(5n), span })
        expect(expr._tag).toBe("UnaryExpr")
        expect(expr.op).toBe("-")
        expect((expr.operand as IntLiteral).value).toBe(5n)
    })

    test("supports not", () => {
        expect(new UnaryExpr({ op: "not", operand: boolLit(true), span }).op).toBe("not")
    })

    test("supports bang", () => {
        expect(new UnaryExpr({ op: "!", operand: boolLit(true), span }).op).toBe("!")
    })

    test("supports tilde", () => {
        expect(new UnaryExpr({ op: "~", operand: intLit(0n), span }).op).toBe("~")
    })
})

describe("CallExpr", () => {
    test("stores callee and args", () => {
        const call = new CallExpr({ callee: ident("foo"), args: [intLit(1n), intLit(2n)], span })
        expect(call._tag).toBe("CallExpr")
        expect((call.callee as Identifier).name).toBe("foo")
        expect(call.args).toHaveLength(2)
    })

    test("supports empty args", () => {
        expect(new CallExpr({ callee: ident("bar"), args: [], span }).args).toHaveLength(0)
    })

    test("callee can itself be a call", () => {
        const inner = new CallExpr({ callee: ident("f"), args: [], span })
        const outer = new CallExpr({ callee: inner, args: [], span })
        expect(outer.callee).toBeInstanceOf(CallExpr)
    })
})

describe("IndexExpr", () => {
    test("stores target and index", () => {
        const expr = new IndexExpr({ target: ident("arr"), index: intLit(0n), span })
        expect(expr._tag).toBe("IndexExpr")
        expect((expr.target as Identifier).name).toBe("arr")
        expect((expr.index as IntLiteral).value).toBe(0n)
    })

    test("index can be any expression", () => {
        const expr = new IndexExpr({ target: ident("arr"), index: ident("i"), span })
        expect((expr.index as Identifier).name).toBe("i")
    })
})

describe("FieldExpr", () => {
    test("stores target and field name", () => {
        const expr = new FieldExpr({ target: ident("obj"), field: "x", span })
        expect(expr._tag).toBe("FieldExpr")
        expect((expr.target as Identifier).name).toBe("obj")
        expect(expr.field).toBe("x")
    })

    test("can be chained", () => {
        const inner = new FieldExpr({ target: ident("a"), field: "b", span })
        const outer = new FieldExpr({ target: inner, field: "c", span })
        expect(outer.field).toBe("c")
        expect((outer.target as FieldExpr).field).toBe("b")
    })
})

describe("AssignExpr", () => {
    test("stores target, op, and value", () => {
        const expr = new AssignExpr({ target: ident("x"), op: "=", value: intLit(1n), span })
        expect(expr._tag).toBe("AssignExpr")
        expect((expr.target as Identifier).name).toBe("x")
        expect(expr.op).toBe("=")
        expect((expr.value as IntLiteral).value).toBe(1n)
    })

    test("supports all compound assignment operators", () => {
        for (const op of ["+=", "-=", "*=", "/=", "%="]) {
            const expr = new AssignExpr({ target: ident("x"), op, value: intLit(1n), span })
            expect(expr.op).toBe(op)
        }
    })
})

describe("RangeExpr", () => {
    test("exclusive range stores from, to, inclusive=false", () => {
        const expr = new RangeExpr({ from: intLit(0n), to: intLit(10n), inclusive: false, span })
        expect(expr._tag).toBe("RangeExpr")
        expect((expr.from as IntLiteral).value).toBe(0n)
        expect((expr.to as IntLiteral).value).toBe(10n)
        expect(expr.inclusive).toBe(false)
    })

    test("inclusive range has inclusive=true", () => {
        const expr = new RangeExpr({ from: intLit(0n), to: intLit(10n), inclusive: true, span })
        expect(expr.inclusive).toBe(true)
    })
})

describe("ArrayExpr", () => {
    test("stores elements and tag", () => {
        const expr = new ArrayExpr({ elements: [intLit(1n), intLit(2n), intLit(3n)], span })
        expect(expr._tag).toBe("ArrayExpr")
        expect(expr.elements).toHaveLength(3)
        expect((expr.elements[0] as IntLiteral).value).toBe(1n)
    })

    test("empty array", () => {
        expect(new ArrayExpr({ elements: [], span }).elements).toHaveLength(0)
    })
})

describe("BlockExpr", () => {
    test("stores stmts and tag", () => {
        const stmt = new ExprStmt({ expr: intLit(1n), span })
        const block = new BlockExpr({ stmts: [stmt], span })
        expect(block._tag).toBe("BlockExpr")
        expect(block.stmts).toHaveLength(1)
    })

    test("empty block", () => {
        expect(new BlockExpr({ stmts: [], span }).stmts).toHaveLength(0)
    })
})

describe("IfExpr", () => {
    test("without else branch", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = new IfExpr({ condition: boolLit(true), then: block, else_: Option.none(), span })
        expect(expr._tag).toBe("IfExpr")
        expect(Option.isNone(expr.else_)).toBe(true)
    })

    test("with else branch", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = new IfExpr({ condition: boolLit(true), then: block, else_: Option.some(intLit(0n)), span })
        expect(Option.isSome(expr.else_)).toBe(true)
        expect((Option.getOrThrow(expr.else_) as IntLiteral).value).toBe(0n)
    })

    test("condition can be any expression", () => {
        const block = new BlockExpr({ stmts: [], span })
        const cond = new BinaryExpr({ op: ">", left: ident("x"), right: intLit(0n), span })
        const expr = new IfExpr({ condition: cond, then: block, else_: Option.none(), span })
        expect(expr.condition).toBeInstanceOf(BinaryExpr)
    })
})

describe("MatchArm", () => {
    test("stores pattern and body", () => {
        const arm = new MatchArm({ pattern: intLit(0n), body: strLit("zero"), span })
        expect(arm._tag).toBe("MatchArm")
        expect((arm.pattern as IntLiteral).value).toBe(0n)
        expect((arm.body as StringLiteral).value).toBe("zero")
    })

    test("wildcard pattern as identifier", () => {
        const arm = new MatchArm({ pattern: ident("_"), body: strLit("other"), span })
        expect((arm.pattern as Identifier).name).toBe("_")
    })
})

describe("MatchExpr", () => {
    test("stores scrutinee and arms", () => {
        const arm = new MatchArm({ pattern: intLit(0n), body: strLit("zero"), span })
        const expr = new MatchExpr({ scrutinee: ident("x"), arms: [arm], span })
        expect(expr._tag).toBe("MatchExpr")
        expect((expr.scrutinee as Identifier).name).toBe("x")
        expect(expr.arms).toHaveLength(1)
    })

    test("empty arms", () => {
        expect(new MatchExpr({ scrutinee: ident("x"), arms: [], span }).arms).toHaveLength(0)
    })
})

describe("LetStmt", () => {
    test("immutable with value", () => {
        const stmt = new LetStmt({ name: "x", mutable: false, value: Option.some(intLit(42n)), span })
        expect(stmt._tag).toBe("LetStmt")
        expect(stmt.name).toBe("x")
        expect(stmt.mutable).toBe(false)
        expect(Option.isSome(stmt.value)).toBe(true)
        expect((Option.getOrThrow(stmt.value) as IntLiteral).value).toBe(42n)
    })

    test("mutable without value", () => {
        const stmt = new LetStmt({ name: "x", mutable: true, value: Option.none(), span })
        expect(stmt.mutable).toBe(true)
        expect(Option.isNone(stmt.value)).toBe(true)
    })
})

describe("ReturnStmt", () => {
    test("with value", () => {
        const stmt = new ReturnStmt({ value: Option.some(intLit(0n)), span })
        expect(stmt._tag).toBe("ReturnStmt")
        expect(Option.isSome(stmt.value)).toBe(true)
    })

    test("without value", () => {
        expect(Option.isNone(new ReturnStmt({ value: Option.none(), span }).value)).toBe(true)
    })
})

describe("ExprStmt", () => {
    test("wraps an expression with tag", () => {
        const stmt = new ExprStmt({ expr: intLit(1n), span })
        expect(stmt._tag).toBe("ExprStmt")
        expect((stmt.expr as IntLiteral).value).toBe(1n)
    })
})

describe("ExprSchema", () => {
    test("validates a simple expression", () => {
        expect(Schema.is(ExprSchema)(intLit(1n))).toBe(true)
    })

    test("validates a nested expression", () => {
        const nested = new BinaryExpr({ op: "+", left: intLit(1n), right: intLit(2n), span })
        expect(Schema.is(ExprSchema)(nested)).toBe(true)
    })

    test("validates a block expression", () => {
        const block = new BlockExpr({ stmts: [new ExprStmt({ expr: intLit(1n), span })], span })
        expect(Schema.is(ExprSchema)(block)).toBe(true)
    })

    test("validates an if expression", () => {
        const block = new BlockExpr({ stmts: [], span })
        const ifExpr = new IfExpr({ condition: boolLit(true), then: block, else_: Option.none(), span })
        expect(Schema.is(ExprSchema)(ifExpr)).toBe(true)
    })

    test("validates a match expression", () => {
        const arm = new MatchArm({ pattern: intLit(0n), body: intLit(1n), span })
        const matchExpr = new MatchExpr({ scrutinee: ident("x"), arms: [arm], span })
        expect(Schema.is(ExprSchema)(matchExpr)).toBe(true)
    })

    test("rejects non-expression values", () => {
        expect(Schema.is(ExprSchema)({ random: true })).toBe(false)
    })
})

describe("StmtSchema", () => {
    test("validates a let statement", () => {
        const stmt = new LetStmt({ name: "x", mutable: false, value: Option.none(), span })
        expect(Schema.is(StmtSchema)(stmt)).toBe(true)
    })

    test("validates an expr statement", () => {
        const stmt = new ExprStmt({ expr: intLit(1n), span })
        expect(Schema.is(StmtSchema)(stmt)).toBe(true)
    })

    test("validates a return statement", () => {
        const stmt = new ReturnStmt({ value: Option.none(), span })
        expect(Schema.is(StmtSchema)(stmt)).toBe(true)
    })
})

describe("make() factories", () => {
    test("IntLiteral.make()", () => {
        const n = IntLiteral.make({ value: 1n, span })
        expect(n).toBeInstanceOf(IntLiteral)
    })

    test("FloatLiteral.make()", () => {
        const f = FloatLiteral.make({ value: 1.5, span })
        expect(f).toBeInstanceOf(FloatLiteral)
    })

    test("StringLiteral.make()", () => {
        const s = StringLiteral.make({ value: "hi", span })
        expect(s).toBeInstanceOf(StringLiteral)
    })

    test("BoolLiteral.make()", () => {
        const b = BoolLiteral.make({ value: true, span })
        expect(b).toBeInstanceOf(BoolLiteral)
    })

    test("NilLiteral.make()", () => {
        const n = NilLiteral.make({ span })
        expect(n).toBeInstanceOf(NilLiteral)
    })

    test("Identifier.make()", () => {
        const id = Identifier.make({ name: "x", span })
        expect(id).toBeInstanceOf(Identifier)
    })

    test("BinaryExpr.make()", () => {
        const expr = BinaryExpr.make({ op: "+", left: intLit(1n), right: intLit(2n), span })
        expect(expr).toBeInstanceOf(BinaryExpr)
    })

    test("UnaryExpr.make()", () => {
        const expr = UnaryExpr.make({ op: "-", operand: intLit(1n), span })
        expect(expr).toBeInstanceOf(UnaryExpr)
    })

    test("CallExpr.make()", () => {
        const expr = CallExpr.make({ callee: ident("f"), args: [], span })
        expect(expr).toBeInstanceOf(CallExpr)
    })

    test("IndexExpr.make()", () => {
        const expr = IndexExpr.make({ target: ident("a"), index: intLit(0n), span })
        expect(expr).toBeInstanceOf(IndexExpr)
    })

    test("FieldExpr.make()", () => {
        const expr = FieldExpr.make({ target: ident("a"), field: "b", span })
        expect(expr).toBeInstanceOf(FieldExpr)
    })

    test("AssignExpr.make()", () => {
        const expr = AssignExpr.make({ target: ident("x"), op: "=", value: intLit(1n), span })
        expect(expr).toBeInstanceOf(AssignExpr)
    })

    test("RangeExpr.make()", () => {
        const expr = RangeExpr.make({ from: intLit(0n), to: intLit(10n), inclusive: false, span })
        expect(expr).toBeInstanceOf(RangeExpr)
    })

    test("ArrayExpr.make()", () => {
        const expr = ArrayExpr.make({ elements: [], span })
        expect(expr).toBeInstanceOf(ArrayExpr)
    })

    test("BlockExpr.make()", () => {
        const expr = BlockExpr.make({ stmts: [], span })
        expect(expr).toBeInstanceOf(BlockExpr)
    })

    test("IfExpr.make()", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = IfExpr.make({ condition: boolLit(true), then: block, else_: Option.none(), span })
        expect(expr).toBeInstanceOf(IfExpr)
    })

    test("MatchArm.make()", () => {
        const arm = MatchArm.make({ pattern: intLit(0n), body: intLit(1n), span })
        expect(arm).toBeInstanceOf(MatchArm)
    })

    test("MatchExpr.make()", () => {
        const expr = MatchExpr.make({ scrutinee: ident("x"), arms: [], span })
        expect(expr).toBeInstanceOf(MatchExpr)
    })

    test("LetStmt.make()", () => {
        const stmt = LetStmt.make({ name: "x", mutable: false, value: Option.none(), span })
        expect(stmt).toBeInstanceOf(LetStmt)
    })

    test("ReturnStmt.make()", () => {
        const stmt = ReturnStmt.make({ value: Option.none(), span })
        expect(stmt).toBeInstanceOf(ReturnStmt)
    })

    test("ExprStmt.make()", () => {
        const stmt = ExprStmt.make({ expr: intLit(1n), span })
        expect(stmt).toBeInstanceOf(ExprStmt)
    })

    test("WhileExpr.make()", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = WhileExpr.make({ condition: boolLit(true), body: block, span })
        expect(expr).toBeInstanceOf(WhileExpr)
    })

    test("ForExpr.make()", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = ForExpr.make({ variable: "i", iterable: ident("items"), body: block, span })
        expect(expr).toBeInstanceOf(ForExpr)
    })

    test("BreakExpr.make()", () => {
        const expr = BreakExpr.make({ span })
        expect(expr).toBeInstanceOf(BreakExpr)
    })

    test("ContinueExpr.make()", () => {
        const expr = ContinueExpr.make({ span })
        expect(expr).toBeInstanceOf(ContinueExpr)
    })
})

describe("WhileExpr", () => {
    test("stores condition and body", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = new WhileExpr({ condition: boolLit(true), body: block, span })
        expect(expr._tag).toBe("WhileExpr")
        expect((expr.condition as BoolLiteral).value).toBe(true)
        expect(expr.body.stmts).toHaveLength(0)
    })
})

describe("ForExpr", () => {
    test("stores variable, iterable, and body", () => {
        const block = new BlockExpr({ stmts: [], span })
        const expr = new ForExpr({ variable: "i", iterable: ident("items"), body: block, span })
        expect(expr._tag).toBe("ForExpr")
        expect(expr.variable).toBe("i")
        expect((expr.iterable as Identifier).name).toBe("items")
    })
})

describe("BreakExpr", () => {
    test("has correct tag and span", () => {
        const expr = new BreakExpr({ span })
        expect(expr._tag).toBe("BreakExpr")
        expect(expr.span).toBe(span)
    })
})

describe("ContinueExpr", () => {
    test("has correct tag and span", () => {
        const expr = new ContinueExpr({ span })
        expect(expr._tag).toBe("ContinueExpr")
        expect(expr.span).toBe(span)
    })
})
