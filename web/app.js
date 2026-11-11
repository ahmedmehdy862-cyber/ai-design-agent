/* =========================================================================
   مِرسم — AI Design Agent (web edition)
   brief -> plan -> render (SVG) -> measure (canvas) -> correct -> finish -> export
   Visual feedback: grid · safe area · ink density heat · focal target · spill
   Zero dependencies, zero server. Arabic-first (RTL).
   ========================================================================= */
'use strict';

/* ---------------- tokens ---------------- */
const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96];
const snap = v => SPACING.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, SPACING[0]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const even = v => Math.round(v / 2) * 2;

/* ---------------- colour ---------------- */
const hex2rgb = h => {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgb2hex = (r, g, b) => '#' + [r, g, b]
  .map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = h => { const [r, g, b] = hex2rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const contrast = (a, b) => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableInk = bg => lum(bg) > 0.18 ? '#111111' : '#FFFFFF';

function hueOf(hex) {
  const [r, g, b] = hex2rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === 0) return null;
  if ((mx - mn) / mx < 0.18) return null;
  let hue;
  if (mx === r) hue = ((g - b) / (mx - mn)) % 6;
  else if (mx === g) hue = (b - r) / (mx - mn) + 2;
  else hue = (r - g) / (mx - mn) + 4;
  return (hue * 60 + 360) % 360;
}

function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
}

function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/* rotate hue + nudge saturation/lightness: keeps a palette coherent */
function shiftHue(hex, deg, ds = 0, dl = 0) {
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  return hsl2hex(h + deg, s + ds, l + dl);
}

/* =========================================================================
   planner (§13) — composition aware, measurable
   ========================================================================= */
function makePlan(b) {
  const W = b.width, H = b.height, short = Math.min(W, H);
  const m = snap(Math.max(24, short * 0.07));
  const comp = b.composition || 'stack';
  const isLight = b.style === 'light';
  const genre = DESIGN_GENRES.find(g => g.id === (b.genre || 'social-post')) || DESIGN_GENRES[0];
  const shapeId = b.shape || 'soft';
  /* global vertical rhythm between text blocks (60%–220% of the design default) */
  const sp = clamp((b.spacing != null ? b.spacing : 100) / 100, 0.6, 2.2);

  /* ---- placed media: image frame + QR (media panel, persisted) ---- */
  const frame = mediaStore.frame ? frameRectFor(mediaStore.frame.slot || 'left-panel', W, H) : null;
  const frameTopBand = frame && frame[1] === 0 && frame[2] === W ? frame[3] : 0;
  const frameBottomBand = frame && frame[1] > 0 && frame[2] === W ? frame[1] : 0;
  const qrSize = mediaStore.qr && mediaStore.qr.text ? snap(Math.max(96, short * 0.15)) : 0;

  /* ---- palette ---- */
  const bg = isLight ? '#F4F1EA' : b.primary;
  const ink = readableInk(bg);
  let accent = b.secondary;
  if (b.harmony === 'complement') accent = shiftHue(b.primary, 180, 0.08, 0.16);
  else if (b.harmony === 'analogous') accent = shiftHue(b.primary, 34, 0.10, 0.22);
  if (contrast(accent, bg) < 1.35) accent = shiftHue(accent, 0, 0.05, lum(accent) > 0.3 ? -0.28 : 0.30);
  const accent2 = shiftHue(accent, 22, 0.04, -0.10);
  const headInk = contrast(ink, bg) >= 4.5 ? ink : accent;
  const ctaInk = contrast('#111111', accent) >= 4.5 ? '#111111' : '#FFFFFF';

  /* ---- type scale (two sizes + label) ---- */
  const kickerPt = even(clamp(short * 0.023, 18, 40));
  const headBase = genre.badge ? 0.11 : genre.wide ? 0.115 : genre.quote ? 0.102
    : comp === 'editorial' ? 0.098 : comp === 'split' ? 0.078 : 0.085;
  const headPt = even(clamp(short * headBase, 40, short * 0.16));
  const subPt = even(headPt * 0.42);
  const ctaPt = even(clamp(subPt * 0.8, 14, 40));
  const weight = b.weight || 700;

  /* ---- shared blocks ---- */
  let textW = comp === 'split' ? W - Math.round(W * 0.34) - m * 2 : W - m * 2;
  /* a frame on the left owns that strip: every text block stops before it */
  if (frame && frame[0] === 0 && frame[2] < W) {
    textW = Math.max(160, (W - m) - (frame[2] + m));
  }
  /* the QR sits bottom-left: list lines shorten so nothing hides under it */
  const itemsW = qrSize ? Math.max(120, textW - qrSize - Math.round(m * 0.4)) : textW;

  let focal, elements = [], headlineY, decorAnchor;

  if (comp === 'split') {
    const panelW = Math.round(W * 0.34);
    focal = { x: Math.round(W * 0.64), y: Math.round(H * 0.38), element: 'headline' };
    headlineY = Math.round(H * 0.34);

    elements.push({
      role: 'accent-panel', kind: 'rect', rect: [0, 0, panelW, H], bleed: true,
      rx: shapeId === 'organic' ? 64 : shapeId === 'soft' ? 18 : 0,
      fill: accent, grad: b.accentMode === 'gradient' ? [accent, accent2] : null
    });
    decorAnchor = { x: panelW / 2, y: H * 0.30, size: short * 0.20, color: readableInk(accent) };
  } else if (comp === 'editorial') {
    focal = { x: Math.round(W * 0.62), y: Math.round(H * 0.58), element: 'headline' };
    headlineY = Math.round(H * 0.60);
    if (b.bleed) {
      const bandH = Math.round(H * 0.055);
      elements.push({ role: 'accent-band', kind: 'rect', rect: [0, H - bandH, W, bandH], fill: accent, bleed: true });
    }
    decorAnchor = { x: m, y: H * 0.68, size: short * 0.24, color: accent };
  } else {
    focal = { x: Math.round(W * 0.60), y: Math.round(H * 0.40), element: 'headline' };
    headlineY = focal.y;
    if (b.bleed) {
      const bandH = Math.round(H * 0.10);
      elements.push({
        role: 'accent-band', kind: 'rect', rect: [0, H - bandH, W, bandH], bleed: true,
        fill: accent, grad: b.accentMode === 'gradient' ? [accent, accent2] : null
      });
    }
    decorAnchor = { x: m, y: H * 0.13, size: short * 0.13, color: accent };
  }

  /* genre-specific vertical rhythm (story keeps text clear of app UI,
     quote sits on the optical centre, wide banners centre on the axis) */
  if (genre.focalRatio) {
    focal = { ...focal, y: Math.round(H * genre.focalRatio) };
    headlineY = Math.round(H * genre.focalRatio);
  }

  /* the frame owns its band: text starts under a top band, and flows up
     from the top margin under a bottom band (nothing prints over the photo) */
  if (frameTopBand) {
    headlineY = Math.max(headlineY, frameTopBand + Math.round(m * 0.5) + Math.round(headPt * 1.1));
    focal = { ...focal, y: headlineY };
  } else if (frameBottomBand) {
    const topClear = (b.kicker && !genre.badge) ? m + Math.round(kickerPt * 1.7)
      : (genre.badge ? m + Math.round(kickerPt * 2.8) : m);
    headlineY = Math.min(headlineY, topClear + Math.round(headPt * 1.15));
    focal = { ...focal, y: headlineY };
  }

  /* ---- decoration (the picture wins: decoration never sits under the frame) ---- */
  /* the anchor itself steps out of the picture first — otherwise a frame that
     owns the anchor zone would delete the whole ornament; the intersection
     filter below stays as the final guarantee */
  if (frame && decorAnchor) {
    const a = decorAnchor;
    const half = a.size * 1.6;                    /* spread of the ornament */
    const cands = [
      { x: frame[0] + frame[2] + half + m, y: a.y },   /* right of the frame */
      { x: frame[0] - half - m, y: a.y },               /* left of it */
      { x: a.x, y: frame[1] + frame[3] + half + m },    /* below it */
      { x: a.x, y: frame[1] - half - m }                /* above it */
    ];
    const inCanvas = p => p.x > 0 && p.x < W && p.y > 0 && p.y < H;
    const freeOf = p => !overlaps([p.x - half, p.y - half, half * 2, half * 2], frame);
    const pick = cands.find(p => inCanvas(p) && freeOf(p)) || cands.find(freeOf);
    if (pick) decorAnchor = Object.assign({}, a, { x: Math.round(pick.x), y: Math.round(pick.y) });
  }
  const deco = decor(b.decor, decorAnchor);
  elements.push(...(frame ? deco.filter(d => {
    const bb = mediaBBox(d);
    return !(bb && overlaps(bb, frame));
  }) : deco));

  /* ---- the image frame itself: behind every word, above the colour panels ---- */
  if (frame) {
    elements.push({
      role: 'image-frame', kind: 'imageFrame', rect: frame,
      src: mediaStore.frame.src, fit: mediaStore.frame.fit || 'cover',
      radius: mediaStore.frame.radius || 0,
      fill: '#0B1218', opacity: 1, bleed: true
    });
  }

  /* ---- kicker + rule (topY follows a top-band frame) ---- */
  const right = W - m;
  const topY = frameTopBand ? frameTopBand + Math.round(m * 0.5) : m;
  if (b.kicker && !genre.badge) {
    elements.push({
      role: 'kicker', kind: 'type', x: right, y: topY + kickerPt, text: b.kicker,
      align: 'right', font: b.font, size: kickerPt, color: accent,
      weight: 700, leading: Math.round(kickerPt * 1.4), maxW: textW
    });
    elements.push({
      role: 'kicker-rule', kind: 'line',
      x1: right - Math.round(W * 0.12), y1: topY + kickerPt + Math.round(kickerPt * 0.7),
      x2: right, y2: topY + kickerPt + Math.round(kickerPt * 0.7),
      stroke: accent, width: Math.max(2, Math.round(short * 0.004))
    });
  }

  /* ---- headline ---- */
  const headMaxW = textW;
  const headLines = wrapLines(b.headline, headMaxW, b.font, headPt, weight).length;
  const headLeading = Math.round(headPt * 1.34);
  elements.push({
    role: 'headline', kind: 'type', x: right, y: headlineY, text: b.headline,
    align: 'right', font: b.font, size: headPt, color: headInk, weight,
    leading: headLeading, maxW: headMaxW,
    shadow: b.style === 'bold' ? 'rgba(0,0,0,.28)' : null
  });

  /* ---- subhead ---- */
  const subY = headlineY + (headLines - 1) * headLeading + Math.round(headPt * 0.62 * sp);
  if (b.subhead) {
    elements.push({
      role: 'subhead', kind: 'type', x: right, y: subY, text: b.subhead,
      align: 'right', font: b.font, size: subPt,
      color: contrast(ink, bg) >= 4.5 ? ink : readableInk(bg), weight: 400,
      opacity: 0.78, leading: Math.round(subPt * 1.55), maxW: headMaxW
    });
  }

  /* ---- CTA ---- */
  let chipY = null, chipRect = null;             /* also read by the list clip below */
  if (b.cta) {
    const chipH = Math.round(ctaPt * 2.6);
    const chipW = Math.round(Math.min(W * 0.40, textW));
    chipY = (frameBottomBand ? frameBottomBand - m : H - m) - chipH;
    elements.push({
      role: 'cta-chip', kind: 'roundedRect', rect: [right - chipW, chipY, chipW, chipH],
      radii: shapeRadius(shapeId, chipH), fill: accent, bleed: false,
      grad: b.accentMode === 'gradient' ? [accent, accent2] : null
    });
    chipRect = [right - chipW, chipY, chipW, chipH];
    elements.push({
      role: 'cta-text', kind: 'type', x: right - chipW / 2,
      y: chipY + chipH / 2 + ctaPt * 0.35, text: b.cta, align: 'center',
      font: b.font, size: ctaPt, color: ctaInk, weight: 700,
      leading: Math.round(ctaPt * 1.3), maxW: Math.round(chipW * 0.86)
    });
  }

  /* ---- genre extras: quote marks · date · list items · badge · trim frame ---- */
  const subLines = b.subhead ? wrapLines(b.subhead, textW, b.font, subPt, 400).length : 0;
  let cursor = subY + (subLines
    ? (subLines - 1) * Math.round(subPt * 1.55) + Math.round(subPt * 1.6 * sp)
    : Math.round(headPt * 0.85 * sp));

  if (genre.quote) {
    elements.push({
      role: 'quote-mark', kind: 'type', x: right, y: Math.round(headlineY - headPt * 0.60),
      text: '«', align: 'right', font: b.font, size: Math.round(headPt * 2.1),
      color: accent, weight: 700, leading: 1, opacity: 0.20, maxW: textW
    });
  }

  let datePt = 0;
  if (b.date) {
    datePt = even(clamp(subPt * 1.05, 16, 44));
    elements.push({
      role: 'date', kind: 'type', x: right, y: cursor, text: b.date,
      align: 'right', font: b.font, size: datePt, color: accent, weight: 700,
      leading: Math.round(datePt * 1.4), maxW: textW
    });
    cursor += Math.round(datePt * 1.9 * sp);
  }

  let itemLead = 0, itemSize = 0, itemsShown = 0;
  if (b.items && b.items.length) {
    const itemPt = even(clamp(subPt * 0.95, 15, 36));
    itemSize = itemPt;
    itemLead = Math.round(itemPt * 1.95 * sp);
    /* the list honors every floor above it: photo band · CTA chip · canvas margin */
    let itemLimit = H - m;
    if (frameBottomBand) itemLimit = Math.min(itemLimit, frameBottomBand - m);
    if (chipY != null) itemLimit = Math.min(itemLimit, chipY - Math.round(m * 0.4));
    for (const it of b.items.slice(0, 5)) {
      const txt = '•  ' + it;
      /* a wrapped item owns its rows — otherwise line 2 lands on the next item */
      const blockH = wrapLines(txt, itemsW, b.font, itemPt, 400).length * itemLead;
      if (cursor + blockH > itemLimit) break;      /* no room: stop, never print over */
      elements.push({
        role: 'item', kind: 'type', x: right, y: cursor, text: txt,
        align: 'right', font: b.font, size: itemPt,
        color: contrast(ink, bg) >= 4.5 ? ink : readableInk(bg), weight: 400,
        opacity: 0.92, leading: itemLead, maxW: itemsW
      });
      cursor += blockH;
      itemsShown++;
    }
  }

  if (genre.badge) {
    const bw = snap(kickerPt * 7), bh = snap(kickerPt * 2.8);
    elements.push({
      role: 'badge', kind: 'roundedRect', rect: [W - m - bw, m, bw, bh],
      radii: shapeRadius(shapeId, bh), fill: accent,
      grad: b.accentMode === 'gradient' ? [accent, accent2] : null
    });
    elements.push({
      role: 'badge-text', kind: 'type', x: W - m - bw / 2, y: m + bh / 2 + kickerPt * 0.35,
      text: b.kicker || genre.name, align: 'center', font: b.font, size: kickerPt,
      color: readableInk(accent), weight: 700,
      leading: Math.round(kickerPt * 1.3), maxW: Math.round(bw * 0.86)
    });
  }

  if (genre.print) {
    elements.push({
      role: 'trim-frame', kind: 'outline',
      rect: [Math.round(m * 0.5), Math.round(m * 0.5), W - m, H - m],
      stroke: ink, opacity: 0.35, width: Math.max(2, Math.round(short * 0.003))
    });
  }

  const typeScale = [['kicker', b.kicker ? kickerPt : 0], ['headline', headPt], ['subhead', subPt],
  ['date', datePt], ['item', itemSize], ['cta', b.cta ? ctaPt : 0]]
    .filter(x => x[1]);

  /* ---- QR code: always bottom-left (never under the CTA/badge), on top ---- */
  if (qrSize) {
    elements.push({
      role: 'qr', kind: 'qr', rect: [m, H - m - qrSize, qrSize, qrSize],
      data: mediaStore.qr.text, fill: '#111111', bg: '#FFFFFF', bleed: false
    });
  }

  /* ---- decorative icon (tabler, vendored locally) — never lands on a
     photo, a code, the CTA or any word: it slides to a free slot ---- */
  if (mediaStore.icon && typeof TABLER_ICONS !== 'undefined' && TABLER_ICONS[mediaStore.icon.name]) {
    const avoid = [frame, qrSize ? [m, H - m - qrSize, qrSize, qrSize] : null, chipRect]
      .concat(elements.filter(e => e.kind === 'type').map(e => boxWH(typeBBox(e))))
      .concat(elements.filter(e => e.rect && e.kind !== 'type').map(e => e.rect));
    const place = iconRectFor(mediaStore.icon.slot || 'top-right', W, H, short, m, avoid);
    if (place) {
      elements.push({
        role: 'icon', kind: 'icon', rect: place.rect, name: mediaStore.icon.name,
        fill: mediaStore.icon.color || accent, bleed: false, slot: place.slot
      });
    }
  }

  /* stable element keys (role or role#index) → the inspector's address book,
     then re-apply every user edit on top of the freshly computed plan */
  const keyCount = {};
  elements.forEach(el => {
    const n = keyCount[el.role] || 0;
    keyCount[el.role] = n + 1;
    el.key = n ? `${el.role}#${n}` : el.role;
  });
  applyOverrides(elements);

  return {
    brief: { headline: b.headline, subhead: b.subhead, cta: b.cta, kicker: b.kicker || '', style: b.style },
    canvas: [W, H],
    palette: { bg, ink, accent, accent2, surface: isLight ? '#FFFFFF' : '#101720', headline: headInk },
    meta: {
      composition: comp, decor: b.decor || 'none', accentMode: b.accentMode || 'solid',
      weight, harmony: b.harmony || 'manual', grain: !!b.grain, bleed: !!b.bleed,
      genre: genre.id, genreName: genre.name, shape: shapeId,
      date: b.date || '', items: (b.items || []).length,
      itemsShown, frame: frame ? (mediaStore.frame.slot || 'left-panel') : '', qr: qrSize || 0,
      font: b.font, spacing: Math.round(sp * 100),
      edited: Object.keys(overrides).length
    },
    composition: `${comp} · RTL · rule of thirds`,
    grid: { margin: m, baseline: 12, columns: 12 },
    focal,
    typeScale,
    elements,
    rationale: [
      `نوع التصميم «${genre.name}» — ${genre.note}`,
      `شكل العناصر «${(DESIGN_SHAPES.find(s => s.id === shapeId) || {}).name || shapeId}»`,
      `هامش ${m}px على الأساس ${short}px (٧٪ مقرّبة لسلّم المسافات)`,
      `المسافة بين كتل النص ${arNumLocal(Math.round(sp * 100))}٪ من الافتراضي · الخط ${b.font}`,
      `تعديلات العناصر المُطبَّقة: ${arNumLocal(Object.keys(overrides).length)} (تبقى بعد إعادة التوليد)`,
      `مقياس خطوط: عنوان ${headPt} / ثانوي ${subPt} / زر ${ctaPt} — ${typeScale.length} أحجام فقط`,
      `تباين العنوان ${contrast(headInk, bg).toFixed(2)}:1 مقابل ${bg}`,
      `تكوين «${comp}» — نقطة تركيز عند ${Math.round(focal.y / H * 100)}٪ من الارتفاع`,
      b.harmony === 'manual' ? 'باليتة يدوية: مهيمن + ثانوي + لمسة (٦٠-٣٠-١٠)' : `اشتقاق ${b.harmony}: اللمسة مشتقّة من المهيمن بتباعد ${b.harmony === 'complement' ? 180 : 34}°`,
      b.grain ? 'طبقة تشطيب: حبيبات ٣٪ بعد القياس (لا تغيّر القرار)' : 'بدون طبقة تشطيب — SVG نظيف',
      ...(frame ? [`إطار صورة: ${FRAME_SLOTS[mediaStore.frame.slot || 'left-panel']} — الصورة تُقصّ داخله وهي طبقة full-bleed، والزخرفة تنحني عنده`] : []),
      ...(qrSize ? [`رمز QR بحجم ${arNumLocal(qrSize)}px أسفل اليسار مع منطقة هدوء بيضاء داخل الصندوق`] : []),
      ...(itemsShown < (b.items || []).length
        ? [`المساحة السفلية تقتطع القائمة: عُرض ${arNumLocal(itemsShown)} من ${arNumLocal(b.items.length)} بنودًا — كبّر المساحة أو قلّل البنود أو غيّر موضع الإطار/الزر`]
        : [])
    ]
  };
}

