// Prolog in Javascript
type List<T> = { car: T; cdr?: List<T> }
type OList<T> = List<T> | undefined
type Var = string
type Term = string | Var | ITerm 
interface ITerm extends Array<Term> { }
type Rule = List<Term>
type Env = { key: string; value: Term; rest: Env; } | undefined

function lookup(key: string, env: Env): Term {
  for (let e = env; e; e = e.rest) { 
    if (e.key === key) return isvar(e.value) ? lookup(e.value,env) : e.value
  }
  return key
}

function expand(x: Term, e: Env): Term {
  if (isvar(x)) x = lookup(x,e)
  return x instanceof Array ? x.map(v => expand(v,e)) : x
}

const isvar = (x: any): x is Var => typeof x === "string" && ((x.charCodeAt(0) & 32) == 0)
function unify(x: Term, y: Term, e: Env): Env {
  const x_ = expand(x, e), y_ = expand(y, e)
  if (x_ === y_) return e
  if (isvar(x_)) return { key: x_, value: y_, rest: e }
  if (isvar(y_)) return { key: y_, value: x_, rest: e }
  if (x instanceof Array && y instanceof Array && x.length === y.length) {
    return x.reduce((e, t, i) => e && unify(t, y[i], e), e)
  }
}

function addGoals(r: OList<Term>,  goals: OList<Term>, n: number): List<Term> {
  let dummy = {} as List<Term>
  let prev = dummy
  for (; r; r = r.cdr) prev = prev.cdr = { car: copy(r.car, n) }
  prev.cdr = goals
  return dummy.cdr as List<Term>
}

const copy = (t: Term, n: number): Term => {
  if (isvar(t)) return t + '_' + n
  if (t instanceof Array) return t.map(x => copy(x, n))
  if (t === '!') return '!_'+n
  return t
}
type State = { goals: OList<Term>, rules: OList<Rule>, env: Env, n: number, prev?: State }
function run(goal: Term, db: OList<Rule>) {
  let st: State = { goals: {car: goal}, rules: db, env: {} as Env, n: 0}
  while (true) {
    if (!st.rules || !st.goals) {
      if (!st.goals) console.log(pprint(expand(goal, st.env)))
      if (!st.prev) break
      st = st.prev
    } else if (st.goals.car[0] === '!') {
      const cut_n = Number(st.goals.car.slice(2))
      st.goals = st.goals.cdr
      while (st.prev && st.prev.n !== cut_n) st.prev = st.prev.prev
    } else {
      const newgoals = addGoals(st.rules.car,st.goals.cdr, st.n)
      st.rules = st.rules.cdr
      const newenv = unify(st.goals.car, newgoals.car, st.env)
      if (newenv)
        st = { goals: newgoals.cdr, rules: db, env: newenv, n: st.n+1, prev: st }
    }
  }
}

function parse(str: string) {
  let rules = {} as List<Rule>
  let tail = rules
  const toks: string[] = []
  str.replace(/\??\w+|[^\s]/g, (m) => (toks.push(m), ''))
  let p = 0
  const error = (msg: string) => { throw `parse error: ${msg} at ${p} - ${JSON.stringify(toks.slice(p - 1, p + 2))}` }
  const maybe = (tok: string) => toks[p] == tok && toks[p++]
  const pAtom = (): Term => toks[p].match(/^\??\w+$/) && toks[p++] || error('expected atom')
  const pTerm = (): Term => {
    let rval: Term = maybe("!") || pAtom()
    if (!maybe('(')) return rval
    rval = [rval]
    while (true) {
      rval.push(pTerm())
      if (maybe(')')) return rval
      if (!maybe(',')) error('expected , or )')
    }
  }
  const pRule = () => {
    const rval: List<Term> = { car: pTerm() }
    const key = rval.car[0] as string
    let tmp = rval
    if (maybe(':')) {
      if (!maybe('-')) error('expected -')
      while (true) {
        tmp = tmp.cdr = { car: pTerm() }
        if (!maybe(',')) break
      }
    }
    if (!maybe('.')) error('expected .')
    tail = tail.cdr = { car: rval }
  }
  while (p < toks.length) pRule()
  return rules.cdr
}

function pprint(term: Term): Term {
  if (term instanceof Array) {
    if (term[0] === 'cons') {
      let [_,h,t] = term
      let rval = ''
      while (true) {
        rval += pprint(h)
        if (!(t instanceof Array && t[0] === 'cons')) {
          return t ? `[${rval}|${pprint(t)}]` : `[${rval}]`
        }
        rval += ',';
        [_,h,t] = t
      }
    }
    return `${term[0]}(${term.slice(1).map(x => pprint(x)).join(',')})`
  }
  return term
}

const db = parse(`
edge(a,b). edge(b,d). edge(d,h).
edge(a,f). edge(c,d). edge(h,e).
edge(a,g). edge(c,e). edge(h,f).
edge(b,c). edge(g,h).

path(A,B,cons(A,cons(B))) :- edge(A,B).
path(A,C,cons(A,BC)) :- edge(A,B),path(B,C,BC).

foo(a). foo(b).
baz(X) :- foo(X).
bar(X,Y) :- foo(X), baz(Y), !.

`)

// run(['path', '?a', '?b', '?c'], db)
run(['path', 'a','f','P'],db)
run(['bar', 'X', 'Y'],db)

