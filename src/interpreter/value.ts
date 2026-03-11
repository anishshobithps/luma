import { Match, Option } from "effect"
import type { BlockExpr } from "@/ast/expr"

export type Env = {
    readonly get: (name: string) => Option.Option<LumaValue>
    readonly set: (name: string, value: LumaValue) => void
    readonly assign: (name: string, value: LumaValue) => boolean
    readonly child: () => Env
}

export type LumaValue =
    | { readonly _tag: "Int"; readonly value: bigint }
    | { readonly _tag: "Float"; readonly value: number }
    | { readonly _tag: "Str"; readonly value: string }
    | { readonly _tag: "Bool"; readonly value: boolean }
    | { readonly _tag: "Nil" }
    | { readonly _tag: "Array"; readonly elements: ReadonlyArray<LumaValue> }
    | { readonly _tag: "Range"; readonly from: bigint; readonly to: bigint; readonly inclusive: boolean }
    | { readonly _tag: "Fn"; readonly params: ReadonlyArray<string>; readonly body: BlockExpr; readonly closure: Env }
    | { readonly _tag: "NativeFn"; readonly arity: number; readonly call: (args: ReadonlyArray<LumaValue>) => LumaValue }
    | { readonly _tag: "Struct"; readonly name: string; readonly fields: Readonly<Record<string, LumaValue>> }
    | { readonly _tag: "EnumVariant"; readonly enum_: string; readonly variant: string }

export const Int = (v: bigint): LumaValue => ({ _tag: "Int", value: v })
export const Float = (v: number): LumaValue => ({ _tag: "Float", value: v })
export const Str = (v: string): LumaValue => ({ _tag: "Str", value: v })
export const Bool = (v: boolean): LumaValue => ({ _tag: "Bool", value: v })
export const Nil: LumaValue = { _tag: "Nil" }
export const LumaArray = (elements: ReadonlyArray<LumaValue>): LumaValue => ({ _tag: "Array", elements })
export const Range = (from: bigint, to: bigint, inclusive: boolean): LumaValue => ({ _tag: "Range", from, to, inclusive })
export const Fn = (params: ReadonlyArray<string>, body: BlockExpr, closure: Env): LumaValue => ({ _tag: "Fn", params, body, closure })
export const NativeFn = (arity: number, call: (args: ReadonlyArray<LumaValue>) => LumaValue): LumaValue => ({ _tag: "NativeFn", arity, call })
export const StructVal = (name: string, fields: Readonly<Record<string, LumaValue>>): LumaValue => ({ _tag: "Struct", name, fields })
export const EnumVariantVal = (enum_: string, variant: string): LumaValue => ({ _tag: "EnumVariant", enum_, variant })

export const display = (v: LumaValue): string =>
    Match.value(v).pipe(
        Match.tag("Int", ({ value }) => value.toString()),
        Match.tag("Float", ({ value }) => value.toString()),
        Match.tag("Str", ({ value }) => value),
        Match.tag("Bool", ({ value }) => (value ? "true" : "false")),
        Match.tag("Nil", () => "nil"),
        Match.tag("Array", ({ elements }) => `[${elements.map(display).join(", ")}]`),
        Match.tag("Range", ({ from, to, inclusive }) => `${from}..${inclusive ? "=" : ""}${to}`),
        Match.tag("Fn", ({ params }) => `<fn(${params.join(", ")})>`),
        Match.tag("NativeFn", ({ arity }) => `<native fn/${arity}>`),
        Match.tag("Struct", ({ name, fields }) => {
            const entries = Object.entries(fields).map(([k, fv]) => `${k}: ${display(fv)}`).join(", ")
            return `${name} { ${entries} }`
        }),
        Match.tag("EnumVariant", ({ enum_, variant }) => `${enum_}::${variant}`),
        Match.exhaustive,
    )

export const isTruthy = (v: LumaValue): boolean =>
    Match.value(v).pipe(
        Match.tag("Bool", ({ value }) => value),
        Match.tag("Nil", () => false),
        Match.tag("Int", ({ value }) => value !== 0n),
        Match.tag("Float", ({ value }) => value !== 0),
        Match.tag("Str", ({ value }) => value.length > 0),
        Match.tag("Array", ({ elements }) => elements.length > 0),
        Match.orElse(() => true),
    )

export const lumaEquals = (a: LumaValue, b: LumaValue): boolean => {
    if (a._tag === "Int" && b._tag === "Float") return Number(a.value) === b.value
    if (a._tag === "Float" && b._tag === "Int") return a.value === Number(b.value)
    if (a._tag !== b._tag) return false
    if (a._tag === "Int" && b._tag === "Int") return a.value === b.value
    if (a._tag === "Float" && b._tag === "Float") return a.value === b.value
    if (a._tag === "Str" && b._tag === "Str") return a.value === b.value
    if (a._tag === "Bool" && b._tag === "Bool") return a.value === b.value
    if (a._tag === "Nil") return true
    return false
}
