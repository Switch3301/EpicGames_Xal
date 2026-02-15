const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default
const generate = require("@babel/generator").default
const t = require("@babel/types")
const fs = require("fs")
const vm = require("vm")

const SKIP = Symbol("skip")
const path = require("path")
const root = path.resolve(__dirname, "..")
const inp = process.argv[2] || path.join(root, "xal.js")
const out = path.join(path.dirname(inp), "deobfuscated.js")
const src = fs.readFileSync(inp, "utf8")
const ast = parser.parse(src, { sourceType: "script", allowReturnOutsideFunction: true })
let ch = 0

let ctx = vm.createContext({
  parseInt, String, Array, Object, Function, Number, Math,
  RegExp, Date, Error, TypeError, RangeError,
  isNaN, isFinite, parseFloat, decodeURIComponent, encodeURIComponent,
  undefined, NaN, Infinity
})

function hasMinus(node) {
  if (!node || typeof node !== 'object' || !node.type) return false
  if (t.isAssignmentExpression(node, { operator: "-=" })) return true
  if (t.isAssignmentExpression(node, { operator: "=" }) && t.isBinaryExpression(node.right, { operator: "-" })) return true
  for (let k of t.VISITOR_KEYS[node.type] || []) {
    let c = node[k]
    if (Array.isArray(c)) { for (let x of c) if (hasMinus(x)) return true }
    else if (c && typeof c === 'object' && c.type && hasMinus(c)) return true
  }
  return false
}

function unwrapIIFE(expr) {
  if (t.isUnaryExpression(expr)) expr = expr.argument
  if (t.isCallExpression(expr) && t.isFunctionExpression(expr.callee)) return expr
  return null
}

function findDecoders() {
  let decs = []
  let found = new Set()
  traverse(ast, { noScope: true, FunctionDeclaration(p) {
    let n = p.node
    if (!n.id || n.params.length !== 2 || found.has(n.id.name)) return
    let body = n.body.body
    if (body.length < 2 || !t.isVariableDeclaration(body[0])) return
    let d = body[0].declarations[0]
    if (!d || !t.isCallExpression(d.init) || !t.isIdentifier(d.init.callee)) return
    let last = body[body.length - 1]
    if (!t.isReturnStatement(last) && !t.isExpressionStatement(last)) return
    let expr = last.expression || last.argument
    if (!expr) return
    let inner = t.isSequenceExpression(expr) ? expr.expressions : [expr]
    if (t.isCallExpression(expr) && t.isAssignmentExpression(expr.callee))
      inner = [expr.callee]
    let re = inner.find(e =>
      t.isAssignmentExpression(e) && t.isIdentifier(e.left, { name: n.id.name }) &&
      t.isFunctionExpression(e.right))
    if (!re || !hasMinus(re.right.body)) return
    found.add(n.id.name)
    decs.push({ name: n.id.name, arrName: d.init.callee.name, node: n })
  }})
  return decs
}

function findArrayFn(name) {
  let r = null
  traverse(ast, { noScope: true, FunctionDeclaration(p) {
    if (p.node.id && p.node.id.name === name) r = p.node
  }})
  return r
}

function findShuffle(arrName) {
  let r = null
  traverse(ast, { noScope: true, ExpressionStatement(p) {
    let expr = p.node.expression
    if (t.isSequenceExpression(expr)) {
      for (let e of expr.expressions) {
        let iife = unwrapIIFE(e)
        if (iife && iife.arguments.some(a => t.isIdentifier(a, { name: arrName })))
          { r = p.node; return }
      }
    }
    let iife = unwrapIIFE(expr)
    if (iife && iife.arguments.some(a => t.isIdentifier(a, { name: arrName })))
      r = p.node
  }})
  return r
}

function shuffleExpr(node, arrName) {
  let expr = node.expression
  if (t.isSequenceExpression(expr)) {
    for (let e of expr.expressions) {
      let iife = unwrapIIFE(e)
      if (iife && iife.arguments.some(a => t.isIdentifier(a, { name: arrName })))
        return e
    }
  }
  return expr
}

