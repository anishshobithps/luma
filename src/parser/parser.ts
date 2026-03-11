import { Array, Either, Match, Option, pipe } from "effect"
import { error } from "@/diagnostic/diagnostic"
import {
    ArrayExpr, AssignExpr, BinaryExpr, BlockExpr, BoolLiteral,
    BreakExpr, CallExpr, ContinueExpr, ExprStmt, FieldExpr, FloatLiteral,
    ForExpr, Identifier, IfExpr, IndexExpr, IntLiteral, LetStmt, MatchArm,
    MatchExpr, NilLiteral, RangeExpr, ReturnStmt, StringLiteral, UnaryExpr,
    WhileExpr, type Expr, type Stmt,
} from "@/ast/expr"
import {
    EnumDecl, EnumVariant, FnDecl, ImportDecl, Param, Program,
    StructDecl, StructField, TypeDecl, type Decl, type TopLevel,
} from "@/ast/decl"
import { ParseError } from "@/error/parser"
import { Span } from "@/diagnostic/span"
import {
    advance, check, currentSpan, eat, initial, peek, type ParseState,
} from "@/parser/state"

type PR<A> = Either.Either<[A, ParseState], ParseError>

const fail = (msg: string, span: Span, source: string): ParseError =>
    new ParseError({ diagnostic: error(msg, span), source })

const expect = (state: ParseState, kind: string): Either.Either<[import("@/lexer/token").Token, ParseState], ParseError> =>
    Option.match(eat(state, kind), {
        onNone: () => Either.left(fail(
            `expected '${kind}', got '${peek(state).kind}'`,
            currentSpan(state),
            state.source,
        )),
        onSome: (r) => Either.right(r),
    })

const spanFrom = (start: Span, end: Span): Span =>
    new Span({
        file: start.file,
        line: start.line,
        column: start.column,
        length: Math.max(1, (end.column + end.length) - start.column + (end.line - start.line) * 10000),
    })

const parseIntLiteral = (lexeme: string, span: Span, source: string): Either.Either<bigint, ParseError> => {
    const cleanLexeme = lexeme.replace(/_/g, "")
    if (cleanLexeme.startsWith("0x") || cleanLexeme.startsWith("0X"))
        return Either.right(BigInt(cleanLexeme))
    if (cleanLexeme.startsWith("0o") || cleanLexeme.startsWith("0O"))
        return Either.right(BigInt("0o" + cleanLexeme.slice(2)))
    if (cleanLexeme.startsWith("0b") || cleanLexeme.startsWith("0B"))
        return Either.right(BigInt("0b" + cleanLexeme.slice(2)))
    return Either.right(BigInt(cleanLexeme))
}

const unaryOpFor = (kind: string): string | null => {
    if (kind === "Minus") return "-"
    if (kind === "Bang") return "!"
    if (kind === "Not") return "not"
    if (kind === "Tilde") return "~"
    return null
}

