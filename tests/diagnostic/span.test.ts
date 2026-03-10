import { describe, expect, test } from "bun:test"
import { Span } from "@/diagnostic/span"

describe("Span", () => {
    test("creates a valid span", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 5, length: 3 })
        expect(span.file).toBe("test.luma")
        expect(span.line).toBe(0)
        expect(span.column).toBe(5)
        expect(span.length).toBe(3)
    })

    test("accepts zero for line and column", () => {
        const span = new Span({ file: "f.luma", line: 0, column: 0, length: 1 })
        expect(span.line).toBe(0)
        expect(span.column).toBe(0)
    })

    test("rejects negative line", () => {
        expect(() => new Span({ file: "f.luma", line: -1, column: 0, length: 1 })).toThrow()
    })

    test("rejects negative column", () => {
        expect(() => new Span({ file: "f.luma", line: 0, column: -1, length: 1 })).toThrow()
    })

    test("rejects zero length", () => {
        expect(() => new Span({ file: "f.luma", line: 0, column: 0, length: 0 })).toThrow()
    })

    test("rejects negative length", () => {
        expect(() => new Span({ file: "f.luma", line: 0, column: 0, length: -1 })).toThrow()
    })

    test("rejects non-integer line", () => {
        expect(() => new Span({ file: "f.luma", line: 1.5, column: 0, length: 1 })).toThrow()
    })

    test("rejects non-integer column", () => {
        expect(() => new Span({ file: "f.luma", line: 0, column: 0.5, length: 1 })).toThrow()
    })

    test("rejects non-integer length", () => {
        expect(() => new Span({ file: "f.luma", line: 0, column: 0, length: 1.5 })).toThrow()
    })
})
