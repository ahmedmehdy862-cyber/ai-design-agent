#!/usr/bin/env node
/* =========================================================================
   مِرسم — mirsam-bridge.js
   A thin, local-only companion so a design made in the browser can be
   written straight to disk as a layered PSD and opened in the real desktop
   app (Photoshop / PhotoCraft). It is NOT a live control channel into Adobe:
   it writes files, nothing else.

   Security model (all four are enforced, not documented hopes):
     · binds 127.0.0.1 only (never 0.0.0.0, never a LAN address)
     · every POST needs the shared token (x-mirsam-token), compared in
       constant time; the token is generated per run unless provided
     · the browser Origin must be in the allowlist; a disallowed origin gets
       403 and no CORS grant, so a random website cannot drive the bridge
     · Chrome Private Network Access preflight is answered explicitly
     · file names are sanitised and resolved inside the output directory;
       bodies, layer count and dimensions are capped

   Zero npm dependencies: Node core + the vendored ag-psd already in
   web/vendor/ag-psd.js (the same library the browser export uses, so the
   layer contract cannot drift between the two paths).

   RUN:
     node bridge/mirsam-bridge.js
     MIRSAM_BRIDGE_TOKEN=... MIRSAM_BRIDGE_PORT=8731 node bridge/mirsam-bridge.js
   ========================================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const VERSION = '1.0.0';
const HOST = '127.0.0.1';
const PORT = Number(process.env.MIRSAM_BRIDGE_PORT || 8731);
const OUT_DIR = path.resolve(process.env.MIRSAM_BRIDGE_OUT || path.join(__dirname, 'out'));
const MAX_BODY = Number(process.env.MIRSAM_BRIDGE_MAX_BODY || 96 * 1024 * 1024);
const MAX_LAYERS = 64;
const MAX_SIDE = 8192;

const TOKEN = process.env.MIRSAM_BRIDGE_TOKEN || crypto.randomBytes(18).toString('base64url');
const TOKEN_GENERATED = !process.env.MIRSAM_BRIDGE_TOKEN;

/* ---- origins a browser may call from ---------------------------------- */
const ORIGIN_RULES = [
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,
  /^https:\/\/ai-design-agent[a-z0-9-]*\.vercel\.app$/
];
for (const o of (process.env.MIRSAM_BRIDGE_ORIGINS || '').split(',')) {
  if (o.trim()) ORIGIN_RULES.push(new RegExp('^' + o.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
}

const agPsd = require(path.join(__dirname, '..', 'web', 'vendor', 'ag-psd.js'));

/* ======================= PNG decoding (no libraries) ==================== */
function dataURLToBuffer(u) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(u || ''));
  if (!m) throw httpError(400, 'layer must be a data:image/png;base64 URL');
  const buf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
  if (!buf.length) throw httpError(400, 'empty layer image');
  return buf;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

function decodePNG(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw httpError(400, 'not a PNG (bad signature)');
  }
  let off = 8, width = 0, height = 0, depth = 0, colorType = -1, interlace = 0;
  const idat = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0) throw httpError(400, 'unknown PNG compression/filter method');
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!width || !height) throw httpError(400, 'PNG has no IHDR');
  if (width > MAX_SIDE || height > MAX_SIDE) throw httpError(413, `layer too large (${width}x${height}, max ${MAX_SIDE})`);
  if (interlace !== 0) throw httpError(400, 'interlaced PNG is not supported — canvas.toDataURL() writes non-interlaced');
  if (depth !== 8) throw httpError(400, `only 8-bit PNG is supported (got ${depth}-bit)`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw httpError(400, `unsupported PNG colour type ${colorType} (palette is not needed by the app)`);
  if (!idat.length) throw httpError(400, 'PNG has no IDAT');

  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); }
  catch (e) { throw httpError(400, 'PNG IDAT is not valid deflate data'); }

  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw httpError(400, 'PNG pixel data is truncated');
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const src = y * (stride + 1);
    const dst = y * stride;
    const prev = dst - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + 1 + x];
      const a = x >= channels ? px[dst + x - channels] : 0;
      const b = y > 0 ? px[prev + x] : 0;
      const c = (y > 0 && x >= channels) ? px[prev + x - channels] : 0;
      let out;
      switch (ft) {
        case 0: out = v; break;
        case 1: out = (v + a) & 255; break;
        case 2: out = (v + b) & 255; break;
        case 3: out = (v + ((a + b) >> 1)) & 255; break;
        case 4: out = (v + paeth(a, b, c)) & 255; break;
        default: throw httpError(400, `unknown PNG filter type ${ft}`);
      }
      px[dst + x] = out;
    }
  }

  /* expand to straight RGBA, the shape ag-psd expects */
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * channels, d = i * 4;
    if (channels === 4) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = px[s + 3]; }
    else if (channels === 3) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = 255; }
    else if (channels === 2) { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = px[s + 1]; }
    else { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = 255; }
  }
  return { width, height, data: rgba };
}