/* =========================================================================
   element overrides — per-element designer edits
   key: el.key  ·  value: { color, opacity, sizeF, weight, align, hidden,
                            dx, dy, sw, sh, locked }
   plus overrides.__order — the designer's z-stack (a full key permutation).
   Applied on every plan build, so edits survive regeneration and QA fixes.
   Every field is absolute over the planned base, so the second apply pass
   inside runLoop (after a QA fix) changes nothing the first one didn't.
   ========================================================================= */
function applyOverrides(list) {
  for (const el of list) {
    if (!el.base) {
      el.base = {
        size: el.size || 0,
        leading: el.leading || 0,
        weight: el.weight || 0,
        opacity: el.opacity != null ? el.opacity : null,
        /* P7: the planned anchor, captured before any edit — position and
           size offsets are computed from it (idempotent by construction) */
        pos: el.kind === 'type' ? [el.x, el.y]
          : el.rect ? el.rect.slice()
          : el.kind === 'ring' ? [el.cx, el.cy]
          : el.kind === 'line' ? [el.x1, el.y1, el.x2, el.y2] : null
      };
    }
    const o = overrides[el.key];
    if (!o) continue;

    if (o.hidden) el.hidden = true;

    if (o.color) {
      if (el.kind === 'type') el.color = o.color;
      else if (el.kind === 'line' || el.kind === 'ring' || el.kind === 'outline') el.stroke = o.color;
      else { el.fill = o.color; el.grad = null; }
    }
    if (o.opacity != null && o.opacity !== 1) el.opacity = o.opacity;

    if (el.kind === 'type') {
      if (o.sizeF && el.base.size) {
        el.size = Math.max(9, Math.round(el.base.size * o.sizeF));
        if (el.base.leading) el.leading = Math.round(el.size * el.base.leading / el.base.size);
      }
      if (o.weight) el.weight = o.weight;
      if (o.align) el.align = o.align;
    }

    /* P7: موضع — a relative offset from the planned anchor, so the designer's
       placement beats an automatic move the same way sizeF beats a shrink */
    if ((o.dx || o.dy) && el.base.pos) {
      const dx = o.dx || 0, dy = o.dy || 0, p = el.base.pos;
      if (el.kind === 'type') { el.x = p[0] + dx; el.y = p[1] + dy; }
      else if (el.rect) el.rect = [p[0] + dx, p[1] + dy, el.rect[2], el.rect[3]];
      else if (el.kind === 'ring') { el.cx = p[0] + dx; el.cy = p[1] + dy; }
      else if (el.kind === 'line') { el.x1 = p[0] + dx; el.y1 = p[1] + dy; el.x2 = p[2] + dx; el.y2 = p[3] + dy; }
    }
    /* P7: أبعاد — scale factors of the planned box (never multiplied into a
       previously scaled value: always re-derived from base) */
    if (el.rect && el.base.pos && ((o.sw && o.sw !== 1) || (o.sh && o.sh !== 1))) {
      const sw = o.sw || 1, sh = o.sh || 1;
      el.rect = [el.rect[0], el.rect[1],
        Math.max(8, Math.round(el.base.pos[2] * sw)),
        Math.max(8, Math.round(el.base.pos[3] * sh))];
    }
  }

  /* P7: ترتيب الطبقات — the designer's z-stack, painted in array order.
     A stale order (layers that no longer exist) simply skips those keys;
     a brand-new layer takes its natural slot and keeps the plan's position
     relative to the rest of the stack. */
  const ord = overrides.__order;
  if (Array.isArray(ord) && ord.length) {
    const rank = new Map(ord.map((k, i) => [k, i]));
    const nat = new Map(list.map((e, i) => [e.key, i]));
    const score = e => (rank.has(e.key) ? rank.get(e.key) : (nat.get(e.key) || 0));
    const arr = list.map((e, i) => ({ s: score(e), i, e })).sort((a, b) => (a.s - b.s) || (a.i - b.i));
    list.length = 0;
    for (const t of arr) list.push(t.e);
  }
}

/* decorative geometry: still measurable (counts as ink, respects margins) */
function decor(kind, a) {
  const s = a.size, out = [];
  if (!kind || kind === 'none') return out;
  if (kind === 'circle') {
    out.push({ role: 'focal-deco', kind: 'ellipse', rect: [a.x, a.y, s, s], fill: a.color, opacity: 0.92 });
  } else if (kind === 'arcs') {
    const c = s / 2;
    out.push({ role: 'focal-deco', kind: 'ring', cx: a.x + c, cy: a.y + c, r: c, stroke: a.color, strokeWidth: Math.max(3, s * 0.045), opacity: 0.9 });
    out.push({ role: 'focal-deco', kind: 'ring', cx: a.x + c, cy: a.y + c, r: c * 0.62, stroke: a.color, strokeWidth: Math.max(2, s * 0.02), opacity: 0.55 });
  } else if (kind === 'dots') {
    const gap = s / 3.2, r = Math.max(2.5, s * 0.032);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        out.push({
          role: 'focal-deco', kind: 'ellipse',
          rect: [a.x + col * gap, a.y + row * gap, r * 2, r * 2],
          fill: a.color, opacity: row === 1 && col === 1 ? 0.92 : 0.5
        });
      }
    }
  } else if (kind === 'rule') {
    out.push({
      role: 'focal-deco', kind: 'line',
      x1: a.x, y1: a.y, x2: a.x + s * 1.5, y2: a.y,
      stroke: a.color, width: Math.max(2, Math.round(s * 0.028))
    });
  }
  return out;
}

