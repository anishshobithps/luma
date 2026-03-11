import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import {
    Param, FnDecl, StructField, StructDecl, EnumVariant, EnumDecl,
    TypeDecl, ImportDecl, Program, DeclSchema, TopLevelSchema,
} from "@/ast/decl"
import { BlockExpr, ExprStmt, IntLiteral, LetStmt } from "@/ast/expr"
import { Span } from "@/diagnostic/span"

const span = new Span({ file: "test.luma", line: 0, column: 0, length: 1 })
const emptyBlock = new BlockExpr({ stmts: [], span })

describe("Param", () => {
    test("stores name, tag, and span", () => {
        const p = new Param({ name: "x", span })
        expect(p._tag).toBe("Param")
        expect(p.name).toBe("x")
        expect(p.span).toBe(span)
    })

    test("handles underscore param name", () => {
        expect(new Param({ name: "_unused", span }).name).toBe("_unused")
    })
})

describe("FnDecl", () => {
    test("non-exported function with params", () => {
        const params = [new Param({ name: "a", span }), new Param({ name: "b", span })]
        const fn_ = new FnDecl({ name: "add", params, body: emptyBlock, exported: false, span })
        expect(fn_._tag).toBe("FnDecl")
        expect(fn_.name).toBe("add")
        expect(fn_.params).toHaveLength(2)
        expect(fn_.params[0]!.name).toBe("a")
        expect(fn_.params[1]!.name).toBe("b")
        expect(fn_.exported).toBe(false)
    })

    test("exported function with no params", () => {
        const fn_ = new FnDecl({ name: "greet", params: [], body: emptyBlock, exported: true, span })
        expect(fn_.exported).toBe(true)
        expect(fn_.params).toHaveLength(0)
    })

    test("body is stored as BlockExpr", () => {
        const fn_ = new FnDecl({ name: "f", params: [], body: emptyBlock, exported: false, span })
        expect(fn_.body._tag).toBe("BlockExpr")
    })

    test("body can contain statements", () => {
        const stmt = new LetStmt({ name: "x", mutable: false, value: Option.none(), span })
        const block = new BlockExpr({ stmts: [stmt], span })
        const fn_ = new FnDecl({ name: "f", params: [], body: block, exported: false, span })
        expect(fn_.body.stmts).toHaveLength(1)
    })
})

describe("StructField", () => {
    test("stores name, tag, and span", () => {
        const f = new StructField({ name: "x", span })
        expect(f._tag).toBe("StructField")
        expect(f.name).toBe("x")
        expect(f.span).toBe(span)
    })
})

describe("StructDecl", () => {
    test("stores name and fields", () => {
        const fields = [new StructField({ name: "x", span }), new StructField({ name: "y", span })]
        const s = new StructDecl({ name: "Point", fields, span })
        expect(s._tag).toBe("StructDecl")
        expect(s.name).toBe("Point")
        expect(s.fields).toHaveLength(2)
        expect(s.fields[0]!.name).toBe("x")
        expect(s.fields[1]!.name).toBe("y")
    })

    test("empty struct", () => {
        const s = new StructDecl({ name: "Unit", fields: [], span })
        expect(s.fields).toHaveLength(0)
    })
})

describe("EnumVariant", () => {
    test("stores name, tag, and span", () => {
        const v = new EnumVariant({ name: "North", span })
        expect(v._tag).toBe("EnumVariant")
        expect(v.name).toBe("North")
        expect(v.span).toBe(span)
    })
})

describe("EnumDecl", () => {
    test("stores name and variants", () => {
        const variants = [
            new EnumVariant({ name: "North", span }),
            new EnumVariant({ name: "South", span }),
            new EnumVariant({ name: "East", span }),
            new EnumVariant({ name: "West", span }),
        ]
        const e = new EnumDecl({ name: "Direction", variants, span })
        expect(e._tag).toBe("EnumDecl")
        expect(e.name).toBe("Direction")
        expect(e.variants).toHaveLength(4)
        expect(e.variants[0]!.name).toBe("North")
    })

    test("empty enum", () => {
        expect(new EnumDecl({ name: "Empty", variants: [], span }).variants).toHaveLength(0)
    })
})

describe("TypeDecl", () => {
    test("stores name and alias", () => {
        const t = new TypeDecl({ name: "Point", alias: "Vec2", span })
        expect(t._tag).toBe("TypeDecl")
        expect(t.name).toBe("Point")
        expect(t.alias).toBe("Vec2")
    })
})

describe("ImportDecl", () => {
    test("without alias", () => {
        const i = new ImportDecl({ path: "math", alias: Option.none(), span })
        expect(i._tag).toBe("ImportDecl")
        expect(i.path).toBe("math")
        expect(Option.isNone(i.alias)).toBe(true)
    })

    test("with alias", () => {
        const i = new ImportDecl({ path: "math", alias: Option.some("m"), span })
        expect(Option.isSome(i.alias)).toBe(true)
        expect(Option.getOrThrow(i.alias)).toBe("m")
    })
})

