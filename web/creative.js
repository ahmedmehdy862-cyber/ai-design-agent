/* =========================================================================
   مِرسم — creative.js  (P2 · الذكاء الإبداعي)
   1) محلّل موجز إبداعي منظَّم (12 حقلًا) قابل للتحرير — محلي بلا إنترنت
   2) مولّد 3 مفاهيم مختلفة جوهريًا + مبرر إبداعي لكل مفهوم
   3) وكيل توجيه فني: 8 محاور + مدارس تصميم — يُعتمد أو يُعدَّل قبل الإنشاء
   4) توليد المفاهيم بالذكاء الاصطناعي (اختياري — واجهة فقط عند توفّر مفتاح)
   القاعدة: كل شيء محلي افتراضيًا · لا مفاتيح في الكود · لا ادّعاء بلا مفتاح.
   ========================================================================= */
'use strict';

const $cr = id => document.getElementById(id);

/* =========================================================================
   1. محلّل الموجز الإبداعي — 12 حقلًا
   ========================================================================= */
const CR_FIELDS = [
  { k: 'brand',        label: 'العلامة / المنتج',      ph: 'اسم المنتج أو العلامة' },
  { k: 'audience',     label: 'الجمهور المستهدف',      ph: 'من سيقرأ التصميم؟' },
  { k: 'goal',         label: 'الهدف من التصميم',      ph: 'توعية · بيع · دعوة · إطلاق' },
  { k: 'message',      label: 'الرسالة الأساسية',      ph: 'الفكرة الواحدة التي تبقى' },
  { k: 'tone',         label: 'النبرة',                ph: 'رسمية · ودّية · جريئة · هادئة' },
  { k: 'mood',         label: 'المزاج البصري',        ph: 'دافئ · بارد · حيوي · فاخر' },
  { k: 'channel',      label: 'القناة / المنصّة',      ph: 'انستغرام · طباعة · لافتة' },
  { k: 'different',    label: 'التميّز عن المنافسين',  ph: 'لماذا نحن لا هم؟' },
  { k: 'deliverables', label: 'المخرجات المطلوبة',    ph: 'بوست · ستوري · فلاير…' },
  { k: 'constraints',  label: 'القيود',                ph: 'ألوان ممنوعة · بلا صور…' },
  { k: 'success',      label: 'مؤشر النجاح',          ph: 'كيف نعرف أنه نجح؟' },
  { k: 'refs',         label: 'مراجع بصرية مقترحة',  ph: 'أسلوب مجلة · لافتة قديمة…' }
];

let crBrief = {};     /* آخر موجز مُحلَّل/محرَّر — يبقى بعد التحديث */

function loadCrBrief() {
  try { crBrief = JSON.parse(localStorage.getItem('mirsam.creativeBrief') || '{}') || {}; }
  catch { crBrief = {}; }
}
function saveCrBrief() {
  try { localStorage.setItem('mirsam.creativeBrief', JSON.stringify(crBrief)); } catch { /* ignore */ }
}

/* استخراج محلي من النص الحرّ — قواعد عربية بسيطة، ما لا يُستخرج يبقى فارغًا
   (لا اختراع قيم: الحقل الذي لا يجده التحليل يُترك للمصمم) */
