/* tests/web/phase2.js — Phase 2A/2B checks (browser side)
   A) patch render: one layer edit changes exactly that layer, re-renders
      WITHOUT calling runLoop (no makePlan, no correction loop), refreshes the
      measured QA numbers, and stays idempotent across repeated edits.
   B) AI cache: identical (provider·model·endpoint·prompt) = 0 new network
      calls; a different prompt/model = a new call; the workflow path
      (runAIParse twice) issues one request.

   RUN: await runPhase2Checks()  on a loaded app page.                */
'use strict';

window.runPhase2Checks = async function runPhase2Checks() {
  const failures = [];
  const fail = m => failures.push(m);
  const out = { failures };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const stable = async () => { for (let i = 0; i < 400 && document.getElementById('generate').disabled; i++) await wait(40); await wait(150); };

  if (!lastPlan) { for (let i = 0; i < 200 && !lastPlan; i++) await wait(100); }
  if (!lastPlan) { failures.push('no design loaded'); out.ok = false; return out; }

  /* ================= A) patch render ================= */
  {
    const realLoop = window.runLoop;
    let loopCalls = 0;
    window.runLoop = function () { loopCalls++; return realLoop.apply(this, arguments); };
    try {
      const key = 'subhead';
      const prevRes = lastRes;
      const before = JSON.parse(JSON.stringify(lastPlan.elements));
      const t0 = performance.now();
      setOverride(key, { dx: 6 }, 'اختبار ترقيع');
      /* wait for the debounced patch to land (debounce 120ms + render) */
      for (let i = 0; i < 200 && lastRes === prevRes; i++) await wait(25);
      const patchMs = Math.round(performance.now() - t0);
      await stable();

      const after = lastPlan.elements;
      const changed = after.filter((e, i) => JSON.stringify(e) !== JSON.stringify(before[i])).map(e => e.key);
      out.patch = {
        key, patchMs, loopCalls, renderUIupdated: lastRes !== prevRes,
        changedLayers: changed,
        movedBy: (after.find(e => e.key === key) || {}).x - (before.find(e => e.key === key) || {}).x,
        reportContrast: lastRes.report.maxContrast, result: lastRes.result
      };
      if (loopCalls !== 0) fail(`patch ran the correction loop ${loopCalls} time(s) — it must not rebuild`);
      if (lastRes === prevRes) fail('patch did not render a new state');
      if (changed.length !== 1 || changed[0] !== key) fail(`patch changed ${JSON.stringify(changed)} instead of only ${key}`);
      if (out.patch.movedBy !== 6) fail(`patch offset ${out.patch.movedBy} != 6`);
      if (!(lastRes.report && typeof lastRes.report.maxContrast === 'number')) fail('patch did not refresh measured QA');

      /* idempotent: apply the same patch again — offset must stay 6, not 12 */
      const prev2 = lastRes;
      setOverride(key, { dx: 6 }, 'اختبار ترقيع 2');
      for (let i = 0; i < 200 && lastRes === prev2; i++) await wait(25);
      await stable();
      const x2 = (lastPlan.elements.find(e => e.key === key) || {}).x;
      out.patch.repeatOffset = x2 - (before.find(e => e.key === key) || {}).x;
      if (out.patch.repeatOffset !== 6) fail(`repeated patch drifted to ${out.patch.repeatOffset} (idempotence broken)`);
      if (loopCalls !== 0) fail('repeated patch rebuilt the design');

      /* a later full regeneration must still produce the same result (edit survives) */
      const xPatch = x2;
      await generate(); await stable();
      const xRegen = (lastPlan.elements.find(e => e.key === key) || {}).x;
      out.patch.survivesRegeneration = xRegen === xPatch;
      if (!out.patch.survivesRegeneration) fail(`edit lost on regeneration: ${xRegen} != ${xPatch}`);

      /* cleanup */
      delete overrides[key]; saveOverrides(); localStorage.removeItem('mirsam.overrides');
      await generate(); await stable();
    } finally { window.runLoop = realLoop; }
  }

  /* ================= B) AI cache ================= */
  {
    const realFetch = window.fetch;
    let fetches = 0;
    window.fetch = function (url, opts) {
      fetches++;
      const prompt = String((opts && opts.body) || '');
      const payload = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: 'مخبأ', n: fetches }) }] } }] });
      void prompt;
      return Promise.resolve(new Response(payload, { status: 200 }));
    };
    try {
      clearAiCache();
      const cfg = { provider: 'gemini', model: 'gemini-1.5-flash', key: 'TESTKEYCACHE', endpoint: '' };
      const p1 = 'تحليل وصف تصميم للاختبار';
      await callTextAPI(cfg, p1); const afterFirst = fetches;
      const j2 = await callTextAPI(cfg, p1); const afterSecond = fetches;
      await callTextAPI(cfg, p1 + ' مختلف'); const afterThird = fetches;
      await callTextAPI(Object.assign({}, cfg, { model: 'gemini-1.5-pro' }), p1); const afterModel = fetches;
      await callTextAPI(Object.assign({}, cfg, { key: 'OTHERKEY' }), p1); const afterKey = fetches;

      out.cache = {
        afterFirst, afterSecond, afterThird, afterModel, afterKey,
        j2same: !!(j2 && j2.candidates),
        stats: { hits: aiCacheStats.hits, misses: aiCacheStats.misses }
      };
      if (afterFirst !== 1) fail(`first call should make 1 request, made ${afterFirst}`);
      if (afterSecond !== 1) fail(`identical repeat made ${afterSecond - afterFirst} new request(s) — must be 0`);
      if (afterThird !== 2) fail(`different prompt did not make a new request (${afterThird})`);
      if (afterModel !== 3) fail(`different model reused the cache (${afterModel})`);
      /* the key itself is deliberately NOT part of the cache key: a response is
         determined by provider·model·endpoint·prompt, and keeping key material
         out of cache keys means no secret is ever persisted in one */
      if (afterKey !== 3) fail(`changing the key should still reuse the cached response (made ${afterKey - afterModel} new request(s))`);
      if (!out.cache.j2same) fail('cached response not returned');

      /* workflow path: runAIParse twice with the same brief -> one request total */
      fetches = 0;
      clearAiCache();
      localStorage.setItem('mirsam.ai', JSON.stringify(cfg));
      document.getElementById('prompt').value = 'بوستر اختبار التخزين المؤقت';
      const f0 = fetches;
      await runAIParse(); await stable();
      const f1 = fetches;
      await runAIParse(); await stable();
      const f2 = fetches;
      out.cache.workflow = { first: f1 - f0, repeat: f2 - f1 };
      if (f1 - f0 !== 1) fail(`runAIParse first run made ${f1 - f0} requests`);
      if (f2 - f1 !== 0) fail(`runAIParse identical repeat made ${f2 - f1} requests — must be 0`);
    } finally {
      window.fetch = realFetch;
      localStorage.removeItem('mirsam.ai');
      clearAiCache();
    }
  }

  out.ok = failures.length === 0;
  return out;
};