import { Array, Either, pipe } from "effect"
import { lex } from "@/lexer/lexer"

const file = process.argv[2] ?? "stdin"
const source = await Bun.file(file).text()

const result = lex(source, file)

Either.match(result, {
    onLeft: (err) => {
        console.error(err.render())
        process.exit(1)
    },
    onRight: (tokens) =>
        pipe(
            tokens,
            Array.filter((t) => t.kind !== "Eof"),
            Array.forEach((t) =>
                console.log(`${t.span.line + 1}:${t.span.column + 1}\t${t.kind.padEnd(20)}\t${JSON.stringify(t.lexeme)}`)
            )
        )
})
