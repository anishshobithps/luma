import { Array, Either, Option, pipe } from "effect"
import { Diagnostic, error } from "@/diagnostic/diagnostic"
import { LexError } from "@/error/lex"
import { advance, eofSpan, initial, peek, peekAt, spanFrom, type LexState } from "@/lexer/state"
import { Token, type TokenKind } from "@/lexer/token"
import { isAlpha, isAlphaNum, isBinaryDigit, isDigit, isHexDigit, isOctalDigit, isWhitespace } from "@/utils/char"
import { resolveEscape } from "@/utils/escape"
import { lookupKeyword } from "@/utils/keywords"

type LexResult = Either.Either<ReadonlyArray<Token>, LexError>

const makeToken = (kind: TokenKind, lexeme: string, state: LexState, startPos: number, startLine: number, startLineStart: number): Token =>
    new Token({ kind, lexeme, span: spanFrom(state, startPos, startLine, startLineStart) })

const lexError = (diag: Diagnostic, source: string): LexError =>
    new LexError({ diagnostic: diag, source })

const skipLineComment = (state: LexState): LexState => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null || ch === "\n") return state
    const [, next] = advance(state)
    return skipLineComment(next)
}

const skipWhitespaceAndComments = (state: LexState): LexState => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null) return state
    if (isWhitespace(ch)) {
        const [, next] = advance(state)
        return skipWhitespaceAndComments(next)
    }
    if (ch === "/" && Option.getOrNull(peekAt(state, 1)) === "/") {
        return skipWhitespaceAndComments(skipLineComment(state))
    }
    return state
}

const lexStringContents = (
    state: LexState,
    acc: string,
    source: string,
    startPos: number,
    startLine: number,
    startLineStart: number,
): Either.Either<[string, LexState], LexError> => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null) {
        const span = spanFrom(state, startPos, startLine, startLineStart)
        return Either.left(lexError(error("unterminated string literal", span), source))
    }
    if (ch === '"') {
        const [, next] = advance(state)
        return Either.right([acc, next])
    }
    if (ch === "\\") {
        const [, afterSlash] = advance(state)
        const escaped = Option.getOrNull(peek(afterSlash))
        if (escaped === null) {
            const span = spanFrom(afterSlash, startPos, startLine, startLineStart)
            return Either.left(lexError(error("unterminated escape sequence", span), source))
        }
        const resolved = Option.getOrNull(resolveEscape(escaped))
        if (resolved === null) {
            const span = spanFrom(afterSlash, afterSlash.pos, afterSlash.line, afterSlash.lineStart)
            return Either.left(lexError(error(`unknown escape sequence '\\${escaped}'`, span), source))
        }
        const [, afterEsc] = advance(afterSlash)
        return lexStringContents(afterEsc, acc + resolved, source, startPos, startLine, startLineStart)
    }
    const [, next] = advance(state)
    return lexStringContents(next, acc + ch, source, startPos, startLine, startLineStart)
}

const lexInterpSegment = (
    state: LexState,
    acc: string,
    source: string,
    startPos: number,
    startLine: number,
    startLineStart: number,
): Either.Either<[string, boolean, LexState], LexError> => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null) {
        const span = spanFrom(state, startPos, startLine, startLineStart)
        return Either.left(lexError(error("unterminated string literal", span), source))
    }
    if (ch === '"') {
        const [, next] = advance(state)
        return Either.right([acc, false, next])
    }
    if (ch === '{') {
        const [, next] = advance(state)
        return Either.right([acc, true, next])
    }
    if (ch === "\\") {
        const [, afterSlash] = advance(state)
        const escaped = Option.getOrNull(peek(afterSlash))
        if (escaped === null) {
            const span = spanFrom(afterSlash, startPos, startLine, startLineStart)
            return Either.left(lexError(error("unterminated escape sequence", span), source))
        }
        const resolved = Option.getOrNull(resolveEscape(escaped))
        if (resolved === null) {
            const span = spanFrom(afterSlash, afterSlash.pos, afterSlash.line, afterSlash.lineStart)
            return Either.left(lexError(error(`unknown escape sequence '\\${escaped}'`, span), source))
        }
        const [, afterEsc] = advance(afterSlash)
        return lexInterpSegment(afterEsc, acc + resolved, source, startPos, startLine, startLineStart)
    }
    const [c, next] = advance(state)
    return lexInterpSegment(next, acc + c, source, startPos, startLine, startLineStart)
}

const lexDigits = (state: LexState, acc: string, predicate: (ch: string) => boolean): [string, LexState] => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null || !predicate(ch)) return [acc, state]
    const [c, next] = advance(state)
    return lexDigits(next, acc + c, predicate)
}

