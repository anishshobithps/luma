import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import {
    initial,
    peek,
    peekAt,
    advance,
    column,
    currentLineText,
    spanFrom,
    eofSpan,
} from "@/lexer/state"

describe("initial", () => {
    test("creates initial state at position 0", () => {
        const state = initial("hello", "test.luma")
        expect(state.source).toBe("hello")
        expect(state.file).toBe("test.luma")
        expect(state.pos).toBe(0)
        expect(state.line).toBe(0)
        expect(state.lineStart).toBe(0)
    })
})

describe("peek", () => {
    test("returns the current character", () => {
        const state = initial("abc", "test.luma")
        const ch = peek(state)
        expect(Option.getOrThrow(ch)).toBe("a")
    })

    test("returns None at end of input", () => {
        const state = initial("", "test.luma")
        expect(Option.isNone(peek(state))).toBe(true)
    })
})

describe("peekAt", () => {
    test("returns character at offset", () => {
        const state = initial("abc", "test.luma")
        expect(Option.getOrThrow(peekAt(state, 0))).toBe("a")
        expect(Option.getOrThrow(peekAt(state, 1))).toBe("b")
        expect(Option.getOrThrow(peekAt(state, 2))).toBe("c")
    })

    test("returns None for out-of-bounds offset", () => {
        const state = initial("ab", "test.luma")
        expect(Option.isNone(peekAt(state, 2))).toBe(true)
        expect(Option.isNone(peekAt(state, 10))).toBe(true)
    })
})

describe("advance", () => {
    test("returns current char and advances position", () => {
        const state = initial("abc", "test.luma")
        const [ch, next] = advance(state)
        expect(ch).toBe("a")
        expect(next.pos).toBe(1)
    })

    test("tracks line number on newline", () => {
        const state = initial("a\nb", "test.luma")
        const [, s1] = advance(state)    // 'a'
        const [, s2] = advance(s1)        // '\n'
        expect(s2.line).toBe(1)
        expect(s2.lineStart).toBe(2)
    })

    test("does not bump line for non-newline", () => {
        const state = initial("ab", "test.luma")
        const [, s1] = advance(state)
        expect(s1.line).toBe(0)
        expect(s1.lineStart).toBe(0)
    })

    test("handles multiple newlines", () => {
        const state = initial("a\nb\nc", "test.luma")
        const [, s1] = advance(state)     // 'a'
        const [, s2] = advance(s1)         // '\n'
        const [, s3] = advance(s2)         // 'b'
        const [, s4] = advance(s3)         // '\n'
        expect(s4.line).toBe(2)
        expect(s4.lineStart).toBe(4)
    })
})

describe("column", () => {
    test("returns 0 at start of line", () => {
        const state = initial("hello", "test.luma")
        expect(column(state)).toBe(0)
    })

    test("returns correct column after advances", () => {
        let state = initial("abcde", "test.luma")
            ;[, state] = advance(state)
            ;[, state] = advance(state)
        expect(column(state)).toBe(2)
    })

    test("resets after newline", () => {
        let state = initial("ab\ncd", "test.luma")
            ;[, state] = advance(state) // a
            ;[, state] = advance(state) // b
            ;[, state] = advance(state) // \n
        expect(column(state)).toBe(0)
            ;[, state] = advance(state) // c
        expect(column(state)).toBe(1)
    })
})

describe("currentLineText", () => {
    test("returns the full line on single-line input", () => {
        const state = initial("hello world", "test.luma")
        expect(currentLineText(state)).toBe("hello world")
    })

    test("returns current line in multi-line input", () => {
        let state = initial("line1\nline2\nline3", "test.luma")
        // advance past "line1\n"
        for (let i = 0; i < 6; i++) {
            ;[, state] = advance(state)
        }
        expect(currentLineText(state)).toBe("line2")
    })

    test("returns last line without trailing newline", () => {
        let state = initial("a\nb", "test.luma")
            ;[, state] = advance(state) // a
            ;[, state] = advance(state) // \n
        expect(currentLineText(state)).toBe("b")
    })
})

describe("spanFrom", () => {
    test("creates a span from start to current position", () => {
        let state = initial("hello", "test.luma")
        const startPos = state.pos
        const startLine = state.line
        const startLineStart = state.lineStart
            // advance 3 characters
            ;[, state] = advance(state)
            ;[, state] = advance(state)
            ;[, state] = advance(state)

        const span = spanFrom(state, startPos, startLine, startLineStart)
        expect(span.file).toBe("test.luma")
        expect(span.line).toBe(0)
        expect(span.column).toBe(0)
        expect(span.length).toBe(3)
    })

    test("calculates column offset correctly", () => {
        let state = initial("  abc", "test.luma")
            ;[, state] = advance(state) // ' '
            ;[, state] = advance(state) // ' '
        const startPos = state.pos
        const startLine = state.line
        const startLineStart = state.lineStart
            ;[, state] = advance(state) // 'a'
            ;[, state] = advance(state) // 'b'
            ;[, state] = advance(state) // 'c'

        const span = spanFrom(state, startPos, startLine, startLineStart)
        expect(span.column).toBe(2)
        expect(span.length).toBe(3)
    })

    test("ensures minimum length of 1", () => {
        const state = initial("x", "test.luma")
        const span = spanFrom(state, 0, 0, 0)
        expect(span.length).toBe(1)
    })
})

describe("eofSpan", () => {
    test("creates a span at current position with length 1", () => {
        let state = initial("ab", "test.luma")
            ;[, state] = advance(state)
            ;[, state] = advance(state)

        const span = eofSpan(state)
        expect(span.file).toBe("test.luma")
        expect(span.line).toBe(0)
        expect(span.column).toBe(2)
        expect(span.length).toBe(1)
    })

    test("works on empty input", () => {
        const state = initial("", "test.luma")
        const span = eofSpan(state)
        expect(span.line).toBe(0)
        expect(span.column).toBe(0)
        expect(span.length).toBe(1)
    })
})
