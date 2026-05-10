{
  exception LexError of string
}

let whitespace = [' ' '\t' '\n' '\r']+

rule token = parse
  | whitespace { token lexbuf }
  | eof        { raise (LexError "EOF") }
