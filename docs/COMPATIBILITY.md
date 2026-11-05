# Compatibility Report — AI Design Agent (Phase 1 Audit)

Date: 2026-10-29
Auditor: OpenCode (read-only inspection; no settings or projects modified)
Method: registry queries (read-only), CLI `--help` / `commands` invocations, font cmap inspection. Nothing was installed, uninstalled, or reconfigured.
Convention: **VERIFIED** = actually executed on this machine. **UNVERIFIED** = present/registered but not yet proven to work.

## Summary Table

| Component | Installed version | Detected path | Verified capabilities | Missing requirements |
|---|---|---|---|---|
| Windows | 10 Pro, build 19045, 64-bit | — | OS inspection | C: drive low on space (10.1 GB free) |
| CPU / RAM | i7-6820HQ (4C/8T @ 2.70 GHz) / 15.9 GB physical | — | WMI read | 16 GB is tight for Photoshop + Illustrator + headless engines together |
| Disks | C: 10.1 GB free · D: 279.2 GB free · E: 209 GB free | — | drive query | Use D: or E: for agent working files and caches |
| OpenCode | 2.1.4 (desktop app) | `C:\Users\Power tech\AppData\Local\Programs\@opencode-aidesktop\OpenCode.exe` | install verified in registry + binary on disk | `opencode` is NOT on PATH; **MCP config is empty** (`%USERPROFILE%\.config\opencode\opencode.jsonc` has only `$schema`) — no MCP servers registered |
| PhotoCraft CLI | 0.15.1 | `C:\Program Files\PhotoCraft\photocraft-cli.exe` | **VERIFIED**: help, command registry, `info`, `select.rect` + `paint.patch` headless run, PNG export | MCP connection from OpenCode UNVERIFIED (not yet registered) |
| PhotoCraft MCP | 0.15.1 | same CLI | `photocraft-cli mcp/serve` subcommands documented with `--bridge`, `--control-token`, `--automation-read-root`/`--automation-write-root` | **VERIFIED**: stdio `initialize` + `tools/list` (22 tools: doc_*, command_*, render_preview, session_list, jobs_*); registered in `~/.config/opencode/opencode.jsonc` with read/write roots scoped to this workspace; connected in OpenCode as 25 tools; **acceptance test PASS** (see Test Log) |
| VectorCraft CLI | 0.16.0 | `C:\Program Files\VectorCraft\vectorcraft-cli.exe` | **VERIFIED**: help + `mcp` headless stdio (roots flags accepted, confinement warning emitted) + `run/--export` | **CONNECTED in OpenCode: 32 tools** (registered 2026-10-30, read/write roots = workspace) |
| FilmCraft CLI | 0.12.0 | `C:\Program Files\FilmCraft\filmcraft-cli.exe` | **VERIFIED**: help; `exec`, `run` (JSONL), `commands`, `describe`, `inspect`, `import` | **CONNECTED in OpenCode: 17 tools**. NOTE: no `--automation-*-root` flags — no per-server file confinement (rely on workspace discipline) |
| EffectCraft CLI | 0.16.0 | `C:\Users\Power tech\Documents\EffectCraft\effectcraft-cli.exe` (MSI per-user) | **VERIFIED**: help; `exec/run/props/get/set/render/render-frame/script` | **CONNECTED in OpenCode: 27 tools** (mcp `--automation-read/write-root` accepted = workspace) |
| Bonus Craft apps | DesignCraft 0.12.0 · PdfCraft 0.13.0 · SoundCraft 0.12.1 | `C:\Program Files\<name>\<name>-cli.exe` | CLI binaries + help flags exist (not exercised in depth) | — |
| ArtCraft Launcher | 0.7.0 | `...\Local\Programs\ArtCraft Launcher\artcraft-launcher.exe` | manages/updates all Craft apps (download logs verified) | — |
| Photoshop | 26.0.0.26 (2025) | `C:\Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe` | **VERIFIED scripting**: COM `Photoshop.Application` + `DoJavaScriptFile` ran the smoke test (doc 1080x1350, layers, PSD save, PNG export) | KNOWN LIMITS: `TextItem.color` broken (error 1200), `foregroundColor` not inherited by new text, `documents.add` 5th arg enum-only (Illustrator) |
| Illustrator | 29.0.1 (2025) | `C:\Program Files\Adobe\Adobe Illustrator 2025\...\Illustrator.exe` | **VERIFIED scripting**: COM `Illustrator.Application` + `DoJavaScriptFile` smoke test (artboard, shapes, Arabic text, AI save, PNG export PASS) | KNOWN LIMITS: `PNGExportOptions` class missing (use `exportFile(file, ExportType.PNG24)` without options), `documents.add` 5th arg enum-only |
| Python / Node.js / npm / Git | 3.14.8 (PATH) + 3.12.10 · 24.21.0 · 11.19.0 · 2.55.0 | Python/Node/Git on PATH | all `--version` calls succeeded | — |
| MCP client config | none | `%USERPROFILE%\.config\opencode\opencode.jsonc` | file read | Register `photocraft-cli mcp` (+ optionally vectorcraft/filmcraft/effectcraft MCps) |
| Arabic typography | system fonts | `C:\Windows\Fonts` | **VERIFIED Arabic cmap support** (U+0627) in Tahoma, Arial, Segoe UI, Traditional Arabic | No Arabic-specific web fonts installed system-wide (Cairo, Amiri, Noto Arabic are installed only inside VectorCraft's bundle, licensed copies at `C:\Program Files\VectorCraft\OFL-noto-sans-arabic.txt`) |

## Compatibility Gate Notes

1. **PhotoCraft MCP** — PASS (stdio). Registered with `--automation-read-root` / `--automation-write-root` = the workspace folder, so every file path must be relative to it; no absolute-path escape. **Bridge mode still UNVERIFIED** (needs `photocraft.exe --control <port>` running; ui_* tools unavailable until then).
2. **Do not assume Photoshop/AI automation works on the strength of being installed.** A minimal UXP/JSX smoke test is still required (Gate 5 of the spec). Photoshop 26.0 (2025) supports UXP; legacy JSX is deprecated — prefer UXP, verify with a 5-line script.
3. **EffectCraft install path is per-user** (`Documents\EffectCraft`), unlike the other Craft apps in Program Files. Access-control rules must include this folder.
4. **Disk pressure**: C: has 10.1 GB free; all agent working files, droplets, previews and caches should live on D: or E:.
5. **Concurrency**: each Craft app has its own headless engine + bridge port (`vectorcraft --control 7979` style). Do not run two sessions against the same document.

## Prioritized Implementation Plan (post-audit)
0. ✅ Phase 1 audit — this document.
1. ✅ Register PhotoCraft MCP in OpenCode config and run the smallest connection test (list tools, inspect a document) — PASS, 2026-10-30.
2. ✅ PhotoCraft smoke test: new document 1080×1350 → text layer + shapes → save `.pcraft` → export PNG → verify dimensions — PASS, see `TEST_PLAN.md` (A1–A10).
3. Photoshop UXP smoke test (health check, test doc, text layer, PSD save, PNG export).
4. Illustrator JSX smoke test (same set, AI save + PNG export).
5. Register second engine adapters (VectorCraft/FilmCraft/EffectCraft) only after 1–4 pass.

## Security Notes
- Read-only audit; no secrets exposed. Registry `UninstallString` values and automation tokens were not collected or logged.
- All local control services still default to loopback binding when registered.
| PhotoCraft CLI (headless run) | 0.15.1 | `photocraft-cli run --new --cmd ... --out` + `convert` | **VERIFIED 2026-10-30**: full pipeline (plan -> .pcraft -> PNG) in one process call; no MCP round-trip needed for batch production | used by app/pipeline/producer.py |

---

## صيغ جديدة — استوديو ميديا وفاحص العناصر (نوفمبر ٢٠٢٦)

| الصيغة | الملف | قابلية التعديل | أين تعمل | ملاحظة |
|---|---|---|---|---|
| فيديو | `mirsam-media.webm` (VP9/VP8) | غير قابل للتحرير الخطي | Chrome · Edge · Firefox | يُسجَّل بالوقت الفعلي من المتصفح (`MediaRecorder` + `canvas.captureStream`) بمقدّم ثابت وتلاشٍ بين الشرائح بالدقة الكاملة. لا يعمل في متصفح بلا `MediaRecorder`. |
| كاروسيل | `mirsam-carousel-01..N.png` + `mirsam-carousel.json` | النصوص من الـmanifest | أي منصة متعددة الصور | كل PNG بنفس المقاس؛ الـJSON يوثّق الترتيب والنصوص. |
| خطة محتوى | `mirsam-content-plan.md` | نص خام | أي محرّر / Notion | جاهز للنشر: عنوان + ثانوي + زر لكل شريحة. |
| تعديل عنصر | عبر الفاحص في الصفحة | كامل داخل التطبيق | متصفح | اللون/الشفافية/الحجم/الوزن/المحاذاة/الإخفاء تُخزَّن كـ overrides وتُعاد على كل خطة — تبقى بعد التوليد والتصحيح. |
| تحويل مقاس | نفس المحتوى بمقاس آخر | إعادة تخطيط | كل المقاسات الخمسة | تغيير النسبة يعيد حساب التخطيط، لا ببساطة تمديد الصورة. |

سلوك موثّق:
- **قواعد المعرفة تُعدّل الخطة قبل القياس** (تسلسل ≥١٫٦×، تباين ≥٤٫٥:١، منصّات ٤px، تباعد أسطر ١٫٢–١٫٧، منطقة آمنة) ويُسرد أثرها في `plan.knowledgeApplied` وفي بطاقة النقد.
- **ترتيب تطبيق التعديلات**: خطة ← معرفة ← overrides المصمّم (الأعلى أولًا) ← تقييم ← تصحيح ← معرفة ← overrides.
- **مراجع الإخراج** تُستمد من الوصف أولًا، وقواعد المزاج تحتفظ بألوانها إذا حدّدت لونًا صريحًا.
- الصفات الجديدة تظهر أيضًا في `mirsam-project.json` (`meta.font` · `meta.spacing` · `meta.edited` · `frames.slides`).