const lexNumber = (
    state: LexState,
    firstDigit: string,
    source: string,
    startPos: number,
    startLine: number,
    startLineStart: number,
): Either.Either<[Token, LexState], LexError> => {
    if (firstDigit === "0") {
        const next = Option.getOrNull(peek(state))
        if (next === "x" || next === "X") {
            const [, afterPrefix] = advance(state)
            const [digits, afterDigits] = lexDigits(afterPrefix, "", isHexDigit)
            if (digits.length === 0) {
                const span = spanFrom(afterDigits, startPos, startLine, startLineStart)
                return Either.left(lexError(error("expected hex digits after '0x'", span), source))
            }
            return Either.right([makeToken("IntLiteral", "0" + next + digits, afterDigits, startPos, startLine, startLineStart), afterDigits])
        }
        if (next === "o" || next === "O") {
            const [, afterPrefix] = advance(state)
            const [digits, afterDigits] = lexDigits(afterPrefix, "", isOctalDigit)
            if (digits.length === 0) {
                const span = spanFrom(afterDigits, startPos, startLine, startLineStart)
                return Either.left(lexError(error("expected octal digits after '0o'", span), source))
            }
            return Either.right([makeToken("IntLiteral", "0" + next + digits, afterDigits, startPos, startLine, startLineStart), afterDigits])
        }
        if (next === "b" || next === "B") {
            const [, afterPrefix] = advance(state)
            const [digits, afterDigits] = lexDigits(afterPrefix, "", isBinaryDigit)
            if (digits.length === 0) {
                const span = spanFrom(afterDigits, startPos, startLine, startLineStart)
                return Either.left(lexError(error("expected binary digits after '0b'", span), source))
            }
            return Either.right([makeToken("IntLiteral", "0" + next + digits, afterDigits, startPos, startLine, startLineStart), afterDigits])
        }
    }

    const [intPart, afterInt] = lexDigits(state, firstDigit, isDigit)

    if (Option.getOrNull(peek(afterInt)) === ".") {
        const afterDot = Option.getOrNull(peekAt(afterInt, 1))
        if (afterDot !== null && isDigit(afterDot)) {
            const [, afterDotState] = advance(afterInt)
            const [fracPart, afterFrac] = lexDigits(afterDotState, "", isDigit)
            const lexeme = intPart + "." + fracPart
            return Either.right([makeToken("FloatLiteral", lexeme, afterFrac, startPos, startLine, startLineStart), afterFrac])
        }
    }

    return Either.right([makeToken("IntLiteral", intPart, afterInt, startPos, startLine, startLineStart), afterInt])
}

const lexIdentOrKeyword = (
    state: LexState,
    acc: string,
    startPos: number,
    startLine: number,
    startLineStart: number,
): [Token, LexState] => {
    const ch = Option.getOrNull(peek(state))
    if (ch !== null && isAlphaNum(ch)) {
        const [c, next] = advance(state)
        return lexIdentOrKeyword(next, acc + c, startPos, startLine, startLineStart)
    }
    const kind = Option.getOrElse(lookupKeyword(acc), () => "Identifier" as TokenKind)
    return [makeToken(kind, acc, state, startPos, startLine, startLineStart), state]
}

