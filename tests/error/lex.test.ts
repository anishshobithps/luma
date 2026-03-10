import { describe, expect, test } from "bun:test"
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
})