function analyzeCreative(text) {
  const t = String(text || '').trim();
  const out = {};
  if (!t) return out;
  const grab = (re, g = 1) => { const m = t.match(re); return m ? m[g].trim() : ''; };

  out.brand        = grab(/(?:لعلامة|علامة|منتج|مشروع|شركة|متجر|تطبيق|خدمة)\s+((?!ل)[^\s،,.]{2,24})/);
  out.audience     = grab(/(?:موجّه\s+لل?|موجه\s+لل?|للجمهور|الجمهور|جمهور|لفئة|مخصّص\s+لل?|مخصص\s+لل?)\s*([^،.\n]{3,48})/);
  out.goal         = grab(/(?:الهدف|هدفنا|هدفه|أريد|نريد)\s+(?:أن\s+)?([^،.\n]{4,60})/);
  out.message      = grab(/(?:الرسالة|رسالتنا|النص الأساسي|الرسالة الأساسية)\s*[:：]?\s*([^،.\n]{4,70})/);
  out.channel      = grab(/(?:على|في|لمنصّة|لمنصة)\s+(انستغرام|إنستغرام|تويتر|فيسبوك|تيك توك|لينكدإن|واتساب|مطبوع|لافتة|بانر|موقع|ستوري)/i);
  out.different    = grab(/(?:يميّزنا|يتميزنا|يتميز|الميزة|ميزتنا|بدلاً من|خلافًا لـ)\s*([^،.\n]{4,60})/);
  out.constraints  = grab(/(?:بدون|بلا|لا تستخدم|تجنّب|امنع|يجب ألا|ممنوع)\s*([^،.\n]{3,56})/);
  out.success      = grab(/(?:مؤشر النجاح|نجاح|يُقاس|يقيس)\s*[:：]?\s*([^،.\n]{4,56})/);
  out.refs         = grab(/(?:مثل|على طريقة|مستوحى من|مرجع)\s*([^،.\n]{3,56})/).replace(/^[:：]\s*/, '');

  /* نبرة / مزاج / مخرجات: كلمات مفتاحية معترَفة */
  const firstHit = (re, t) => { const m = t.match(re); return m ? m[1] : ''; };
  const TONE = /(رسمية|رسمي|احترافية|احترافي|ودّية|ودية|ودّي|ودي|حميمية|جريئة|جريء|صريحة|صارخة|هادئة|هادئ|لطيفة|فاخرة|فاخر|أنيقة|مرحة|مرح|شبابية)/;
  out.tone = firstHit(TONE, t);
  const MOOD = /(دافئة|دافئ|طبيعي|باردة|بارد|حيوية|حيوي|غامقة|غامق|ليلي|فاتحة|فاتح|مشمس|فاخر|فخمة|نيون|كلاسيكي|قديم|تراثي)/;
  out.mood = firstHit(MOOD, t);
  const DLV = [];
  if (/(بوست|منشور)/i.test(t)) DLV.push('بوست');
  if (/(ستوري|ستوريز|reels|ريلز)/i.test(t)) DLV.push('ستوري');
  if (/(فلاير|بروشور|نشرة)/i.test(t)) DLV.push('فلاير');
  if (/(بانر|لافتة)/i.test(t)) DLV.push('بانر');
  if (/(بطاقة عمل)/i.test(t)) DLV.push('بطاقة عمل');
  if (/(مصغّرة|thumbnail|غلاف)/i.test(t)) DLV.push('مصغّرة');
  out.deliverables = DLV.join(' · ');

  /* الرسالة الأساسية افتراضيًا: الجملة الثانية إن وُجدت */
  if (!out.message) {
    const sents = t.split(/[.!؟\n]+/).map(s => s.trim()).filter(s => s.length > 8);
    if (sents.length > 1) out.message = sents[1].slice(0, 70);
  }
  return out;
}

function renderCreativeBrief() {
  const box = $cr('crBriefFields');
  if (!box) return;
  box.innerHTML = CR_FIELDS.map(f => `
    <label class="field">
      <span>${f.label}</span>
      <input type="text" data-cr="${f.k}" value="${esc(crBrief[f.k] || '')}"
             placeholder="${f.ph}" autocomplete="off">
    </label>`).join('');
  box.querySelectorAll('[data-cr]').forEach(inp => {
    inp.addEventListener('change', () => {
      crBrief[inp.dataset.cr] = inp.value.trim();
      saveCrBrief();
      crStatus('حُفظ الحقل محليًا ✓', 'ok');
    });
  });
}

function crStatus(msg, cls = '') {
  const el = $cr('crStatus');
  if (el) { el.className = 'status ' + cls; el.textContent = msg; }
}

/* تحليل الوصف الحرّ إلى الحقول الـ12 */
function runCreativeAnalyze() {
  const text = ($cr('prompt') ? $cr('prompt').value : '') || '';
  if (!text.trim()) { crStatus('اكتب وصف التصميم أولًا في تبويب «فهم الوصف»', 'err'); return; }
  const found = analyzeCreative(text);
  let n = 0;
  for (const f of CR_FIELDS) if (found[f.k]) { crBrief[f.k] = found[f.k]; n++; }
  saveCrBrief();
  renderCreativeBrief();
  crStatus(n
    ? `استُخرج ${arNum(n)} من ${arNum(CR_FIELDS.length)} حقلًا — راجع وعدّل ما تبقى ثم «اعتمد الموجز»`
    : 'لم يُستخرج حقل مباشر — اكتب الحقول يدويًا ثم «اعتمد الموجز»', n ? 'ok' : 'pending');
}

/* اعتماد الموجز: ما له مقابل في التصميم يُطبَّق، وما لا مقابل له يبقى مرجعًا
   للتفكير (message → النص الثانوي · brand → تمهيد · tone → النمط · …) */
