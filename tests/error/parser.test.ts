import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { ParseError } from "@/error/parser"
import { error } from "@/diagnostic/diagnostic"
import { Span } from "@/diagnostic/span"

describe("ParseError", () => {
    const source = "fn () {}"
    const span = new Span({ file: "test.luma", line: 0, column: 3, length: 1 })
    const diagnostic = error("expected identifier", span, {
        primaryMessage: "expected function name",
    })

    test("creates a ParseError with tag", () => {
        const err = new ParseError({ diagnostic, source })
        expect(err._tag).toBe("ParseError")
        expect(err.diagnostic).toBe(diagnostic)
        expect(err.source).toBe(source)
    })

    test("render() produces formatted output with location", () => {
        const err = new ParseError({ diagnostic, source })
        const output = err.render()
        expect(output).toContain("error: expected identifier")
        expect(output).toContain("--> test.luma:1:4")
        expect(output).toContain("fn () {}")
        expect(output).toContain("^ expected function name")
    })

    test("is an instance of Error", () => {
        const err = new ParseError({ diagnostic, source })
        expect(err).toBeInstanceOf(Error)
    })

    test("render() works with code and notes", () => {
        const diagWithCode = error("unexpected token", span, {
            code: "P001",
            notes: ["expected a declaration"],
        })
        const err = new ParseError({ diagnostic: diagWithCode, source })
        const output = err.render()
        expect(output).toContain("error[P001]: unexpected token")
        expect(output).toContain("= note: expected a declaration")
    })

    test("make() creates a ParseError", () => {
        const err = ParseError.make({ diagnostic, source })
        expect(err).toBeInstanceOf(ParseError)
        expect(err._tag).toBe("ParseError")
    })

    test("works in Effect error pipeline", () => {
        const err = new ParseError({ diagnostic, source })
        const result = Effect.runSync(
            Effect.fail(err).pipe(
                Effect.catchTag("ParseError", (e) => Effect.succeed(e.render())),
            ),
        )
        expect(result).toContain("error:")
    })

    test("Schema.decodeUnknownSync validates a ParseError", () => {
        const raw = { _tag: "ParseError" as const, diagnostic, source }
        const decoded = Schema.decodeUnknownSync(ParseError)(raw)
        expect(decoded).toBeInstanceOf(ParseError)
    })

    test("Schema.validateSync validates a ParseError", () => {
        const err = new ParseError({ diagnostic, source })
        const validated = Schema.validateSync(ParseError)(err)
        expect(validated).toBeInstanceOf(ParseError)
    })
})
