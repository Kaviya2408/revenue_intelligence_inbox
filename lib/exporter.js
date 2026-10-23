'use strict';
// Builds the organised export from CURRENT state only. Re-running it never creates a second active copy:
// the output is a pure function of state, and writing to disk replaces the target folder.
const fs = require('fs'), path = require('path');
const { derive, deriveAll, metrics } = require('./engine');
const { ROUTES, ROUTE_ORDER, STATES } = require('./analyze');
const { slugify, toCsv, fnv1a } = require('./util');

const nn = r => String(ROUTE_ORDER.indexOf(r) + 1).padStart(2, '0');
function fileSlug(rec, d) {
  const p = rec.payload;
  return slugify(rec.source_type === 'meeting' ? p.title : `${p.rep_name || 'rep'}-${p.direction || 'call'}-${String(p.started_at || '').slice(0, 10)}`, 48);
}
const q = e => `> “${e.quote}”${e.speaker ? ' — ' + e.speaker : ''}${e.n ? ` (${e.speaker ? 'turn' : 'sentence'} ${e.n})` : ''}`;

function recordMd(rec, d, route) {
  const a = rec.analysis, r = a.routes.find(x => x.route === route);
  const L = [`# ${d.ref} · ${d.title}`, '', `- Source: ${rec.source_type} \`${rec.source_id}\` · revision ${rec.revision}`,
    `- Person: ${d.person} · When: ${d.when || 'unknown'}`,
    `- Route here: **${ROUTES[route]}** (${d.route_source})${d.manual_override && rec.manual.note ? ' · note: ' + rec.manual.note : ''}`,
    `- Priority: ${d.priority.level} (${d.priority.score}) · Analysis: ${d.freshness} · Confidence: ${d.confidence}`, '',
    '## Summary', a.summary, ''];
  if (r) L.push('## Why this route', r.why, '', ...r.evidence.map(q), '');
  if (a.commitments.length) L.push('## Commitments', ...a.commitments.map(c => `- ${c.text} — owner: ${c.owner}${c.due ? ', due: ' + c.due : ''}`), '');
  if (a.objections.length) L.push('## Objections / concerns', ...a.objections.map(q), '');
  if (d.review.length) L.push('## Needs review', ...d.review.map(x => '- ' + x), '');
  L.push('## Not established', ...a.not_established.map(x => '- ' + x), '');
  return L.join('\n');
}

function briefMd(state) {
  const m = metrics(state), all = deriveAll(state), by = k => all.find(d => d.key === k);
  const t = id => m.tiles.find(x => x.id === id);
  const fmt = x => x.den ? `${x.num}/${x.den} (${x.pct}%)` : String(x.num);
  const L = ['# Manager brief', '', `State version ${state.version} · ${all.length} records`, '',
    '## Numbers (with denominators)', ...m.tiles.map(x => `- **${x.label}:** ${fmt(x)} — ${x.definition}`), '', '## Needs attention first'];
  for (const k of m.attention) { const d = by(k); L.push(`- **${d.ref}** ${d.title} — ${d.priority.level} (${d.priority.score}); routes: ${d.routes.map(r => ROUTES[r]).join(', ')}${d.review.length ? '; review: ' + d.review.join(' / ') : ''}`); }
  L.push('', '## By route (records can sit in more than one)');
  for (const r of ROUTE_ORDER) if (m.byRoute[r]) L.push(`- ${ROUTES[r]}: ${m.byRoute[r].n}`);
  L.push('', '## Cannot be analysed', ...Object.entries(m.byState).filter(([s]) => s !== 'analysed').map(([s, v]) => `- ${STATES[s]}: ${v.n}`), '');
  return L.join('\n');
}

function buildExport(state) {
  const files = {}, rows = [];
  for (const rec of Object.values(state.records).sort((a, b) => a.key.localeCompare(b.key))) {
    const d = derive(rec), slug = fileSlug(rec, d), outs = [];
    for (const route of d.routes) {
      const p = `routes/${nn(route)}_${route}/${d.ref}__${slug}.md`;
      files[p] = recordMd(rec, d, route); outs.push(p);
    }
    const rp = `records/${d.ref}__${slug}.json`;
    files[rp] = JSON.stringify({ source_type: rec.source_type, source_id: rec.source_id, revision: rec.revision, source: { payload: rec.payload, transcript_payload: rec.transcript_payload },
      derived: { analysis: rec.analysis, manual_route: rec.manual, resolved_routes: d.routes } }, null, 2);
    outs.push(rp);
    rows.push({ source_type: rec.source_type, source_id: rec.source_id, record_ref: d.ref, applied_revision: rec.revision, batch_id: rec.batch_id,
      routes: d.routes, primary_route: d.primary, route_source: d.route_source, manual_override: d.manual_override,
      superseded_routes: d.superseded, processing_state: d.state, needs_review: d.needs_review, review_reasons: d.review.join(' | '),
      analysis_freshness: d.freshness, priority: d.priority.level, text_fingerprint: rec.analysis && rec.analysis.text_fingerprint, output_paths: outs });
  }
  files['brief/manager_brief.md'] = briefMd(state);
  files['intake/intake_log.csv'] = toCsv(['record_ref', 'source_type', 'source_id', 'processing_state', 'reason'],
    deriveAll(state).filter(d => d.state !== 'analysed').map(d => ({ record_ref: d.ref, source_type: d.type, source_id: d.id, processing_state: d.state,
      reason: (state.records[d.key].analysis || {}).summary })));
  const cols = ['source_type', 'source_id', 'record_ref', 'applied_revision', 'batch_id', 'routes', 'primary_route', 'route_source', 'manual_override',
    'superseded_routes', 'processing_state', 'needs_review', 'review_reasons', 'analysis_freshness', 'priority', 'text_fingerprint', 'output_paths'];
  files['manifest.csv'] = toCsv(cols, rows);
  const body = { schema: 'salesdesk-manifest/1', state_version: state.version, record_count: rows.length,
    note: 'Superseded routes are listed per record but not exported. output_paths are relative to this folder.', records: rows };
  files['manifest.json'] = JSON.stringify(body, null, 2);
  files['README.md'] = ['# Export', '', 'Generated by SalesDesk from the current state. Layout:', '',
    '- `manifest.json` / `manifest.csv`: one row per record, routes, outputs, state, manual flag, analysis freshness',
    '- `brief/manager_brief.md`: numbers with denominators and the attention list',
    '- `routes/NN_<route>/`: one note per record per active route (a manual route replaces the suggested one; the old one is listed as superseded)',
    '- `records/`: full source + derived data per record',
    '- `intake/intake_log.csv`: records with no usable text and why', '',
    `Content digest: ${fnv1a(Object.keys(files).sort().map(k => k + files[k]).join('\n'))}`, ''].join('\n');
  return { files, manifest: body };
}

function writeExport(state, dir) {
  const { files, manifest } = buildExport(state);
  fs.rmSync(dir, { recursive: true, force: true });                   // replace, never accumulate
  for (const [p, c] of Object.entries(files)) { const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return { files: Object.keys(files).length, manifest };
}
module.exports = { buildExport, writeExport };
