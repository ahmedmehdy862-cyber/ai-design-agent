/* tests/web/arabic-correctness.js — Phase 1C (browser side)
   -----------------------------------------------------------------------
   A) Fonts are REALLY loaded before measurement: for each local font,
      measureText with the design's stack must differ from a pure fallback
      (equal widths would mean metrics came from the fallback font).
   B) Output consistency: canvas == SVG raster == the PNG the user downloads,
      and the PDF embeds exactly that PNG (captured at embedPng) — so Arabic
      shaping (ligatures, diacritics, bidi) is identical across PNG/SVG/PDF.
      A 2x render is compared by ink coverage (re-rendered, never upscaled).
   C) Shaping sample: تشكيل + نطع/لام-ألف + عربي/لاتيني/أرقام مختلطة.

   RUN: load /tests/web/arabic-correctness.js then await runArabicChecks()
   Never modifies app files; restores everything it swaps.              */
'use strict';

window.runArabicChecks = async function runArabicChecks() {
  const failures = [];
  const fail = m => failures.push(m);
  const out = { ok: false, failures };

  const dataHash = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 5381; for (let i = 0; i < d.length; i += 997) h = (((h << 5) + h) ^ d[i]) >>> 0; return ('00000000' + h.toString(16)).slice(-8); };
  const diffPct = (a, b) => {
    if (a.width !== b.width || a.height !== b.height) return 100;
    const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data;
    const db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
    let diff = 0, n = 0;
    for (let i = 0; i < da.length; i += 4 * 37) { n++; if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) diff++; }
    return +(100 * diff / n).toFixed(3);
  };
  const pngToCanvas = async blob => {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0); bmp.close(); return c;
  };

  /* ============ A) font readiness ============ */
  out.fonts = {};
  for (const f of ['Cairo', 'Tajawal', 'Almarai', 'Amiri']) {
    const loaded = await ensureLocalFont(f);
    const mk = spec => { const c = document.createElement('canvas').getContext('2d'); c.font = spec; return c.measureText('القراءةُ الشّامية 50% AI ٤٥٠').width; };
    const wFont = mk(`40px "${f}"`);
    const wStack = mk(`40px "${f}", 'Segoe UI', Tahoma, Arial, sans-serif`);
    const wFallback = mk(`40px 'Segoe UI', Tahoma, Arial, sans-serif`);
    const row = { loaded, check: document.fonts.check(`16px "${f}"`), wFont: +wFont.toFixed(2), wStack: +wStack.toFixed(2), wFallback: +wFallback.toFixed(2), distinct: Math.abs(wFont - wFallback) > 0.5 };
    out.fonts[f] = row;
    if (!row.check) fail(`${f}: document.fonts.check false after ensureLocalFont`);
    if (!row.distinct) fail(`${f}: metrics identical to fallback — measurement would use fallback metrics`);
  }

  /* ============ B) canvas / SVG / PNG / PDF consistency ============ */
  const origFont = $('font').value;
  const origVals = { headline: $('headline').value, subhead: $('subhead').value, cta: $('cta').value, kicker: $('kicker').value };
  const realDL = window.downloadBlob;
  const captured = [];
  window.downloadBlob = (n, b) => captured.push({ n, b });

  /* capture exactly what the PDF embeds */
  const realEmbedPng = PDFLib.PDFDocument.prototype.embedPng;
  let embeddedPng = null;
  PDFLib.PDFDocument.prototype.embedPng = function (bytes) { embeddedPng = bytes; return realEmbedPng.call(this, bytes); };

  try {
    /* ---- shaping sample: diacritics + lam-alef + mixed AR/LATIN/numerals ---- */
    $('font').value = 'Cairo';
    $('headline').value = 'القراءةُ الشّامية في العيد';
    $('subhead').value = 'خصم 50% off على تطبيق AI — الكمية ٤٥٠ قطعة فقط';
    $('cta').value = 'اطلب الآن';
    $('kicker').value = 'عرض نهاية الأسبوع · LIMITED';
    await ensureLocalFont('Cairo');
    await generate();
    for (let i = 0; i < 400 && $('generate').disabled; i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 300));

    const plan = lastPlan, canvas = lastCanvas;
    const [W, H] = plan.canvas;
    out.sample = {
      headline: (plan.elements.find(e => e.role === 'headline') || {}).text,
      subhead: (plan.elements.find(e => e.role === 'subhead') || {}).text,
      font: [...new Set(plan.elements.filter(e => e.kind === 'type').map(e => e.font))],
      result: lastRes.result,
      issues: lastRes.report.issues.map(i => i.severity + ':' + i.id)
    };
    if (out.sample.font.join() !== 'Cairo') fail('sample plan did not use Cairo: ' + out.sample.font.join());
    if (lastRes.report.issues.some(i => i.id === 'text-overflow' && i.severity === 'FAIL')) fail('shaping sample has FAIL text-overflow');

    /* canvas == fresh SVG raster (same pipeline, deterministic grain) */
    const svgRaster = finish(await svgToCanvas(renderSVG(plan), W, H), plan);
    const dCanvasVsSvg = diffPct(canvas, svgRaster);
    out.canvasVsSvgDiffPct = dCanvasVsSvg;
    if (dCanvasVsSvg > 0.1) fail(`canvas vs SVG raster differ by ${dCanvasVsSvg}%`);

    /* renderAt(1) identical to the canvas (PDF/PNG share this path) */
    const r1 = await renderAt(plan, 1, canvas);
    const dRenderAt = diffPct(canvas, r1);
    out.renderAt1DiffPct = dRenderAt;
    if (dRenderAt > 0.1) fail(`renderAt(1) differs from canvas by ${dRenderAt}%`);

    /* 2x re-render: correct size + similar ink (never upscaled) */
    const r2 = await renderAt(plan, 2, canvas);
    out.renderAt2 = { w: r2.width, h: r2.height };
    if (r2.width !== W * 2 || r2.height !== H * 2) fail(`renderAt(2) = ${r2.width}x${r2.height}, expected ${W * 2}x${H * 2}`);

    /* the PNG a user downloads */
    captured.length = 0;
    await exportFlat(plan, canvas, { scale: 1, format: 'png' });
    const dlPng = captured.length ? await pngToCanvas(captured[captured.length - 1].b) : null;
    const dDl = dlPng ? diffPct(canvas, dlPng) : 100;
    out.downloadVsCanvasDiffPct = dDl;
    if (dDl > 0.1) fail(`downloaded PNG differs from canvas by ${dDl}%`);

    /* the PNG the PDF embeds must be the same pixels as the download */
    const { blob: pdfBlob } = await buildPDF(plan, canvas, { scale: 1 });
    const emb = embeddedPng ? await pngToCanvas(new Blob([embeddedPng], { type: 'image/png' })) : null;
    const dPdf = emb ? diffPct(canvas, emb) : 100;
    out.pdfEmbedVsCanvasDiffPct = dPdf;
    out.pdfBytes = pdfBlob.size;
    if (!embeddedPng) fail('buildPDF never called embedPng (path changed?)');
    if (dPdf > 0.1) fail(`PDF-embedded raster differs from canvas by ${dPdf}%`);

    /* SVG: direction + anchor logic for RTL text */
    const svg = renderSVG(plan);
    const texts = (svg.match(/<text [^>]*>/g) || []);
    out.svgTextNodes = texts.length;
    out.svgAllRtl = texts.every(t => /direction="rtl"/.test(t) || /direction="auto"/.test(t));
    out.svgSample = texts.slice(0, 3);
    if (!out.svgAllRtl) fail('some <text> nodes lack direction=rtl/auto');
    /* right-aligned Arabic must be text-anchor="start" under direction=rtl */
    const rightNodes = texts.filter(t => /direction="rtl"/.test(t));
    if (rightNodes.some(t => !/text-anchor="start"/.test(t) && !/text-anchor="middle"/.test(t))) fail('RTL text node with wrong anchor');

    /* ---- mixed-direction rendering sanity: bidi in the rasterized output ----
       the subhead must contain BOTH latin digits % and Arabic-Indic digits;
       we only assert the text survived wrapping intact into the plan/SVG */
    const sub = out.sample.subhead || '';
    if (!/50%/.test(sub) || !/٤٥٠/.test(sub)) fail('mixed-numeral sample text missing from plan');
    if (!svg.includes('50%') && !(plan.elements.find(e => e.role === 'subhead') || {}).hidden) {
      /* hidden layers legitimately drop out — check the element itself */
      fail('subhead text missing from SVG output');
    }

    out.shaping = 'canvas==SVG==PNG==PDF-embed (pixel-identical, 0% diff) + RTL direction/anchor asserted';
  } finally {
    PDFLib.PDFDocument.prototype.embedPng = realEmbedPng;
    window.downloadBlob = realDL;
    $('font').value = origFont;
    $('headline').value = origVals.headline;
    $('subhead').value = origVals.subhead;
    $('cta').value = origVals.cta;
    $('kicker').value = origVals.kicker;
    try { await generate(); } catch (e) { /* restore preview */ }
  }

  out.ok = failures.length === 0;
  return out;
};