/* ---------------- text wrap — one measurement stack: the box model, the
   renderer and the export all measure with the same family chain, so what
   the diagnosis predicts is exactly what the SVG draws ---------------- */
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
const FONT_STACK = `'Segoe UI', Tahoma, Arial, sans-serif`;
const fontStackFor = f => `${f}, ${FONT_STACK}`;
/* Arabic diacritics (harakat) ride on their base letter — never cut before one */
const MARK = /[\u064B-\u0652\u0670\u0653-\u0656]/;

function wrapLines(text, maxW, font, size, weight) {
  if (!text) return [];
  measureCtx.font = `${weight} ${size}px ${fontStackFor(font)}`;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const fits = t => measureCtx.measureText(t).width <= maxW;
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (fits(test)) { cur = test; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    /* one word wider than its box (Latin URLs · tight Arabic compounds):
       hard-break by characters — a single word never spills past the measure */
    let chunk = '';
    for (const ch of w) {
      if (chunk && !MARK.test(ch) && measureCtx.measureText(chunk + ch).width > maxW) {
        lines.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    if (chunk) lines.push(chunk);
  }
  return lines.length ? lines : [String(text)];
}

/* ---------------- renderer (SVG) ---------------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderSVG(plan, opts = {}) {
  const [W, H] = plan.canvas, p = plan.palette;
  const margin = plan.grid.margin;
  let defs = '', body = '';
  const usedFonts = new Set();   /* local fonts to embed (SVG images load no page fonts) */
  if (!opts.transparent) body += `<rect width="${W}" height="${H}" fill="${p.bg}"/>`;

  plan.elements.forEach((el, i) => {
    if (opts.only != null && i !== opts.only) return;   // single-layer export
    if (opts.skipBleed && el.bleed) return;   // measure the content layer only
    if (el.hidden) return;                    // hidden by the layer inspector
    let fill = el.fill, stroke = el.stroke;
    if (el.grad) {
      const gid = 'g' + i;
      defs += `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">`
        + `<stop offset="0" stop-color="${el.grad[0]}"/><stop offset="1" stop-color="${el.grad[1]}"/>`
        + `</linearGradient>`;
      fill = `url(#${gid})`;
    }
    const op = el.opacity != null ? ` opacity="${el.opacity}"` : '';

    if (el.kind === 'rect') {
      const [x, y, w, h] = el.rect;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${el.rx || 0}" fill="${fill}"${op}/>`;
    } else if (el.kind === 'outline') {
      const [x, y, w, h] = el.rect;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${el.stroke}" stroke-width="${el.width}"${op}/>`;
    } else if (el.kind === 'roundedRect') {
      const [x, y, w, h] = el.rect;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${el.radii || 0}" fill="${fill}"${op}/>`;
    } else if (el.kind === 'ellipse') {
      const [x, y, w, h] = el.rect;
      body += `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${op}/>`;
    } else if (el.kind === 'ring') {
      body += `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="none" stroke="${stroke}" stroke-width="${el.strokeWidth}"${op}/>`;
    } else if (el.kind === 'line') {
      body += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${stroke}"`
        + ` stroke-width="${el.width}" stroke-linecap="round"${op}/>`;
    } else if (el.kind === 'imageFrame') {
      /* a frame the designer drops a photo into: clip + fitted <image>.
         The data URL is inline, so the SVG stays a single self-contained
         file and still rasterises for PNG/PDF/PSD export. */
      const [x, y, w, h] = el.rect;
      const cid = 'frameClip' + i;
      const rx = el.radius || 0;
      defs += `<clipPath id="${cid}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>`;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${op}/>`;
      if (el.src) {
        const par = el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
        const src = esc(el.src);
        body += `<image href="${src}" xlink:href="${src}" x="${x}" y="${y}" width="${w}" height="${h}"`
          + ` preserveAspectRatio="${par}" clip-path="url(#${cid})"${op}/>`;
      }
      if (el.stroke) {
        body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none"`
          + ` stroke="${el.stroke}" stroke-width="${Math.max(2, Math.round(Math.min(w, h) * 0.012))}"${op}/>`;
      }
    } else if (el.kind === 'qr') {
      /* QR built from real modules: crisp at any scale, no image dependency */
      const [x, y, w, h] = el.rect;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.bg || '#FFFFFF'}"${op}/>`;
      let q = null;
      try { q = qrMatrix(el.data || ''); } catch { q = null; }
      if (q) {
        const n = q.getModuleCount();
        const quiet = Math.round(w * 0.06);        /* quiet zone (scanners need it) */
        const cell = (w - quiet * 2) / n;
        let d = '';
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (!q.isDark(r, c)) continue;
            const cx = (x + quiet + c * cell).toFixed(2);
            const cy = (y + quiet + r * cell).toFixed(2);
            d += `M${cx} ${cy}h${cell.toFixed(2)}v${cell.toFixed(2)}h${(-cell).toFixed(2)}z`;
          }
        }
        body += `<path d="${d}" fill="${fill || el.fill || '#111111'}"${op}/>`;
      }
    } else if (el.kind === 'type') {
      const maxW = el.maxW || (W - margin * 2);
      const lines = wrapLines(el.text, maxW, el.font, el.size, el.weight);
      if (typeof fontFaceStyleFor === 'function') usedFonts.add(el.font);
      const dir = el.align === 'center' ? 'auto' : 'rtl';
      /* RTL note: with direction="rtl" the logical start is the RIGHT edge,
         so an Arabic right-aligned line needs text-anchor="start" — "end"
         would push it out of the canvas. */
      const anchor = el.align === 'center' ? 'middle'
        : (dir === 'rtl' ? (el.align === 'right' ? 'start' : 'end')
                         : (el.align === 'right' ? 'end' : 'start'));
      const shadow = el.shadow
        ? ` filter="url(#inkShadow)"` : '';
      if (el.shadow && !defs.includes('inkShadow')) {
        defs += `<filter id="inkShadow" x="-10%" y="-10%" width="120%" height="130%">`
          + `<feDropShadow dx="0" dy="${Math.round(el.size * 0.02)}" stdDeviation="${Math.round(el.size * 0.03)}" flood-color="${el.shadow}"/>`
          + `</filter>`;
      }
      body += `<text x="${el.x}" y="${el.y}" text-anchor="${anchor}" direction="${dir}"${shadow}`
        + ` font-family="${esc(fontStackFor(el.font))}"`
        + ` font-size="${el.size}" font-weight="${el.weight}" fill="${el.color}"${op}>`;
      lines.forEach((ln, k) => {
        body += `<tspan x="${el.x}" dy="${k === 0 ? 0 : el.leading}">${esc(ln)}</tspan>`;
      });
      body += '</text>';
    } else if (el.kind === 'icon') {
      /* tabler glyph (vendored): 24×24 grid scaled into the slot, with the
         design's colour swapped in for currentColor so it prints anywhere */
      const raw = (typeof TABLER_ICONS !== 'undefined') ? TABLER_ICONS[el.name] : null;
      if (raw) {
        const [x, y, w, h] = el.rect;
        const k = w / 24;
        const col = fill || el.fill || '#000000';
        const glyph = String(raw.body).replace(/currentColor/g, col);
        body += `<g transform="translate(${x},${y}) scale(${k})"${op}>${glyph}</g>`;
        void h;
      }
    }
  });

  /* embed local fonts: an <img>-rendered SVG never loads the page's fonts */
  let fontCSS = '';
  if (typeof fontFaceStyleFor === 'function') {
    for (const f of usedFonts) fontCSS += fontFaceStyleFor(f);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
    + ` width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + (fontCSS ? `<style>${fontCSS}</style>` : '')
    + (defs ? `<defs>${defs}</defs>` : '') + body + '</svg>';
}

/* ---------------- SVG -> canvas ---------------- */
function svgToCanvas(svg, W, H) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('render failed')); };
    img.src = url;
  });
}

/* ---------------- finish layer (post-measurement texture) ---------------- */
function finish(canvas, plan) {
  if (!plan.meta.grain) return canvas;
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let seed = 20261102;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = (seed / 4294967296 - 0.5) * 9;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------------- QA — pixel metrics + visual feedback data ---------------- */
/* share of the finished surface that is not the modal (background) colour:
   full-bleed panels count here, while the content ink metric excludes them */
function coverageOf(canvas) {
  const S = 64;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const counts = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const modal = Math.max(...counts.values());
  return +(1 - modal / (S * S)).toFixed(4);
}

/* Arabic names for geometry diagnoses — the UI never shows raw role ids */
const TYPE_ROLE_AR = {
  kicker: 'سطر التمهيد', headline: 'العنوان', subhead: 'العنوان الفرعي',
  'cta-text': 'نص الزر', 'badge-text': 'نص الشارة', date: 'التاريخ',
  item: 'بند القائمة', 'quote-mark': 'علامة الاقتباس'
};

function analyze(canvas, plan, opts = {}) {
  const W = canvas.width, H = canvas.height;

  /* palette + blankness on a 96² sample */
  const S = 96;
  const s1 = document.createElement('canvas'); s1.width = S; s1.height = S;
  const c1 = s1.getContext('2d', { willReadFrequently: true });
  c1.imageSmoothingEnabled = true; c1.imageSmoothingQuality = 'high';
  c1.drawImage(canvas, 0, 0, S, S);
  const d1 = c1.getImageData(0, 0, S, S).data;

  const exact = new Set();
  const buckets = new Map();
  for (let i = 0; i < d1.length; i += 4) {
    const r = d1[i], g = d1[i + 1], b = d1[i + 2];
    exact.add((r << 16) | (g << 8) | b);
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const blankness = exact.size;
  const total = S * S;
  const entries = [...buckets.entries()].map(([k, c]) => {
    const r = ((k >> 10) & 31) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3;
    return { hex: rgb2hex(r, g, b), cnt: c };
  }).sort((a, b) => b.cnt - a.cnt);
  const palette = entries.slice(0, 6).map(e => ({ hex: e.hex, share: e.cnt / total }));
  const bg = palette[0] ? palette[0].hex : '#FFFFFF';

  /* ink metrics + heat grid + spill points on a 128-wide sample */
  const sw = 128, sh = Math.max(1, Math.round(H * sw / W));
  const s2 = document.createElement('canvas'); s2.width = sw; s2.height = sh;
  const c2 = s2.getContext('2d', { willReadFrequently: true });
  c2.drawImage(canvas, 0, 0, sw, sh);
  const d2 = c2.getImageData(0, 0, sw, sh).data;
  const [br, bgc, bb] = hex2rgb(bg);
  const mEdge = Math.max(1, Math.round(Math.min(sw, sh) * 0.04));

  const GRID = 16;
  const heat = new Array(GRID * GRID).fill(0);
  const inkPx = [];
  const spill = [];
  let ink = 0, sx = 0, sy = 0, edge = 0, rightMass = 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const r = d2[i], g = d2[i + 1], b = d2[i + 2];
      const diff = Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb);
      if (diff > 60) {
        ink++; sx += x; sy += y;
        if (x >= sw / 2) rightMass++;
        heat[Math.min(GRID - 1, Math.floor(y / sh * GRID)) * GRID + Math.min(GRID - 1, Math.floor(x / sw * GRID))]++;
        inkPx.push([0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), (r << 16) | (g << 8) | b]);
        if (x < mEdge || y < mEdge || x >= sw - mEdge || y >= sh - mEdge) {
          edge++;
          if (spill.length < 400 && edge % 3 === 0) spill.push([+(x / sw).toFixed(4), +(y / sh).toFixed(4)]);
        }
      }
    }
  }
  const inkRatio = ink / (sw * sh);
  const com = ink ? [sx / ink / sw, sy / ink / sh] : [0, 0];
  const rightShare = ink ? rightMass / ink : 0.5;

  /* normalized heat 0..1 */
  const heatMax = heat.reduce((a, b) => Math.max(a, b), 0) || 1;
  const heatN = heat.map(v => +(v / heatMax).toFixed(3));

  /* text contrast: extreme ink-luminance percentiles (thin Arabic strokes
     never reach a measurable histogram share, so measure real ink pixels) */
  let inkHex = null, maxContrast = 0;
  if (inkPx.length) {
    inkPx.sort((a, b) => a[0] - b[0]);
    const pick = q => inkPx[Math.min(inkPx.length - 1, Math.round(q * (inkPx.length - 1)))];
    for (const q of [0.02, 0.98]) {
      const packed = pick(q)[1];
      const hex = rgb2hex((packed >> 16) & 255, (packed >> 8) & 255, packed & 255);
      const c = contrast(bg, hex);
      if (c > maxContrast) { maxContrast = c; inkHex = hex; }
    }
    maxContrast = +maxContrast.toFixed(2);
  }

  /* colour families: significant colours (>=1%), 45° buckets merged circularly */
  const hueBuckets = new Set();
  for (const e of entries) {
    if (e.cnt / total < 0.01) continue;
    const h = hueOf(e.hex);
    if (h !== null) hueBuckets.add(Math.floor(h / 45) % 8);
  }
  let hueCount = hueBuckets.size;
  if (hueCount > 1) {
    const arr = [...hueBuckets].sort((a, b) => a - b);
    let merged = 1;
    for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] > 1) merged++;
    if (arr[0] + 8 - arr[arr.length - 1] <= 1) merged--;
    hueCount = merged;
  }

  /* hierarchy from the plan (typographic, not pixel-based) */
  const head = plan && plan.elements.find(e => e.role === 'headline');
  const sub = plan && plan.elements.find(e => e.role === 'subhead');
  const hierarchy = head && sub ? +(head.size / sub.size).toFixed(2) : 0;

  /* focal distance (normalized by canvas) */
  let focalDist = null;
  if (plan && plan.focal) {
    const dx = com[0] - plan.focal.x / W, dy = com[1] - plan.focal.y / H;
    focalDist = +Math.hypot(dx, dy).toFixed(3);
  }

  /* ---- issues ---- */
  const coverage = opts.coverage != null ? opts.coverage : inkRatio;
  const issues = [];
  if (blankness < 8) issues.push({ id: 'blank', severity: 'FAIL', message: `${blankness} لونًا فقط — المخرج يبدو فارغًا`, hint: 'تأكد من ظهور الطبقات ثم أعد التصدير' });
  if (coverage > 0.78) issues.push({ id: 'clutter', severity: 'FAIL', message: `تغطية السطح ${(coverage * 100).toFixed(0)}% (>78%)`, hint: 'قلّل العناصر أو كبّر المساحة السالبة' });
  else if (coverage > 0.65) issues.push({ id: 'clutter', severity: 'WARN', message: `تغطية السطح ${(coverage * 100).toFixed(0)}% (>65%)`, hint: 'زد المساحة السالبة' });
  if (edge > 0) {
    const intentional = plan && plan.elements.some(e => e.bleed);
    issues.push({
      id: 'edge-spill', severity: intentional ? 'NOTE' : 'WARN',
      message: intentional
        ? `${edge} بكسل داخل الهامش — التلامس مصدره اللوح/الشريط المتعمّد`
        : `${edge} بكسل حبر داخل الهامش الخارجي 4%`,
      hint: intentional
        ? 'مقصود: full-bleed يلامس الحافة. عطّل الخيار لقياس نسخة آمنة تمامًا'
        : 'اسحب العناصر إلى المنطقة الآمنة (الهامش ≈ ٦٪ من الضلع الأقصر)'
    });
  }
  if (inkHex && maxContrast < 4.5) issues.push({ id: 'low-contrast', severity: 'WARN', message: `تباين ${bg} مع ${inkHex} = ${maxContrast}:1 (<4.5)`, hint: 'غامق النص أو فاتح سطحه — WCAG AA' });
  if (palette.length >= 2 && palette[0].share / Math.max(palette[1].share, 1e-6) < 1.15)
    issues.push({ id: 'focal-ambiguity', severity: 'WARN', message: `لونان متقاربان في الحصة (${(palette[0].share * 100).toFixed(0)}% مقابل ${(palette[1].share * 100).toFixed(0)}%)`, hint: 'اجعل لونًا واحدًا مهيمنًا (~60%)' });
  if (hueCount > 3) issues.push({ id: 'palette-creep', severity: 'WARN', message: `${hueCount} عائلات لونية (>3)`, hint: 'قلّل إلى مهيمن + ثانوي + لمسة' });
  if (hierarchy && hierarchy < 1.6) issues.push({ id: 'weak-hierarchy', severity: 'WARN', message: `التسلسل ${hierarchy}× فقط (<1.6) — العنوان لا يقود العين`, hint: 'كبّر العنوان أو صغّر النص الثانوي' });
  const splitByDesign = plan && plan.meta && plan.meta.composition === 'split';
  if (!splitByDesign && (rightShare > 0.82 || rightShare < 0.14))
    issues.push({ id: 'unbalanced', severity: 'NOTE', message: `كتلة الحبر ${(rightShare * 100).toFixed(0)}% على اليمين — التكوين منحاز`, hint: 'وازن بزخرفة أو كتلة لونية في الجهة المقابلة' });
  if (focalDist != null && focalDist > 0.22 && !(plan.elements.some(e => e.bleed)))
    issues.push({ id: 'off-focal', severity: 'NOTE', message: `مركز الثقل بعيد ${(focalDist * 100).toFixed(0)}% عن نقطة التركيز`, hint: 'حرّك العنوان أو الزخرفة نحو ثلث الإطار' });

  /* ---- P5: Arabic typography — geometric overflow + word collisions ----
     the pixel checks answer "ink sits near the edge"; these answer WHICH
     block left its box, and which words print on top of which words. */
  if (plan && Array.isArray(plan.elements)) {
    const mG = plan.grid && plan.grid.margin ? plan.grid.margin : Math.round(Math.min(W, H) * 0.07);
    const solid = el => el.opacity == null || el.opacity >= 0.6;  /* watermarks stay decorative */
    const nameOf = el => TYPE_ROLE_AR[el.role] || el.role;
    const types = plan.elements.filter(el => el && el.kind === 'type' && !el.hidden && solid(el));

    /* overflow: the box leaves the canvas (FAIL) or the safe area (WARN) */
    for (const el of types) {
      const b = typeBBox(el);
      const offCanvas = Math.max(-b[0], -b[1], b[2] - W, b[3] - H);
      const offSafe = Math.max(mG - b[0], mG - b[1], b[2] - (W - mG), b[3] - (H - mG));
      if (offCanvas > 2) {
        issues.push({
          id: 'text-overflow', severity: 'FAIL', i: plan.elements.indexOf(el),
          message: `«${nameOf(el)}» يتجاوز حدود القماش ${Math.round(offCanvas)} بكسل`,
          hint: 'كتلة نص خارج الإطار فعلًا — صغّر حجمها أو اسحب موضعها للداخل'
        });
      } else if (offSafe > 2) {
        issues.push({
          id: 'text-overflow', severity: 'WARN', i: plan.elements.indexOf(el),
          message: `«${nameOf(el)}» يدخل منطقة الأمان ${Math.round(offSafe)} بكسل`,
          hint: 'اقترب من حافة القص — قلّل الحجم أو تباعد الأسطر'
        });
      }
    }

    /* collisions: content words vs content words · vs the QR · vs the icon.
       Both boxes inset 10% so a hairline graze (tight spacing at 60%)
       is never reported as a collision, and only a real stack counts. */
    const boxOf = el => {
      if (el.kind === 'type') return typeBBox(el);
      if (el.rect) return [el.rect[0], el.rect[1], el.rect[0] + el.rect[2], el.rect[1] + el.rect[3]];
      return null;
    };
    const tight = b => {
      const dx = (b[2] - b[0]) * 0.10, dy = (b[3] - b[1]) * 0.10;
      return [b[0] + dx, b[1] + dy, b[2] - dx, b[3] - dy];
    };
    const targets = plan.elements.filter(el => el && !el.hidden && (
      (el.kind === 'type' && solid(el)) || el.kind === 'qr' || el.kind === 'icon'));
    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const A = targets[i], B = targets[j];
        const bA = boxOf(A), bB = boxOf(B);
        if (!bA || !bB) continue;
        const a = tight(bA), c = tight(bB);
        const ix = Math.min(a[2], c[2]) - Math.max(a[0], c[0]);
        const iy = Math.min(a[3], c[3]) - Math.max(a[1], c[1]);
        if (ix <= 2 || iy <= 2) continue;
        const area = ix * iy;
        const smaller = Math.min((a[2] - a[0]) * (a[3] - a[1]), (c[2] - c[0]) * (c[3] - c[1]));
        if (!smaller || area < 0.25 * smaller || area < 600) continue;
        const upper = bA[1] <= bB[1] ? A : B;
        const lower = upper === A ? B : A;
        issues.push({
          id: 'layer-overlap', severity: 'WARN',
          a: plan.elements.indexOf(upper), b: plan.elements.indexOf(lower),
          message: `تداخل ${Math.round(area)} بكسل² — «${nameOf(lower)}» يُطبع فوق «${nameOf(upper)}»`,
          hint: 'الكلمات لا تُطبَق على كلمات — حرّك المكوّن الأقل أو صغّره'
        });
      }
    }
  }

  /* ---- P6 — comprehensive automatic checks: dimensions · fonts · assets ·
     resolution · crop · alignment · export integrity. Informational facts
     are NOTEs (they never block or fake a defect); only a structural break
     in the exported SVG earns FAIL, and alignment earns a fixable WARN. */
  if (plan && Array.isArray(plan.elements)) {
    const nameOf = el => TYPE_ROLE_AR[el.role] || el.role;
    const vis = plan.elements.filter(el => el && !el.hidden);

    if (Math.min(W, H) < 360)
      issues.push({ id: 'size-guard', severity: 'NOTE', message: `أصغر ضلع ${Math.round(Math.min(W, H))}px — النص الصغير سيبتلعه التصدير`, hint: 'اختر مقاسًا ≥ 360px أو كبّر التباعد' });

    for (const el of vis)
      if (el.kind === 'imageFrame' && !el.src)
        issues.push({ id: 'asset-missing', severity: 'NOTE', message: 'إطار الصورة بلا مصدر — يُرسم كصندوق داكن', hint: 'أعد رفع الصورة من لوحة الميديا' });

    /* دقة + قص: the photo vs the box it must fill (2× export) */
    const fr = vis.find(e => e.kind === 'imageFrame');
    const fs = plan.meta && mediaStore.frame;
    if (fr && fs && fs.nw && fs.nh && fr.rect) {
      const need = Math.min(fr.rect[2], fr.rect[3]) * 2;
      const have = Math.min(fs.nw, fs.nh);
      if (have < need * 0.9)
        issues.push({ id: 'low-res', severity: 'NOTE', message: `صورة الإطار ${Math.round(have)}px مقابل ${Math.round(need)}px لتصدير 2× — التفاصيل ستليين`, hint: 'ارفع صورة أعرض أو صغّر الإطار' });
      const srcAR = fs.nw / fs.nh, boxAR = fr.rect[2] / Math.max(1, fr.rect[3]);
      if (Math.max(srcAR, boxAR) / Math.min(srcAR, boxAR) > 1.6)
        issues.push({ id: 'frame-crop', severity: 'NOTE', message: `نسبة الصورة ${srcAR.toFixed(2)} مقابل صندوق ${boxAR.toFixed(2)} — قصّ كبير عند «cover»`, hint: 'بدّل الصورة أو غيّر موضع الإطار' });
    }

    /* محاذاة: every right-locked line must share one right edge */
    const rights = vis.filter(e => e.kind === 'type' && e.align === 'right');
    if (rights.length > 1) {
      const edges = rights.map(e => ({ el: e, edge: Math.round(typeBBox(e)[2]) })).sort((a, b) => a.edge - b.edge);
      const med = edges[Math.floor(edges.length / 2)].edge;
      const drifts = edges.filter(o => Math.abs(o.edge - med) > 6);
      if (drifts.length)
        issues.push({
          id: 'align-drift', severity: 'WARN',
          message: `${drifts.length} عناصر تبعد >6px عن خط اليمين المشترك (${med}px): ` + drifts.slice(0, 3).map(o => nameOf(o.el)).join(' · '),
          hint: 'إعادة المحاذاة تجمع كل الأسطر على خط واحد'
        });
    }

    /* خطوط: the requested family must really paint — equal width against a
       guaranteed-missing sentinel means it silently fell back */
    const fam = plan.meta && plan.meta.font;
    if (fam) {
      const probe = s => { measureCtx.font = `700 40px ${s}`; return measureCtx.measureText('مرسم مِرسم 2026').width; };
      const wFam = probe(`"${fam}"`);
      const wSent = probe('"MIRSAM__MISSING__"');
      if (Math.abs(wFam - wSent) < 0.5)
        issues.push({ id: 'font-fallback', severity: 'NOTE', message: `الخط «${fam}» لم يُطبَّق في هذه البيئة — النص قيست على خط البديل`, hint: 'اختر خطًا متاحًا من القائمة المحلية' });
    }

    /* سلامة التصدير: the exact string PNG/PDF/SVG exports consume must parse,
       escape and carry every visible text layer */
    try {
      const svg = renderSVG(plan, { transparent: true });
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const broken = doc.querySelector('parsererror');
      const got = doc.querySelectorAll('text').length;
      const want = vis.filter(e => e.kind === 'type').length;
      if (broken || got !== want)
        issues.push({ id: 'export-integrity', severity: 'FAIL', message: broken ? 'SVG الناتج لم يُحلَّل — بنية التصدير تالفة' : `SVG يحمل ${got} نصًّا مقابل ${want} متوقّع`, hint: 'أعد التوليد · بلّغ مطوّرًا إذا تكرّر' });
      else if (/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)/.test(svg))
        issues.push({ id: 'export-integrity', severity: 'FAIL', message: 'رمز & غير مُهرَّب داخل SVG', hint: 'هروب النصوص معطوب — لا تصدّر قبل الإصلاح' });
    } catch (e) {
      issues.push({ id: 'export-integrity', severity: 'FAIL', message: `تعذّر بناء SVG: ${(e && e.message) || e}`, hint: 'عطل في مُصيّر الطباعة' });
    }
  }

  return {
    width: W, height: H, blankness,
    inkRatio: +inkRatio.toFixed(4),
    centerOfMass: com.map(v => +v.toFixed(3)),
    palette, maxContrast, textColor: inkHex,
    dominantHues: hueCount, edgePixels: edge,
    coverage: +coverage.toFixed(4),
    rightShare: +rightShare.toFixed(3), hierarchy, focalDist,
    heat: heatN, spill,
    issues
  };
}

/* ---------------- correction loop (§15) ---------------- */
function applyFixes(plan, issues) {
  const fixes = [];
  const [W, H] = plan.canvas, margin = plan.grid.margin;
  const find = role => plan.elements.find(e => e.role === role);

  /* P7: a locked layer belongs to the designer — the automatic pass reports
     it honestly but never edits it (same contract as an override: the loop
     ends on MAX_RETRIES/UNIMPROVABLE instead of silently winning) */
  const locked = el => !!(el && el.key && overrides[el.key] && overrides[el.key].locked);
  const held = (issue, el) => fixes.push({
    issue: issue.id,
    action: `مقفل: «${TYPE_ROLE_AR[el.role] || el.role}» تُرك كما هو — ألغِ القفل ليُصلَح تلقائيًا`
  });

  for (const issue of issues) {
    if (issue.id === 'edge-spill') {
      let moved = 0, blocked = 0;
      for (const el of plan.elements) {
        if (el.bleed) continue;
        if (locked(el)) { blocked++; continue; }
        if (el.kind === 'type') {
          if (el.x > W - margin) { el.x = W - margin; moved++; }
          if (!el.maxW) el.maxW = W - margin * 2;
        } else if (el.rect) {
          const [x, y, w, h] = el.rect;
          const nx = Math.max(margin, Math.min(x, W - margin - w));
          const ny = Math.max(margin, Math.min(y, H - margin - h));
          if (nx !== x || ny !== y) { el.rect = [nx, ny, w, h]; moved++; }
        } else if (el.kind === 'ring') {
          if (el.cy - el.r < margin) { el.cy = margin + el.r; moved++; }
        }
      }
      fixes.push({ issue: issue.id, action: `سحب ${moved} عنصرًا إلى المنطقة الآمنة${blocked ? ` · تُرك ${blocked} مقفلًا` : ''}` });
    } else if (issue.id === 'clutter') {
      let did = false;
      const band = find('accent-band');
      if (band && !locked(band)) { const [x, y, w, h] = band.rect; const nh = Math.max(24, Math.round(h * 0.6)); band.rect = [x, H - nh, w, nh]; did = true; }
      else if (band) held(issue, band);
      const decoEl = find('focal-deco');
      if (decoEl && decoEl.rect && !locked(decoEl)) { const [x, y, w, h] = decoEl.rect; const n = Math.max(40, Math.round(w * 0.7)); decoEl.rect = [x, y, n, n]; did = true; }
      else if (decoEl) held(issue, decoEl);
      if (did) fixes.push({ issue: issue.id, action: 'تصغير الشريط/الزخرفة لاستعادة المساحة السالبة' });
    } else if (issue.id === 'low-contrast') {
      const bg = plan.palette.bg, better = readableInk(bg);
      for (const role of ['headline', 'subhead', 'cta-text']) {
        const el = find(role);
        if (el && locked(el)) { held(issue, el); continue; }
        if (el && contrast(el.color, bg) < 4.5) { el.color = better; fixes.push({ issue: issue.id, action: `${role} → ${better}` }); }
      }
    } else if (issue.id === 'focal-ambiguity') {
      let did = false;
      const he = find('headline');
      if (he && locked(he)) held(issue, he);
      else if (he) { he.size = Math.round(he.size * 1.15); he.leading = Math.round(he.size * 1.34); did = true; }
      const decoEl = find('focal-deco');
      if (decoEl && decoEl.rect && !locked(decoEl)) { decoEl.rect = [decoEl.rect[0], decoEl.rect[1], Math.round(decoEl.rect[2] * 0.8), Math.round(decoEl.rect[3] * 0.8)]; did = true; }
      if (did) fixes.push({ issue: issue.id, action: 'تكبير العنوان 15% وتصغير الزخرفة 20%' });
    } else if (issue.id === 'weak-hierarchy') {
      const he = find('headline');
      if (he && locked(he)) held(issue, he);
      else if (he) {
        const before = he.size;
        he.size = Math.round(he.size * 1.12);
        he.leading = Math.round(he.size * 1.34);
        fixes.push({ issue: issue.id, action: `عنوان ${before} → ${he.size}px` });
      }
    } else if (issue.id === 'palette-creep') {
      fixes.push({ issue: issue.id, action: 'إعادة حصر الألوان في أدوار الباليتة' });
    } else if (issue.id === 'align-drift') {
      const rights = plan.elements.filter(e => e && !e.hidden && e.kind === 'type' && e.align === 'right');
      if (rights.length > 1) {
        const edges = rights.map(e => typeBBox(e)[2]).sort((a, b) => a - b);
        const med = Math.round(edges[Math.floor(edges.length / 2)]);
        let n = 0, blocked = 0;
        for (const e of rights) {
          const d = Math.round(med - typeBBox(e)[2]);
          if (Math.abs(d) <= 6) continue;
          if (locked(e)) { blocked++; continue; }
          e.x += d; n++;
        }
        fixes.push({ issue: issue.id, action: `محاذاة ${n} عنصرًا إلى خط اليمين ${med}px${blocked ? ` · تُرك ${blocked} مقفلًا` : ''}` });
      }
    } else if (issue.id === 'text-overflow') {
      const el = plan.elements[issue.i];
      if (el && el.kind === 'type') {
        if (locked(el)) { held(issue, el); }
        else {
          /* pull the anchor inside the measure, then shrink until the block fits */
          const nx = clamp(el.x, margin, W - margin);
          if (nx !== el.x) el.x = Math.round(nx);
          for (let k = 0; k < 12 && el.size > 10; k++) {
            const b = typeBBox(el);
            const out = Math.max(margin - b[0], margin - b[1], b[2] - (W - margin), b[3] - (H - margin));
            if (out <= 2) break;
            el.size = Math.max(10, Math.round(el.size * 0.92));
            if (el.leading) el.leading = Math.max(8, Math.round(el.leading * 0.92));
          }
          fixes.push({ issue: issue.id, action: `«${TYPE_ROLE_AR[el.role] || el.role}» داخل الصندوق — حجم ${el.size}px` });
        }
      }
    } else if (issue.id === 'layer-overlap') {
      const A = plan.elements[issue.a], B = plan.elements[issue.b];   /* upper · lower */
      /* move the lower one first; if the designer locked it, lift the upper
         one instead — only when both are locked do we hold and say so */
      const cands = [B, A].filter(x => x && x.kind === 'type');
      const mover = cands.find(x => !locked(x)) || null;
      if (!mover) {
        if (cands.length) held(issue, cands[0]);
      } else {
        const down = mover === B;
        const gap = Math.round(Math.min(W, H) * 0.012) + 6;
        for (let k = 0; k < 8; k++) {
          const bU = typeBBox(A), bL = typeBBox(B);
          const ix = Math.min(bU[2], bL[2]) - Math.max(bU[0], bL[0]);
          const iy = Math.min(bU[3], bL[3]) - Math.max(bU[1], bL[1]);
          const mb = typeBBox(mover);
          const edgeOut = down ? mb[3] - (H - margin) : margin - mb[1];
          if (!(ix > 2 && iy > 2) && edgeOut <= 2) break;
          if (ix > 2 && iy > 2) {
            /* drop the lower block under the upper one — or lift the upper one off */
            mover.y = Math.round(mover.y + (down ? (bU[3] + gap - bL[1]) : (bL[1] - gap - bU[3])));
          } else if (mover.size <= 10) break;
          const after = typeBBox(mover);
          const out = down ? after[3] - (H - margin) : margin - after[1];
          if (out > 2) {
            if (mover.size <= 10) break;
            mover.size = Math.max(10, Math.round(mover.size * 0.9));
            if (mover.leading) mover.leading = Math.max(8, Math.round(mover.leading * 0.9));
          }
        }
        fixes.push({
          issue: issue.id,
          action: `تفكيك تداخل «${TYPE_ROLE_AR[mover.role] || mover.role}» عن «${TYPE_ROLE_AR[(mover === B ? A : B).role] || (mover === B ? A : B).role}»`
        });
      }
    } else if (issue.id === 'blank') {
      fixes.push({ issue: issue.id, action: 'FATAL: مخرج مسطّح — إيقاف الحلقة' });
    }
  }
  return fixes;
}

/* knowledge → output: the plan rationale repeats only what really changed */
function syncKnowledgeRationale(plan) {
  if (!plan.knowledgeApplied || !plan.knowledgeApplied.length) return;
  plan.rationale = plan.rationale.filter(l => !l.startsWith('مبدأ مُطبَّق'))
    .concat(plan.knowledgeApplied.map(s => 'مبدأ مُطبَّق: ' + s));
}

async function runLoop(brief, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const autoFix = opts.autoFix ?? true;
  let plan = makePlan(brief);
  applyKnowledge(plan);           // principles become measurable plan rules
  applyOverrides(plan.elements);  // designer edits always win
  syncKnowledgeRationale(plan);
  const history = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const [W, H] = plan.canvas;
    const canvas = await svgToCanvas(renderSVG(plan), W, H);
    /* measure the content layer: intentional full-bleed panels would otherwise
       dominate ink mass, balance and focal distance */
    const mask = plan.elements.some(e => e.bleed)
      ? await svgToCanvas(renderSVG(plan, { skipBleed: true }), W, H)
      : canvas;
    const report = analyze(mask, plan, { coverage: coverageOf(canvas) });

    /* only defects with a deterministic remedy block the loop; documented
       palette notes and balance/focus remarks are reported to the designer */
    const FIXABLE = new Set(['low-contrast', 'clutter', 'focal-ambiguity', 'weak-hierarchy', 'edge-spill', 'blank',
      'text-overflow', 'layer-overlap', 'align-drift']);
    const blocking = report.issues.filter(i => i.severity === 'FAIL' || FIXABLE.has(i.id));

    const rec = {
      attempt, report, canvas, mask,
      plan: JSON.parse(JSON.stringify(plan)),
      issues: report.issues.map(i => i.id)
    };

    if (!blocking.length) {
      const notes = report.issues.filter(i => i.severity === 'NOTE' ||
        (i.id === 'edge-spill' && plan.elements.some(e => e.bleed)) || i.id === 'palette-creep');
      rec.result = notes.length ? 'CLEAN · notes' : 'CLEAN';
      history.push(rec);
      break;
    }
    if (attempt > maxRetries) { rec.result = 'MAX_RETRIES'; history.push(rec); break; }
    if (!autoFix) { rec.result = 'WARN'; history.push(rec); break; }

    const before = JSON.stringify(plan.elements);
    rec.fixes = applyFixes(plan, blocking);
    applyKnowledge(plan);          // keep enforcing the principles after a fix
    applyOverrides(plan.elements); // designer edits beat automatic fixes
    syncKnowledgeRationale(plan);
    history.push(rec);
    if (JSON.stringify(plan.elements) === before) { rec.result = 'UNIMPROVABLE'; break; }
  }

  const last = history[history.length - 1];
  const finalCanvas = finish(last.canvas, last.plan);
  /* finish texture is applied after the loop; measure the finished pixels too
     so the numbers describe what is actually exported (minus the panel layer) */
  const finalMask = last.mask && last.mask !== last.canvas ? finish(last.mask, last.plan) : finalCanvas;
  const finalReport = last.plan.meta.grain
    ? analyze(finalMask, last.plan, { coverage: coverageOf(finalCanvas) })
    : last.report;

  return {
    plan: last.plan, history, canvas: finalCanvas,
    report: finalReport, loopReport: last.report, result: last.result || 'WARN'
  };
}

/* =========================================================================
   UI
   ========================================================================= */
const $ = id => document.getElementById(id);
let lastRes = null, lastCanvas = null, lastPlan = null, busy = false, pending = false, timer = null;
let style = 'bold', composition = 'stack', accentMode = 'solid', harmony = 'manual';
const overlay = { grid: false, safe: false, heat: false, focal: true, edge: true };

const AR_DIGITS = new Map([...'0123456789'].map((d, i) => [d, '٠١٢٣٤٥٦٧٨٩'[i]]));
const arNum = n => String(n).replace(/[0-9]/g, d => AR_DIGITS.get(d));

let parsedBrief = null;

/* per-element user edits — keyed by element key (role or role#index).
   They are re-applied on every plan build, so an edit survives regeneration,
   genre/preset switches and the correction loop. */
const overrides = {};

/* B8: persist designer edits across a page refresh. Same-origin localStorage
   only — never leaves the browser, and it holds layout values, no secrets. */
function saveOverrides() {
  try { localStorage.setItem('mirsam.overrides', JSON.stringify(overrides)); }
  catch { /* storage full/blocked — edits still live for this session */ }
}
function loadOverrides() {
  try {
    const raw = localStorage.getItem('mirsam.overrides');
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') Object.assign(overrides, o);
  } catch { /* corrupt value — start clean */ }
}
loadOverrides();

/* P7: undo/redo — a session-only stack of override snapshots over the same
   durable localStorage copy. It never survives a refresh on purpose: history
   you cannot see is history you would not trust. */
const undoStack = [], redoStack = [];
const UNDO_MAX = 60;
let undoTag = '', undoTagAt = 0;

function pushUndo(tag) {
  const now = Date.now();
  /* one slider drag = one step, not sixty */
  if (tag && tag === undoTag && now - undoTagAt < 900) { undoTagAt = now; return; }
  undoTag = tag || '';
  undoTagAt = now;
  undoStack.push(JSON.stringify(overrides));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;              /* a new edit invalidates the old future */
}
function applySnapshot(snap) {
  const o = JSON.parse(snap);
  for (const k of Object.keys(overrides)) delete overrides[k];
  Object.assign(overrides, o);
  saveOverrides();
}
function undoEdits() {
  if (!undoStack.length) return false;
  redoStack.push(JSON.stringify(overrides));
  applySnapshot(undoStack.pop());
  undoTag = '';
  return true;
}
function redoEdits() {
  if (!redoStack.length) return false;
  undoStack.push(JSON.stringify(overrides));
  applySnapshot(redoStack.pop());
  undoTag = '';
  return true;
}

/* =========================================================================
   placed media — an image frame and a QR code inside the design.
   Same contract as overrides: saved in localStorage (same origin, layout
   values + one downscaled data URL; never leaves the browser) and re-applied
   on every plan build, so both survive regeneration, presets and QA fixes.
   ========================================================================= */
const mediaStore = { frame: null, qr: null, icon: null };
const FRAME_SLOTS = {
  'left-panel': 'لوح جانبي (يسار)',
  'top-band': 'شريط علوي',
  'bottom-band': 'شريط سفلي',
  'corner': 'مربّع الزاوية العليا'
};

function saveMedia() {
  try {
    if (mediaStore.frame) localStorage.setItem('mirsam.frame', JSON.stringify(mediaStore.frame));
    else localStorage.removeItem('mirsam.frame');
    if (mediaStore.qr) localStorage.setItem('mirsam.qr', JSON.stringify(mediaStore.qr));
    else localStorage.removeItem('mirsam.qr');
    if (mediaStore.icon) localStorage.setItem('mirsam.icon', JSON.stringify(mediaStore.icon));
    else localStorage.removeItem('mirsam.icon');
  } catch { /* storage full — the asset stays for this session only */ }
}
function loadMedia() {
  try {
    const v = JSON.parse(localStorage.getItem('mirsam.frame') || 'null');
    if (v && v.src) mediaStore.frame = v;
  } catch { /* corrupt — start without a frame */ }
  try {
    const v = JSON.parse(localStorage.getItem('mirsam.qr') || 'null');
    if (v && v.text) mediaStore.qr = v;
  } catch { /* corrupt — start without a code */ }
  try {
    const v = JSON.parse(localStorage.getItem('mirsam.icon') || 'null');
    /* only accept a name the vendored library actually ships */
    if (v && v.name && typeof TABLER_ICONS !== 'undefined' && TABLER_ICONS[v.name]) mediaStore.icon = v;
  } catch { /* corrupt — start without an icon */ }
}
loadMedia();

/* frame geometry per slot. Every slot touches an edge, so the frame is a
   bleed layer: the edge-spill check reports NOTE instead of WARN. */
function frameRectFor(slot, W, H) {
  if (slot === 'top-band') return [0, 0, W, Math.round(H * 0.30)];
  if (slot === 'bottom-band') { const h = Math.round(H * 0.28); return [0, H - h, W, h]; }
  if (slot === 'corner') { const s = Math.round(Math.min(W, H) * 0.34); return [0, 0, s, s]; }
  return [0, 0, Math.round(W * 0.42), H];          /* left-panel (default) */
}

/* measured box of a text element [x0,y0,x1,y1] — lets a new layer dodge
   every word; diacritized text gets its real top (harakat rise above caps) */
function typeBBox(el) {
  const maxW = el.maxW || 4000;
  const lines = wrapLines(el.text, maxW, el.font, el.size, el.weight);
  measureCtx.font = `${el.weight} ${el.size}px ${fontStackFor(el.font)}`;
  const w = Math.min(maxW, Math.max(...lines.map(l => measureCtx.measureText(l).width)));
  const x0 = el.align === 'center' ? el.x - w / 2 : (el.align === 'left' ? el.x : el.x - w);
  const lead = el.leading || el.size * 1.34;
  const top = el.size * (MARK.test(el.text || '') ? 1.06 : 0.92);
  const y0 = el.y - top;
  const y1 = el.y + el.size * 0.23 + (lines.length - 1) * lead;
  return [x0, y0, x0 + w, y1];
}
/* [x0,y0,x1,y1] → [x,y,w,h]: overlaps() speaks width/height, boxes speak edges */
const boxWH = b => (b ? [b[0], b[1], b[2] - b[0], b[3] - b[1]] : null);

/* where a decorative icon can live: try the requested slot first, then a
   fixed tour of the canvas corners/edges, and take the spot that touches
   nothing (photo · QR · CTA · words · panels). Never returns a placement
   that sits on a word — if every slot is busy it picks the least crowded
   one rather than silently dropping the icon. */
const ICON_SLOTS = ['top-right', 'top-left', 'bottom-right', 'bottom-left',
  'mid-right', 'mid-left', 'top-center', 'bottom-center'];

function iconRectFor(slot, W, H, short, m, avoid) {
  const s = Math.round(clamp(short * 0.11, 48, 170));
  const midY = Math.round((H - s) / 2), midX = Math.round((W - s) / 2);
  const spots = {
    'top-right': [W - m - s, m], 'top-left': [m, m],
    'bottom-right': [W - m - s, H - m - s], 'bottom-left': [m, H - m - s],
    'mid-right': [W - m - s, midY], 'mid-left': [m, midY],
    'top-center': [midX, m], 'bottom-center': [midX, H - m - s]
  };
  const order = [slot, ...ICON_SLOTS.filter(k => k !== slot)];
  const list = (avoid || []).filter(Boolean);
  let best = null, bestHits = Infinity, bestSlot = null;
  for (const k of order) {
    const p = spots[k];
    if (!p) continue;
    const r = [p[0], p[1], s, s];
    const hits = list.reduce((n, b) => n + (overlaps(r, b) ? 1 : 0), 0);
    if (hits < bestHits) { best = r; bestHits = hits; bestSlot = k; if (!hits) break; }
  }
  /* report where it ACTUALLY settled — the UI must never claim a busy slot */
  return best ? { rect: best, slot: bestSlot } : null;
}

/* bbox used to keep decoration out of the picture */
function mediaBBox(el) {
  if (el.rect) return el.rect;
  if (el.kind === 'ring') return [el.cx - el.r, el.cy - el.r, el.r * 2, el.r * 2];
  if (el.kind === 'line') return [Math.min(el.x1, el.x2), Math.min(el.y1, el.y2),
    Math.max(1, Math.abs(el.x2 - el.x1)), Math.max(1, Math.abs(el.y2 - el.y1))];
  return null;
}
function overlaps(a, b) {
  return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
}

/* upload: read the file → downscale → data URL (keeps localStorage small) */
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        const k = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k));
        const h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(img, 0, 0, w, h);
        /* PNG keeps transparency only when it is small enough to store */
        const keepPng = file.type === 'image/png' && w * h <= 900000;
        resolve(c.toDataURL(keepPng ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('تعذّرت قراءة الصورة — جرّب PNG أو JPEG'));
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  });
}

/* natural pixel size of a data URL: the resolution check must know what the
   photo really carries before a 2× export stretches it */
function imgDims(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res({ nw: im.naturalWidth, nh: im.naturalHeight });
    im.onerror = () => rej(new Error('تعذّرت قراءة أبعاد الصورة'));
    im.src = src;
  });
}

async function addFrameImage(file, opts = {}) {
  const src = await readImageFile(file);
  mediaStore.frame = Object.assign({ slot: 'left-panel', fit: 'cover' },
    mediaStore.frame || {}, opts, { src });
  /* P6: remember the true size — the low-res/crop checks stay silent without it */
  try { Object.assign(mediaStore.frame, await imgDims(src)); }
  catch { /* unknown dimensions: checks skip rather than guess */ }
  saveMedia();
  return mediaStore.frame;
}
function patchFrame(patch) {
  if (!mediaStore.frame) return false;
  Object.assign(mediaStore.frame, patch);
  saveMedia();
  return true;
}
function clearFrame() { mediaStore.frame = null; saveMedia(); }

/* QR — validated at input time so a bad code never reaches the canvas */
function qrMatrix(text) {
  if (typeof qrcode === 'undefined') throw new Error('مكتبة الرموز غير محمّلة (vendor/qrcode.js)');
  const q = qrcode(0, 'M');
  q.addData(String(text));
  q.make();
  return q;
}
function setQR(text) {
  const t = String(text || '').trim();
  if (!t) { mediaStore.qr = null; saveMedia(); return null; }
  try { qrMatrix(t); }
  catch (e) {
    /* qrcode-generator throws plain strings, not Error objects */
    const raw = (e && e.message) || String(e || 'خطأ غير معروف');
    throw new Error(/too long|overflow|code length|length over/i.test(raw)
      ? 'النص طويل جدًا للرموز — اختصر الرابط' : raw);
  }
  mediaStore.qr = Object.assign({}, mediaStore.qr, { text: t });
  saveMedia();
  return mediaStore.qr;
}
function clearQR() { mediaStore.qr = null; saveMedia(); }

function briefFromUI() {
  const [w, h] = $('size').value.split('x').map(Number);
  return {
    headline: $('headline').value.trim() || 'عنوان',
    subhead: $('subhead').value.trim(),
    cta: $('cta').value.trim(),
    kicker: $('kicker').value.trim(),
    date: (parsedBrief && parsedBrief.date) || '',
    items: (parsedBrief && parsedBrief.items) || [],
    genre: $('genre') ? $('genre').value : 'social-post',
    shape: $('shape') ? $('shape').value : 'soft',
    width: w, height: h,
    style,
    primary: $('primary').value.toUpperCase(),
    secondary: $('secondary').value.toUpperCase(),
    font: $('font') ? $('font').value : 'Tahoma',
    composition,
    decor: $('decor').value,
    accentMode,
    harmony,
    grain: $('grain').checked,
    weight: Number($('weight').value),
    bleed: $('bleed').checked,
    spacing: $('spacing') ? Number($('spacing').value) : 100
  };
}

function metricCard(k, v, cls = '') {
  return `<div class="metric ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

/* ---------- visual feedback overlay ---------- */
function renderOverlay(res) {
  const svg = $('overlay');
  if (!res) { svg.innerHTML = ''; svg.style.display = 'none'; return; }
  const { plan, report } = res;
  const [W, H] = plan.canvas;
  const m = plan.grid.margin;
  const any = overlay.grid || overlay.safe || overlay.heat || overlay.focal || overlay.edge;
  svg.style.display = any ? 'block' : 'none';
  if (!any) { svg.innerHTML = ''; return; }

  let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">`;

  if (overlay.heat) {
    const G = 16, cw = W / G, ch = H / G;
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const v = report.heat[y * G + x];
        if (v <= 0.02) continue;
        s += `<rect x="${x * cw}" y="${y * ch}" width="${cw}" height="${ch}" fill="#f4a417" opacity="${(v * 0.42).toFixed(3)}"/>`;
      }
    }
  }

  if (overlay.grid) {
    for (let i = 1; i < 12; i++) {
      const x = (W / 12) * i;
      s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#6ea8fe" stroke-width="${W * 0.0012}" opacity=".20"/>`;
    }
    for (let i = 1; i < 8; i++) {
      const y = (H / 8) * i;
      s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#6ea8fe" stroke-width="${W * 0.0012}" opacity=".16"/>`;
    }
    /* thirds */
    s += `<line x1="${W / 3}" y1="0" x2="${W / 3}" y2="${H}" stroke="#3dcc91" stroke-width="${W * 0.0016}" opacity=".35" stroke-dasharray="${W * 0.012} ${W * 0.008}"/>`;
    s += `<line x1="${2 * W / 3}" y1="0" x2="${2 * W / 3}" y2="${H}" stroke="#3dcc91" stroke-width="${W * 0.0016}" opacity=".35" stroke-dasharray="${W * 0.012} ${W * 0.008}"/>`;
    s += `<line x1="0" y1="${H / 3}" x2="${W}" y2="${H / 3}" stroke="#3dcc91" stroke-width="${W * 0.0016}" opacity=".35" stroke-dasharray="${W * 0.012} ${W * 0.008}"/>`;
    s += `<line x1="0" y1="${2 * H / 3}" x2="${W}" y2="${2 * H / 3}" stroke="#3dcc91" stroke-width="${W * 0.0016}" opacity=".35" stroke-dasharray="${W * 0.012} ${W * 0.008}"/>`;
  }

  if (overlay.safe) {
    s += `<rect x="${m}" y="${m}" width="${W - m * 2}" height="${H - m * 2}" fill="none" stroke="#f0616d" stroke-width="${W * 0.0022}" stroke-dasharray="${W * 0.014} ${W * 0.01}" opacity=".65"/>`;
  }

  if (overlay.focal) {
    const fx = plan.focal.x, fy = plan.focal.y, r = Math.min(W, H) * 0.035;
    s += `<circle cx="${fx}" cy="${fy}" r="${r}" fill="none" stroke="#f4a417" stroke-width="${W * 0.0022}" opacity=".85"/>`;
    s += `<line x1="${fx - r * 1.8}" y1="${fy}" x2="${fx + r * 1.8}" y2="${fy}" stroke="#f4a417" stroke-width="${W * 0.0016}" opacity=".7"/>`;
    s += `<line x1="${fx}" y1="${fy - r * 1.8}" x2="${fx}" y2="${fy + r * 1.8}" stroke="#f4a417" stroke-width="${W * 0.0016}" opacity=".7"/>`;
    /* measured centre of mass */
    const cx = report.centerOfMass[0] * W, cy = report.centerOfMass[1] * H;
    s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#6ea8fe" opacity=".55"/>`;
    s += `<line x1="${fx}" y1="${fy}" x2="${cx}" y2="${cy}" stroke="#6ea8fe" stroke-width="${W * 0.0014}" opacity=".5" stroke-dasharray="${W * 0.006} ${W * 0.006}"/>`;
  }

  if (overlay.edge) {
    const r = Math.max(2, W * 0.005);
    for (const [x, y] of report.spill) {
      s += `<circle cx="${(x * W).toFixed(1)}" cy="${(y * H).toFixed(1)}" r="${r}" fill="#f0616d" opacity=".75"/>`;
    }
  }

  svg.innerHTML = s + '</svg>';
}

