/* =========================================================================
   مِرسم — studio.js
   The Studio section: brief understanding (local + optional AI),
   design references, the knowledge base, program-aware export and the
   freefield engine panel. Runs after app.js (reuses its global functions).
   ========================================================================= */
'use strict';

const $s = id => document.getElementById(id);
let studioFiles = [];

/* ---------------- tabs ---------------- */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    tab.classList.add('on');
    const pane = document.querySelector(`.pane[data-pane="${tab.dataset.tab}"]`);
    if (pane) pane.classList.add('on');
    if (tab.dataset.tab === 'engine') loadFreefield();
    if (tab.dataset.tab === 'refs') renderRefs();
    if (tab.dataset.tab === 'knowledge') renderKnowledge();
  });
});

/* ---------------- apply a brief to the controls ---------------- */
function applyBrief(p) {
  if (!p) return;
  if (p.headline) $s('headline').value = p.headline;
  if (p.subhead != null && p.subhead !== '') $s('subhead').value = p.subhead;
  /* only overwrite when the parse actually found text — an empty value would
     wipe what the designer typed by hand (B9) */
  if (p.cta) $s('cta').value = p.cta;
  if (p.kicker) $s('kicker').value = p.kicker;

  if (p.size && [...$s('size').options].some(o => o.value === p.size)) $s('size').value = p.size;
  if (p.genre && DESIGN_GENRES.some(g => g.id === p.genre)) $s('genre').value = p.genre;
  if (p.shape && DESIGN_SHAPES.some(s => s.id === p.shape)) $s('shape').value = p.shape;
  if (p.decor) $s('decor').value = p.decor;
  if (p.weight && [...$s('weight').options].some(o => o.value === String(p.weight))) $s('weight').value = p.weight;
  if (p.grain != null) $s('grain').checked = !!p.grain;

  const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
  if (isHex(p.primary)) { $s('primary').value = p.primary; $s('primaryHex').textContent = p.primary.toUpperCase(); }
  if (isHex(p.secondary)) { $s('secondary').value = p.secondary; $s('secondaryHex').textContent = p.secondary.toUpperCase(); }

  if (p.style) setSegment('style', 'style', p.style);
  if (p.composition) setSegment('composition', 'comp', p.composition);
  if (p.accent) setSegment('accent', 'accent', p.accent);
  if (p.harmony) setSegment('harmony', 'harmony', p.harmony);

  if (p.date || p.items) {
    parsedBrief = Object.assign({}, parsedBrief || {}, p.date ? { date: p.date } : {}, p.items ? { items: p.items } : {});
  }
}

function setSegment(group, key, value) {
  document.querySelectorAll(`.segmented[data-group="${group}"] button`).forEach(b => {
    b.classList.toggle('on', b.dataset[key] === value);
    if (b.dataset[key] === value) {
      if (group === 'style') style = value;
      if (group === 'composition') composition = value;
      if (group === 'accent') accentMode = value;
      if (group === 'harmony') harmony = value;
    }
  });
}

/* ---------------- brief understanding: local ---------------- */
function runLocalParse() {
  const text = $s('prompt').value;
  const p = parseBriefPrompt(text);
  parsedBrief = p;
  /* reference (art direction) → mood → genre: the genre keeps its structure */
  applyBrief(Object.assign({}, p, p.refPatch, p.moodPatch, p.genrePatch));
  renderUnderstood(p);
  generate();
}

function renderUnderstood(p) {
  const box = $s('understood');
  if (!box) return;
  const rows = (p.understood || []).map(u =>
    `<li><span>${esc(u.label)}</span><b>${esc(u.value)}</b></li>`).join('');
  const notes = (p.notes || []).map(n => `<li class="note"><span>ملاحظة</span><b>${esc(n)}</b></li>`).join('');
  box.innerHTML = `<ul class="understood-list">${rows}${notes}</ul>` || '';
}

/* ---------------- brief understanding: optional AI ---------------- */
function renderAIConfig() {
  const cfg = loadAIConfig();
  if ($s('aiProvider')) $s('aiProvider').value = cfg.provider || 'gemini';
  if ($s('aiModel')) $s('aiModel').value = cfg.model || (AI_PROVIDERS[cfg.provider || 'gemini'].model || '');
  if ($s('aiEndpoint')) $s('aiEndpoint').value = cfg.endpoint || '';
  if ($s('aiKey')) $s('aiKey').value = cfg.key || '';
  syncProviderUI();
}

