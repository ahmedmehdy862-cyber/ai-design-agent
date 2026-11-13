/* tests/web/export-integrity.js — Phase 1B automated export test (browser side)
   -----------------------------------------------------------------------
   WHAT IT ASSERTS
   1) exact pixel dimensions of the PNG a user downloads, for
      5 sizes x 3 scales = 15/15 combos:
      [1080x1350, 1080x1080, 1080x1920, 1920x1080, 1050x600] x [1, 2, 0.5]
      (parsed from the PNG IHDR bytes of the captured blob — not from args)
   2) PSD: re-parsed with ag-psd — width/height, layer names/order against the
      layers manifest (buildProject), and whether text is editable (truth).
   3) PDF: header, exact MediaBox, embedded raster dimensions == renderAt.
   4) SVG: intrinsic size, one <g> per layer, embedded @font-face base64,
      Arabic text present.

   HOW TO RUN
   open http://127.0.0.1:8137/ (or the header server on 8138), load this file
   in the console, then:  await runExportIntegrity()
   Nothing here modifies the app; downloads are captured by temporarily
   swapping window.downloadBlob and restored in finally.

   Returns { ok, summary, sizes[], psd, pdf, svg, failures[] }           */
'use strict';

window.runExportIntegrity = async function runExportIntegrity() {
  const SIZES = [[1080, 1350], [1080, 1080], [1080, 1920], [1920, 1080], [1050, 600]];
  const SCALES = [1, 2, 0.5];
  const failures = [];
  const out = { ok: false, sizes: [], failures };
  const fail = m => failures.push(m);

  const pngDims = buf => {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    /* PNG signature + IHDR length/type then width/height big-endian */
    const sig = [0x89, 0x50, 0x4e, 0x47];
    for (let i = 0; i < 4; i++) if (v.getUint8(i) !== sig[i]) return null;
    if (v.getUint32(12) !== 0x49484452) return null;      /* 'IHDR' */
    return [v.getUint32(16), v.getUint32(20)];
  };
  const blobBytes = async blob => new Uint8Array(await blob.arrayBuffer());
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  /* real plan + real finished canvas, exactly like generate() produces */
  const planFor = async (w, h) => {
    const b = Object.assign({}, briefFromUI(), { width: w, height: h });
    return await runLoop(b, { autoFix: false });
  };
  const canvasFor = async plan => finish(
    await svgToCanvas(renderSVG(plan), plan.canvas[0], plan.canvas[1]), plan);

  /* ---- capture downloads without touching the disk ---- */
  const realDownload = window.downloadBlob;
  const captured = [];
  window.downloadBlob = (name, blob) => captured.push({ name, blob });

  try {
    /* ================= 1) 15 size/scale PNG dimension checks ================ */
    for (const [w, h] of SIZES) {
      const { plan } = await planFor(w, h);
      const canvas = await canvasFor(plan);
      for (const scale of SCALES) {
        const expect = [Math.round(w * scale), Math.round(h * scale)];
        captured.length = 0;
        let names = [];
        try {
          names = await exportFlat(plan, canvas, { scale, format: 'png' });
        } catch (e) { fail(`exportFlat ${w}x${h}@${scale} threw: ${e.message}`); continue; }
        const got = captured.length ? pngDims(await blobBytes(captured[captured.length - 1].blob)) : null;
        const expectName = `mirsam-${w}x${h}-${scale}x.png`;
        const row = { size: `${w}x${h}`, scale, expect, got, name: names[0] || null, pass: !!got && got[0] === expect[0] && got[1] === expect[1] && names[0] === expectName };
        if (!row.pass) fail(`PNG ${w}x${h}@${scale}: expected ${expect.join('x')} / ${expectName}, got ${got ? got.join('x') : 'null'} / ${names[0]}`);
        out.sizes.push(row);
      }
    }

    /* ================= 2) PSD re-parse vs layers manifest =================== */
    {
      const { plan } = await planFor(1080, 1350);
      const canvas = await canvasFor(plan);
      const { name, blob } = await buildPSD(plan, canvas, { scale: 1 });
      const bytes = await blobBytes(blob);
      const psd = agPsd.readPsd(bytes, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });

      const manifest = buildProject(plan, { scale: 1 }).layers;
      const manifestNames = manifest.map(l => `${l.id.replace('layer-', '')} ${l.name}`);
      const psdNames = (psd.children || []).map(c => c.name);

      /* file order: index 0 = bottom (background), last = topmost element */
      const withoutBg = psdNames.filter(n => n !== '00 background');
      const hasBg = psdNames.includes('00 background');
      const namesMatch = JSON.stringify(withoutBg) === JSON.stringify(manifestNames);
      const bgIsFirst = psdNames[0] === '00 background';

      /* editability truth: no text layers written — children carry pixels only */
      const anyTextLayer = (psd.children || []).some(c => c.text != null || c.engineData != null);

      out.psd = {
        file: name, bytes: bytes.length,
        width: psd.width, height: psd.height,
        layerCount: psdNames.length, manifestCount: manifestNames.length,
        namesMatch, backgroundPresent: hasBg, backgroundIsBottom: bgIsFirst,
        firstLayer: psdNames[0], topLayer: psdNames[psdNames.length - 1],
        textLayers: anyTextLayer,
        truth: 'PSD layers are raster (pixel) layers — text is NOT editable as text; names/order match the manifest (00 background is the base the manifest does not list).'
      };
      if (psd.width !== 1080 || psd.height !== 1350) fail(`PSD size ${psd.width}x${psd.height} != 1080x1350`);
      if (!namesMatch) fail('PSD layer names/order differ from the layers manifest: PSD=' + JSON.stringify(psdNames.slice(0, 6)) + ' vs manifest=' + JSON.stringify(manifestNames.slice(0, 6)));
      if (!hasBg || !bgIsFirst) fail('PSD background layer missing or not at the bottom');
      if (anyTextLayer) fail('PSD unexpectedly claims text layers — truth report would be wrong');
    }

    /* ================= 3) PDF header / MediaBox / raster dims =============== */
    {
      const { plan } = await planFor(1080, 1350);
      const canvas = await canvasFor(plan);
      for (const scale of [1, 2]) {
        const { name, blob } = await buildPDF(plan, canvas, { scale });
        const bytes = await blobBytes(blob);
        const txt = new TextDecoder('latin1').decode(bytes);
        /* pdf-lib packs the page dictionary into a compressed object stream, so
           /MediaBox is not greppable — re-open the file and read it properly */
        const doc = await PDFLib.PDFDocument.load(bytes);
        const pg = doc.getPage(0);
        const mb = pg.getMediaBox();
        const pageOk = Math.abs(mb.width - 1080 * 0.75) < 0.01 && Math.abs(mb.height - 1350 * 0.75) < 0.01 && mb.x === 0 && mb.y === 0;
        const wM = [...txt.matchAll(/\/Width\s+(\d+)/g)].map(m => +m[1]);
        const hM = [...txt.matchAll(/\/Height\s+(\d+)/g)].map(m => +m[1]);
        const expect = [Math.round(1080 * scale), Math.round(1350 * scale)];
        const imgOk = wM.includes(expect[0]) && hM.includes(expect[1]);
        const row = { scale, header: txt.slice(0, 5), mediaBox: [+mb.width, +mb.height], image: wM.length ? [wM[0], hM[0]] : null, expect, pass: txt.startsWith('%PDF') && pageOk && imgOk };
        if (!row.pass) fail(`PDF@${scale}: header=${row.header} mediaBox=${row.mediaBox} image=${row.image} expect=${expect.join('x')}`);
        out.pdf = out.pdf || { name, rows: [] };
        out.pdf.rows.push(row);
      }
      out.pdf.truth = 'PDF embeds the finished raster (canvas==SVG pixel-identical), so Arabic shaping in the PDF is exactly the canvas shaping; there is no PDF text layer.';

      /* ================= 4) SVG structure + embedded font =================== */
      const flat = renderSVG(plan);
      const layered = buildLayeredSVG(plan);
      const sizeOk = /<svg[^>]*\swidth="1080"\s+height="1350"/.test(flat) || /width="1080"/.test(flat);
      const groups = (layered.match(/<g id="layer-/g) || []).length;
      const headlineText = (plan.elements.find(e => e.role === 'headline') || {}).text || '';
      const hasArabic = headlineText && layered.includes(headlineText.slice(0, 12));
      const hasFallbackStack = flat.includes('font-family="Tahoma');
      out.svg = { sizeOk, groups, manifestLayers: manifestLen(plan), hasArabic, hasFallbackStack, bytes: layered.length };
      if (!sizeOk) fail('SVG intrinsic size wrong');
      if (groups !== plan.elements.length) fail(`SVG groups ${groups} != elements ${plan.elements.length}`);
      if (!hasArabic) fail('SVG does not contain the plan headline text');
      if (!hasFallbackStack) fail('SVG text lost its font stack');

      /* local font (Cairo): MUST be embedded base64 in flat + layered SVG —
         an SVG opened elsewhere otherwise silently falls back */
      const origFont = $('font').value;
      try {
        $('font').value = 'Cairo';
        await ensureLocalFont('Cairo');
        const { plan: cp } = await planFor(1080, 1350);
        const cf = renderSVG(cp), cl = buildLayeredSVG(cp);
        const embed = s => s.includes('@font-face') && s.includes('font/ttf;base64');
        const fam = s => /font-family="[^"]*Cairo/.test(s);
        out.svg.cairo = { flatEmbed: embed(cf), layeredEmbed: embed(cl), flatFamily: fam(cf), layeredFamily: fam(cl), flatBytes: cf.length, layeredBytes: cl.length };
        if (!embed(cf)) fail('flat SVG does not embed the Cairo @font-face base64');
        if (!embed(cl)) fail('layered SVG does not embed the Cairo @font-face base64');
        if (!fam(cf) || !fam(cl)) fail('Cairo plan SVG text does not name the Cairo family');
      } finally { $('font').value = origFont; }
    }
  } finally {
    window.downloadBlob = realDownload;
  }

  function manifestLen(p) { return p.elements.length; }

  out.summary = {
    png: `${out.sizes.filter(r => r.pass).length}/${out.sizes.length} size-scale combos`,
    psd: out.psd ? (out.psd.namesMatch ? 'names+order match manifest' : 'MISMATCH') : 'not run',
    pdf: out.pdf ? `${out.pdf.rows.filter(r => r.pass).length}/${out.pdf.rows.length}` : 'not run',
    svg: out.svg && out.svg.cairo && out.svg.cairo.flatEmbed && out.svg.cairo.layeredEmbed ? 'structure ok + Cairo embedded base64' : 'check'
  };
  out.ok = failures.length === 0;
  return out;
};
