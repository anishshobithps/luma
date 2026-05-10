%token EOF
%start <unit> prog
%%
prog: EOF { () }
