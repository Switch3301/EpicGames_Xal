const fs = require("fs")
const zlib = require("zlib")
const crypto = require("crypto")
const path = require("path")

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"))
const KEY = new Uint8Array(cfg.key.match(/.{2}/g).map(h => parseInt(h, 16)))
const NONCE_INIT = cfg.nonce ? new Uint32Array(cfg.nonce.match(/.{8}/g).map(h => parseInt(h, 16) >>> 0)) : new Uint32Array([0xbc699f52, 0xee5e6b36, 0xcbeec4f0])

function rHex(n) { return crypto.randomBytes(n).toString("hex").slice(0, n) }
function rInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)) }
function rMd5() { return crypto.randomBytes(16).toString("hex") }

function genMouse() {
  let t = rInt(6000, 8000) + Math.random()
  let moves = [], downs = [], ups = []
  let cx = rInt(300, 500), cy = rInt(400, 600)
  let n = rInt(15, 25)
  for (let i = 0; i < n; i++) {
    cx += rInt(-20, 40); cy += rInt(-15, 30)
    cx = Math.max(0, Math.min(1680, cx)); cy = Math.max(0, Math.min(1050, cy))
    t += rInt(30, 120) + Math.random()
    moves.push({ t: +t.toFixed(1), x: cx, y: cy })
  }
  let ci = rInt(Math.floor(n * 0.7), n - 2), ct = moves[ci]
  downs.push({ t: +(ct.t + rInt(50, 150)).toFixed(1), x: ct.x, y: ct.y })
  ups.push({ t: +(ct.t + rInt(100, 250)).toFixed(1), x: ct.x, y: ct.y })
  return { moves, downs, ups }
}

function genKeys() {
  let t = rInt(6000, 7500) + Math.random()
  let kd = [], ku = [], n = rInt(10, 18)
  for (let i = 0; i < n; i++) {
    t += rInt(50, 200) + Math.random()
    kd.push({ t: +t.toFixed(1) })
    ku.push({ t: +(t + rInt(40, 130) + Math.random()).toFixed(1) })
  }
  return { kd, ku }
}

