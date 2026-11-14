# mirsam-bridge — جسر PSD المحلي

يكتب تصميمك من المتصفح إلى **ملف PSD بطبقات على القرص**، ثم يمكنك فتحه في
Photoshop أو PhotoCraft. اختياري تمامًا: التطبيق يعمل كله بدونه.

## التشغيل

```powershell
node bridge/mirsam-bridge.js
```

يطبع عند التشغيل: العنوان · **الرمز** · مجلد المخرجات · الأصول المسموحة.
انسخ الرمز إلى حقل «رمز الجسر» في لوحة «جسر سطح المكتب» ثم اضغط
«حفظ PSD على القرص».

متغيّرات البيئة (كلها اختيارية):

| المتغير | الافتراضي | المعنى |
|---|---|---|
| `MIRSAM_BRIDGE_PORT` | `8731` | المنفذ على 127.0.0.1 |
| `MIRSAM_BRIDGE_TOKEN` | يُولَّد لكل تشغيل | الرمز المشترك |
| `MIRSAM_BRIDGE_OUT` | `bridge/out` | مجلد الكتابة |
| `MIRSAM_BRIDGE_MAX_BODY` | `100663296` (96MB) | حدّ جسم الطلب |
| `MIRSAM_BRIDGE_ORIGINS` | — | أصول إضافية (مفصولة بفواصل) |

## نقاط النهاية

| المسار | الطريقة | الوصف |
|---|---|---|
| `/health` | GET | `{ok, app, version, uptime}` — لا يكشف الرمز ولا المسارات |
| `/v1/design` | POST | `{name, canvas:[w,h], layers:[{name, dataURL, opacity, hidden}], manifest?, svg?}` → يكتب PSD + JSON |

`layers` بترتيب **الأعلى أولًا** (نفس ترتيب `buildPSD` في الواجهة)؛ الجسر
يعكسه إلى ترتيب ag-psd من الأسفل إلى الأعلى. كل طبقة PNG كامل الأبعاد
(`data:image/png;base64,…`، 8-bit، بلا interlace).

## الأمان — مفروض لا موعود

- `listen(PORT, '127.0.0.1')` فقط.
- كل POST يحتاج `x-mirsam-token` (مقارنة ثابتة الزمن) → بدونه **401**.
- Origin خارج القائمة → **403** بلا أي ترويسة CORS.
- preflight يُجاب بـ`Access-Control-Allow-Private-Network: true`.
- أسماء الملفات مُعقَّمة والمسار مُتحقَّق ضد الخروج من مجلد المخرجات.
- السجل لا يحتوي الرمز (يُطبع مرة واحدة عند التشغيل فقط).

## التحقّق من الملف في Photoshop الحقيقي

```powershell
powershell -ExecutionPolicy Bypass -File bridge/verify-photoshop.ps1 `
  -Path bridge/out/mirsam-1080x1350.psd `
  -ExpectWidth 1080 -ExpectHeight 1350 `
  -ExpectLayers "14 subhead,13 headline,...,01 accent-band,Background"
```

يفتح الملف عبر COM، يقرأ المقاس وأسماء الطبقات (بترتيب اللوحة، الأعلى أولًا)،
يغلق بلا حفظ، ويُعيد JSON + رمز خروج (0 = مطابق · 1 = اختلاف · 2 = لا Photoshop).
ملاحظة: Photoshop يعرض الطبقة السفلية المعتمة تمامًا باسم `Background` وإن
خزّن الملف `00 background` — لذلك يُمرَّر `Background` في القائمة.

## حدود

- يكتب ملفات فقط — **ليس** تحكّمًا حيًّا في Adobe.
- الطبقات رَستر؛ النص ليس نصًا قابلًا للتحرير داخل PSD.
- يرفض PNG بأكثر من 8-bit أو interlaced برسالة واضحة.
