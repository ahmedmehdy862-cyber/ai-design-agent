/* =========================================================================
   مِرسم — inspector.js
   The layer inspector: every element of the plan (colour · opacity · size ·
   weight · alignment · visibility) plus pick-on-canvas and the designer's
   keyboard shortcuts. Edits live in `overrides` (app.js) and are re-applied
   on every plan build, so they survive regeneration and QA fixes.
   Loads after carousel.js.
   ========================================================================= */
'use strict';

const $i = id => document.getElementById(id);

const ROLE_NAMES = {
  headline: 'العنوان الرئيسي',
  subhead: 'النص الثانوي',
  kicker: 'السطر التمهيدي',
  'kicker-rule': 'خط السطر التمهيدي',
  'cta-chip': 'خلفية زر الدعوة',
  'cta-text': 'نص زر الدعوة',
  date: 'التاريخ / الموعد',
  item: 'بند القائمة',
  'quote-mark': 'علامة الاقتباس',
  badge: 'الشارة',
  'badge-text': 'نص الشارة',
  'accent-panel': 'اللوح اللوني',
  'accent-band': 'الشريط اللوني',
  'focal-deco': 'الزخرفة',
  'trim-frame': 'إطار القصّ',
  'image-frame': 'إطار الصورة',
  qr: 'رمز QR',
  icon: 'أيقونة'
};

const KIND_NAMES = {
  type: 'نص', rect: 'مستطيل', roundedRect: 'مستطيل مدوّر', ellipse: 'قرص',
  ring: 'حلقة', line: 'خط', outline: 'إطار',
  imageFrame: 'إطار صورة', qr: 'رمز QR', icon: 'أيقونة'
};

const KIND_COLORS = ['rect', 'roundedRect', 'ellipse'];
const STROKE_KINDS = ['line', 'ring', 'outline'];

const labelOf = el => {
  const [role, idx] = el.key.split('#');
  const name = ROLE_NAMES[role] || role;
  return idx ? `${name} ${arNum(Number(idx) + 1)}` : name;
};

let layerSig = '';
let selectedKey = null;

function colorOf(el) {
  if (el.kind === 'type') return el.color || '#000000';
  if (el.grad) return el.grad[0];
  return el.fill || el.stroke || '#000000';
}
const colorPropOf = el => (el.kind === 'type' ? 'color' : (STROKE_KINDS.includes(el.kind) ? 'stroke' : 'fill'));

function inspStatus(msg, cls = '') {
  const el = $i('inspStatus');
  if (el) { el.className = 'status ' + cls; el.textContent = msg; }
}

/* ---------------- overrides ---------------- */
function setOverride(key, patch, label) {
  pushUndo(key + ':' + Object.keys(patch).join(','));   /* P7: one step per edit */
  const cur = overrides[key] || (overrides[key] = {});
  Object.assign(cur, patch);
  for (const k of Object.keys(cur)) {
    const v = cur[k];
    if (v === null || v === undefined || v === '' || v === false) delete cur[k];
  }
  if (!Object.keys(cur).length) delete overrides[key];
  saveOverrides();   /* B8: survive a page refresh */
  inspStatus(`${label} — ${Object.keys(overrides).length ? 'حُفظ التعديل ويبقى بعد التوليد' : 'أُعيد العنصر لقيمته'}`, 'ok');
  debounced();
}

function resetAll() {
  if (Object.keys(overrides).length) pushUndo('reset-all');   /* P7: a reset is undoable */
  for (const k of Object.keys(overrides)) delete overrides[k];
  saveOverrides();   /* B8: clear the persisted copy too */
  layerSig = '';
  selectedKey = null;
  renderLayers(true);
  inspStatus('أُعيد كل العناصر لقيم التصميم الأصلية — تراجع Ctrl+Z يُرجعها', 'ok');
  generate();
}

function toggleHidden(key) {
  const cur = overrides[key];
  const hidden = !(cur && cur.hidden);
  setOverride(key, { hidden }, hidden ? 'أُخفي العنصر' : 'أُظهر العنصر');
}

