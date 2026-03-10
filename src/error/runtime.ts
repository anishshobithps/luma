import { Schema, Option } from "effect"
import { Diagnostic } from "@/diagnostic/diagnostic";
import { render } from "@/diagnostic/renderer";
import { Span } from "@/diagnostic/span";

export const RuntimeErrorKind = Schema.Literal(
    "DivisionByZero",
    "StackOverflow",
    "OutOfBounds",
    "NilDereference",
    "TypeMismatch",
    "AssertionFailed",
    "UserPanic",
)
export type RuntimeErrorKind = typeof RuntimeErrorKind.Type

export class RuntimeError extends Schema.TaggedError<RuntimeError>()("RuntimeError", {
    kind: RuntimeErrorKind,
    diagnostic: Schema.instanceOf(Diagnostic),
    source: Schema.String,
    callStack: Schema.Array(Schema.instanceOf(Span)),
}) {
    render(): string {
        const base = render(this.diagnostic, this.source)
        if (this.callStack.length === 0) return base
        const frames = this.callStack.map((span, i) => {
            const loc = `${span.file}:${span.line + 1}:${span.column + 1}`
            return `   ${i}: ${loc}`
        })
        return [base, "", "stack backtrace:", ...frames].join("\n")
    }
}

export class InternalError extends Schema.TaggedError<InternalError>()("InternalError", {
    message: Schema.String,
    phase: Schema.String,
    cause: Schema.Option(Schema.Unknown),
}) {
    render(): string {
        const causeStr = Option.match(this.cause, {
            onNone: () => "",
            onSome: (c) => `\ncaused by: ${String(c)}`,
        })
        return `internal compiler error in ${this.phase}: ${this.message}${causeStr}\n\nThis is a bug in luma. Please report it.`
    }
}
