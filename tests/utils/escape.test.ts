import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { resolveEscape, validEscapesList } from "@/utils/escape"

describe("resolveEscape", () => {
    test("resolves standard escape sequences", () => {
        const cases: [string, string][] = [
            ["n", "\n"],
            ["t", "\t"],
            ["r", "\r"],
            ["\\", "\\"],
            ['"', '"'],
            ["'", "'"],
            ["0", "\0"],
            ["a", "\x07"],
            ["b", "\x08"],
            ["f", "\x0c"],
            ["v", "\x0b"],
        ]

        for (const [input, expected] of cases) {
            const result = resolveEscape(input)
            expect(Option.isSome(result)).toBe(true)
            expect(Option.getOrThrow(result)).toBe(expected)
        }
    })

    test("returns None for unknown escape characters", () => {
        for (const ch of "xyzwXYZ123!@") {
            expect(Option.isNone(resolveEscape(ch))).toBe(true)
        }
    })
})

describe("validEscapesList", () => {
    test("returns a space-separated list of all escape sequences", () => {
        const result = validEscapesList()
        expect(result).toContain("\\n")
        expect(result).toContain("\\t")
        expect(result).toContain("\\r")
        expect(result).toContain("\\\\")
        expect(result).toContain("\\\"")
        expect(result).toContain("\\'")
        expect(result).toContain("\\0")
        expect(result).toContain("\\a")
        expect(result).toContain("\\b")
        expect(result).toContain("\\f")
        expect(result).toContain("\\v")
    })

    test("has 11 entries separated by spaces", () => {
        const entries = validEscapesList().split(" ")
        expect(entries.length).toBe(11)
    })
})