const parsePrimary = (state: ParseState): PR<Expr> => {
    const tok = peek(state)
    const [, s1] = advance(state)

    const unaryOp = unaryOpFor(tok.kind)
    if (unaryOp !== null) {
        return pipe(
            parseUnary(s1),
            Either.map(([operand, s2]) => [new UnaryExpr({ op: unaryOp, operand, span: tok.span }), s2] as [Expr, ParseState])
        )
    }

    if (tok.kind === "Break") return Either.right([new BreakExpr({ span: tok.span }), s1] as [Expr, ParseState])
    if (tok.kind === "Continue") return Either.right([new ContinueExpr({ span: tok.span }), s1] as [Expr, ParseState])

    return Match.value(tok.kind).pipe(
        Match.when("IntLiteral", () =>
            pipe(
                parseIntLiteral(tok.lexeme, tok.span, state.source),
                Either.map((v) => [new IntLiteral({ value: v, span: tok.span }), s1] as [Expr, ParseState])
            )
        ),
        Match.when("FloatLiteral", () =>
            Either.right([new FloatLiteral({ value: parseFloat(tok.lexeme), span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("StringLiteral", () =>
            Either.right([new StringLiteral({ value: tok.lexeme, span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("True", () =>
            Either.right([new BoolLiteral({ value: true, span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("False", () =>
            Either.right([new BoolLiteral({ value: false, span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("Nil", () =>
            Either.right([new NilLiteral({ span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("Identifier", () =>
            Either.right([new Identifier({ name: tok.lexeme, span: tok.span }), s1] as [Expr, ParseState])
        ),
        Match.when("LeftParen", () =>
            pipe(
                parseExpr(s1),
                Either.flatMap(([expr, s2]) =>
                    pipe(
                        expect(s2, "RightParen"),
                        Either.map(([, s3]) => [expr, s3] as [Expr, ParseState])
                    )
                )
            )
        ),
        Match.when("LeftBracket", () => parseArrayExpr(s1, tok.span)),
        Match.when("If", () => parseIfExpr(s1, tok.span)),
        Match.when("Match", () => parseMatchExpr(s1, tok.span)),
        Match.when("While", () => parseWhileExpr(s1, tok.span)),
        Match.when("For", () => parseForExpr(s1, tok.span)),
        Match.when("LeftBrace", () => parseBlockExpr(s1, tok.span)),
        Match.orElse(() => Either.left(fail(
            `unexpected token '${tok.kind}'`,
            tok.span,
            state.source,
        )))
    )
}

const parseWhileExpr = (state: ParseState, startSpan: Span): PR<Expr> =>
    pipe(
        parseExpr(state),
        Either.flatMap(([condition, s1]) =>
            pipe(
                expect(s1, "LeftBrace"),
                Either.flatMap(([, s2]) => parseBlockExpr(s2, currentSpan(s2))),
                Either.map(([body, s3]) => [
                    new WhileExpr({ condition, body: body as BlockExpr, span: startSpan }),
                    s3,
                ] as [Expr, ParseState])
            )
        )
    )

const parseForExpr = (state: ParseState, startSpan: Span): PR<Expr> => {
    const varTok = peek(state)
    if (varTok.kind !== "Identifier")
        return Either.left(fail(`expected identifier after 'for', got '${varTok.kind}'`, varTok.span, state.source))
    const [, s1] = advance(state)
    return pipe(
        expect(s1, "In"),
        Either.flatMap(([, s2]) =>
            pipe(
                parseExpr(s2),
                Either.flatMap(([iterable, s3]) =>
                    pipe(
                        expect(s3, "LeftBrace"),
                        Either.flatMap(([, s4]) => parseBlockExpr(s4, currentSpan(s4))),
                        Either.map(([body, s5]) => [
                            new ForExpr({ variable: varTok.lexeme, iterable, body: body as BlockExpr, span: startSpan }),
                            s5,
                        ] as [Expr, ParseState])
                    )
                )
            )
        )
    )
}

const parseArrayExpr = (state: ParseState, startSpan: Span): PR<Expr> => {
    if (check(state, "RightBracket")) {
        const [, s1] = advance(state)
        return Either.right([new ArrayExpr({ elements: [], span: startSpan }), s1])
    }
    return pipe(
        parseExprList(state, "RightBracket"),
        Either.flatMap(([elements, s1]) =>
            pipe(
                expect(s1, "RightBracket"),
                Either.map(([closeTok, s2]) => [
                    new ArrayExpr({ elements, span: spanFrom(startSpan, closeTok.span) }),
                    s2,
                ] as [Expr, ParseState])
            )
        )
    )
}

const parseExprList = (state: ParseState, terminator: string): Either.Either<[ReadonlyArray<Expr>, ParseState], ParseError> =>
    pipe(
        parseExpr(state),
        Either.flatMap(([first, s1]) => collectExprList(s1, [first], terminator))
    )

const collectExprList = (
    state: ParseState,
    acc: ReadonlyArray<Expr>,
    terminator: string,
): Either.Either<[ReadonlyArray<Expr>, ParseState], ParseError> => {
    if (!check(state, "Comma")) return Either.right([acc, state])
    const [, s1] = advance(state)
    if (check(s1, terminator)) return Either.right([acc, s1])
    return pipe(
        parseExpr(s1),
        Either.flatMap(([expr, s2]) => collectExprList(s2, Array.append(acc, expr), terminator))
    )
}

const parseBlockExpr = (state: ParseState, startSpan: Span): PR<Expr> =>
    pipe(
        collectStmts(state, []),
        Either.flatMap(([stmts, s1]) =>
            pipe(
                expect(s1, "RightBrace"),
                Either.map(([closeTok, s2]) => [
                    new BlockExpr({ stmts, span: spanFrom(startSpan, closeTok.span) }),
                    s2,
                ] as [Expr, ParseState])
            )
        )
    )

const collectStmts = (state: ParseState, acc: ReadonlyArray<Stmt>): Either.Either<[ReadonlyArray<Stmt>, ParseState], ParseError> => {
    if (check(state, "RightBrace", "Eof")) return Either.right([acc, state])
    return pipe(
        parseStmt(state),
        Either.flatMap(([stmt, s1]) => collectStmts(s1, Array.append(acc, stmt)))
    )
}

const parseIfExpr = (state: ParseState, startSpan: Span): PR<Expr> =>
    pipe(
        parseExpr(state),
        Either.flatMap(([condition, s1]) =>
            pipe(
                expect(s1, "LeftBrace"),
                Either.flatMap(([, s2]) => parseBlockExpr(s2, currentSpan(s2))),
                Either.flatMap(([thenBlock, s3]) => {
                    if (!check(s3, "Else")) {
                        return Either.right([
                            new IfExpr({ condition, then: thenBlock as BlockExpr, else_: Option.none(), span: startSpan }),
                            s3,
                        ] as [Expr, ParseState])
                    }
                    const [, s4] = advance(s3)
                    if (check(s4, "If")) {
                        const [, s5] = advance(s4)
                        return pipe(
                            parseIfExpr(s5, currentSpan(s5)),
                            Either.map(([elseIfExpr, s6]) => [
                                new IfExpr({ condition, then: thenBlock as BlockExpr, else_: Option.some(elseIfExpr), span: startSpan }),
                                s6,
                            ] as [Expr, ParseState])
                        )
                    }
                    return pipe(
                        expect(s4, "LeftBrace"),
                        Either.flatMap(([, s5]) => parseBlockExpr(s5, currentSpan(s5))),
                        Either.map(([elseBlock, s6]) => [
                            new IfExpr({ condition, then: thenBlock as BlockExpr, else_: Option.some(elseBlock), span: startSpan }),
                            s6,
                        ] as [Expr, ParseState])
                    )
                })
            )
        )
    )

const parseMatchExpr = (state: ParseState, startSpan: Span): PR<Expr> =>
    pipe(
        parseExpr(state),
        Either.flatMap(([scrutinee, s1]) =>
            pipe(
                expect(s1, "LeftBrace"),
                Either.flatMap(([, s2]) => collectMatchArms(s2, [])),
                Either.flatMap(([arms, s3]) =>
                    pipe(
                        expect(s3, "RightBrace"),
                        Either.map(([closeTok, s4]) => [
                            new MatchExpr({ scrutinee, arms, span: spanFrom(startSpan, closeTok.span) }),
                            s4,
                        ] as [Expr, ParseState])
                    )
                )
            )
        )
    )

const collectMatchArms = (
    state: ParseState,
    acc: ReadonlyArray<MatchArm>,
): Either.Either<[ReadonlyArray<MatchArm>, ParseState], ParseError> => {
    if (check(state, "RightBrace", "Eof")) return Either.right([acc, state])
    return pipe(
        parseExpr(state),
        Either.flatMap(([pattern, s1]) =>
            pipe(
                expect(s1, "FatArrow"),
                Either.flatMap(([, s2]) =>
                    pipe(
                        parseExpr(s2),
                        Either.flatMap(([body, s3]) => {
                            const arm = new MatchArm({ pattern, body, span: pattern.span })
                            const s4 = check(s3, "Comma") ? advance(s3)[1] : s3
                            return collectMatchArms(s4, Array.append(acc, arm))
                        })
                    )
                )
            )
        )
    )
}

const parseUnary = (state: ParseState): PR<Expr> => parsePrimary(state)

const parsePostfix = (state: ParseState, expr: Expr): PR<Expr> => {
    if (check(state, "LeftParen")) {
        const [, s1] = advance(state)
        if (check(s1, "RightParen")) {
            const [closeTok, s2] = advance(s1)
            const call = new CallExpr({ callee: expr, args: [], span: spanFrom(expr.span, closeTok.span) })
            return parsePostfix(s2, call)
        }
        return pipe(
            parseExprList(s1, "RightParen"),
            Either.flatMap(([args, s2]) =>
                pipe(
                    expect(s2, "RightParen"),
                    Either.flatMap(([closeTok, s3]) => {
                        const call = new CallExpr({ callee: expr, args, span: spanFrom(expr.span, closeTok.span) })
                        return parsePostfix(s3, call)
                    })
                )
            )
        )
    }
    if (check(state, "LeftBracket")) {
        const [, s1] = advance(state)
        return pipe(
            parseExpr(s1),
            Either.flatMap(([index, s2]) =>
                pipe(
                    expect(s2, "RightBracket"),
                    Either.flatMap(([closeTok, s3]) => {
                        const idx = new IndexExpr({ target: expr, index, span: spanFrom(expr.span, closeTok.span) })
                        return parsePostfix(s3, idx)
                    })
                )
            )
        )
    }
    if (check(state, "Dot")) {
        const [, s1] = advance(state)
        const fieldTok = peek(s1)
        if (fieldTok.kind !== "Identifier") {
            return Either.left(fail("expected field name after '.'", fieldTok.span, state.source))
        }
        const [, s2] = advance(s1)
        const field = new FieldExpr({ target: expr, field: fieldTok.lexeme, span: spanFrom(expr.span, fieldTok.span) })
        return parsePostfix(s2, field)
    }
    return Either.right([expr, state])
}

const parsePower = (state: ParseState): PR<Expr> =>
    pipe(
        parsePrimary(state),
        Either.flatMap(([base, s1]) =>
            pipe(
                parsePostfix(s1, base),
                Either.flatMap(([expr, s2]) => {
                    if (!check(s2, "StarStar")) return Either.right([expr, s2] as [Expr, ParseState])
                    const [, s3] = advance(s2)
                    return pipe(
                        parsePower(s3),
                        Either.map(([right, s4]) => [
                            new BinaryExpr({ op: "**", left: expr, right, span: expr.span }),
                            s4,
                        ] as [Expr, ParseState])
                    )
                })
            )
        )
    )

const parseMul = (state: ParseState): PR<Expr> =>
    pipe(parsePower(state), Either.flatMap(([left, s1]) => collectMul(s1, left)))

const collectMul = (state: ParseState, left: Expr): PR<Expr> => {
    const tok = peek(state)
    if (tok.kind !== "Star" && tok.kind !== "Slash" && tok.kind !== "Percent")
        return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parsePower(s1), Either.flatMap(([right, s2]) =>
        collectMul(s2, new BinaryExpr({ op: tok.lexeme, left, right, span: left.span }))
    ))
}

const parseAdd = (state: ParseState): PR<Expr> =>
    pipe(parseMul(state), Either.flatMap(([left, s1]) => collectAdd(s1, left)))

const collectAdd = (state: ParseState, left: Expr): PR<Expr> => {
    const tok = peek(state)
    if (tok.kind !== "Plus" && tok.kind !== "Minus")
        return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseMul(s1), Either.flatMap(([right, s2]) =>
        collectAdd(s2, new BinaryExpr({ op: tok.lexeme, left, right, span: left.span }))
    ))
}

const parseShift = (state: ParseState): PR<Expr> =>
    pipe(parseAdd(state), Either.flatMap(([left, s1]) => collectShift(s1, left)))

const collectShift = (state: ParseState, left: Expr): PR<Expr> => {
    const tok = peek(state)
    if (tok.kind !== "LessLess" && tok.kind !== "GreaterGreater")
        return Either.right([left, state])
    const [, s1] = advance(state)
    const op = tok.kind === "LessLess" ? "<<" : ">>"
    return pipe(parseAdd(s1), Either.flatMap(([right, s2]) =>
        collectShift(s2, new BinaryExpr({ op, left, right, span: left.span }))
    ))
}

const parseBitAnd = (state: ParseState): PR<Expr> =>
    pipe(parseShift(state), Either.flatMap(([left, s1]) => collectBitAnd(s1, left)))

const collectBitAnd = (state: ParseState, left: Expr): PR<Expr> => {
    if (!check(state, "Ampersand")) return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseShift(s1), Either.flatMap(([right, s2]) =>
        collectBitAnd(s2, new BinaryExpr({ op: "&", left, right, span: left.span }))
    ))
}

const parseBitXor = (state: ParseState): PR<Expr> =>
    pipe(parseBitAnd(state), Either.flatMap(([left, s1]) => collectBitXor(s1, left)))

const collectBitXor = (state: ParseState, left: Expr): PR<Expr> => {
    if (!check(state, "Caret")) return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseBitAnd(s1), Either.flatMap(([right, s2]) =>
        collectBitXor(s2, new BinaryExpr({ op: "^", left, right, span: left.span }))
    ))
}

const parseBitOr = (state: ParseState): PR<Expr> =>
    pipe(parseBitXor(state), Either.flatMap(([left, s1]) => collectBitOr(s1, left)))

const collectBitOr = (state: ParseState, left: Expr): PR<Expr> => {
    if (!check(state, "Pipe")) return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseBitXor(s1), Either.flatMap(([right, s2]) =>
        collectBitOr(s2, new BinaryExpr({ op: "|", left, right, span: left.span }))
    ))
}

const parseRange = (state: ParseState): PR<Expr> =>
    pipe(
        parseBitOr(state),
        Either.flatMap(([left, s1]) => {
            const isDotDot = check(s1, "DotDot")
            const isDotDotEqual = check(s1, "DotDotEqual")
            if (!isDotDot && !isDotDotEqual) return Either.right([left, s1] as [Expr, ParseState])
            const [, s2] = advance(s1)
            return pipe(
                parseBitOr(s2),
                Either.map(([right, s3]) => [
                    new RangeExpr({ from: left, to: right, inclusive: isDotDotEqual, span: left.span }),
                    s3,
                ] as [Expr, ParseState])
            )
        })
    )

const parseCmp = (state: ParseState): PR<Expr> =>
    pipe(parseRange(state), Either.flatMap(([left, s1]) => collectCmp(s1, left)))

const collectCmp = (state: ParseState, left: Expr): PR<Expr> => {
    const tok = peek(state)
    const isCmp =
        tok.kind === "EqualEqual" || tok.kind === "BangEqual" ||
        tok.kind === "Less" || tok.kind === "LessEqual" ||
        tok.kind === "Greater" || tok.kind === "GreaterEqual"
    if (!isCmp) return Either.right([left, state])
    const [, s1] = advance(state)
    const op = Match.value(tok.kind).pipe(
        Match.when("EqualEqual", () => "=="),
        Match.when("BangEqual", () => "!="),
        Match.when("Less", () => "<"),
        Match.when("LessEqual", () => "<="),
        Match.when("Greater", () => ">"),
        Match.when("GreaterEqual", () => ">="),
        Match.orElse(() => tok.lexeme),
    )
    return pipe(parseRange(s1), Either.flatMap(([right, s2]) =>
        collectCmp(s2, new BinaryExpr({ op, left, right, span: left.span }))
    ))
}

const parseLogicAnd = (state: ParseState): PR<Expr> =>
    pipe(parseCmp(state), Either.flatMap(([left, s1]) => collectLogicAnd(s1, left)))

const collectLogicAnd = (state: ParseState, left: Expr): PR<Expr> => {
    if (!check(state, "And")) return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseCmp(s1), Either.flatMap(([right, s2]) =>
        collectLogicAnd(s2, new BinaryExpr({ op: "and", left, right, span: left.span }))
    ))
}

const parseLogicOr = (state: ParseState): PR<Expr> =>
    pipe(parseLogicAnd(state), Either.flatMap(([left, s1]) => collectLogicOr(s1, left)))

const collectLogicOr = (state: ParseState, left: Expr): PR<Expr> => {
    if (!check(state, "Or")) return Either.right([left, state])
    const [, s1] = advance(state)
    return pipe(parseLogicAnd(s1), Either.flatMap(([right, s2]) =>
        collectLogicOr(s2, new BinaryExpr({ op: "or", left, right, span: left.span }))
    ))
}

const parseAssign = (state: ParseState): PR<Expr> =>
    pipe(
        parseLogicOr(state),
        Either.flatMap(([left, s1]) => {
            const tok = peek(s1)
            const isAssign =
                tok.kind === "Equal" || tok.kind === "PlusEqual" ||
                tok.kind === "MinusEqual" || tok.kind === "StarEqual" ||
                tok.kind === "SlashEqual" || tok.kind === "PercentEqual"
            if (!isAssign) return Either.right([left, s1] as [Expr, ParseState])
            const op = Match.value(tok.kind).pipe(
                Match.when("Equal", () => "="),
                Match.when("PlusEqual", () => "+="),
                Match.when("MinusEqual", () => "-="),
                Match.when("StarEqual", () => "*="),
                Match.when("SlashEqual", () => "/="),
                Match.when("PercentEqual", () => "%="),
                Match.orElse(() => tok.lexeme),
            )
            const [, s2] = advance(s1)
            return pipe(
                parseAssign(s2),
                Either.map(([value, s3]) => [
                    new AssignExpr({ target: left, op, value, span: left.span }),
                    s3,
                ] as [Expr, ParseState])
            )
        })
    )

const parseExpr = (state: ParseState): PR<Expr> => parseAssign(state)

const parseStmt = (state: ParseState): Either.Either<[Stmt, ParseState], ParseError> => {
    if (check(state, "Let")) {
        const [, s1] = advance(state)
        const mutable = check(s1, "Mut")
        const s2 = mutable ? advance(s1)[1] : s1
        const nameTok = peek(s2)
        if (nameTok.kind !== "Identifier")
            return Either.left(fail(`expected identifier in 'let', got '${nameTok.kind}'`, nameTok.span, state.source))
        const [, s3] = advance(s2)
        if (!check(s3, "Equal")) {
            const s4 = check(s3, "Semicolon") ? advance(s3)[1] : s3
            return Either.right([new LetStmt({ name: nameTok.lexeme, mutable, value: Option.none(), span: nameTok.span }), s4])
        }
        const [, s4] = advance(s3)
        return pipe(
            parseExpr(s4),
            Either.flatMap(([value, s5]) => {
                const s6 = check(s5, "Semicolon") ? advance(s5)[1] : s5
                return Either.right([
                    new LetStmt({ name: nameTok.lexeme, mutable, value: Option.some(value), span: nameTok.span }),
                    s6,
                ] as [Stmt, ParseState])
            })
        )
    }
    if (check(state, "Return")) {
        const [tok, s1] = advance(state)
        if (check(s1, "Semicolon", "RightBrace", "Eof")) {
            const s2 = check(s1, "Semicolon") ? advance(s1)[1] : s1
            return Either.right([new ReturnStmt({ value: Option.none(), span: tok.span }), s2])
        }
        return pipe(
            parseExpr(s1),
            Either.flatMap(([value, s2]) => {
                const s3 = check(s2, "Semicolon") ? advance(s2)[1] : s2
                return Either.right([new ReturnStmt({ value: Option.some(value), span: tok.span }), s3] as [Stmt, ParseState])
            })
        )
    }
    return pipe(
        parseExpr(state),
        Either.flatMap(([expr, s1]) => {
            const s2 = check(s1, "Semicolon") ? advance(s1)[1] : s1
            return Either.right([new ExprStmt({ expr, span: expr.span }), s2] as [Stmt, ParseState])
        })
    )
}

const parseFnDecl = (state: ParseState, startSpan: Span, exported: boolean): PR<Decl> => {
    const nameTok = peek(state)
    if (nameTok.kind !== "Identifier")
        return Either.left(fail(`expected function name, got '${nameTok.kind}'`, nameTok.span, state.source))
    const [, s1] = advance(state)
    return pipe(
        expect(s1, "LeftParen"),
        Either.flatMap(([, s2]) => collectParams(s2, [])),
        Either.flatMap(([params, s3]) =>
            pipe(
                expect(s3, "RightParen"),
                Either.flatMap(([, s4]) =>
                    pipe(
                        expect(s4, "LeftBrace"),
                        Either.flatMap(([, s5]) => parseBlockExpr(s5, currentSpan(s5))),
                        Either.map(([body, s6]) => [
                            new FnDecl({ name: nameTok.lexeme, params, body: body as BlockExpr, exported, span: startSpan }),
                            s6,
                        ] as [Decl, ParseState])
                    )
                )
            )
        )
    )
}

const collectParams = (state: ParseState, acc: ReadonlyArray<Param>): Either.Either<[ReadonlyArray<Param>, ParseState], ParseError> => {
    if (check(state, "RightParen")) return Either.right([acc, state])
    const tok = peek(state)
    if (tok.kind !== "Identifier")
        return Either.left(fail(`expected parameter name, got '${tok.kind}'`, tok.span, state.source))
    const [, s1] = advance(state)
    const param = new Param({ name: tok.lexeme, span: tok.span })
    if (!check(s1, "Comma")) return Either.right([Array.append(acc, param), s1])
    const [, s2] = advance(s1)
    return collectParams(s2, Array.append(acc, param))
}

const parseStructDecl = (state: ParseState, startSpan: Span): PR<Decl> => {
    const nameTok = peek(state)
    if (nameTok.kind !== "Identifier")
        return Either.left(fail(`expected struct name, got '${nameTok.kind}'`, nameTok.span, state.source))
    const [, s1] = advance(state)
    return pipe(
        expect(s1, "LeftBrace"),
        Either.flatMap(([, s2]) => collectStructFields(s2, [])),
        Either.flatMap(([fields, s3]) =>
            pipe(
                expect(s3, "RightBrace"),
                Either.map(([, s4]) => [
                    new StructDecl({ name: nameTok.lexeme, fields, span: startSpan }),
                    s4,
                ] as [Decl, ParseState])
            )
        )
    )
}

const collectStructFields = (state: ParseState, acc: ReadonlyArray<StructField>): Either.Either<[ReadonlyArray<StructField>, ParseState], ParseError> => {
    if (check(state, "RightBrace")) return Either.right([acc, state])
    const tok = peek(state)
    if (tok.kind !== "Identifier")
        return Either.left(fail(`expected field name, got '${tok.kind}'`, tok.span, state.source))
    const [, s1] = advance(state)
    const field = new StructField({ name: tok.lexeme, span: tok.span })
    if (!check(s1, "Comma")) return Either.right([Array.append(acc, field), s1])
    const [, s2] = advance(s1)
    return collectStructFields(s2, Array.append(acc, field))
}

const parseEnumDecl = (state: ParseState, startSpan: Span): PR<Decl> => {
    const nameTok = peek(state)
    if (nameTok.kind !== "Identifier")
        return Either.left(fail(`expected enum name, got '${nameTok.kind}'`, nameTok.span, state.source))
    const [, s1] = advance(state)
    return pipe(
        expect(s1, "LeftBrace"),
        Either.flatMap(([, s2]) => collectEnumVariants(s2, [])),
        Either.flatMap(([variants, s3]) =>
            pipe(
                expect(s3, "RightBrace"),
                Either.map(([, s4]) => [
                    new EnumDecl({ name: nameTok.lexeme, variants, span: startSpan }),
                    s4,
                ] as [Decl, ParseState])
            )
        )
    )
}

const collectEnumVariants = (state: ParseState, acc: ReadonlyArray<EnumVariant>): Either.Either<[ReadonlyArray<EnumVariant>, ParseState], ParseError> => {
    if (check(state, "RightBrace")) return Either.right([acc, state])
    const tok = peek(state)
    if (tok.kind !== "Identifier")
        return Either.left(fail(`expected variant name, got '${tok.kind}'`, tok.span, state.source))
    const [, s1] = advance(state)
    const variant = new EnumVariant({ name: tok.lexeme, span: tok.span })
    if (!check(s1, "Comma")) return Either.right([Array.append(acc, variant), s1])
    const [, s2] = advance(s1)
    return collectEnumVariants(s2, Array.append(acc, variant))
}

const parseTypeDecl = (state: ParseState, startSpan: Span): PR<Decl> => {
    const nameTok = peek(state)
    if (nameTok.kind !== "Identifier")
        return Either.left(fail(`expected type name, got '${nameTok.kind}'`, nameTok.span, state.source))
    const [, s1] = advance(state)
    return pipe(
        expect(s1, "Equal"),
        Either.flatMap(([, s2]) => {
            const aliasTok = peek(s2)
            if (aliasTok.kind !== "Identifier")
                return Either.left(fail(`expected type alias, got '${aliasTok.kind}'`, aliasTok.span, state.source))
            const [, s3] = advance(s2)
            const s4 = check(s3, "Semicolon") ? advance(s3)[1] : s3
            return Either.right([
                new TypeDecl({ name: nameTok.lexeme, alias: aliasTok.lexeme, span: startSpan }),
                s4,
            ] as [Decl, ParseState])
        })
    )
}

const parseImportDecl = (state: ParseState, startSpan: Span): PR<Decl> => {
    const pathTok = peek(state)
    if (pathTok.kind !== "Identifier")
        return Either.left(fail(`expected module path, got '${pathTok.kind}'`, pathTok.span, state.source))
    const [, s1] = advance(state)
    if (check(s1, "As")) {
        const [, s2] = advance(s1)
        return pipe(
            expect(s2, "Identifier"),
            Either.flatMap(([aliasTok, s3]) => {
                const s4 = check(s3, "Semicolon") ? advance(s3)[1] : s3
                return Either.right([
                    new ImportDecl({ path: pathTok.lexeme, alias: Option.some(aliasTok.lexeme), span: startSpan }),
                    s4,
                ] as [Decl, ParseState])
            })
        )
    }
    const s2 = check(s1, "Semicolon") ? advance(s1)[1] : s1
    return Either.right([
        new ImportDecl({ path: pathTok.lexeme, alias: Option.none(), span: startSpan }),
        s2,
    ] as [Decl, ParseState])
}

const parseDecl = (state: ParseState): PR<TopLevel> => {
    const tok = peek(state)
    const [, s1] = advance(state)
    return Match.value(tok.kind).pipe(
        Match.when("Fn", () => parseFnDecl(s1, tok.span, false)),
        Match.when("Struct", () => parseStructDecl(s1, tok.span)),
        Match.when("Enum", () => parseEnumDecl(s1, tok.span)),
        Match.when("Type", () => parseTypeDecl(s1, tok.span)),
        Match.when("Import", () => parseImportDecl(s1, tok.span)),
        Match.when("Export", () => {
            const inner = peek(s1)
            const [, s2] = advance(s1)
            return Match.value(inner.kind).pipe(
                Match.when("Fn", () => parseFnDecl(s2, inner.span, true)),
                Match.orElse(() => Either.left(fail("only 'fn' can be exported", inner.span, state.source)))
            )
        }),
        Match.orElse(() =>
            pipe(
                parseStmt(state),
                Either.map(([stmt, s2]) => [stmt, s2] as [TopLevel, ParseState])
            )
        )
    )
}

const collectDecls = (state: ParseState, acc: ReadonlyArray<TopLevel>): Either.Either<[ReadonlyArray<TopLevel>, ParseState], ParseError> => {
    if (check(state, "Eof")) return Either.right([acc, state])
    return pipe(
        parseDecl(state),
        Either.flatMap(([decl, s1]) => collectDecls(s1, Array.append(acc, decl)))
    )
}

export const parse = (tokens: ReadonlyArray<import("@/lexer/token").Token>, source: string, file: string): Either.Either<Program, ParseError> => {
    const state = initial(tokens, source, file)
    const eofSpan = tokens.length > 0
        ? tokens[tokens.length - 1]!.span
        : new Span({ file, line: 0, column: 0, length: 1 })
    return pipe(
        collectDecls(state, []),
        Either.map(([decls]) => new Program({ decls, span: eofSpan }))
    )
}
