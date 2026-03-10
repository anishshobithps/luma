import { describe, expect, test } from "bun:test"
import { render } from "@/diagnostic/renderer"
import { error, warning, makeDiagnostic } from "@/diagnostic/diagnostic"
import { secondaryLabel } from "@/diagnostic/label"
import { Span } from "@/diagnostic/span"

const source = "let x = 42\nlet y = x + 1\nlet z = oops"

describe("render", () => {
    test("renders a basic error diagnostic", () => {
        const span = new Span({ file: "test.luma", line: 2, column: 8, length: 4 })
        const diag = error("undefined variable", span, { primaryMessage: "not found" })
        const output = render(diag, source)

        expect(output).toContain("error: undefined variable")
        expect(output).toContain("--> test.luma:3:9")
        expect(output).toContain("let z = oops")
        expect(output).toContain("^^^^ not found")
    })

    test("renders a warning diagnostic", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 4, length: 1 })
        const diag = warning("unused variable", span)
        const output = render(diag, source)

        expect(output).toContain("warning: unused variable")
        expect(output).toContain("--> test.luma:1:5")
    })

    test("renders error code when present", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 0, length: 3 })
        const diag = error("type error", span, { code: "E001" })
        const output = render(diag, source)

        expect(output).toContain("error[E001]: type error")
    })

    test("renders notes and hints", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 0, length: 3 })
        const diag = error("problem", span, {
            notes: ["variables must be declared before use"],
            hints: ["try adding a let declaration"],
        })
        const output = render(diag, source)

        expect(output).toContain("= note: variables must be declared before use")
        expect(output).toContain("= hint: try adding a let declaration")
    })

    test("renders multiple labels with different caret styles", () => {
        const primarySpan = new Span({ file: "test.luma", line: 1, column: 8, length: 1 })
        const secondarySpan = new Span({ file: "test.luma", line: 0, column: 4, length: 1 })
        const diag = makeDiagnostic("error", "type mismatch", primarySpan, {
            primaryMessage: "expected here",
            labels: [secondaryLabel(secondarySpan, "defined here")],
        })
        const output = render(diag, source)

        expect(output).toContain("^ expected here")
        expect(output).toContain("- defined here")
    })

    test("handles single-character spans", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 0, length: 1 })
        const diag = error("unexpected character", span)
        const output = render(diag, source)

        expect(output).toContain("^")
    })

    test("renders info severity", () => {
        const span = new Span({ file: "test.luma", line: 0, column: 0, length: 3 })
        const diag = makeDiagnostic("info", "some info", span)
        const output = render(diag, source)

        expect(output).toContain("info: some info")
    })
})