function applyCreativeBrief() {
  const b = crBrief;
  const patch = {};
  if (b.message) patch.subhead = b.message;
  if (b.brand) patch.kicker = b.brand;
  if (b.tone) {
    if (/(جريء|صارخ|حماس)/.test(b.tone)) patch.style = 'bold';
    if (/(هادئ|لطيف|فاخر|رسمي|احترافي)/.test(b.tone)) patch.style = 'light';
  }
  if (b.channel) {
    const ch = b.channel;
    if (/ستوري/i.test(ch)) patch.size = '1080x1920';
    else if (/لافتة|بانر/i.test(ch)) patch.size = '1920x1080';
    else if (/مطبوع/i.test(ch)) patch.size = '1080x1350';
  }
  if (b.deliverables) {
    if (/فلاير/i.test(b.deliverables)) patch.genre = 'flyer';
    else if (/بطاقة/i.test(b.deliverables)) patch.genre = 'card';
    else if (/بانر/i.test(b.deliverables)) patch.genre = 'banner';
    else if (/ستوري/i.test(b.deliverables)) { patch.genre = 'story'; patch.size = '1080x1920'; }
    else if (/مصغّرة/i.test(b.deliverables)) patch.genre = 'thumbnail';
    else if (/بوست/i.test(b.deliverables)) patch.genre = 'social-post';
  }
  if (b.mood && /(غامق|ليلي|فخم)/.test(b.mood)) patch.style = patch.style || 'bold';

  if (!Object.keys(patch).length) {
    crStatus('لا حقل جاهز للتطبيق بعد — أكمل الموجز أولًا', 'pending');
    return;
  }
  applyBrief(patch);
  generate();
  const notes = [
    b.constraints ? 'قيد: ' + b.constraints : '',
    b.success ? 'نجاح متوقع: ' + b.success : '',
    b.refs ? 'مرجع بصري: ' + b.refs : '',
    b.different ? 'التميّز: ' + b.different : ''
  ].filter(Boolean);
  crStatus(`عُمِّل الموجز ✓ (${arNum(Object.keys(patch).length)} إعدادًا)` +
    (notes.length ? ' — ملاحظات محفوظة للمفاهيم: ' + notes.join(' · ') : ''), 'ok');
}

/* =========================================================================
   2. مولّد المفاهيم الثلاثة — متنوّعة جوهريًا + مبرر إبداعي
   كل مفهوم يغيّر التكوين والنمط والزخرفة والباليتة دفعة واحدة،
   والمبرر يربط المفهوم بجمهور/هدف الموجز لا بذوق عام.
   ========================================================================= */
const CONCEPT_STRATEGIES = [
  {
    id: 'direct', name: 'صريح ومركّز',
    patch: { composition: 'editorial', style: 'light', decor: 'rule', accent: 'solid',
             harmony: 'manual', weight: '700', primary: '#F4F1EA', secondary: '#1F2937' },
    why: b => `تحوّل الرسالة إلى هرم واحد: ${b.message ? `«${b.message.slice(0, 34)}»` : 'الرسالة'} تعلو كل شيء،`
      + ` والزخرفة خط شعري فقط — لا شيء ينافس القراءة${b.audience ? ` أمام ${b.audience}` : ''}.`,
    diffs: ['تكوين تحريري', 'باليتة ورقية', 'خط شعري']
  },
  {
    id: 'bold', name: 'جريء تجاري',
    patch: { composition: 'split', style: 'bold', decor: 'arcs', accent: 'gradient',
             harmony: 'complement', weight: '900', primary: '#111827', secondary: '#FF5A1F' },
    why: b => `${b.goal ? `هدف «${b.goal.slice(0, 30)}»` : 'الهدف'} يستدعي إيقاعًا سريعًا: لوح مقسّم يفصل العنوان`
      + ` عن الدعم، وتكميلي يرفع تباين الزر${b.channel ? ` — صُمّم لينتهي قبل تمرير ${b.channel}` : ' — صُمّم للتمرير السريع'}.`,
    diffs: ['تكوين مقسّم', 'تدرّج ووزن أسود', 'زخرفة أقواس']
  },
  {
    id: 'quiet', name: 'هادئ فاخر',
    patch: { composition: 'stack', style: 'light', decor: 'none', accent: 'solid',
             harmony: 'analogous', weight: '600', primary: '#0E1218', secondary: '#D4AF37' },
    why: b => `الفراغ هو البطل: بلا زخرفة، ونبرة${b.tone ? ` ${b.tone}` : ' هادئة'} تتناغم مع المزاج`
      + `${b.mood ? ` ${b.mood}` : ''} — يقرأ${b.audience ? ` ${b.audience}` : ' المتلقي'} ببطء ويثق أكثر.`,
    diffs: ['تكوين مكدّس', 'أسود + ذهبي', 'بلا زخرفة']
  },
  {
    id: 'warm', name: 'دافئ إنساني',
    patch: { composition: 'stack', style: 'bold', decor: 'circle', accent: 'solid',
             harmony: 'analogous', weight: '700', primary: '#7C2D12', secondary: '#F59E0B' },
    why: b => `درجة حرارة واحدة (دافئ) تعطي قربًا دون صراخ${b.audience ? ` — لغة ${b.audience}` : ''}`
      + `، وقرص ملوّن يقود العين${b.message ? ` نحو «${b.message.slice(0, 28)}»` : ' نحو الرسالة'}.`,
    diffs: ['تكوين مكدّس', 'طوب + كهرمان', 'قرص ملوّن']
  },
  {
    id: 'tech', name: 'تقني حيوي',
    patch: { composition: 'split', style: 'bold', decor: 'arcs', accent: 'gradient',
             harmony: 'analogous', weight: '800', primary: '#141033', secondary: '#22D3EE' },
    why: b => `زوج بارد متقارب يوحي بالتقنية بلا تشتّت${b.different ? ` — يُبرز ${b.different.slice(0, 30)}` : ''}`
      + `، وتقسيم مقسوم يوازن بين الابتكار والوضوح${b.goal ? ` لخدمة «${b.goal.slice(0, 24)}»` : ''}.`,
    diffs: ['تكوين مقسّم', 'بنفسجي + سماوي', 'أقواس مركزية']
  },
  {
    id: 'edu', name: 'تحريري نظيف',
    patch: { composition: 'editorial', style: 'light', decor: 'dots', accent: 'solid',
             harmony: 'manual', weight: '800', primary: '#EFF6FF', secondary: '#0F766E' },
    why: b => `${b.audience ? `${b.audience} يحتاج` : 'القارئ يحتاج'} قراءة طويلة بلا إجهاد: خلفية شبه بيضاء`
      + ` + حبر ملوّن واضح${b.message ? `، ونقاط تُيقظ الرسالة «${b.message.slice(0, 26)}»` : '، ونقاط تعطي إيقاعًا'}.`,
    diffs: ['تكوين تحريري', 'أبيض + تركوازي', 'نقاط شبكية']
  }
];

