/* =========================================================================
   مِرسم — carousel.js
   Multi-slide carousels (Instagram/LinkedIn carousels, story sets):
   slides share the whole design identity (size · palette · genre · grid)
   and differ only in their text blocks. Strip preview, RTL navigation and
   a single batch download (PNG per slide + order manifest).
   Loads after app.js, before inspector.js.
   ========================================================================= */
'use strict';

const $c = id => document.getElementById(id);

let slides = [{ headline: '', subhead: '', cta: '', kicker: '' }];
let slideIndex = 0;
let carBusy = false;
let stripToken = 0;
const thumbCache = new Map();

/* ---------------- model ---------------- */
const readTexts = () => ({
  headline: $c('headline').value.trim() || 'عنوان',
  subhead: $c('subhead').value.trim(),
  cta: $c('cta').value.trim(),
  kicker: $c('kicker').value.trim()
});

function captureSlide() {
  slides[slideIndex] = readTexts();
}

/* P7: layout rotation for the variety mode — composition is the ONE thing
   allowed to differ; size · palette · genre · font stay shared (continuity) */
const VARY_COMPS = ['stack', 'split', 'editorial'];
const COMP_AR = { stack: 'تسلسلي', split: 'تقسيم', editorial: 'تحريري' };
const compAr = c => COMP_AR[c] || c;
/* the identity every slide must share — composition is NOT here on purpose */
const IDENTITY = [['width', 'المقاس'], ['height', 'الارتفاع'], ['genre', 'النوع'], ['font', 'الخط'],
  ['primary', 'اللون الأساسي'], ['secondary', 'اللون الثانوي'], ['style', 'الأسلوب'], ['shape', 'الشكل']];

/* a slide carries the full brief: shared identity + its own text */
function slideBrief(s) {
  const varyOn = typeof document !== 'undefined' && $c('carVary') && $c('carVary').checked;
  const i = slides.indexOf(s);
  const vary = varyOn && slides.length > 1 && i >= 0;
  return Object.assign(briefFromUI(), {
    headline: s.headline || 'عنوان',
    subhead: s.subhead || '',
    cta: s.cta || '',
    kicker: s.kicker || '',
    ...(vary ? { composition: VARY_COMPS[i % VARY_COMPS.length] } : {})
  });
}

/* P7: استمرارية الهوية + توزيع المحتوى — state exactly what is: the fields
   compared are the identity; composition is deliberately excluded because
   rotating it is what the variety switch is for. */
