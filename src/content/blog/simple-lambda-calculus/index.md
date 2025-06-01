---
title: "Simply Typed Lambda Calculus"
description: "Implementing the simply-typed lambda calculus"
date: "2 January 2025"
---

The _lambda calculus_ is a formal system invented by Alonzo Church in 1920s wherein all computation is reduced to the basic operations of function definition and application. It can simultaneously be viewed as a simple programming language.

> As "PL people" we're often in search of minimalism, and so we should ask if there is a simpler way to get "real" computation. One potential answer, which comes to us from Alonzo Church in the 1920s, via John McCarthy in the 1950s and Peter Landin in the 1960s, is the lambda calculus. As the name suggests, it's a core calculus for computation. It's dead simple—just three syntactic forms and three small-step rules or two big-step rules. And yet despite this simplicity, the lambda calculus is Turing complete!
> -- James Bornholt

In this article I will start of implementing the untyped, or pure, lambda calculus and then proceed to implement the simply typed lambda calculus. Along the way, I'll add a few basic primitives to the lambda calculus just to make it easier to write meaningful programs.

Let's consider what a pure lambda calculus implementation, which we will call `Simple`, looks like. It consists of three forms:

```Racket
;; SEFS (Simple-focused s-expression) is one of:
;; - identifier (i.e just a variable)
;; - `{,SEFS ,SEFS} (i.e function application)
;; - `(fun {,identifier} ,SEFS} (i.e function definition)
;; - <any other s-expression>
;; where identifier is any symbol except `fun`
;; interp.  a symbolic expression, but with a focus on those that
;; represent Simple expressions.
```

Notice that functions are first-class citizens in the `Simple` language, therefore a function definition is a _Value_ in `Simple`. What this means is that, given a function definition, there is nothing left to do in order to simplify it. Similarly, variables are also values since there is nothing more you can do to simplify the a statement that is just a variable. Therefore, the only to step a term in the `Simple` language is via the _function application_ case. Here is what the "stepping rule" for this case looks like:


Since variables and abstractions are values in the lambda calculus, only the application case can step - $$\beta$$-reduction. As noted above, a language consisting of just these constructs is Turing complete. One can informally justify this by mentioning that numbers can be represented by Church numerals, recursion can be implemented using fixed-point combinators (see this note I wrote on Y and Z combinators), and booleans can be encoded using lambdas.

To make it easier to work with lambda calculus, we introduce a few extensions - namely, booleans and conditional expressions:

```Racket
t := x
   | λx. t
   | t t
   | true
   | false
   | if t then t else t
```

@TODO: Define step rules

Let's consider the untyped, or pure, lambda calculus and start with an interpreter for it instead. We need to define the "tokens", i.e our internal representation of the language.

```Racket
(define-type Simple
  [var (v identifier?)]
  [bool (b boolean?)]
  [ifB (pred Simple?) (conseq Simple?) (altern Simple?)]
  [fun (argType Type?) (i identifier?) (body Simple?)]
  [app (ratr Simple?) (rand Simple?)])
```

Implementing a parser is straightforward using Racket's match functionality. We will implement an environment-passing interpreter. Notice that we do not have named functions, hence the only identifiers we need to keep track of are the arguments.