/* ---------------- rows ---------------- */
function layerRow(el) {
  const o = overrides[el.key] || {};
  const isType = el.kind === 'type';
  const op = Math.round((o.opacity != null ? o.opacity : (el.opacity != null ? el.opacity : 1)) * 100);
  const sizeF = o.sizeF || 1;
  const color = o.color || colorOf(el);
  const weight = o.weight || el.weight || 700;
  const align = o.align || el.align || 'right';

  const isFrame = el.kind === 'imageFrame';
  const isQR = el.kind === 'qr';

  const sizeCtl = isType ? `
      <label class="lay-ctl" title="حجم النص بالنسبة لحجم التصميم">
        <span>الحجم</span>
        <input type="range" data-act="sizeF" min="45" max="200" step="5" value="${Math.round(sizeF * 100)}">
        <b class="lay-num">${arNum(Math.round(sizeF * 100))}٪</b>
      </label>
      <label class="lay-ctl" title="وزن الخط">
        <span>الوزن</span>
        <select data-act="weight">
          ${[300, 400, 600, 700, 800, 900].map(w => `<option value="${w}"${w === weight ? ' selected' : ''}>${w}</option>`).join('')}
        </select>
      </label>
      <div class="segmented lay-align" role="group" aria-label="المحاذاة" title="محاذاة النص">
        <button type="button" data-act="align" data-align="right" class="${align === 'right' ? 'on' : ''}">يمين</button>
        <button type="button" data-act="align" data-align="center" class="${align === 'center' ? 'on' : ''}">وسط</button>
        <button type="button" data-act="align" data-align="left" class="${align === 'left' ? 'on' : ''}">يسار</button>
      </div>` : (isFrame || isQR) ? '' : `
      <span class="lay-note">${KIND_NAMES[el.kind] || el.kind}${el.bleed ? ' · full-bleed' : ''}</span>`;

  /* frame / QR rows carry their own controls instead of a colour swatch */
  const mediaCtl = isFrame ? `
      <label class="lay-ctl" title="موضع الإطار داخل التصميم">
        <span>الموضع</span>
        <select data-act="frameSlot">
          ${Object.keys(FRAME_SLOTS).map(k =>
            `<option value="${k}"${(mediaStore.frame && (mediaStore.frame.slot || 'left-panel') === k) ? ' selected' : ''}>${FRAME_SLOTS[k]}</option>`).join('')}
        </select>
      </label>
      <label class="lay-ctl" title="كيف تُملأ الصورة داخل الإطار">
        <span>الملء</span>
        <select data-act="frameFit">
          <option value="cover"${mediaStore.frame && mediaStore.frame.fit === 'contain' ? '' : ' selected'}>قصّ (ملء الإطار)</option>
          <option value="contain"${mediaStore.frame && mediaStore.frame.fit === 'contain' ? ' selected' : ''}>احتواء (إظهار كاملة)</option>
        </select>
      </label>
      <label class="lay-ctl lay-file" title="استبدال الصورة من جهازك">
        <span>الصورة</span>
        <input type="file" data-act="frameFile" accept="image/*">
      </label>` : isQR ? `
      <label class="lay-ctl lay-qr" title="محتوى الرمز (رابط أو نص قصير)">
        <span>المحتوى</span>
        <input type="text" data-act="qrText" dir="ltr" value="${esc(el.data || '')}">
      </label>
      <label class="lay-ctl lay-color" title="لون وحدات الرمز">
        <span>اللون</span>
        <input type="color" data-act="color" value="${color}">
        <b class="lay-num" dir="ltr">${color}</b>
      </label>` : '';

  const colorCtl = (isFrame || isQR) ? '' : `
      <label class="lay-ctl lay-color" title="لون العنصر">
        <span>اللون</span>
        <input type="color" data-act="color" value="${color}">
        <b class="lay-num" dir="ltr">${color}</b>
      </label>`;

  const noteCtl = (isFrame || isQR)
    ? `<span class="lay-note">${KIND_NAMES[el.kind] || el.kind}${el.bleed ? ' · full-bleed' : ''}</span>` : '';

  return `
  <div class="layer${o.hidden ? ' off' : ''}${selectedKey === el.key ? ' sel' : ''}" data-key="${esc(el.key)}" tabindex="0"
       title="${esc(labelOf(el))} — ${KIND_NAMES[el.kind] || el.kind}">
    <div class="lay-top">
      <button type="button" class="lay-vis" data-act="vis" title="إظهار / إخفاء الطبقة">${o.hidden ? '🚫' : '👁'}</button>
      <span class="lay-name">${esc(labelOf(el))}</span>
      <span class="lay-kind">${KIND_NAMES[el.kind] || el.kind}</span>
      <button type="button" class="lay-reset" data-act="reset" title="إعادة هذا العنصر وحده">↺</button>
    </div>
    <div class="lay-body">
      ${colorCtl}
      ${mediaCtl}
      <label class="lay-ctl" title="شفافية العنصر">
        <span>الشفافية</span>
        <input type="range" data-act="opacity" min="0" max="100" step="1" value="${op}">
        <b class="lay-num">${arNum(op)}٪</b>
      </label>
      ${sizeCtl}
      ${noteCtl}
    </div>
  </div>`;
}