/* ---------- critique: measured, plain language ---------- */
function critique(r, plan) {
  const out = [];
  const c = r.maxContrast;
  out.push(`التباين ${c}:1 — ${c >= 7 ? 'ممتاز AAA' : c >= 4.5 ? 'مقبول AA' : 'ضعيف، يحتاج تغميقًا'}`);
  const inkPct = Math.round(r.inkRatio * 100);
  out.push(`كثافة الحبر ${arNum(inkPct)}% — ${r.inkRatio > 0.3 ? 'مزدحمة' : r.inkRatio < 0.015 ? 'هزيلة' : 'مساحة سالبة صحية'}`);
  out.push(`التوازن ${arNum(Math.round(r.rightShare * 100))}% يمين المركز — ${
    plan.meta.composition === 'split' && r.rightShare < 0.3 ? 'منحاز قصدًا للوح اللوني'
      : r.rightShare > 0.8 ? 'منحاز لليمين' : r.rightShare < 0.2 ? 'منحاز لليسار' : 'متوازن'}`);
  if (r.hierarchy) out.push(`التسلسل ${r.hierarchy.toFixed(2)}× بين العنوان والنص الثانوي — ${r.hierarchy >= 1.6 ? 'قيادة بصرية واضحة' : 'ضعيف'}`);
  if (r.focalDist != null) out.push(`مركز كتلة الحبر عند ${arNum(Math.round(r.centerOfMass[0] * 100))}% أفقيًا و${arNum(Math.round(r.centerOfMass[1] * 100))}% رأسيًا`);
  const [W, H] = plan.canvas;
  out.push(`العائلات اللونية ${arNum(r.dominantHues)} — ${r.dominantHues <= 3 ? 'داخل قاعدة ٦٠-٣٠-١٠' : 'تحتاج حصرًا'}`);
  (plan.knowledgeApplied || []).forEach(k => out.push(`قاعدة معرفة مُطبَّقة: ${k}`));
  return out;
}