function setupDecoder(dec) {
  dec.arrNode = findArrayFn(dec.arrName)
  dec.shuffleNode = findShuffle(dec.arrName)
  let code = ""
  if (dec.arrNode) code += generate(dec.arrNode).code + ";\n"
  code += generate(dec.node).code + ";\n"
  if (dec.shuffleNode) {
    let se = shuffleExpr(dec.shuffleNode, dec.arrName)
    code += generate(t.expressionStatement(se)).code + ";\n"
  }
  try { vm.runInContext(code, ctx, { timeout: 10000 }) } catch {}
  if (typeof ctx[dec.name] !== 'function') return false
  for (let i = 0; i < 600; i++) {
    try { if (typeof ctx[dec.name](i) === 'string') return true } catch {}
    try { if (typeof ctx[dec.name](i, 0) === 'string') return true } catch {}
  }
  return false
}

function processDecoder(dec) {
  if (!setupDecoder(dec)) return 0
  console.log("decoder=" + dec.name + " array=" + dec.arrName)

  let names = new Set([dec.name])
  let wrapperNames = new Set()

  for (let pass = 0; pass < 5; pass++) {
    let f = 0
    traverse(ast, { noScope: true, FunctionDeclaration(p) {
      let n = p.node
      if (!n.id || n.params.length !== 2 || names.has(n.id.name)) return
      let b = n.body.body
      if (b.length !== 1 || !t.isReturnStatement(b[0])) return
      let ret = b[0].argument
      if (!t.isCallExpression(ret) || !t.isIdentifier(ret.callee) || !names.has(ret.callee.name)) return
      wrapperNames.add(n.id.name)
      names.add(n.id.name)
      try { vm.runInContext(generate(n).code, ctx, { timeout: 1000 }) } catch {}
      f++
    }})
    if (!f) break
  }

  let varAliases = new Set()
  for (let pass = 0; pass < 5; pass++) {
    let f = 0
    traverse(ast, { noScope: true, VariableDeclarator(p) {
      if (!t.isIdentifier(p.node.id) || !t.isIdentifier(p.node.init)) return
      if (!names.has(p.node.init.name) || names.has(p.node.id.name)) return
      varAliases.add(p.node.id.name)
      names.add(p.node.id.name)
      ctx[p.node.id.name] = ctx[p.node.init.name]
      f++
    }})
    if (!f) break
  }

  let count = 0
  traverse(ast, { noScope: true, CallExpression(p) {
    if (!t.isIdentifier(p.node.callee) || !names.has(p.node.callee.name)) return
    let args = p.node.arguments
    if (args.length < 1 || args.length > 2) return
    let nums = []
    for (let a of args) {
      if (t.isNumericLiteral(a)) { nums.push(a.value); continue }
      if (t.isUnaryExpression(a, { operator: "-" }) && t.isNumericLiteral(a.argument))
        { nums.push(-a.argument.value); continue }
      return
    }
    try {
      let r = ctx[p.node.callee.name](...nums)
      if (typeof r === "string") { p.replaceWith(t.stringLiteral(r)); count++; ch++ }
    } catch {}
  }})

  if (!count) return 0

  let infra = new Set()
  if (dec.node.start !== undefined) infra.add(dec.node.start)
  if (dec.arrNode && dec.arrNode.start !== undefined) infra.add(dec.arrNode.start)
  traverse(ast, { noScope: true, FunctionDeclaration(p) {
    if (p.node.start !== undefined && infra.has(p.node.start)) { p.remove(); ch++ }
  }})

  if (dec.shuffleNode) {
    traverse(ast, { noScope: true, ExpressionStatement(p) {
      if (p.node !== dec.shuffleNode) return
      let expr = p.node.expression
      if (t.isSequenceExpression(expr)) {
        let filtered = expr.expressions.filter(e => {
          let iife = unwrapIIFE(e)
          if (!iife) return true
          return !iife.arguments.some(a => t.isIdentifier(a, { name: dec.arrName }))
        })
        if (filtered.length !== expr.expressions.length) {
          if (filtered.length === 0) p.remove()
          else if (filtered.length === 1) p.node.expression = filtered[0]
          else expr.expressions = filtered
          ch++
        }
      } else { p.remove(); ch++ }
    }})
  }

  traverse(ast, { noScope: true, FunctionDeclaration(p) {
    if (!p.node.id || !wrapperNames.has(p.node.id.name)) return
    let b = p.node.body.body
    if (b.length === 1 && t.isReturnStatement(b[0])) { p.remove(); ch++ }
  }})

  let dead = new Set([dec.name, ...varAliases])
  for (let pass = 0; pass < 5; pass++) {
    let pc = 0
    traverse(ast, { noScope: true, VariableDeclarator(p) {
      if (!t.isIdentifier(p.node.id) || !t.isIdentifier(p.node.init)) return
      if (!dead.has(p.node.init.name)) return
      dead.add(p.node.id.name)
      if (t.isVariableDeclaration(p.parent) && p.parent.declarations.length === 1)
        p.parentPath.remove()
      else p.remove()
      ch++; pc++
    }})
    if (!pc) break
  }

  return count
}

