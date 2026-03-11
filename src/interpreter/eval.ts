import { Either, Match, Option, pipe } from "effect"
import {
    BlockExpr,
    type Expr, type MatchArm, type Stmt,
} from "@/ast/expr"
import { type TopLevel } from "@/ast/decl"
import { makeEnv } from "@/interpreter/env"
import {
    Bool, EnumVariantVal, Fn, Float, Int, LumaArray, NativeFn, Nil, Range,
    Str, StructVal, display, isTruthy, lumaEquals,
    type Env, type LumaValue,
} from "@/interpreter/value"
import { error } from "@/diagnostic/diagnostic"
import { Span } from "@/diagnostic/span"
import { RuntimeError } from "@/error/runtime"

type EvalError = RuntimeError
type EvalResult = Either.Either<Signal, EvalError>
type ValueResult = Either.Either<LumaValue, EvalError>

const dummySpan = new Span({ file: "<eval>", line: 0, column: 0, length: 1 })

const runtimeError = (kind: RuntimeError["kind"], msg: string): EvalError =>
    new RuntimeError({ kind, diagnostic: error(msg, dummySpan), source: "", callStack: [] })

type Signal =
    | { readonly _tag: "Value"; readonly value: LumaValue }
    | { readonly _tag: "Return"; readonly value: LumaValue }
    | { readonly _tag: "Break" }
    | { readonly _tag: "Continue" }

const val = (v: LumaValue): Signal => ({ _tag: "Value", value: v })
const ret = (v: LumaValue): Signal => ({ _tag: "Return", value: v })
const brk: Signal = { _tag: "Break" }
const cont: Signal = { _tag: "Continue" }

const evalBinary = (op: string, left: LumaValue, right: LumaValue): ValueResult => {
    if (op === "==") return Either.right(Bool(lumaEquals(left, right)))
    if (op === "!=") return Either.right(Bool(!lumaEquals(left, right)))
    if (op === "and") return Either.right(Bool(isTruthy(left) && isTruthy(right)))
    if (op === "or") return Either.right(Bool(isTruthy(left) || isTruthy(right)))
    if (op === "+" && left._tag === "Str" && right._tag === "Str") return Either.right(Str(left.value + right.value))

    if (left._tag === "Int" && right._tag === "Int") {
        if (op === "+") return Either.right(Int(left.value + right.value))
        if (op === "-") return Either.right(Int(left.value - right.value))
        if (op === "*") return Either.right(Int(left.value * right.value))
        if (op === "**") return Either.right(Int(left.value ** right.value))
        if (op === "%") return Either.right(Int(left.value % right.value))
        if (op === "&") return Either.right(Int(left.value & right.value))
        if (op === "|") return Either.right(Int(left.value | right.value))
        if (op === "^") return Either.right(Int(left.value ^ right.value))
        if (op === "<<") return Either.right(Int(left.value << right.value))
        if (op === ">>") return Either.right(Int(left.value >> right.value))
        if (op === "<") return Either.right(Bool(left.value < right.value))
        if (op === "<=") return Either.right(Bool(left.value <= right.value))
        if (op === ">") return Either.right(Bool(left.value > right.value))
        if (op === ">=") return Either.right(Bool(left.value >= right.value))
        if (op === "/") {
            if (right.value === 0n) return Either.left(runtimeError("DivisionByZero", "division by zero"))
            return Either.right(Int(left.value / right.value))
        }
    }

    const lf = left._tag === "Float" ? left.value : left._tag === "Int" ? Number(left.value) : null
    const rf = right._tag === "Float" ? right.value : right._tag === "Int" ? Number(right.value) : null

    if (lf !== null && rf !== null) {
        if (op === "+") return Either.right(Float(lf + rf))
        if (op === "-") return Either.right(Float(lf - rf))
        if (op === "*") return Either.right(Float(lf * rf))
        if (op === "**") return Either.right(Float(lf ** rf))
        if (op === "%") return Either.right(Float(lf % rf))
        if (op === "<") return Either.right(Bool(lf < rf))
        if (op === "<=") return Either.right(Bool(lf <= rf))
        if (op === ">") return Either.right(Bool(lf > rf))
        if (op === ">=") return Either.right(Bool(lf >= rf))
        if (op === "/") {
            if (rf === 0) return Either.left(runtimeError("DivisionByZero", "division by zero"))
            return Either.right(Float(lf / rf))
        }
    }

    return Either.left(runtimeError("TypeMismatch", `operator '${op}' not supported for ${left._tag} and ${right._tag}`))
}

