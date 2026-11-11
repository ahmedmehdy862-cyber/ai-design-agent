/* =========================================================================
   مِرسم — knowledge.js
   Design knowledge base (principles · colour theory · designer skills),
   reference designs, brief-understanding (prompt → design brief) and
   optional text-AI providers (Gemini · OpenAI-compatible · custom).
   Everything local first: no key is required to use the tool.
   ========================================================================= */
'use strict';

/* =========================================================================
   1. مبادئ التصميم الجرافيكي — قواعد قابلة للقياس
   ========================================================================= */
const DESIGN_KNOWLEDGE = {
  principles: [
    {
      id: 'contrast', title: 'التباين', rule: 'WCAG AA ≥ 4.5:1 للنص العادي، ≥ 3:1 للنص الكبير والرسوم',
      body: 'التباين هو أقوى أداة إبراز. احسب النسبة من الإضاءة المُهيّأة لا من الظلّ المضبوط. التباين الجيّد يجعل العنوان يُقرأ قبل أي عنصر آخر.',
      check: 'احسب تباين الحبر مع الخلفية — تظهر في لوحة القياس.'
    },
    {
      id: 'hierarchy', title: 'التسلسل البصري', rule: 'نسبة ≥ 1.6× بين العنوان والنص الثانوي',
      body: 'العين تقرأ الأكبر أولًا. حدد نقطة واحدة تريدها أولًا (العنوان)، ثم رتّب البقية بحجم ووزن ولون — لا تساوِ بين أهمية عنصرين.',
      check: 'قيس «التسلسل» في القياس؛ أقل من 1.6 يضعف القيادة.'
    },
    {
      id: 'alignment', title: 'المحاذاة والشبكة', rule: 'محاذاة على خطوط شبكة واحدة + هامش ثابت (٧٪ من الضلع الأقصر)',
      body: 'كل عنصر يُحاذى إلى خط ظاهر أو متخيَّل. المحاذاة العشوائية تُقرأ كفوضى حتى لو كانت العناصر جميلة.',
      check: 'طبّق طبقة «الشبكة + الأثلاث» وتحقق من تراصّ الحواف.'
    },
    {
      id: 'whitespace', title: 'المساحة السالبة', rule: 'الحبر ١٫٥٪–٣٠٪ من الإطار، ولا تقل الفجوة بين كتل عن ٢× ارتفاع السطر',
      body: 'الفراغ ليس هدرًا؛ هو ما يمنح النص قيمته. المساحة السالبة هي الفرق بين تصميم مهذَّب ومزدحم.',
      check: 'قيس «كثافة الحبر»؛ أظهر التغذية البصرية «كثافة الحبر».'
    },
    {
      id: 'focus', title: 'نقطة التركيز', rule: 'تركيز واحد عند ٠٫٤H تقريبًا (ثلث الإطار)',
      body: 'إن اتسعت نقطتا تباين متساويتان، لم يعد للتصميم نقطة تركيز. الزخرفة تُذلَّل أمام النص، لا تُحاكيه.',
      check: 'طبّق طبقة «نقطة التركيز» وقارن الهدف بمركز كتلة الحبر.'
    },
    {
      id: 'grid', title: 'الشبكة والنِسب', rule: '١٢ عمودًا + مقياس ثابت، أو النسبة الذهبية 1.618',
      body: 'الشبكة تفرض انضباطًا وتُسرّع القرار. استخدم نسبًا معروفة (4:5، 1:1، 16:9) وقِس عناصرك على سلّم مسافات (٤/٨/١٢/١٦/٢٤/٣٢/٤٨/٦٤/٩٦).',
      check: 'أرقام المسافات في الخطة كلها من سلّم المسافات.'
    },
    {
      id: 'balance', title: 'التوازن', rule: 'كتلة الحبر بين ١٤٪ و ٨٢٪ على أي جهة',
      body: 'التوازن متماثل (كلا الجهتين متشابهتان) أو غير متماثل (كتلة مقابلة على الجهة الأخرى). اللوح اللوني قد يُحدث اختلالًا قصدًا — عندها يُبرَّر.',
      check: 'قيس «التوازن»؛ القيم المتطرفة تحتاج زخرفة معادلة.'
    },
    {
      id: 'repetition', title: 'التكرار والتناغم', rule: 'عائلة لونية ≤ ٣ ومقياس خطوط ≤ ٤ أحجام',
      body: 'كرّر نفس الأسلوب (الزوايا، الخطوط، الإيقاع) ليبدو التصميم من عائلة واحدة. التناغم يسبق الأناقة.',
      check: 'قيس «العائلات»؛ أكثر من ٣ يُعلن «palette-creep».'
    },
    {
      id: 'proximity', title: 'التقارب', rule: 'العناصر المترابطة أقرب منها لغيرها بمعامل ٢ على الأقل',
      body: 'ما يخصّ شيئًا يوضع بجواره. القوائم المتباعدة تبدو عناصر منفصلة، والملاصقة تُقرأ كوحدة واحدة.',
      check: 'اجعل النص الثانوي تحت العنوان مباشرة لا عند الحافة.'
    },
    {
      id: 'ra', rule: 'القراءة من اليمين لليسار + ارتفاع سطر أعلى بنسبة ١٠٪',
      title: 'قواعد الخط العربي',
      body: 'لا تُستخدم تباعد الحروف مع العربية. الأولوية لوزن صحيح لا لمحاكاة العريض (synthetic bold). ارتفاع السطر بين ١٫٤ و ١٫٦، والصف لا يتجاوز ٦٠–٧٥ حرفًا.',
      check: 'كل النصوص مرساة يمينًا، وارتفاع السطر مضروب في ١٫٣٤–١٫٥٥.'
    }
  ],

  color: [
    {
      id: 'wheel', title: 'دائرة الألوان',
      body: 'المتكامل يقع على الجانب المقابل (١٨٠°)، المتجاور يجاوره (٣٠°)، الثلاثي يوزّع على ١٢٠°، والرباعي على ٩٠°. كلما ابتعد التباعد ازداد التنوع وزاد خطر الفوضى.'
    },
    {
      id: 'harmony', title: 'أنماط التناغم',
      body: 'متكامل: تباين حادّ مناسب للـCTA. متجاور: هدوء وانسياب. ثلاثي: حيوية مدروسة. منفصل المتقابل: تباين + استقرار. ابدأ محايدًا (٦٠٪) ثم لون ثانوي (٣٠٪) ثم لمسة (١٠٪).'
    },
    {
      id: 'temperature', title: 'درجة الحرارة',
      body: 'الدافئ (أحمر/برتقالي/أصفر) يُقرِّب ويشدّ الانتباه، البارد (أزرق/أخضر/بنفسجي) يُبعد ويوحي بالثقة. لا تخلط أكثر من زوجين دافئ/بارد في التصميم الواحد.'
    },
    {
      id: 'value', title: 'القيمة والإشباع',
      body: 'قيمة اللون (فاتح/غامق) أهم من درجته في القراءة. ألوان فاتحة عالية الإشباع تبدو أصغر بصريًا؛ ألوان غامقة تبدو أكبر وأثقل. خفّض إشباع الطبقات الثانوية لتعمل كخلفية.'
    },
    {
      id: 'roles', title: 'أدوار الألوان',
      body: 'خلفية (Background) · حبر (Ink) · مهيمن (Dominant ٦٠٪) · ثانوي (Secondary ٣٠٪) · لمسة (Accent ١٠٪). لكل لون دور واحد فقط؛ تكرار الدور يجعل اللون بلا معنى.'
    },
    {
      id: 'psychology', title: 'الدلالة النفسية والثقافية',
      body: 'الأزرق ثقة وتقنية، الأخضر طبيعة ونمو، الأسود فخامة، الأبيض نقاء، الذهبي امتياز، الأحمر إلحاح وعرض. في السياق العربي: الذهبي للمناسبات، الأخضر للأجواء الرمضانية، والأزرق المؤسسي أكثر تقبّلًا من الأحمر العام.'
    },
    {
      id: 'aa', title: 'إمكانية الوصول اللوني',
      body: 'لا تعتمد على اللون وحده لإيصال المعنى: أضف نمطًا أو تباينًا في القيمة. النسبة المطلوبة 4.5:1 للنص، 3:1 للعناصر الكبيرة (>24px).'
    }
  ],

  skills: [
    {
      id: 'typography', title: 'الطباعة (Typography)',
      body: 'اختر عائلتين على الأكثر. ابنِ مقياسًا هرميًا بمعامل ثابت (١٫٢–١٫٤). احترم عرض السطر ونقاط التوقف. اختَر الوزن للدلالة: خفيف للثانوي، ثقيل للعنوان، وتجنّب الأوزان المركّبة في الحجم الصغير.'
    },
    {
      id: 'composition', title: 'التكوين',
      body: 'قاعدة الأثلاث تضع التركيز على تقاطع الخطوط. النمط Z معكوس في RTL (يبدأ من الأعلى يمينًا). استخدم المسار البصري: عنوان → زخرفة → CTA. اترك «مخرجًا بصريًا» في الاتجاه المعاكس لحركة القراءة.'
    },
    {
      id: 'layers', title: 'مبدأ الطبقات',
      body: 'كل تصميم = طبقات: خلفية ← كتل لونية ← زخرفة ← نصوص ← طبقات تشطيب. الترتيب في ملفك هو ترتيب القراءة. اجعل كل طبقة قابلة للفصل والتعديل منفردة (اسم واضح، شفافية، بلا دمج).'
    },
    {
      id: 'frames', title: 'فهم الإطارات',
      body: 'الإطار هو حدود اللقطة (العرض × الارتفاع) وزمنها (مدة/إطارات في الثانية). في العمل الثابت: مقاس واحد + منطقة آمنة. في الحركة: نفس المحتوى عبر إطارات متتابعة مع انتقالات منطقية — احسب الإطار الأول والأخير قبل التصميم.'
    },
    {
      id: 'deliverables', title: 'صيغ التسليم',
      body: 'PNG للعرض والويب · SVG للتعديل المتجهي · طبقات PNG شفافة عند تسليم لمحرّك آخر · ملف خطة JSON يشرح كل طبقة. لا تسليم صورة مسطّحة فقط عندما يحتاج العميل التعديل.'
    },
    {
      id: 'critique', title: 'المراجعة النقدية',
      body: 'افصل دائمًا القياس الموضوعي (تباين، كثافة، تسلسل) عن الذوق الجمالي. اسأل: ما أول شيء تراه؟ ماذا تريد أن يفعل؟ هل الزخرفة تنافس النص؟'
    }
  ]
};

