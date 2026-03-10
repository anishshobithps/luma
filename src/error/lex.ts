import { Schema } from "effect"
import { Diagnostic } from "@/diagnostic/diagnostic";
import { render } from "@/diagnostic/renderer";

export class LexError extends Schema.TaggedError<LexError>()("LexError", {
    diagnostic: Schema.instanceOf(Diagnostic),
    source: Schema.String,
}) {
    render(): string {
        return render(this.diagnostic, this.source)
    }
}