const collectExprList = (
    exprs: ReadonlyArray<Expr>,
    i: number,
    acc: ReadonlyArray<LumaValue>,
    env: Env,
): Either.Either<ReadonlyArray<LumaValue>, EvalError> => {
    if (i >= exprs.length) return Either.right(acc)
    return pipe(
        evalExpr(exprs[i]!, env),
        Either.flatMap((s) => {
            if (s._tag !== "Value") return Either.left(runtimeError("TypeMismatch", "expression in list produced a control signal"))
            return collectExprList(exprs, i + 1, [...acc, s.value], env)
        })
    )
}

const evalExprList = (exprs: ReadonlyArray<Expr>, env: Env): Either.Either<ReadonlyArray<LumaValue>, EvalError> =>
    collectExprList(exprs, 0, [], env)

const runStmts = (stmts: ReadonlyArray<Stmt>, i: number, env: Env): EvalResult => {
    if (i >= stmts.length) return Either.right(val(Nil))
    return pipe(
        evalStmt(stmts[i]!, env),
        Either.flatMap((s) => {
            if (s._tag !== "Value") return Either.right(s)
            if (i === stmts.length - 1) return Either.right(s)
            return runStmts(stmts, i + 1, env)
        })
    )
}

const evalBlock = (block: BlockExpr, env: Env): EvalResult =>
    runStmts(block.stmts, 0, env)

const evalWhile = (condition: Expr, body: BlockExpr, env: Env): EvalResult => {
    const step = (): EvalResult =>
        pipe(
            evalExpr(condition, env),
            Either.flatMap((cs) => {
                if (cs._tag !== "Value") return Either.right(cs)
                if (!isTruthy(cs.value)) return Either.right(val(Nil))
                return pipe(
                    evalBlock(body, env.child()),
                    Either.flatMap((bs) => {
                        if (bs._tag === "Return") return Either.right(bs)
                        if (bs._tag === "Break") return Either.right(val(Nil))
                        return step()
                    })
                )
            })
        )
    return step()
}

const runForArray = (
    variable: string,
    elements: ReadonlyArray<LumaValue>,
    i: number,
    body: BlockExpr,
    env: Env,
): EvalResult => {
    if (i >= elements.length) return Either.right(val(Nil))
    const loopEnv = env.child()
    loopEnv.set(variable, elements[i]!)
    return pipe(
        evalBlock(body, loopEnv),
        Either.flatMap((bs) => {
            if (bs._tag === "Return") return Either.right(bs)
            if (bs._tag === "Break") return Either.right(val(Nil))
            return runForArray(variable, elements, i + 1, body, env)
        })
    )
}

const evalForRange = (
    variable: string,
    from: bigint,
    to: bigint,
    inclusive: boolean,
    body: BlockExpr,
    env: Env,
): EvalResult => {
    const end = inclusive ? to + 1n : to
    const step = (i: bigint): EvalResult => {
        if (i >= end) return Either.right(val(Nil))
        const loopEnv = env.child()
        loopEnv.set(variable, Int(i))
        return pipe(
            evalBlock(body, loopEnv),
            Either.flatMap((bs) => {
                if (bs._tag === "Return") return Either.right(bs)
                if (bs._tag === "Break") return Either.right(val(Nil))
                return step(i + 1n)
            })
        )
    }
    return step(from)
}

const matchesPattern = (v: LumaValue, pattern: Expr): boolean => {
    if (pattern._tag === "Identifier" && pattern.name === "_") return true
    if (pattern._tag === "NilLiteral") return v._tag === "Nil"
    if (pattern._tag === "BoolLiteral") return v._tag === "Bool" && v.value === pattern.value
    if (pattern._tag === "IntLiteral") return v._tag === "Int" && v.value === pattern.value
    if (pattern._tag === "FloatLiteral") return v._tag === "Float" && v.value === pattern.value
    if (pattern._tag === "StringLiteral") return v._tag === "Str" && v.value === pattern.value
    return false
}

const evalMatchArms = (
    scrutinee: LumaValue,
    arms: ReadonlyArray<MatchArm>,
    env: Env,
): EvalResult => {
    const arm = arms.find((a) => matchesPattern(scrutinee, a.pattern))
    if (arm === undefined) return Either.right(val(Nil))
    return evalExpr(arm.body, env)
}

