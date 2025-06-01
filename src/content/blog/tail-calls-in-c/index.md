---
title: "Implementing Proper Tail Calls in C"
description: "This article explains trampolining - a technique that is used to implement tail calls in languages that does not support them"
date: "8  Nov 2024"
---

> In some circles, you will hear proper tail calls referred to as "tail call optimization". I think this name is terrible: omitting unnecessary and stupid behaviour (like accumulating stack at every tail call) is hardly what I'd consider an "optimization": it's simply good principled design.
> -- Ron Garcia

## What are tail calls?

Tails calls are the recursive calls that are executed as the last statement of procedure. Consider the following Racket (PLAI) program to sum up the elements of a list of numbers.

```racket
;; (listof Number) -> Number
;; produce the sum of all elements of lon
(define (sum lon)
  (cond
    [(empty? lon) 0]
    [else (+ (first lon)
             (sum (rest lon)))]))

(test (sum (list)) 0)
(test (sum (list 1)) 1)
(test (sum (list 1 2 3)) 6)
```

After the first call to `sum`, our computation can be expressed as `(+ 1 (sum (list 2 3)))`. After the second call, we get `(+ 1 (+ 2 (sum (list 3))))` and so on until the base case (i.e the empty list) is reached. Notice how on each call, the `+` operation needs to wait for the recursive call to return a value, resulting in this ever growing context of pending computations. This becomes clearer when we trace the execution of `sum`.

```racket
>(sum '(1 2 3))
> (sum '(2 3))
> >(sum '(3))
> > (sum '())
< < 0
< <3
< 5
<6
```

This stack buildup is not ideal. This was just a small example, but imagine if our list was long enough to fill all available memory - we would run out of stack space well before we are able to evaluate our result. Understanding tail recursion can help us avoid this unneccesary build up on the stack. Consider the following modified `sum` procedure.

```racket
;; (listof Number) -> Number
;; produce the sum of all elements of lon
(define (sum lon)
  ;; Accumulator: acc is Number
  ;; Invariant: represents the sum of all elements before the current one
  (local [(define (sum-acc lon acc)
            (cond
              [(empty? lon) acc]
              [else (sum-acc (rest lon)  ;; <-- this is a recursive call at a tail position
                             (+ (first lon) acc))]))]
    (sum-acc lon 0)))

(test (sum (list)) 0)
(test (sum (list 1)) 1)
(test (sum (list 1 2 3)) 6)
```

Here, we use an accumlator to store the sum so far. Instead of using the stack to store the context of pending computations, we use the accumlator variable. Thus at any given time we are occupying a only a single stack frame since our recursive calls don't need to wait. The trace of `sum-acc` reflects this change.

```racket
>(sum-acc '(1 2 3) 0)
>(sum-acc '(2 3) 1)
>(sum-acc '(3) 3)
>(sum-acc '() 6)
<6
```

Racket has "proper" tail calls, i.e it does not accumulate any stack space when making a recursive call that appears at a tail position. This means that the following tail-recursive Racket program will simply run forever:

```racket
(define (tick) (begin
                 (displayln 'tick)
                 (tock)))
(define (tock) (begin
                 (displayln 'tock)
                 (tick)))
(tick)
```

