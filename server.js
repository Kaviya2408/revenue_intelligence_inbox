'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const E = require('./lib/engine'), store = require('./lib/store');
const { buildExport, writeExport } = require('./lib/exporter');
const { makeZip } = require('./lib/zip');
const { segmentsOf, ROUTES, STATES } = require('./lib/analyze');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';          // Render needs 0.0.0.0
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'data', 'state.json');
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, 'export');
const SAMPLES = { initial: 'sample/01_initial.json', update: 'sample/02_update.json' };
let state = store.load(STATE_FILE), zipCache = null;
// On hosts with an ephemeral disk (Render free tier) the file is empty after each deploy; SEED_SAMPLES=1 loads the demo deliveries once.
if (process.env.SEED_SAMPLES === '1' && !Object.keys(state.records).length) {
  for (const f of Object.values(SAMPLES)) E.importBatch(state, JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')));
  try { store.save(STATE_FILE, state); } catch (e) { console.warn('Could not persist seed:', e.message); }
}
let builtCache = null;
const built = () => (builtCache && builtCache.v === state.version ? builtCache.b : (builtCache = { v: state.version, b: buildExport(state) }).b);
const persist = () => store.save(STATE_FILE, state);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
// Responses are gzipped when the client allows it. GET JSON is memoised per state version, so repeated
// dashboard loads cost nothing until data actually changes.
const cache = new Map();
function send(res, code, type, payload, headers = {}) {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const h = { 'content-type': type, vary: 'accept-encoding', ...headers };
  if (buf.length > 1024 && /\bgzip\b/.test((res.req && res.req.headers['accept-encoding']) || '')) {
    h['content-encoding'] = 'gzip'; const z = zlib.gzipSync(buf, { level: 6 }); h['content-length'] = z.length; res.writeHead(code, h); return res.end(z);
  }
  h['content-length'] = buf.length; res.writeHead(code, h); res.end(buf);
}
const json = (res, code, body) => {
  const s = JSON.stringify(body);
  if (res.ck && code === 200) { if (cache.size > 300) cache.clear(); cache.set(res.ck, { v: state.version, s }); }
  send(res, code, 'application/json; charset=utf-8', s, { 'cache-control': 'no-store' });
};
const readBody = req => new Promise((ok, no) => { let n = 0; const c = []; req.on('data', b => { n += b.length; if (n > 30e6) { no(new Error('Body too large')); req.destroy(); } else c.push(b); }); req.on('end', () => ok(Buffer.concat(c).toString('utf8'))); req.on('error', no); });

function detail(key) {
  const rec = state.records[key]; if (!rec) return null;
  return { ...E.derive(rec), manual: rec.manual, analysis: rec.analysis, segments: segmentsOf(rec), payload: rec.payload,
    transcript_note: rec.transcript_payload && rec.transcript_payload.unavailable_reason || null, first_seen_at: rec.first_seen_at, updated_at: rec.updated_at };
}

async function api(req, res, url) {
  const p = url.pathname, m = req.method, qs = Object.fromEntries(url.searchParams);
  let mt;
  if (m === 'GET') { const ck = p + '?' + url.search; const hit = cache.get(ck); if (hit && hit.v === state.version) return send(res, 200, 'application/json; charset=utf-8', hit.s, { 'cache-control': 'no-store' }); if (p !== '/api/export.zip') res.ck = ck; }
  if (m === 'GET' && p === '/api/meta') return json(res, 200, { routes: ROUTES, states: STATES, defs: E.DEFS, samples: Object.keys(SAMPLES), version: state.version });
  if (m === 'GET' && p === '/api/metrics') return json(res, 200, { ...E.metrics(state, qs), version: state.version });
  if (m === 'GET' && p === '/api/records') return json(res, 200, E.applyFilter(E.deriveAll(state), { ...qs, review: qs.review === '1' }));
  if (m === 'GET' && (mt = p.match(/^\/api\/records\/(.+)$/))) { const d = detail(decodeURIComponent(mt[1])); return d ? json(res, 200, d) : json(res, 404, { error: 'Unknown record' }); }
  if (m === 'GET' && p === '/api/imports') return json(res, 200, state.imports);
  if (m === 'GET' && p === '/api/manifest') return json(res, 200, built().manifest);
  if (m === 'GET' && p === '/api/export.zip') {
    if (!zipCache || zipCache.v !== state.version) zipCache = { v: state.version, buf: makeZip(built().files) };
    res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="salesdesk-export.zip"', 'content-length': zipCache.buf.length }); return res.end(zipCache.buf);
  }
  if (m === 'GET' && p === '/api/export/file') { const f = built().files[qs.path]; if (f === undefined) return json(res, 404, { error: 'No such file' }); return send(res, 200, 'text/plain; charset=utf-8', f); }
  if (m === 'GET' && p === '/api/export/list') return json(res, 200, Object.keys(built().files).sort());
  if (m !== 'POST' && m !== 'DELETE') return json(res, 405, { error: 'Method not allowed' });

  const body = m === 'POST' ? await readBody(req) : '';
  const data = body ? JSON.parse(body) : {};
  if (p === '/api/import') { const rep = E.importBatch(state, data.batch || data, { shuffle: !!data.shuffle }); persist(); return json(res, 200, rep); }
  if (p === '/api/import/sample') {
    const f = SAMPLES[data.name]; if (!f) return json(res, 400, { error: 'Unknown sample' });
    const rep = E.importBatch(state, JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')), { shuffle: !!data.shuffle }); persist(); return json(res, 200, rep);
  }
  if (p === '/api/reset') { state = E.newState(); persist(); return json(res, 200, { ok: true }); }
  if (p === '/api/export/write') { const r = writeExport(state, EXPORT_DIR); return json(res, 200, { dir: EXPORT_DIR, files: r.files }); }
  if ((mt = p.match(/^\/api\/records\/(.+)\/(override|acknowledge|reanalyse)$/))) {
    const key = decodeURIComponent(mt[1]);
    if (!state.records[key]) return json(res, 404, { error: 'Unknown record' });
    if (mt[2] === 'override') m === 'DELETE' ? E.clearOverride(state, key) : E.setOverride(state, key, data.routes, data.note);
    if (mt[2] === 'acknowledge') E.acknowledgeSuggestion(state, key);
    if (mt[2] === 'reanalyse') E.reanalyse(state, key);
    persist(); return json(res, 200, detail(key));
  }
  return json(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/healthz') return json(res, 200, { ok: true, records: Object.keys(state.records).length });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const file = path.normalize(path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    const buf = fs.readFileSync(file), etag = '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag }); return res.end(); }
    return send(res, 200, MIME[path.extname(file)] || 'application/octet-stream', buf, { etag, 'cache-control': 'no-cache' });
  } catch (e) { json(res, e instanceof SyntaxError ? 400 : 500, { error: e.message }); }
});
if (require.main === module) server.listen(PORT, HOST, () => console.log(`SalesDesk listening on ${HOST}:${PORT}  (state: ${STATE_FILE})`));
module.exports = { server };
