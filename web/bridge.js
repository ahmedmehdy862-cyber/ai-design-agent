/* =========================================================================
   مِرسم — bridge.js
   Optional "desktop bridge": hands the current design to the local companion
   (bridge/mirsam-bridge.js) which writes a layered PSD to disk and can open
   it in the real Photoshop. Everything here is opt-in: no bridge running =
   the download path above still works exactly as before, and nothing is sent
   anywhere. The token lives in localStorage on this device only.
   Loads after studio.js (uses esc/mStatus-style helpers when present).
   ========================================================================= */
'use strict';

const BRIDGE_DEFAULT = 'http://127.0.0.1:8731';
const $b = id => document.getElementById(id);

function loadBridgeCfg() {
  try {
    const c = JSON.parse(localStorage.getItem('mirsam.bridge') || '{}');
    return {
      endpoint: (c.endpoint || BRIDGE_DEFAULT).replace(/\/+$/, ''),
      token: c.token || '',
      autoOpen: !!c.autoOpen
    };
  } catch { return { endpoint: BRIDGE_DEFAULT, token: '', autoOpen: false }; }
}
function saveBridgeCfg(cfg) { localStorage.setItem('mirsam.bridge', JSON.stringify(cfg)); }

function bridgeStatus(msg, cls = '') {
  const el = $b('bridgeStatus');
  if (el) { el.className = 'status ' + cls; el.textContent = msg; }
}

function readBridgeCfgFromUI() {
  const cfg = {
    endpoint: (($b('bridgeEndpoint') || {}).value || BRIDGE_DEFAULT).trim().replace(/\/+$/, ''),
    token: (($b('bridgeToken') || {}).value || '').trim()
  };
  saveBridgeCfg(cfg);
  return cfg;
}

/* a design is ready only when a plan and its rendered canvas exist */
function bridgeReady() { return !!(typeof lastPlan !== 'undefined' && lastPlan && typeof lastCanvas !== 'undefined' && lastCanvas); }

async function bridgePing() {
  const cfg = readBridgeCfgFromUI();
  bridgeStatus('أفحص الجسر…', 'pending');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(cfg.endpoint + '/health', { signal: ctrl.signal, headers: { 'x-mirsam-token': cfg.token } });
    clearTimeout(t);
    if (!res.ok) throw new Error('ردّ ' + res.status);
    const j = await res.json();
    bridgeStatus(`✔ الجسر يعمل · v${j.version} · ${cfg.endpoint}`, 'ok');
    return j;
  } catch (e) {
    const why = e.name === 'AbortError' ? 'لم يردّ خلال 4 ثوانٍ' : e.message;
    bridgeStatus(`لا جسر على ${cfg.endpoint} — ${why}. شغّله: node bridge/mirsam-bridge.js`, 'err');
    throw e;
  }
}

/* the exact same layer contract as buildPSD: one full-canvas PNG per visible
   element (topmost first), then the background last — the bridge reverses
   the array into ag-psd's bottom-up order */
async function bridgeLayerPayload(plan) {
  const [W, H] = plan.canvas;
  const layers = [];
  for (let i = plan.elements.length - 1; i >= 0; i--) {
    const el = plan.elements[i];
    if (el.hidden) continue;
    /* eslint-disable-next-line no-await-in-loop */
    const lc = await layerPNGAt(plan, i, 1);
    layers.push({
      name: `${String(i + 1).padStart(2, '0')} ${el.role}`,
      dataURL: lc.toDataURL('image/png'),
      opacity: el.opacity != null ? el.opacity : 1,
      hidden: false
    });
  }
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const ctx = bg.getContext('2d');
  ctx.fillStyle = plan.palette.bg;
  ctx.fillRect(0, 0, W, H);
  layers.push({ name: '00 background', dataURL: bg.toDataURL('image/png'), opacity: 1, hidden: false });

  const manifest = {
    canvas: plan.canvas,
    palette: plan.palette,
    grid: plan.grid,
    focal: plan.focal,
    typeScale: plan.typeScale,
    meta: plan.meta,
    elements: plan.elements.map(el => ({
      key: el.key, role: el.role, kind: el.kind,
      text: el.text != null ? el.text : undefined,
      font: el.font, size: el.size, weight: el.weight,
      color: el.color, fill: el.fill, stroke: el.stroke
    }))
  };
  return { canvas: plan.canvas, layers, manifest };
}

async function bridgeSavePSD() {
  if (!bridgeReady()) { bridgeStatus('ولّد التصميم أولًا', 'err'); return null; }
  const cfg = readBridgeCfgFromUI();
  if (!cfg.token) {
    bridgeStatus('أدخل رمز الجسر (يطبعه الخادم عند التشغيل) ثم أعد المحاولة', 'err');
    return null;
  }
  const btn = $b('bridgeSave');
  if (btn) btn.disabled = true;
  bridgeStatus('أجهّز طبقات PNG وأرسلها إلى الجسر…', 'pending');
  const t0 = performance.now();
  try {
    const payload = await bridgeLayerPayload(lastPlan);
    payload.name = `mirsam-${payload.canvas[0]}x${payload.canvas[1]}`;
    bridgeStatus(`أرسل ${payload.layers.length} طبقة إلى ${cfg.endpoint}…`, 'pending');

    const res = await fetch(cfg.endpoint + '/v1/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mirsam-token': cfg.token },
      body: JSON.stringify(payload)
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || ('ردّ ' + res.status));
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    bridgeStatus(`✔ ${j.psd.name} — ${j.layers} طبقة · ${(j.psd.bytes / 1024).toFixed(0)} كيلوبايت · ${secs} ث · ${j.dir}`, 'ok');
    const out = $b('exportOut');
    if (out) {
      const pending = out.querySelector('.pending');
      if (pending) pending.remove();
      out.insertAdjacentHTML('beforeend',
        `<li>${esc ? esc(j.psd.name) : j.psd.name} <span class="done">PSD على القرص · ${j.layers} طبقة</span></li>`);
    }
    return j;
  } catch (e) {
    const help = /Failed to fetch|NetworkError/i.test(e.message)
      ? ' — الجسر غير مشغّل أو العنوان خاطئ (node bridge/mirsam-bridge.js)'
      : '';
    bridgeStatus('تعذّر الحفظ عبر الجسر: ' + e.message + help, 'err');
    return null;
  } finally {
    if (btn) btn.disabled = false;
  }
}

(function bindBridge() {
  const cfg = loadBridgeCfg();
  if ($b('bridgeEndpoint') && !$b('bridgeEndpoint').value) $b('bridgeEndpoint').value = cfg.endpoint;
  if ($b('bridgeToken') && cfg.token) $b('bridgeToken').value = cfg.token;
  if ($b('bridgeSave')) $b('bridgeSave').addEventListener('click', () => { bridgeSavePSD(); });
  if ($b('bridgePing')) $b('bridgePing').addEventListener('click', () => { bridgePing().catch(() => {}); });
  for (const id of ['bridgeEndpoint', 'bridgeToken']) {
    if ($b(id)) $b(id).addEventListener('change', () => readBridgeCfgFromUI());
  }
})();
