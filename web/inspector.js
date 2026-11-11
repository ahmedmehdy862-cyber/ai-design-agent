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

  /* P7: position + dimensions in absolute pixels — the delta is stored as a
     relative offset, so the designer's placement survives regeneration */
  const bb = (typeof lastPlan !== 'undefined' && lastPlan) ? (bboxOf(el, lastPlan) || [0, 0, 0, 0]) : [0, 0, 0, 0];
  const posCtl = `
      <span class="lay-sep" title="الموضع والأبعاد بالبكسل — تبقى بعد إعادة التوليد">موضع/أبعاد</span>
      <label class="lay-ctl lay-xy" title="الإزاحة الأفقية X بالبكسل"><span>X</span>
        <input type="number" data-act="px" step="1" value="${Math.round(bb[0])}"></label>
      <label class="lay-ctl lay-xy" title="الإزاحة الرأسية Y بالبكسل"><span>Y</span>
        <input type="number" data-act="py" step="1" value="${Math.round(bb[1])}"></label>
      ${el.rect ? `
      <label class="lay-ctl lay-xy" title="العرض بالبكسل"><span>W</span>
        <input type="number" data-act="pw" step="1" min="8" value="${Math.round(bb[2] - bb[0])}"></label>
      <label class="lay-ctl lay-xy" title="الارتفاع بالبكسل"><span>H</span>
        <input type="number" data-act="ph" step="1" min="8" value="${Math.round(bb[3] - bb[1])}"></label>` : ''}`;

  return `
  <div class="layer${o.hidden ? ' off' : ''}${o.locked ? ' locked' : ''}${selectedKey === el.key ? ' sel' : ''}" data-key="${esc(el.key)}" tabindex="0"
       title="${esc(labelOf(el))} — ${KIND_NAMES[el.kind] || el.kind}">
    <div class="lay-top">
      <button type="button" class="lay-vis" data-act="vis" title="إظهار / إخفاء الطبقة">${o.hidden ? '🚫' : '👁'}</button>
      <button type="button" class="lay-lock${o.locked ? ' on' : ''}" data-act="lock"
              title="${o.locked ? 'مقفل — الإصلاح الآلي يتجاهله · اضغط للفتح' : 'قفل — يمنع أي تعديل تلقائي لهذا العنصر'}">${o.locked ? '🔒' : '🔓'}</button>
      <span class="lay-name">${esc(labelOf(el))}</span>
      <span class="lay-kind">${KIND_NAMES[el.kind] || el.kind}</span>
      <span class="lay-z" role="group" aria-label="ترتيب الطبقات">
        <button type="button" data-act="z" data-z="top" title="إلى أعلى القائمة — يُرسم فوق كل الطبقات">⤒</button>
        <button type="button" data-act="z" data-z="up" title="تقديم درجة — فوق طبقة واحدة">▲</button>
        <button type="button" data-act="z" data-z="down" title="تأخير درجة — خلف طبقة واحدة">▼</button>
        <button type="button" data-act="z" data-z="bottom" title="إلى أسفل القائمة — يُرسم خلف كل الطبقات">⤓</button>
      </span>
      <button type="button" class="lay-reset" data-act="reset" title="إعادة هذا العنصر وحده">↺</button>
    </div>
    <div class="lay-body">
      ${posCtl}
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
  renderMeasure();                       /* P7: the readout follows every render */
  const box = $i('layers');
  if (!box) return;
  if (!lastPlan) {
    box.innerHTML = '<p class="lay-empty">ولّد التصميم لعرض طبقاته.</p>';
    layerSig = '';
    return;
  }
  const sig = lastPlan.elements.map(e => e.key).join('|');
  if (force || sig !== layerSig || !box.dataset.built) {
    /* the list reads top-down like every layer panel: the first row is the
       one painted last (on top), so ▲ in the list = forward in z */
    box.innerHTML = lastPlan.elements.slice().reverse().map(el => layerRow(el)).join('');
    box.dataset.built = '1';
    layerSig = sig;
  } else {
    /* in-place refresh: never rebuild while a slider is being dragged */
    for (const row of box.querySelectorAll('.layer')) {
      const el = lastPlan.elements.find(e => e.key === row.dataset.key);
      if (!el) continue;
      const o = overrides[el.key] || {};
      row.classList.toggle('off', !!o.hidden);
      row.classList.toggle('locked', !!o.locked);
      row.classList.toggle('sel', selectedKey === el.key);
      const vis = row.querySelector('.lay-vis');
      if (vis) vis.textContent = o.hidden ? '🚫' : '👁';
      const lk = row.querySelector('.lay-lock');
      if (lk) {
        lk.textContent = o.locked ? '🔒' : '🔓';
        lk.classList.toggle('on', !!o.locked);
        lk.title = o.locked ? 'مقفل — الإصلاح الآلي يتجاهله · اضغط للفتح' : 'قفل — يمنع أي تعديل تلقائي لهذا العنصر';
      }
      const color = row.querySelector('[data-act="color"]');
      if (color && document.activeElement !== color) color.value = (o.color || colorOf(el));
      const op = row.querySelector('[data-act="opacity"]');
      if (op && document.activeElement !== op) {
        const v = Math.round((o.opacity != null ? o.opacity : (el.opacity != null ? el.opacity : 1)) * 100);
        op.value = v;
        const num = op.parentElement.querySelector('.lay-num');
        if (num) num.textContent = arNum(v) + '٪';
      }
      /* P7: position fields track the plan (never fight a focused input) */
      const b2 = bboxOf(el, lastPlan);
      if (b2) {
        for (const [act, v] of [['px', b2[0]], ['py', b2[1]], ['pw', b2[2] - b2[0]], ['ph', b2[3] - b2[1]]]) {
          const inp = row.querySelector(`[data-act="${act}"]`);
          if (inp && document.activeElement !== inp) inp.value = Math.round(v);
        }
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
    else if (act === 'lock') {
      const now = !(overrides[key] && overrides[key].locked);
      setOverride(key, { locked: now }, now ? 'قُفل — الإصلاح الآلي يتجاهله الآن' : 'فُتح القفل — عُرض للإصلاح الآلي');
      renderLayers(true);
    }
    else if (act === 'z') moveLayer(key, btn.dataset.z);
    else if (act === 'reset') {
      pushUndo('one:' + key);            /* P7: a single reset is undoable too */
      delete overrides[key];
      saveOverrides();                   /* B8: the persisted copy must follow */
      inspStatus('أُعيد العنصر — تراجع Ctrl+Z يُرجعه', 'ok');
      renderLayers(true);
      generate();
    }
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

    /* P7: موضع/أبعاد — the field shows the absolute truth; the change becomes
       a relative offset/scale from the planned base, so it survives rebuilds */
    if (act === 'px' || act === 'py' || act === 'pw' || act === 'ph') {
      const el = lastPlan && lastPlan.elements.find(e => e.key === row.dataset.key);
      if (!el) return;
      const want = Number(t.value);
      if (!isFinite(want)) return;
      const bb = bboxOf(el, lastPlan);
      if (!bb) return;
      const cur = (act === 'px') ? bb[0] : (act === 'py') ? bb[1]
        : (act === 'pw') ? (bb[2] - bb[0]) : (bb[3] - bb[1]);
      const o = overrides[row.dataset.key] || {};
      if (act === 'px' || act === 'py') {
        const d = Math.round(want - cur);
        if (!d) return;
        setOverride(row.dataset.key, act === 'px' ? { dx: (o.dx || 0) + d } : { dy: (o.dy || 0) + d },
          act === 'px' ? 'الموضع الأفقي' : 'الموضع الرأسي');
      } else {
        if (cur < 8 || want < 8) { t.value = Math.round(cur); return; }
        const f = want / cur;
        const k = act === 'pw' ? 'sw' : 'sh';
        const v = Math.round((o[k] || 1) * f * 1000) / 1000;
        setOverride(row.dataset.key, { [k]: v }, act === 'pw' ? 'العرض' : 'الارتفاع');
      }
      return;
    }

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
  renderMeasure();                       /* P7: the readout follows the selection */
}

/* ---------------- P7: z-order ----------------
   The plan paints elements in array order, so the end of the array is the
   top layer. The list renders reversed, which makes ▲ = forward in z. */
function moveLayer(key, how) {
  if (!lastPlan) return;
  const el = lastPlan.elements.find(e => e.key === key);
  if (!el) return;
  const ord = lastPlan.elements.map(e => e.key);
  const i = ord.indexOf(key);
  if (i < 0) return;
  const k = ord.splice(i, 1)[0];
  const j = how === 'top' ? ord.length
    : how === 'bottom' ? 0
    : how === 'up' ? Math.min(ord.length, i + 1)
    : Math.max(0, i - 1);
  ord.splice(j, 0, k);
  pushUndo('z:' + key);
  overrides.__order = ord;               /* the whole stack, not just the move */
  saveOverrides();
  const pos = ord.indexOf(key) + 1;
  inspStatus(`«${labelOf(el)}»: ترتيب الرسم ${arNum(pos)} من ${arNum(ord.length)} — يُرسم فوق ${arNum(pos - 1)} طبقات`, 'ok');
  renderLayers(true);
  generate();
}

/* ---------------- P7: undo / redo ---------------- */
function updateHistoryBtns() {
  const u = $i('inspUndo'), r = $i('inspRedo');
  if (u) {
    u.disabled = !undoStack.length;
    u.title = undoStack.length ? `تراجع (${arNum(undoStack.length)} خطوة) — Ctrl+Z` : 'لا يوجد ما يُتراجع عنه — Ctrl+Z';
  }
  if (r) {
    r.disabled = !redoStack.length;
    r.title = redoStack.length ? `إعادة (${arNum(redoStack.length)} خطوة) — Ctrl+Shift+Z` : 'لا يوجد ما يُعاد — Ctrl+Shift+Z';
  }
}
function doUndo() {
  if (!undoEdits()) { inspStatus('لا يوجد ما يُتراجع عنه', ''); updateHistoryBtns(); return; }
  layerSig = '';
  renderLayers(true);
  generate();
  inspStatus(`تراجعت عن آخر تعديل — بقي ${arNum(undoStack.length)} للتراجع (Ctrl+Z)`, 'ok');
}
function doRedo() {
  if (!redoEdits()) { inspStatus('لا يوجد ما يُعاد — Ctrl+Shift+Z', ''); updateHistoryBtns(); return; }
  layerSig = '';
  renderLayers(true);
  generate();
  inspStatus(`أُعيدت الخطوة — بقي ${arNum(redoStack.length)} للإعادة (Ctrl+Shift+Z)`, 'ok');
}

/* ---------------- P7: measurements for the selected layer ----------------
   تسلسل · محاذاة · تباعد · تداخل · طباعة — read from the very boxes the
   renderer paints, so every number here is a fact, not an opinion. */
function renderMeasure() {
  const box = $i('inspMeasure');
  if (!box) return;
  const el = (selectedKey && lastPlan) ? lastPlan.elements.find(e => e.key === selectedKey) : null;
  if (!el) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;

  const [W, H] = lastPlan.canvas;
  const bb = bboxOf(el, lastPlan) || [0, 0, 0, 0];
  const w = Math.round(bb[2] - bb[0]), h = Math.round(bb[3] - bb[1]);
  const vis = lastPlan.elements.filter(e => !e.hidden);
  const name = labelOf(el);
  const px = n => `${arNum(Math.round(n))}px`;
  const row = (k, v) => `<div class="meas-row"><span>${k}</span><b>${v}</b></div>`;
  const rows = [];

  rows.push(row('الصندوق', `${px(bb[0])} · ${px(bb[1])} — ${px(w)} × ${px(h)}`));
  rows.push(row('من الحواف', `يمين ${px(W - bb[2])} · يسار ${px(bb[0])} · أعلى ${px(bb[1])} · أسفل ${px(H - bb[3])}`));

  const zi = lastPlan.elements.indexOf(el);
  rows.push(row('ترتيب الرسم', `${arNum(zi + 1)} من ${arNum(lastPlan.elements.length)} — يُرسم فوق ${arNum(zi)} طبقات`));

  /* التسلسل: this block's size against the headline that anchors the ladder */
  if (el.kind === 'type') {
    const head = lastPlan.elements.find(e => e.role === 'headline' && e !== el && !e.hidden);
    rows.push(row('التسلسل', head && head.size
      ? `${px(el.size)} مقابل العنوان ${px(head.size)} = ${arNum(+(el.size / head.size).toFixed(2))}×`
      : `${px(el.size)} — أعلى درجة في السلّم`));
  }

  /* المحاذاة: distance from the edge this block shares with its peers */
  if (el.kind === 'type') {
    const al = el.align || 'right';
    const edgeOf = b => (al === 'center') ? (b[0] + b[2]) / 2 : (al === 'left' ? b[0] : b[2]);
    const peers = vis.filter(e => e.kind === 'type' && (e.align || 'right') === al);
    const edge = edgeOf(bb);
    const alAr = al === 'right' ? 'يمين' : al === 'center' ? 'وسط' : 'يسار';
    if (peers.length > 1) {
      const edges = peers.map(e => edgeOf(bboxOf(e, lastPlan) || [0, 0, 0, 0])).sort((a, b) => a - b);
      const med = edges[Math.floor(edges.length / 2)];
      const d = Math.round(edge - med);
      rows.push(row('المحاذاة', `${alAr} · خط ${arNum(Math.round(med))}px · انحراف ${d === 0 ? 'صفر' : px(Math.abs(d))}${d > 0 ? ' يمين' : d < 0 ? ' يسار' : ''}`));
    } else rows.push(row('المحاذاة', `${alAr} — وحيد على خطه`));
  }

  /* التباعد: nearest visible neighbour above/below inside the same column */
  const colOverlap = b => Math.min(bb[2], b[2]) - Math.max(bb[0], b[0]) > 0;
  let above = null, below = null;
  for (const e of vis) {
    if (e === el) continue;
    const b = bboxOf(e, lastPlan);
    if (!b || !colOverlap(b)) continue;
    if (b[3] <= bb[1] + 1) { const g = bb[1] - b[3]; if (!above || g < above.g) above = { g, e }; }
    else if (b[1] >= bb[3] - 1) { const g = b[1] - bb[3]; if (!below || g < below.g) below = { g, e }; }
  }
  rows.push(row('التباعد',
    `${above ? 'فوق ' + labelOf(above.e) + ' ' + px(above.g) : 'فوق: مساحة خالية'} · ${below ? 'تحت ' + labelOf(below.e) + ' ' + px(below.g) : 'تحت: مساحة خالية'}`));

  /* التداخل: real intersection boxes with every other visible layer —
     dimensions, not just area, so a 5px graze reads as a graze */
  const overs = [];
  for (const e of vis) {
    if (e === el) continue;
    const b = bboxOf(e, lastPlan);
    if (!b) continue;
    const ix = Math.min(bb[2], b[2]) - Math.max(bb[0], b[0]);
    const iy = Math.min(bb[3], b[3]) - Math.max(bb[1], b[1]);
    if (ix > 2 && iy > 2)
      overs.push(`${labelOf(e)} ${arNum(Math.round(ix))}×${arNum(Math.round(iy))}px${ix <= 12 || iy <= 12 ? ' (لمسة)' : ''}`);
  }
  rows.push(row('التداخل', overs.length ? `${arNum(overs.length)}: ${overs.join(' · ')}` : 'لا تداخل'));

  /* الطباعة: the exact stack the SVG will draw with */
  if (el.kind === 'type') {
    const lines = wrapLines(el.text || '', el.maxW || 4000, el.font, el.size, el.weight);
    measureCtx.font = `${el.weight} ${el.size}px ${fontStackFor(el.font)}`;
    const longest = lines.length ? Math.max(...lines.map(l => measureCtx.measureText(l).width)) : 0;
    rows.push(row('الطباعة', `${el.font} · ${px(el.size)} · وزن ${el.weight} · سطر ${px(el.leading || 0)} · ${arNum(lines.length)} سطر`));
    if (el.maxW) rows.push(row('قياس السطر', `${px(longest)} من ${px(el.maxW)} — ${arNum(Math.round(longest / el.maxW * 100))}٪ من الصندوق`));
  }

  const o = overrides[el.key] || {};
  rows.push(row('الحالة', `${o.locked ? '🔒 مقفل — الإصلاح الآلي يتجاهله' : 'مفتوح للإصلاح الآلي'}${o.hidden ? ' · 🚫 مخفي' : ''}${o.dx || o.dy ? ' · موقع مُعدَّل' : ''}`));

  box.innerHTML = `<div class="meas-head">${esc(name)}</div>` + rows.join('');
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
  if (el.kind === 'type') return typeBBox(el);   /* one measurement stack (P5) */
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
    /* P7: تراجع/إعادة — never while typing: inside a field the browser's own
       text undo is exactly what the designer expects */
    if (!typing && !e.altKey && (e.ctrlKey || e.metaKey) &&
        (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      if (e.key === 'y' || e.key === 'Y' || e.shiftKey) doRedo(); else doUndo();
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

  /* P7: history buttons live in the inspector head */
  const u = $i('inspUndo'), r = $i('inspRedo');
  if (u) u.addEventListener('click', doUndo);
  if (r) r.addEventListener('click', doRedo);
  updateHistoryBtns();

  /* refresh the layer list on every rendered plan (initial one included) */
  const baseRenderUI = renderUI;
  renderUI = function inspectedRenderUI(res) {
    baseRenderUI(res);
    renderLayers();
    updateHistoryBtns();
  };
});
