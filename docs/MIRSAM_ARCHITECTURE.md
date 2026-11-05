# MIRSAM_ARCHITECTURE — بنية النظام

## 1. المبدأ الحاكم

**مخرج قابل للقياس لا صورة مولَّدة.** كل تصميم = `plan` (كائن بيانات) → SVG → canvas → قياس بكسل حقيقي → إصلاح مستهدف → عرض/تصدير. القياس موضوعي، والذوق ملاحظة معلَّمة `NOTE`.

```
brief ──► makePlan ──► applyKnowledge ──► applyOverrides ──► renderSVG ──► svgToCanvas
            ▲                │                  │                │            │
            │                ▼                  ▼                │            ▼
            └────── applyFixes ◄── analyze ◄────┴────────────────┴──── finish(grain)
                        │                                              │
                        └── (حتى 3 محاولات)                            ▼
                                                                       renderUI ──► DOM
```

**ترتيب التطبيق (حاسم):** خطة ← معرفة ← **تعديلات المصمّم (الأعلى)** ← قياس ← تصحيح ← معرفة ← تعديلات.

## 2. خريطة الوحدات وترتيب التحميل

| # | الملف | يُعرِّف | يُغلِّف/يعتمد على |
|---|---|---|---|
| 1 | `knowledge.js` | `DESIGN_KNOWLEDGE` · `DESIGN_REFS` · `DESIGN_GENRES` · `DESIGN_SHAPES` · `MOOD_RULES` · `parseBriefPrompt` · `AI_PROVIDERS` · `FREEFIELD` · `KNOWLEDGE_APPLIERS` · `applyKnowledge` | — |
| 2 | `export.js` | `EXPORT_PROGRAMS` · `EXPORT_GUIDES` · `buildProject` · `buildLayeredSVG` · `exportFlat` · `exportForProgram` · helpers تنزيل | — |
| 3 | `app.js` | `makePlan` · `renderSVG` · `analyze` · `applyFixes` · `runLoop` · `renderUI` · `generate` · `overrides` · `applyOverrides` · واجهة التحكم | — |
| 4 | `carousel.js` | `slides` · `autoCarousel` · `renderStrip` · `exportCarousel` | **يُغلِّف `generate`** |
| 5 | `inspector.js` | `layerRow` · `renderLayers` · `pickElement` · اختصارات | **يُغلِّف `renderUI`** |
| 6 | `studio.js` | تبويبات · `applyBrief` · تحليل محل AI · مراجع · معرفة · تصدير · وسائط · محرّك | يعتمد على `app.js` |

> وحدة جديدة تُحمَّل **بعد** `app.js` إن احتاجت `makePlan`/`$`/`lastPlan`، وتحافظ على التغليف القائم.

## 3. مخطط الخطة (مصدر الحقيقة الوحيد)

```js
plan = {
  brief:      { headline, subhead, cta, kicker, style },
  canvas:     [W, H],
  palette:    { bg, ink, accent, accent2, surface, headline },
  meta:       { composition, decor, accentMode, weight, harmony, grain, bleed,
                genre, genreName, shape, date, items, font, spacing, edited },
  grid:       { margin },                 // baseline/columns توثيقيان
  focal:      { x, y, element },
  typeScale:  [ [role, pt], … ],
  elements:   [ … ],                      // أدناه
  rationale:  [ "سطر عربي يفسّر قرارًا" ],
  knowledgeApplied: [ "«المبدأ» ما تغيّر فعلًا" ]
}
```

**عناصر `elements[]` — الأنواع السبعة:** `rect · roundedRect · ellipse · ring · line · outline · type`

| الخاصية | تُستخدم في |
|---|---|
| `key` = `role` أو `role#N` | كل العنصر — **مفتاح التعديلات** |
| `rect:[x,y,w,h]` (+`rx`/`radii`) | rect · roundedRect · ellipse · outline |
| `fill` · `grad:[c1,c2]` · `stroke` · `width`/`strokeWidth` | الأشكال والخطوط |
| `cx,cy,r` · `x1,y1,x2,y2` | ring · line |
| `x,y,text,align,font,size,color,weight,leading,maxW` | type |
| `opacity` · `shadow` · `bleed` · `hidden` · `base` | عام/نص |

**الأدوار:** `accent-panel · accent-band · focal-deco · kicker · kicker-rule · headline · subhead · cta-chip · cta-text · quote-mark · date · item · badge · badge-text · trim-frame`

**لا يوجد `frames` في الخطة** — يُبنى فقط في `buildProject()` للتصدير `{width,height,fps,durationFrames,slides,safeAreaPx,colorSpace}`.

## 4. نظام التعديلات (Overrides)

- المفتاح `el.key` → `{ color, opacity, sizeF, weight, align, hidden, x?, y?, z? }`.
- الكتابة: `setOverride()` (فاحص) · التطبيق: `applyOverrides()` داخل `makePlan` وبعد كل إصلاح.
- **الحفظ:** `localStorage['mirsam.overrides']` (يُستعاد بعد تحديث الصفحة).
- `sizeF` نسبة من `el.base.size`؛ `hidden` يتجاوزه الراسم.

## 5. طبقات التغذية البصرية (`overlay`)

`focal · edge · grid · safe · heat` — تُرسم في `#overlay` فوق المعاينة من نتائج `analyze` (`heat[16×16]`, `spill[]`, `plan.focal`, هامش 4%).

## 6. حدود النشر

```
[المتصفح] ── كل شيء: تحليل · مخطّط · رسم · قياس · إصلاح · تصدير
   │
   ├── اختياري: مزوّد نصّي (gemini/openai/custom) — مفتاح في localStorage
   ├── اختياري: محرّك صور (freefield/ComfyUI) — نقطة نهاية + رمز
   └── اختياري: مراجع خارجية (GitHub API · Iconify · Openverse · Google Fonts)

[Vercel] = ملفات ثابتة فقط (outputDirectory: web) — لا خادم، لا serverless.
[بايثون] = خط أنابيب مرجعي مستقل (planner + QA عبر ImageMagick) — لا يُنشر.
```

## 7. نقاط التوسّع المعتمدة

1. **إضافة معرفة:** أضف عنصرًا إلى `DESIGN_KNOWLEDGE` أو مُطبِّقًا إلى `KNOWLEDGE_APPLIERS` (`{id, principle, rule, apply(plan)→msg|null}`).
2. **إضافة مرجع:** عنصر في `DESIGN_REFS` بـ `{id,name,desc,patch,rationale}` + قاعدة `REF_RULES`.
3. **إضافة نوع تصميم:** عنصر في `DESIGN_GENRES` (له بنية layout مميّزة).
4. **إضافة برنامج تصدير:** عنصر في `EXPORT_PROGRAMS` + نص في `EXPORT_GUIDES`.
5. **إضافة معيار نقد:** دالة في `critique()` أو قاعدة في `analyze()` بإصدار `issue` جديد.

## 8. المحرّك البايثوني (مرجعي، مستقل)

`planner.py` (مخطّط بـ `Brief` dataclass) → `photocraft-cli` (رسم) → `qa.py` (قياس ImageMagick حقيقي: percentiles 2%/98%) → `loop.py` (تصحيح حتى N). نفس مفردات العيوب وثوابت `DESIGN_PRINCIPLES.md`، **لكن بترتيبات مخزَّنة منفصلة** — انزلاق موثَّق في `TECHNICAL_RISKS.md`.
