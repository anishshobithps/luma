import { Either } from "effect"
import { lex } from "@/lexer/lexer"
import { parse } from "@/parser/parser"
import { interpret } from "@/interpreter/eval"
import { display } from "@/interpreter/value"

const file = process.argv[2] ?? "stdin"
const source = await Bun.file(file).text()

const lexResult = lex(source, file)
if (Either.isLeft(lexResult)) {
    console.error(lexResult.left.render())
    process.exit(1)
}

const parseResult = parse(lexResult.right, source, file)
if (Either.isLeft(parseResult)) {
    console.error(parseResult.left.render())
    process.exit(1)
}

const result = interpret(parseResult.right)
if (Either.isLeft(result)) {
    console.error(result.left.render())
    process.exit(1)
}

const { value, env } = result.right
if (value._tag !== "Nil") {
    console.log(display(value))
}
