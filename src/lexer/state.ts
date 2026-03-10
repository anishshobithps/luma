import { Option } from "effect"
import { Span } from "@/diagnostic/span";

export type LexState = {
    readonly source: string
    readonly file: string
    readonly pos: number
    readonly line: number
    readonly lineStart: number
}

export const initial = (source: string, file: string): LexState => ({
    source,
    file,
    pos: 0,
    line: 0,
    lineStart: 0,
})

export const peek = (state: LexState): Option.Option<string> =>
    state.pos < state.source.length
        ? Option.some(state.source[state.pos]!)
        : Option.none()

export const peekAt = (state: LexState, offset: number): Option.Option<string> => {
    const idx = state.pos + offset
    return idx < state.source.length
        ? Option.some(state.source[idx]!)
        : Option.none()
}

export const advance = (state: LexState): [string, LexState] => {
    const ch = state.source[state.pos]!
    const newLine = ch === "\n" ? state.line + 1 : state.line
    const newLineStart = ch === "\n" ? state.pos + 1 : state.lineStart
    return [ch, { ...state, pos: state.pos + 1, line: newLine, lineStart: newLineStart }]
}

export const column = (state: LexState): number => state.pos - state.lineStart

export const currentLineText = (state: LexState): string => {
    const end = state.source.indexOf("\n", state.lineStart)
    return state.source.slice(state.lineStart, end === -1 ? undefined : end)
}

export const spanFrom = (
    state: LexState,
    startPos: number,
    startLine: number,
    startLineStart: number,
): Span =>
    new Span({
        file: state.file,
        line: startLine,
        column: startPos - startLineStart,
        length: Math.max(1, state.pos - startPos),
    })

export const eofSpan = (state: LexState): Span =>
    new Span({
        file: state.file,
        line: state.line,
        column: column(state),
        length: 1,
    })