/* =========================================================================
   2. مراجع تصميمية (Design references) — إعدادات مُجرَّبة تُولّد فورًا
   ========================================================================= */
const DESIGN_REFS = [
  {
    id: 'editorial-classic', name: 'تحريري كلاسيكي', desc: 'خلفية ورقية، خط ثقيل، خط شعري — لهجة مجلّة',
    patch: {
      style: 'light', primary: '#F4F1EA', secondary: '#B45309',
      composition: 'editorial', decor: 'rule', accent: 'solid', weight: '700',
      kicker: 'تحرير', harmony: 'manual'
    },
    rationale: 'الورق الفاتح + الحبر الداكن = أعلى تباين مضمون؛ الخط الشعري يفصل بلا صراخ.'
  },
  {
    id: 'corporate-navy', name: 'مؤسسي كحلي', desc: 'ثقة مؤسسية: كحلي + ذهبي، شبكة نقاط',
    patch: {
      style: 'bold', primary: '#0B3D5C', secondary: '#F4A417',
      composition: 'stack', decor: 'dots', accent: 'solid', weight: '700',
      kicker: 'رسمي', harmony: 'manual'
    },
    rationale: 'الأزرق للثقة، الذهبي للامتياز؛ النقاط تُضيف إيقاعًا دون منافسة النص.'
  },
  {
    id: 'bold-commercial', name: 'جريء تجاري', desc: 'لوح لوني مقسّم + تدرّج + وزن أسود',
    patch: {
      style: 'bold', primary: '#111827', secondary: '#FF5A1F',
      composition: 'split', decor: 'arcs', accent: 'gradient', weight: '900',
      kicker: 'عرض', harmony: 'complement'
    },
    rationale: 'التقسيم يفصل الرسالة عن الدعم، والتكميلي يولّد أعلى تباين للـCTA.'
  },
  {
    id: 'quiet-minimal', name: 'مينيمال هادئ', desc: 'فراغ كبير، وزن خفيف، تكوين مكدّس',
    patch: {
      style: 'light', primary: '#FAFAF7', secondary: '#334155',
      composition: 'stack', decor: 'none', accent: 'solid', weight: '600',
      kicker: '', harmony: 'manual'
    },
    rationale: 'بلا زخرفة = لا شيء ينافس النص؛ الفراغ هو البطل.'
  },
  {
    id: 'luxury-dark', name: 'فخم ليلي', desc: 'أسود فحمي + ذهبي + قرص مضيء',
    patch: {
      style: 'bold', primary: '#0E1218', secondary: '#D4AF37',
      composition: 'editorial', decor: 'circle', accent: 'gradient', weight: '600',
      kicker: 'محدود', harmony: 'manual'
    },
    rationale: 'قيمة منخفضة جدًا تجعل الذهبي يبدو مضيئًا بلا توهج مصطنع.'
  },
  {
    id: 'tech-neon', name: 'تقني نيون', desc: 'بنفسجي غامق + سماوي، أقواس متحدة المركز',
    patch: {
      style: 'bold', primary: '#141033', secondary: '#22D3EE',
      composition: 'split', decor: 'arcs', accent: 'gradient', weight: '800',
      kicker: 'تقنية', harmony: 'analogous'
    },
    rationale: 'زوج بارد متقارب (٣٤°) يوحي بالتقنية بلا تشتّت لوني.'
  },
  {
    id: 'warm-human', name: 'دافئ إنساني', desc: 'طوبي + كريمي، قرص دافئ',
    patch: {
      style: 'bold', primary: '#7C2D12', secondary: '#F59E0B',
      composition: 'stack', decor: 'circle', accent: 'solid', weight: '700',
      kicker: 'من القلب', harmony: 'analogous'
    },
    rationale: 'درجة حرارة واحدة (دافئ) تعطي دفئًا دون تنافر — مناسب للمنتجات الإنسانية.'
  },
  {
    id: 'edu-clean', name: 'تعليمي نظيف', desc: 'أزرق فاتح + أخضر، تكوين مكدّس مرتّب',
    patch: {
      style: 'light', primary: '#EFF6FF', secondary: '#0F766E',
      composition: 'stack', decor: 'dots', accent: 'solid', weight: '700',
      kicker: 'تعلّم', harmony: 'manual'
    },
    rationale: 'خلفية شبه بيضاء + حبر ملوّن واضح = قراءة طويلة بلا إجهاد.'
  }
];

