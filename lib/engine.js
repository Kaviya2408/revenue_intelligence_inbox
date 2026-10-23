'use strict';
// State, import contract, manual overrides, derived view. Pure functions over a plain state object
// so they are shared by the server, the CLI scripts and the tests.
const { analyse, segmentsOf, textFingerprint, ROUTES, ROUTE_ORDER, ALGO_VERSION } = require('./analyze');
const { keyOf, pct } = require('./util');

const newState = () => ({ schema: 1, version: 0, records: {}, imports: [] });
const isPlainObject = v => v && typeof v === 'object' && !Array.isArray(v);

function validateRecord(r) {
  if (!isPlainObject(r)) return 'record is not an object';
  if (!['call', 'meeting'].includes(r.source_type)) return 'source_type must be "call" or "meeting"';
  if (!r.source_id || typeof r.source_id !== 'string') return 'source_id missing';
  if (!isPlainObject(r.payload)) return 'payload missing';
  if (r.payload.id && r.payload.id !== r.source_id) return 'source_id does not match payload.id';
  return null;
}

/**
 * Apply one delivery. Identity = (source_type, source_id). A strictly higher revision replaces the whole
 * payload + transcript_payload; same or older revisions are ignored. Analysis and manual routes live beside
 * the source and are never part of the replacement.
 */
function importBatch(state, batch, opts = {}) {
  const now = opts.now || new Date().toISOString();
  if (!isPlainObject(batch) || !Array.isArray(batch.records)) throw new Error('Not a delivery: expected { batch_id, revision, records: [...] }');
  const revision = Number.isInteger(batch.revision) ? batch.revision : 1;
  const rep = { batch_id: batch.batch_id || null, revision, received: batch.records.length, added: 0, updated: 0,
    ignored_same: 0, ignored_older: 0, same_revision_changed: 0, rejected: [], changes: [], at: now };
  let order = batch.records;
  if (opts.shuffle) order = [...order].reverse();
  for (const r of order) {
    const bad = validateRecord(r);
    if (bad) { rep.rejected.push({ record_ref: r && r.record_ref || null, reason: bad }); continue; }
    const key = keyOf(r.source_type, r.source_id);
    const cur = state.records[key];
    const incoming = { payload: r.payload, transcript_payload: r.transcript_payload === undefined ? null : r.transcript_payload };
    if (!cur) {
      const rec = { key, source_type: r.source_type, source_id: r.source_id, record_ref: r.record_ref || null, revision,
        batch_id: batch.batch_id || null, first_seen_at: now, updated_at: now, ...incoming, analysis: null, manual: null };
      rec.analysis = analyse(rec, now);
      state.records[key] = rec; rep.added++; rep.changes.push({ key, ref: rec.record_ref, kind: 'added' });
    } else if (revision > cur.revision) {
      const before = describe(cur);
      cur.payload = incoming.payload; cur.transcript_payload = incoming.transcript_payload;   // whole replacement, nulls included
      cur.revision = revision; cur.batch_id = batch.batch_id || cur.batch_id; cur.updated_at = now;
      if (r.record_ref) cur.record_ref = r.record_ref;
      cur.analysis = analyse(cur, now);
      const after = describe(cur);
      rep.updated++; rep.changes.push({ key, ref: cur.record_ref, kind: 'updated', from_revision: before.revision, to_revision: revision,
        text_changed: before.fingerprint !== after.fingerprint, suggestion_before: before.suggested, suggestion_after: after.suggested,
        manual_route_kept: !!cur.manual });
    } else if (revision === cur.revision) {
      rep.ignored_same++;
      if (JSON.stringify(cur.payload) !== JSON.stringify(incoming.payload) || JSON.stringify(cur.transcript_payload) !== JSON.stringify(incoming.transcript_payload)) rep.same_revision_changed++;
    } else rep.ignored_older++;
  }
  rep.unique_after = Object.keys(state.records).length;
  rep.usable_after = Object.values(state.records).filter(r => analysisState(r) === 'analysed').length;
  state.version++;
  state.imports.unshift(rep); state.imports = state.imports.slice(0, 200);
  return rep;
}

const describe = rec => ({ revision: rec.revision, fingerprint: rec.analysis ? rec.analysis.text_fingerprint : 'none',
  suggested: rec.analysis ? rec.analysis.routes.map(x => x.route) : [] });
