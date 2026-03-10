import { Schema, Option } from "effect"
import { Span } from "@/diagnostic/span";

export const LabelStyle = Schema.Literal("primary", "secondary", "note")
export type LabelStyle = typeof LabelStyle.Type

export class Label extends Schema.Class<Label>("Label")({
    style: LabelStyle,
    span: Span,
    message: Schema.Option(Schema.String),
}) { }

export const primaryLabel = (span: Span, message?: string): Label =>
    new Label({
        style: "primary",
        span,
        message: Option.fromNullable(message),
    })

export const secondaryLabel = (span: Span, message?: string): Label =>
    new Label({
        style: "secondary",
        span,
        message: Option.fromNullable(message),
    })

export const noteLabel = (span: Span, message: string): Label =>
    new Label({ style: "note", span, message: Option.some(message) })
