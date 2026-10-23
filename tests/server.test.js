'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sd-srv-')), 'state.json');
process.env.STATE_FILE = stateFile;
const { server } = require('../server');
let base;
const call = async (p, m = 'GET', b) => { const r = await fetch(base + p, { method: m, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); return r.headers.get('content-type').includes('json') ? r.json() : r; };
test.before(() => new Promise(ok => server.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; ok(); })));
test.after(() => server.close());

test('API replay and persistence on disk', async () => {
  assert.equal((await call('/api/import/sample', 'POST', { name: 'initial' })).added, 44);
  assert.equal((await call('/api/import/sample', 'POST', { name: 'initial', shuffle: true })).ignored_same, 44);
  const m7 = (await call('/api/records')).find(d => d.ref === 'M07');
  await call(`/api/records/${encodeURIComponent(m7.key)}/override`, 'POST', { routes: ['customer_followup'], note: 't' });
  const up = await call('/api/import/sample', 'POST', { name: 'update' }); assert.equal(up.updated, 1); assert.equal(up.usable_after, 18);
  const again = await call('/api/import/sample', 'POST', { name: 'initial' }); assert.equal(again.ignored_same + again.ignored_older, 44);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(stateFile, 'utf8')).records).length, 44);   // what a restart loads
  const d = await call('/api/records/' + encodeURIComponent(m7.key)); assert.equal(d.route_source, 'manual'); assert.equal(d.revision, 2);
});
test('errors are JSON, not crashes', async () => {
  assert.ok((await call('/api/import', 'POST', { nope: 1 })).error.length > 0);
  assert.equal((await call('/api/records/nope')).error, 'Unknown record');
  assert.equal((await fetch(base + '/api/import', { method: 'POST', body: '{bad' })).status, 400);
});
test('zip endpoint and static page', async () => {
  const z = await call('/api/export.zip'); assert.equal(z.status, 200); assert.ok((await z.arrayBuffer()).byteLength > 1000);
  assert.equal((await fetch(base + '/')).status, 200); assert.equal((await fetch(base + '/%2e%2e/server.js')).status, 404);
});
test('health check, gzip and caching headers', async () => {
  assert.equal((await call('/healthz')).ok, true);
  const r = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'gzip' } }); assert.equal(r.headers.get('content-encoding'), 'gzip');
  const etag = r.headers.get('etag'); assert.ok(etag);
  assert.equal((await fetch(base + '/app.js', { headers: { 'if-none-match': etag } })).status, 304);
  const a = await call('/api/metrics'), b = await call('/api/metrics'); assert.deepEqual(a, b);   // second answer comes from the memo
});