const evalInterpParts = (
    parts: ReadonlyArray<Expr>,
    i: number,
    acc: string,
    env: Env,
): EvalResult => {
    if (i >= parts.length) return Either.right(val(Str(acc)))
    return pipe(
        evalExpr(parts[i]!, env),
        Either.flatMap((s) => {
            if (s._tag !== "Value") return Either.right(s)
            return evalInterpParts(parts, i + 1, acc + display(s.value), env)
        })
    )
}

const evalExpr = (expr: Expr, env: Env): EvalResult => {
    if (expr._tag === "IntLiteral") return Either.right(val(Int(expr.value)))
    if (expr._tag === "FloatLiteral") return Either.right(val(Float(expr.value)))
    if (expr._tag === "StringLiteral") return Either.right(val(Str(expr.value)))
    if (expr._tag === "InterpExpr") return evalInterpParts(expr.parts, 0, "", env)
    if (expr._tag === "BoolLiteral") return Either.right(val(Bool(expr.value)))
    if (expr._tag === "NilLiteral") return Either.right(val(Nil))
    if (expr._tag === "BreakExpr") return Either.right(brk)
    if (expr._tag === "ContinueExpr") return Either.right(cont)

    if (expr._tag === "Identifier")
        return Option.match(env.get(expr.name), {
            onNone: () => Either.left(runtimeError("NilDereference", `undefined variable '${expr.name}'`)),
            onSome: (v) => Either.right(val(v)),
        })

    if (expr._tag === "BlockExpr") return evalBlock(expr, env.child())
    if (expr._tag === "WhileExpr") return evalWhile(expr.condition, expr.body, env)

    if (expr._tag === "BinaryExpr")
        return pipe(
            evalExpr(expr.left, env),
            Either.flatMap((ls) => {
                if (ls._tag !== "Value") return Either.right(ls)
                return pipe(
                    evalExpr(expr.right, env),
                    Either.flatMap((rs) => {
                        if (rs._tag !== "Value") return Either.right(rs)
                        return pipe(evalBinary(expr.op, ls.value, rs.value), Either.map(val))
                    })
                )
            })
        )

    if (expr._tag === "UnaryExpr")
        return pipe(
            evalExpr(expr.operand, env),
            Either.flatMap((s) => {
                if (s._tag !== "Value") return Either.right(s)
                const v = s.value
                if (expr.op === "-" && v._tag === "Int") return Either.right(val(Int(-v.value)))
                if (expr.op === "-" && v._tag === "Float") return Either.right(val(Float(-v.value)))
                if (expr.op === "not" || expr.op === "!") return Either.right(val(Bool(!isTruthy(v))))
                if (expr.op === "~" && v._tag === "Int") return Either.right(val(Int(~v.value)))
                return Either.left(runtimeError("TypeMismatch", `unary '${expr.op}' not supported for ${v._tag}`))
            })
        )

    if (expr._tag === "RangeExpr")
        return pipe(
            evalExpr(expr.from, env),
            Either.flatMap((fs) => {
                if (fs._tag !== "Value") return Either.right(fs)
                return pipe(
                    evalExpr(expr.to, env),
                    Either.flatMap((ts) => {
                        if (ts._tag !== "Value") return Either.right(ts)
                        if (fs.value._tag !== "Int" || ts.value._tag !== "Int")
                            return Either.left(runtimeError("TypeMismatch", "range bounds must be integers"))
                        return Either.right(val(Range(fs.value.value, ts.value.value, expr.inclusive)))
                    })
                )
            })
        )

    if (expr._tag === "ArrayExpr")
        return pipe(evalExprList(expr.elements, env), Either.map((vs) => val(LumaArray(vs))))

    if (expr._tag === "IfExpr")
        return pipe(
            evalExpr(expr.condition, env),
            Either.flatMap((cs) => {
                if (cs._tag !== "Value") return Either.right(cs)
                if (isTruthy(cs.value)) return evalBlock(expr.then, env.child())
                return Option.match(expr.else_, {
                    onNone: () => Either.right(val(Nil)),
                    onSome: (e) => evalExpr(e, env),
                })
            })
        )

    if (expr._tag === "MatchExpr")
        return pipe(
            evalExpr(expr.scrutinee, env),
            Either.flatMap((ss) => {
                if (ss._tag !== "Value") return Either.right(ss)
                return evalMatchArms(ss.value, expr.arms, env)
            })
        )

    if (expr._tag === "ForExpr")
        return pipe(
            evalExpr(expr.iterable, env),
            Either.flatMap((is) => {
                if (is._tag !== "Value") return Either.right(is)
                const it = is.value
                if (it._tag === "Array") return runForArray(expr.variable, it.elements, 0, expr.body, env)
                if (it._tag === "Range") return evalForRange(expr.variable, it.from, it.to, it.inclusive, expr.body, env)
                return Either.left(runtimeError("TypeMismatch", `'${display(it)}' is not iterable`))
            })
        )

    if (expr._tag === "CallExpr")
        return pipe(
            evalExpr(expr.callee, env),
            Either.flatMap((cs) => {
                if (cs._tag !== "Value") return Either.right(cs)
                const fn = cs.value
                if (fn._tag === "NativeFn")
                    return pipe(
                        evalExprList(expr.args, env),
                        Either.flatMap((argVals) => {
                            if (fn.arity !== -1 && argVals.length !== fn.arity)
                                return Either.left(runtimeError("TypeMismatch", `expected ${fn.arity} args, got ${argVals.length}`))
                            return Either.right(val(fn.call(argVals)))
                        })
                    )
                if (fn._tag === "Fn")
                    return pipe(
                        evalExprList(expr.args, env),
                        Either.flatMap((argVals) => {
                            if (argVals.length !== fn.params.length)
                                return Either.left(runtimeError("TypeMismatch", `expected ${fn.params.length} args, got ${argVals.length}`))
                            const callEnv = fn.closure.child()
                            fn.params.forEach((p, i) => callEnv.set(p, argVals[i]!))
                            return pipe(
                                evalBlock(fn.body, callEnv),
                                Either.map((s) => {
                                    if (s._tag === "Return") return val(s.value)
                                    if (s._tag === "Value") return val(s.value)
                                    return val(Nil)
                                })
                            )
                        })
                    )
                return Either.left(runtimeError("TypeMismatch", `'${display(fn)}' is not callable`))
            })
        )

    if (expr._tag === "IndexExpr")
        return pipe(
            evalExpr(expr.target, env),
            Either.flatMap((ts) => {
                if (ts._tag !== "Value") return Either.right(ts)
                return pipe(
                    evalExpr(expr.index, env),
                    Either.flatMap((is) => {
                        if (is._tag !== "Value") return Either.right(is)
                        if (ts.value._tag === "Array" && is.value._tag === "Int") {
                            const idx = Number(is.value.value)
                            const el = ts.value.elements[idx < 0 ? ts.value.elements.length + idx : idx]
                            if (el === undefined)
                                return Either.left(runtimeError("OutOfBounds", `index ${idx} out of bounds`))
                            return Either.right(val(el))
                        }
                        return Either.left(runtimeError("TypeMismatch", "index target must be an array with an integer index"))
                    })
                )
            })
        )

    if (expr._tag === "FieldExpr")
        return pipe(
            evalExpr(expr.target, env),
            Either.flatMap((ts) => {
                if (ts._tag !== "Value") return Either.right(ts)
                if (ts.value._tag === "Struct") {
                    const f = ts.value.fields[expr.field]
                    if (f === undefined)
                        return Either.left(runtimeError("NilDereference", `field '${expr.field}' not found on struct`))
                    return Either.right(val(f))
                }
                return Either.right(val(Nil))
            })
        )

    if (expr._tag === "AssignExpr")
        return pipe(
            evalExpr(expr.value, env),
            Either.flatMap((rs) => {
                if (rs._tag !== "Value") return Either.right(rs)
                if (expr.target._tag !== "Identifier")
                    return Either.left(runtimeError("TypeMismatch", "assignment target must be an identifier"))
                const name = expr.target.name
                if (expr.op === "=") {
                    if (!env.assign(name, rs.value))
                        return Either.left(runtimeError("NilDereference", `undefined variable '${name}'`))
                    return Either.right(val(rs.value))
                }
                return Option.match(env.get(name), {
                    onNone: () => Either.left(runtimeError("NilDereference", `undefined variable '${name}'`)),
                    onSome: (current) =>
                        pipe(
                            evalBinary(expr.op.slice(0, -1), current, rs.value),
                            Either.flatMap((newVal) => {
                                env.assign(name, newVal)
                                return Either.right(val(newVal))
                            })
                        ),
                })
            })
        )

    return Either.left(runtimeError("TypeMismatch", `unknown expression type`))
}

