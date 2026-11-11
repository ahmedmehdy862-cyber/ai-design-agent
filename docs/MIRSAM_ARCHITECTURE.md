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

## 2. خريطة الوحدات وترتيب التحميل — الملفات العشرة

ثمانية وحدات `js` بترتيب تحميلها الفعلي في `index.html` + ملفا الواجهة:

| # | الملف | الحجم | يُعرِّف | يُغلِّف/يعتمد على |
|---|---|---|---|---|
| 0 | `fonts.js` | 3.8KB | `LOCAL_FONT_DEFS` (Cairo · Tajawal · Almarai · Amiri) · تسجيل `document.fonts` · `fontFaceStyleFor` · تجليد base64 للتصدير | — (يُحمَّل أولًا) |
| 1 | `knowledge.js` | 51KB | `DESIGN_KNOWLEDGE` · `DESIGN_REFS` · `DESIGN_GENRES` · `DESIGN_SHAPES` · `MOOD_RULES` · `parseBriefPrompt` · `AI_PROVIDERS` · `FREEFIELD` · `KNOWLEDGE_APPLIERS` · `applyKnowledge` · بحث المعرفة + مكتبة المراجع + `sendToEngine` | — |
| 2 | `export.js` | 19.6KB | `EXPORT_PROGRAMS` · `EXPORT_GUIDES` · `buildProject` · `buildLayeredSVG` · `exportFlat` · `exportForProgram` · helpers تنزيل | — |
| 3 | `app.js` | 99KB | `makePlan` · `renderSVG` · `typeBBox` · `analyze` · `applyFixes` · `runLoop` · `critique` · `critic` · `renderUI` · `generate` · `overrides` · `applyOverrides` · `pushUndo/undoEdits/redoEdits` · واجهة التحكم | — (قلب النظام) |
| 4 | `carousel.js` | 14.9KB | `slides` · `slideBrief` (+تنويع `composition`) · `autoCarousel` · `renderStrip` · `renderCarInfo` · `IDENTITY` · `exportCarousel` | **يُغلِّف `generate`** |
| 5 | `inspector.js` | 32KB | `layerRow` · `renderLayers` (مقلوبة) · `renderMeasure` · `moveLayer` · `doUndo/doRedo` · `pickElement` · اختصارات (Ctrl+Z/Y) | **يُغلِّف `renderUI`** |
| 6 | `studio.js` | 47KB | تبويبات · `applyBrief` · تحليل محلي AI · مراجع (Openverse + رفع) · معرفة · تصدير · وسائط · محرّك · WebM | يعتمد على `app.js` |
| 7 | `creative.js` | 34KB | `CR_FIELDS` · `analyzeCreative` (موجز 12 حقلًا) · `CONCEPT_STRATEGIES` (مفاهيم) · `CR_AXES/CR_SCHOOLS` (محاور توجيه تُتبنّى) · `bootCreative` | يعتمد على `knowledge.js` |
| — | `index.html` | 43KB | الهيكل RTL · كل حقول الواجهة · ترتيب تحميل الوحدات · `?v=` الكاش (v20) · لوحة مفاتيح المساعدة | يحمل الوحدات بترتيبها |
| — | `styles.css` + `styles-creative.css` + `styles-knowledge.css` | 37KB | نظام التصميم (متغيرات · RTL · فاحص · كاروسيل · قياسات) | يُطبع فوق الملفات الثلاثة |

> **القاعدة:** وحدة جديدة تُحمَّل **بعد** `app.js` إن احتاجت `makePlan`/`$`/`lastPlan`، وتحافظ على التغليف القائم (`renderUI`/`generate`).
> **لا تحميل كسول:** الحصيلة 381.6KB لـ12 ملفًا (trunk صغير) — التحميل المبكر أرخص من تعقيد التجزئة وترتيب الاعتماديات (قرار موثّق في P8).

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

- المفتاح `el.key` → `{ color, opacity, sizeF, weight, align, hidden, locked, dx, dy, sw, sh }` + مفتاح خاص `__order` (ترتيب z كامل).
- الكتابة: `setOverride()` (الفاحص) · التطبيق: `applyOverrides()` — استدعاء أول داخل `makePlan` وثاني بعد كل إصلاح.
- **الموضع والأبعاد نسبية:** الحقول تُعرض القيمة المطلقة، والتغيير يُخزَّن كإزاحة/مقياس من قاعدة مُخطَّطة `base.pos` — فلا يتضاعف بين الاستدعاءين (idempotent) ويبقى بعد إعادة التوليد.
- **`locked: true`** يمرّر كل فروع `applyFixes` برسالة صادقة — تعديل المصمّم يعلو على الإصلاح الآلي.
- **`__order`** ترتيب z كامل يُطبَّق في نهاية `applyOverrides`؛ المفاتيح الجديدة تأخذ مكانها الطبيعي.
- **الحفظ:** `localStorage['mirsam.overrides']` (يُستعاد بعد تحديث الصفحة — أثر B8).
- **التراجع:** سِجل في الذاكرة 60 خطوة (تجميع 900ms لسحب المؤشر) — `pushUndo` يُدفع من كل تعديل (لون/شفافية/حجم/وزن/محاذاة/إخفاء/موضع/ترتيب/قفل/إعادة ضبط) · `undoEdits/redoEdits` + أزرار ↶↷ + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (لا يعملان أثناء الكتابة). السِجل لا يعيش بعد التحديث عمدًا (التعديلات المحفوظة تبقى وحدها).
- `sizeF` نسبة من `el.base.size` · `hidden` يتجاوزه الراسم · `dx/dy/sw/sh` تُحسب من `base.pos`.

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