for (let pass = 0; pass < 10; pass++) {
  let decs = findDecoders()
  if (!decs.length) break
  let any = false
  for (let dec of decs) {
    let c = processDecoder(dec)
    if (c > 0) any = true
  }
  if (!any) break
}

traverse(ast, { noScope: true, MemberExpression(p) {
  if (!p.node.computed || t.isSuper(p.node.object)) return
  if (t.isStringLiteral(p.node.property)) {
    let k = p.node.property.value
    if (isIdent(k)) { p.node.computed = false; p.node.property = t.identifier(k); ch++ }
  }
}})

function isIdent(s) {
  if (!s || s.length === 0) return false
  if (!/^[a-zA-Z_$]/.test(s[0])) return false
  if (!/^[a-zA-Z0-9_$]*$/.test(s)) return false
  let reserved = new Set(["break","case","catch","continue","debugger","default","delete","do","else",
    "finally","for","function","if","in","instanceof","new","return","switch","this","throw","try",
    "typeof","var","void","while","with","class","const","enum","export","extends","import","super",
    "let","yield","null","true","false","implements","interface","package","private","protected","public","static"])
  return !reserved.has(s)
}

function evalConst(n) {
  if (t.isNullLiteral(n)) return { v: null }
  if (t.isIdentifier(n, { name: "undefined" })) return { v: undefined }
  if (t.isIdentifier(n, { name: "NaN" })) return { v: NaN }
  if (t.isIdentifier(n, { name: "Infinity" })) return { v: Infinity }
  if (t.isNumericLiteral(n) || t.isStringLiteral(n) || t.isBooleanLiteral(n)) return { v: n.value }
  return null
}

function toNode(v) {
  if (v === null) return t.nullLiteral()
  if (v === undefined) return t.identifier("undefined")
  if (typeof v === "boolean") return t.booleanLiteral(v)
  if (typeof v === "number") {
    if (Object.is(v, -0)) { let n = t.unaryExpression("-", t.numericLiteral(0)); n[SKIP] = true; return n }
    if (isNaN(v)) return t.identifier("NaN")
    if (!isFinite(v)) { if (v > 0) return t.identifier("Infinity"); let n = t.unaryExpression("-", t.identifier("Infinity")); n[SKIP] = true; return n }
    if (v < 0) { let n = t.unaryExpression("-", t.numericLiteral(-v)); n[SKIP] = true; return n }
    return t.numericLiteral(v)
  }
  if (typeof v === "string") return t.stringLiteral(v)
  return null
}