/* =========================================================================
   2-b. أنواع التصميم (genres) + أشكال العناصر (shapes)
   ========================================================================= */
const DESIGN_GENRES = [
  {
    id: 'social-post', name: 'منشور اجتماعي', size: '1080x1350',
    composition: 'stack', decor: 'dots', accent: 'solid', weight: '700',
    note: 'نص مكثّف + مساحة سالبة + زر دعوة واضح'
  },
  {
    id: 'story', name: 'ستوري / ريلز', size: '1080x1920',
    composition: 'editorial', decor: 'rule', accent: 'solid', weight: '700',
    focalRatio: 0.36, note: 'تركيز أعلى (٠٫٣٦H) لتجنّب أزرار التطبيق'
  },
  {
    id: 'quote', name: 'بطاقة اقتباس', size: '1080x1080',
    composition: 'editorial', decor: 'circle', accent: 'solid', weight: '600',
    quote: true, note: 'علامات اقتباس كبيرة + تسلسل هادئ'
  },
  {
    id: 'product-ad', name: 'إعلان منتج', size: '1080x1350',
    composition: 'split', decor: 'arcs', accent: 'gradient', weight: '800',
    note: 'لوح لوني يحمل العرض والنص في الجهة الأخرى'
  },
  {
    id: 'event', name: 'دعوة فعالية', size: '1080x1350',
    composition: 'editorial', decor: 'rule', accent: 'solid', weight: '700',
    date: true, note: 'سطر تاريخ/موعد منفصل تحت العنوان'
  },
  {
    id: 'menu', name: 'قائمة / أسعار', size: '1080x1350',
    composition: 'stack', decor: 'rule', accent: 'solid', weight: '700',
    list: true, note: 'بنود منفصلة بنقاط — لا فقرة واحدة'
  },
  {
    id: 'banner', name: 'لافتة عريضة', size: '1920x1080',
    composition: 'split', decor: 'none', accent: 'solid', weight: '900',
    wide: true, note: 'سطر واحد قوي + مقاس أفقي'
  },
  {
    id: 'thumbnail', name: 'صورة مصغّرة', size: '1080x1080',
    composition: 'split', decor: 'circle', accent: 'gradient', weight: '900',
    badge: true, note: 'شارة صغيرة أعلى + حجم عنوان كبير جدًا'
  },
  {
    id: 'flyer', name: 'فلاير طباعي', size: '1080x1350',
    composition: 'editorial', decor: 'circle', accent: 'solid', weight: '700',
    print: true, note: 'إطار قصّ داخلي + منطقة آمنة ٦٪'
  },
  {
    id: 'card', name: 'بطاقة عمل', size: '1050x600',
    composition: 'split', decor: 'dots', accent: 'solid', weight: '700',
    note: 'نسبة 1.75:1 — نص قصير جدًا'
  }
];

const DESIGN_SHAPES = [
  { id: 'sharp', name: 'حادّ (زوايا قائمة)', radius: 0, note: 'هندسة صارمة — تقنية ومؤسسية' },
  { id: 'soft', name: 'ناعم (زوايا ١٢px)', radius: 12, note: 'ودّي وحديث — الأصل الافتراضي' },
  { id: 'pill', name: 'حبّة (كبسولة)', radius: -1, note: 'زر/شارة كاملة التدوير — ودود وعصري' },
  { id: 'organic', name: 'عضوي (أشكال بيضاوية)', radius: -2, note: 'زخارف بيضاوية وحواف ناعمة جدًا' }
];

function shapeRadius(shapeId, chipH) {
  const s = DESIGN_SHAPES.find(x => x.id === shapeId) || DESIGN_SHAPES[1];
  if (s.radius === -1) return Math.round(chipH / 2);
  if (s.radius === -2) return Math.round(chipH * 0.45);
  return s.radius;
}

/* =========================================================================
   3. فهم الوصف (prompt → brief) — محلّل محلي بلا شبكة
   ========================================================================= */
const SIZE_RULES = [
  { re: /(ستوري|ستوريز|story|reels|ريلز|9\s*[:×]\s*16|١٦[:×]٩|٩:١٦)/i, size: '1080x1920', why: 'مقاس رأسي ٩:١٦' },
  { re: /(مربع|square|1\s*[:×]\s*1|1:1|١[:×]١)/i, size: '1080x1080', why: 'مقاس مربّع ١:١' },
  { re: /(أفقي|عرضي|landscape|16\s*[:×]\s*9|16:9|١٦[:×]٩)/i, size: '1920x1080', why: 'مقاس أفقي ١٦:٩' },
  { re: /(بوست|منشور|post|4\s*[:×]\s*5|4:5|٥[:×]٤)/i, size: '1080x1350', why: 'بوست ٤:٥' }
];