function renderLayers(force) {
  const box = $i('layers');
  if (!box) return;
  if (!lastPlan) {
    box.innerHTML = '<p class="lay-empty">ولّد التصميم لعرض طبقاته.</p>';
    layerSig = '';
    return;
  }
  const sig = lastPlan.elements.map(e => e.key).join('|');
  if (force || sig !== layerSig || !box.dataset.built) {
    box.innerHTML = lastPlan.elements.map(layerRow).join('');
    box.dataset.built = '1';
    layerSig = sig;
  } else {
    /* in-place refresh: never rebuild while a slider is being dragged */
    for (const row of box.querySelectorAll('.layer')) {
      const el = lastPlan.elements.find(e => e.key === row.dataset.key);
      if (!el) continue;
      const o = overrides[el.key] || {};
      row.classList.toggle('off', !!o.hidden);
      row.classList.toggle('sel', selectedKey === el.key);
      const vis = row.querySelector('.lay-vis');
      if (vis) vis.textContent = o.hidden ? '🚫' : '👁';
      const color = row.querySelector('[data-act="color"]');
      if (color && document.activeElement !== color) color.value = (o.color || colorOf(el));
      const op = row.querySelector('[data-act="opacity"]');
      if (op && document.activeElement !== op) {
        const v = Math.round((o.opacity != null ? o.opacity : (el.opacity != null ? el.opacity : 1)) * 100);
        op.value = v;
        const num = op.parentElement.querySelector('.lay-num');
        if (num) num.textContent = arNum(v) + '٪';
      }
    }
  }
}

