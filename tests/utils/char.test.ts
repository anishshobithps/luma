import { describe, expect, test } from "bun:test"
import {
    isDigit,
    isLower,
    isUpper,
    isAlpha,
    isAlphaNum,
    isWhitespace,
    isHexDigit,
    isOctalDigit,
    isBinaryDigit,
    isNewline,
    isPrintable,
} from "@/utils/char"

describe("isDigit", () => {
    test("returns true for 0-9", () => {
        for (const ch of "0123456789") {
            expect(isDigit(ch)).toBe(true)
        }
    })

    test("returns false for non-digit characters", () => {
        for (const ch of "abcABC!@# \n") {
            expect(isDigit(ch)).toBe(false)
        }
    })
})

describe("isLower", () => {
    test("returns true for a-z", () => {
        for (const ch of "abcxyz") {
            expect(isLower(ch)).toBe(true)
        }
    })

    test("returns false for uppercase and other characters", () => {
        expect(isLower("A")).toBe(false)
        expect(isLower("0")).toBe(false)
        expect(isLower("_")).toBe(false)
    })
})

describe("isUpper", () => {
    test("returns true for A-Z", () => {
        for (const ch of "ABCXYZ") {
            expect(isUpper(ch)).toBe(true)
        }
    })

    test("returns false for lowercase and other characters", () => {
        expect(isUpper("a")).toBe(false)
        expect(isUpper("0")).toBe(false)
        expect(isUpper("_")).toBe(false)
    })
})

describe("isAlpha", () => {
    test("returns true for letters and underscore", () => {
        expect(isAlpha("a")).toBe(true)
        expect(isAlpha("Z")).toBe(true)
        expect(isAlpha("_")).toBe(true)
    })

    test("returns false for digits and special characters", () => {
        expect(isAlpha("0")).toBe(false)
        expect(isAlpha(" ")).toBe(false)
        expect(isAlpha("!")).toBe(false)
    })
})

describe("isAlphaNum", () => {
    test("returns true for letters, digits, and underscore", () => {
        expect(isAlphaNum("a")).toBe(true)
        expect(isAlphaNum("Z")).toBe(true)
        expect(isAlphaNum("5")).toBe(true)
        expect(isAlphaNum("_")).toBe(true)
    })

    test("returns false for special characters", () => {
        expect(isAlphaNum(" ")).toBe(false)
        expect(isAlphaNum("!")).toBe(false)
        expect(isAlphaNum("\n")).toBe(false)
    })
})

describe("isWhitespace", () => {
    test("returns true for whitespace characters", () => {
        expect(isWhitespace(" ")).toBe(true)
        expect(isWhitespace("\t")).toBe(true)
        expect(isWhitespace("\r")).toBe(true)
        expect(isWhitespace("\n")).toBe(true)
    })

    test("returns false for non-whitespace", () => {
        expect(isWhitespace("a")).toBe(false)
        expect(isWhitespace("0")).toBe(false)
    })
})

describe("isHexDigit", () => {
    test("returns true for 0-9 and a-f/A-F", () => {
        for (const ch of "0123456789abcdefABCDEF") {
            expect(isHexDigit(ch)).toBe(true)
        }
    })

    test("returns false for g and beyond", () => {
        expect(isHexDigit("g")).toBe(false)
        expect(isHexDigit("G")).toBe(false)
        expect(isHexDigit("z")).toBe(false)
    })
})

describe("isOctalDigit", () => {
    test("returns true for 0-7", () => {
        for (const ch of "01234567") {
            expect(isOctalDigit(ch)).toBe(true)
        }
    })

    test("returns false for 8, 9, and non-digits", () => {
        expect(isOctalDigit("8")).toBe(false)
        expect(isOctalDigit("9")).toBe(false)
        expect(isOctalDigit("a")).toBe(false)
    })
})

describe("isBinaryDigit", () => {
    test("returns true for 0 and 1", () => {
        expect(isBinaryDigit("0")).toBe(true)
        expect(isBinaryDigit("1")).toBe(true)
    })

    test("returns false for other characters", () => {
        expect(isBinaryDigit("2")).toBe(false)
        expect(isBinaryDigit("a")).toBe(false)
    })
})

describe("isNewline", () => {
    test("returns true for newline", () => {
        expect(isNewline("\n")).toBe(true)
    })

    test("returns false for other whitespace", () => {
        expect(isNewline("\r")).toBe(false)
        expect(isNewline("\t")).toBe(false)
        expect(isNewline(" ")).toBe(false)
    })
})

describe("isPrintable", () => {
    test("returns true for printable ASCII (0x20-0x7e)", () => {
        expect(isPrintable(" ")).toBe(true)
        expect(isPrintable("A")).toBe(true)
        expect(isPrintable("~")).toBe(true)
    })

    test("returns false for control characters", () => {
        expect(isPrintable("\n")).toBe(false)
        expect(isPrintable("\t")).toBe(false)
        expect(isPrintable("\0")).toBe(false)
    })

    test("returns false for DEL (0x7f)", () => {
        expect(isPrintable("\x7f")).toBe(false)
    })
})