const MOOD_RULES = [
  { re: /(هادئ|بسيط|minimal|مينيمال|نقي|sparse|أنيق|elegant)/i, patch: { style: 'light', decor: 'none', weight: '600', composition: 'stack', accent: 'solid' }, why: 'مفردات الهدوء → أسلوب فاتح بلا زخرفة ووزن خفيف' },
  { re: /(جريء|قوي|bold|aggressive|صاخب|loud|أسود|black)/i, patch: { style: 'bold', weight: '900', decor: 'arcs', accent: 'gradient', composition: 'split' }, why: 'مفردات الجرأة → وزن أسود + لوح مقسّم + تدرّج' },
  { re: /(فخم|فاخر|luxury|ذهبي|gold|royal|ملكي|premium)/i, patch: { style: 'bold', primary: '#0E1218', secondary: '#D4AF37', weight: '600', decor: 'circle', accent: 'gradient', composition: 'editorial' }, why: 'الفخامة → خلفية داكنة جدًا + ذهبي + قرص' },
  { re: /(تقني|تكنولوجيا|tech|ai|ذكاء اصطناعي|روبوت|digital|رقمي)/i, patch: { style: 'bold', primary: '#141033', secondary: '#22D3EE', weight: '800', decor: 'arcs', accent: 'gradient', composition: 'split' }, why: 'التقنية → ألوان باردة + أقواس + وزن ثقيل' },
  { re: /(طبيعي|بيئة|غابة|nature|eco|أخضر|green)/i, patch: { style: 'light', primary: '#F7F9F4', secondary: '#166534', weight: '700', decor: 'circle', accent: 'solid', composition: 'stack' }, why: 'الطبيعة → أخضر عميق على ورق فاتح' },
  { re: /(دافئ|ودّي|warm|بيت|handmade|صناعة يدوية)/i, patch: { style: 'bold', primary: '#7C2D12', secondary: '#F59E0B', decor: 'circle', accent: 'solid', weight: '700', composition: 'stack' }, why: 'الدفء → درجة حرارة واحدة (طوبي/كهرماني)' },
  { re: /(رياضة|رياضي|sport|gym|لياقة|dynamic)/i, patch: { style: 'bold', primary: '#111827', secondary: '#FACC15', weight: '900', decor: 'none', accent: 'solid', composition: 'split' }, why: 'الرياضة → تباين حادّ بلا زخرفة تشتيت' },
  { re: /(زفاف|عروس|wedding|رومانسي|حب|love| anniversary|ذكرى)/i, patch: { style: 'light', primary: '#FDF7F4', secondary: '#9D4EDD', weight: '600', decor: 'rule', accent: 'solid', composition: 'editorial' }, why: 'الرومانسية → وردي/بنفسجي على ورق فاتح' },
  { re: /(عرض|تخفيض|خصم|sale|discount|offer|محدود|limited)/i, patch: { style: 'bold', weight: '900', decor: 'none', accent: 'gradient', composition: 'split', secondary: '#FF5A1F' }, why: 'التخفيض → أوزان سوداء ولون إلحاح' },
  { re: /(طعام|مطعم|قهوة|coffee|food|appetite|حلويات)/i, patch: { style: 'bold', primary: '#3B1E0B', secondary: '#F59E0B', decor: 'circle', accent: 'solid', weight: '700', composition: 'stack' }, why: 'الطعام → بني داكن + كهرماني يحفّز الشهية' },
  { re: /(تعليم|دورة|course|study|مدرسة|school|university)/i, patch: { style: 'light', primary: '#EFF6FF', secondary: '#0F766E', weight: '700', decor: 'dots', accent: 'solid', composition: 'stack' }, why: 'التعليم → نقاء أزرق فاتح + ترتيب شبكي' },
  { re: /(منتج|product|packshot|سلعة|متجر|shop|store)/i, patch: { composition: 'split', decor: 'arcs', accent: 'solid', weight: '800' }, why: 'المنتج → التقسيم يفصّل العرض عن الوصف' }
];

const CTA_RE = /(اطلب|سجّل|اشترك|احجز|اشترِ|اشترى|تواصل|حمّل|جرّب|اكتشف|سجّل الآن|اطلب الآن|book now|sign up|subscribe|buy|order|try now|get started)/i;
const KICKER_RE = /(إطلاق|عرض جديد|جديد|محدود|لفترة|لأول مرة|تحديث|2026|٢٠٢٦|launch|new|limited)/i;

function splitSentences(t) {
  return t.split(/[\n.!?؟،،]+/).map(s => s.trim()).filter(Boolean);
}