let crConcepts = [];

function pickConcepts() {
  /*3 مفاهيم متنوّعة جوهريًا: نبدأ بأول مفهوم يطابق المزاج/النبرة، ثم أبعد
     اثنين في مساحة (التكوين × النمط × الزخرفة) */
  const score = c => {
    let s = 0;
    if (crBrief.mood && /(غامق|فخم|ليلي)/.test(crBrief.mood) && c.id === 'quiet') s += 3;
    if (crBrief.mood && /(حيوي|جريء|حماس)/.test((crBrief.mood || '') + (crBrief.tone || '')) && c.id === 'bold') s += 3;
    if (crBrief.mood && /(دافئ|طبيعي)/.test(crBrief.mood) && c.id === 'warm') s += 3;
    if (crBrief.tone && /(هادئ|لطيف|رسمي)/.test(crBrief.tone) && (c.id === 'quiet' || c.id === 'direct')) s += 2;
    if (crBrief.tone && /(جريء|صارخ)/.test(crBrief.tone) && c.id === 'bold') s += 2;
    if (/(تقني|تكنولوجيا|مستقبل|رقمي)/.test((crBrief.brand || '') + (crBrief.message || '') + (crBrief.refs || '')) && c.id === 'tech') s += 3;
    if (/(تعليم|دورة|درس|ورشة)/.test((crBrief.audience || '') + (crBrief.goal || '')) && c.id === 'edu') s += 2;
    return s;
  };
  const ranked = CONCEPT_STRATEGIES.slice().sort((a, b) => score(b) - score(a));
  const first = ranked[0];
  /* الفارق: يُقاس بالاختلاف في التكوين والنمط والزخرفة معًا */
  const dist = (a, b) => ['composition', 'style', 'decor'].filter(k => a.patch[k] !== b.patch[k]).length;
  let second = ranked[1], third = ranked[2];
  for (const cand of ranked.slice(1)) {
    if (dist(first, cand) >= 2) { second = cand; break; }
  }
  for (const cand of ranked.slice(1)) {
    if (cand !== second && dist(first, cand) >= 2 && dist(second, cand) >= 1) { third = cand; break; }
  }
  return [first, second, third].filter(Boolean);
}

function renderConcepts(source = 'محلي') {
  const box = $cr('crConcepts');
  if (!box) return;
  if (!crConcepts.length) {
    box.innerHTML = '<p class="hint">اضغط «ولّد 3 مفاهيم» — ثلاثة اتجاهات مختلفة جوهريًا، كل واحد بمبرره الخاص.</p>';
    return;
  }
  box.innerHTML = crConcepts.map((c, i) => `
    <article class="cr-card">
      <header>
        <span class="cr-num">${arNum(i + 1)}</span>
        <h4>${esc(c.name)}</h4>
        <span class="cr-src">${esc(source)}</span>
      </header>
      <p class="cr-why">${esc(c.whyText || c.why(crBrief))}</p>
      <div class="cr-diffs">${(c.diffs || []).map(d => `<span>${esc(d)}</span>`).join('')}</div>
      <div class="cr-swatch">
        <b style="background:${c.patch.primary}"></b>
        <b style="background:${c.patch.secondary}"></b>
        <small>${esc(c.patch.primary)} · ${esc(c.patch.secondary)}</small>
      </div>
      <footer>
        <button type="button" class="btn btn-primary" data-cr-adopt="${i}">اعتمد هذا المفهوم وولّد</button>
      </footer>
    </article>`).join('');
  box.querySelectorAll('[data-cr-adopt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = crConcepts[Number(btn.dataset.crAdopt)];
      if (!c) return;
      applyBrief(c.patch);
      generate();
      crStatus(`اعتُمد مفهوم «${c.name}» ووُلِّد التصميم ✓`, 'ok');
      try { buildProposal(); renderSteering(); } catch { /* report may not exist yet */ }
    });
  });
}

