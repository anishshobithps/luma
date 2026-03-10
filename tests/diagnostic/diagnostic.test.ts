import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { Diagnostic, makeDiagnostic, error, warning } from "@/diagnostic/diagnostic"
import { Span } from "@/diagnostic/span"
import { secondaryLabel } from "@/diagnostic/label"

const span = new Span({ file: "test.luma", line: 2, column: 4, length: 5 })

describe("Diagnostic", () => {
    test("creates a diagnostic with all fields", () => {
        const diag = new Diagnostic({
            severity: "error",
            code: Option.some("E001"),
            message: "something broke",
            labels: [],
            notes: ["note 1"],
            hints: ["try this"],
        })
        expect(diag.severity).toBe("error")
        expect(Option.getOrThrow(diag.code)).toBe("E001")
        expect(diag.message).toBe("something broke")
        expect(diag.notes).toEqual(["note 1"])
        expect(diag.hints).toEqual(["try this"])
    })

    test("accepts valid severity levels", () => {
        for (const severity of ["error", "warning", "info"] as const) {
            const diag = new Diagnostic({
                severity,
                code: Option.none(),
                message: "test",
                labels: [],
                notes: [],
                hints: [],
            })
            expect(diag.severity).toBe(severity)
        }
    })
})

describe("makeDiagnostic", () => {
    test("creates a diagnostic with a primary label from the span", () => {
        const diag = makeDiagnostic("error", "bad thing", span)
        expect(diag.severity).toBe("error")
        expect(diag.message).toBe("bad thing")
        expect(diag.labels.length).toBe(1)
        expect(diag.labels[0]!.style).toBe("primary")
        expect(diag.labels[0]!.span).toBe(span)
    })

    test("prepends primary label before additional labels", () => {
        const extraSpan = new Span({ file: "test.luma", line: 5, column: 0, length: 2 })
        const extra = secondaryLabel(extraSpan, "related")
        const diag = makeDiagnostic("warning", "msg", span, {
            labels: [extra],
        })
        expect(diag.labels.length).toBe(2)
        expect(diag.labels[0]!.style).toBe("primary")
        expect(diag.labels[1]!.style).toBe("secondary")
    })

    test("includes code, notes, and hints when provided", () => {
        const diag = makeDiagnostic("error", "msg", span, {
            code: "E042",
            primaryMessage: "here",
            notes: ["note"],
            hints: ["hint"],
        })
        expect(Option.getOrThrow(diag.code)).toBe("E042")
        expect(Option.getOrThrow(diag.labels[0]!.message)).toBe("here")
        expect(diag.notes).toEqual(["note"])
        expect(diag.hints).toEqual(["hint"])
    })

    test("defaults optional fields to empty", () => {
        const diag = makeDiagnostic("info", "msg", span)
        expect(Option.isNone(diag.code)).toBe(true)
        expect(diag.notes).toEqual([])
        expect(diag.hints).toEqual([])
    })
})

describe("error", () => {
    test("creates an error diagnostic", () => {
        const diag = error("oops", span)
        expect(diag.severity).toBe("error")
        expect(diag.message).toBe("oops")
    })

    test("passes options through", () => {
        const diag = error("oops", span, { code: "E001" })
        expect(Option.getOrThrow(diag.code)).toBe("E001")
    })
})

describe("warning", () => {
    test("creates a warning diagnostic", () => {
        const diag = warning("careful", span)
        expect(diag.severity).toBe("warning")
        expect(diag.message).toBe("careful")
    })
})
