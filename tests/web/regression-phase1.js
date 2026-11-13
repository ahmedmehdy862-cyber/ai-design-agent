/* tests/web/regression-phase1.js — Phase 1 regression suite (browser side)
   -----------------------------------------------------------------------
   1) baseline: the 3 Phase-0 briefs must reproduce identical fingerprints
      (tests/baseline/phase0.json): poster c9b16ad8 · story 6be4d739 ·
      carousel 2df4ef98 (+ split timing/slide count)
   2) exports under CSP: GIF (web worker), carousel PNG+manifest, markdown
   3) inspector: one override changes only its layer; undo/redo; persistence
   4) local-only mode: no key -> local parse/design works, AI path fails with
      a message (network stubbed so no provider call leaves the browser)

   RUN: await runPhase1Regression()      (call after a fresh page load)   */
'use strict';

window.runPhase1Regression = async function runPhase1Regression() {
  const failures = [];
  const fail = m => failures.push(m);
  const out = { failures };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $g = id => document.getElementById(id);
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0; return ('00000000' + h.toString(16)).slice(-8); };
  const snap = () => {
    const p = lastPlan, rep = lastRes.report, c = critic(rep, p);
    return {
      result: lastRes.result, elements: p.elements.length,
      contrast: +rep.maxContrast.toFixed(2), right: +(rep.rightShare * 100).toFixed(0),
      score: c.overall, grade: c.grade,
      issues: rep.issues.map(i => i.severity + ':' + i.id).sort(),
      fp: hash(JSON.stringify({ c: p.canvas, e: p.elements, pal: p.palette, m: p.meta, g: p.grid, f: p.focal, ts: p.typeScale, ra: p.rationale }))
    };
  };
  const gen = async (promptText) => {
    $g('prompt').value = promptText;
    runLocalParse();
    for (let i = 0; i < 500 && $g('generate').disabled; i++) await wait(50);
    await wait(200);
    return snap();
  };
  const realDL = window.downloadBlob;
  const cap = [];
  window.downloadBlob = (n, b) => cap.push({ n, b });

  try {
    /* ================= 1) baseline fingerprints ================= */
    const A = 'بوستر إعلاني فلاير لمعرض الكتاب السنوي في القاعة الرئيسية، أكثر من ٤٠٠ دار نشر وخصومات حتى ٥٠٪ من ١٥ إلى ٢٥ ديسمبر، عنوان: معرض الكتاب، زر: احجز تذكرتك، بأسلوب جسور ومشع';
    const B = 'ستوري إنستغرام لافتتاح متجر عناية بالبشرة، عنوان: افتتاح كبير، وصف: خصم ٣٠٪ لمدة ثلاثة أيام في كل الفروع، زر: تصفح الآن، بأسلوب هادئ فاخر وأنيق';
    const C = 'بوست متعدد الشرائح لافتتاح متجر عناية · العنوان: افتتاح كبير · زر: اطلب الآن · خصم ٣٠٪ على كل المنتجات · هدايا مجانية لأول ١٠٠ زائر · ورشة تجميل مجانية · موسيقى حية كل مساء';

    await gen('منشور تجريبي للقياس');
    const poster = await gen(A);
    const story = await gen(B);
    const cover = await gen(C);
    const t0 = performance.now();
    await autoCarousel();
    const splitMs = Math.round(performance.now() - t0);
    const carouselSnap = snap();

    out.baseline = {
      poster, story, carousel: Object.assign({}, carouselSnap, { slides: slides.length, splitMs }),
      thumbs: document.querySelectorAll('#carStrip .car-thumb, #carStrip [role="tab"]').length
    };
    const expect = {
      poster: { fp: 'c9b16ad8', result: 'UNIMPROVABLE', elements: 9, issues: ['NOTE:edge-spill', 'WARN:text-overflow'] },
      story: { fp: '6be4d739', result: 'CLEAN', elements: 8 },
      cover: { fp: '2df4ef98', result: 'UNIMPROVABLE', elements: 8 },
      split: { fp: 'a1986808', elements: 6, slides: 7 }
    };
    out.baseline.cover = cover;
    out.baseline.split = carouselSnap;
    out.baseline.split.slides = slides.length;
    for (const k of ['poster', 'story', 'cover', 'split']) {
      const a = out.baseline[k], e = expect[k];
      if (a.fp !== e.fp) fail(`${k}: fingerprint ${a.fp} != baseline ${e.fp}`);
      if (e.result && a.result !== e.result) fail(`${k}: result ${a.result} != baseline ${e.result}`);
      if (a.elements !== e.elements) fail(`${k}: elements ${a.elements} != baseline ${e.elements}`);
      if (e.issues && JSON.stringify(a.issues) !== JSON.stringify(e.issues)) fail(`${k}: issues ${JSON.stringify(a.issues)} != ${JSON.stringify(e.issues)}`);
      if (e.slides && a.slides !== e.slides) fail(`${k}: slides ${a.slides} != ${e.slides}`);
    }
    out.baselineTiming = { posterMs: null, splitMs, note: 'split re-ran; original baseline split 1145ms' };

    /* ================= 2) exports under CSP ================= */
    /* GIF: one frame (slides stashed so the worker path is still exercised)
       buildGIF returns {name, blob} — the caller downloads it */
    {
      const saved = slides.slice();
      try {
        slides.length = 0;
        const gif = await buildGIF(lastPlan, lastCanvas, {}, () => {});
        const u8 = new Uint8Array(await gif.blob.arrayBuffer());
        const sig = String.fromCharCode(...u8.subarray(0, 3));
        const w = u8[6] | (u8[7] << 8), h = u8[8] | (u8[9] << 8);
        const gW = Math.min(560, lastPlan.canvas[0]);
        const gH = Math.round(lastPlan.canvas[1] * (gW / lastPlan.canvas[0]));
        out.gif = { name: gif.name, bytes: u8.length, sig, w, h, expect: [gW, gH] };
        if (sig !== 'GIF') fail('GIF signature missing');
        if (w !== gW || h !== gH) fail(`GIF dims ${w}x${h} != ${gW}x${gH}`);
      } finally { slides.length = 0; for (const s of saved) slides.push(s); }
    }

    /* carousel batch: N PNG + mirsam-carousel.json */
    {
      cap.length = 0;
      await exportCarousel();
      const pngs = cap.filter(c => /\.png$/.test(c.n));
      const man = cap.find(c => /mirsam-carousel\.json$/.test(c.n));
      out.carouselExport = { files: cap.length, pngs: pngs.length, manifest: !!man };
      if (pngs.length !== slides.length) fail(`carousel: ${pngs.length} PNG != ${slides.length} slides`);
      if (!man) fail('carousel: mirsam-carousel.json missing');
      else {
        const j = JSON.parse(await man.b.text());
        out.carouselExport.manifestSlides = j.count || (j.order || []).length;
        out.carouselExport.manifestFormat = j.format;
        if (!out.carouselExport.manifestSlides) fail('carousel manifest has no slides');
        if ((j.order || []).length !== slides.length) fail(`carousel manifest order ${(j.order || []).length} != ${slides.length}`);
      }
    }

    /* markdown content plan */
    {
      cap.length = 0;
      downloadContentPlan();
      const md = cap.find(c => /\.md$/.test(c.n));
      out.markdown = { name: md ? md.n : null, bytes: md ? md.b.size : 0 };
      if (!md || md.b.size < 100) fail('markdown content plan missing/empty');
    }

    /* ================= 3) inspector isolation + undo/redo ================= */
    {
      const key = (lastPlan.elements.find(e => e.kind === 'type' && e.role === 'headline') || lastPlan.elements.find(e => e.kind === 'type') || {}).key;
      if (!key) fail('inspector: no text layer found');
      else {
        const before = JSON.parse(JSON.stringify(lastPlan.elements));
        const baseX = before.find(e => e.key === key).x;
        setOverride(key, { dx: 14, dy: 0 }, 'إزاحة أفقية');
        saveOverrides();
        await generate();
        for (let i = 0; i < 400 && $g('generate').disabled; i++) await wait(50);
        const after = lastPlan.elements;
        const moved = after.find(e => e.key === key);
        const changedKeys = after.filter((e, i) => JSON.stringify(e) !== JSON.stringify(before[i])).map(e => e.key);
        out.inspector = {
          key, baseX, newX: moved ? moved.x : null,
          changedLayers: changedKeys, ls: !!localStorage.getItem('mirsam.overrides'),
          lsBytes: (localStorage.getItem('mirsam.overrides') || '').length
        };
        if (!moved || moved.x !== baseX + 14) fail(`inspector: ${key} x did not move by 14 (${baseX} -> ${moved && moved.x})`);
        if (changedKeys.length !== 1 || changedKeys[0] !== key) fail(`inspector: expected only ${key} to change, got ${JSON.stringify(changedKeys)}`);
        if (!out.inspector.ls) fail('inspector: override not persisted to localStorage');

        /* undo restores the planned position, redo re-applies it */
        doUndo();
        for (let i = 0; i < 400 && $g('generate').disabled; i++) await wait(50);
        await wait(200);
        const undoX = (lastPlan.elements.find(e => e.key === key) || {}).x;
        doRedo();
        for (let i = 0; i < 400 && $g('generate').disabled; i++) await wait(50);
        await wait(200);
        const redoX = (lastPlan.elements.find(e => e.key === key) || {}).x;
        out.inspector.undoX = undoX; out.inspector.redoX = redoX;
        if (undoX !== baseX) fail(`undo: x ${undoX} != planned ${baseX}`);
        if (redoX !== baseX + 14) fail(`redo: x ${redoX} != edited ${baseX + 14}`);

        /* clean up so the baseline state of localStorage is preserved */
        delete overrides[key];
        if (overrides.__order) delete overrides.__order;
        saveOverrides();
        if (!Object.keys(overrides).length) localStorage.removeItem('mirsam.overrides');
        await generate();
        for (let i = 0; i < 400 && $g('generate').disabled; i++) await wait(50);
      }
    }

    /* ================= 4) local-only mode (no keys) ================= */
    {
      const savedAI = localStorage.getItem('mirsam.ai');
      localStorage.removeItem('mirsam.ai');
      localStorage.removeItem('mirsam.engine');
      const before = snap();
      const local = await gen('بوستر بلا مفاتيح لاختبار الوضع المحلي');
      out.localOnly = { result: local.result, elements: local.elements, aiAvailable: typeof visionAvailable === 'function' ? visionAvailable() : 'n/a' };
      if (!local.elements) fail('local-only: no design produced');
      if (out.localOnly.aiAvailable) fail('local-only: vision reported available without a key');

      /* AI path must fail with a message, not a provider request: stub fetch */
      const realFetch = window.fetch;
      let providerHit = false;
      window.fetch = () => { providerHit = true; return Promise.reject(new Error('blocked in test')); };
      try {
        $g('prompt').value = 'بوستر اختبار';
        let msg = '';
        try { await runAIParse(); } catch (e) { msg = e.message; }
        await wait(300);
        const statusTxt = ($g('aiStatus') || {}).textContent || '';
        out.localOnly.aiError = msg || statusTxt;
        if (!providerHit) fail('local-only AI path never attempted a call (unexpected)');
        if (!(msg || statusTxt)) fail('local-only: AI failure produced no message');
      } finally { window.fetch = realFetch; }
      if (savedAI) localStorage.setItem('mirsam.ai', savedAI);
    }
  } finally {
    window.downloadBlob = realDL;
  }

  out.ok = failures.length === 0;
  return out;
};