/* B1: the key field must always be reachable; only the endpoint input is
   provider-specific (Gemini builds its URL from model+key, the others may
   point at OpenRouter/Groq/Ollama) */
function syncProviderUI() {
  const p = $s('aiProvider') ? $s('aiProvider').value : 'gemini';
  if ($s('aiEndpointRow')) $s('aiEndpointRow').style.display = '';
  if ($s('aiEndpointField')) $s('aiEndpointField').style.display = p === 'gemini' ? 'none' : '';
}

function readAIConfig() {
  const cfg = {
    provider: $s('aiProvider') ? $s('aiProvider').value : 'gemini',
    model: $s('aiModel') ? $s('aiModel').value : '',
    endpoint: $s('aiEndpoint') ? $s('aiEndpoint').value : '',
    key: $s('aiKey') ? $s('aiKey').value.trim() : ''
  };
  saveAIConfig(cfg);
  return cfg;
}

async function runAIParse() {
  const cfg = readAIConfig();
  const btn = $s('aiRun');
  const status = $s('aiStatus');
  if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التوليد…'; }
  if (status) status.textContent = '';
  try {
    const prompt = $s('prompt').value.trim();
    if (!prompt) throw new Error('اكتب وصف التصميم أولًا');
    const sys = systemInstruction();
    const json = await callTextAPI(cfg, `${sys}\n\nالوصف:\n${prompt}`);
    const text = AI_PROVIDERS[cfg.provider].read(json);
    const obj = extractJSON(text);
    if (!obj) throw new Error('لم يُعِد النموذج JSON صالحًا — جرّب مزوّدًا آخر');
    parsedBrief = parseBriefPrompt(prompt);
    applyBrief(Object.assign({}, parsedBrief.refPatch, parsedBrief, obj,
      { date: parsedBrief.date, items: parsedBrief.items }));
    renderUnderstood(Object.assign({}, parsedBrief, {
      understood: [].concat(parsedBrief.understood || [],
        [{ label: 'المزوّد', value: `${(AI_PROVIDERS[cfg.provider] || {}).label || cfg.provider} · ${cfg.model || 'default'}` }]),
      notes: parsedBrief.notes
    }));
    generate();
    if (status) status.className = 'status ok', status.textContent = 'تم تحليل الوصف بالذكاء الاصطناعي ✓';
  } catch (e) {
    if (status) { status.className = 'status err'; status.textContent = 'تعذّر: ' + e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ولّد التصميم بالذكاء الاصطناعي'; }
  }
}

/* ---------------- design references ---------------- */
function renderRefs() {
  const grid = $s('refsGrid');
  if (!grid) return;
  grid.innerHTML = DESIGN_REFS.map(r => `
    <button class="ref-card" data-ref="${r.id}">
      <span class="ref-name">${esc(r.name)}</span>
      <span class="ref-desc">${esc(r.desc)}</span>
      <span class="ref-why">${esc(r.rationale)}</span>
    </button>`).join('');
  grid.querySelectorAll('.ref-card').forEach(card => {
    card.addEventListener('click', () => applyRef(card.dataset.ref));
  });
}

const REF_GENRE = {
  'editorial-classic': ['event', 'sharp'], 'corporate-navy': ['social-post', 'soft'],
  'bold-commercial': ['product-ad', 'organic'], 'quiet-minimal': ['social-post', 'sharp'],
  'luxury-dark': ['quote', 'soft'], 'tech-neon': ['banner', 'sharp'],
  'warm-human': ['flyer', 'soft'], 'edu-clean': ['event', 'soft']
};

function applyRef(id) {
  const r = DESIGN_REFS.find(x => x.id === id);
  if (!r) return;
  const g = REF_GENRE[id] || ['social-post', 'soft'];
  applyBrief(Object.assign({ genre: g[0], shape: g[1] }, r.patch));
  const note = $s('refNote');
  if (note) note.textContent = r.rationale;
  generate();
}

/* ---------------- knowledge ---------------- */
function renderKnowledge() {
  const box = $s('knowledgeBox');
  if (!box || box.dataset.done) return;
  box.dataset.done = '1';
  const section = (title, items) => `
    <div class="kn-section">
      <h3>${title}</h3>
      <div class="kn-grid">
        ${items.map(k => `
          <article class="kn-card">
            <h4>${esc(k.title)}</h4>
            ${k.rule ? `<p class="kn-rule">${esc(k.rule)}</p>` : ''}
            <p>${esc(k.body)}</p>
            ${k.check ? `<p class="kn-check">✔ قياس: ${esc(k.check)}</p>` : ''}
          </article>`).join('')}
      </div>
    </div>`;
  box.innerHTML =
    section('مبادئ التصميم الجرافيكي', DESIGN_KNOWLEDGE.principles) +
    section('نظرية الألوان', DESIGN_KNOWLEDGE.color) +
    section('مهارات مصمم الجرافيك', DESIGN_KNOWLEDGE.skills);
}

/* ---------------- export by program ---------------- */
async function runExport() {
  if (!lastPlan || !lastCanvas) { alert('ولّد التصميم أولًا'); return; }
  const program = $s('exportProgram').value;
  const scale = Number($s('exportScale').value || 1);
  const out = $s('exportOut');
  if (out) out.innerHTML = '<li class="pending">جارٍ تجهيز الملفات…</li>';
  try {
    studioFiles = await exportForProgram(program, lastPlan, lastCanvas, {
      scale,
      slides: (typeof slides !== 'undefined' && slides.length > 1) ? slides.length : 1
    });
    if (out) {
      out.innerHTML = studioFiles.map(f => `<li>${esc(f)}</li>`).join('')
        + `<li class="done">✔ ${studioFiles.length} ملفًا — الخطوات داخل GUIDE-${program}.txt</li>`;
    }
  } catch (e) {
    if (out) out.innerHTML = `<li class="err">تعذّر التصدير: ${esc(e.message)}</li>`;
  }
}

/* ---------------- freefield engine panel ---------------- */
let freefieldLoaded = false;
async function loadFreefield() {
  if (freefieldLoaded) return;
  freefieldLoaded = true;
  const box = $s('ffInfo');
  if (!box) return;
  box.innerHTML = '<p class="pending">جارٍ جلب بيانات المستودع…</p>';
  const info = await fetchFreefieldInfo();
  box.innerHTML = `
    <div class="ff-card">
      <div class="ff-title">
        <a href="${info.url || FREEFIELD.url}" target="_blank" rel="noopener">neuregex/freefield</a>
        <span class="ff-badges">
          <span class="badge">${esc(info.language || 'Python')}</span>
          <span class="badge">${esc(info.license || 'MIT')}</span>
          <span class="badge badge-accent">★ ${info.stars != null ? info.stars : '—'}</span>
          ${info.live === false ? '<span class="badge">منسخ محليًا</span>' : ''}
        </span>
      </div>
      <p>${esc(info.description || '')}</p>
      <p class="ff-meta">آخر تحديث: ${esc(info.updated || '—')} · ${FREEFIELD.clone}</p>
    </div>`;

  const rm = $s('ffReadme');
  if (rm) {
    const md = await fetchFreefieldReadme();
    if (md) {
      const first = md.split('\n').slice(0, 140).join('\n');
      rm.innerHTML = `<pre class="ff-readme">${esc(first)}\n…</pre>`;
    } else {
      rm.innerHTML = '<p class="pending">تعذّر جلب README — افتح المستودع على GitHub.</p>';
    }
  }
}

async function runEngine() {
  const status = $s('ffStatus');
  const cfg = {
    endpoint: $s('ffEndpoint') ? $s('ffEndpoint').value.trim() : '',
    key: $s('ffKey') ? $s('ffKey').value.trim() : ''
  };
  if (cfg.endpoint) localStorage.setItem('mirsam.engine', JSON.stringify(cfg));
  if (status) status.className = 'status pending', status.textContent = 'جارٍ الإرسال للمحرّك…';
  try {
    /* B2: carry the real canvas size — the gateway defaults to 1080×1350 */
    const [ew, eh] = (($s('size') && $s('size').value) || '1080x1350').split('x').map(Number);
    const brief = lastPlan
      ? Object.assign({}, lastPlan.brief, { width: lastPlan.canvas[0], height: lastPlan.canvas[1] })
      : { headline: $s('headline').value, width: ew || 1080, height: eh || 1350 };
    const url = await sendToEngine(cfg, brief);
    if (status) { status.className = 'status ok'; status.textContent = 'تم ✓'; }
    window.open(url, '_blank');
  } catch (e) {
    if (status) { status.className = 'status err'; status.textContent = e.message; }
  }
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  try { const e = JSON.parse(localStorage.getItem('mirsam.engine') || '{}');
    if ($s('ffEndpoint') && e.endpoint) $s('ffEndpoint').value = e.endpoint;
    if ($s('ffKey') && e.key) $s('ffKey').value = e.key;
  } catch { /* ignore */ }
  renderAIConfig();
  renderRefs();
  renderKnowledge();

  if ($s('prompt')) $s('prompt').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); runLocalParse(); }
  });
  if ($s('runLocal')) $s('runLocal').addEventListener('click', runLocalParse);
  if ($s('aiRun')) $s('aiRun').addEventListener('click', runAIParse);
  if ($s('aiProvider')) $s('aiProvider').addEventListener('change', () => {
    const p = AI_PROVIDERS[$s('aiProvider').value];
    if ($s('aiModel')) $s('aiModel').value = p.model || '';
    syncProviderUI();
  });
  if ($s('aiSave')) $s('aiSave').addEventListener('click', () => {
    readAIConfig();
    const st = $s('aiStatus');
    if (st) { st.className = 'status ok'; st.textContent = 'حُفظ الإعداد محليًا (localStorage) فقط ✓'; }
  });
  if ($s('exportBtn')) $s('exportBtn').addEventListener('click', runExport);
  if ($s('flatPng')) $s('flatPng').addEventListener('click', () => {
    if (!lastPlan || !lastCanvas) return;
    exportFlat(lastPlan, lastCanvas, {
      scale: Number($s('exportScale').value || 1),
      format: 'png'
    });
  });
  if ($s('flatSvg')) $s('flatSvg').addEventListener('click', () => {
    if (!lastPlan) return;
    const scale = Number($s('exportScale') ? ($s('exportScale').value || 1) : 1);
    const [w0, h0] = lastPlan.canvas;
    let svg = renderSVG(lastPlan);
    /* B10: honour the scale — vector stays vector, only intrinsic size changes */
    if (scale !== 1) {
      svg = svg.replace(`width="${w0}" height="${h0}"`,
        `width="${Math.round(w0 * scale)}" height="${Math.round(h0 * scale)}"`);
    }
    const suffix = scale !== 1 ? `-${scale}x` : '';
    downloadText(`mirsam-${w0}x${h0}${suffix}.svg`,
      svg, 'image/svg+xml;charset=utf-8');
  });
  if ($s('flatJson')) $s('flatJson').addEventListener('click', () => {
    if (lastPlan) downloadJSON('mirsam-project.json', buildProject(lastPlan, { target: 'generic' }));
  });
  if ($s('ffRun')) $s('ffRun').addEventListener('click', runEngine);
});