/* ---------------- events (delegated) ---------------- */
function bindInspector() {
  const box = $i('layers');
  if (!box) return;

  box.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    const row = e.target.closest('.layer');
    if (!row) return;
    const key = row.dataset.key;
    selectLayer(key, false);
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'vis') toggleHidden(key);
    else if (act === 'reset') { delete overrides[key]; inspStatus('أُعيد العنصر', 'ok'); renderLayers(true); generate(); }
    else if (act === 'align') {
      setOverride(key, { align: btn.dataset.align }, 'المحاذاة');
      renderLayers(true);
    }
  });

  box.addEventListener('input', e => {
    const t = e.target;
    const row = t.closest('.layer');
    if (!row || !t.dataset.act) return;
    const key = row.dataset.key;
    const act = t.dataset.act;

    if (act === 'color') {
      setOverride(key, { color: t.value.toUpperCase() }, 'اللون');
      const num = row.querySelector('.lay-color .lay-num');
      if (num) num.textContent = t.value.toUpperCase();
    } else if (act === 'opacity') {
      setOverride(key, { opacity: Number(t.value) / 100 }, 'الشفافية');
      const num = t.parentElement.querySelector('.lay-num');
      if (num) num.textContent = arNum(t.value) + '٪';
    } else if (act === 'sizeF') {
      setOverride(key, { sizeF: Number(t.value) / 100 }, 'الحجم');
      const num = t.parentElement.querySelector('.lay-num');
      if (num) num.textContent = arNum(t.value) + '٪';
    }
  });

  box.addEventListener('change', e => {
    const t = e.target;
    const row = t.closest('.layer');
    if (!row || !t.dataset.act) return;
    const act = t.dataset.act;

    if (act === 'weight') { setOverride(row.dataset.key, { weight: Number(t.value) }, 'الوزن'); return; }

    /* placed media edits change the plan itself, not an override */
    if (act === 'frameSlot') {
      if (patchFrame({ slot: t.value })) { inspStatus('حُدِّث موضع الإطار — الصورة والنص أُعيد توزيعهما', 'ok'); generate(); }
      else inspStatus('ارفع صورة إلى الإطار أولًا', '');
      return;
    }
    if (act === 'frameFit') {
      if (patchFrame({ fit: t.value })) { inspStatus('حُدِّط ملء الصورة داخل الإطار', 'ok'); generate(); }
      return;
    }
    if (act === 'frameFile') {
      const f = t.files && t.files[0];
      if (!f) return;
      addFrameImage(f).then(() => {
        renderLayers(true);
        inspStatus('استُبدلت صورة الإطار', 'ok');
        generate();
      }).catch(err => inspStatus('تعذّر: ' + err.message, 'err'));
      return;
    }
    if (act === 'qrText') {
      try {
        const r = setQR(t.value);
        inspStatus(r ? 'حُدِّث محتوى رمز QR' : 'أُزيل رمز QR من التصميم', 'ok');
      } catch (err) {
        inspStatus('تعذّر: ' + err.message, 'err');
      }
      renderLayers(true);
      generate();
      return;
    }
  });

  box.addEventListener('focusin', e => {
    const row = e.target.closest('.layer');
    if (row) selectLayer(row.dataset.key, false);
  });

  const reset = $i('inspReset');
  if (reset) reset.addEventListener('click', resetAll);
}