function runConcepts() {
  crConcepts = pickConcepts();
  renderConcepts('محلّ');
  crStatus('3 مفاهيم جاهزة — اعتمد واحدًا أو عدّل الإعدادات يدويًا قبل الإنشاء', 'ok');
}

/* =========================================================================
   3. وكيل التوجيه الفني — 8 محاور + مدارس تصميم
   القيم المقترحة تُعرض للمصمم: يُعتمد محورًا محورًا أو «الكل» أو يُعدَّل،
   ولا يُنشأ التصميم إلا بأمره الصريح.
   ========================================================================= */
const CR_AXES = [
  { k: 'composition', label: 'التكوين',        opts: ['stack', 'split', 'editorial'], names: { stack: 'مكدّس', split: 'مقسّم', editorial: 'تحريري' } },
  { k: 'style',       label: 'النمط البصري',   opts: ['bold', 'light'],               names: { bold: 'جسور', light: 'هادئ' } },
  { k: 'harmony',     label: 'اشتقاق الباليتة', opts: ['manual', 'complement', 'analogous'], names: { manual: 'يدوي', complement: 'تكميلي', analogous: 'متجاور' } },
  { k: 'decor',       label: 'الزخرفة',        opts: ['dots', 'circle', 'arcs', 'rule', 'none'], names: { dots: 'نقاط', circle: 'قرص', arcs: 'أقواس', rule: 'خط شعري', none: 'بلا' } },
  { k: 'weight',      label: 'الوزن الطباعي',  opts: ['600', '700', '800', '900'],   names: { '600': '٦٠٠', '700': '٧٠٠', '800': '٨٠٠', '900': '٩٠٠' } },
  { k: 'spacing',     label: 'الإيقاع بين الكتل', opts: ['70', '90', '100', '110', '130', '160'], names: { '70': '٧٠٪', '90': '٩٠٪', '100': '١٠٠٪', '110': '١١٠٪', '130': '١٣٠٪', '160': '١٦٠٪' } },
  { k: 'shape',       label: 'شكل العناصر',    opts: ['sharp', 'soft', 'pill', 'organic'], names: { sharp: 'حادّ', soft: 'ناعم', pill: 'حبّة', organic: 'عضوي' } },
  { k: 'grain',       label: 'التشطيب',        opts: ['on', 'off'],                   names: { on: 'حبيبات ٣٪', off: 'بلا حبيبات' } }
];

/* مدارس تصميم: تُملأ المحاور الثمانية بقيمها دفعة واحدة (اقتراح لا تنفيذ) */
const CR_SCHOOLS = [
  { id: 'swiss',  name: 'النظام السويسري', desc: 'شبكة صارمة · خط بلا زخرفة · أحمر واحد',
    set: { composition: 'editorial', style: 'bold', harmony: 'complement', decor: 'rule', weight: '700', spacing: '100', shape: 'sharp', grain: 'off' } },
  { id: 'bauhaus', name: 'باوهاوس', desc: 'هندسة أولية · دوائر · ألوان أساسية',
    set: { composition: 'split', style: 'bold', harmony: 'complement', decor: 'circle', weight: '800', spacing: '120', shape: 'pill', grain: 'off' } },
  { id: 'editorial', name: 'التحريري الكلاسيكي', desc: 'ورق · هرم واضح · خط شعري',
    set: { composition: 'editorial', style: 'light', harmony: 'manual', decor: 'rule', weight: '700', spacing: '140', shape: 'soft', grain: 'on' } },
  { id: 'minimal', name: 'المينيمال', desc: 'فراغ · بلا زخرفة · وزن خفيف',
    set: { composition: 'stack', style: 'light', harmony: 'manual', decor: 'none', weight: '600', spacing: '160', shape: 'sharp', grain: 'off' } },
  { id: 'commercial', name: 'التجاري الجسور', desc: 'تقسيم · تدرّج · وزن أسود',
    set: { composition: 'split', style: 'bold', harmony: 'complement', decor: 'arcs', weight: '900', spacing: '85', shape: 'pill', grain: 'off' } },
  { id: 'arabic', name: 'العربي المعاصر', desc: 'زخرفة هندسية · تباين قوي · إيقاع مرن',
    set: { composition: 'editorial', style: 'bold', harmony: 'analogous', decor: 'dots', weight: '800', spacing: '120', shape: 'soft', grain: 'on' } }
];

let crProposal = {};   /* المحاور المقترحة: k → { value, reason } */

