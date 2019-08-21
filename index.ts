// Prolog in Javascript
type List<T> = { car: T; cdr?: List<T> }
type OList<T> = List<T> | undefined
type Var = string
type Term = string | Var | ITerm
interface ITerm extends Array<Term> { }
type Rule = List<Term>
type Env = { key: string; value: Term; rest: Env; } | undefined

function lookup(key: string, e: Env): Term|undefined {
  for (; e; e = e.rest) { 
    if (e.key === key) return isvar(e.value) ? lookup(e.value,e) : e.value
  }
}

function expand(x: Term, e: Env): Term {
  if (isvar(x)) x = lookup(x,e) || x
  return x instanceof Array ? x.map(v => expand(v,e)) : x
}

const isvar = (x: any): x is Var => typeof x === "string" && x[0] === '?'
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

const copy = (t: Term, n: number): Term =>
  isvar(t) && t + '_' + n || (t instanceof Array) && t.map(x => copy(x, n)) || t

function run(goal: Term, db: OList<Rule>) {
  type State = { goals: OList<Term>, rules: OList<Rule>, env: Env, n: number, prev?: State }
  let st: State = { goals: {car: goal}, rules: db, env: {} as Env, n: 0}
  while (true) {
    if (!st.rules || !st.goals) {
      if (!st.goals) console.log(pprint(expand(goal, st.env)))
      if (!st.prev) break
      st = st.prev
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
  let rules: OList<Rule> = undefined
  const toks: string[] = []
  str.replace(/\??\w+|[^\s]/g, (m) => (toks.push(m), ''))
  let p = 0
  const error = (msg: string) => { throw `parse error: ${msg} at ${p} - ${JSON.stringify(toks.slice(p - 1, p + 2))}` }
  const maybe = (tok: string) => toks[p] == tok && toks[p++]
  const pAtom = (): Term => toks[p].match(/^\??\w+$/) && toks[p++] || error('expected atom')
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
    rules = { car: rval, cdr: rules }
  }
  while (p < toks.length) pRule()
  return rules
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

path(?a,?b,cons(?a,cons(?b))) :- edge(?a,?b).
path(?a,?c,cons(?a,?bc)) :- edge(?a,?b),path(?b,?c,?bc).
`)

// run(['path', '?a', '?b', '?c'], db)
run(['path', 'a','f','?p'],db)