function selectLayer(key, scroll = true) {
  selectedKey = key;
  const box = $i('layers');
  if (!box) return;
  for (const row of box.querySelectorAll('.layer')) row.classList.toggle('sel', row.dataset.key === key);
  if (scroll) {
    const row = box.querySelector(`.layer[data-key="${CSS.escape(key)}"]`);
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ---------------- pick an element on the canvas ---------------- */
function bboxOf(el, plan) {
  const [W, H] = plan.canvas;
  if (el.rect) {
    const [x, y, w, h] = el.rect;
    return [x, y, x + w, y + h];
  }
  if (el.kind === 'ring') return [el.cx - el.r, el.cy - el.r, el.cx + el.r, el.cy + el.r];
  if (el.kind === 'line') {
    const pad = (el.width || 2) / 2;
    return [Math.min(el.x1, el.x2) - pad, Math.min(el.y1, el.y2) - pad,
      Math.max(el.x1, el.x2) + pad, Math.max(el.y1, el.y2) + pad];
  }
  if (el.kind === 'type') {
    const maxW = el.maxW || (W - plan.grid.margin * 2);
    const lines = wrapLines(el.text, maxW, el.font, el.size, el.weight);
    measureCtx.font = `${el.weight} ${el.size}px ${el.font}, 'Segoe UI', Tahoma, Arial, sans-serif`;
    const w = Math.min(maxW, Math.max(...lines.map(l => measureCtx.measureText(l).width)));
    const x0 = el.align === 'center' ? el.x - w / 2 : (el.align === 'left' ? el.x : el.x - w);
    const lead = el.leading || el.size * 1.34;
    const h = (lines.length - 1) * lead + el.size * 1.15;
    const y0 = el.y - el.size * 0.92;
    return [x0, y0, x0 + w, y0 + h];
  }
  return null;
}

function pickElement(nx, ny) {
  const plan = lastPlan;
  if (!plan) return null;
  const [W, H] = plan.canvas;
  const px = nx * W, py = ny * H;
  let contained = null, containedArea = Infinity;
  let nearest = null, nearestD = Infinity;

  for (const el of plan.elements) {
    if (el.hidden) continue;
    const bb = bboxOf(el, plan);
    if (!bb) continue;
    const [x0, y0, x1, y1] = bb;
    const area = (x1 - x0) * (y1 - y0);
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1 && area < containedArea) {
      contained = el; containedArea = area;
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const d = Math.hypot(px - cx, py - cy);
    if (d < nearestD) { nearestD = d; nearest = el; }
  }
  if (contained) return contained;
  /* forgiving pick: within ~7% of the short side */
  const threshold = Math.min(W, H) * 0.07;
  return nearestD <= threshold ? nearest : null;
}

function bindCanvasPick() {
  const stageInner = document.querySelector('.stage-inner');
  if (!stageInner) return;
  stageInner.style.cursor = 'crosshair';
  stageInner.addEventListener('click', e => {
    const img = $i('preview');
    if (!img || !lastPlan || !img.src) return;
    const r = img.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const el = pickElement(nx, ny);
    if (!el) { selectedKey = null; renderLayers(); inspStatus('لم يُحدَّد عنصر في هذه النقطة', ''); return; }
    selectLayer(el.key);
    inspStatus(`محدَّد: ${labelOf(el)} — عدّل لونه وحجمه في الصف المضيء`, 'ok');
  });
}

/* ---------------- keyboard shortcuts ---------------- */
function kbdHelp(show) {
  const el = $i('kbdHelp');
  if (!el) return;
  if (show === undefined) el.hidden = !el.hidden;
  else el.hidden = !show;
}

function bindShortcuts() {
  document.addEventListener('keydown', e => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey || e.altKey;

    if (e.key === 'Escape') {
      kbdHelp(false);
      /* B5: Esc also drops the current layer selection (help text promises it) */
      if (selectedKey) {
        selectedKey = null;
        renderLayers();
        inspStatus('أُلغي التحديد');
      }
      return;
    }
    if (mod || typing) return;

    const k = e.key;
    if (k === '?' || (k === '/' && e.shiftKey)) { e.preventDefault(); kbdHelp(); }
    else if (k === 'g' || k === 'G') { e.preventDefault(); generate(); }
    else if (k === 'e' || k === 'E') { e.preventDefault(); const b = $i('download'); if (b && !b.disabled) b.click(); }
    else if (k === 'v' || k === 'V') { e.preventDefault(); const b = $i('downloadSvg'); if (b && !b.disabled) b.click(); }
    else if (k === 'r' || k === 'R') {
      e.preventDefault();
      const chip = document.querySelector('.chip[data-preset="vary"]');
      if (chip) chip.click();
    }
    else if (k === 'ArrowLeft') { e.preventDefault(); if (typeof nextSlide === 'function') nextSlide(); }
    else if (k === 'ArrowRight') { e.preventDefault(); if (typeof prevSlide === 'function') prevSlide(); }
    else if (k === 'Delete' || k === 'Backspace') {
      if (selectedKey) { e.preventDefault(); toggleHidden(selectedKey); }
    }
    else if (k >= '1' && k <= '9') {
      const btns = document.querySelectorAll('.ov');
      const b = btns[Number(k) - 1];
      if (b) { e.preventDefault(); b.click(); }
    }
  });

  const btn = $i('kbdBtn');
  if (btn) btn.addEventListener('click', () => kbdHelp());
  const close = $i('kbdClose');
  if (close) close.addEventListener('click', () => kbdHelp(false));
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  bindInspector();
  bindCanvasPick();
  bindShortcuts();
  renderLayers();

  /* refresh the layer list on every rendered plan (initial one included) */
  const baseRenderUI = renderUI;
  renderUI = function inspectedRenderUI(res) {
    baseRenderUI(res);
    renderLayers();
  };
});
