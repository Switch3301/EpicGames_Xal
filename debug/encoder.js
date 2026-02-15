const fs = require("fs")
const zlib = require("zlib")
const path = require("path")

const root = path.resolve(__dirname, "..")
const cfg = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, "config.json"), "utf8"))
const dataFile = process.argv[3] || path.join(root, "xal_data.json")
const KEY = new Uint8Array(cfg.key.match(/.{2}/g).map(h => parseInt(h, 16)))
const NONCE_INIT = cfg.nonce ? new Uint32Array(cfg.nonce.match(/.{8}/g).map(h => parseInt(h, 16) >>> 0)) : new Uint32Array([0xbc699f52, 0xee5e6b36, 0xcbeec4f0])
const DATA = JSON.parse(fs.readFileSync(dataFile, "utf8"))

function chacha20(data, key, nonce) {
  let kv = new DataView(key.buffer, key.byteOffset, key.byteLength)
  let st = new Uint32Array(16)
  st[0] = 0x61707865; st[1] = 0x3320646e; st[2] = 0x79622d32; st[3] = 0x6b206574
  for (let i = 0; i < 8; i++) st[4 + i] = kv.getUint32(i * 4, true)
  st[12] = 0; st[13] = nonce[0]; st[14] = nonce[1]; st[15] = nonce[2]
  let rotl = (v, n) => (v << n) | (v >>> (32 - n))
  let qr = (s, a, b, c, d) => {
    s[a] += s[b]; s[d] = rotl(s[d] ^ s[a], 16)
    s[c] += s[d]; s[b] = rotl(s[b] ^ s[c], 12)
    s[a] += s[b]; s[d] = rotl(s[d] ^ s[a], 8)
    s[c] += s[d]; s[b] = rotl(s[b] ^ s[c], 7)
  }
  let out = new Uint8Array(data.length), ws = new Uint32Array(16), wv = new DataView(ws.buffer), off = 0
  while (off < data.length) {
    ws.set(st)
    for (let i = 0; i < 20; i += 2) {
      qr(ws, 0, 4, 8, 12); qr(ws, 1, 5, 9, 13); qr(ws, 2, 6, 10, 14); qr(ws, 3, 7, 11, 15)
      qr(ws, 0, 5, 10, 15); qr(ws, 1, 6, 11, 12); qr(ws, 2, 7, 8, 13); qr(ws, 3, 4, 9, 14)
    }
    for (let i = 0; i < 16; i++) wv.setUint32(i * 4, ws[i] + st[i], true)
    let ks = new Uint8Array(ws.buffer), end = Math.min(64, data.length - off)
    for (let i = 0; i < end; i++) out[off + i] = data[off + i] ^ ks[i]
    st[12]++; off += 64
  }
  return out
}

function mt19937(seed) {
  let N = 624, s = new Uint32Array(N), idx = 0
  s[0] = seed >>> 0
  for (let i = 1; i < N; i++) s[i] = (Math.imul(0x6c078965, s[i-1] ^ (s[i-1] >>> 30)) + i) >>> 0
  let mask = 0xffffffff << 31
  return function() {
    let y = idx, z = y - (N - 1); z < 0 && (z += N)
    let v = s[y] & mask | s[z] & 0x7fffffff, m = v >>> 1
    v & 1 && (m ^= 0x9908b0df)
    z = y - (N - 397); z < 0 && (z += N)
    v = s[z] ^ m; s[y++] = v; y >= N && (y = 0); idx = y
    let t = v ^ (v >>> 11)
    t ^= (t << 7) & 0x9d2c5680
    t ^= (t << 15) & 0xefc60000
    return (t ^ (t >>> 18)) >>> 0
  }
}

function fnv1a(data, init) {
  let h = init === undefined ? 0x811c9dc5 : init
  let p = (16777216 + (1 << 8) + 0x93) >>> 0
  for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, p) }
  return h >>> 0
}

function u32le(v) {
  let b = new Uint8Array(4)
  b[0] = v & 0xff; b[1] = (v >> 8) & 0xff; b[2] = (v >> 16) & 0xff; b[3] = (v >> 24) & 0xff
  return b
}

function cat(...a) {
  let len = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(len), off = 0
  for (let x of a) { o.set(x, off); off += x.length }
  return o
}

let rng = mt19937(Math.floor(Date.now() / 1000))
let random = rng()
let values = Object.values(DATA)
let shuffled = [...values]
let sr = mt19937(random)
for (let i = shuffled.length - 1; i > 0; i--) {
  let j = sr() % (i + 1)
  let tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
}
let gh = fnv1a(new Uint8Array(0)), ser = new Uint8Array(0)
for (let val of shuffled) {
  let json = new TextEncoder().encode(JSON.stringify(val))
  gh = fnv1a(json, gh)
  ser = cat(ser, u32le(fnv1a(json)), u32le(json.length), json)
}
ser = cat(ser, u32le((gh ^ random) >>> 0))
let comp = zlib.deflateSync(Buffer.from(ser))
let wrapped = cat(u32le(fnv1a(new Uint8Array(comp))), u32le(comp.length), new Uint8Array(comp))
let nonce = new Uint32Array([NONCE_INIT[0] ^ random, NONCE_INIT[1] ^ random, NONCE_INIT[2] ^ random])
let enc = chacha20(wrapped, KEY, nonce)
let payload = cat(new Uint8Array(nonce.buffer), u32le(random), enc)
console.log(Buffer.from(payload).toString("base64"))