const lexOne = (
    state: LexState,
    source: string,
): Either.Either<[Token, LexState], LexError> => {
    const ch = Option.getOrNull(peek(state))
    if (ch === null) {
        return Either.right([new Token({ kind: "Eof", lexeme: "", span: eofSpan(state) }), state])
    }

    const startPos = state.pos
    const startLine = state.line
    const startLineStart = state.lineStart
    const mk = (kind: TokenKind, lexeme: string, s: LexState) =>
        makeToken(kind, lexeme, s, startPos, startLine, startLineStart)

    const [c, s1] = advance(state)

    if (isDigit(c)) return lexNumber(s1, c, source, startPos, startLine, startLineStart)
    if (isAlpha(c)) return Either.right(lexIdentOrKeyword(s1, c, startPos, startLine, startLineStart))

    if (c === '"') {
        return pipe(
            lexInterpSegment(s1, "", source, startPos, startLine, startLineStart),
            Either.map(([seg, hasInterp, after]) => {
                const nextState = hasInterp ? { ...after, interpDepth: after.interpDepth + 1 } : after
                const kind: TokenKind = hasInterp ? "InterpStart" : "StringLiteral"
                return [mk(kind, seg, nextState), nextState] as [Token, LexState]
            })
        )
    }

    if (c === '}' && s1.interpDepth > 0) {
        const resumed = { ...s1, interpDepth: s1.interpDepth - 1 }
        return pipe(
            lexInterpSegment(resumed, "", source, startPos, startLine, startLineStart),
            Either.map(([seg, hasInterp, after]) => {
                const nextState = hasInterp ? { ...after, interpDepth: after.interpDepth + 1 } : after
                const kind: TokenKind = hasInterp ? "InterpMiddle" : "InterpEnd"
                return [mk(kind, seg, nextState), nextState] as [Token, LexState]
            })
        )
    }

    const peek1 = Option.getOrNull(peek(s1))

    if (c === ".") {
        if (peek1 === ".") {
            const [, s2] = advance(s1)
            if (Option.getOrNull(peek(s2)) === "=") {
                const [, s3] = advance(s2)
                return Either.right([mk("DotDotEqual", "..=", s3), s3])
            }
            return Either.right([mk("DotDot", "..", s2), s2])
        }
        return Either.right([mk("Dot", ".", s1), s1])
    }

    if (c === ":") {
        if (peek1 === ":") {
            const [, s2] = advance(s1)
            return Either.right([mk("DoubleColon", "::", s2), s2])
        }
        return Either.right([mk("Colon", ":", s1), s1])
    }

    if (c === "-") {
        if (peek1 === ">") {
            const [, s2] = advance(s1)
            return Either.right([mk("Arrow", "->", s2), s2])
        }
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("MinusEqual", "-=", s2), s2])
        }
        return Either.right([mk("Minus", "-", s1), s1])
    }

    if (c === "=") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("EqualEqual", "==", s2), s2])
        }
        if (peek1 === ">") {
            const [, s2] = advance(s1)
            return Either.right([mk("FatArrow", "=>", s2), s2])
        }
        return Either.right([mk("Equal", "=", s1), s1])
    }

    if (c === "!") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("BangEqual", "!=", s2), s2])
        }
        return Either.right([mk("Bang", "!", s1), s1])
    }

    if (c === "<") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("LessEqual", "<=", s2), s2])
        }
        if (peek1 === "<") {
            const [, s2] = advance(s1)
            return Either.right([mk("LessLess", "<<", s2), s2])
        }
        return Either.right([mk("Less", "<", s1), s1])
    }

    if (c === ">") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("GreaterEqual", ">=", s2), s2])
        }
        if (peek1 === ">") {
            const [, s2] = advance(s1)
            return Either.right([mk("GreaterGreater", ">>", s2), s2])
        }
        return Either.right([mk("Greater", ">", s1), s1])
    }

    if (c === "+") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("PlusEqual", "+=", s2), s2])
        }
        return Either.right([mk("Plus", "+", s1), s1])
    }

    if (c === "*") {
        if (peek1 === "*") {
            const [, s2] = advance(s1)
            return Either.right([mk("StarStar", "**", s2), s2])
        }
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("StarEqual", "*=", s2), s2])
        }
        return Either.right([mk("Star", "*", s1), s1])
    }

    if (c === "/") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("SlashEqual", "/=", s2), s2])
        }
        return Either.right([mk("Slash", "/", s1), s1])
    }

    if (c === "%") {
        if (peek1 === "=") {
            const [, s2] = advance(s1)
            return Either.right([mk("PercentEqual", "%=", s2), s2])
        }
        return Either.right([mk("Percent", "%", s1), s1])
    }

    if (c === "&") {
        if (peek1 === "&") {
            const [, s2] = advance(s1)
            return Either.right([mk("AmpersandAmpersand", "&&", s2), s2])
        }
        return Either.right([mk("Ampersand", "&", s1), s1])
    }

    if (c === "|") {
        if (peek1 === "|") {
            const [, s2] = advance(s1)
            return Either.right([mk("PipePipe", "||", s2), s2])
        }
        return Either.right([mk("Pipe", "|", s1), s1])
    }

    const singles = new Map<string, TokenKind>([
        ["(", "LeftParen"], [")", "RightParen"],
        ["{", "LeftBrace"], ["}", "RightBrace"],
        ["[", "LeftBracket"], ["]", "RightBracket"],
        [",", "Comma"], [";", "Semicolon"],
        ["^", "Caret"], ["~", "Tilde"],
        ["?", "Question"], ["@", "At"], ["#", "Hash"],
    ])

    const singleKind = Option.getOrNull(Option.fromNullable(singles.get(c)))
    if (singleKind !== null) return Either.right([mk(singleKind, c, s1), s1])

    const span = spanFrom(s1, startPos, startLine, startLineStart)
    return Either.left(lexError(error(`unexpected character '${c}'`, span, { primaryMessage: "not recognized" }), source))
}

const collectTokens = (
    state: LexState,
    source: string,
    acc: ReadonlyArray<Token>,
): Either.Either<ReadonlyArray<Token>, LexError> => {
    const cleaned = skipWhitespaceAndComments(state)
    return pipe(
        lexOne(cleaned, source),
        Either.flatMap(([token, next]) =>
            token.kind === "Eof"
                ? Either.right(Array.append(acc, token))
                : collectTokens(next, source, Array.append(acc, token))
        )
    )
}

export const lex = (source: string, file: string): LexResult =>
    collectTokens(initial(source, file), source, [])
