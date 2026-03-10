import { Array, Either, Match, pipe } from "effect"
import { lex } from "@/lexer/lexer"
import { parse } from "@/parser/parser"

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

const program = parseResult.right
console.log(`Parsed ${program.decls.length} top-level items:\n`)

pipe(
    program.decls as ReadonlyArray<any>,
    Array.forEach((decl) => {
        const desc = Match.value(decl._tag as string).pipe(
            Match.when("FnDecl", () => `fn ${decl.name}(${decl.params.map((p: any) => p.name).join(", ")})${decl.exported ? " [exported]" : ""}`),
            Match.when("StructDecl", () => `struct ${decl.name} { ${decl.fields.map((f: any) => f.name).join(", ")} }`),
            Match.when("EnumDecl", () => `enum ${decl.name} { ${decl.variants.map((v: any) => v.name).join(", ")} }`),
            Match.when("TypeDecl", () => `type ${decl.name} = ${decl.alias}`),
            Match.when("ImportDecl", () => `import ${decl.path}${decl.alias._tag === "Some" ? ` as ${decl.alias.value}` : ""}`),
            Match.when("LetStmt", () => `let ${decl.mutable ? "mut " : ""}${decl.name}`),
            Match.when("ExprStmt", () => `<expr: ${decl.expr._tag}>`),
            Match.when("ReturnStmt", () => `return`),
            Match.orElse(() => decl._tag),
        )
        console.log(`  [${decl._tag}] ${desc}`)
    })
)