/* =========================================================================
   Media studio: multi-format delivery from one design system
   size conversion · carousel batch · WebM slideshow · content plan
   ========================================================================= */
function mStatus(msg, cls = '') {
  const el = $s('mediaStatus');
  if (el) { el.className = 'status ' + cls; el.textContent = msg; }
}

function convertSize(v) {
  const sel = $s('size');
  if (!sel) return;
  const opt = [...sel.options].find(o => o.value === v);
  if (!opt) { mStatus('المقاس غير متاح: ' + v, 'err'); return; }
  sel.value = v;
  generate();
  const [w, h] = v.split('x');
  mStatus(`حُوِّل إلى ${w}×${h} — نفس النصوص وإعادة تخطيط للنسبة الجديدة`, 'ok');
}

function downloadContentPlan() {
  if (typeof captureSlide === 'function') captureSlide();
  const list = (typeof slides !== 'undefined' && slides.length) ? slides : [readTexts()];
  const [W, H] = lastPlan ? lastPlan.canvas : [1080, 1350];
  const md = `# خطة محتوى — مِرسم\n\n`
    + `المقاس: ${W}×${H} · عدد الشرائح: ${list.length} · التاريخ: ${new Date().toISOString().slice(0, 10)}\n\n`
    + list.map((s, i) => `## الشريحة ${i + 1}\n`
      + `- العنوان: ${s.headline || '—'}\n`
      + `- النص الثانوي: ${s.subhead || '—'}\n`
      + `- زر الدعوة: ${s.cta || '—'}\n`
      + `- تمهيد: ${s.kicker || '—'}\n`).join('\n')
    + `\n## نشر\n`
    + `- ارفع الشرائح بالترتيب 1…${list.length} في منشور متعدد الصور.\n`
    + `- ملف PNG لكل شريحة من «تنزيل كل الشرائح».\n`
    + `- نصوص قابلة للتعديل من mirsam-carousel.json.\n`;
  downloadText('mirsam-content-plan.md', md, 'text/markdown;charset=utf-8');
  mStatus(`✔ خطة المحتوى لـ ${list.length} شريحة (mirsam-content-plan.md)`, 'ok');
}

