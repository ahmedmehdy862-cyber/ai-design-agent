/* tests/html-encoding.js — guard against mojibake in the shipped page
   ------------------------------------------------------------------
   web/index.html was once written as UTF-8 bytes decoded as cp1252 and
   re-encoded, so every static label rendered as "Ù…Ø±Ø³Ù…" in production
   while the canvas text (built in JS) stayed correct. This check makes that
   regression impossible to ship again.

   RUN: node tests/html-encoding.js        (exit 0 = clean, 1 = broken)  */
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'web', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const failures = [];

const arabic = (html.match(/[\u0600-\u06FF]/g) || []).length;
const arabicInBody = (html.match(/>[^<>]*[\u0600-\u06FF][^<>]*</g) || []).length;
const replacement = (html.match(/\uFFFD/g) || []).length;
/* the classic double-encoding fingerprints */
const mojibake = (
  html.match(/\u00C3[\u0080-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g) || []
).length + (html.match(/\u00D9[\u0080-\u00BF\u2026\u20AC]/g) || []).length;

if (arabic < 500) failures.push(`only ${arabic} Arabic characters — the static UI lost its Arabic text`);
if (arabicInBody < 100) failures.push(`only ${arabicInBody} Arabic text nodes inside tags`);
if (replacement > 0) failures.push(`${replacement} U+FFFD replacement characters`);
if (mojibake > 5) failures.push(`${mojibake} mojibake sequences (double-encoded UTF-8)`);

const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || '';
if (!/[\u0600-\u06FF]/.test(title)) failures.push('title has no Arabic');
if (title.includes('\u00D9') || title.includes('\u00C3')) failures.push('title looks mojibake: ' + title);

const out = { file, arabic, arabicInBody, replacement, mojibake, title, ok: failures.length === 0, failures };
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
