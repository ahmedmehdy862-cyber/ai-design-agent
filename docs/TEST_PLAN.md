# Test Plan — AI Design Agent

Status legend (per spec §20):
**PASS** · **FAIL** · **BLOCKED** · **NOT RUN** · **MOCKED**

## Environment foundation (Phase 1)
| # | Test | Status | Evidence |
|---|---|---|---|
| E1 | OS / CPU / RAM / disk inspection | PASS | `docs/COMPATIBILITY.md` |
| E2 | Toolchain versions (Python/Node/npm/Git) | PASS | version commands executed 2026-10-29 |
| E3 | Photoshop / Illustrator install verification | PASS | registry + exe paths + versions |
| E4 | Arabic font cmap verification | PASS | GlyphTypeface U+0627 present: Segoe UI, Tahoma, Arial, Traditional Arabic |
| E5 | Craft suite discovery (Vector/Film/Effect/Design/Pdf/Sound) | PASS | install logs + `--help` runs |

## MCP integration (Phase 3 — PhotoCraft)
| # | Test | Status | Evidence |
|---|---|---|---|
| M1 | `photocraft-cli mcp` stdio `initialize` | PASS | serverInfo `photocraft 0.15.1`, resources+tools capabilities |
| M2 | `tools/list` discovery | PASS | 22 tools with full JSON schemas |
| M3 | Registration in OpenCode + live connection | PASS | `~/.config/opencode/opencode.jsonc`; server connected, 25 tools exposed |
| M4 | Connection failure handling | **PASS** | 2026-10-30: 7 scenarios — unknown subcommand (exit 1 + usage), nonexistent file (os error 3), out-of-format file (exit 1 + formats hint), malformed params JSON (exit 2 + column), unknown command id (exit 1), job kill mid-flight (session survives), MCP stdio garbage -> JSON-RPC -32700 parse error + -32602 tool-not-found (server never crashes silently) |
| M5 | Bridge mode (`photocraft --control`) | **PASS** | 2026-10-30: app launched `--control 8765 --control-token <64hex>`; `mcp --bridge` handshake OK; `ui_inspect` returned live UI state (brush, dock, dialogs); wrong token -> tool call `isError: true` "authentication required". Note: `initialize` is answered locally by the CLI even with a bad token; enforcement happens at bridge call level |

## End-to-end acceptance (Phase 8 §21)
| # | Requirement | Status | Evidence |
|---|---|---|---|
| A1 | Canvas 1080 × 1350 | PASS | `doc_new` {w,h}; ImageMagick info → `1080x1350` |
| A2 | One background | PASS | layer id 2 `Background`, bounds [0,0,1080,1350], fill `#0b3d5c` |
| A3 | One headline | PASS | layer 4 `headline`, Type, Tahoma 96pt, "فتح باب التسجيل", bounds y=120 |
| A4 | One secondary text | PASS | layer 5 `secondary`, Tahoma 48pt, bounds y=890 |
| A5 | One basic graphic shape | PASS | layer 6 `accent-shape` ellipse (+ `accent-band` rect) |
| A6 | Correctly positioned elements | PASS | reported bounds inside canvas; preview shows expected layout |
| A7 | Editable source file | PASS | `workspace/working/acceptance-test01.pcraft` (111,644 B) reopens via `photocraft-cli info` with full layer tree (5 layers: Pixel/Shape/Type) |
| A8 | Valid PNG export | PASS | `workspace/exports/acceptance-test01.png` (34,533 B), decode OK, sRGB 8-bit |
| A9 | Visible preview | PASS | `doc_render_preview` rendered and reviewed |
| A10 | Technical QA report | PASS | dimensions/format/existence/decode/not-blank: dominant colors `#0B3D5C`, `#F4A417` ≠ blank canvas |

Run date: 2026-10-30 · Executor: OpenCode SPA session · Tool: MCP over stdio (headless)

