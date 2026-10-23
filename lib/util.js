'use strict';
// Small shared helpers. No dependencies.

function fnv1a(str) {
  const bytes = Buffer.from(String(str), 'utf8');
  let h = 0x811c9dc5;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const keyOf = (type, id) => `${type}:${id}`;

function slugify(s, max = 40) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'untitled';
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const toCsv = (cols, rows) =>
  [cols.join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n') + '\n';

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const uniq = a => [...new Set(a)];
const clip = (s, n = 220) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') );

module.exports = { fnv1a, keyOf, slugify, csvCell, toCsv, pct, uniq, clip };
