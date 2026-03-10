import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { Label, primaryLabel, secondaryLabel, noteLabel } from "@/diagnostic/label"
import { Span } from "@/diagnostic/span"

const span = new Span({ file: "test.luma", line: 0, column: 0, length: 3 })

describe("Label", () => {
    test("creates a label with all fields", () => {
        const label = new Label({
            style: "primary",
            span,
            message: Option.some("test message"),
        })
        expect(label.style).toBe("primary")
        expect(label.span).toBe(span)
        expect(Option.getOrThrow(label.message)).toBe("test message")
    })

    test("accepts valid label styles", () => {
        for (const style of ["primary", "secondary", "note"] as const) {
            const label = new Label({ style, span, message: Option.none() })
            expect(label.style).toBe(style)
        }
    })
})

describe("primaryLabel", () => {
    test("creates a primary label with message", () => {
        const label = primaryLabel(span, "here")
        expect(label.style).toBe("primary")
        expect(label.span).toBe(span)
        expect(Option.getOrThrow(label.message)).toBe("here")
    })

    test("creates a primary label without message", () => {
        const label = primaryLabel(span)
        expect(label.style).toBe("primary")
        expect(Option.isNone(label.message)).toBe(true)
    })
})

describe("secondaryLabel", () => {
    test("creates a secondary label with message", () => {
        const label = secondaryLabel(span, "also here")
        expect(label.style).toBe("secondary")
        expect(Option.getOrThrow(label.message)).toBe("also here")
    })

    test("creates a secondary label without message", () => {
        const label = secondaryLabel(span)
        expect(label.style).toBe("secondary")
        expect(Option.isNone(label.message)).toBe(true)
    })
})

describe("noteLabel", () => {
    test("creates a note label with required message", () => {
        const label = noteLabel(span, "note message")
        expect(label.style).toBe("note")
        expect(Option.getOrThrow(label.message)).toBe("note message")
    })
})
