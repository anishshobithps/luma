import { Schema } from "effect"

export class Span extends Schema.Class<Span>("Span")({
  file: Schema.String,
  line: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  column: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  length: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}