## Next tests (in priority order)
| # | Test | Status |
|---|---|---|
| N1 | Photoshop smoke test via COM + JSX (health, doc, text, shapes, PSD save, PNG export) | **PASS** | 2026-10-30: `DoJavaScriptFile` ran `tests/integration/smoke-photoshop.jsx` -> `workspace/working/smoke-photoshop.psd` (295,513 B, 4 layers, 1080x1350) + `workspace/exports/smoke-photoshop.png` (verified decode + colors #0B3D5C/#F4A417/#FEFEFE). Limitation: `TextItem.color` throws error 1200 in PS 26 — text kept default black, contrast achieved with design (white chip). DialogModes.NO used; test docs closed without saving (user detached `Untitled-1` left untouched) |
| N2 | Illustrator smoke test via COM + JSX (artboard, shapes, Arabic text, AI save, PNG export) | **PASS** | 2026-10-30: `smoke-illustrator.jsx` -> `smoke-illustrator.ai` (240,339 B, pdfCompatible) + `smoke-illustrator.png` (1,080x1350, colors verified, Arabic renders correctly). Limitation: `PNGExportOptions` has no constructor in AI 29 — `exportFile(path, ExportType.PNG24)` without options works |
| N3 | VectorCraft MCP registration + connection test | **PASS** | stdio handshake `serverInfo vectorcraft 0.16.0`, tools/list OK with `--headless --automation-read/write-root`; registered in opencode.jsonc; **32 tools connected** |
| N4 | FilmCraft MCP registration + connection test | **PASS** | stdio handshake `serverInfo filmcraft 0.12.0`, tools/list OK; registered; **17 tools connected**. No `--automation-*-root` flags exist in this CLI (confinement limitation documented in COMPATIBILITY) |
| N5 | EffectCraft MCP registration + connection test | **PASS** | stdio handshake `serverInfo effectcraft 0.16.0`, tools/list OK with roots flags; registered; **27 tools connected** |
| N6 | MCP failure/cancellation behaviour (M4) | **PASS** | merged into M4 row (7 failure scenarios). CLI exit codes: 1 = runtime/unknown-id, 2 = usage/parse. Errors go to stderr with actionable hints |
| N7 | Unit tests for the visual QA engine (contrast, hues, blank, size, good-passes, ambiguity, dense-spill) | **PASS (7/7)** | 2026-10-30: `python -m unittest discover tests/unit` -> OK. Engine hardened during tests: histogram format `-format %c histogram:info:-`, single-channel (grayscale) `txt:-` parsing accepted, gradient-based dense-image fixture |

## Phase 6-7 (design planner + production + correction loop)
| # | Test | Status | Evidence |
|---|---|---|---|
| P1 | Planner emits measurable plan (grid/margins/type-scale/focal/RTL/60-30-10) | PASS | 2026-10-30: `app/planner/planner.py`; every number carries a rationale citing DESIGN_PRINCIPLES section; margins snapped to spacing scale |
| P2 | Producer executes plan headless via `photocraft-cli run` | PASS | `app/pipeline/producer.py`; single process call -> editable .pcraft + PNG export; per-command JSON captured |
| P3 | Correction loop (produce -> measure -> targeted fix -> re-measure) | PASS | `app/pipeline/loop.py`; fixes cite issue ids; stops CLEAN / MAX_RETRIES / UNIMPROVABLE; no blind regeneration |
| P4 | Full pipeline on 3 real Arabic briefs (bold / light / cta) | PASS | final-bold, final-light, final-cta: all CLEAN on attempt 1; contrast 5.6-11.5:1; only residual WARN is the documented full-bleed accent band |
| P5 | QA engine hardened during Phase 7 | PASS | contrast metric now bg-vs-ink (text proxy), quantized palette for ink grouping, float-RGB histogram parsing; blankness still uses raw count |
| P6 | Planner unit tests (8 cases) | PASS | `tests/unit/test_planner.py`: WCAG on headline, RTL anchoring, focal y-range, <=3 type sizes, accent reserved to CTA/band/deco, light-style compliance |

Run date: 2026-10-30 — all phases (1,3,4,5,6,7,8) + M1-M5 + N1-N7: **PASS**

---

## اختبارات الواجهة الجديدة — ٥ نوفمبر ٢٠٢٦

كل ما يلي نُفِّذ فعليًا في متصفح (Edge) على `http://127.0.0.1:8137/`، عبر قراءة DOM وخطة التصميم، لا بادّعاء:

| # | ماذا يُختبر | كيف يُقاس | النتيجة |
|---|---|---|---|
| 1 | فاحص الطبقات | عدد صفوف `#layers .layer` | ١٤ صفًّا لكل عنصر الخطة |
| 2 | لون/شفافية لكل عنصر | تغيير `headline` إلى `#FF00AA` و٥٥٪ ثم تبديل النوع لـ`event` | القيم باقية بعد إعادة التوليد (`meta.edited = 1`) |
| 3 | المسافة بين النصوص | منزلق ١٠٠٪ → ٢٠٠٪ | إحداثي النص الثانوي ٧٢٠ → ٧٧٦ · `meta.spacing = 200` · التسمية «٢٠٠٪» |
| 4 | الخط | `Tahoma` → `Segoe UI` | `meta.font` والعنوان: `Segoe UI` |
| 5 | المعرفة تُطبَّق | `plan.knowledgeApplied` + بطاقة النقد | «الإيقاع والشبكة: صُحّح خط أساس إلى شبكة ٤px» |
| 6 | المراجع تُنتِج | وصف «فاخر… ملكي» | مرجع «فخم ليلي»: خلفية `#0E1218` + لمسة `#D4AF37` ومرشَّح في «ما فهمته» |
| 7 | كاروسيل | زر «قسّم الوصف» | ٤ شرائح + ٤ مصغّرات + تسمية «شريحة ١/٤» ثم التنقّل إلى ٢/٤ |
| 8 | تحويل المقاس | شريحة `1920x1080` | `size = 1920x1080` مع رسالة نجاح |
| 9 | فيديو WebM | زر التصدير | ٠٫٣ ميغابايت · ٤ شرائح · دقة ١٩٢٠×١٠٨٠ (تسجيل حقيقي بـ MediaRecorder) |
| 10 | خطة المحتوى | زر التصدير | `mirsam-content-plan.md` لـ٤ شرائح |
| 11 | اختصارات | `?` ثم `Esc` | فتح ثم إغلاق نافذة الاختصارات |
| 12 | تحديد بالنقر | نقر داخل المعاينة | «محدَّد: العنوان الرئيسي» + صف مضيء |
| 13 | صحة الطرفية | `node --check web/*.js` | ٦/٦ سليمة |
| 14 | اختبارات بايثون | `python -m pytest tests/unit -q` | **15 passed** |
| 15 | أخطاء الكونسول | `browser.console(level=error)` | **صفر** |

ملاحظات صدق:
- مقاييس التباين/الحبر/التوازن تُقرأ من بكسلات المخرج (canvas) لا من الادّعاء.
- التصدير يُنفَّذ فعليًا في المتصفح؛ تنزيلات متعددة قد يحجبها مانع التنزيلات في وضع headless، لذا يُثبت النجاح ببناء الملف وحجمه لا بعدّاد التنزيلات.
- اختبارات Python لا تلمس الواجهة، واختبارات الواجهة لا تُشغَّل في CI (CI يكتفي بالصياغة + بنية HTML).