function generate(solved = false) {
  let me = genMouse(), ke = genKeys()
  let t = Date.now(), sid = crypto.randomUUID()
  let rk = "k=client-7N2cbiLO2iDk9ni2Rmc3yDuuInweczLLqdZN3iFLn7I&st=javascript-client&sv=3.31.2"

  return {
    "0": 50, // version
    "1": new Date().toISOString(), // timestamp
    "2": Math.floor(Math.pow(10, 16) * Math.random()).toString(16), // session hex
    "3": { title: "Sign in to Your Epic Games account | Epic Games", referrer: "https://store.epicgames.com/" },
    "4": true, // wasm support
    "5": {
      user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      platform: "Linux x86_64",
      language: "en-US",
      languages: ["en-US"],
      hardware_concurrency: [4, 6, 8, 12, 16][rInt(0, 4)],
      device_memory: [4, 8, 16][rInt(0, 2)],
      product: "Gecko",
      product_sub: "20030107",
      vendor: "Google Inc.",
      vendor_sub: "",
      webdriver: false,
      max_touch_points: 0,
      cookie_enabled: true,
      property_list: ["vendorSub","productSub","vendor","maxTouchPoints","scheduling","userActivation","geolocation","doNotTrack","webkitTemporaryStorage","webkitPersistentStorage","brave","globalPrivacyControl","hardwareConcurrency","cookieEnabled","appCodeName","appName","appVersion","platform","product","userAgent","language","languages","onLine","webdriver","plugins","mimeTypes","pdfViewerEnabled","getGamepads","javaEnabled","sendBeacon","vibrate","windowControlsOverlay","clipboard","credentials","keyboard","managed","mediaDevices","serviceWorker","virtualKeyboard","wakeLock","deviceMemory","userAgentData","locks","storage","gpu","ink","mediaCapabilities","devicePosture","hid","mediaSession","permissions","presentation","serial","usb","xr","storageBuckets","clearAppBadge","getBattery","getUserMedia","requestMIDIAccess","requestMediaKeySystemAccess","setAppBadge","webkitGetUserMedia","getInstalledRelatedApps","registerProtocolHandler","unregisterProtocolHandler"]
    },
    "6": {
      canvas_fingerprint: { length: rInt(38000, 42000), num_colors: rInt(4500, 5500), md5: rMd5(), tlsh: rHex(70) },
      parameters: { renderer: "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 5070/PCIe/SSE2, OpenGL ES 3.2)", vendor: "Google Inc. (NVIDIA Corporation)" }
    },
    "7": {
      location: { origin: "https://www.epicgames.com", pathname: "/id/login", href: "https://www.epicgames.com/id/login?lang=en-US&noHostRedirect=true&redirectUrl=https%3A%2F%2Fstore.epicgames.com&client_id=875a3b57d3a640a6b7f9b4e883463ab4" },
      history: { length: rInt(1, 5) },
      screen: (() => { let s = [[1920,1080,1920,1040],[2560,1440,2560,1400],[1680,1050,1680,1050],[3840,2160,3840,2120],[1920,1200,1920,1160]][rInt(0,4)]; return { avail_height: s[3], avail_width: s[2], avail_top: 0, height: s[1], width: s[0], color_depth: 24 } })(),
      performance: {
        memory: { js_heap_size_limit: 4294967296, total_js_heap_size: rInt(80000000, 120000000), used_js_heap_size: rInt(70000000, 100000000) },
        resources: [
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/Inter-Bold-CuhepTt8.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/Inter-Light-CdXm_ABL.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/Inter-Medium-P1cOs5ep.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/Inter-Regular-CKDp9E3C.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/InterTight-Bold-CPdZBAQJ.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/InterTight-Black-CBljiM1E.woff2",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-CTGxZpYh.css",
          "https://js.hcaptcha.com/1/api.js?render=explicit&uj=true",
          "https://tracking.epicgames.com/tracking.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/ie11-DWPE05iu.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/es.array.from-D2bceaHy.js",
          "https://www.epicgames.com/id/api/i18n?ns=messages&lang=en-US",
          "https://www.epicgames.com/id/api/i18n?ns=epic-consent-dialog&lang=en-US",
          "https://www.epicgames.com/id/api/analytics",
          "https://sentry.io/api/1333512/envelope/?sentry_key=7a13b97c16f4455f92376d5c1e27f102&sentry_version=7&sentry_client=sentry.javascript.react%2F7.118.0",
          "https://www.epicgames.com/id/api/location",
          "https://www.epicgames.com/id/api/analytics",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/stable-BI7i-EoC.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-Cwkm408S.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/polyfill-DT_ELv6J.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/serviceWorker-B5BLWoif.js",
          "https://tracking.epicgames.com/track.png?referringUrl=https%3A%2F%2Fstore.epicgames.com%2F&location=https%3A%2F%2Fwww.epicgames.com%2Fid%2Flogin%3Flang%3Den-US%26noHostRedirect%3Dtrue%26redirectUrl%3Dhttps%253A%252F%252Fstore.epicgames.com%26client_id%3D875a3b57d3a640a6b7f9b4e883463ab4&now=" + t + "&eventType=pageView",
          "https://www.epicgames.com/id/api/analytics",
          "https://featureassets.org/v1/initialize?" + rk + "&t=" + (t + rInt(0, 20)) + "&sid=" + sid + "&se=1",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + (t + rInt(0, 20)) + "&sid=" + sid + "&ec=1&gz=1",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + (t + rInt(0, 20)) + "&sid=" + sid + "&ec=38&gz=1",
          "https://cloudflare-dns.com/dns-query",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + (t + rInt(150, 300)) + "&sid=" + sid + "&ec=1&gz=1",
          "https://static-assets-prod.unrealengine.com/account-portal/static/epic-favicon-96x96.png",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + (t + rInt(400, 700)) + "&sid=" + sid + "&ec=38&gz=1",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + (t + rInt(600, 900)) + "&sid=" + sid + "&ec=1&gz=1",
          "https://www.epicgames.com/id/api/analytics",
          "https://www.epicgames.com/id/api/client/875a3b57d3a640a6b7f9b4e883463ab4?redirectUrl=https%3A%2F%2Fstore.epicgames.com",
          "https://www.epicgames.com/id/api/authenticate",
          "https://www.epicgames.com/id/api/analytics",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/ModalBasePage-B39j0XK5.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/LoginPage-a3jn0sVD.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/EpicLogo-Dl28ccM1.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/TrackedListItemButton-CmLYrUBE.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/LoginIconButton-Cwdtz7hz.js",
          "https://static-assets-prod.unrealengine.com/account-portal/static/assets/disney-logo-small-Cjpb-NjC.js",
          "https://beyondwickedmapping.org/v1/rgstr?" + rk + "&t=" + t + "&sid=" + sid + "&ec=1&gz=1",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + t + "&sid=" + sid + "&ec=38&gz=1",
          "https://prodregistryv2.org/v1/rgstr?" + rk + "&t=" + t + "&sid=" + sid + "&ec=1&gz=1",
          "https://www.epicgames.com/id/api/analytics",
          "https://talon-website-prod.ecosec.on.epicgames.com/talon_sdk.js",
          "https://beyondwickedmapping.org/v1/rgstr?" + rk + "&t=" + (t + rInt(3500, 5000)) + "&sid=" + sid + "&ec=1&gz=1",
          "https://talon-service-prod.ecosec.on.epicgames.com/v1/init",
        ]
      },
      device_pixel_ratio: 1,
      dark_mode: true,
      chrome: true,
      property_list: ["0","1","2","window","self","document","name","location","customElements","history","navigation","locationbar","menubar","personalbar","scrollbars","statusbar","toolbar","status","closed","frames","length","top","opener","parent","frameElement","navigator","origin","external","screen","innerWidth","innerHeight","scrollX","pageXOffset","scrollY","pageYOffset","visualViewport","screenX","screenY","outerWidth","outerHeight","devicePixelRatio","event","clientInformation","screenLeft","screenTop","styleMedia","onsearch","onappinstalled","onbeforeinstallprompt","onabort","onbeforeinput","onbeforematch","onbeforetoggle","onblur","oncancel","oncanplay","oncanplaythrough","onchange","onclick","onclose","oncommand","oncontentvisibilityautostatechange","oncontextlost","oncontextmenu","oncontextrestored","oncuechange","ondblclick","ondrag","ondragend","ondragenter","ondragleave","ondragover","ondragstart","ondrop","ondurationchange","onemptied","onended","onerror","onfocus","onformdata","oninput","oninvalid","onkeydown","onkeypress","onkeyup","onload","onloadeddata","onloadedmetadata","onloadstart","onmousedown","onmouseenter","onmouseleave","onmousemove","onmouseout","onmouseover","onmouseup","onmousewheel","onpause","onplay","onplaying","onprogress","onratechange","onreset","onresize","onscroll","onscrollend","onsecuritypolicyviolation","onseeked","onseeking","onselect","onslotchange","onstalled","onsubmit","onsuspend","ontimeupdate","ontoggle","onvolumechange","onwaiting","onwebkitanimationend","onwebkitanimationiteration","onwebkitanimationstart","onwebkittransitionend","onwheel","onauxclick","ongotpointercapture","onlostpointercapture","onpointerdown","onpointermove","onpointerup","onpointercancel","onpointerover","onpointerout","onpointerenter","onpointerleave","onselectstart","onselectionchange","onanimationend","onanimationiteration","onanimationstart","ontransitionrun","ontransitionstart","ontransitionend","ontransitioncancel","onbeforexrselect","onafterprint","onbeforeprint","onbeforeunload","onhashchange","onlanguagechange","onmessage","onmessageerror","onoffline","ononline","onpagehide","onpageshow","onpopstate","onrejectionhandled","onstorage","onunhandledrejection","onunload","isSecureContext","crossOriginIsolated","scheduler","performance","trustedTypes","crypto","indexedDB","localStorage","sessionStorage","alert","atob","blur","btoa","cancelAnimationFrame","cancelIdleCallback","captureEvents","clearInterval","clearTimeout","close","confirm","createImageBitmap","fetch","find","focus","getComputedStyle","getSelection","matchMedia","moveBy","moveTo","open","postMessage","print","prompt","queueMicrotask","releaseEvents","reportError","requestAnimationFrame","requestIdleCallback","resizeBy","resizeTo","scroll","scrollBy","scrollTo","setInterval","setTimeout","stop","structuredClone","webkitCancelAnimationFrame","webkitRequestAnimationFrame","chrome","cookieStore","ondevicemotion","ondeviceorientation","ondeviceorientationabsolute","onpointerrawupdate","caches","documentPictureInPicture","fetchLater","getScreenDetails","queryLocalFonts","originAgentCluster","viewport","onpageswap","onpagereveal","credentialless","launchQueue","speechSynthesis","onscrollsnapchange","onscrollsnapchanging","ongamepadconnected","ongamepaddisconnected","webkitRequestFileSystem","webkitResolveLocalFileSystemURL","AppInit","_epicEnableCookieGuard","__tracking_base","_sentryDebugIds","_sentryDebugIdIdentifier","SENTRY_RELEASE","__axiosInstance","__core-js_shared__","core","regeneratorRuntime","__axiosInstanceCached","IMask","__STATSIG__","__store","__SENTRY__","MotionHandoffIsComplete","clearImmediate","setImmediate","_epicTrackingCookieDomainId","_epicTrackingCountryCode","_epicTracking","Raven","hcaptcha","grecaptcha","a0_0x22cc","a0_0x4778","talon","k","i","TEMPORARY","PERSISTENT","addEventListener","dispatchEvent","removeEventListener","when"]
    },
    "8": { timezone_offset: -540, format: { calendar: "gregory", day: "numeric", locale: "en-US", month: "numeric", numbering_system: "latn", time_zone: "Asia/Tokyo", year: "numeric" } },
    "9": { sd_recurse: false },
    "10": { 
      version: "3.4.2",
      visitor_id: rHex(32),
      confidence: 0.7,
      hashes: { fonts: rMd5(), plugins: rMd5(), audio: rMd5(), canvas: rMd5(), screen: rMd5() }
    },
    "11": { // mouse + keyboard events
      mousemove: me.moves, mousedown: me.downs, mouseup: me.ups,
      wheel: [], touchstart: [], touchend: [], touchmove: [], scroll: [],
      keydown: ke.kd, keyup: ke.ku, resize: [], paste: []
    },
    "12": { caller_stack_trace: "Error\n    at https://talon-website-prod.ecosec.on.epicgames.com/talon_sdk.js:1:464234\n    at Object._0x5531e0 [as execute] (https://talon-website-prod.ecosec.on.epicgames.com/talon_sdk.js:1:464402)\n    at Talon.updateIfNeeded (https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:599:38458)\n    at Captcha.updateIfNeeded (https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:599:40978)\n    at LoginFormSplit.<anonymous> (https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:607:38717)\n    at Generator.next (<anonymous>)\n    at https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:2:975\n    at new Promise (<anonymous>)\n    at wr (https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:2:764)\n    at https://static-assets-prod.unrealengine.com/account-portal/static/assets/index-BQILlIsr.js:607:38518" },
    "13": null, // boron
    "14": solved // captcha result
  }
}

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

function encode(fp) {
  let rng = mt19937(Math.floor(Date.now() / 1000))
  let random = rng()
  let values = Object.values(fp)
  let shuffled = [...values]
  let sr = mt19937(random)
  for (let i = shuffled.length - 1; i > 0; i--) {
    let j = sr() % (i + 1); let tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
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
  return Buffer.from(cat(new Uint8Array(nonce.buffer), u32le(random), enc)).toString("base64")
}

let fp = generate()
let xal = encode(fp)
console.log(JSON.stringify({ xal, ewa: "b", kid: "Yjqmlr" }))