function parseBriefPrompt(text) {
  const t = (text || '').trim();
  const out = { headline: '', subhead: '', cta: '', kicker: '', size: '', notes: [], understood: [] };
  if (!t) return out;

  const sentences = splitSentences(t);
  const first = sentences[0] || t;
  out.headline = first.length > 60 ? first.slice(0, 57).trim() + '…' : first;
  out.understood.push({ label: 'العنوان', value: out.headline });
  if (sentences.length > 1) {
    out.subhead = sentences.slice(1).join(' · ').slice(0, 110);
    out.understood.push({ label: 'النص الثانوي', value: out.subhead });
  }

  const sizeHit = SIZE_RULES.find(r => r.re.test(t));
  if (sizeHit) { out.size = sizeHit.size; out.understood.push({ label: 'المقاس', value: sizeHit.why }); }
  else out.notes.push('لم يُحدَّد مقاس — سيبقى المقاس الحالي.');

  const mood = MOOD_RULES.filter(r => r.re.test(t));
  out.moodPatch = {};
  out.moodWhy = [];
  for (const m of mood) {
    Object.assign(out.moodPatch, m.patch);
    out.moodWhy.push(m.why);
    out.understood.push({ label: 'النمط', value: m.why });
  }

  /* ---- مرجع التصميم المطابق: المراجع ليست توثيقًا بل إخراج فني يُ commanded
         من الوصف — باليتة + تكوين + زخرفة + وزن تُطبَّق فورًا ---- */
  const REF_RULES = [
    { re: /(فاخر|فخم|luxury|ذهبي|gold|ملكي|royal|premium|ليلي|midnight)/i, id: 'luxury-dark' },
    { re: /(تقني|تكنولوجيا|tech|نيون|neon|مستقبل|رقمي|digital|ذكاء اصطناعي|ai)/i, id: 'tech-neon' },
    { re: /(مطعم|طعام|قهوة|coffee|food|وصفة|حلوي|كافيه)/i, id: 'warm-human' },
    { re: /(تعليم|دورة|course|درس|مدرسة|جامعة|تعلّم|workshop)/i, id: 'edu-clean' },
    { re: /(عرض|تخفيض|خصم|sale|بيع|تجاري|منتج|متجر)/i, id: 'bold-commercial' },
    { re: /(مؤسسي|شركة|تقرير|annual|business|رسمي|بنك)/i, id: 'corporate-navy' },
    { re: /(مجلة|صحفي|مقال|تحريري|كتاب|دار نشر|story)/i, id: 'editorial-classic' },
    { re: /(هادئ|بسيط|minimal|نقي|فراغ|elegant)/i, id: 'quiet-minimal' }
  ];
  const refHit = REF_RULES.find(r => r.re.test(t));
  if (refHit) {
    const ref = DESIGN_REFS.find(r => r.id === refHit.id);
    if (ref) {
      out.ref = ref.id;
      out.refName = ref.name;
      out.refPatch = Object.assign({}, ref.patch);
      /* a mood that already fixes the palette wins — the reference then only
         contributes structure (composition · decoration · harmony · kicker) */
      const moodOwnsColour = mood.some(m => m.patch.primary || m.patch.secondary || m.patch.style);
      if (moodOwnsColour) {
        delete out.refPatch.primary;
        delete out.refPatch.secondary;
        delete out.refPatch.style;
      }
      out.understood.push({ label: 'مرجع الإخراج', value: ref.name });
      out.notes.push('مرجع مُطبَّق: ' + ref.rationale);
    }
  }

  const ctaHit = t.match(CTA_RE);
  if (ctaHit) { out.cta = ctaHit[0].replace(/ها$/,'').trim(); out.understood.push({ label: 'زر الدعوة', value: out.cta }); }

  const kHit = t.match(KICKER_RE);
  if (kHit) { out.kicker = kHit[0].trim(); out.understood.push({ label: 'سطر تمهيدي', value: out.kicker }); }

  /* ---- نوع التصميم ---- */
  const GENRE_RULES = [
    { re: /(ستوري|ستوريز|story|stories|reels|ريلز)/i, id: 'story' },
    { re: /(اقتباس|quote|statement|كلمة اليوم|حكمة)/i, id: 'quote' },
    { re: /(فعالية|حفل|مؤتمر|ندوة|موعد|دعوة|event|conference|workshop|invite|زفاف|افتتاح)/i, id: 'event' },
    { re: /(قائمة|أسعار|منيو|menu|price|باقات|package)/i, id: 'menu' },
    { re: /(لافتة|banner|واجهة|hoarding|لوحة إعلانية)/i, id: 'banner' },
    { re: /(مصغّرة|thumbnail|غلاف|cover|عنوان فيديو)/i, id: 'thumbnail' },
    { re: /(فلاير|flyer|بروشور|brochure|نشرة|leaflets)/i, id: 'flyer' },
    { re: /(بطاقة عمل|business card|كارت)/i, id: 'card' },
    { re: /(منتج|product|packshot|سلعة|عرض منتج)/i, id: 'product-ad' }
  ];
  const genreHit = GENRE_RULES.find(r => r.re.test(t));
  out.genre = genreHit ? genreHit.id : 'social-post';
  const genreDef = DESIGN_GENRES.find(g => g.id === out.genre);
  out.understood.push({ label: 'نوع التصميم', value: genreDef ? genreDef.name : 'منشور اجتماعي' });
  if (genreDef) {
    out.genrePatch = { composition: genreDef.composition, decor: genreDef.decor, accent: genreDef.accent, weight: genreDef.weight };
    if (genreDef.size) { out.size = out.size || genreDef.size; out.understood.push({ label: 'المقاس (نوع التصميم)', value: genreDef.size }); }
    if (genreDef.note) out.notes.push(genreDef.note);
  }

  /* ---- شكل العناصر ---- */
  const SHAPE_RULES = [
    { re: /(حاد|حادّ|sharp|مربّع|square|هندسي)/i, id: 'sharp' },
    { re: /(كبسولة|pill|دائري كامل|زر)/i, id: 'pill' },
    { re: /(عضوي|organic|ناعم جدًا|بلوب)/i, id: 'organic' },
    { re: /(ناعم|soft|ودّي|modern|حديث)/i, id: 'soft' }
  ];
  const shapeHit = SHAPE_RULES.find(r => r.re.test(t));
  out.shape = shapeHit ? shapeHit.id : '';
  if (shapeHit) {
    const sd = DESIGN_SHAPES.find(s => s.id === out.shape);
    out.understood.push({ label: 'شكل العناصر', value: sd ? sd.name : out.shape });
  }

  /* ---- تاريخ/موعد (لدعوات الفعاليات) ---- */
  const MONTHS = 'يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر';
  const dateHit = t.match(new RegExp(`(\\d{1,2}[\\s/-]*(${MONTHS})|(${MONTHS})\\s*\\d{1,2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|السبت|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)`));
  if (dateHit) {
    out.date = dateHit[0].trim();
    out.understood.push({ label: 'الموعد', value: out.date });
  }

  /* ---- بنود (قوائم/أسعار) ---- */
  const rawLines = t.split(/\n|•|\||·/).map(s => s.trim()).filter(s => s.length > 1);
  let items = rawLines.length > 1 ? rawLines.slice(0, 5) : [];
  if (!items.length && out.subhead) {
    const byComma = out.subhead.split(/[،,]/).map(s => s.trim()).filter(s => s.length > 1);
    if (byComma.length >= 2 && (out.genre === 'menu' || byComma.length >= 3)) items = byComma.slice(0, 5);
  }
  if (items.length) {
    out.items = items.map(s => s.replace(/^[•\-–]\s*/, '').slice(0, 40));
    out.understood.push({ label: 'البنود', value: `${arNumLocal(out.items.length)} بنود` });
  }

  if (/ستوري|story|reels|ريلز/i.test(t)) out.notes.push('المقاس الرأسي يحتاج نصًّا أعلى (٠٫٣٦H) — يُطبَّق تلقائيًا.');
  return out;
}