C, on the other hand, accumulates stack space even with tail recursive procedures. This means that an equivalent `tick tock` program in C will terminate with a stack overflow error. This article discusses how we can implement "proper" tail calls in C so that procedures like `tick-tock` will run forever instead of blowing the stack. Our discussion will consider the [Euclidean algorithm](https://en.wikipedia.org/wiki/Euclidean_algorithm), a fundamental recursive algorithm to find the greatest common divisor of two integers. Following is an implementation of the Euclidean algorithm in Racket.

```racket
;; Natural Natural -> Natural
;; runs the Euclidean algorithm on scalars a and b
(define (euclid-alg a b)
  (if (> b a)
      (euclid-alg b a)
      (if (= b 0)
          a
          (euclid-alg b (modulo a b)))))

(test (euclid-alg 87 1) 1)
(test (euclid-alg 10 2) 2)
(test (euclid-alg 3 7) 1)
(test (euclid-alg 24 30) 6)
```

## Trampolining

We will employ a technique called "trampolining" to implement "proper" tail calls in C. A trampoline is nothing but a wrapper around the recursive function. In regular recursion, we have a function calling itself from within. In trampolined recursion, the function doesn't call itself, instead it returns another function (thus completing the current execution of our function) and this returned function again calls our recursive function. Then we develop a trampoline loop that keeps calling the function returned by our trampolined recursive function until computation is completed. In other words, control flow goes from our recursive function to the trampoline loop and back to the recursive function again and again (hence the name trampolining!). Here is a trampolined implementation of `euclid-alg` in Racket:

```racket
(define-type trampoline
  [bounce [p procedure?]]
  [dismount [v (λ (x) #t)]]) ;; v can be any type

;; (trampolineof X) is one of:
;; - (bounce ( -> (trampolineof X)))
;; - (dismount X)

;; A simple while loop implementation (to get a more C-like structure)
;; ( -> Boolean) ( -> Void) -> Void
(define (while-fn pred do)
  (when (pred)
    (begin (do)
           (while-fn pred do))))

(define-syntax while
  (syntax-rules ()
    [(while pred body)
     (while-fn (λ () pred) (λ () body))]))

;; (trampolineof X) -> X
;; run the given trampoline to completion
(define (loop-trampoline t0)
  ;; Accumulator: t is (trampolineof X)
  ;; Invariant: t represents pending computation (if any)
  (local [(define t (void))]
    (begin
      (set! t t0)
      (while (bounce? t)
             (let ([c (bounce-p t)])
               (set! t (c))))
      ;; t is now a dismount
      (dismount-v t))))

;; Natural Natural -> (trampolineof Natural)
;; runs the Euclidean algorithm on scalars a and b
(define (euclid-alg a b)
  (local [(define (euclid-alg/tr a b)
  (if (> b a)
      (bounce (λ () (euclid-alg/tr b a)))
      (if (= b 0)
          (dismount a)
          (bounce (λ () (euclid-alg/tr b (modulo a b)))))))]
    (loop-trampoline (euclid-alg/tr a b))))
```
Notice how all recursive calls are represented by the `bounce` data type and the base case is represented by `dismount`. Using the information encapsulated by these data representations, the `loop-trampoline` procedure is able to determine whether or not the computation is complete.


## Defunctionalization

Notice that we use lambda functions in the `bounce` constructor. C does not have lambdas, and so we aren't quite ready to translate this Racket code to C. We need to remove any usage of first-class of functions, a process refered to as "defunctionalization". Defunctionalization entails two key steps:

- Create abstractions for all places a lambda is being applied or constructed
- Then replace the lambda with a data representation

The only place were we apply the `bounce` lambdas is in the `loop-trampoline` procedure. So, we create a new `apply/th` (read: apply thunk) procedure to abstract away lambda application.

> A thunk refers to an argument-less function that mimics lazy evaluations. For example, the procedure `(define (lazy-sum) (+ 1 2))` is a thunk. By capturing the state of our recursive function at each step, we are creating thunks that get evaluated by the `loop-trampoline` procedure.

```racket ins={1-3} {15}
(define (apply/th th)
  (match th
    [p #:when (procedure? p) (p)]))

;; (trampolineof X) -> X
;; run the given trampoline to completion
(define (loop-trampoline t0)
  ;; Accumulator: t is (trampolineof X)
  ;; Invariant: t represents pending computation (if any)
  (local [(define t (void))]
    (begin
      (set! t t0)
      (while (bounce? t)
             (let ([c (bounce-p t)])
               (set! t (apply/th c))))
      ;; t is now a dismount
      (dismount-v t))))
```

The `bounce` lambdas are created in the `euclid-alg/tr` procedure. We introduce new procedures to abstract away these constructions.

```racket ins={1-4, 6-9} {15, 17, 18}
;; Natural Natural -> ( -> (trampolineof Natural))
;; returns the thunk encapsulating the work to be done for the b>a case
(define (b>a/th a b)
  (λ () (euclid-alg/tr b a)))

;; Natural Natural -> ( -> (trampolineof Natural))
;; returns the thunk encapsulating the work to be done for the case when b<=a (b != 0)
(define (b<=a/th a b)
  (λ () (euclid-alg/tr b (modulo a b))))

;; Natural Natural -> ( -> (trampolineof Natural))
;; trampolined euclid-alg
(define (euclid-alg/tr a b)
  (if (> b a)
      (bounce (b>a/th a b))
      (if (= b 0)
          (dismount a)
          (bounce (b<=a/th a b)))))
```

Now we are setup to get rid of these first-class functions altogether. To do so, we introduce a new data type -- `thunk`. This will encapsulate the same information that the lambdas did.

```racket
(define-type thunk
  [b>a  (a number?) (b number?)]
  [b<=a (a number?) (b number?)])
```

Now we update our `apply/th` procedure to handle these two thunk variants.
```racket
;; Thunk -> (trampolineof Natural)
;; dispatches the appropriate thunk for euclid-alg
(define (apply/th th)
  (type-case thunk th
    [b>a  (a b) (euclid-alg/tr b a)]
    [b<=a (a b) (euclid-alg/tr b (modulo a b))]))
```

Now we have a trampolined, defunctionalized version of the Euclidean algorithm. This can easily be translated to C.

## Euclidean algorithm in C with proper tail calls
```c title="euclidean.h"
struct _thunk {
  enum { b_gt_a, b_lte_a } tag;
  struct {
    int a;
    int b;
  } values;
};
typedef struct _thunk thunk;

struct _trampoline {
  enum { bounce, dismount } tag;
  union {
    int result;
    thunk *next;
  } value;
};
typedef struct _trampoline trampoline;

thunk *th_b_gt_a(int a, int b);
thunk *th_b_lte_a(int a, int b);

trampoline *apply_th(thunk *th);
trampoline *tr_euclid_alg(int a, int b);

int loop_trampoline(trampoline *tr);
int euclid_alg(int a, int b);
```

<br />


```c title="euclidean.c"
#include "euclidean.h"
#include <assert.h>
#include <stdlib.h>

thunk *th_b_gt_a(int a, int b) {
  thunk *data = (thunk *)malloc(sizeof(thunk));
  data->tag = b_gt_a;
  data->values.a = a;
  data->values.b = b;
  return data;
}

thunk *th_b_lte_a(int a, int b) {
  thunk *data = (thunk *)malloc(sizeof(thunk));
  data->tag = b_lte_a;
  data->values.a = a;
  data->values.b = b;
  return data;
}

trampoline *tr_euclid_alg(int a, int b) {
  trampoline *data = (trampoline *)malloc(sizeof(trampoline));
  if (b > a) {
    thunk *th = th_b_gt_a(a, b);
    data->tag = bounce;
    data->value.next = th;
    return data;
  } else {
    if (b == 0) {
      data->tag = dismount;
      data->value.result = a;
      return data;
    } else {
      thunk *th = th_b_lte_a(a, b);
      data->tag = bounce;
      data->value.next = th;
      return data;
    }
  }
}

trampoline *apply_th(thunk *th) {
  int a = th->values.a;
  int b = th->values.b;
  if (th->tag == b_gt_a) {
    return tr_euclid_alg(b, a);
  } else {
    return tr_euclid_alg(b, a % b);
  }
}

int loop_trampoline(trampoline *tr) {
  trampoline *current = tr;
  while (current->tag == bounce) {
    current = apply_th(current->value.next);
  }
  return current->value.result;
}

int euclid_alg(int a, int b) { return loop_trampoline(tr_euclid_alg(a, b)); }

int main() { assert(euclid_alg(54, 21) == 3); }
```

## Continuation Passing Style
This is great, we can now run any tail recursive function in C without blowing the stack. But what if our function cannot easily be expressed as tail recursive? A common exmaple of such functions are those which aren't singly recursive (i.e make two or more recursive invocations at a time). One such case occurs in the optimal solution to the famous towers of Hanoi problem. Here is a solution to the towers of Hanoi problem in Racket:
```racket
;; Natural Natural Natural Natural -> (listof S-Exp)
;; returns the list of steps to solve the tower of Hanoi problem with n disks
(define (hanoi n from to other)
  (match n
    [n #:when (< n 0) (error `(number of disks ,n cannot be less than 0))]
    [0 '()]
    [else (append (hanoi (- n 1)
                         from
                         other
                         to)
                  `((move disk ,n from ,from to ,to))
                  (hanoi (- n 1)
                         other
                         to
                         from))]))
```
Notice how we need to make two recursive calls in order to solve this problem. Since we have two recursive calls, it is clearly not possible to have both of them be in a tail position. However, we can achieve tail recursion by converting this procedure to use continuation passing style. There are numerous resources online that will be able to explain CPSing much better than I can (for instance, see [this article](https://matt.might.net/articles/by-example-continuation-passing-style/)). Here is what a CPSed solution to the towers of Hanoi look like:
```racket {6, 12-20}
;; Natural Natural Natural Natural Continuation -> (listof S-Exp)
;; returns the list of steps to solve the towers of Hanoi problem with n disks -- using CPS!
(define (hanoi/cps n from to other k)
  (match n
    [n #:when (< n 0) (error `(number of disks ,n cannot be less than 0!))]
    [0 (k '())]
    [else
     (hanoi/cps (- n 1)
                from
                other
                to
                (λ (v0)
                  (hanoi/cps (- n 1)
                             other
                             to
                             from
                             (λ (v1)
                               (k (append v0
                                          `((move disk ,n from ,from to ,to))
                                          v1))))))]))
```
Now we can use trampolining and defunctionalization to be able to implement a "proper" tail recursive solution to the towers of Hanoi in C (or really any other language that doesn't have proper tail calls).