/* اقتراح من القياس الحالي (lastRes.report) + نوع التصميم + الموجز */
function buildProposal() {
  const rep = (typeof lastRes !== 'undefined' && lastRes) ? lastRes.report : null;
  const plan = (typeof lastPlan !== 'undefined' && lastPlan) ? lastPlan : null;
  const genre = plan ? plan.meta.genre : ($cr('genre') ? $cr('genre').value : 'social-post');
  const P = {};

  /*1 — التكوين: من نوع التصميم */
  const compByGenre = { quote: 'editorial', flyer: 'editorial', card: 'editorial',
    'product-ad': 'split', banner: 'split', story: 'stack', menu: 'editorial',
    thumbnail: 'split', event: 'stack', 'social-post': 'stack' };
  const curComp = composition;
  const wantComp = compByGenre[genre] || 'stack';
  P.composition = {
    value: wantComp,
    reason: wantComp === curComp
      ? `التكوين الحالي «${namesOf('composition', wantComp)}» مناسب لنوع «${(DESIGN_GENRES.find(g => g.id === genre) || {}).name || genre}»`
      : `نوع «${(DESIGN_GENRES.find(g => g.id === genre) || {}).name || genre}» يُقرأ أفقيًا — ${namesOf('composition', wantComp)} أفضل من ${namesOf('composition', curComp)}`
  };

  /*2 — النمط: من التسلسل المقاس */
  const h = rep && rep.hierarchy;
  const wantStyle = (h && h < 1.6) ? 'bold' : style;
  P.style = {
    value: wantStyle,
    reason: h
      ? (h < 1.6
        ? `التسلسل المقاس ${h.toFixed(2)}× أقل من ١٫٦ — ثقل النمط يعزّز الهرم`
        : `التسلسل المقاس ${h.toFixed(2)}× سليم — النمط الحالي كافٍ`)
      : 'ولّد التصميم ليصل تقرير القياس، أو اختر النمط من خبرتك'
  };

  /*3 — الباليتة: من العائلات اللونية والتباين */
  const hues = rep && rep.dominantHues;
  const ctr = rep && rep.maxContrast;
  let harm = harmony, harmWhy = 'الاشتقاق اليدوي يحفظ ألوانك كما هي';
  if (ctr && ctr < 4.5) { harm = 'complement'; harmWhy = `التباين المقاس ${ctr.toFixed(2)}:1 دون ٤٫٥ — التكميلي يرفع الفصل`; }
  else if (hues && hues > 3) { harm = 'complement'; harmWhy = `${arNum(hues)} عائلات لونية تتجاوز الحد الصحي (٣) — وحّد الباليتة بالتكميلي`; }
  P.harmony = { value: harm, reason: harmWhy };

  /*4 — الزخرفة: من كثافة الحبر */
  const ink = rep && rep.inkRatio;
  const curDecor = $('decor') ? $('decor').value : 'dots';
  let dec = curDecor, decWhy = 'الزخرفة الحالية لا تزاحم النص';
  if (ink && ink > 0.30) { dec = 'rule'; decWhy = `كثافة الحبر ${arNum(Math.round(ink * 100))}% مزدحمة — خط شعري يخفّف`; }
  else if (ink && ink < 0.015) { dec = 'dots'; decWhy = `كثافة الحبر ${arNum(Math.round(ink * 100))}% هزيلة — نقاط تملأ الفراغ دون نص`; }
  P.decor = { value: dec, reason: decWhy };

  /*5 — الوزن: من النمط + الأسلوب */
  const curW = String($cr('weight') ? $cr('weight').value : '700');
  let w = curW, wWhy = 'الوزن الحالي مطابق للنمط';
  if (wantStyle === 'bold' && (curW === '600' || curW === '700')) { w = '800'; wWhy = 'نمط جسور + وزن خفيف = هرم ضعيف — ارفعه إلى ٨٠٠'; }
  if (wantStyle === 'light' && curW === '900') { w = '700'; wWhy = 'نمط هادئ + وزن أسود = صراخ — أنزله إلى ٧٠٠'; }
  P.weight = { value: w, reason: wWhy };

  /*6 — الإيقاع: من عدد البنود (القيمة دائمًا من خيارات المحور) */
  const items = plan ? (plan.meta.items || 0) : 0;
  const spOpts = CR_AXES.find(a => a.k === 'spacing').opts;
  const curSp = String($cr('spacing') ? $cr('spacing').value : 100);
  const nearest = v => spOpts.reduce((b, o) =>
    Math.abs(Number(o) - Number(v)) < Math.abs(Number(b) - Number(v)) ? o : b, spOpts[0]);
  let sp = nearest(curSp), spWhy = 'إيقاع التوزيع مناسب لعدد الكتل';
  if (items >= 5 && Number(curSp) > 110) { sp = '90'; spWhy = `${arNum(items)} بنودًا + إيقاع ${arNum(curSp)}٪ يزيح القوائم — ضيّقه إلى ٩٠٪`; }
  else if (items <= 2 && Number(curSp) < 110) { sp = '130'; spWhy = `بنود قليلة (${arNum(items)}) تتحمّل فواصل أوسع — وسّعها إلى ١٣٠٪`; }
  P.spacing = { value: sp, reason: spWhy };

  /*7 — الشكل: من المزاج/النبرة */
  const curShape = $('shape') ? $('shape').value : 'soft';
  const moodTone = (crBrief.mood || '') + ' ' + (crBrief.tone || '');
  let sh = curShape, shWhy = 'الشكل الحالي يطابق المزاج';
  if (/(رسمي|احترافي|فاخر|غامق)/.test(moodTone) && curShape !== 'sharp') { sh = 'sharp'; shWhy = 'مزاج رسمي/فاخر — زوايا حادّة تعزّز الرصانة'; }
  else if (/(ودّية|مرحة|شبابية|دافئ)/.test(moodTone) && curShape !== 'organic') { sh = 'organic'; shWhy = 'مزاج ودّي — أشكال عضوية تُدفئ'; }
  P.shape = { value: sh, reason: shWhy };

  /*8 — التشطيب: من نوع التصميم (طباعة أم شاشة) */
  const isPrint = /flyer|card|banner/.test(genre);
  const grainOn = $('grain') ? $('grain').checked : false;
  let g = grainOn ? 'on' : 'off', gWhy = 'حبيبات الشاشة مناسبة للنشر الرقمي';
  if (isPrint && !grainOn) { g = 'on'; gWhy = 'تصميم طباعي — الحبيبات تعطي ملمس الورق'; }
  if (!isPrint && grainOn) { g = 'off'; gWhy = 'نشر رقمي — بلا حبيبات لحدّ أقصى في الشاشات'; }
  P.grain = { value: g, reason: gWhy };

  crProposal = P;
}

