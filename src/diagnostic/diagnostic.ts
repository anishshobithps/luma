import { Schema, Option, Array } from "effect"
import { Span } from "@/diagnostic/span";
import { Label, primaryLabel } from "@/diagnostic/label";

export const DiagnosticSeverity = Schema.Literal("error", "warning", "info")
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type

export class Diagnostic extends Schema.Class<Diagnostic>("Diagnostic")({
    severity: DiagnosticSeverity,
    code: Schema.Option(Schema.String),
    message: Schema.String,
    labels: Schema.Array(Label),
    notes: Schema.Array(Schema.String),
    hints: Schema.Array(Schema.String),
}) { }

export const makeDiagnostic = (
    severity: DiagnosticSeverity,
    message: string,
    primarySpan: Span,
    opts?: {
        code?: string
        primaryMessage?: string
        labels?: ReadonlyArray<Label>
        notes?: ReadonlyArray<string>
        hints?: ReadonlyArray<string>
    },
): Diagnostic =>
    new Diagnostic({
        severity,
        code: Option.fromNullable(opts?.code),
        message,
        labels: Array.prepend(opts?.labels ?? [], primaryLabel(primarySpan, opts?.primaryMessage)),
        notes: opts?.notes ?? [],
        hints: opts?.hints ?? [],
    })

export const error = (
    message: string,
    span: Span,
    opts?: Parameters<typeof makeDiagnostic>[3],
): Diagnostic => makeDiagnostic("error", message, span, opts)

export const warning = (
    message: string,
    span: Span,
    opts?: Parameters<typeof makeDiagnostic>[3],
): Diagnostic => makeDiagnostic("warning", message, span, opts)
