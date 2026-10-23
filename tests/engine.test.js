'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const E = require('../lib/engine'), { buildExport, writeExport } = require('../lib/exporter');
const { makeZip } = require('../lib/zip'), { segmentsOf } = require('../lib/analyze');
const A = require('../sample/01_initial.json'), B = require('../sample/02_update.json');
const find = (s, ref) => Object.values(s.records).find(r => r.record_ref === ref);

function replay() {
  const s = E.newState(), log = {};
  log.r1 = E.importBatch(s, A);
  log.r2 = E.importBatch(s, A, { shuffle: true });
  E.setOverride(s, find(s, 'M07').key, ['customer_followup'], 'provisional');
  log.r4 = E.importBatch(s, B);
  log.r5 = E.importBatch(s, A);
  return { s, log };
}

test('import contract replay', () => {
  const { s, log } = replay();
  assert.equal(log.r1.added, 44); assert.equal(log.r1.usable_after, 17);
  assert.deepEqual([log.r2.added, log.r2.updated, log.r2.ignored_same], [0, 0, 44]);
  assert.equal(log.r4.updated, 1); assert.equal(log.r4.usable_after, 18); assert.equal(log.r4.unique_after, 44);
  assert.deepEqual([log.r5.added, log.r5.updated, log.r5.ignored_same + log.r5.ignored_older], [0, 0, 44]);
  assert.equal(log.r5.ignored_older, 1);   // M07 is at revision 2, so revision 1 of it is older
  const d = E.derive(find(s, 'M07'));
  assert.equal(d.revision, 2); assert.equal(d.state, 'analysed'); assert.equal(d.route_source, 'manual'); assert.deepEqual(d.routes, ['customer_followup']);
});

test('update replaces the whole record and touches nothing else', () => {
  const s = E.newState(); E.importBatch(s, A);
  const snap = () => JSON.stringify(Object.values(s.records).filter(r => r.record_ref !== 'M07').map(r => [r.payload, r.revision, r.analysis.text_fingerprint]));
  const before = snap(); E.importBatch(s, B);
  assert.equal(snap(), before); assert.equal(find(s, 'M07').transcript_payload.turns.length, 27);
});

test('a null in a newer revision replaces rather than merges', () => {
  const s = E.newState(); E.importBatch(s, A);
  const r = JSON.parse(JSON.stringify(B)); r.records[0].transcript_payload = null; r.revision = 3;
  E.importBatch(s, r); assert.equal(find(s, 'M07').transcript_payload, null); assert.equal(find(s, 'M07').revision, 3);
});

test('identity is (source_type, source_id), not ref or position', () => {
  const s = E.newState(); E.importBatch(s, A);
  const c = JSON.parse(JSON.stringify(A)); c.records.forEach(r => { r.record_ref = 'X'; }); c.records.reverse();
  const rep = E.importBatch(s, c); assert.equal(rep.added, 0); assert.equal(Object.keys(s.records).length, 44);
});

test('bad records are rejected, not crashed on', () => {
  const s = E.newState();
  const rep = E.importBatch(s, { batch_id: 'x', revision: 1, records: [{ source_type: 'email', source_id: '1', payload: {} }, null, { source_type: 'call', source_id: 'a', payload: { id: 'b' } }] });
  assert.equal(rep.rejected.length, 3); assert.equal(rep.added, 0);
  assert.throws(() => E.importBatch(s, { nope: 1 }));
});

test('manual route survives a changed suggestion and can be acknowledged or reset', () => {
  const { s } = replay(); const k = find(s, 'M07').key;
  assert.equal(E.derive(s.records[k]).suggestion_changed, true);
  E.acknowledgeSuggestion(s, k); assert.equal(E.derive(s.records[k]).suggestion_changed, false);
  E.clearOverride(s, k); assert.equal(E.derive(s.records[k]).route_source, 'suggested');
  assert.throws(() => E.setOverride(s, k, ['nonsense']));
});

test('every evidence quote is an exact prefix of its source segment', () => {
  const { s } = replay(); let n = 0;
  for (const rec of Object.values(s.records)) {
    const segs = segmentsOf(rec), a = rec.analysis; if (!segs.length) continue;
    const evs = [...a.routes.flatMap(r => r.evidence), ...a.commitments.map(c => c.evidence), ...a.objections];
    for (const e of evs) { const seg = segs.find(x => x.n === e.n); assert.ok(seg && seg.text.startsWith(e.quote), `${rec.record_ref} ${e.n}`); n++; }
  }
  assert.ok(n > 50);
});