const analysisState = rec => (rec.analysis ? rec.analysis.state : 'no_text_logged');

function freshness(rec) {
  const a = rec.analysis;
  if (!a) return 'pending';
  if (a.based_on_revision !== rec.revision || a.algo !== ALGO_VERSION) return 'stale';
  return a.text_fingerprint === textFingerprint(segmentsOf(rec)) ? 'current' : 'stale';
}

function reanalyse(state, key, now = new Date().toISOString()) {
  const rec = state.records[key]; if (!rec) throw new Error('Unknown record');
  rec.analysis = analyse(rec, now); state.version++; return rec;
}

function setOverride(state, key, routes, note, now = new Date().toISOString()) {
  const rec = state.records[key]; if (!rec) throw new Error('Unknown record');
  const clean = ROUTE_ORDER.filter(r => (routes || []).includes(r));
  if (!clean.length) throw new Error('Choose at least one valid route');
  rec.manual = { routes: clean, note: String(note || '').slice(0, 500), set_at: now,
    suggested_at_set: rec.analysis ? rec.analysis.routes.map(x => x.route) : [] };
  state.version++; return rec;
}
function clearOverride(state, key) {
  const rec = state.records[key]; if (!rec) throw new Error('Unknown record');
  rec.manual = null; state.version++; return rec;
}
// "Accept suggestion": keep the manual choice but acknowledge the new suggestion (clears the changed-suggestion banner).
function acknowledgeSuggestion(state, key) {
  const rec = state.records[key]; if (!rec || !rec.manual) throw new Error('No manual route to acknowledge');
  rec.manual.suggested_at_set = rec.analysis.routes.map(x => x.route); state.version++; return rec;
}

/** Derived, read-only view of a record. */
function derive(rec) {
  const a = rec.analysis, p = rec.payload || {};
  const suggested = a ? a.routes.map(x => x.route) : ['intake_only'];
  const manual = rec.manual ? rec.manual.routes : null;
  const routes = manual || suggested;
  const changed = !!(rec.manual && JSON.stringify(rec.manual.suggested_at_set) !== JSON.stringify(suggested));
  const fresh = freshness(rec);
  const review = [...(a ? a.review : [])];
  if (changed) review.push('The suggested route changed after your manual choice. Your choice still applies.');
  if (fresh !== 'current') review.push('Analysis is ' + fresh + ': re-run it.');
  const isCall = rec.source_type === 'call';
  return {
    key: rec.key, ref: rec.record_ref, type: rec.source_type, id: rec.source_id, revision: rec.revision, batch_id: rec.batch_id,
    title: isCall ? `Call by ${p.rep_name || p.rep_email || 'unknown rep'} (${p.direction || '-'})` : (p.title || 'Untitled meeting'),
    when: isCall ? p.started_at : p.starts_at,
    person: isCall ? (p.rep_email || 'unknown') : (p.organizer_email || 'unknown'),
    person_label: isCall ? (p.rep_name || p.rep_email) : (p.organizer_email || '').split('@')[0],
    state: analysisState(rec), freshness: fresh,
    suggested, routes, primary: routes[0], route_source: manual ? 'manual' : 'suggested', manual_override: !!manual,
    suggestion_changed: changed, superseded: manual ? suggested.filter(r => !manual.includes(r)) : [],
    priority: a ? a.priority : { score: 0, level: 'low' }, confidence: a ? a.confidence : 'n/a',
    needs_review: review.length > 0 || false, review,
    outcome: isCall ? p.observed_outcome : p.recording_status, connected: isCall ? p.is_connected : null,
    summary: a ? a.summary : '', commitments: a ? a.commitments.length : 0, objections: a ? a.objections.length : 0,
  };
}
const deriveAll = state => Object.values(state.records).map(derive)
  .sort((a, b) => (b.priority.score - a.priority.score) || String(a.ref).localeCompare(String(b.ref)));

function applyFilter(items, f = {}) {
  const q = (f.q || '').toLowerCase();
  return items.filter(d =>
    (!f.type || f.type === 'all' || d.type === f.type) && (!f.person || f.person === 'all' || d.person === f.person) &&
    (!f.route || f.route === 'all' || d.routes.includes(f.route)) && (!f.state || f.state === 'all' || d.state === f.state) &&
    (!f.review || d.needs_review) &&
    (!q || (d.title + ' ' + d.ref + ' ' + d.summary + ' ' + d.person_label).toLowerCase().includes(q)));
}

