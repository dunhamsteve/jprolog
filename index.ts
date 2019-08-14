type Var = string
type Term = string | Var | ITerm
interface ITerm extends Array<Term> {}

type Rule = Term[]

type List<T> = { car: T; cdr?: List<T> }

type OList<T> = List<T> | undefined

type Env = {
  key: string
  value: Term
  rest: Env
} | undefined

function lookup(key: string, e: Env) {
  for (;e;e=e.rest) { if (e.key === key) return e.value }
}

const isvar = (x: any): x is Var => typeof x === "string" && x[0] === '?'

function value(x: Term, e: Env): Term {
  while (true) {
    if (typeof x === 'string') {
      let v = lookup(x,e)
      if (v) {
        x = v
        continue
      }
    }
    return x
  }
}

function bind(key: string, value: Term, rest: Env): Env {
  return {key,value,rest}
}

// FIXME occurs check?
function unify(x: Term, y: Term, e: Env): Env {
  const x_ = value(x,e)
  const y_ = value(y,e)
  if (x_ === y_) return e
  if (isvar(x_)) return bind(x_, y_, e)
  if (isvar(y_)) return bind(y_, x_, e)
  if (x instanceof Array && y instanceof Array && x.length === y.length) {
    return x.reduce((e,t,i) => e && unify(t,y[i],e), e)
  }
}

// Rule -> List<Term>
function copyRule(r: Rule,n:number): List<Term> {
  let rval: List<Term> = {car:copy(r[0],n)}
  let prev = rval
  for (let i = 1; i<r.length; i++) {
    prev.cdr = {car:copy(r[i],n)}
    prev = prev.cdr
  }
  return rval
}

function copy(t: Term, n: number): Term {
  if (isvar(t)) return t+'_'+n
  if (t instanceof Array) return t.map(x => copy(x,n))
  return t
}

function append<T>(a: OList<T>, b: OList<T>) {
  const rval = {} as List<T>
  let cur = rval
  for (;a;a = a.cdr) {
    cur = cur.cdr = {car:a.car}
  }
  cur.cdr = b
  return rval.cdr
}

const printframe = console.log

function prove(goals: OList<Term>, rules: Rule[], env: Env, n:number) {
  if (!goals) return printframe('S',env)
  for (const rule of rules) { 
    const a = copyRule(rule,n)
    const newenv = unify(goals.car, a.car, env)
    if (newenv) { prove(append(a.cdr, goals.cdr), db, newenv, n+1) }
  }
}

const db: Rule[] = [
  [['edge','a','b']],
  [['edge','a','f']],
  [['edge','a','g']],
  [['edge','b','c']],
  [['edge','b','d']],
  // ...
  [['path', '?A', '?B', ['cons','?A', ['cons','?B']]],
    ['edge', '?A', '?B']],
  [['path', '?A', '?C', ['cons', '?A', '?BC']],
    ['edge', '?A', '?B'],
    ['path', '?B', '?C', '?BC']],
]

prove({car:['path','?a','?b','?c']}, db, {} as Env, 0)
