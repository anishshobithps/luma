import { describe, expect, test } from "bun:test"
import { Array, Either } from "effect"
import { lex } from "@/lexer/lexer"
import type { TokenKind } from "@/lexer/token"

const kinds = (source: string): ReadonlyArray<TokenKind> => {
    const result = lex(source, "test.luma")
    if (Either.isLeft(result)) throw new Error(result.left.render())
    return Array.map(result.right, (t) => t.kind)
}

const lexemes = (source: string): ReadonlyArray<string> => {
    const result = lex(source, "test.luma")
    if (Either.isLeft(result)) throw new Error(result.left.render())
    return Array.map(result.right, (t) => t.lexeme)
}

const fails = (source: string): boolean =>
    Either.isLeft(lex(source, "test.luma"))

describe("lex - basic tokens", () => {
    test("empty source produces only Eof", () => {
        expect(kinds("")).toEqual(["Eof"])
    })

    test("whitespace is skipped", () => {
        expect(kinds("   \t\n  ")).toEqual(["Eof"])
    })

    test("line comments are skipped", () => {
        expect(kinds("// this is a comment\n")).toEqual(["Eof"])
        expect(kinds("// comment")).toEqual(["Eof"])
    })

    test("comment does not consume next line tokens", () => {
        expect(kinds("// comment\nlet")).toEqual(["Let", "Eof"])
    })
})

describe("lex - punctuation", () => {
    test("single-char punctuation", () => {
        expect(kinds("( ) { } [ ] , . ; : ^ ~ ? @ #")).toEqual([
            "LeftParen", "RightParen",
            "LeftBrace", "RightBrace",
            "LeftBracket", "RightBracket",
            "Comma", "Dot", "Semicolon", "Colon",
            "Caret", "Tilde", "Question", "At", "Hash",
            "Eof",
        ])
    })

    test("multi-char operators", () => {
        expect(kinds(".. ..= :: -> => == != <= >= << >> += -= *= /= %= ** && ||")).toEqual([
            "DotDot", "DotDotEqual", "DoubleColon", "Arrow", "FatArrow",
            "EqualEqual", "BangEqual", "LessEqual", "GreaterEqual",
            "LessLess", "GreaterGreater",
            "PlusEqual", "MinusEqual", "StarEqual", "SlashEqual", "PercentEqual",
            "StarStar", "AmpersandAmpersand", "PipePipe",
            "Eof",
        ])
    })

    test("single operators not consumed by multi", () => {
        expect(kinds("+ - * / % = ! < > & |")).toEqual([
            "Plus", "Minus", "Star", "Slash", "Percent",
            "Equal", "Bang", "Less", "Greater",
            "Ampersand", "Pipe",
            "Eof",
        ])
    })
})

describe("lex - keywords", () => {
    test("all keywords are recognized", () => {
        const src = "let mut fn return if else while for in break continue true false nil and or not type struct enum match import export as"
        expect(kinds(src)).toEqual([
            "Let", "Mut", "Fn", "Return", "If", "Else", "While", "For", "In",
            "Break", "Continue", "True", "False", "Nil", "And", "Or", "Not",
            "Type", "Struct", "Enum", "Match", "Import", "Export", "As",
            "Eof",
        ])
    })
})

describe("lex - identifiers", () => {
    test("simple identifier", () => {
        expect(kinds("foo")).toEqual(["Identifier", "Eof"])
        expect(lexemes("foo")).toEqual(["foo", ""])
    })

    test("identifier with underscores and digits", () => {
        expect(kinds("my_var_2")).toEqual(["Identifier", "Eof"])
        expect(lexemes("my_var_2")).toEqual(["my_var_2", ""])
    })

    test("leading underscore identifier", () => {
        expect(kinds("_private")).toEqual(["Identifier", "Eof"])
    })

    test("keywords are not identifiers", () => {
        expect(kinds("let")).toEqual(["Let", "Eof"])
    })
})

describe("lex - integer literals", () => {
    test("decimal integer", () => {
        expect(kinds("42")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("42")).toEqual(["42", ""])
    })

    test("hex integer", () => {
        expect(kinds("0xFF")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0xFF")).toEqual(["0xFF", ""])
    })

    test("octal integer", () => {
        expect(kinds("0o77")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0o77")).toEqual(["0o77", ""])
    })

    test("binary integer", () => {
        expect(kinds("0b1010")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0b1010")).toEqual(["0b1010", ""])
    })

    test("zero is a valid decimal integer", () => {
        expect(kinds("0")).toEqual(["IntLiteral", "Eof"])
    })

    test("invalid hex prefix errors", () => {
        expect(fails("0x")).toBe(true)
    })

    test("invalid octal prefix errors", () => {
        expect(fails("0o")).toBe(true)
    })

    test("invalid binary prefix errors", () => {
        expect(fails("0b")).toBe(true)
    })
})

describe("lex - float literals", () => {
    test("basic float", () => {
        expect(kinds("3.14")).toEqual(["FloatLiteral", "Eof"])
        expect(lexemes("3.14")).toEqual(["3.14", ""])
    })

    test("float with leading zero", () => {
        expect(kinds("0.5")).toEqual(["FloatLiteral", "Eof"])
    })

    test("dot without digit after is not a float", () => {
        expect(kinds("3.")).toEqual(["IntLiteral", "Dot", "Eof"])
    })
})

describe("lex - string literals", () => {
    test("simple string", () => {
        expect(kinds('"hello"')).toEqual(["StringLiteral", "Eof"])
        expect(lexemes('"hello"')).toEqual(["hello", ""])
    })

    test("string with escape sequences", () => {
        expect(lexemes('"hello\\nworld"')).toEqual(["hello\nworld", ""])
        expect(lexemes('"tab\\there"')).toEqual(["tab\there", ""])
    })

    test("empty string", () => {
        expect(kinds('""')).toEqual(["StringLiteral", "Eof"])
        expect(lexemes('""')).toEqual(["", ""])
    })

    test("unterminated string errors", () => {
        expect(fails('"hello')).toBe(true)
    })

    test("invalid escape sequence errors", () => {
        expect(fails('"\\q"')).toBe(true)
    })
})

describe("lex - spans", () => {
    test("token span tracks line and column", () => {
        const result = lex("let x", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [letTok, xTok] = result.right
        expect(letTok!.span.line).toBe(0)
        expect(letTok!.span.column).toBe(0)
        expect(letTok!.span.length).toBe(3)
        expect(xTok!.span.column).toBe(4)
    })

    test("token span after newline", () => {
        const result = lex("let\nx", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [, xTok] = result.right
        expect(xTok!.span.line).toBe(1)
        expect(xTok!.span.column).toBe(0)
    })
})

describe("lex - real code", () => {
    test("variable declaration", () => {
        expect(kinds("let x = 42;")).toEqual(["Let", "Identifier", "Equal", "IntLiteral", "Semicolon", "Eof"])
    })

    test("function definition header", () => {
        expect(kinds("fn add(a, b)")).toEqual(["Fn", "Identifier", "LeftParen", "Identifier", "Comma", "Identifier", "RightParen", "Eof"])
    })

    test("unexpected character errors", () => {
        expect(fails("let x = $")).toBe(true)
    })
})
