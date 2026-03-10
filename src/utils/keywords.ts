import { Option } from "effect"
import type { TokenKind } from "@/lexer/token"

const keywordMap: ReadonlyMap<string, TokenKind> = new Map([
    ["let", "Let"],
    ["mut", "Mut"],
    ["fn", "Fn"],
    ["return", "Return"],
    ["if", "If"],
    ["else", "Else"],
    ["while", "While"],
    ["for", "For"],
    ["in", "In"],
    ["break", "Break"],
    ["continue", "Continue"],
    ["true", "True"],
    ["false", "False"],
    ["nil", "Nil"],
    ["and", "And"],
    ["or", "Or"],
    ["not", "Not"],
    ["type", "Type"],
    ["struct", "Struct"],
    ["enum", "Enum"],
    ["match", "Match"],
    ["import", "Import"],
    ["export", "Export"],
    ["as", "As"],
])

export const lookupKeyword = (word: string): Option.Option<TokenKind> =>
    Option.fromNullable(keywordMap.get(word))

export const isKeyword = (word: string): boolean => keywordMap.has(word)
