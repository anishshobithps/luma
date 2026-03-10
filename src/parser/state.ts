import { Array, Option } from "effect"
import { Token } from "@/lexer/token"
import { Span } from "@/diagnostic/span"

export type ParseState = {
    readonly tokens: ReadonlyArray<Token>
    readonly pos: number
    readonly source: string
    readonly file: string
}

export const initial = (tokens: ReadonlyArray<Token>, source: string, file: string): ParseState => ({
    tokens,
    pos: 0,
    source,
    file,
})

export const peek = (state: ParseState): Token => {
    const tok = Array.get(state.tokens, state.pos)
    return Option.getOrElse(tok, () => {
        const last = Array.get(state.tokens, state.tokens.length - 1)
        return Option.getOrElse(last, () => new Token({
            kind: "Eof",
            lexeme: "",
            span: new Span({ file: state.file, line: 0, column: 0, length: 1 }),
        }))
    })
}

export const advance = (state: ParseState): [Token, ParseState] => {
    const tok = peek(state)
    return [tok, { ...state, pos: state.pos + 1 }]
}

export const check = (state: ParseState, ...kinds: ReadonlyArray<string>): boolean =>
    Array.some(kinds, (k) => peek(state).kind === k)

export const eat = (state: ParseState, kind: string): Option.Option<[Token, ParseState]> => {
    const tok = peek(state)
    if (tok.kind !== kind) return Option.none()
    return Option.some(advance(state))
}

export const currentSpan = (state: ParseState): Span => peek(state).span
