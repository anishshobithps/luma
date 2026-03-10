import { Schema } from "effect"
import { Span } from "@/diagnostic/span"
import { BlockExpr, ExprStmt, LetStmt, ReturnStmt, type Stmt } from "@/ast/expr"

export class Param extends Schema.TaggedClass<Param>()("Param", {
    name: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class FnDecl extends Schema.TaggedClass<FnDecl>()("FnDecl", {
    name: Schema.String,
    params: Schema.Array(Param),
    body: Schema.instanceOf(BlockExpr),
    exported: Schema.Boolean,
    span: Schema.instanceOf(Span),
}) { }

export class StructField extends Schema.TaggedClass<StructField>()("StructField", {
    name: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class StructDecl extends Schema.TaggedClass<StructDecl>()("StructDecl", {
    name: Schema.String,
    fields: Schema.Array(StructField),
    span: Schema.instanceOf(Span),
}) { }

export class EnumVariant extends Schema.TaggedClass<EnumVariant>()("EnumVariant", {
    name: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class EnumDecl extends Schema.TaggedClass<EnumDecl>()("EnumDecl", {
    name: Schema.String,
    variants: Schema.Array(EnumVariant),
    span: Schema.instanceOf(Span),
}) { }

export class TypeDecl extends Schema.TaggedClass<TypeDecl>()("TypeDecl", {
    name: Schema.String,
    alias: Schema.String,
    span: Schema.instanceOf(Span),
}) { }

export class ImportDecl extends Schema.TaggedClass<ImportDecl>()("ImportDecl", {
    path: Schema.String,
    alias: Schema.Option(Schema.String),
    span: Schema.instanceOf(Span),
}) { }

export type Decl =
    | FnDecl
    | StructDecl
    | EnumDecl
    | TypeDecl
    | ImportDecl

export type TopLevel = Decl | Stmt

export const DeclSchema: Schema.Schema<Decl, any> = Schema.Union(
    FnDecl,
    StructDecl,
    EnumDecl,
    TypeDecl,
    ImportDecl,
)

export const TopLevelSchema: Schema.Schema<TopLevel, any> = Schema.Union(
    FnDecl,
    StructDecl,
    EnumDecl,
    TypeDecl,
    ImportDecl,
    LetStmt,
    ReturnStmt,
    ExprStmt,
)

export class Program extends Schema.Class<Program>("Program")({
    decls: Schema.Array(TopLevelSchema),
    span: Schema.instanceOf(Span),
}) { }