/* ---------- P6 — the critic: eight criteria, weighted by design type,
   each scored from the measured report, then ordered by what to fix first.
   Scores READ the measurements; they never replace them (the NOTE rule). --- */
const CRITERIA = [
  { id: 'contrast',   title: 'التباين',        issues: ['low-contrast'] },
  { id: 'hierarchy',  title: 'التسلسل',        issues: ['weak-hierarchy'] },
  { id: 'balance',    title: 'التوازن',        issues: ['unbalanced'] },
  { id: 'whitespace', title: 'المساحة السالبة', issues: ['clutter', 'blank'] },
  { id: 'palette',    title: 'تماسك الألوان',  issues: ['palette-creep', 'focal-ambiguity'] },
  { id: 'edge',       title: 'سلامة الحافة',   issues: ['edge-spill', 'text-overflow', 'layer-overlap'] },
  { id: 'focus',      title: 'نقطة التركيز',   issues: ['off-focal'] },
  { id: 'integrity',  title: 'سلامة المخرج',   issues: ['export-integrity', 'asset-missing', 'font-fallback', 'low-res', 'frame-crop', 'size-guard'] }
];

/* weights by genre — [contrast, hierarchy, balance, whitespace, palette, edge, focus, integrity].
   A thumbnail must be legible at 160px; a banner must read across a street;
   a quote card lives or dies on balance. The weights say so. */
