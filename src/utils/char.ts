export const isDigit = (ch: string): boolean => ch >= "0" && ch <= "9"

export const isLower = (ch: string): boolean => ch >= "a" && ch <= "z"

export const isUpper = (ch: string): boolean => ch >= "A" && ch <= "Z"

export const isAlpha = (ch: string): boolean => isLower(ch) || isUpper(ch) || ch === "_"

export const isAlphaNum = (ch: string): boolean => isAlpha(ch) || isDigit(ch)

export const isWhitespace = (ch: string): boolean =>
    ch === " " || ch === "\t" || ch === "\r" || ch === "\n"

export const isHexDigit = (ch: string): boolean =>
    isDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")

export const isOctalDigit = (ch: string): boolean => ch >= "0" && ch <= "7"

export const isBinaryDigit = (ch: string): boolean => ch === "0" || ch === "1"

export const isNewline = (ch: string): boolean => ch === "\n"

export const isPrintable = (ch: string): boolean => {
    const code = ch.charCodeAt(0)
    return code >= 0x20 && code < 0x7f
}