/* record the slides as a real WebM at full design resolution:
   hold → cross-fade → hold, straight out of the browser's MediaRecorder */
async function exportVideoWebM() {
  const btn = $s('mediaVideo');
  try {
    if (typeof MediaRecorder === 'undefined') throw new Error('المتصفح لا يدعم MediaRecorder');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('صيغة WebM غير مدعومة هنا — جرّب Edge/Chrome');

    if (typeof captureSlide === 'function') captureSlide();
    const list = (typeof slides !== 'undefined' && slides.length) ? slides : [readTexts()];
    if (btn) btn.disabled = true;
    mStatus(`تجهيز ${list.length} شريحة للتسجيل…`, 'pending');

    const rendered = [];
    for (const s of list) {
      /* eslint-disable-next-line no-await-in-loop */
      const res = await runLoop(slideBrief(s));   /* same pipeline as the PNG export (B7) */
      const plan = res.plan;
      rendered.push({ canvas: res.canvas, bg: plan.palette.bg, w: plan.canvas[0], h: plan.canvas[1] });
    }
    const W = rendered[0].w, H = rendered[0].h;

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    rec.start();

    const HOLD = 1300, FADE = 350;
    const total = rendered.length * HOLD + (rendered.length - 1) * FADE;
    const t0 = performance.now();
    mStatus('يسجّل الفيديو بالوقت الفعلي… لا تُغلق التبويب', 'pending');

    await new Promise(resolve => {
      const step = () => {
        const t = performance.now() - t0;
        let acc = 0, a = 0, b = 0, alpha = 0;
        for (let i = 0; i < rendered.length; i++) {
          if (t < acc + HOLD) { a = i; b = i; alpha = 0; break; }
          acc += HOLD;
          if (i < rendered.length - 1) {
            if (t < acc + FADE) { a = i; b = i + 1; alpha = (t - acc) / FADE; break; }
            acc += FADE;
          }
          a = i; b = i;
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = rendered[a].bg;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(rendered[a].canvas, 0, 0, W, H);
        if (b !== a) {
          ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
          ctx.drawImage(rendered[b].canvas, 0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        if (t >= total) { resolve(); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    rec.stop();
    await stopped;
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (!blob.size) throw new Error('لم يُسجَّل أي إطار');
    downloadBlob('mirsam-media.webm', blob);
    mStatus(`✔ فيديو WebM ${(blob.size / 1048576).toFixed(1)} ميغابايت — ${list.length} شرائح بتلاشٍ ناعم بدقة ${W}×${H}`, 'ok');
  } catch (e) {
    mStatus('تعذّر الفيديو: ' + e.message, 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-msize]').forEach(btn =>
    btn.addEventListener('click', () => convertSize(btn.dataset.msize)));
  if ($s('mediaVideo')) $s('mediaVideo').addEventListener('click', exportVideoWebM);
  if ($s('mediaPlan')) $s('mediaPlan').addEventListener('click', downloadContentPlan);
  if ($s('mediaSplit')) $s('mediaSplit').addEventListener('click', async () => {
    if (typeof autoCarousel !== 'function') return;
    await autoCarousel();
    mStatus(document.getElementById('carStatus').textContent || 'تم تقسيم الوصف', 'ok');
  });
  if ($s('mediaCarDownload')) $s('mediaCarDownload').addEventListener('click', async () => {
    if (typeof exportCarousel !== 'function') return;
    mStatus('جارٍ تنزيل كل الشرائح…', 'pending');
    await exportCarousel();
    mStatus(document.getElementById('carStatus').textContent, 'ok');
  });
});