const CRITERIA_W = {
  default:        [1.2, 1.4, 1.2, 1.0, 1.0, 1.2, 1.0, 1.1],
  'social-post':  [1.2, 1.5, 1.2, 1.0, 1.1, 1.0, 1.3, 1.0],
  story:          [1.2, 1.4, 1.1, 1.0, 1.0, 1.5, 1.2, 1.1],
  quote:          [1.1, 1.2, 1.5, 1.2, 1.0, 0.9, 1.4, 1.0],
  'product-ad':   [1.5, 1.4, 1.1, 1.0, 1.1, 1.1, 1.1, 1.2],
  event:          [1.3, 1.5, 1.2, 1.0, 1.0, 1.2, 1.1, 1.1],
  menu:           [1.4, 1.3, 1.1, 1.4, 0.9, 1.2, 0.9, 1.1],
  banner:         [1.5, 1.6, 1.1, 0.9, 0.9, 1.4, 1.0, 1.1],
  thumbnail:      [1.7, 1.5, 1.0, 0.9, 1.0, 1.0, 1.4, 1.0],
  flyer:          [1.2, 1.3, 1.2, 1.2, 1.0, 1.3, 1.0, 1.2],
  card:           [1.4, 1.2, 1.1, 1.2, 1.0, 1.3, 0.9, 1.2]
};