function arNumLocal(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

/* =========================================================================
   4. مزوّدات النص (اختيارية — تُترك فارغة للعمل بلا مفاتيح)
   ========================================================================= */
const AI_PROVIDERS = {
  gemini: {
    label: 'Gemini (Google)',
    model: 'gemini-1.5-flash',
    endpoint: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    body: prompt => ({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    read: j => j?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  },
  openai: {
    label: 'OpenAI / OpenRouter / Groq (متوافق)',
    model: 'gpt-4o-mini',
    endpoint: (model, key, ep) => ep || 'https://api.openai.com/v1/chat/completions',
    body: prompt => ({ model: undefined, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
    read: j => j?.choices?.[0]?.message?.content || ''
  },
  custom: {
    label: 'نقطة نهاية مخصّصة (أي خدمة تُعيد JSON)',
    model: '',
    endpoint: (model, key, ep) => ep,
    body: prompt => ({ prompt }),
    read: j => (typeof j === 'string' ? j : j?.output || j?.text || j?.content || JSON.stringify(j))
  }
};

function systemInstruction() {
  return `أنت مُخطِّط تصميم عربي محترف. حوّل الوصف إلى JSON بهذا الشكل حصريًا:
{"headline":"عنوان عربي ≤ 50 حرفًا","subhead":"سطر ثانوي ≤ 90 حرفًا","cta":"زر دعوة قصير أو فارغ","kicker":"سطر تمهيدي قصير أو فارغ",
"style":"bold|light","composition":"stack|split|editorial","decor":"none|circle|arcs|dots|rule",
"accent":"solid|gradient","weight":600|700|800|900,"primary":"#RRGGBB","secondary":"#RRGGBB",
"size":"1080x1350|1080x1080|1080x1920|1920x1080","harmony":"manual|complement|analogous","grain":false,
"notes":["ملاحظات تصميمية قصيرة"]}
قواعد: لغة عربية فصيحة موجزة · تباين حبر-خلفية ≥ 4.5:1 · مقياس خطوط واحد · باليتة من3 ألوان · لا شعارات ولا علامات تجارية.`;
}

function extractJSON(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return null; }
}

function loadAIConfig() {
  try { return JSON.parse(localStorage.getItem('mirsam.ai') || '{}'); } catch { return {}; }
}
function saveAIConfig(cfg) { localStorage.setItem('mirsam.ai', JSON.stringify(cfg)); }

async function callTextAPI(cfg, promptText) {
  const p = AI_PROVIDERS[cfg.provider] || AI_PROVIDERS.openai;
  const url = p.endpoint(cfg.model || p.model, cfg.key || '', cfg.endpoint || '');
  if (!url) throw new Error('لم يُضبط رابط نقطة النهاية');
  const payload = p.body(promptText);
  if (cfg.provider !== 'gemini' && payload.model === undefined) payload.model = cfg.model || p.model;
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) {
    if (cfg.provider === 'gemini') headers['x-goog-api-key'] = cfg.key;
    else headers['Authorization'] = `Bearer ${cfg.key}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`الخادم ردّ ${res.status} — ${body.slice(0, 140)}`);
  }
  const json = await res.json().catch(() => null);
  return json;
}

/* =========================================================================
   5. freefield — محرّك خارجي (Open-source Higgsfield on ComfyUI)
   ========================================================================= */
const FREEFIELD = {
  repo: 'neuregex/freefield',
  url: 'https://github.com/neuregex/freefield',
  clone: 'git clone https://github.com/neuregex/freefield.git',
  cached: {
    description: 'Open-source Higgsfield on ComfyUI: every app is one folder, every model is open weights.',
    language: 'Python', license: 'MIT', stars: 791, updated: '2026-11-03'
  }
};

async function fetchFreefieldInfo() {
  try {
    const r = await fetch('https://api.github.com/repos/neuregex/freefield', { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('github ' + r.status);
    const j = await r.json();
    return {
      description: j.description || FREEFIELD.cached.description,
      language: j.language || 'Python',
      license: (j.license && j.license.spdx_id) || 'MIT',
      stars: j.stargazers_count,
      updated: (j.pushed_at || '').slice(0, 10),
      url: j.html_url
    };
  } catch (e) {
    return { ...FREEFIELD.cached, live: false };
  }
}

async function fetchFreefieldReadme() {
  const urls = [
    'https://raw.githubusercontent.com/neuregex/freefield/main/README.md',
    'https://raw.githubusercontent.com/neuregex/freefield/master/README.md'
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.text();
    } catch { /* try next */ }
  }
  return null;
}

/* send a prompt to a ComfyUI/freefield gateway and expect an image back.
   Contract: POST {prompt,width,height} → {image_url} | {url} | {images:[{url}]} */
async function sendToEngine(cfg, brief) {
  const url = (cfg.endpoint || '').replace(/\/+$/, '');
  if (!url) throw new Error('لم يُضبط رابط المحرّك الخارجي');
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers['Authorization'] = `Bearer ${cfg.key}`;
  const body = { prompt: brief, width: brief.width || 1080, height: brief.height || 1350 };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`المحرّك ردّ ${res.status}`);
  const j = await res.json();
  const img = j.image_url || j.url || (j.images && (j.images[0].url || j.images[0])) || null;
  if (!img) throw new Error('لم يُعِد المحرّك صورة — تحقّق من صيغة الردّ');
  return img;
}

/* =========================================================================
   6. المعرفة تُنتِج لا تُعرض — كل مبدأ يتحول إلى قاعدة تُنفَّذ داخل المخطّط
   قبل القياس، فتظهر النتيجة على المخرج لا في تعليق فقط.
   ========================================================================= */
const KNOWLEDGE_APPLIERS = [
  {
    id: 'hierarchy',
    principle: 'التسلسل البصري',
    rule: 'حجم العنوان ≥ ١٫٦× حجم النص الثانوي',
    apply(plan) {
      const head = plan.elements.find(e => e.role === 'headline' && !e.hidden);
      const sub = plan.elements.find(e => e.role === 'subhead' && !e.hidden);
      if (!head || !sub || !head.size || !sub.size) return null;
      const ratio = head.size / sub.size;
      if (ratio >= 1.6) return null;
      const before = sub.size;
      sub.size = Math.max(12, Math.round(head.size / 1.65));
      sub.leading = Math.round(sub.size * 1.55);
      return `العنوان ${head.size}px مقابل ثانوي ${before}→${sub.size}px = ${(head.size / sub.size).toFixed(2)}×`;
    }
  },
  {
    id: 'contrast',
    principle: 'التباين (WCAG)',
    rule: 'تباين النص مع سطحه: ٤٫٥:١ للعادي · ٣:١ لل الكبير',
    apply(plan) {
      const bg = plan.palette.bg;
      const surfaceOf = role => {
        if (role === 'cta-text') {
          const chip = plan.elements.find(e => e.role === 'cta-chip');
          if (chip) return chip.grad ? chip.grad[0] : (chip.fill || bg);
        }
        if (role === 'badge-text') {
          const badge = plan.elements.find(e => e.role === 'badge');
          if (badge) return badge.grad ? badge.grad[0] : (badge.fill || bg);
        }
        return bg;
      };
      const acts = [];
      for (const el of plan.elements) {
        if (el.kind !== 'type' || el.hidden || !el.color) continue;
        const surface = surfaceOf(el.role);
        const large = el.size >= 24 || (el.weight >= 700 && el.size >= 18.66);
        const need = large ? 3 : 4.5;
        if (contrast(el.color, surface) >= need) continue;
        const better = readableInk(surface);
        if (contrast(better, surface) < need) continue;
        el.color = better;
        acts.push(`${el.role}→${better} (${contrast(better, surface).toFixed(1)}:1)`);
      }
      return acts.length ? `رفعت تباين ${acts.join('، ')}` : null;
    }
  },
  {
    id: 'rhythm',
    principle: 'الإيقاع والشبكة',
    rule: 'كل خطوة رأسية على منصّات ٤px (سلّم المسافات)',
    apply(plan) {
      let moved = 0;
      for (const el of plan.elements) {
        if (el.kind !== 'type' || el.hidden) continue;
        const snap4 = Math.round(el.y / 4) * 4;
        if (snap4 !== el.y) { el.y = snap4; moved++; }
      }
      return moved ? `صُحّح ${moved} خط أساس إلى شبكة ٤px` : null;
    }
  },
  {
    id: 'leading',
    principle: 'الطباعة',
    rule: 'تباعد الأسطر بين ١٫٢× و ١٫٧× حجم الحرف',
    apply(plan) {
      const acts = [];
      for (const el of plan.elements) {
        if (el.kind !== 'type' || el.hidden || !el.size || !el.leading) continue;
        const r = el.leading / el.size;
        if (r > 1.7) { el.leading = Math.round(el.size * 1.7); acts.push(`${el.role} تقليل التباعد`); }
        else if (r < 1.2) { el.leading = Math.round(el.size * 1.25); acts.push(`${el.role} زيادة التباعد`); }
      }
      return acts.length ? `ضُبط تباعد الأسطر: ${acts.join('، ')}` : null;
    }
  },
  {
    id: 'safe',
    principle: 'المنطقة الآمنة',
    rule: 'النص داخل هامش ٦٪ من الضلع الأقصر',
    apply(plan) {
      const [W, H] = plan.canvas;
      const m = plan.grid.margin;
      let moved = 0;
      for (const el of plan.elements) {
        if (el.hidden || el.bleed) continue;
        if (el.kind === 'type') {
          if (el.x > W - m) { el.x = W - m; moved++; }
          if (el.maxW && el.maxW > W - m * 2) { el.maxW = W - m * 2; moved++; }
        } else if (el.rect) {
          const [x, y, w, h] = el.rect;
          const nx = Math.max(Math.min(x, W - m - w), -0);
          const ny = Math.max(Math.min(y, H - m - h), m);
          if (nx !== x || ny !== y) { el.rect = [nx, ny, w, h]; moved++; }
        }
      }
      return moved ? `أُعيد ${moved} عنصرًا إلى المنطقة الآمنة` : null;
    }
  }
];

/* run every knowledge rule against a plan; returns what actually changed */
function applyKnowledge(plan) {
  const done = [];
  for (const k of KNOWLEDGE_APPLIERS) {
    try {
      const msg = k.apply(plan);
      if (msg) done.push(`«${k.principle}» ${msg}`);
    } catch (e) { /* a rule must never break generation */ }
  }
  if (done.length) plan.knowledgeApplied = (plan.knowledgeApplied || []).concat(done);
  return done;
}

/* =========================================================================
   6. P3 — قاعدة المعرفة التفاعلية: بحث فوري · إضافة محلية · استرجاع حسب الوصف
   كل شيء محلي: معرفة المستخدم تُحفظ في localStorage وحدها.
   ========================================================================= */
const KN_USER_KEY = 'mirsam.knowledge';

/* تطبيع عربي للبحث: تشكيل · تطويل · ألف · ياء · تاء مربوطة · تمييز صغيرة */
function knNorm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ملحقات عربية ملتصقة (ال · واو العطف · الفاء · الباء · اللام · الكاف):
   تُجرَّب كصيغ بديلة للكلمة، فـ«وشبكه» تجد «شبكه» و«الشبكه» تجد «شبكه» */
function knVariants(w) {
  const out = [w];
  const push = x => { if (x.length >= 3 && !out.includes(x)) out.push(x); };
  if (w.startsWith('لل')) push(w.slice(2));
  if (w.startsWith('ال')) push(w.slice(2));
  for (const p of ['و', 'ف', 'ب', 'ل', 'ك']) if (w.startsWith(p)) push(w.slice(1));
  return out;
}

function loadUserKnowledge() {
  try {
    const v = JSON.parse(localStorage.getItem(KN_USER_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveUserKnowledge(list) {
  try { localStorage.setItem(KN_USER_KEY, JSON.stringify(list)); return true; }
  catch { return false; }   /* quota — the caller shows the message */
}
function addUserKnowledge(item) {
  const list = loadUserKnowledge();
  item.id = 'u' + Date.now();
  item.local = true;
  list.unshift(item);
  const ok = saveUserKnowledge(list);
  return ok ? item : null;
}
function removeUserKnowledge(id) {
  const list = loadUserKnowledge().filter(x => x.id !== id);
  return saveUserKnowledge(list);
}

/* مسطّح المعرفة: المدمجة + المحلية، مع باب القسم */
function allKnowledgeItems() {
  const out = [];
  for (const [section, items] of Object.entries(DESIGN_KNOWLEDGE)) {
    if (!Array.isArray(items)) continue;
    for (const k of items) out.push(Object.assign({ section, local: false }, k));
  }
  for (const u of loadUserKnowledge()) {
    out.push(Object.assign({ section: 'معرفي', local: true }, u));
  }
  return out;
}

/* بحث فوري: كل كلمة (بكل صيغها) تُطبَّق على العنوان (٤) والقاعدة (٣) والنص (٢) والوسوم (٣).
   «مجموعة كلمة» = الصيغة الأصلية للعرض + ملحقاتها للمطابقة؛ يكفي تطابق صيغة واحدة. */
function knWordGroups(query) {
  const groups = [];
  for (const w of knNorm(query).split(' ')) {
    if (w.length <= 1) continue;
    const vs = knVariants(w);
    if (!groups.some(g => g.forms[0] === vs[0])) groups.push({ word: w, forms: vs });
  }
  return groups;
}

function searchKnowledge(query, limit = 12) {
  const groups = knWordGroups(query);
  if (!groups.length) return [];
  const hits = [];
  for (const item of allKnowledgeItems()) {
    const hay = {
      title: knNorm(item.title),
      rule: knNorm(item.rule || ''),
      body: knNorm(item.body || ''),
      tags: knNorm((item.tags || []).join(' '))
    };
    let score = 0, matchedAll = true;
    for (const g of groups) {
      let s = 0;
      for (const t of g.forms) {
        if (hay.title.includes(t)) s += 4;
        if (hay.tags.includes(t)) s += 3;
        if (hay.rule.includes(t)) s += 3;
        if (hay.body.includes(t)) s += 2;
      }
      if (!s) matchedAll = false;
      score += s;
    }
    if (score > 0) hits.push({ item, score, matchedAll });
  }
  hits.sort((a, b) => (b.matchedAll - a.matchedAll) || (b.score - a.score));
  return hits.slice(0, limit);
}

/* استرجاع المعرفة حسب وصف تصميم: أعلى المطابقات + سبب الاستدعاء */
const KN_STOP = new Set(('من في على عن إلى مع هذا هذه ذلك التي الذي كان يكون لها له فيها قد كل شيء بعد قبل عند عندما أريد نريد تصميم منشور عبارة' +
  ' انستغرام فيسبوك تويتر واتساب لعمل عملنا مشروعنا').split(' ').map(knNorm));

function retrieveKnowledgeForDescription(desc, limit = 6) {
  const groups = knWordGroups(desc).filter(g => !KN_STOP.has(g.word));
  if (!groups.length) return [];
  return searchKnowledge(groups.map(g => g.word).join(' '), limit * 2).slice(0, limit).map(h => {
    const where = [];
    const title = knNorm(h.item.title), rule = knNorm(h.item.rule || ''), body = knNorm(h.item.body || '');
    for (const g of groups) {
      if (g.forms.some(w => title.includes(w) || rule.includes(w) || body.includes(w))) where.push(g.word);
    }
    return {
      item: h.item,
      why: where.length
        ? `طابقت كلمات وصفك: ${[...new Set(where)].slice(0, 4).join(' · ')}`
        : 'مترابطة مع الوصف'
    };
  });
}

/* =========================================================================
   7. P3 — مكتبة المراجع الشخصية (رفع · وسوم · مجموعات) — محلية بالكامل
   الصور تُصغَّر إلى data URL قبل الحفظ (localStorage محدود ~5MB).
   ========================================================================= */
const LIB_KEY = 'mirsam.refLibrary';
const LIB_MAX_PX = 640;        /* أقصى ضلع محفوظ للصورة */
const LIB_MAX_ITEMS = 40;      /* سقف عتادي يمنع امتلاء التخزين */

function loadRefLibrary() {
  try {
    const v = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveRefLibrary(list) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(list)); return true; }
  catch { return false; }
}

/* ملف صورة → data URL مصغَّر (Canvas محلي، بلا رفع لأي خادم) */
function shrinkImageFile(file, maxPx = LIB_MAX_PX) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '')) { reject(new Error('الملف ليس صورة')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تعذّرت قراءة الصورة'));
      img.onload = () => {
        const k = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k));
        const h = Math.max(1, Math.round(img.height * k));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/jpeg', 0.82)); }
        catch (e) { reject(new Error('تعذّر ضغط الصورة')); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function addRefToLibrary(rec) {
  const list = loadRefLibrary();
  if (list.length >= LIB_MAX_ITEMS) return { err: `بلغت الحد ${arNum(LIB_MAX_ITEMS)} مراجعًا — احذف بعضها أولًا` };
  rec.id = 'r' + Date.now();
  rec.created = Date.now();
  list.unshift(rec);
  if (!saveRefLibrary(list)) return { err: 'امتلئ التخزين المحلي — احذف مراجعًا أو صغّر صورها' };
  return { rec };
}
function removeRefFromLibrary(id) {
  const list = loadRefLibrary().filter(r => r.id !== id);
  return saveRefLibrary(list);
}

/* البحث داخل المكتبة: نص + وسم + مجموعة (تُكفي صيغة واحدة من صيغ كل كلمة) */
function searchRefLibrary(query, list) {
  const src = list || loadRefLibrary();
  if (!knNorm(query)) return src;
  const groups = knWordGroups(query);
  return src.filter(r => {
    const hay = knNorm([r.name, r.group || '', (r.tags || []).join(' ')].join(' '));
    return groups.every(g => g.forms.some(t => hay.includes(t)));
  });
}
function refLibraryGroups(list) {
  const src = list || loadRefLibrary();
  return [...new Set(src.map(r => r.group).filter(Boolean))];
}
function refLibraryTags(list) {
  const src = list || loadRefLibrary();
  const counts = {};
  for (const r of src) for (const t of (r.tags || [])) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 14).map(e => e[0]);
}

/* =========================================================================
   8. P3 — مُحلّل المراجع بالرؤية (اختياري · مسار Gemini فقط)
   الواجهة موجودة دائمًا؛ التنفيذ لا يعمل بلا مفتاح محلي،
   وأي فشل يُبلَّغ برسالته الحقيقية — لا ادّعاء بلا اختبار.
   ========================================================================= */
function visionAvailable() {
  const cfg = loadAIConfig();
  return !!(cfg && cfg.key && cfg.provider === 'gemini');
}

async function analyzeRefByVision(dataUrl, question) {
  const cfg = loadAIConfig();
  if (!cfg || !cfg.key) throw new Error('لا مفتاح محفوظ — المُحلّل يحتاج مفتاح Gemini في «فهم الوصف»');
  if (cfg.provider !== 'gemini') throw new Error('المُحلّل البصري مساره Gemini حاليًا — بدّل المزوّد');
  const b64 = String(dataUrl).split(',')[1] || '';
  const m = String(dataUrl).match(/^data:(image\/[\w.+-]+);base64,/);
  const url = AI_PROVIDERS.gemini.endpoint(cfg.model || AI_PROVIDERS.gemini.model, cfg.key);
  const prompt = `حلّل هذا المرجع التصميمي بصريًا: الأسلوب السائد، الباليتة اللونية (أكواد تقريبية)،` +
    ` التكوين والتسلسل، والزخرفة. ثم أجب باختصار: ${question || 'كيف يمكن الاستفادة منه في تصميم عربي؟'}` +
    ` أعد JSON حصريًا: {"style":"وصف قصير","palette":["#RRGGBB",...],"composition":"وصف قصير",` +
    `"deco":"وصف قصير","advice":"نصيحة عملية واحدة للتصميم العربي"}`;
  const payload = {
    contents: [{ parts: [
      { inline_data: { mime_type: m ? m[1] : 'image/jpeg', data: b64 } },
      { text: prompt }
    ] }],
    generationConfig: { responseMimeType: 'application/json' }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`الخادم ردّ ${res.status} — ${body.slice(0, 140)}`);
  }
  const json = await res.json().catch(() => null);
  const text = AI_PROVIDERS.gemini.read(json);
  return extractJSON(text);
}
