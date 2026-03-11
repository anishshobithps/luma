import { Schema } from "effect"
import { Span } from "@/diagnostic/span"

export type Expr =
    | IntLiteral
    | FloatLiteral
    | StringLiteral
    | InterpExpr
    | BoolLiteral
    | NilLiteral
    | Identifier
    | BinaryExpr
    | UnaryExpr
    | CallExpr
    | IndexExpr
    | FieldExpr
    | AssignExpr
    | RangeExpr
    | ArrayExpr
    | BlockExpr
    | IfExpr
    | MatchExpr
    | WhileExpr
    | ForExpr
    | BreakExpr
    | ContinueExpr

export type Stmt =
    | LetStmt
    | ReturnStmt
    | ExprStmt

const exprS = (): Schema.Schema<Expr, any> => ExprSchema
const stmtS = (): Schema.Schema<Stmt, any> => StmtSchema
const blockS = (): Schema.Schema<BlockExpr, any> => BlockExpr
const matchArmS = (): Schema.Schema<MatchArm, any> => MatchArm

export class IntLiteral extends Schema.TaggedClass<IntLiteral>()("IntLiteral", {
    value: Schema.BigInt,
    span: Schema.instanceOf(Span),
}) { }

export class FloatLiteral extends Schema.TaggedClass<FloatLiteral>()("FloatLiteral", {
    value: Schema.Number,
    span: Schema.instanceOf(Span),
}) { }

export class StringLiteral extends Schema.TaggedClass<StringLiteral>()("StringLiteral", {
    value: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class InterpExpr extends Schema.TaggedClass<InterpExpr>()("InterpExpr", {
    parts: Schema.Array(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class BoolLiteral extends Schema.TaggedClass<BoolLiteral>()("BoolLiteral", {
    value: Schema.Boolean,
    span: Schema.instanceOf(Span),
}) { }

export class NilLiteral extends Schema.TaggedClass<NilLiteral>()("NilLiteral", {
    span: Schema.instanceOf(Span),
}) { }

export class Identifier extends Schema.TaggedClass<Identifier>()("Identifier", {
    name: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class BinaryExpr extends Schema.TaggedClass<BinaryExpr>()("BinaryExpr", {
    op: Schema.String,
    left: Schema.suspend(exprS),
    right: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export class UnaryExpr extends Schema.TaggedClass<UnaryExpr>()("UnaryExpr", {
    op: Schema.String,
    operand: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export class CallExpr extends Schema.TaggedClass<CallExpr>()("CallExpr", {
    callee: Schema.suspend(exprS),
    args: Schema.Array(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class IndexExpr extends Schema.TaggedClass<IndexExpr>()("IndexExpr", {
    target: Schema.suspend(exprS),
    index: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export class FieldExpr extends Schema.TaggedClass<FieldExpr>()("FieldExpr", {
    target: Schema.suspend(exprS),
    field: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class AssignExpr extends Schema.TaggedClass<AssignExpr>()("AssignExpr", {
    target: Schema.suspend(exprS),
    op: Schema.String,
    value: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export class RangeExpr extends Schema.TaggedClass<RangeExpr>()("RangeExpr", {
    from: Schema.suspend(exprS),
    to: Schema.suspend(exprS),
    inclusive: Schema.Boolean,
    span: Schema.instanceOf(Span),
}) { }

export class ArrayExpr extends Schema.TaggedClass<ArrayExpr>()("ArrayExpr", {
    elements: Schema.Array(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class BlockExpr extends Schema.TaggedClass<BlockExpr>()("BlockExpr", {
    stmts: Schema.Array(Schema.suspend(stmtS)),
    span: Schema.instanceOf(Span),
}) { }

export class IfExpr extends Schema.TaggedClass<IfExpr>()("IfExpr", {
    condition: Schema.suspend(exprS),
    then: Schema.suspend(blockS),
    else_: Schema.Option(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class MatchArm extends Schema.TaggedClass<MatchArm>()("MatchArm", {
    pattern: Schema.suspend(exprS),
    body: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export class MatchExpr extends Schema.TaggedClass<MatchExpr>()("MatchExpr", {
    scrutinee: Schema.suspend(exprS),
    arms: Schema.Array(Schema.suspend(matchArmS)),
    span: Schema.instanceOf(Span),
}) { }

export class WhileExpr extends Schema.TaggedClass<WhileExpr>()("WhileExpr", {
    condition: Schema.suspend(exprS),
    body: Schema.suspend(blockS),
    span: Schema.instanceOf(Span),
}) { }

export class ForExpr extends Schema.TaggedClass<ForExpr>()("ForExpr", {
    variable: Schema.String,
    iterable: Schema.suspend(exprS),
    body: Schema.suspend(blockS),
    span: Schema.instanceOf(Span),
}) { }

export class BreakExpr extends Schema.TaggedClass<BreakExpr>()("BreakExpr", {
    span: Schema.instanceOf(Span),
}) { }

export class ContinueExpr extends Schema.TaggedClass<ContinueExpr>()("ContinueExpr", {
    span: Schema.instanceOf(Span),
}) { }

export class LetStmt extends Schema.TaggedClass<LetStmt>()("LetStmt", {
    name: Schema.String,
    mutable: Schema.Boolean,
    value: Schema.Option(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class ReturnStmt extends Schema.TaggedClass<ReturnStmt>()("ReturnStmt", {
    value: Schema.Option(Schema.suspend(exprS)),
    span: Schema.instanceOf(Span),
}) { }

export class ExprStmt extends Schema.TaggedClass<ExprStmt>()("ExprStmt", {
    expr: Schema.suspend(exprS),
    span: Schema.instanceOf(Span),
}) { }

export const ExprSchema: Schema.Schema<Expr, any> = Schema.Union(
    IntLiteral,
    FloatLiteral,
    StringLiteral,
    InterpExpr,
    BoolLiteral,
    NilLiteral,
    Identifier,
    BinaryExpr,
    UnaryExpr,
    CallExpr,
    IndexExpr,
    FieldExpr,
    AssignExpr,
    RangeExpr,
    ArrayExpr,
    BlockExpr,
    IfExpr,
    MatchExpr,
    WhileExpr,
    ForExpr,
    BreakExpr,
    ContinueExpr,
)

export const StmtSchema: Schema.Schema<Stmt, any> = Schema.Union(
    LetStmt,
    ReturnStmt,
    ExprStmt,
)