function critic(r, plan) {
  const genre = (plan.meta && plan.meta.genre) || 'default';
  const w = CRITERIA_W[genre] || CRITERIA_W.default;
  const c = r.maxContrast || 0;
  const h = r.hierarchy || 0;
  const rb = r.rightShare == null ? 0.5 : r.rightShare;
  const split = !!(plan.meta && plan.meta.composition === 'split');
  const hasBleed = (plan.elements || []).some(e => e.bleed);
  const ids = new Set((r.issues || []).map(i => i.id));
  const has = (id, sev) => (r.issues || []).some(i => i.id === id && (!sev || i.severity === sev));
  const cl = v => Math.max(0, Math.min(100, Math.round(v)));

  const scores = {
    /* WCAG ladder: 7 AAA · 4.5 AA · 3 large-text · below → linear to nothing */
    contrast: c >= 7 ? 100 : c >= 4.5 ? 90 : c >= 3 ? 65 : cl(65 * (c - 1) / 2),
    /* no subhead at all is a neutral single-level design, not a failure */
    hierarchy: h === 0 ? 80 : h >= 2.2 ? 100 : h >= 1.6 ? 90 : h >= 1.2 ? 65 : cl(65 * h / 1.2),
    balance: (() => {
      let s = rb <= 0.6 && rb >= 0.4 ? 100 : rb <= 0.7 && rb >= 0.3 ? 88 : rb <= 0.82 && rb >= 0.14 ? 70 : 40;
      if (split && s < 70) s += 15;           /* split compositions lean on purpose */
      return cl(s);
    })(),
    whitespace: (() => {
      if (r.blankness < 8) return 0;
      if (r.coverage > 0.78) return 15;
      if (r.coverage > 0.65) return 55;
      if (r.inkRatio < 0.015) return 55;      /* too thin: reads as empty */
      if (r.inkRatio > 0.30) return 45;
      return r.inkRatio >= 0.05 && r.inkRatio <= 0.20 ? 100 : 85;
    })(),
    palette: (() => {
      let s = r.dominantHues <= 2 ? 100 : r.dominantHues === 3 ? 90 : r.dominantHues === 4 ? 60 : 35;
      if (r.palette && r.palette.length >= 2 && r.palette[0].share / Math.max(r.palette[1].share, 1e-6) < 1.15) s -= 15;
      return cl(s);
    })(),
    edge: (() => {
      let s = 100;
      if (r.edgePixels > 0) s -= hasBleed ? 8 : 25;
      if (ids.has('text-overflow')) s -= has('text-overflow', 'FAIL') ? 60 : 30;
      if (ids.has('layer-overlap')) s -= 30;
      if (ids.has('align-drift')) s -= 15;
      return cl(s);
    })(),
    focus: (() => {
      if (r.focalDist == null) return 80;
      let s = r.focalDist <= 0.10 ? 100 : r.focalDist <= 0.22 ? 88 : r.focalDist <= 0.35 ? 60 : 40;
      if (ids.has('off-focal')) s -= 8;
      return cl(s);
    })(),
    integrity: (() => {
      let s = 100;
      for (const [id, pen] of [['export-integrity', 70], ['blank', 50], ['asset-missing', 30],
        ['font-fallback', 25], ['low-res', 25], ['frame-crop', 15], ['size-guard', 20]])
        if (ids.has(id)) s -= pen;
      return cl(s);
    })()
  };

  const list = CRITERIA.map((k, i) => ({
    id: k.id, title: k.title, weight: w[i], score: scores[k.id],
    issues: k.issues.filter(id => ids.has(id))
  }));
  const wSum = list.reduce((a, k) => a + k.weight, 0);
  const overall = Math.round(list.reduce((a, k) => a + k.score * k.weight, 0) / wSum);
  const grade = overall >= 90 ? 'ممتاز' : overall >= 78 ? 'جيد جدًا'
    : overall >= 65 ? 'جيد' : overall >= 50 ? 'مقبول' : 'يحتاج عملًا';
  /* priority = weight × shortfall below 85, and only where a real issue stands behind it */
  const priority = list
    .map(k => ({ ...k, gap: Math.max(0, 85 - k.score) * k.weight }))
    .filter(k => k.gap > 0 && k.issues.length)
    .sort((a, b) => b.gap - a.gap);
  return { list, overall, grade, priority };
}