/* =========================== helpers ==================================== */
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

function safeBaseName(raw) {
  const cleaned = String(raw || 'mirsam-bridge')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .slice(0, 80);
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'mirsam-bridge';
  return cleaned;
}

function insideOut(target) {
  const rel = path.relative(OUT_DIR, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw httpError(400, 'unsafe output path');
  return target;
}

function originAllowed(origin) {
  if (!origin) return true; /* curl / node / tests: no Origin header at all */
  return ORIGIN_RULES.some(re => re.test(origin));
}

function corsHeaders(origin) {
  if (!origin || !originAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-mirsam-token',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin, Access-Control-Request-Private-Network'
  };
}

function tokenOk(given) {
  const a = Buffer.from(String(given || ''), 'utf8');
  const b = Buffer.from(TOKEN, 'utf8');
  if (a.length !== b.length) {
    /* still burn a comparison so the failure is not measurably faster */
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(httpError(413, `body exceeds ${Math.round(MAX_BODY / 1048576)}MB`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJSON(res, status, obj, cors) {
  const body = Buffer.from(JSON.stringify(obj, null, 2), 'utf8');
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, cors));
  res.end(body);
}

/* =========================== the one real job =========================== */
function writeDesign(req) {
  const canvas = Array.isArray(req.canvas) ? req.canvas.map(Number) : [];
  const [W, H] = canvas;
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < 16 || H < 16 || W > MAX_SIDE || H > MAX_SIDE) {
    throw httpError(400, `canvas must be [width,height] between 16 and ${MAX_SIDE}`);
  }
  const layers = Array.isArray(req.layers) ? req.layers : [];
  if (!layers.length) throw httpError(400, 'no layers');
  if (layers.length > MAX_LAYERS) throw httpError(413, `too many layers (${layers.length} > ${MAX_LAYERS})`);

  /* layers arrive topmost-first (the same order buildPSD builds), and are
     reversed into ag-psd's bottom-up record order */
  const decoded = layers.map((l, i) => {
    const img = decodePNG(dataURLToBuffer(l && l.dataURL));
    if (img.width !== W || img.height !== H) {
      throw httpError(400, `layer ${i + 1} is ${img.width}x${img.height}, canvas is ${W}x${H}`);
    }
    const name = String((l && l.name) || `layer ${i + 1}`).replace(/[\u0000-\u001f]/g, ' ').slice(0, 160).trim() || `layer ${i + 1}`;
    return {
      img,
      name,
      opacity: Math.min(1, Math.max(0, Number(l && l.opacity != null ? l.opacity : 1))),
      hidden: !!(l && l.hidden)
    };
  });

  const children = decoded.slice().reverse().map(d => ({
    name: d.name,
    imageData: d.img,
    opacity: d.opacity,
    hidden: d.hidden,
    blendMode: 'normal'
  }));

  const psd = {
    width: W, height: H, channels: 4, depth: 8, bitsPerChannel: 8,
    children
  };
  let written;
  try { written = agPsd.writePsd(psd, {}); }
  catch (e) { throw httpError(500, 'ag-psd failed to write: ' + e.message); }
  const psdBuf = Buffer.from(written instanceof ArrayBuffer ? written : (written.buffer || written));
  if (psdBuf.length < 26 || psdBuf.toString('ascii', 0, 4) !== '8BPS') {
    throw httpError(500, 'ag-psd produced an invalid PSD signature');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = safeBaseName(req.name);
  const psdPath = insideOut(path.join(OUT_DIR, base + '.psd'));
  fs.writeFileSync(psdPath, psdBuf);

  const files = [{ kind: 'psd', name: base + '.psd', bytes: psdBuf.length }];

  /* the plan/manifest travels with the PSD so the file set is self-describing */
  if (req.manifest && typeof req.manifest === 'object') {
    const doc = {
      format: 'mirsam-bridge@1',
      bridge: { version: VERSION, generated: new Date().toISOString(), canvas: [W, H] },
      layers: decoded.map((d, i) => ({ index: i + 1, name: d.name, opacity: d.opacity, hidden: d.hidden })),
      plan: req.manifest
    };
    const jsonBuf = Buffer.from(JSON.stringify(doc, null, 2), 'utf8');
    const jsonPath = insideOut(path.join(OUT_DIR, base + '.json'));
    fs.writeFileSync(jsonPath, jsonBuf);
    files.push({ kind: 'json', name: base + '.json', bytes: jsonBuf.length });
  }
  /* optional vector sidecar, if the page sends the same SVG it exported */
  if (typeof req.svg === 'string' && req.svg.trim().startsWith('<svg')) {
    const svgBuf = Buffer.from(req.svg, 'utf8');
    const svgPath = insideOut(path.join(OUT_DIR, base + '.svg'));
    fs.writeFileSync(svgPath, svgBuf);
    files.push({ kind: 'svg', name: base + '.svg', bytes: svgBuf.length });
  }

  return {
    ok: true,
    canvas: [W, H],
    layers: decoded.length,
    psd: { name: base + '.psd', path: psdPath, bytes: psdBuf.length },
    files,
    dir: OUT_DIR
  };
}

/* =============================== server ================================= */
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const origin = req.headers.origin || '';
  const cors = corsHeaders(origin);
  let status = 500;
  let note = '';

  try {
    if (!originAllowed(origin)) {
      status = 403;
      note = 'origin denied';
      return sendJSON(res, 403, { ok: false, error: 'origin-not-allowed' }, {});
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (req.method === 'OPTIONS') {
      /* Chrome PNA: the preflight only succeeds if this header is present */
      status = 204;
      res.writeHead(204, Object.assign({ 'Content-Length': '0' }, cors));
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      status = 200;
      return sendJSON(res, 200, {
        ok: true, app: 'mirsam-bridge', version: VERSION,
        uptime: Math.round(process.uptime()),
        tokenRequired: true
      }, cors);
    }

    if (req.method === 'POST' && url.pathname === '/v1/design') {
      if (!tokenOk(req.headers['x-mirsam-token'])) {
        status = 401;
        note = 'token rejected';
        return sendJSON(res, 401, { ok: false, error: 'unauthorized' }, cors);
      }
      const ct = String(req.headers['content-type'] || '');
      if (!/^application\/json/i.test(ct)) {
        status = 415;
        return sendJSON(res, 415, { ok: false, error: 'content-type must be application/json' }, cors);
      }
      const raw = await readBody(req);
      let body;
      try { body = JSON.parse(raw.toString('utf8')); }
      catch { status = 400; return sendJSON(res, 400, { ok: false, error: 'invalid JSON' }, cors); }
      const out = writeDesign(body);
      status = 200;
      note = `${out.layers} layers · ${out.psd.bytes} B`;
      return sendJSON(res, 200, out, cors);
    }

    status = 404;
    return sendJSON(res, 404, { ok: false, error: 'not-found' }, cors);
  } catch (e) {
    status = e.status || 500;
    note = e.message;
    if (!res.headersSent) {
      sendJSON(res, status, {
        ok: false,
        error: e.expose ? e.message : 'bridge-error',
        detail: e.expose ? undefined : String(e.message || e).slice(0, 200)
      }, cors);
    }
  } finally {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} · ${status} · ${origin || 'no-origin'} · ${Date.now() - started}ms${note ? ' · ' + note : ''}`);
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log('مِرسم bridge · v' + VERSION);
  console.log('  listening   http://' + HOST + ':' + PORT + '   (loopback only)');
  console.log('  token       ' + TOKEN + (TOKEN_GENERATED ? '   (generated for this run)' : '   (from MIRSAM_BRIDGE_TOKEN)'));
  console.log('  output      ' + OUT_DIR);
  console.log('  origins     ' + ORIGIN_RULES.map(r => String(r).replace(/^\^|\$$/g, '')).join('  ·  '));
  console.log('  endpoints   GET /health · POST /v1/design');
});
