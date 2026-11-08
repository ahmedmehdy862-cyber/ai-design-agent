/* =========================================================================
   مِرسم — export.js
   Program-aware delivery: layered, editable outputs with frames + layers,
   because a designer hands the work to PhotoCraft / Photoshop / Illustrator
   / FilmCraft / Canva — not a single flattened picture.
   ========================================================================= */
'use strict';

const EXPORT_PROGRAMS = {
  photocraft: {
    label: 'PhotoCraft (محرّك الأداة)',
    kind: 'layers', guide: 'PHOTOCRAFT'
  },
  photoshop: {
    label: 'Photoshop (طبقات PNG + خطة)',
    kind: 'layers', guide: 'PHOTOSHOP'
  },
  illustrator: {
    label: 'Illustrator (SVG بطبقات مجمّعة)',
    kind: 'vector', guide: 'ILLUSTRATOR'
  },
  filmcraft: {
    label: 'FilmCraft / Premiere (إطارات + جدول زمني)',
    kind: 'frames', guide: 'FILMCRAFT'
  },
  canva: {
    label: 'Canva (طبقات PNG + SVG متجهي)',
    kind: 'layers', guide: 'CANVA'
  }
};

const EXPORT_GUIDES = {
  PHOTOCRAFT: `PhotoCraft — استيراد مشروع مِرسم
1) افتح PhotoCraft (أو photo-craft CLI) وأنشئ وثيقة جديدة بنفس المقاس.
2) استورد مخرَج الملفات: mirsam-project.json يقول اسم كل طبقة وترتيبها، وملفات layer-NN-*.png للمظهر النهائي.
3) اسحب الطبقات بالترتيب من 01 إلى الأخير: خلفية ← كتل لونية ← زخرفة ← نصوص ← تشطيب.
4) احفظ نسخة .pcraft قابلة للتعديل — لا تدمج الطبقات.
5) للنص: استبدل كل طبقة PNG بنص حقيقي بنفس الحجم والموضع (ملف JSON يعطي النص والخط واللون).`,
  PHOTOSHOP: `Photoshop — استيراد بدون ملف PSD
1) ملف ← سكربتات ← Load Files into Stack… واختر كل صور الطبقات.
2) ترتيب الطبقات في لوحة الطبقات: 01 الخلفية أسفل القائمة، النصوص أعلى.
3) كل طبقة شفافة بمقاس المستند بالكامل — لا حاجة لإعادة المحاذاة.
4) للنص: أداة النص بنفس المقاس/الوزن/اللون من mirsam-project.json ثم احذف طبقة PNG المقابلة.
5) ملف ← حفظ باسم ← Photoshop (*.PSD) مع «تمديد الطبقة الخلفية» معطّل.
   ملاحظة: هذا المسار ينتج PSD حرّ الطبقات دون كتابة ثنائي PSD (قيد موثّق في docs/COMPATIBILITY.md).`,
  ILLUSTRATOR: `Illustrator — SVG بطبقات مجمّعة
1) ملف ← فتح على mirsam-layers.svg.
2) لوحة الطبقات: كل مجموعة عنصر باسمه (headline / subhead / cta-chip …).
3) النص قابل للتحرير: (نص ← تحويل إلى أشكال) معطّل، والخطوط من عائلة النظام العربية.
4) المستند متجهي بالكامل — قابل للتكبير بلا حدود، والتصدير PNG/EPS/PDF من ملف ← تصدير.
5) ألوان الأدوار (خلفية/حبر/لهجة) معرَّفة في ملف الخطة JSON لإعادة الاستخدام.`,
  FILMCRAFT: `FilmCraft / Premiere — إطار ثابت داخل جدول زمني
1) استورد الطبقات PNG كلها بترتيبها (Import) ثم اسحبها إلى التسلسل الزمني.
2) mirsam-timeline.xml يصف كل طبقة كبومضة (clip) بمدة الإطار والترتيب (مرجع للاستيراد اليدوي).
3) الإطار = المقاس × المدة (افتراضيًا ٣٠ إطارًا/ثانية). ثبّت العناصر على نفس الموضع لكل الإطارات.
4) للحركة: أدرج العناصر كمقاطع مفصولة (مثلاً النص في الإطار ١٠، الزخرفة في ٠) مع انتقال ٦ إطارات.
5) اجعل كل طبقة مستقلة: لا تدمج، حتى تُحرّك كل عنصرًا منفردًا.`,
  CANVA: `Canva — صيغ قابلة للتعديل
1) ارفع mirsam-layers.svg (المتجهي) وملفات layer-NN-*.png معاً عبر رفع عدة ملفات.
2) المتجه يحافظ على النص والأشكال قابلة للتعديل؛ الـPNG يحفظ المظهر النهائي.
3) كل عنصر في Canva = طبقة مستقلة؛ استخدم نفس الأسماء لتطابق الخطة.
4) العناصر النصية في الخطة (العنوان/الثانوي/الزر) أعد إدخالها كنصوص Canva للتعديل الكامل.
5) صدّر PNG بمقاس التصميم نفسه (١٠٨٠×١٣٥٠ مثلاً).`
};

