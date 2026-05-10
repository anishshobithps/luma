(lang dune 3.23)
(using menhir 3.0)
(name luma)
(generate_opam_files true)
(source
 (github anishshobithps/luma))
(authors "Anish Shobith P S")
(maintainers "Anish Shobith P S")
(license Apache-2.0)
(package
 (name luma)
 (synopsis "Luma programming language compiler")
 (description "A small expressive language that compiles to TypeScript and runs on Bun")
 (depends
  ocaml
  dune
  menhir)
 (tags
  ("language" "compiler" "typescript" "bun")))
