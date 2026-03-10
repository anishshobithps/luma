import { Array, Option, Match } from "effect"
import { Diagnostic, DiagnosticSeverity } from "@/diagnostic/diagnostic";
import { Label } from "@/diagnostic/label";

const severityPrefix = (s: DiagnosticSeverity): string =>
    Match.value(s).pipe(
        Match.when("error", () => "error"),
        Match.when("warning", () => "warning"),
        Match.when("info", () => "info"),
        Match.exhaustive,
    )

const caretChar = (style: Label["style"]): string =>
    Match.value(style).pipe(
        Match.when("primary", () => "^"),
        Match.when("secondary", () => "-"),
        Match.when("note", () => "~"),
        Match.exhaustive,
    )

const renderLabel = (label: Label, sourceLines: ReadonlyArray<string>): ReadonlyArray<string> => {
    const { span } = label
    const lineText = Array.get(sourceLines, span.line).pipe(Option.getOrElse(() => ""))
    const col = span.column
    const len = Math.max(1, span.length)
    const caret = " ".repeat(col) + caretChar(label.style).repeat(len)
    const loc = `${span.file}:${span.line + 1}:${col + 1}`
    const labelMsg = Option.getOrElse(label.message, () => "")

    const pointer = labelMsg.length > 0 ? `${caret} ${labelMsg}` : caret

    return [
        `  --> ${loc}`,
        `   |`,
        `   | ${lineText}`,
        `   | ${pointer}`,
        `   |`,
    ]
}

export const render = (diag: Diagnostic, source: string): string => {
    const sourceLines = source.split("\n")
    const prefix = severityPrefix(diag.severity)
    const code = Option.match(diag.code, {
        onNone: () => "",
        onSome: (c) => `[${c}]`,
    })

    const header = `${prefix}${code}: ${diag.message}`

    const labelLines = Array.flatMap(diag.labels, (l) => renderLabel(l, sourceLines))

    const noteLines = Array.flatMap(diag.notes, (n) => [`   = note: ${n}`])
    const hintLines = Array.flatMap(diag.hints, (h) => [`   = hint: ${h}`])

    return [header, ...labelLines, ...noteLines, ...hintLines].join("\n")
}
