import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { initial, peek, advance, check, eat, currentSpan } from "@/parser/state"
import { Token, type TokenKind } from "@/lexer/token"
import { Span } from "@/diagnostic/span"

const mkSpan = (col: number, len: number) =>
    new Span({ file: "test.luma", line: 0, column: col, length: len })

const mkTok = (kind: TokenKind, lexeme: string, col: number, len: number): Token =>
    new Token({ kind, lexeme, span: mkSpan(col, len) })

const letTok = mkTok("Let", "let", 0, 3)
const identTok = mkTok("Identifier", "x", 4, 1)
const eofTok = mkTok("Eof", "", 5, 1)
const tokens = [letTok, identTok, eofTok]

describe("initial", () => {
    test("starts at position 0 with correct source and file", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(state.pos).toBe(0)
        expect(state.source).toBe("let x")
        expect(state.file).toBe("test.luma")
    })
})

describe("peek", () => {
    test("returns token at current position without advancing", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(peek(state).kind).toBe("Let")
        expect(peek(state).kind).toBe("Let")
        expect(state.pos).toBe(0)
    })

    test("returns Eof token when past end of tokens", () => {
        const state = initial(tokens, "let x", "test.luma")
        const [, s1] = advance(state)
        const [, s2] = advance(s1)
        const [, s3] = advance(s2)
        expect(peek(s3).kind).toBe("Eof")
    })

    test("returns synthetic Eof for empty token list", () => {
        const state = initial([], "", "test.luma")
        expect(peek(state).kind).toBe("Eof")
    })
})

describe("advance", () => {
    test("returns current token and increments position", () => {
        const state = initial(tokens, "let x", "test.luma")
        const [t, s1] = advance(state)
        expect(t.kind).toBe("Let")
        expect(s1.pos).toBe(1)
    })

    test("sequential advances walk through all tokens", () => {
        const state = initial(tokens, "let x", "test.luma")
        const [t0, s1] = advance(state)
        const [t1, s2] = advance(s1)
        const [t2] = advance(s2)
        expect(t0.kind).toBe("Let")
        expect(t1.kind).toBe("Identifier")
        expect(t2.kind).toBe("Eof")
    })

    test("does not mutate original state", () => {
        const state = initial(tokens, "let x", "test.luma")
        advance(state)
        expect(state.pos).toBe(0)
    })
})

describe("check", () => {
    test("returns true when current token matches single kind", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(check(state, "Let")).toBe(true)
    })

    test("returns true when current token matches any of multiple kinds", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(check(state, "Fn", "Let", "Identifier")).toBe(true)
    })

    test("returns false when no kinds match", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(check(state, "Fn", "Return")).toBe(false)
    })

    test("works correctly after advancing", () => {
        const state = initial(tokens, "let x", "test.luma")
        const [, s1] = advance(state)
        expect(check(s1, "Identifier")).toBe(true)
        expect(check(s1, "Let")).toBe(false)
    })
})

describe("eat", () => {
    test("returns Some with token and advanced state when kind matches", () => {
        const state = initial(tokens, "let x", "test.luma")
        const result = eat(state, "Let")
        expect(Option.isSome(result)).toBe(true)
        const [t, s1] = Option.getOrThrow(result)
        expect(t.kind).toBe("Let")
        expect(s1.pos).toBe(1)
    })

    test("returns None when kind does not match", () => {
        const state = initial(tokens, "let x", "test.luma")
        expect(Option.isNone(eat(state, "Fn"))).toBe(true)
    })

    test("does not advance original state on None", () => {
        const state = initial(tokens, "let x", "test.luma")
        eat(state, "Fn")
        expect(state.pos).toBe(0)
    })

    test("can eat multiple tokens in sequence", () => {
        const state = initial(tokens, "let x", "test.luma")
        const r1 = eat(state, "Let")
        expect(Option.isSome(r1)).toBe(true)
        const [, s1] = Option.getOrThrow(r1)
        const r2 = eat(s1, "Identifier")
        expect(Option.isSome(r2)).toBe(true)
        const [t2] = Option.getOrThrow(r2)
        expect(t2.lexeme).toBe("x")
    })
})

describe("currentSpan", () => {
    test("returns span of current token", () => {
        const state = initial(tokens, "let x", "test.luma")
        const s = currentSpan(state)
        expect(s.column).toBe(0)
        expect(s.length).toBe(3)
    })

    test("returns updated span after advancing", () => {
        const state = initial(tokens, "let x", "test.luma")
        const [, s1] = advance(state)
        const s = currentSpan(s1)
        expect(s.column).toBe(4)
        expect(s.length).toBe(1)
    })
})
