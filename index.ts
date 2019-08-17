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
  while (typeof x === 'string') {
    let v = lookup(x,e)
    if (!v) break
    x = v
  }
  return x
}

function unify(x: Term, y: Term, e: Env): Env {
  const x_ = value(x,e)
  const y_ = value(y,e)
  if (x_ === y_) return e
  if (isvar(x_)) return {key:x_,value:y_,rest:e}
  if (isvar(y_)) return {key:y_,value:x_,rest:e}
  if (x instanceof Array && y instanceof Array && x.length === y.length) {
    return x.reduce((e,t,i) => e && unify(t,y[i],e), e)
  }
}

function instantiate(r: Rule,n:number,goals:OList<Term>): List<Term> {
  let dummy = {} as List<Term>
  let prev = dummy
  r.forEach(term => prev = prev.cdr = {car:copy(term,n)})
  prev.cdr = goals
  return dummy.cdr as List<Term>
}

function copy(t: Term, n: number): Term {
  if (isvar(t)) return t+'_'+n
  if (t instanceof Array) return t.map(x => copy(x,n))
  return t
}

function run(goal: Term, db: Rule[]) {
  function prove(goals: OList<Term>, rules: Rule[], env: Env, n:number) {
    if (!goals) return console.log(pprint(['path','?a','?b','?c'],env))
    for (const rule of rules) { 
      const a = instantiate(rule,n,goals.cdr)
      const newenv = unify(goals.car, a.car, env)
      if (newenv) { 
        prove(a.cdr, db, newenv, n+1) 
      }
    }
    return
  }
  function pprint(term: Term, env:Env): Term {
    const tt = value(term,env) // chase vars
    return tt instanceof Array ? `${tt[0]}(${tt.slice(1).map(x => pprint(x,env)).join(',')})` : tt
  }
  prove({car:goal}, db, {} as Env, 0)
}

const ATOM = /^\??\w+$/

function parse(str: string) {
  const toks: string[] = []
  str.replace(/\??\w+|[^\s]/g, (m) => (toks.push(m),''))
  let p = 0
  const error = (msg: string) => { throw `parse error: ${msg} at ${p} - ${JSON.stringify(toks.slice(p-1,p+2))}` }
  const maybe = (tok: string) => toks[p] == tok && toks[p++]
  const pAtom = (): Term => toks[p].match(ATOM) && toks[p++] || error('expected atom')
  const pTerm = (): Term => {
    let rval: Term = pAtom()
    if (!maybe('(')) return rval
    rval = [rval]
    while (true) {
      rval.push(pTerm())
      if (maybe(')')) return rval
      if (!maybe(',')) error('expected , or )')
    }
  }
  const pRule = (): Rule => {
    const rval: Rule = [pTerm()]
    if (maybe(':')) {  
      if (!maybe('-')) error('expected -')
      while (true) {
        rval.push(pTerm())
        if (!maybe(',')) break
      }
    }
    if (!maybe('.')) error('expected .')
    return rval
  }
  const rules: Rule[] = []
  while (p < toks.length) rules.push(pRule())
  return rules
}

const db = parse(`
edge(a,b).
edge(a,f).
edge(a,g).
edge(b,c).
edge(b,d).
path(?a,?b,cons(?a,cons(?b))) :- edge(?a,?b).
path(?a,?c,cons(?a,?bc)) :- edge(?a,?b),path(?b,?c,?bc).
`)

const query = parse('path(?a,?b,?c).')[0][0]
run(query,db)
