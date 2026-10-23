'use strict';
// Every finding must be traceable to the source: quotes are checked against the sample data, and numbers against the engine.
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../lib/engine'), { segmentsOf } = require('../lib/analyze'), F = require('../docs/findings.json');
const s = E.newState(); E.importBatch(s, require('../sample/01_initial.json')); E.importBatch(s, require('../sample/02_update.json'));
const find = ref => Object.values(s.records).find(r => r.record_ref === ref);
const norm = x => x.replace(/\s+/g, ' ').toLowerCase();

test('every finding quote appears in the cited source text', () => {
  let n = 0;
  for (const f of F.findings) for (const e of f.evidence) {
    const rec = find(e.ref); assert.ok(rec, e.ref);
    if (e.quote) {
      let hay;
      if (e.turn) hay = rec.transcript_payload.turns[e.turn - 1].text;
      else if (e.field === 'transcript_payload.unavailable_reason') hay = rec.transcript_payload.unavailable_reason;
      else hay = segmentsOf(rec).map(x => x.text).join(' ');
      assert.ok(norm(hay).includes(norm(e.quote)), `${e.ref}: ${e.quote}`); n++;
    }
    if (e.check) for (const [k, v] of Object.entries(e.check)) assert.equal(rec.payload[k] ?? null, v, `${e.ref}.${k}`);
  }
  assert.ok(n >= 7);
});
test('finding numbers match the engine', () => {
  const m = E.metrics(s), t = id => m.tiles.find(x => x.id === id);
  assert.deepEqual([t('usable').num, t('usable').den, t('usable').pct], [18, 44, 40.9]);
  assert.equal(E.derive(find('M04')).priority.score, 80); assert.equal(E.derive(find('M04')).priority.level, 'high');
  assert.deepEqual(E.derive(find('C09')).routes, ['coaching', 'outreach_log']);
  const call = Object.values(s.records).filter(r => r.source_type === 'call');
  assert.equal(call.filter(r => r.payload.is_connected).length, 11);
  assert.equal(call.filter(r => r.payload.is_connected && E.derive(r).state === 'analysed').length, 9);
});
