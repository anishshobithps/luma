import { Array, Either, Match, Option, pipe } from "effect"
import { error } from "@/diagnostic/diagnostic"
import {
    ArrayExpr, AssignExpr, BinaryExpr, BlockExpr, BoolLiteral,
    CallExpr, ExprStmt, FieldExpr, FloatLiteral, Identifier,
    IfExpr, IndexExpr, IntLiteral, LetStmt, MatchArm, MatchExpr,
    NilLiteral, RangeExpr, ReturnStmt, StringLiteral, UnaryExpr,
    type Expr, type Stmt,
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

const parsePrimary = (state: ParseState): PR<Expr> => {
    const tok = peek(state)
    const [, s1] = advance(state)

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
        Match.when("LeftBrace", () => parseBlockExpr(s1, tok.span)),
        Match.orElse(() => Either.left(fail(
            `unexpected token '${tok.kind}'`,
            tok.span,
            state.source,
        )))
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

const collectMatchArms = (state: ParseState, acc: ReadonlyArray<MatchArm>): Either.Either<[ReadonlyArray<MatchArm>, ParseState], ParseError> => {
    if (check(state, "RightBrace", "Eof")) return Either.right([acc, state])
    return pipe(
        parseExpr(state),
        Either.flatMap(([pattern, s1]) =>
            pipe(
                expect(s1, "FatArrow"),
                Either.flatMap(([, s2]) => parseExpr(s2)),
                Either.flatMap(([body, s3]) => {
                    const arm = new MatchArm({ pattern, body, span: pattern.span })
                    const s4 = check(s3, "Comma") ? advance(s3)[1] : s3
                    return collectMatchArms(s4, Array.append(acc, arm))
                })
            )
        )
    )
}

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

const parseUnary = (state: ParseState): PR<Expr> => {
    const tok = peek(state)
    if (check(state, "Minus", "Bang", "Not", "Tilde")) {
        const [, s1] = advance(state)
        return pipe(
            parseUnary(s1),
            Either.map(([operand, s2]) => [
                new UnaryExpr({ op: tok.lexeme, operand, span: spanFrom(tok.span, operand.span) }),
                s2,
            ] as [Expr, ParseState])
        )
    }
    return pipe(
        parsePrimary(state),
        Either.flatMap(([expr, s1]) => parsePostfix(s1, expr))
    )
}

type Precedence = number

const PREC: ReadonlyMap<string, Precedence> = new Map([
    ["PipePipe", 1],
    ["Or", 1],
    ["AmpersandAmpersand", 2],
    ["And", 2],
    ["EqualEqual", 3],
    ["BangEqual", 3],
    ["Less", 4],
    ["LessEqual", 4],
    ["Greater", 4],
    ["GreaterEqual", 4],
    ["Pipe", 5],
    ["Caret", 6],
    ["Ampersand", 7],
    ["LessLess", 8],
    ["GreaterGreater", 8],
    ["Plus", 9],
    ["Minus", 9],
    ["Star", 10],
    ["Slash", 10],
    ["Percent", 10],
    ["StarStar", 11],
])

const precedenceOf = (kind: string): number =>
    Option.getOrElse(Option.fromNullable(PREC.get(kind)), () => 0)

const parseBinary = (state: ParseState, left: Expr, minPrec: Precedence): PR<Expr> => {
    const tok = peek(state)
    const prec = precedenceOf(tok.kind)
    if (prec <= minPrec) return Either.right([left, state])
    const [, s1] = advance(state)
    const nextMinPrec = tok.kind === "StarStar" ? prec - 1 : prec
    return pipe(
        parseUnary(s1),
        Either.flatMap(([right, s2]) =>
            pipe(
                parseBinary(s2, right, nextMinPrec),
                Either.flatMap(([finalRight, s3]) => {
                    const bin = new BinaryExpr({ op: tok.lexeme, left, right: finalRight, span: spanFrom(left.span, finalRight.span) })
                    return parseBinary(s3, bin, minPrec)
                })
            )
        )
    )
}

const ASSIGN_OPS: ReadonlySet<string> = new Set([
    "Equal", "PlusEqual", "MinusEqual", "StarEqual", "SlashEqual", "PercentEqual",
])

const parseExpr = (state: ParseState): PR<Expr> =>
    pipe(
        parseUnary(state),
        Either.flatMap(([left, s1]) =>
            pipe(
                parseBinary(s1, left, 0),
                Either.flatMap(([expr, s2]) => {
                    if (check(s2, "DotDot", "DotDotEqual")) {
                        const rangeTok = peek(s2)
                        const [, s3] = advance(s2)
                        return pipe(
                            parseUnary(s3),
                            Either.flatMap(([right, s4]) =>
                                pipe(
                                    parseBinary(s4, right, 0),
                                    Either.map(([finalRight, s5]) => [
                                        new RangeExpr({
                                            from: expr,
                                            to: finalRight,
                                            inclusive: rangeTok.kind === "DotDotEqual",
                                            span: spanFrom(expr.span, finalRight.span),
                                        }),
                                        s5,
                                    ] as [Expr, ParseState])
                                )
                            )
                        )
                    }
                    const assignTok = peek(s2)
                    if (ASSIGN_OPS.has(assignTok.kind)) {
                        const [, s3] = advance(s2)
                        return pipe(
                            parseExpr(s3),
                            Either.map(([value, s4]) => [
                                new AssignExpr({ target: expr, op: assignTok.lexeme, value, span: spanFrom(expr.span, value.span) }),
                                s4,
                            ] as [Expr, ParseState])
                        )
                    }
                    return Either.right([expr, s2])
                })
            )
        )
    )

const parseLetStmt = (state: ParseState, startSpan: Span): PR<Stmt> => {
    const mutable = check(state, "Mut")
    const s1 = mutable ? advance(state)[1] : state
    const nameTok = peek(s1)
    if (nameTok.kind !== "Identifier") {
        return Either.left(fail("expected variable name", nameTok.span, state.source))
    }
    const [, s2] = advance(s1)
    if (check(s2, "Semicolon", "RightBrace", "Eof")) {
        const s3 = check(s2, "Semicolon") ? advance(s2)[1] : s2
        return Either.right([new LetStmt({ name: nameTok.lexeme, mutable, value: Option.none(), span: startSpan }), s3])
    }
    return pipe(
        expect(s2, "Equal"),
        Either.flatMap(([, s3]) => parseExpr(s3)),
        Either.flatMap(([value, s4]) => {
            const s5 = check(s4, "Semicolon") ? advance(s4)[1] : s4
            return Either.right([new LetStmt({ name: nameTok.lexeme, mutable, value: Option.some(value), span: startSpan }), s5])
        })
    )
}

const parseReturnStmt = (state: ParseState, startSpan: Span): PR<Stmt> => {
    if (check(state, "Semicolon", "RightBrace", "Eof")) {
        const s1 = check(state, "Semicolon") ? advance(state)[1] : state
        return Either.right([new ReturnStmt({ value: Option.none(), span: startSpan }), s1])
    }
    return pipe(
        parseExpr(state),
        Either.flatMap(([value, s1]) => {
            const s2 = check(s1, "Semicolon") ? advance(s1)[1] : s1
            return Either.right([new ReturnStmt({ value: Option.some(value), span: startSpan }), s2])
        })
    )
}

const parseStmt = (state: ParseState): PR<Stmt> => {
    const tok = peek(state)
    const [, s1] = advance(state)
    return Match.value(tok.kind).pipe(
        Match.when("Let", () => parseLetStmt(s1, tok.span)),
        Match.when("Return", () => parseReturnStmt(s1, tok.span)),
        Match.orElse(() =>
            pipe(
                parseExpr(state),
                Either.flatMap(([expr, s2]) => {
                    const s3 = check(s2, "Semicolon") ? advance(s2)[1] : s2
                    return Either.right([new ExprStmt({ expr, span: expr.span }), s3] as [Stmt, ParseState])
                })
            )
        )
    )
}

const parseParams = (state: ParseState): Either.Either<[ReadonlyArray<Param>, ParseState], ParseError> => {
    if (check(state, "RightParen")) return Either.right([[], state])
    return pipe(
        collectParams(state, []),
    )
}

const collectParams = (state: ParseState, acc: ReadonlyArray<Param>): Either.Either<[ReadonlyArray<Param>, ParseState], ParseError> => {
    const nameTok = peek(state)
    if (nameTok.kind !== "Identifier") {
        return Either.left(fail("expected parameter name", nameTok.span, state.source))
    }
    const [, s1] = advance(state)
    const param = new Param({ name: nameTok.lexeme, span: nameTok.span })
    if (!check(s1, "Comma")) return Either.right([Array.append(acc, param), s1])
    const [, s2] = advance(s1)
    return collectParams(s2, Array.append(acc, param))
}

const parseFnDecl = (state: ParseState, startSpan: Span, exported: boolean): PR<Decl> =>
    pipe(
        expect(state, "Identifier"),
        Either.flatMap(([nameTok, s1]) =>
            pipe(
                expect(s1, "LeftParen"),
                Either.flatMap(([, s2]) => parseParams(s2)),
                Either.flatMap(([params, s3]) =>
                    pipe(
                        expect(s3, "RightParen"),
                        Either.flatMap(([, s4]) => expect(s4, "LeftBrace")),
                        Either.flatMap(([, s5]) => parseBlockExpr(s5, currentSpan(s5))),
                        Either.map(([body, s6]) => [
                            new FnDecl({
                                name: nameTok.lexeme,
                                params,
                                body: body as BlockExpr,
                                exported,
                                span: startSpan,
                            }),
                            s6,
                        ] as [Decl, ParseState])
                    )
                )
            )
        )
    )

const parseStructDecl = (state: ParseState, startSpan: Span): PR<Decl> =>
    pipe(
        expect(state, "Identifier"),
        Either.flatMap(([nameTok, s1]) =>
            pipe(
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
        )
    )

const collectStructFields = (state: ParseState, acc: ReadonlyArray<StructField>): Either.Either<[ReadonlyArray<StructField>, ParseState], ParseError> => {
    if (check(state, "RightBrace", "Eof")) return Either.right([acc, state])
    const tok = peek(state)
    if (tok.kind !== "Identifier") {
        return Either.left(fail("expected field name", tok.span, state.source))
    }
    const [, s1] = advance(state)
    const field = new StructField({ name: tok.lexeme, span: tok.span })
    const s2 = check(s1, "Comma") ? advance(s1)[1] : s1
    return collectStructFields(s2, Array.append(acc, field))
}

const parseEnumDecl = (state: ParseState, startSpan: Span): PR<Decl> =>
    pipe(
        expect(state, "Identifier"),
        Either.flatMap(([nameTok, s1]) =>
            pipe(
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
        )
    )

const collectEnumVariants = (state: ParseState, acc: ReadonlyArray<EnumVariant>): Either.Either<[ReadonlyArray<EnumVariant>, ParseState], ParseError> => {
    if (check(state, "RightBrace", "Eof")) return Either.right([acc, state])
    const tok = peek(state)
    if (tok.kind !== "Identifier") {
        return Either.left(fail("expected variant name", tok.span, state.source))
    }
    const [, s1] = advance(state)
    const variant = new EnumVariant({ name: tok.lexeme, span: tok.span })
    const s2 = check(s1, "Comma") ? advance(s1)[1] : s1
    return collectEnumVariants(s2, Array.append(acc, variant))
}

const parseTypeDecl = (state: ParseState, startSpan: Span): PR<Decl> =>
    pipe(
        expect(state, "Identifier"),
        Either.flatMap(([nameTok, s1]) =>
            pipe(
                expect(s1, "Equal"),
                Either.flatMap(([, s2]) => expect(s2, "Identifier")),
                Either.flatMap(([aliasTok, s3]) => {
                    const s4 = check(s3, "Semicolon") ? advance(s3)[1] : s3
                    return Either.right([
                        new TypeDecl({ name: nameTok.lexeme, alias: aliasTok.lexeme, span: startSpan }),
                        s4,
                    ] as [Decl, ParseState])
                })
            )
        )
    )

const parseImportDecl = (state: ParseState, startSpan: Span): PR<Decl> =>
    pipe(
        expect(state, "Identifier"),
        Either.flatMap(([pathTok, s1]) => {
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
        })
    )

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
