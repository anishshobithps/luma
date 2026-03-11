import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { Token, TokenKind, type TokenKind as TokenKindType } from "@/lexer/token"
import { Span } from "@/diagnostic/span"

describe("Token", () => {
    const span = new Span({ file: "test.luma", line: 0, column: 0, length: 3 })

    test("creates a token with kind, lexeme, and span", () => {
        const tok = new Token({ kind: "Let", lexeme: "let", span })
        expect(tok.kind).toBe("Let")
        expect(tok.lexeme).toBe("let")
        expect(tok.span).toBe(span)
    })

    test("creates tokens for all punctuation kinds", () => {
        const punctuation: [TokenKind, string][] = [
            ["LeftParen", "("],
            ["RightParen", ")"],
            ["LeftBrace", "{"],
            ["RightBrace", "}"],
            ["LeftBracket", "["],
            ["RightBracket", "]"],
            ["Comma", ","],
            ["Dot", "."],
            ["Semicolon", ";"],
            ["Colon", ":"],
        ]

        for (const [kind, lexeme] of punctuation) {
            const s = new Span({ file: "test.luma", line: 0, column: 0, length: lexeme.length })
            const tok = new Token({ kind, lexeme, span: s })
            expect(tok.kind).toBe(kind)
            expect(tok.lexeme).toBe(lexeme)
        }
    })

    test("creates tokens for operator kinds", () => {
        const operators: [TokenKind, string][] = [
            ["Plus", "+"],
            ["Minus", "-"],
            ["Star", "*"],
            ["Slash", "/"],
            ["Percent", "%"],
            ["EqualEqual", "=="],
            ["BangEqual", "!="],
            ["Less", "<"],
            ["Greater", ">"],
            ["LessEqual", "<="],
            ["GreaterEqual", ">="],
        ]

        for (const [kind, lexeme] of operators) {
            const s = new Span({ file: "test.luma", line: 0, column: 0, length: lexeme.length })
            const tok = new Token({ kind, lexeme, span: s })
            expect(tok.kind).toBe(kind)
        }
    })

    test("creates keyword tokens", () => {
        const keywords: [TokenKind, string][] = [
            ["Let", "let"],
            ["Fn", "fn"],
            ["If", "if"],
            ["Return", "return"],
            ["While", "while"],
            ["Struct", "struct"],
        ]

        for (const [kind, lexeme] of keywords) {
            const s = new Span({ file: "test.luma", line: 0, column: 0, length: lexeme.length })
            const tok = new Token({ kind, lexeme, span: s })
            expect(tok.kind).toBe(kind)
            expect(tok.lexeme).toBe(lexeme)
        }
    })

    test("creates literal tokens", () => {
        const intSpan = new Span({ file: "test.luma", line: 0, column: 0, length: 2 })
        const intTok = new Token({ kind: "IntLiteral", lexeme: "42", span: intSpan })
        expect(intTok.kind).toBe("IntLiteral")

        const floatSpan = new Span({ file: "test.luma", line: 0, column: 0, length: 4 })
        const floatTok = new Token({ kind: "FloatLiteral", lexeme: "3.14", span: floatSpan })
        expect(floatTok.kind).toBe("FloatLiteral")

        const strSpan = new Span({ file: "test.luma", line: 0, column: 0, length: 7 })
        const strTok = new Token({ kind: "StringLiteral", lexeme: '"hello"', span: strSpan })
        expect(strTok.kind).toBe("StringLiteral")
    })

    test("creates Eof token", () => {
        const eofSpan = new Span({ file: "test.luma", line: 0, column: 0, length: 1 })
        const tok = new Token({ kind: "Eof", lexeme: "", span: eofSpan })
        expect(tok.kind).toBe("Eof")
        expect(tok.lexeme).toBe("")
    })

    test("creates Identifier token", () => {
        const idSpan = new Span({ file: "test.luma", line: 0, column: 0, length: 5 })
        const tok = new Token({ kind: "Identifier", lexeme: "myVar", span: idSpan })
        expect(tok.kind).toBe("Identifier")
        expect(tok.lexeme).toBe("myVar")
    })

    test("make() creates a token", () => {
        const tok = Token.make({ kind: "Let", lexeme: "let", span })
        expect(tok).toBeInstanceOf(Token)
        expect(tok.kind).toBe("Let")
    })

    test("TokenKind schema validates known kinds", () => {
        expect(Schema.is(TokenKind)("Let")).toBe(true)
        expect(Schema.is(TokenKind)("Eof")).toBe(true)
        expect(Schema.is(TokenKind)("NotAKind")).toBe(false)
    })

    test("encodeSync round-trips a token", () => {
        const tok = new Token({ kind: "Plus", lexeme: "+", span })
        const encoded = Schema.encodeSync(Token)(tok)
        expect(encoded.kind).toBe("Plus")
        expect(encoded.lexeme).toBe("+")
    })
})