function namesOf(axis, v) {
  const a = CR_AXES.find(x => x.k === axis);
  return (a && a.names[v]) || v;
}

function renderSteering() {
  const box = $cr('crAxes');
  const schoolBox = $cr('crSchools');
  if (!box) return;
  if (schoolBox && !schoolBox.dataset.done) {
    schoolBox.dataset.done = '1';
    schoolBox.innerHTML = CR_SCHOOLS.map(s => `
      <button type="button" class="chip" data-cr-school="${s.id}" title="${esc(s.desc)}">${esc(s.name)}</button>`).join('');
    schoolBox.querySelectorAll('[data-cr-school]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = CR_SCHOOLS.find(x => x.id === btn.dataset.crSchool);
        if (!s) return;
        for (const [k, v] of Object.entries(s.set)) {
          if (crProposal[k]) crProposal[k] = { value: v, reason: `مقترح مدرسة ${s.name}: ${s.desc}` };
        }
        renderSteering();
        crStatus(`مقترح مدرسة «${s.name}» مُحمَّل في المحاور — اعتمدها أو عدّلها قبل الإنشاء`, 'ok');
      });
    });
  }
  box.innerHTML = CR_AXES.map(a => {
    const p = crProposal[a.k];
    if (!p) return '';
    return `
      <div class="cr-axis" data-axis="${a.k}">
        <div class="cr-axis-head">
          <span class="cr-axis-label">${a.label}</span>
          <select data-cr-opt="${a.k}">
            ${a.opts.map(o => `<option value="${o}" ${o === p.value ? 'selected' : ''}>${a.names[o] || o}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-ghost" data-cr-adopt-axis="${a.k}">اعتمد</button>
        </div>
        <p class="cr-axis-reason">${esc(p.reason)}</p>
      </div>`;
  }).join('');

  box.querySelectorAll('[data-cr-opt]').forEach(sel => {
    sel.addEventListener('change', () => {
      const k = sel.dataset.crOpt;
      if (crProposal[k]) {
        crProposal[k] = { value: sel.value, reason: 'عدّلته يدويًا — سيُطبَّق كما هو' };
        renderSteering();
      }
    });
  });
  box.querySelectorAll('[data-cr-adopt-axis]').forEach(btn => {
    btn.addEventListener('click', () => adoptAxis(btn.dataset.crAdoptAxis, false));
  });
}

function adoptAxis(k, regen) {
  const p = crProposal[k];
  if (!p) return false;
  if (k === 'spacing') {
    /* range input: applyBrief doesn't know it — write + fire input */
    const el = $cr('spacing');
    if (el) { el.value = p.value; el.dispatchEvent(new Event('input', { bubbles: true })); }
  } else if (k === 'grain') {
    applyBrief({ grain: p.value === 'on' });
  } else {
    const patch = {};
    patch[k] = p.value;
    applyBrief(patch);
  }
  const axis = CR_AXES.find(a => a.k === k);
  crStatus(`اعتُمد محور «${axis ? axis.label : k}» ✓`, 'ok');
  if (regen) generate();
  return true;
}

function adoptAllAxes(regen = true) {
  let n = 0;
  for (const a of CR_AXES) if (adoptAxis(a.k, false)) n++;
  if (regen) generate();
  crStatus(`اعتُمدت ${arNum(n)} محورًا من ${arNum(CR_AXES.length)} ووُلِّد التصميم ✓`, 'ok');
  try { buildProposal(); renderSteering(); } catch { /* ignore */ }
}

/* =========================================================================
   4. توليد المفاهيم بالذكاء الاصطناعي — واجهة فقط عند توفّر مفتاح محلي
   ========================================================================= */
function crAiAvailable() {
  try { return !!(loadAIConfig() && loadAIConfig().key); } catch { return false; }
}

function syncCrAiUI() {
  const btn = $cr('crAiConcepts');
  const hint = $cr('crAiHint');
  if (!btn) return;
  const ok = crAiAvailable();
  btn.disabled = !ok;
  btn.style.display = ok ? '' : 'none';
  if (hint) hint.style.display = ok ? 'none' : '';
}

async function runCrAiConcepts() {
  const btn = $cr('crAiConcepts');
  try {
    if (!crAiAvailable()) throw new Error('لا مفتاح محفوظ — أضف مفتاحًا في «فهم الوصف» (اختياري)');
    const cfg = loadAIConfig();
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التوليد…'; }
    crStatus('جارٍ توليد المفاهيم بالذكاء الاصطناعي…', 'pending');
    const fields = CR_FIELDS.map(f => `${f.k}: ${crBrief[f.k] || '—'}`).join(' · ');
    const sys = `أنت موجّه فني إبداعي. اقترح 3 مفاهيم تصميم مختلفة جوهريًا لهذا الموجز، JSON حصريًا:
{"concepts":[{"name":"اسم قصير عربي","why":"مبرر إبداعي في جملة تربط المفهوم بجمهور/هدف الموجز","patch":{"composition":"stack|split|editorial","style":"bold|light","decor":"none|circle|arcs|dots|rule","accent":"solid|gradient","harmony":"manual|complement|analogous","weight":600|700|800|900,"primary":"#RRGGBB","secondary":"#RRGGBB"}}]}
قواعد: المفاهيم الثلاثة متنوّعة جوهريًا (تكوين ونمط وزخرفة مختلفة) · تباين ≥ 4.5:1 · عربي فصيح موجز · بلا علامات تجارية.`;
    const json = await callTextAPI(cfg, `${sys}\n\nالموجز (${CR_FIELDS.length} حقلًا):\n${fields}`);
    const text = AI_PROVIDERS[cfg.provider].read(json);
    const obj = extractJSON(text);
    if (!obj || !Array.isArray(obj.concepts) || !obj.concepts.length) {
      throw new Error('لم يُعِد النموذج JSON صالحًا — جرّب مزوّدًا آخر');
    }
    crConcepts = obj.concepts.slice(0, 3).map(c => {
      const whyText = String(c.why || '').slice(0, 220);
      return {
        name: String(c.name || 'مفهوم').slice(0, 40),
        whyText,
        why: () => whyText,
        diffs: ['مقترح النموذج'],
        patch: Object.assign({}, c.patch || {})
      };
    }).filter(c => c.patch && c.patch.composition);
    if (!crConcepts.length) throw new Error('النموذج لم يعِد مفاهيم بتكوين صالح');
    renderConcepts((AI_PROVIDERS[cfg.provider].label || cfg.provider));
    crStatus(`✓ ${arNum(crConcepts.length)} مفاهيم من ${(AI_PROVIDERS[cfg.provider].label || cfg.provider)}`, 'ok');
  } catch (e) {
    crStatus('تعذّر التوليد بالذكاء الاصطناعي: ' + e.message + ' — المولّد المحلي يعمل بلا مفتاح', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'ولّد المفاهيم بالذكاء الاصطناعي'; syncCrAiUI(); }
  }
}

/* =========================================================================
   التهيئة
   ========================================================================= */
function bootCreative() {
  loadCrBrief();
  renderCreativeBrief();
  renderConcepts();
  buildProposal();
  renderSteering();
  syncCrAiUI();

  const on = (id, fn) => { const el = $cr(id); if (el) el.addEventListener('click', fn); };
  on('crAnalyze', runCreativeAnalyze);
  on('crApply', applyCreativeBrief);
  on('crGenerate', runConcepts);
  on('crAdoptAll', () => adoptAllAxes(true));
  on('crAiConcepts', runCrAiConcepts);
}

document.addEventListener('DOMContentLoaded', () => {
  try { bootCreative(); } catch (e) { console.error('creative boot:', e); }
  /* إعادة الرسم عند فتح التبويب (القيم تتحدث بعد كل توليد) */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'creative') {
        try { buildProposal(); renderSteering(); syncCrAiUI(); } catch (e) { console.error(e); }
      }
    });
  });
});