const evalStmt = (stmt: Stmt, env: Env): EvalResult =>
    Match.value(stmt).pipe(
        Match.tag("LetStmt", ({ name, value: init }) =>
            Option.match(init, {
                onNone: () => {
                    env.set(name, Nil)
                    return Either.right(val(Nil))
                },
                onSome: (expr) =>
                    pipe(
                        evalExpr(expr, env),
                        Either.flatMap((s) => {
                            if (s._tag !== "Value") return Either.right(s)
                            env.set(name, s.value)
                            return Either.right(val(s.value))
                        })
                    ),
            })
        ),
        Match.tag("ReturnStmt", ({ value: v }) =>
            Option.match(v, {
                onNone: () => Either.right(ret(Nil)),
                onSome: (expr) =>
                    pipe(
                        evalExpr(expr, env),
                        Either.map((s) => (s._tag === "Value" ? ret(s.value) : s))
                    ),
            })
        ),
        Match.tag("ExprStmt", ({ expr }) => evalExpr(expr, env)),
        Match.exhaustive,
    )

const evalTopLevel = (tl: TopLevel, env: Env): EvalResult =>
    Match.value(tl).pipe(
        Match.tag("FnDecl", ({ name, params, body }) => {
            env.set(name, Fn(params.map((p) => p.name), body, env))
            return Either.right(val(Nil))
        }),
        Match.tag("StructDecl", ({ name, fields }) => {
            const fieldNames = fields.map((f) => f.name)
            env.set(name, NativeFn(fieldNames.length, (args) => {
                const record: Record<string, LumaValue> = {}
                fieldNames.forEach((fname, i) => { record[fname] = args[i] ?? Nil })
                return StructVal(name, record)
            }))
            return Either.right(val(Nil))
        }),
        Match.tag("EnumDecl", ({ name, variants }) => {
            variants.forEach((v) => env.set(`${name}_${v.name}`, EnumVariantVal(name, v.name)))
            return Either.right(val(Nil))
        }),
        Match.tag("TypeDecl", () => Either.right(val(Nil))),
        Match.tag("ImportDecl", () => Either.right(val(Nil))),
        Match.tag("LetStmt", (stmt) => evalStmt(stmt, env)),
        Match.tag("ReturnStmt", (stmt) => evalStmt(stmt, env)),
        Match.tag("ExprStmt", (stmt) => evalStmt(stmt, env)),
        Match.exhaustive,
    )

