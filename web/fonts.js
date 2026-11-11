/* =========================================================================
   مِرسم — fonts.js  (P4 · خطوط عربية محلية من Google Fonts)
   خطوط مقطّعة (عربي + لاتيني) تُنزَّل مرة واحدة من الخادم المحلي:
   1) تُسجَّل في document.fonts لقياس النصوص (measureText) وعرض الواجهة
   2) تُضمَّن base64 داخل SVG عند التصدير — لأن صورة SVG لا تحمّل خطوط الصفحة
   بلا إنترنت · بلا CDN · بلا مفتاح.
   ========================================================================= */
'use strict';

const LOCAL_FONT_DEFS = {
  Cairo: {
    label: 'Cairo — هندسي معاصر',
    files: [{ w: '100 900', f: 'vendor/fonts/Cairo.ttf' }]      /* متغيّر: وزن واحد لكل الأوزان */
  },
  Tajawal: {
    label: 'Tajawal — عصري واضح',
    files: [
      { w: '400', f: 'vendor/fonts/Tajawal-Regular.ttf' },
      { w: '700', f: 'vendor/fonts/Tajawal-Bold.ttf' },
      { w: '800', f: 'vendor/fonts/Tajawal-ExtraBold.ttf' }
    ]
  },
  Almarai: {
    label: 'Almarai — ثقيل مقروء',
    files: [
      { w: '400', f: 'vendor/fonts/Almarai-Regular.ttf' },
      { w: '700', f: 'vendor/fonts/Almarai-Bold.ttf' },
      { w: '800', f: 'vendor/fonts/Almarai-ExtraBold.ttf' }
    ]
  },
  Amiri: {
    label: 'Amiri — نسخي كلاسيكي',
    files: [
      { w: '400', f: 'vendor/fonts/Amiri-Regular.ttf' },
      { w: '700', f: 'vendor/fonts/Amiri-Bold.ttf' }
    ]
  }
};

const _fontB64 = {};   /* family → [{w, b64}] — يُملأ مرة واحدة ثم يُعاد استخدامه */

function u8ToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/* يضمن توفّر الخط للقياس والتضمين؛ يعيد false للأخطاء (النظام البديل يكمل) */
async function ensureLocalFont(family) {
  if (!LOCAL_FONT_DEFS[family]) return false;          /* خط نظامي: لا شيء يُحمَّل */
  if (_fontB64[family]) return true;
  try {
    const def = LOCAL_FONT_DEFS[family];
    const entries = await Promise.all(def.files.map(async ({ w, f }) => {
      const res = await fetch(f);
      if (!res.ok) throw new Error('تعذّر تحميل ' + f);
      const buf = await res.arrayBuffer();
      /* تسجيل الصفحة نفسه من المخزّن نفسه: قياس دقيق بلا تنزيل ثانٍ */
      try {
        const face = new FontFace(family, buf, { weight: String(w) });
        await face.load();
        document.fonts.add(face);
      } catch { /* تسجيل الصفحة فشل — التضمين في SVG يبقى كافيًا */ }
      return { w, b64: u8ToB64(new Uint8Array(buf)) };
    }));
    _fontB64[family] = entries;
    return true;
  } catch (e) {
    console.warn('local font load failed:', family, e && e.message);
    return false;
  }
}

/* CSS جاهز للتضمين داخل SVG — متزامن (من المخزّن)؛ '' لو الخط غير محمّل */
function fontFaceStyleFor(family) {
  const list = _fontB64[family];
  if (!list || !list.length) return '';
  return list.map(e =>
    `@font-face{font-family:'${family}';font-weight:${e.w};font-style:normal;`
    + `src:url(data:font/ttf;base64,${e.b64}) format('truetype');}`).join('');
}

/* تحميل كل خطوط مِرسم المحلية مرة واحدة (للاختبار والتنقل السريع بين الأوزان) */
async function preloadAllLocalFonts() {
  const done = [];
  for (const fam of Object.keys(LOCAL_FONT_DEFS)) {
    if (await ensureLocalFont(fam)) done.push(fam);
  }
  return done;
}