const DEFS = {
  records: 'All source records after the person and type filter. Identity is (source_type, source_id), so a repeated or updated delivery never adds a second copy.',
  usable: 'Records whose supplied text can be analysed ÷ all records in view. Calls with no logged text, silent or cancelled meetings and pending transcripts are not usable.',
  connected: 'Calls the source marks is_connected=true ÷ calls in view. This is the source flag, not a measurement from the text.',
  review: 'Records with at least one open review reason (label disagrees with text, conflicting signals, low confidence, pending or stale analysis, changed suggestion) ÷ records in view.',
  high: 'Analysed records with priority score ≥ 50 ÷ analysed records in view. Score = route weights + commitments + objections, minus a refusal.',
  commitments: 'Follow-up commitments detected in the text (“I will send…”), summed over analysed records. Call text has no speakers, so call commitments have no owner.',
  manual: 'Records where a manager chose the route themselves ÷ records in view.',
  stale: 'Analyses that no longer match the current source revision, text or rule set.',
};

function metrics(state, filter = {}) {
  const all = deriveAll(state);
  const inView = applyFilter(all, { type: filter.type, person: filter.person });
  const calls = inView.filter(d => d.type === 'call'), analysed = inView.filter(d => d.state === 'analysed');
  const m = (id, label, num, den, ids, extra = {}) => ({ id, label, num, den, pct: den === null ? null : pct(num, den), ids, definition: DEFS[id], ...extra });
  const tiles = [
    m('records', 'Records', inView.length, null, inView.map(d => d.key), { sub: `${calls.length} calls · ${inView.length - calls.length} meetings` }),
    m('usable', 'Usable text', analysed.length, inView.length, analysed.map(d => d.key)),
    m('connected', 'Calls connected', calls.filter(d => d.connected === true).length, calls.length, calls.filter(d => d.connected === true).map(d => d.key)),
    m('review', 'Needs review', inView.filter(d => d.needs_review).length, inView.length, inView.filter(d => d.needs_review).map(d => d.key)),
    m('high', 'High priority', analysed.filter(d => d.priority.level === 'high').length, analysed.length, analysed.filter(d => d.priority.level === 'high').map(d => d.key)),
    m('commitments', 'Open commitments', analysed.reduce((s, d) => s + d.commitments, 0), null, analysed.filter(d => d.commitments).map(d => d.key)),
    m('manual', 'Manual routes', inView.filter(d => d.manual_override).length, inView.length, inView.filter(d => d.manual_override).map(d => d.key)),
    m('stale', 'Stale analyses', inView.filter(d => d.freshness !== 'current').length, inView.length, inView.filter(d => d.freshness !== 'current').map(d => d.key)),
  ];
  const count = (items, f) => { const o = {}; for (const d of items) for (const k of [].concat(f(d))) o[k] = (o[k] || { n: 0, ids: [] }), o[k].n++, o[k].ids.push(d.key); return o; };
  const byRoute = count(inView, d => d.routes), byState = count(inView, d => d.state), byOutcome = count(calls, d => d.outcome || 'unknown');
  const persons = {};
  for (const d of all) { const p = persons[d.person] || (persons[d.person] = { person: d.person, label: d.person_label, calls: 0, connected: 0, meetings: 0, analysed: 0, review: 0 }); }
  for (const d of inView) { const p = persons[d.person]; d.type === 'call' ? (p.calls++, d.connected && p.connected++) : p.meetings++; if (d.state === 'analysed') p.analysed++; if (d.needs_review) p.review++; }
  const attention = [...inView].filter(d => d.needs_review || d.priority.level === 'high')
    .sort((a, b) => (b.priority.score + (b.needs_review ? 15 : 0)) - (a.priority.score + (a.needs_review ? 15 : 0))).slice(0, 8).map(d => d.key);
  return { tiles, byRoute, byState, byOutcome, persons: Object.values(persons).filter(p => p.calls + p.meetings > 0 || !filter.person), attention,
    people_options: Object.values(persons).map(p => ({ person: p.person, label: p.label })), total_all: all.length };
}

module.exports = { newState, importBatch, validateRecord, derive, deriveAll, applyFilter, metrics, setOverride, clearOverride,
  acknowledgeSuggestion, reanalyse, freshness, analysisState, DEFS, ROUTES, ROUTE_ORDER };