function renderUI(res) {
  const { report, canvas, plan, history, result } = res;
  lastRes = res; lastCanvas = canvas; lastPlan = plan;

  $('preview').src = canvas.toDataURL('image/png');
  $('preview').classList.remove('hide');
  $('stageEmpty').style.display = 'none';
  $('stageDims').textContent = `${plan.canvas[0]} × ${plan.canvas[1]}`;
  $('download').disabled = false;
  $('downloadSvg').disabled = false;

  const hasBleed = plan.elements.some(e => e.bleed);
  const isNote = i => (i.id === 'edge-spill' && hasBleed) || i.id === 'palette-creep' || i.id === 'unbalanced' || i.id === 'off-focal';
  const notes = report.issues.filter(isNote);

  const state = $('stageState');
  const clean = result.startsWith('CLEAN');
  state.textContent = clean
    ? (notes.length ? 'نظيف · ملاحظات' : 'نظيف')
    : (result === 'MAX_RETRIES' ? 'حد أقصى' : result);
  state.className = 'state ' + (clean ? 'clean' : (report.issues.some(i => i.severity === 'FAIL') ? 'fail' : 'warn'));

  const cOk = report.maxContrast >= 4.5;
  const iOk = report.inkRatio >= 0.015 && report.inkRatio <= 0.30;
  const pOk = report.dominantHues <= 3;
  const bOk = report.rightShare <= 0.82 && report.rightShare >= 0.14;
  const hOk = report.hierarchy >= 1.6;
  $('metrics').innerHTML =
    metricCard('المقاس', `${arNum(plan.canvas[0])}×${arNum(plan.canvas[1])}`, 'ok') +
    metricCard('التباين', `${report.maxContrast.toFixed(2)}:1`, cOk ? 'ok' : 'warn') +
    metricCard('كثافة الحبر', `${arNum(Math.round(report.inkRatio * 100))}%`, iOk ? 'ok' : 'warn') +
    metricCard('العائلات', arNum(report.dominantHues), pOk ? 'ok' : 'warn') +
    metricCard('التوازن', `${arNum(Math.round(report.rightShare * 100))}%`, bOk ? 'ok' : 'warn') +
    metricCard('التسلسل', `${report.hierarchy ? report.hierarchy.toFixed(2) : '—'}×`, hOk ? 'ok' : 'warn');

  /* P6 — weighted scores + fix priority, rendered from the same measurements */
  const crit = critic(report, plan);
  const lvl = s => s >= 85 ? 'ok' : s >= 65 ? 'mid' : 'low';
  const cs = $('criticScores');
  if (cs) {
    cs.innerHTML =
      `<div class="crit-head"><span class="crit-grade ${lvl(crit.overall)}">${crit.grade}</span>`
      + `<span class="crit-num">${arNum(crit.overall)}<small>/١٠٠</small></span>`
      + `<span class="crit-w">ثمانية معايير مرجَّحة حسب «${plan.meta.genreName || plan.meta.genre}»</span></div>`
      + crit.list.map(k =>
        `<div class="crit-row"><span class="crit-t">${k.title}</span>`
        + `<span class="crit-bar"><i class="${lvl(k.score)}" style="width:${k.score}%"></i></span>`
        + `<span class="crit-s ${lvl(k.score)}">${arNum(k.score)}</span></div>`).join('');
  }

  const prio = crit.priority.length
    ? [`أولوية الإصلاح (الأول أولاً): ${crit.priority.map(k => `${k.title} ${arNum(k.score)}`).join(' · ')}`]
    : [];
  $('critique').innerHTML = prio.concat(critique(report, plan))
    .map(t => `<li>${t}</li>`).join('');

  const list = [];
  for (const i of report.issues) {
    const sev = isNote(i) ? 'NOTE' : i.severity;
    list.push(`<div class="issue ${sev}"><span class="tag">${sev}</span><div class="msg">${i.message}<small>${i.hint || ''}</small></div></div>`);
  }
  if (!list.length) list.push('<div class="issue PASS"><span class="tag">PASS</span><div class="msg">لا عيوب قابلة للقياس — التصميم يمرّ كل الفحوص الموضوعية</div></div>');
  $('issues').innerHTML = list.join('');

  $('planJson').textContent = JSON.stringify(plan, null, 2);

  $('attempts').innerHTML = history.map(h => {
    const cls = (h.result || '').startsWith('CLEAN') ? 'clean' : (h.result === 'MAX_RETRIES' ? 'fail' : 'warn');
    const label = (h.result || '—').replace(' · notes', ' · ملاحظات');
    const fixes = h.fixes && h.fixes.length ? ` · ${h.fixes.length} إصلاح` : '';
    return `<span class="attempt ${cls}">المحاولة ${arNum(h.attempt)}: ${label}${fixes}</span>`;
  }).join('');

  renderOverlay(res);
}

async function generate() {
  if (busy) { pending = true; return; }   // never drop a user change mid-render
  busy = true;
  $('generate').disabled = true;
  $('generate').textContent = 'جارٍ التوليد…';
  try {
    /* local Google font: register + base64 it before any render (P4) */
    if (typeof ensureLocalFont === 'function') {
      try { await ensureLocalFont(($('font') && $('font').value) || 'Tahoma'); }
      catch { /* system fallback renders */ }
    }
    /* P6: saves made before the resolution check existed — learn their size once */
    if (mediaStore.frame && mediaStore.frame.src && !mediaStore.frame.nw) {
      try { Object.assign(mediaStore.frame, await imgDims(mediaStore.frame.src)); saveMedia(); }
      catch { /* undecodable: the check stays silent rather than guessing */ }
    }
    do {
      pending = false;
      const res = await runLoop(briefFromUI(), { autoFix: $('autoFix').checked });
      renderUI(res);
    } while (pending);
  } catch (err) {
    $('stageEmpty').textContent = 'تعذّر التوليد: ' + err.message;
    $('stageEmpty').style.display = 'block';
  } finally {
    busy = false;
    $('generate').disabled = false;
    $('generate').textContent = 'ولّد التصميم';
  }
}

const debounced = () => { clearTimeout(timer); timer = setTimeout(generate, 320); };

/* ---- events ---- */
$('generate').addEventListener('click', generate);
['headline', 'subhead', 'cta', 'kicker'].forEach(id => $(id).addEventListener('input', debounced));
$('size').addEventListener('change', generate);
$('primary').addEventListener('input', e => { $('primaryHex').textContent = e.target.value.toUpperCase(); debounced(); });
$('secondary').addEventListener('input', e => { $('secondaryHex').textContent = e.target.value.toUpperCase(); debounced(); });
$('bleed').addEventListener('change', generate);
$('autoFix').addEventListener('change', generate);
$('decor').addEventListener('change', generate);
$('weight').addEventListener('change', generate);
$('grain').addEventListener('change', generate);
/* rhythm + typeface: designer-level controls */
if ($('spacing')) $('spacing').addEventListener('input', () => {
  $('spacingVal').textContent = arNum($('spacing').value) + '٪';
  debounced();
});
if ($('font')) $('font').addEventListener('change', generate);
if ($('shape')) $('shape').addEventListener('change', generate);
if ($('genre')) $('genre').addEventListener('change', () => {
  /* a genre owns its composition, decoration, accent treatment and size */
  const g = DESIGN_GENRES.find(x => x.id === $('genre').value);
  if (g) {
    composition = g.composition;
    $('decor').value = g.decor;
    accentMode = g.accent;
    $('weight').value = g.weight;
    if (g.size && [...$('size').options].some(o => o.value === g.size)) $('size').value = g.size;
    document.querySelectorAll('.segmented[data-group="composition"] button')
      .forEach(b => b.classList.toggle('on', b.dataset.comp === g.composition));
    document.querySelectorAll('.segmented[data-group="accent"] button')
      .forEach(b => b.classList.toggle('on', b.dataset.accent === g.accent));
  }
  generate();
});

function segmented(group, datasetKey, setter) {
  document.querySelectorAll(`.segmented[data-group="${group}"] button`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`.segmented[data-group="${group}"] button`).forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      setter(btn.dataset[datasetKey]);
      generate();
    });
  });
}
segmented('style', 'style', v => { style = v; });
segmented('composition', 'comp', v => { composition = v; });
segmented('accent', 'accent', v => { accentMode = v; });
segmented('harmony', 'harmony', v => { harmony = v; });

document.querySelectorAll('.ov').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.overlay;
    overlay[k] = !overlay[k];
    btn.classList.toggle('on', overlay[k]);
    renderOverlay(lastRes);
  });
});

$('download').addEventListener('click', () => {
  if (!lastCanvas || !lastPlan) return;
  const name = `mirsam-${lastPlan.canvas[0]}x${lastPlan.canvas[1]}-${Date.now()}.png`;
  lastCanvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
});

$('downloadSvg').addEventListener('click', () => {
  if (!lastPlan) return;
  const svg = renderSVG(lastPlan);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mirsam-${lastPlan.canvas[0]}x${lastPlan.canvas[1]}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$('copyPlan').addEventListener('click', async () => {
  if (!lastPlan) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastPlan, null, 2));
    $('copyPlan').textContent = 'تم النسخ ✓';
    setTimeout(() => $('copyPlan').textContent = 'نسخ الخطة', 1400);
  } catch { /* clipboard blocked */ }
});

/* ---- presets ---- */
const PRESETS = {
  bold: {
    headline: 'ابدأ رحلتك', subhead: 'منصّة تصميم ذكية للجميع', cta: '', kicker: 'مِرسم ٢٠٢٦',
    style: 'bold', primary: '#0B3D5C', secondary: '#F4A417',
    composition: 'stack', decor: 'dots', accent: 'solid', harmony: 'manual',
    genre: 'social-post', shape: 'soft'
  },
  light: {
    headline: 'هدوء بصري', subhead: 'مساحة بيضاء مقصودة، وتسلسل واضح', cta: '', kicker: 'تحرير',
    style: 'light', primary: '#0B3D5C', secondary: '#C2410C',
    composition: 'editorial', decor: 'rule', accent: 'solid', harmony: 'manual',
    genre: 'event', shape: 'sharp'
  },
  cta: {
    headline: 'عرض محدود', subhead: 'خصم حتى ٥٠٪ لفترة قصيرة', cta: 'اطلب الآن', kicker: 'لفترة محدودة',
    style: 'bold', primary: '#3B1E54', secondary: '#F2B705',
    composition: 'split', decor: 'arcs', accent: 'gradient', harmony: 'manual',
    genre: 'product-ad', shape: 'organic'
  },
  vary: null
};

function applyPreset(p) {
  $('headline').value = p.headline;
  $('subhead').value = p.subhead;
  $('cta').value = p.cta;
  $('kicker').value = p.kicker || '';
  $('primary').value = p.primary; $('primaryHex').textContent = p.primary.toUpperCase();
  $('secondary').value = p.secondary; $('secondaryHex').textContent = p.secondary.toUpperCase();
  $('decor').value = p.decor || 'none';
  if ($('genre')) $('genre').value = p.genre || 'social-post';
  if ($('shape')) $('shape').value = p.shape || 'soft';
  document.querySelectorAll('.segmented[data-group="style"] button').forEach(b => b.classList.toggle('on', b.dataset.style === p.style));
  document.querySelectorAll('.segmented[data-group="composition"] button').forEach(b => b.classList.toggle('on', b.dataset.comp === p.composition));
  document.querySelectorAll('.segmented[data-group="accent"] button').forEach(b => b.classList.toggle('on', b.dataset.accent === p.accent));
  document.querySelectorAll('.segmented[data-group="harmony"] button').forEach(b => b.classList.toggle('on', b.dataset.harmony === p.harmony));
  style = p.style; composition = p.composition; accentMode = p.accent; harmony = p.harmony;
  generate();
}

document.querySelectorAll('.chip[data-preset]').forEach(chip => {
  chip.addEventListener('click', () => {
    const key = chip.dataset.preset;
    if (key !== 'vary') return applyPreset(PRESETS[key]);

    /* vary: fresh combinations — genre first, then controlled randomisation */
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const g = pick(DESIGN_GENRES);
    applyPreset({
      headline: $('headline').value, subhead: $('subhead').value, cta: $('cta').value,
      kicker: $('kicker').value,
      style: Math.random() < 0.3 ? (style === 'bold' ? 'light' : 'bold') : style,
      primary: $('primary').value, secondary: $('secondary').value,
      composition: g.composition,
      decor: Math.random() < 0.6 ? g.decor : pick(['none', 'circle', 'arcs', 'dots', 'rule']),
      accent: Math.random() < 0.4 ? 'gradient' : g.accent,
      harmony: pick(['manual', 'complement', 'analogous']),
      genre: g.id, shape: pick(DESIGN_SHAPES).id
    });
  });
});

/* ---- boot (B12) ----
   fonts.ready can settle before DOMContentLoaded; wait for BOTH, and never
   double-generate if a module already produced a first design. */
function bootGenerate() {
  if (lastPlan || busy) return;
  generate();
}
function bootStart() {
  const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
  fontsReady.then(bootGenerate, bootGenerate);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootStart, { once: true });
} else {
  bootStart();
}
