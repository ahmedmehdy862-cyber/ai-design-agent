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
  const textW = comp === 'split' ? W - Math.round(W * 0.34) - m * 2 : W - m * 2;

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

  /* ---- decoration ---- */
  elements.push(...decor(b.decor, decorAnchor));

  /* ---- kicker + rule ---- */
  const right = W - m;
  if (b.kicker && !genre.badge) {
    elements.push({
      role: 'kicker', kind: 'type', x: right, y: m + kickerPt, text: b.kicker,
      align: 'right', font: b.font, size: kickerPt, color: accent,
      weight: 700, leading: Math.round(kickerPt * 1.4)
    });
    elements.push({
      role: 'kicker-rule', kind: 'line',
      x1: right - Math.round(W * 0.12), y1: m + kickerPt + Math.round(kickerPt * 0.7),
      x2: right, y2: m + kickerPt + Math.round(kickerPt * 0.7),
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
  if (b.cta) {
    const chipH = Math.round(ctaPt * 2.6);
    const chipW = Math.round(Math.min(W * 0.40, textW));
    const chipY = comp === 'split' ? H - m - chipH : H - m - chipH;
    elements.push({
      role: 'cta-chip', kind: 'roundedRect', rect: [right - chipW, chipY, chipW, chipH],
      radii: shapeRadius(shapeId, chipH), fill: accent, bleed: false,
      grad: b.accentMode === 'gradient' ? [accent, accent2] : null
    });
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

  let itemLead = 0, itemSize = 0;
  if (b.items && b.items.length) {
    const itemPt = even(clamp(subPt * 0.95, 15, 36));
    itemSize = itemPt;
    itemLead = Math.round(itemPt * 1.95 * sp);
    b.items.slice(0, 5).forEach((it, i) => {
      elements.push({
        role: 'item', kind: 'type', x: right, y: cursor + i * itemLead, text: '•  ' + it,
        align: 'right', font: b.font, size: itemPt,
        color: contrast(ink, bg) >= 4.5 ? ink : readableInk(bg), weight: 400,
        opacity: 0.92, leading: itemLead, maxW: textW
      });
    });
    cursor += b.items.length * itemLead;
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
      b.grain ? 'طبقة تشطيب: حبيبات ٣٪ بعد القياس (لا تغيّر القرار)' : 'بدون طبقة تشطيب — SVG نظيف'
    ]
  };
}

/* =========================================================================
   element overrides — per-element designer edits
   key: el.key  ·  value: { color, opacity, sizeF, weight, align, hidden }
   Applied on every plan build, so edits survive regeneration and QA fixes.
   ========================================================================= */
function applyOverrides(list) {
  for (const el of list) {
    if (!el.base) {
      el.base = {
        size: el.size || 0,
        leading: el.leading || 0,
        weight: el.weight || 0,
        opacity: el.opacity != null ? el.opacity : null
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

/* ---------------- text wrap ---------------- */
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
function wrapLines(text, maxW, font, size, weight) {
  if (!text) return [];
  measureCtx.font = `${weight} ${size}px ${font}, "Segoe UI", Arial, sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && measureCtx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

/* ---------------- renderer (SVG) ---------------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderSVG(plan, opts = {}) {
  const [W, H] = plan.canvas, p = plan.palette;
  const margin = plan.grid.margin;
  let defs = '', body = '';
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
    } else if (el.kind === 'type') {
      const maxW = el.maxW || (W - margin * 2);
      const lines = wrapLines(el.text, maxW, el.font, el.size, el.weight);
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
        + ` font-family="${esc(el.font)}, 'Segoe UI', Tahoma, Arial, sans-serif"`
        + ` font-size="${el.size}" font-weight="${el.weight}" fill="${el.color}"${op}>`;
      lines.forEach((ln, k) => {
        body += `<tspan x="${el.x}" dy="${k === 0 ? 0 : el.leading}">${esc(ln)}</tspan>`;
      });
      body += '</text>';
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
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

  for (const issue of issues) {
    if (issue.id === 'edge-spill') {
      let moved = 0;
      for (const el of plan.elements) {
        if (el.bleed) continue;
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
      fixes.push({ issue: issue.id, action: `سحب ${moved} عنصرًا إلى المنطقة الآمنة` });
    } else if (issue.id === 'clutter') {
      const band = find('accent-band');
      if (band) { const [x, y, w, h] = band.rect; const nh = Math.max(24, Math.round(h * 0.6)); band.rect = [x, H - nh, w, nh]; }
      const decoEl = find('focal-deco');
      if (decoEl && decoEl.rect) { const [x, y, w, h] = decoEl.rect; const n = Math.max(40, Math.round(w * 0.7)); decoEl.rect = [x, y, n, n]; }
      fixes.push({ issue: issue.id, action: 'تصغير الشريط/الزخرفة لاستعادة المساحة السالبة' });
    } else if (issue.id === 'low-contrast') {
      const bg = plan.palette.bg, better = readableInk(bg);
      for (const role of ['headline', 'subhead', 'cta-text']) {
        const el = find(role);
        if (el && contrast(el.color, bg) < 4.5) { el.color = better; fixes.push({ issue: issue.id, action: `${role} → ${better}` }); }
      }
    } else if (issue.id === 'focal-ambiguity') {
      const he = find('headline');
      if (he) { he.size = Math.round(he.size * 1.15); he.leading = Math.round(he.size * 1.34); }
      const decoEl = find('focal-deco');
      if (decoEl && decoEl.rect) { const [x, y, w, h] = decoEl.rect; decoEl.rect = [x, y, Math.round(w * 0.8), Math.round(h * 0.8)]; }
      fixes.push({ issue: issue.id, action: 'تكبير العنوان 15% وتصغير الزخرفة 20%' });
    } else if (issue.id === 'weak-hierarchy') {
      const he = find('headline');
      if (he) {
        const before = he.size;
        he.size = Math.round(he.size * 1.12);
        he.leading = Math.round(he.size * 1.34);
        fixes.push({ issue: issue.id, action: `عنوان ${before} → ${he.size}px` });
      }
    } else if (issue.id === 'palette-creep') {
      fixes.push({ issue: issue.id, action: 'إعادة حصر الألوان في أدوار الباليتة' });
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
    const FIXABLE = new Set(['low-contrast', 'clutter', 'focal-ambiguity', 'weak-hierarchy', 'edge-spill', 'blank']);
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

  $('critique').innerHTML = critique(report, plan)
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
