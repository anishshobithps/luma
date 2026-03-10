import { Option } from "effect"

const escapeTable: ReadonlyMap<string, string> = new Map([
    ["n", "\n"],
    ["t", "\t"],
    ["r", "\r"],
    ["\\", "\\"],
    ['"', '"'],
    ["'", "'"],
    ["0", "\0"],
    ["a", "\x07"],
    ["b", "\x08"],
    ["f", "\x0c"],
    ["v", "\x0b"],
])

export const resolveEscape = (ch: string): Option.Option<string> =>
    Option.fromNullable(escapeTable.get(ch))

export const validEscapesList = (): string =>
    Array.from(escapeTable.keys())
        .map((k) => `\\${k}`)
        .join(" ")