/* ---------- download helpers ---------- */
function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const downloadText = (name, text, mime = 'text/plain;charset=utf-8') =>
  downloadBlob(name, new Blob([text], { type: mime }));
const downloadJSON = (name, obj) => downloadText(name, JSON.stringify(obj, null, 2), 'application/json');
const delay = ms => new Promise(r => setTimeout(r, ms));

/* ---------- project manifest: layers + frames + palette ---------- */
function buildProject(plan, opts = {}) {
  const [W, H] = plan.canvas;
  const scale = opts.scale || 1;
  const layers = plan.elements.map((el, i) => ({
    z: i + 1,
    id: `layer-${String(i + 1).padStart(2, '0')}`,
    name: el.role,
    kind: el.kind,
    visible: true,
    opacity: el.opacity != null ? el.opacity : 1,
    fill: el.grad ? `gradient:${el.grad[0]}→${el.grad[1]}` : (el.fill || el.stroke || null),
    rect: el.rect ? el.rect.map(v => Math.round(v * scale)) : null,
    text: el.kind === 'type' ? el.text : (el.kind === 'qr' ? el.data : null),
    font: el.kind === 'type' ? `${el.font} ${el.weight} ${el.size}px` : null,
    color: el.kind === 'type' ? el.color : null,
    align: el.align || null,
    bleed: !!el.bleed
  }));

  return {
    format: 'mirsam-project@1',
    generated: new Date().toISOString(),
    target: opts.target || 'generic',
    frames: {
      width: Math.round(W * scale), height: Math.round(H * scale),
      fps: opts.fps || 30,
      durationFrames: opts.durationFrames || 150,
      slides: opts.slides || 1,
      safeAreaPx: plan.grid.margin,
      colorSpace: 'sRGB'
    },
    palette: plan.palette,
    meta: plan.meta,
    media: {
      frameSlot: plan.meta.frame || null,
      qrPx: plan.meta.qr || 0,
      note: (plan.meta.frame || plan.meta.qr)
        ? 'الصورة مضمّنة داخل إطارها (data URL في SVG/PSD) — ورمز QR مرسوم من وحداته الأصلية'
        : 'لا وسائط موضعية في هذا التصميم'
    },
    typeScale: plan.typeScale,
    grid: plan.grid,
    focal: plan.focal,
    rationale: plan.rationale,
    layers
  };
}