test('stale analysis is detected when the text no longer matches', () => {
  const { s } = replay(); const rec = find(s, 'C03'); assert.equal(E.freshness(rec), 'current');
  rec.payload = { ...rec.payload, transcript: rec.payload.transcript + ' One more sentence.' };
  assert.equal(E.freshness(rec), 'stale'); E.reanalyse(s, rec.key); assert.equal(E.freshness(rec), 'current');
});

test('metrics carry numerators and denominators; filters narrow them', () => {
  const { s } = replay(); const m = E.metrics(s), t = id => m.tiles.find(x => x.id === id);
  assert.deepEqual([t('usable').num, t('usable').den], [18, 44]); assert.deepEqual([t('connected').num, t('connected').den], [11, 30]);
  assert.equal(E.metrics(s, { type: 'call' }).tiles[0].num, 30);
  assert.equal(E.metrics(s, { person: 'arun@example.com' }).tiles[0].num, 16);   // 15 calls + 1 meeting organised
  assert.ok(t('usable').definition.length > 20);
});

test('export: manifest complete, paths exist, repeat export identical, superseded not exported', () => {
  const { s } = replay(); const a = buildExport(s), b = buildExport(s);
  assert.deepEqual(a.files, b.files); assert.equal(a.manifest.records.length, 44);
  for (const r of a.manifest.records) for (const p of r.output_paths) assert.ok(a.files[p] !== undefined, p);
  const m7 = a.manifest.records.find(r => r.record_ref === 'M07');
  assert.equal(m7.manual_override, true); assert.equal(m7.analysis_freshness, 'current');
  E.setOverride(s, find(s, 'M04').key, ['coaching']);
  const c = buildExport(s), m4 = c.manifest.records.find(r => r.record_ref === 'M04');
  assert.ok(m4.superseded_routes.length > 0);
  for (const sup of m4.superseded_routes) assert.ok(!Object.keys(c.files).some(p => p.includes(`_${sup}/M04__`)));
});

test('changing a route moves the output rather than duplicating it', () => {
  const { s } = replay(); const k = find(s, 'M04').key;
  const where = () => Object.keys(buildExport(s).files).filter(p => /\/M04__/.test(p) && p.startsWith('routes/'));
  const before = where(); E.setOverride(s, k, ['coaching']); const after = where();
  assert.equal(after.length, 1); assert.ok(after[0].includes('coaching')); assert.ok(before.length >= 1);
});

test('writeExport replaces the folder (no stale files)', () => {
  const { s } = replay(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
  fs.writeFileSync(path.join(dir, 'leftover.txt'), 'old'); writeExport(s, dir);
  assert.ok(!fs.existsSync(path.join(dir, 'leftover.txt'))); assert.ok(fs.existsSync(path.join(dir, 'manifest.json')));
  const n = fs.readdirSync(dir, { recursive: true }).length; writeExport(s, dir); assert.equal(fs.readdirSync(dir, { recursive: true }).length, n);
});

test('records without text become intake-only', () => {
  const { s } = replay(); const st = {};
  for (const r of Object.values(s.records)) { const d = E.derive(r); st[d.state] = (st[d.state] || 0) + 1; }
  assert.deepEqual(st, { analysed: 18, no_text_logged: 20, silent_recording: 3, not_captured: 3 });
  assert.deepEqual(E.derive(find(s, 'M05')).routes, ['intake_only']);
});

test('zip is a valid archive', () => {
  // Basic validation: zip has correct headers and structure
  const zip = makeZip({ 'a/b.txt': 'hello', 'c.csv': 'x,y\n1,2\n' });
  assert(Buffer.isBuffer(zip));
  assert(zip.length > 100);
  // Local file header signature (PK\x03\x04)
  assert.strictEqual(zip.readUInt32LE(0), 0x04034b50);
  // Central directory signature should appear later
  assert(zip.toString('latin1').includes('PK\x01\x02'));
  // End of central directory signature (PK\x05\x06)
  assert(zip.toString('latin1').includes('PK\x05\x06'));
  // Filenames should be present
  assert(zip.toString('latin1').includes('a/b.txt'));
  assert(zip.toString('latin1').includes('c.csv'));
});