function renderCarInfo() {
  const box = $c('carInfo');
  if (!box) return;
  if (slides.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;

  const briefs = slides.map(s => slideBrief(s));
  const diff = IDENTITY.filter(([k]) => new Set(briefs.map(b => String(b[k]))).size > 1);

  const comps = briefs.map(b => b.composition);
  const varied = new Set(comps).size > 1;

  const roles = slides.map((s, i) =>
    i === 0 ? 'غلاف' : (i === slides.length - 1 ? (s.cta ? 'دعوة ختام' : 'ختام') : 'محتوى'));
  const tally = [];
  let run = 1;
  for (let i = 1; i <= roles.length; i++) {
    if (i < roles.length && roles[i] === roles[i - 1]) { run++; continue; }
    tally.push(roles[i - 1] + (run > 1 ? ` ×${arNum(run)}` : ''));
    run = 1;
  }
  const items = (parsedBrief && parsedBrief.items) || [];

  box.innerHTML =
    (diff.length
      ? `<div><b class="bad">استمرارية: ${arNum(diff.length)} حقلًا مختلفًا بين الشرائح — ${diff.map(d => d[1]).join(' · ')}</b></div>`
      : `<div><b class="ok">استمرارية: مقاس ونوع وخط وألوان وشكل موحّدة عبر ${arNum(slides.length)} شرائح</b></div>`)
    + `<div class="ci-var">التخطيط: ${varied
      ? `مُنوَّع — ${comps.map(compAr).join(' ← ')} (التغيير الوحيد المسموح)`
      : `موحّد — ${compAr(comps[0])} في كل الشرائح`}</div>`
    + `<div>توزيع المحتوى: ${tally.join(' · ')}${items.length
      ? ` — ${arNum(items.length)} بنودًا + التاريخ في الغلاف والختام فقط`
      : ''}</div>`;
}

/* cache key = the whole design input (text + identity + overrides) */
const slideKey = s => JSON.stringify([slideBrief(s), overrides]);

function pushTextsToUI(s) {
  $c('headline').value = s.headline;
  $c('subhead').value = s.subhead;
  $c('cta').value = s.cta;
  $c('kicker').value = s.kicker;
}

/* date/bullets belong to the cover and the closing CTA slide, not to the
   middle slides — otherwise every slide repeats the full list */
function slideExtras(i) {
  if (!parsedBrief) return;
  if (parsedBrief._base === undefined) {
    parsedBrief._base = { date: parsedBrief.date || '', items: (parsedBrief.items || []).slice() };
  }
  const keep = i === 0 || i === slides.length - 1;
  parsedBrief.date = keep ? parsedBrief._base.date : '';
  parsedBrief.items = keep ? parsedBrief._base.items : [];
}

function updateSlideTag() {
  const tag = $c('stageSlide');
  if (!tag) return;
  if (slides.length > 1) {
    tag.hidden = false;
    tag.textContent = `شريحة ${arNum(slideIndex + 1)} / ${arNum(slides.length)}`;
  } else tag.hidden = true;
}

function carStatus(msg, cls = '') {
  const el = $c('carStatus');
  if (el) { el.className = 'status ' + cls; el.textContent = msg; }
}

/* ---------------- thumbnails ---------------- */
async function slideThumb(s) {
  const key = slideKey(s);
  if (thumbCache.has(key)) return thumbCache.get(key);

  const res = await runLoop(slideBrief(s));   /* B7: same knowledge/overrides/QA pipeline as the main preview */
  const plan = res.plan;
  const full = res.canvas;
  const tw = 132;
  const th = Math.max(56, Math.round(tw * plan.canvas[1] / plan.canvas[0]));
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, tw, th);
  const url = c.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}

/* ---------------- strip ---------------- */
async function renderStrip() {
  const strip = $c('carStrip');
  if (!strip) return;
  const token = ++stripToken;

  strip.innerHTML = slides.map((s, i) => `
    <button type="button" class="slide${i === slideIndex ? ' on' : ''}" data-i="${i}"
            role="tab" aria-selected="${i === slideIndex}"
            title="${esc(s.headline || 'شريحة ' + (i + 1))}">
      <span class="slide-img" data-thumb="${i}"><span class="slide-ph"></span></span>
      <span class="slide-no">${arNum(i + 1)}</span>
      <span class="slide-name">${esc((s.headline || 'بدون عنوان').slice(0, 20))}</span>
    </button>`).join('');

  if (slides.length > 1) {
    strip.insertAdjacentHTML('afterbegin',
      `<button type="button" class="car-nav" id="carPrev" title="الشريحة السابقة (→)" aria-label="الشريحة السابقة">→</button>`);
    strip.insertAdjacentHTML('beforeend',
      `<button type="button" class="car-nav" id="carNext" title="الشريحة التالية (←)" aria-label="الشريحة التالية">←</button>`);
    $c('carPrev').addEventListener('click', prevSlide);
    $c('carNext').addEventListener('click', nextSlide);
  }

  strip.querySelectorAll('.slide').forEach(btn =>
    btn.addEventListener('click', () => switchSlide(Number(btn.dataset.i))));

  /* fill thumbnails one by one (cached after the first pass) */
  for (let i = 0; i < slides.length; i++) {
    if (token !== stripToken) return;
    const holder = strip.querySelector(`[data-thumb="${i}"]`);
    if (!holder) continue;
    try {
      const url = await slideThumb(slides[i]);
      if (token !== stripToken || !holder.isConnected) return;
      holder.innerHTML = `<img src="${url}" alt="شريحة ${i + 1}">`;
    } catch { holder.innerHTML = '<span class="slide-ph">—</span>'; }
  }
  updateSlideTag();
  renderCarInfo();
}

