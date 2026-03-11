import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { LexError } from "@/error/lex"
import { error } from "@/diagnostic/diagnostic"
import { Span } from "@/diagnostic/span"

describe("LexError", () => {
    const source = "let x = @"
    const span = new Span({ file: "test.luma", line: 0, column: 8, length: 1 })
    const diagnostic = error("unexpected character '@'", span, {
        primaryMessage: "not recognized",
    })

    test("creates a LexError with tag", () => {
        const err = new LexError({ diagnostic, source })
        expect(err._tag).toBe("LexError")
        expect(err.diagnostic).toBe(diagnostic)
        expect(err.source).toBe(source)
    })

    test("render() produces formatted output", () => {
        const err = new LexError({ diagnostic, source })
        const output = err.render()

        expect(output).toContain("error: unexpected character '@'")
        expect(output).toContain("--> test.luma:1:9")
        expect(output).toContain("let x = @")
        expect(output).toContain("^ not recognized")
    })

    test("is an instance of Error", () => {
        const err = new LexError({ diagnostic, source })
        expect(err).toBeInstanceOf(Error)
    })

    test("make() creates a LexError", () => {
        const err = LexError.make({ diagnostic, source })
        expect(err).toBeInstanceOf(LexError)
        expect(err._tag).toBe("LexError")
    })

    test("works in Effect error pipeline", () => {
        const err = new LexError({ diagnostic, source })
        const result = Effect.runSync(
            Effect.fail(err).pipe(
                Effect.catchTag("LexError", (e) => Effect.succeed(e.render())),
            ),
        )
        expect(result).toContain("error:")
    })

    test("Schema.decodeUnknownSync validates a LexError", () => {
        const raw = { _tag: "LexError" as const, diagnostic, source }
        const decoded = Schema.decodeUnknownSync(LexError)(raw)
        expect(decoded).toBeInstanceOf(LexError)
    })

    test("Schema.validateSync validates a LexError", () => {
        const err = new LexError({ diagnostic, source })
        const validated = Schema.validateSync(LexError)(err)
        expect(validated).toBeInstanceOf(LexError)
    })
})
