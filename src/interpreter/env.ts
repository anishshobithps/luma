import { Option } from "effect"
import type { Env, LumaValue } from "@/interpreter/value"

export const makeEnv = (parent: Option.Option<Env> = Option.none()): Env => {
    const vars = new Map<string, LumaValue>()

    const get = (name: string): Option.Option<LumaValue> => {
        const local = vars.get(name)
        if (local !== undefined) return Option.some(local)
        return Option.flatMap(parent, (p) => p.get(name))
    }

    const set = (name: string, val: LumaValue): void => {
        vars.set(name, val)
    }

    const assign = (name: string, val: LumaValue): boolean => {
        if (vars.has(name)) {
            vars.set(name, val)
            return true
        }
        return Option.match(parent, {
            onNone: () => false,
            onSome: (p) => p.assign(name, val),
        })
    }

    const child = (): Env => makeEnv(Option.some({ get, set, assign, child }))

    return { get, set, assign, child }
}