/* ---------------- navigation ---------------- */
function switchSlide(i) {
  if (carBusy || !slides.length) return;
  captureSlide();
  i = Math.max(0, Math.min(slides.length - 1, i));
  slideIndex = i;
  const s = slides[i];
  pushTextsToUI(s);
  slideExtras(i);
  updateSlideTag();
  generate();
  renderStrip();
}
const nextSlide = () => switchSlide(slideIndex + 1);
const prevSlide = () => switchSlide(slideIndex - 1);

/* ---------------- add / delete / auto-split ---------------- */
function addSlide() {
  captureSlide();
  const at = slideIndex + 1;
  slides.splice(at, 0, { headline: '', subhead: '', cta: '', kicker: '' });
  slideIndex = at;
  pushTextsToUI(slides[at]);
  slideExtras(at);
  updateSlideTag();
  generate();
  renderStrip();
  carStatus(`أُضيفت شريحة ${arNum(at + 1)} — اكتب نصها`, 'pending');
}

function delSlide() {
  if (slides.length <= 1) { carStatus('لا يمكن حذف الشريحة الوحيدة', 'err'); return; }
  captureSlide();
  slides.splice(slideIndex, 1);
  slideIndex = Math.min(slideIndex, slides.length - 1);
  pushTextsToUI(slides[slideIndex]);
  slideExtras(slideIndex);
  updateSlideTag();
  generate();
  renderStrip();
  carStatus(`حُذفت الشريحة — بقيت ${arNum(slides.length)} شرائح`, 'ok');
}

/* cover + one slide per bullet + closing CTA, all sharing one identity */
async function autoCarousel() {
  if (carBusy) return;
  carBusy = true;
  try {
    captureSlide();
    const base = readTexts();
    const promptText = $c('prompt') ? $c('prompt').value : '';
    const p = parsedBrief || (typeof parseBriefPrompt === 'function' ? parseBriefPrompt(promptText) : null);

    let list = (p && p.items && p.items.length) ? p.items.slice() : [];
    if (!list.length && base.subhead) {
      list = base.subhead.split(/[،,·|]/).map(s => s.trim()).filter(s => s.length > 3);
    }
    list = list.slice(0, 5);

    if (!list.length && !base.cta) {
      carStatus('لا توجد بنود ولا زر لتقسيم الوصف — أضف بنودًا في الوصف أو أنشئ شرائح يدويًا (+)', 'err');
      return;
    }

    const total = 1 + list.length + (base.cta ? 1 : 0);
    const built = [{ headline: base.headline, subhead: base.subhead, cta: '', kicker: base.kicker }];
    list.forEach((it, idx) => {
      built.push({
        headline: it,
        subhead: '',
        cta: '',
        kicker: `${arNum(idx + 1)} / ${arNum(list.length)}`
      });
    });
    if (base.cta) {
      built.push({ headline: base.cta, subhead: base.subhead, cta: base.cta, kicker: base.kicker });
    }

    slides = built;
    slideIndex = 0;
    pushTextsToUI(slides[0]);
    slideExtras(0);
    updateSlideTag();
    generate();
    await renderStrip();
    carStatus(`✔ ${arNum(total)} شرائح من الوصف — غلاف + ${arNum(list.length)} بنود${base.cta ? ' + دعوة' : ''}`, 'ok');
  } finally {
    carBusy = false;
  }
}

