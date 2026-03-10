import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { lookupKeyword, isKeyword } from "@/utils/keywords"
import type { TokenKind } from "@/lexer/token"

const allKeywords: [string, TokenKind][] = [
    ["let", "Let"],
    ["mut", "Mut"],
    ["fn", "Fn"],
    ["return", "Return"],
    ["if", "If"],
    ["else", "Else"],
    ["while", "While"],
    ["for", "For"],
    ["in", "In"],
    ["break", "Break"],
    ["continue", "Continue"],
    ["true", "True"],
    ["false", "False"],
    ["nil", "Nil"],
    ["and", "And"],
    ["or", "Or"],
    ["not", "Not"],
    ["type", "Type"],
    ["struct", "Struct"],
    ["enum", "Enum"],
    ["match", "Match"],
    ["import", "Import"],
    ["export", "Export"],
    ["as", "As"],
]

describe("lookupKeyword", () => {
    test("returns the correct TokenKind for each keyword", () => {
        for (const [word, kind] of allKeywords) {
            const result = lookupKeyword(word)
            expect(Option.isSome(result)).toBe(true)
            expect(Option.getOrThrow(result)).toBe(kind)
        }
    })

    test("returns None for non-keywords", () => {
        for (const word of ["foo", "bar", "Let", "IF", "123", ""]) {
            expect(Option.isNone(lookupKeyword(word))).toBe(true)
        }
    })
})

describe("isKeyword", () => {
    test("returns true for all keywords", () => {
        for (const [word] of allKeywords) {
            expect(isKeyword(word)).toBe(true)
        }
    })

    test("returns false for non-keywords", () => {
        expect(isKeyword("foo")).toBe(false)
        expect(isKeyword("Let")).toBe(false)
        expect(isKeyword("")).toBe(false)
    })

    test("is case-sensitive", () => {
        expect(isKeyword("let")).toBe(true)
        expect(isKeyword("LET")).toBe(false)
        expect(isKeyword("Let")).toBe(false)
    })
})
