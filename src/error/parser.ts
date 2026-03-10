import { Schema } from "effect"
import { Diagnostic } from "@/diagnostic/diagnostic"
import { render } from "@/diagnostic/renderer"

export class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
    diagnostic: Schema.instanceOf(Diagnostic),
    source: Schema.String,
}) {
    render(): string {
        return render(this.diagnostic, this.source)
    }
}