describe("Program", () => {
    test("stores decls and span", () => {
        const fn_ = new FnDecl({ name: "main", params: [], body: emptyBlock, exported: false, span })
        const prog = new Program({ decls: [fn_], span })
        expect(prog.decls).toHaveLength(1)
        expect(prog.span).toBe(span)
    })

    test("empty program", () => {
        expect(new Program({ decls: [], span }).decls).toHaveLength(0)
    })

    test("program can hold mixed top-level items", () => {
        const fn_ = new FnDecl({ name: "f", params: [], body: emptyBlock, exported: false, span })
        const struct_ = new StructDecl({ name: "S", fields: [], span })
        const prog = new Program({ decls: [fn_, struct_], span })
        expect(prog.decls).toHaveLength(2)
    })

    test("program can hold expression statements", () => {
        const stmt = new ExprStmt({ expr: new IntLiteral({ value: 1n, span }), span })
        const prog = new Program({ decls: [stmt], span })
        expect(prog.decls).toHaveLength(1)
        expect((prog.decls[0] as ExprStmt)._tag).toBe("ExprStmt")
        expect(((prog.decls[0] as ExprStmt).expr as IntLiteral).value).toBe(1n)
    })
})

describe("DeclSchema", () => {
    test("validates function declaration", () => {
        const fn_ = new FnDecl({ name: "f", params: [], body: emptyBlock, exported: false, span })
        expect(Schema.is(DeclSchema)(fn_)).toBe(true)
    })

    test("validates struct declaration", () => {
        const s = new StructDecl({ name: "S", fields: [], span })
        expect(Schema.is(DeclSchema)(s)).toBe(true)
    })

    test("validates enum declaration", () => {
        const e = new EnumDecl({ name: "E", variants: [], span })
        expect(Schema.is(DeclSchema)(e)).toBe(true)
    })

    test("validates type declaration", () => {
        const t = new TypeDecl({ name: "T", alias: "U", span })
        expect(Schema.is(DeclSchema)(t)).toBe(true)
    })

    test("validates import declaration", () => {
        const i = new ImportDecl({ path: "math", alias: Option.none(), span })
        expect(Schema.is(DeclSchema)(i)).toBe(true)
    })

    test("rejects non-declaration values", () => {
        expect(Schema.is(DeclSchema)({ random: true })).toBe(false)
    })
})

describe("TopLevelSchema", () => {
    test("validates declarations", () => {
        const fn_ = new FnDecl({ name: "f", params: [], body: emptyBlock, exported: false, span })
        expect(Schema.is(TopLevelSchema)(fn_)).toBe(true)
    })

    test("validates statements", () => {
        const stmt = new LetStmt({ name: "x", mutable: false, value: Option.none(), span })
        expect(Schema.is(TopLevelSchema)(stmt)).toBe(true)
    })

    test("validates expression statements", () => {
        const stmt = new ExprStmt({ expr: new IntLiteral({ value: 42n, span }), span })
        expect(Schema.is(TopLevelSchema)(stmt)).toBe(true)
    })
})

describe("make() factories", () => {
    test("Param.make() creates a param", () => {
        const p = Param.make({ name: "x", span })
        expect(p).toBeInstanceOf(Param)
        expect(p._tag).toBe("Param")
    })

    test("FnDecl.make() creates a function declaration", () => {
        const fn_ = FnDecl.make({ name: "f", params: [], body: emptyBlock, exported: false, span })
        expect(fn_).toBeInstanceOf(FnDecl)
    })

    test("StructField.make() creates a field", () => {
        const f = StructField.make({ name: "x", span })
        expect(f).toBeInstanceOf(StructField)
    })

    test("StructDecl.make() creates a struct", () => {
        const s = StructDecl.make({ name: "S", fields: [], span })
        expect(s).toBeInstanceOf(StructDecl)
    })

    test("EnumVariant.make() creates a variant", () => {
        const v = EnumVariant.make({ name: "A", span })
        expect(v).toBeInstanceOf(EnumVariant)
    })

    test("EnumDecl.make() creates an enum", () => {
        const e = EnumDecl.make({ name: "E", variants: [], span })
        expect(e).toBeInstanceOf(EnumDecl)
    })

    test("TypeDecl.make() creates a type", () => {
        const t = TypeDecl.make({ name: "T", alias: "U", span })
        expect(t).toBeInstanceOf(TypeDecl)
    })

    test("ImportDecl.make() creates an import", () => {
        const i = ImportDecl.make({ path: "math", alias: Option.none(), span })
        expect(i).toBeInstanceOf(ImportDecl)
    })

    test("Program.make() creates a program", () => {
        const p = Program.make({ decls: [], span })
        expect(p).toBeInstanceOf(Program)
    })
})