/* ---------- layered SVG: one group per layer, editable ---------- */
function buildLayeredSVG(plan) {
  const groups = plan.elements.map((el, i) => {
    const inner = renderSVG(plan, { transparent: true, only: i })
      .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const label = `${String(i + 1).padStart(2, '0')} ${el.role}`;
    return `  <g id="layer-${String(i + 1).padStart(2, '0')}" inkscape:groupmode="layer"`
      + ` inkscape:label="${esc(label)}" data-name="${esc(el.role)}">\n    ${inner}\n  </g>`;
  }).join('\n');

  const [W, H] = plan.canvas;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- مِرسم — layered export. Every <g> is one design layer, in z-order. -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>مِرسم ${W}×${H} — ${esc(plan.meta.genreName || plan.meta.composition)}</title>
  <rect id="layer-00-background" width="${W}" height="${H}" fill="${plan.palette.bg}"/>
${groups}
</svg>
`;
}

/* ---------- one layer as a transparent PNG ---------- */
async function layerPNG(plan, index) {
  const [W, H] = plan.canvas;
  const svg = renderSVG(plan, { transparent: true, only: index });
  return await svgToCanvas(svg, W, H);
}

/* ---------- timeline reference for FilmCraft / Premiere ---------- */
function buildTimelineXML(plan) {
  const [W, H] = plan.canvas;
  const fps = 30, dur = 150;
  const rows = plan.elements.map((el, i) => {
    const id = String(i + 1).padStart(2, '0');
    const file = `layer-${id}-${el.role}.png`;
    const delayFrames = el.role === 'headline' ? 6 : (el.kind === 'type' ? 4 : 0);
    return `  <clip id="${id}" name="${esc(el.role)}" file="${file}"`
      + ` in="${delayFrames}" out="${dur}" z="${i + 1}"`
      + ` x="${el.rect ? Math.round(el.rect[0]) : ''}" y="${el.rect ? Math.round(el.rect[1]) : ''}" opacity="${el.opacity != null ? el.opacity : 1}"/>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- مِرسم — timeline reference. One clip per layer over ${dur / fps} seconds at ${fps} fps.
     Import the PNGs in order; use in/out as the suggested entrance timing. -->
<mirsam-timeline version="1" width="${W}" height="${H}" fps="${fps}" duration="${dur}">
  <sequence name="mirsam-${W}x${H}" composition="${esc(plan.meta.composition)}" genre="${esc(plan.meta.genre)}">
${rows}
  </sequence>
</mirsam-timeline>
`;
}

/* ---------- flat export (main button) with scale/format ---------- */
async function exportFlat(plan, canvas, opts = {}) {
  const scale = opts.scale || 1;
  const fmt = opts.format || 'png';
  const mime = fmt === 'jpg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png');
  let blob = null;
  const [w0, h0] = plan.canvas;
  const base = `mirsam-${w0}x${h0}`;

  if (scale === 1) {
    blob = await new Promise(res => canvas.toBlob(res, mime, 0.92));
  } else {
    /* B10: re-render the vector at the target resolution — upscaling the
       bitmap would only blur it. Keep the SVG intrinsic size in sync so the
       browser rasterises at full quality, then re-apply the grain layer. */
    const W = Math.round(w0 * scale), H = Math.round(h0 * scale);
    const svg = renderSVG(plan).replace(`width="${w0}" height="${h0}"`, `width="${W}" height="${H}"`);
    const c = finish(await svgToCanvas(svg, W, H), plan);
    blob = await new Promise(res => c.toBlob(res, mime, 0.92));
  }
  downloadBlob(`${base}-${scale}x.${fmt}`, blob);
  return [`${base}-${scale}x.${fmt}`];
}

/* ---------- program-aware package ---------- */
async function exportForProgram(program, plan, canvas, opts = {}) {
  const def = EXPORT_PROGRAMS[program] || EXPORT_PROGRAMS.photocraft;
  const [W, H] = plan.canvas;
  const scale = opts.scale || 1;
  const files = [];
  const project = buildProject(plan, {
    scale, target: program, fps: opts.fps || 30, slides: opts.slides || 1
  });

  /* B3: annotate overflow layers BEFORE the JSON leaves — after the download
     the note would never reach the file */
  const raster = def.kind !== 'vector';
  const maxLayers = 14;
  if (raster && plan.elements.length > maxLayers) {
    project.layers.slice(maxLayers).forEach(l => (l.note = 'غير مُصدَّر كملف — موضَّح في الخطة'));
  }

  downloadJSON('mirsam-project.json', project);
  files.push('mirsam-project.json');
  await delay(120);

  downloadText('mirsam-layers.svg', buildLayeredSVG(plan), 'image/svg+xml;charset=utf-8');
  files.push('mirsam-layers.svg');
  await delay(120);

  if (def.kind === 'frames') {
    downloadText('mirsam-timeline.xml', buildTimelineXML(plan), 'application/xml');
    files.push('mirsam-timeline.xml');
    await delay(120);
  }

  if (raster) {
    /* raster packages carry every layer as its own transparent PNG */
    const max = Math.min(plan.elements.length, maxLayers);
    for (let i = 0; i < max; i++) {
      const el = plan.elements[i];
      const elCanvas = await layerPNG(plan, i);
      const blob = await new Promise(res => elCanvas.toBlob(res, 'image/png'));
      const name = `layer-${String(i + 1).padStart(2, '0')}-${el.role}.png`;
      downloadBlob(name, blob);
      files.push(name);
      await delay(160);
    }
  }

  downloadText(`GUIDE-${program}.txt`, EXPORT_GUIDES[def.guide] || 'انظر docs/COMPATIBILITY.md');
  files.push(`GUIDE-${program}.txt`);
  return files;
}

/* =========================================================================
   format exporters — PDF · PSD · GIF · (QR ships inside the design)
   Three open-source libraries vendored in web/vendor/ (no CDN at runtime):
   pdf-lib (Apache-2.0) · ag-psd (MIT) · gif.js (WTFPL/MIT) · qrcode-generator (MIT)
   Each builder returns {name, blob} so the UI downloads once and tests can
   read the bytes without touching the downloads folder.
   ========================================================================= */

function dataURLToBytes(dataURL) {
  const bin = atob(String(dataURL).split(',')[1] || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* rasterise at a target scale — the vector is re-rendered, never upscaled */
async function renderAt(plan, scale, canvas) {
  const [w0, h0] = plan.canvas;
  if (scale === 1 && canvas) return canvas;
  const W = Math.round(w0 * scale), H = Math.round(h0 * scale);
  const svg = renderSVG(plan).replace(`width="${w0}" height="${h0}"`, `width="${W}" height="${H}"`);
  return await finish(await svgToCanvas(svg, W, H), plan);
}

/* one element as a transparent PNG at a target scale */
async function layerPNGAt(plan, index, scale = 1) {
  const [W, H] = plan.canvas;
  const svg = renderSVG(plan, { transparent: true, only: index });
  if (scale === 1) return await svgToCanvas(svg, W, H);
  const SW = Math.round(W * scale), SH = Math.round(H * scale);
  return await svgToCanvas(
    svg.replace(`width="${W}" height="${H}"`, `width="${SW}" height="${SH}"`), SW, SH);
}

/* ---------- PDF (print) ---------- */
async function buildPDF(plan, canvas, opts = {}) {
  if (typeof PDFLib === 'undefined') {
    throw new Error('مكتبة PDF غير محمّلة — تحقق من vendor/pdf-lib.min.js في index.html');
  }
  const scale = Number(opts.scale) || 1;
  const [w0, h0] = plan.canvas;
  const src = await renderAt(plan, scale, canvas);

  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle(`مِرسم — ${plan.meta.genreName || plan.meta.composition || 'تصميم'}`);
  pdf.setCreator('مِرسم — استوديو التصميم الإبداعي');
  pdf.setProducer('mirsam · pdf-lib');
  const img = await pdf.embedPng(dataURLToBytes(src.toDataURL('image/png')));

  /* 96 CSS px → 72 pt, so the page keeps the design's physical proportions;
     a 2× export fills the same page with twice the pixels (more DPI) */
  const pw = w0 * 0.75, ph = h0 * 0.75;
  const page = pdf.addPage([pw, ph]);
  page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
  page.setMediaBox(0, 0, pw, ph);

  const bytes = await pdf.save();
  const suffix = scale !== 1 ? `-${scale}x` : '';
  return {
    name: `mirsam-${w0}x${h0}${suffix}.pdf`,
    blob: new Blob([bytes], { type: 'application/pdf' })
  };
}

/* ---------- PSD with real layers (opens in PhotoCraft / Photoshop) ---------- */
async function buildPSD(plan, canvas, opts = {}) {
  if (typeof agPsd === 'undefined') {
    throw new Error('مكتبة ag-psd غير محمّلة — تحقق من vendor/ag-psd.js في index.html');
  }
  const scale = Number(opts.scale) || 1;
  const [w0, h0] = plan.canvas;
  const W = Math.round(w0 * scale), H = Math.round(h0 * scale);
  const composite = (scale === 1 && canvas) ? canvas : await renderAt(plan, scale, canvas);

  /* one pixel layer per visible element, topmost first (Photoshop order) */
  const children = [];
  for (let i = plan.elements.length - 1; i >= 0; i--) {
    const el = plan.elements[i];
    if (el.hidden) continue;
    const lc = await layerPNGAt(plan, i, scale);
    children.push({
      name: `${String(i + 1).padStart(2, '0')} ${el.role}`,
      canvas: lc,
      opacity: el.opacity != null ? el.opacity : 1,
      hidden: false,
      blendMode: 'normal'
    });
  }
  /* the base colour lives as its own layer in every mِرسم design */
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const bctx = bg.getContext('2d');
  bctx.fillStyle = plan.palette.bg;
  bctx.fillRect(0, 0, W, H);
  children.push({ name: '00 background', canvas: bg, opacity: 1, hidden: false, blendMode: 'normal' });

  /* Layer order verified empirically against PhotoCraft: the record written
     last renders on top. The array is built top-down (topmost element first,
     background last) so reversing it yields the correct bottom-up stack:
     background at the bottom, the last plan element on top. */
  children.reverse();

  const psd = {
    width: W, height: H, channels: 3, depth: 8, bitsPerChannel: 8,
    children,
    canvas: composite
  };
  const buf = agPsd.writePsd(psd, { generateThumbnail: true });
  const suffix = scale !== 1 ? `-${scale}x` : '';
  return {
    name: `mirsam-${w0}x${h0}${suffix}.psd`,
    blob: new Blob([buf], { type: 'image/vnd.adobe.photoshop' })
  };
}

/* ---------- GIF from the carousel (hold → cross-fade → hold) ---------- */
async function gifFrameList(canvas, plan) {
  const useSlides = typeof slides !== 'undefined' && slides.length > 1
    && typeof slideBrief === 'function' && typeof runLoop === 'function';
  if (!useSlides) return [{ canvas, bg: plan.palette.bg }];
  if (typeof captureSlide === 'function') captureSlide();
  const out = [];
  for (const s of slides) {
    /* eslint-disable-next-line no-await-in-loop */
    const res = await runLoop(slideBrief(s));
    out.push({ canvas: res.canvas, bg: res.plan.palette.bg });
  }
  return out;
}

async function buildGIF(plan, canvas, opts = {}, onProgress) {
  if (typeof GIF === 'undefined') {
    throw new Error('مكتبة gif.js غير محمّلة — تحقق من vendor/gif.js و vendor/gif.worker.js');
  }
  const list = await gifFrameList(canvas, plan);
  const gw = Math.min(560, plan.canvas[0]);
  const gh = Math.round(plan.canvas[1] * (gw / plan.canvas[0]));
  const cv = document.createElement('canvas');
  cv.width = gw; cv.height = gh;
  const ctx = cv.getContext('2d');

  const gif = new GIF({
    workers: 2, quality: 9, width: gw, height: gh,
    workerScript: 'vendor/gif.worker.js'
  });

  const draw = (a, b, alpha) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = a.bg;
    ctx.fillRect(0, 0, gw, gh);
    ctx.drawImage(a.canvas, 0, 0, gw, gh);
    if (b) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(b.canvas, 0, 0, gw, gh);
      ctx.globalAlpha = 1;
    }
  };

  for (let i = 0; i < list.length; i++) {
    draw(list[i]);
    gif.addFrame(ctx, { copy: true, delay: 1100 });
    if (i < list.length - 1) {
      for (let s = 1; s <= 5; s++) {
        draw(list[i], list[i + 1], s / 6);
        gif.addFrame(ctx, { copy: true, delay: 60 });
      }
    }
  }

  if (typeof onProgress === 'function') gif.on('progress', p => onProgress(p));
  const blob = await new Promise((resolve, reject) => {
    gif.on('finished', resolve);
    try { gif.render(); } catch (e) { reject(e); }
  });
  if (!blob || !blob.size) throw new Error('لم يُنتج أي إطار GIF');
  return { name: `mirsam-${list.length > 1 ? 'slides' : 'design'}-${gw}px.gif`, blob };
}
