import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { Label, LabelStyle, primaryLabel, secondaryLabel, noteLabel } from "@/diagnostic/label"
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

describe("LabelStyle", () => {
    test("validates known styles", () => {
        expect(Schema.is(LabelStyle)("primary")).toBe(true)
        expect(Schema.is(LabelStyle)("secondary")).toBe(true)
        expect(Schema.is(LabelStyle)("note")).toBe(true)
        expect(Schema.is(LabelStyle)("unknown")).toBe(false)
    })
})

describe("Label schema", () => {
    test("make() creates a label", () => {
        const label = Label.make({ style: "primary", span, message: Option.none() })
        expect(label).toBeInstanceOf(Label)
        expect(label.style).toBe("primary")
    })

    test("encodeSync round-trips a label", () => {
        const label = new Label({ style: "secondary", span, message: Option.some("msg") })
        const encoded = Schema.encodeSync(Label)(label)
        expect(encoded.style).toBe("secondary")
    })

    test("decodeUnknownSync creates a Label from encoded data", () => {
        const label = new Label({ style: "primary", span, message: Option.none() })
        const encoded = Schema.encodeSync(Label)(label)
        const decoded = Schema.decodeUnknownSync(Label)(encoded)
        expect(decoded).toBeInstanceOf(Label)
        expect(decoded.style).toBe("primary")
    })

    test("validateSync validates a Label", () => {
        const label = new Label({ style: "note", span, message: Option.some("hi") })
        const validated = Schema.validateSync(Label)(label)
        expect(validated).toBeInstanceOf(Label)
    })
})
