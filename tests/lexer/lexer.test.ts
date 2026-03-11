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

    test("comment after code on same line is skipped", () => {
        expect(kinds("let x // declare x")).toEqual(["Let", "Identifier", "Eof"])
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

    test("tilde alone", () => {
        expect(kinds("~")).toEqual(["Tilde", "Eof"])
    })

    test("question mark alone", () => {
        expect(kinds("?")).toEqual(["Question", "Eof"])
    })

    test("at sign alone", () => {
        expect(kinds("@")).toEqual(["At", "Eof"])
    })

    test("hash alone", () => {
        expect(kinds("#")).toEqual(["Hash", "Eof"])
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

    test("arrow vs minus", () => {
        expect(kinds("->")).toEqual(["Arrow", "Eof"])
        expect(kinds("-")).toEqual(["Minus", "Eof"])
        expect(kinds("-=")).toEqual(["MinusEqual", "Eof"])
    })

    test("fat arrow vs equal", () => {
        expect(kinds("=>")).toEqual(["FatArrow", "Eof"])
        expect(kinds("==")).toEqual(["EqualEqual", "Eof"])
        expect(kinds("=")).toEqual(["Equal", "Eof"])
    })

    test("double colon vs colon", () => {
        expect(kinds("::")).toEqual(["DoubleColon", "Eof"])
        expect(kinds(":")).toEqual(["Colon", "Eof"])
    })

    test("starstar vs star", () => {
        expect(kinds("**")).toEqual(["StarStar", "Eof"])
        expect(kinds("*")).toEqual(["Star", "Eof"])
        expect(kinds("*=")).toEqual(["StarEqual", "Eof"])
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

    test("control flow keywords individually", () => {
        expect(kinds("while")).toEqual(["While", "Eof"])
        expect(kinds("for")).toEqual(["For", "Eof"])
        expect(kinds("in")).toEqual(["In", "Eof"])
        expect(kinds("break")).toEqual(["Break", "Eof"])
        expect(kinds("continue")).toEqual(["Continue", "Eof"])
    })

    test("boolean and nil keywords", () => {
        expect(kinds("true")).toEqual(["True", "Eof"])
        expect(kinds("false")).toEqual(["False", "Eof"])
        expect(kinds("nil")).toEqual(["Nil", "Eof"])
    })

    test("logical keywords", () => {
        expect(kinds("and")).toEqual(["And", "Eof"])
        expect(kinds("or")).toEqual(["Or", "Eof"])
        expect(kinds("not")).toEqual(["Not", "Eof"])
    })

    test("type declaration keywords", () => {
        expect(kinds("type")).toEqual(["Type", "Eof"])
        expect(kinds("struct")).toEqual(["Struct", "Eof"])
        expect(kinds("enum")).toEqual(["Enum", "Eof"])
        expect(kinds("match")).toEqual(["Match", "Eof"])
    })

    test("import export as", () => {
        expect(kinds("import")).toEqual(["Import", "Eof"])
        expect(kinds("export")).toEqual(["Export", "Eof"])
        expect(kinds("as")).toEqual(["As", "Eof"])
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

    test("all uppercase identifier", () => {
        expect(kinds("MY_CONST")).toEqual(["Identifier", "Eof"])
    })

    test("keywords are not identifiers", () => {
        expect(kinds("let")).toEqual(["Let", "Eof"])
    })

    test("keyword prefix is not a keyword", () => {
        expect(kinds("letter")).toEqual(["Identifier", "Eof"])
        expect(kinds("fni")).toEqual(["Identifier", "Eof"])
        expect(kinds("returning")).toEqual(["Identifier", "Eof"])
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

    test("hex uppercase prefix", () => {
        expect(kinds("0XFF")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0XFF")).toEqual(["0XFF", ""])
    })

    test("octal integer", () => {
        expect(kinds("0o77")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0o77")).toEqual(["0o77", ""])
    })

    test("octal uppercase prefix", () => {
        expect(kinds("0O77")).toEqual(["IntLiteral", "Eof"])
    })

    test("binary integer", () => {
        expect(kinds("0b1010")).toEqual(["IntLiteral", "Eof"])
        expect(lexemes("0b1010")).toEqual(["0b1010", ""])
    })

    test("binary uppercase prefix", () => {
        expect(kinds("0B1010")).toEqual(["IntLiteral", "Eof"])
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

    test("two dots after int is range not float", () => {
        expect(kinds("3..10")).toEqual(["IntLiteral", "DotDot", "IntLiteral", "Eof"])
    })
})

describe("lex - string literals", () => {
    test("simple string", () => {
        expect(kinds('"hello"')).toEqual(["StringLiteral", "Eof"])
        expect(lexemes('"hello"')).toEqual(["hello", ""])
    })

    test("string with newline escape", () => {
        expect(lexemes('"hello\\nworld"')).toEqual(["hello\nworld", ""])
    })

    test("string with tab escape", () => {
        expect(lexemes('"tab\\there"')).toEqual(["tab\there", ""])
    })

    test("string with carriage return escape", () => {
        expect(lexemes('"cr\\r"')).toEqual(["cr\r", ""])
    })

    test("string with backslash escape", () => {
        expect(lexemes('"back\\\\"')).toEqual(["back\\", ""])
    })

    test("string with quote escape", () => {
        expect(lexemes('"say\\"hi\\""')).toEqual(['say"hi"', ""])
    })

    test("string with null escape", () => {
        expect(lexemes('"null\\0char"')).toEqual(["null\0char", ""])
    })

    test("empty string", () => {
        expect(kinds('""')).toEqual(["StringLiteral", "Eof"])
        expect(lexemes('""')).toEqual(["", ""])
    })

    test("unterminated string errors", () => {
        expect(fails('"hello')).toBe(true)
    })

    test("unterminated escape sequence errors", () => {
        expect(fails('"hello\\')).toBe(true)
    })

    test("invalid escape sequence errors", () => {
        expect(fails('"\\q"')).toBe(true)
    })

    test("interpolated string with only text emits StringLiteral", () => {
        expect(kinds('"hello"')).toEqual(["StringLiteral", "Eof"])
    })

    test("interpolated string emits InterpStart Identifier InterpEnd", () => {
        expect(kinds('"Hello, {name}!"')).toEqual(["InterpStart", "Identifier", "InterpEnd", "Eof"])
    })

    test("InterpStart lexeme is the prefix text", () => {
        expect(lexemes('"Hello, {name}!"')).toEqual(["Hello, ", "name", "!", ""])
    })

    test("interpolation with no prefix text", () => {
        expect(kinds('"{x}"')).toEqual(["InterpStart", "Identifier", "InterpEnd", "Eof"])
    })

    test("InterpStart lexeme is empty when no prefix", () => {
        expect(lexemes('"{x}"')).toEqual(["", "x", "", ""])
    })

    test("multiple interpolation holes emit InterpMiddle", () => {
        expect(kinds('"{a} and {b}"')).toEqual([
            "InterpStart", "Identifier", "InterpMiddle", "Identifier", "InterpEnd", "Eof",
        ])
    })

    test("InterpMiddle lexeme is text between holes", () => {
        expect(lexemes('"{a} and {b}"')).toEqual(["", "a", " and ", "b", "", ""])
    })

    test("interpolation with expression tokens", () => {
        expect(kinds('"val: {1 + 2}"')).toEqual([
            "InterpStart", "IntLiteral", "Plus", "IntLiteral", "InterpEnd", "Eof",
        ])
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

    test("multi-char token span length", () => {
        const result = lex("==", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [eqTok] = result.right
        expect(eqTok!.span.length).toBe(2)
        expect(eqTok!.span.column).toBe(0)
    })

    test("identifier span length matches lexeme", () => {
        const result = lex("hello", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [tok] = result.right
        expect(tok!.span.length).toBe(5)
    })

    test("integer literal span", () => {
        const result = lex("  42", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [tok] = result.right
        expect(tok!.span.column).toBe(2)
        expect(tok!.span.length).toBe(2)
    })
})

describe("lex - real code", () => {
    test("variable declaration", () => {
        expect(kinds("let x = 42;")).toEqual(["Let", "Identifier", "Equal", "IntLiteral", "Semicolon", "Eof"])
    })

    test("function definition header", () => {
        expect(kinds("fn add(a, b)")).toEqual(["Fn", "Identifier", "LeftParen", "Identifier", "Comma", "Identifier", "RightParen", "Eof"])
    })

    test("for loop header", () => {
        expect(kinds("for i in 0..10")).toEqual(["For", "Identifier", "In", "IntLiteral", "DotDot", "IntLiteral", "Eof"])
    })

    test("while loop", () => {
        expect(kinds("while x > 0")).toEqual(["While", "Identifier", "Greater", "IntLiteral", "Eof"])
    })

    test("break and continue", () => {
        expect(kinds("break")).toEqual(["Break", "Eof"])
        expect(kinds("continue")).toEqual(["Continue", "Eof"])
    })

    test("struct declaration", () => {
        expect(kinds("struct Point { x, y }")).toEqual([
            "Struct", "Identifier", "LeftBrace", "Identifier", "Comma", "Identifier", "RightBrace", "Eof",
        ])
    })

    test("enum declaration", () => {
        expect(kinds("enum Dir { North, South }")).toEqual([
            "Enum", "Identifier", "LeftBrace", "Identifier", "Comma", "Identifier", "RightBrace", "Eof",
        ])
    })

    test("match expression header", () => {
        expect(kinds("match x { 0 => 1 }")).toEqual([
            "Match", "Identifier", "LeftBrace", "IntLiteral", "FatArrow", "IntLiteral", "RightBrace", "Eof",
        ])
    })

    test("import with alias", () => {
        expect(kinds("import math as m")).toEqual(["Import", "Identifier", "As", "Identifier", "Eof"])
    })

    test("bitwise expression", () => {
        expect(kinds("a & b | c ^ d")).toEqual([
            "Identifier", "Ampersand", "Identifier", "Pipe", "Identifier", "Caret", "Identifier", "Eof",
        ])
    })

    test("tilde unary in expression", () => {
        expect(kinds("~bits")).toEqual(["Tilde", "Identifier", "Eof"])
    })

    test("unexpected character errors", () => {
        expect(fails("let x = $")).toBe(true)
    })

    test("Eof token has empty lexeme", () => {
        const result = lex("", "test.luma")
        if (Either.isLeft(result)) throw new Error(result.left.render())
        const [eofTok] = result.right
        expect(eofTok!.lexeme).toBe("")
        expect(eofTok!.kind).toBe("Eof")
    })
})