for (let i = 0; i < 10; i++) {
  let pc = 0
  traverse(ast, {
    noScope: true,
    BinaryExpression: { exit(p) {
      let { operator: op, left: l, right: r } = p.node
      let lc = evalConst(l), rc = evalConst(r)
      if (lc && rc) {
        let v; switch (op) {
          case "+": v = lc.v + rc.v; break; case "-": v = lc.v - rc.v; break
          case "*": v = lc.v * rc.v; break; case "/": v = lc.v / rc.v; break
          case "%": v = lc.v % rc.v; break; case "**": v = lc.v ** rc.v; break
          case "|": v = lc.v | rc.v; break; case "&": v = lc.v & rc.v; break
          case "^": v = lc.v ^ rc.v; break; case "<<": v = lc.v << rc.v; break
          case ">>": v = lc.v >> rc.v; break; case ">>>": v = lc.v >>> rc.v; break
          case "===": v = lc.v === rc.v; break; case "!==": v = lc.v !== rc.v; break
          case "==": v = lc.v == rc.v; break; case "!=": v = lc.v != rc.v; break
          case "<": v = lc.v < rc.v; break; case ">": v = lc.v > rc.v; break
          case "<=": v = lc.v <= rc.v; break; case ">=": v = lc.v >= rc.v; break
          default: return
        }
        let n = toNode(v); if (n) { p.replaceWith(n); pc++; ch++ }
        return
      }
      if (op === "+") {
        if (t.isStringLiteral(l) && t.isStringLiteral(r)) {
          p.replaceWith(t.stringLiteral(l.value + r.value)); pc++; ch++; return
        }
        if (t.isBinaryExpression(l, { operator: "+" }) && t.isStringLiteral(l.right) && t.isStringLiteral(r)) {
          p.node.right = t.stringLiteral(l.right.value + r.value); p.node.left = l.left; pc++; ch++
        }
      }
    }},
    UnaryExpression: { exit(p) {
      if (p.node[SKIP]) return
      if (p.node.operator === "void" && t.isNumericLiteral(p.node.argument, { value: 0 })) {
        p.replaceWith(t.identifier("undefined")); pc++; ch++; return
      }
      let c = evalConst(p.node.argument); if (!c) return
      let v; switch (p.node.operator) {
        case "!": v = !c.v; break; case "+": v = +c.v; break; case "-": v = -c.v; break
        case "~": v = ~c.v; break; case "typeof": v = typeof c.v; break; case "void": v = undefined; break
        default: return
      }
      let n = toNode(v); if (n) { p.replaceWith(n); pc++; ch++ }
    }},
    ConditionalExpression: { exit(p) {
      let c = evalConst(p.node.test)
      if (c) { p.replaceWith(c.v ? p.node.consequent : p.node.alternate); pc++; ch++ }
    }},
    LogicalExpression: { exit(p) {
      let lc = evalConst(p.node.left); if (!lc) return
      if (p.node.operator === "&&") p.replaceWith(lc.v ? p.node.right : p.node.left)
      else if (p.node.operator === "||") p.replaceWith(lc.v ? p.node.left : p.node.right)
      else return; pc++; ch++
    }},
    IfStatement(p) {
      let c = evalConst(p.node.test); if (!c) return
      if (c.v) {
        t.isBlockStatement(p.node.consequent)
          ? p.replaceWithMultiple(p.node.consequent.body)
          : p.replaceWith(p.node.consequent)
      } else if (p.node.alternate) {
        t.isBlockStatement(p.node.alternate)
          ? p.replaceWithMultiple(p.node.alternate.body)
          : p.replaceWith(p.node.alternate)
      } else p.remove()
      pc++; ch++
    }
  })
  if (!pc) break
}

let cleanCode = generate(ast, { comments: true, compact: false }).code
fs.writeFileSync(out, cleanCode)
console.log(out + " | " + ch + " changes")

let cleanAst = parser.parse(cleanCode, { sourceType: "script", allowReturnOutsideFunction: true })
let config = {}

function findFnReturning(typeName, arrLen) {
  let match
  traverse(cleanAst, { noScope: true, VariableDeclarator(p) {
    if (match) return p.stop()
    let init = p.node.init
    if (!t.isFunctionExpression(init) && !t.isArrowFunctionExpression(init)) return
    let body = init.body
    if (!t.isBlockStatement(body)) return
    for (let stmt of body.body) {
      if (!t.isReturnStatement(stmt) || !stmt.argument) continue
      let arg = stmt.argument
      if (!t.isNewExpression(arg)) continue
      if (!t.isIdentifier(arg.callee, { name: typeName })) continue
      if (arg.arguments.length !== 1 || !t.isArrayExpression(arg.arguments[0])) continue
      if (arg.arguments[0].elements.length !== arrLen) continue
      match = generate(init).code
      return p.stop()
    }
  }})
  return match
}

let vmCtx = vm.createContext({ Uint8Array, Uint32Array, DataView, ArrayBuffer, Math })

let keyCode = findFnReturning("Uint8Array", 32)
if (keyCode) {
  try {
    let key = vm.runInContext("(" + keyCode + ")()", vmCtx)
    config.key = Array.from(key, b => b.toString(16).padStart(2, "0")).join("")
    console.log("chacha key: " + config.key)
  } catch (e) { console.log("key eval failed: " + e.message) }
}

let nonceCode = findFnReturning("Uint32Array", 3)
if (nonceCode) {
  try {
    let nonce = vm.runInContext("(" + nonceCode + ")()", vmCtx)
    config.nonce = Array.from(nonce).map(v => (v >>> 0).toString(16).padStart(8, "0")).join("")
    console.log("init nonce: " + config.nonce)
  } catch (e) { console.log("nonce eval failed: " + e.message) }
}

if (config.key) {
  let cfgPath = path.join(root, "config.json")
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2))
  console.log("config: " + cfgPath)
}