const makeStdEnv = (): Env => {
    const env = makeEnv()
    env.set("print", NativeFn(1, (args) => { console.log(display(args[0] ?? Nil)); return Nil }))
    env.set("println", NativeFn(1, (args) => { console.log(display(args[0] ?? Nil)); return Nil }))
    env.set("len", NativeFn(1, (args) => {
        const a = args[0] ?? Nil
        if (a._tag === "Array") return Int(BigInt(a.elements.length))
        if (a._tag === "Str") return Int(BigInt(a.value.length))
        if (a._tag === "Range") {
            const size = a.inclusive ? a.to - a.from + 1n : a.to - a.from
            return Int(size < 0n ? 0n : size)
        }
        return Int(0n)
    }))
    env.set("str", NativeFn(1, (args) => Str(display(args[0] ?? Nil))))
    env.set("int", NativeFn(1, (args) => {
        const a = args[0] ?? Nil
        if (a._tag === "Int") return a
        if (a._tag === "Float") return Int(BigInt(Math.trunc(a.value)))
        if (a._tag === "Str") {
            const n = parseInt(a.value, 10)
            return isNaN(n) ? Nil : Int(BigInt(n))
        }
        return Nil
    }))
    return env
}

export type InterpretResult = {
    readonly value: LumaValue
    readonly env: Env
}

export const interpret = (
    program: import("@/ast/decl").Program,
): Either.Either<InterpretResult, EvalError> => {
    const env = makeStdEnv()
    return pipe(
        runTopLevels(program.decls, 0, env),
        Either.map((s) => ({
            value: s._tag === "Value" ? s.value : s._tag === "Return" ? s.value : Nil,
            env,
        }))
    )
}

const runTopLevels = (
    decls: ReadonlyArray<TopLevel>,
    i: number,
    env: Env,
): EvalResult => {
    if (i >= decls.length) return Either.right(val(Nil))
    return pipe(
        evalTopLevel(decls[i]!, env),
        Either.flatMap((s) => {
            if (s._tag === "Return") return Either.right(s)
            if (i === decls.length - 1) return Either.right(s)
            return runTopLevels(decls, i + 1, env)
        })
    )
}