/* ---------------- batch download ---------------- */
async function exportCarousel() {
  if (carBusy) return;
  captureSlide();
  if (!slides.length) { carStatus('لا توجد شرائح', 'err'); return; }

  carBusy = true;
  carStatus('جارٍ تجهيز الشرائح…', 'pending');
  const files = [];
  try {
    const autoFix = $c('autoFix') ? $c('autoFix').checked : true;
    const [W, H] = (lastPlan ? lastPlan.canvas : [1080, 1350]);

    for (let i = 0; i < slides.length; i++) {
      const res = await runLoop(slideBrief(slides[i]), { autoFix });
      const name = `mirsam-carousel-${String(i + 1).padStart(2, '0')}.png`;
      /* eslint-disable-next-line no-await-in-loop */
      await new Promise(resolve => res.canvas.toBlob(blob => { downloadBlob(name, blob); resolve(); }, 'image/png'));
      files.push(name);
      if (i < slides.length - 1) await delay(170);
    }

    await delay(200);
    const briefs = slides.map(s => slideBrief(s));
    const varyOn = $c('carVary') && $c('carVary').checked;
    const manifest = {
      format: 'mirsam-carousel@1',
      generated: new Date().toISOString(),
      count: slides.length,
      canvas: [W, H],
      /* P7: what held the set together, stated — not assumed */
      identity: {
        genre: briefs[0].genre, font: briefs[0].font, style: briefs[0].style,
        palette: [briefs[0].primary, briefs[0].secondary],
        continuous: IDENTITY.every(([k]) => new Set(briefs.map(b => String(b[k]))).size === 1),
        layout: varyOn ? 'varied: ' + briefs.map(b => b.composition).join(' → ') : briefs[0].composition
      },
      distribution: slides.map((s, i) => ({
        index: i + 1,
        role: i === 0 ? 'cover' : (i === slides.length - 1 ? (s.cta ? 'closing-cta' : 'closing') : 'body')
      })),
      order: slides.map((s, i) => ({
        index: i + 1,
        file: `mirsam-carousel-${String(i + 1).padStart(2, '0')}.png`,
        headline: s.headline, subhead: s.subhead, cta: s.cta, kicker: s.kicker
      })),
      howTo: [
        'انشر الشرائح بالترتيب 01…N في منشور متعدد الصور أو كسلسلة.',
        'كل PNG بنفس المقاس — لا حاجة لتعديل المقاس.',
        'النصوص قابلة لإعادة الإدخال في أي برنامج تصميم من ملف manifest هذا.'
      ]
    };
    downloadJSON('mirsam-carousel.json', manifest);
    files.push('mirsam-carousel.json');
    carStatus(`✔ ${arNum(files.length)} ملفًا — ${arNum(slides.length)} شرائح PNG + mirsam-carousel.json`, 'ok');
  } catch (e) {
    carStatus('تعذّر تجهيز الشرائح: ' + e.message, 'err');
  } finally {
    carBusy = false;
  }
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  captureSlide();
  updateSlideTag();
  renderStrip();

  if ($c('carAdd')) $c('carAdd').addEventListener('click', addSlide);
  if ($c('carDel')) $c('carDel').addEventListener('click', delSlide);
  if ($c('carAuto')) $c('carAuto').addEventListener('click', autoCarousel);
  if ($c('carExport')) $c('carExport').addEventListener('click', exportCarousel);

  /* P7: variety switch — composition rotates, identity never moves */
  const vary = $c('carVary');
  if (vary) vary.addEventListener('change', () => {
    thumbCache.clear();               /* layout changed → old thumbnails lie */
    renderStrip();
    carStatus(vary.checked
      ? 'التخطيط سيتنوّع بين الشرائح — المقاس واللون والخط والنوع كما هي'
      : 'رجعت كل الشرائح إلى تكوين واحد', vary.checked ? 'ok' : '');
  });

  /* keep the strip in step with regeneration (thumbnails are cached) */
  const baseGenerate = generate;
  generate = async function chainedGenerate() {
    await baseGenerate();
    if (!carBusy) await renderStrip();
  };
});
