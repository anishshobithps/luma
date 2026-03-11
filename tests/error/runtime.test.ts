import { describe, expect, test } from "bun:test"
import { Effect, Option, Schema } from "effect"
import { RuntimeError, RuntimeErrorKind, InternalError } from "@/error/runtime"
import { error } from "@/diagnostic/diagnostic"
import { Span } from "@/diagnostic/span"

describe("RuntimeError", () => {
    const source = "let x = 1 / 0"
    const span = new Span({ file: "test.luma", line: 0, column: 10, length: 1 })
    const diagnostic = error("division by zero", span)

    test("creates a RuntimeError with tag", () => {
        const err = new RuntimeError({
            kind: "DivisionByZero",
            diagnostic,
            source,
            callStack: [],
        })
        expect(err._tag).toBe("RuntimeError")
        expect(err.kind).toBe("DivisionByZero")
    })

    test("render() without call stack", () => {
        const err = new RuntimeError({
            kind: "DivisionByZero",
            diagnostic,
            source,
            callStack: [],
        })
        const output = err.render()
        expect(output).toContain("error: division by zero")
        expect(output).not.toContain("stack backtrace")
    })

    test("render() with call stack", () => {
        const frame1 = new Span({ file: "test.luma", line: 5, column: 2, length: 1 })
        const frame2 = new Span({ file: "test.luma", line: 10, column: 0, length: 1 })
        const err = new RuntimeError({
            kind: "StackOverflow",
            diagnostic,
            source,
            callStack: [frame1, frame2],
        })
        const output = err.render()
        expect(output).toContain("stack backtrace:")
        expect(output).toContain("0: test.luma:6:3")
        expect(output).toContain("1: test.luma:11:1")
    })

    test("accepts all error kinds", () => {
        const kinds = [
            "DivisionByZero",
            "StackOverflow",
            "OutOfBounds",
            "NilDereference",
            "TypeMismatch",
            "AssertionFailed",
            "UserPanic",
        ] as const

        for (const kind of kinds) {
            const err = new RuntimeError({ kind, diagnostic, source, callStack: [] })
            expect(err.kind).toBe(kind)
        }
    })

    test("is an instance of Error", () => {
        const err = new RuntimeError({
            kind: "DivisionByZero",
            diagnostic,
            source,
            callStack: [],
        })
        expect(err).toBeInstanceOf(Error)
    })
})

describe("InternalError", () => {
    test("creates an InternalError with tag", () => {
        const err = new InternalError({
            message: "unexpected state",
            phase: "type-check",
            cause: Option.none(),
        })
        expect(err._tag).toBe("InternalError")
        expect(err.message).toBe("unexpected state")
        expect(err.phase).toBe("type-check")
    })

    test("render() without cause", () => {
        const err = new InternalError({
            message: "broken",
            phase: "parser",
            cause: Option.none(),
        })
        const output = err.render()
        expect(output).toContain("internal compiler error in parser: broken")
        expect(output).toContain("This is a bug in luma")
        expect(output).not.toContain("caused by")
    })

    test("render() with cause", () => {
        const err = new InternalError({
            message: "broken",
            phase: "codegen",
            cause: Option.some("null pointer"),
        })
        const output = err.render()
        expect(output).toContain("internal compiler error in codegen: broken")
        expect(output).toContain("caused by: null pointer")
    })

    test("is an instance of Error", () => {
        const err = new InternalError({
            message: "oops",
            phase: "lexer",
            cause: Option.none(),
        })
        expect(err).toBeInstanceOf(Error)
    })
})

describe("RuntimeErrorKind", () => {
    test("validates known kinds", () => {
        expect(Schema.is(RuntimeErrorKind)("DivisionByZero")).toBe(true)
        expect(Schema.is(RuntimeErrorKind)("StackOverflow")).toBe(true)
        expect(Schema.is(RuntimeErrorKind)("NotAKind")).toBe(false)
    })
})

describe("error make() factories", () => {
    const source = "let x = 1 / 0"
    const span = new Span({ file: "test.luma", line: 0, column: 10, length: 1 })
    const diagnostic = error("division by zero", span)

    test("RuntimeError.make() creates a RuntimeError", () => {
        const err = RuntimeError.make({ kind: "DivisionByZero", diagnostic, source, callStack: [] })
        expect(err).toBeInstanceOf(RuntimeError)
        expect(err._tag).toBe("RuntimeError")
    })

    test("InternalError.make() creates an InternalError", () => {
        const err = InternalError.make({ message: "broken", phase: "parser", cause: Option.none() })
        expect(err).toBeInstanceOf(InternalError)
        expect(err._tag).toBe("InternalError")
    })

    test("RuntimeError works in Effect error pipeline", () => {
        const err = new RuntimeError({ kind: "DivisionByZero", diagnostic, source, callStack: [] })
        const result = Effect.runSync(
            Effect.fail(err).pipe(
                Effect.catchTag("RuntimeError", (e) => Effect.succeed(e.kind)),
            ),
        )
        expect(result).toBe("DivisionByZero")
    })

    test("InternalError works in Effect error pipeline", () => {
        const err = new InternalError({ message: "broken", phase: "parser", cause: Option.none() })
        const result = Effect.runSync(
            Effect.fail(err).pipe(
                Effect.catchTag("InternalError", (e) => Effect.succeed(e.phase)),
            ),
        )
        expect(result).toBe("parser")
    })

    test("Schema.validateSync validates a RuntimeError", () => {
        const err = new RuntimeError({ kind: "DivisionByZero", diagnostic, source, callStack: [] })
        const validated = Schema.validateSync(RuntimeError)(err)
        expect(validated).toBeInstanceOf(RuntimeError)
    })

    test("Schema.validateSync validates an InternalError", () => {
        const err = new InternalError({ message: "broken", phase: "parser", cause: Option.none() })
        const validated = Schema.validateSync(InternalError)(err)
        expect(validated).toBeInstanceOf(InternalError)
    })
})
