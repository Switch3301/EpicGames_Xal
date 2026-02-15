const fs = require("fs")
const zlib = require("zlib")
const path = require("path")

const root = path.resolve(__dirname, "..")
const cfg = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"))
const tok = process.argv[2]
if (!tok) { console.log("usage: node decoder.js <xal_base64>"); process.exit(1) }
const KEY = new Uint8Array(cfg.key.match(/.{2}/g).map(h => parseInt(h, 16)))

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

function u32le(buf, off) { return (buf[off] | (buf[off+1] << 8) | (buf[off+2] << 16) | (buf[off+3] << 24)) >>> 0 }

function unshuffle(arr, seed) {
  let rng = mt19937(seed), swaps = []
  for (let i = arr.length - 1; i > 0; i--) swaps.push([i, rng() % (i + 1)])
  for (let k = swaps.length - 1; k >= 0; k--) {
    let [i, j] = swaps[k]
    let tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr
}

let raw = Buffer.from(tok, "base64")
let nv = new DataView(raw.buffer, raw.byteOffset, 12)
let nonce = new Uint32Array([nv.getUint32(0, true), nv.getUint32(4, true), nv.getUint32(8, true)])
let random = new DataView(raw.buffer, raw.byteOffset + 12, 4).getUint32(0, true)

let plain = chacha20(new Uint8Array(raw.slice(16)), KEY, nonce)

let cHash = u32le(plain, 0), cLen = u32le(plain, 4)
let inflated
try { inflated = zlib.inflateSync(Buffer.from(plain.slice(8, 8 + cLen))) }
catch { inflated = zlib.inflateRawSync(Buffer.from(plain.slice(8, 8 + cLen))) }

let entries = [], off = 0
while (off + 8 <= inflated.length) {
  let h = u32le(inflated, off), len = u32le(inflated, off + 4); off += 8
  if (off + len > inflated.length) break
  let d = inflated.slice(off, off + len); off += len
  try { entries.push({ h, v: JSON.parse(d.toString("utf8")) }) }
  catch { entries.push({ h, v: d.toString("utf8") }) }
}

unshuffle(entries, random)

let result = {}
for (let e of entries) result["0x" + e.h.toString(16).padStart(8, "0")] = e.v
console.log(JSON.stringify(result, null, 2))
