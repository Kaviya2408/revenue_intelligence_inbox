'use strict';
// Rule-based conversation analysis. Everything here is computed from the supplied text,
// deterministic, and explainable: every route carries a reason and exact-quote evidence.
const { fnv1a, uniq, clip } = require('./util');

const ALGO_VERSION = 'rules-1.0';
const ROUTES = {
  support_escalation: 'Support escalation',
  deal_next_steps: 'Deal next steps',
  customer_followup: 'Customer follow-up',
  partner_channel: 'Partner / channel',
  internal_vendor: 'Internal / vendor',
  coaching: 'Coaching',
  outreach_log: 'Outreach log',
  intake_only: 'Intake only',
};
const ROUTE_ORDER = Object.keys(ROUTES);

const STATES = {
  analysed: 'Analysed',
  awaiting_transcript: 'Awaiting transcript',
  silent_recording: 'Silent recording',
  not_captured: 'Not captured',
  no_text_logged: 'No text logged',
};

// ---- lexicons -------------------------------------------------------------
const LEX = {
  buying: /\b(pric(e|es|ing)|quote|proposal|demo|trial|pilot|budget|contract|purchase|onboarding|implementation|timeline|go[- ]live|rollout|subscription|cost|licen[cs]e)\b/i,
  nextstep: /\b(send|share|email|schedule|book|set up|call (you )?(back|on)|follow[- ]?up|next week|tomorrow|monday|tuesday|wednesday|thursday|friday|end of (the )?(day|week|month)|reconnect|catch up|another call|next call|get back)\b/i,
  objection: /\b(not interested|too expensive|expensive|concern|can'?t afford|no budget|don'?t need|do not need|already (have|use)|competitor|not essential|main issue|worried|hesitant|not sure|price was)\b/i,
  stop: /\b(not interested|don'?t call|do not call|don'?t contact|do not contact|remove (me|us|my)|take me off|didn'?t ask for|stop (calling|contacting)|don'?t use my name|do not use my name)\b/i,
  support: /\b(replacement|cancel(l?ed|lation)?|clos(e|ed|ing|ure)|discontinu\w+|not working|blocked|declined|dispute|refund|outage|error|bug|complain\w*|escalat\w+|fraud|chargeback|stuck|failed|failure|wind(ing)? down|sunset)\b/i,
  existing: /\b(our account|my account|existing (customer|client)|we (have been|are) using|current(ly)? (use|using|plan|card)|renewal|renew|your card|our card|we use your|prepaid)\b/i,
  partner: /\b(partner(ship|s)?|reseller|resell|referral|refer(red|ring)?|channel|white[- ]?label|commission|co[- ]?sell|alliance)\b/i,
  vendor: /\b(vendor|supplier|procurement|we supply)\b/i,
  ooo: /\b(out of office|on leave|on vacation|away until|back (on|in) (the )?(office|\w+day))\b/i,
  commit: /\b(i'?ll|i will|we'?ll|we will|let me|i can|i'?m going to|we are going to|i shall|will)\b[^.?!]{0,40}\b(send|share|email|check|confirm|schedule|call|follow|get back|set up|arrange|introduce|revert|forward|come back|loop|update|look into|discuss|reach out|try you)\b/i,
};
const DUE = /\b(by (?:the )?(?:end of (?:the )?(?:day|week|month)|[A-Z][a-z]+day|\d{1,2}(?:st|nd|rd|th)?(?: [A-Z][a-z]+)?)|next (?:week|month|[A-Z][a-z]+day)|tomorrow|today|(?:on )?(?:Mon|Tues|Wednes|Thurs|Fri)day(?: or (?:Mon|Tues|Wednes|Thurs|Fri)day)?|in (?:a|one|two|three|\d+) (?:days?|weeks?))\b/;

const roleOf = sp =>
  /^team member/i.test(sp) ? 'rep' : /^customer/i.test(sp) ? 'customer' :
  /^partner/i.test(sp) ? 'partner' : /^supplier/i.test(sp) ? 'supplier' : 'other';

// ---- source text ----------------------------------------------------------
// Returns an ordered list of segments. Meetings: one per turn (1-based turn number is the evidence
// address). Calls: sentences of the adapted text (no speaker or timing is trustworthy, so evidence is a quote).
function segmentsOf(rec) {
  if (rec.source_type === 'meeting') {
    const turns = (rec.transcript_payload && Array.isArray(rec.transcript_payload.turns)) ? rec.transcript_payload.turns : [];
    return turns.filter(t => t && typeof t.text === 'string' && t.text.trim())
      .map((t, i) => ({ n: i + 1, speaker: t.speaker || 'Unknown', role: roleOf(t.speaker || ''), text: t.text.trim(), timecode: t.timecode || null }));
  }
  const raw = rec.payload && typeof rec.payload.transcript === 'string' ? rec.payload.transcript.trim() : '';
  if (!raw) return [];
  return raw.split(/(?<=[.?!])\s+(?=[A-Z“"'])/).map(s => s.trim()).filter(Boolean)
    .map((text, i) => ({ n: i + 1, speaker: null, role: 'unknown', text, timecode: null }));
}

const textFingerprint = segs => (segs.length ? fnv1a(segs.map(s => (s.speaker || '') + '|' + s.text).join('\n')) : 'none');

function processingState(rec, segs) {
  if (segs.length) return 'analysed';
  if (rec.source_type === 'call') return 'no_text_logged';
  const p = rec.payload || {}, why = ((rec.transcript_payload || {}).unavailable_reason || '').toLowerCase();
  if (p.recording_status === 'cancelled' || p.recording_status === 'not_scheduled') return 'not_captured';
  if (/nobody spoke|no speech|silent/.test(why)) return 'silent_recording';
  if (/later|not included|supplied in|will be/.test(why)) return 'awaiting_transcript';
  if (p.has_transcript === false) return 'not_captured';
  return 'awaiting_transcript';
}

const ev = (seg, extra = {}) => ({ n: seg.n, speaker: seg.speaker, quote: clip(seg.text), ...extra });
const pick = (hits, k = 3) => hits.slice(0, k);

// ---- analysis -------------------------------------------------------------
function analyse(rec, now = new Date().toISOString()) {
  const segs = segmentsOf(rec);
  const state = processingState(rec, segs);
  const fp = textFingerprint(segs);
  const base = { algo: ALGO_VERSION, based_on_revision: rec.revision, text_fingerprint: fp, computed_at: now, state };
  if (!segs.length) {
    const reason = state === 'awaiting_transcript' ? 'The transcript has not arrived yet.'
      : state === 'silent_recording' ? 'The recording exists but nobody spoke.'
      : state === 'not_captured' ? 'No recording was made for this meeting.'
      : 'No call text was logged, so only the source metadata is available.';
    return { ...base, summary: reason, topics: [], routes: [{ route: 'intake_only', why: reason, evidence: [] }],
      commitments: [], objections: [], stop_request: null, label_check: labelCheck(rec, null), confidence: 'n/a',
      review: reviewFor(rec, state, [], null), priority: { score: 0, level: 'low' }, not_established: ['Everything: there is no text to analyse.'] };
  }

  const isMeeting = rec.source_type === 'meeting';
  const hit = {};
  for (const k of Object.keys(LEX)) hit[k] = segs.filter(s => LEX[k].test(s.text));
  const external = s => !isMeeting || s.role !== 'rep';
  const rawStop = segs.filter(s => LEX.stop.test(s.text) && external(s));
  const stopSeg = rawStop[0] || null;

  const commitments = hit.commit.map(s => {
    const due = (s.text.match(DUE) || [null])[0];
    return { text: clip(s.text, 200), owner: isMeeting ? (s.role === 'rep' ? 'our team' : s.speaker) : 'unattributed (call text has no speakers)',
      due, evidence: ev(s) };
  });
  const objections = hit.objection.filter(external).map(s => ev(s));

  const routes = [];
  const add = (route, why, hits) => routes.push({ route, why, evidence: pick(hits).map(s => ev(s)) });
  const supportHits = hit.support.filter(external);
  const businessSignals = () => routes.some(r => ['support_escalation', 'deal_next_steps', 'customer_followup', 'partner_channel', 'internal_vendor'].includes(r.route));

  if (!stopSeg) {
    if (supportHits.length >= 2 || (supportHits.length >= 1 && hit.existing.length >= 1))
      add('support_escalation', `Existing-customer problem language (${supportHits.length} passage${supportHits.length > 1 ? 's' : ''}) such as closure, replacement or failure.`, uniq([...supportHits, ...hit.existing]));
    if ((hit.buying.length >= 3 && (hit.commit.length || hit.nextstep.length)) || (hit.buying.length >= 1 && hit.commit.length >= 1))
      add('deal_next_steps', 'Commercial topics (pricing, plan, budget or timeline) plus an agreed or proposed next step.', uniq([...hit.buying, ...hit.commit, ...hit.nextstep].sort((a, b) => a.n - b.n)));
    if ((hit.existing.length || supportHits.length) && (hit.commit.length || hit.nextstep.length))
      add('customer_followup', 'A current customer is waiting on something we said we would send, check or confirm.', uniq([...hit.existing, ...hit.commit, ...supportHits]));
    const partnerHits = hit.partner.filter(s => s.role !== 'rep' || !isMeeting || true);
    if (partnerHits.length >= 2 || segs.some(s => s.role === 'partner'))
      add('partner_channel', 'Partner, referral or channel arrangement is discussed.', partnerHits.length ? partnerHits : segs.filter(s => s.role === 'partner'));
    if (segs.some(s => s.role === 'supplier') || hit.vendor.length >= 3)
      add('internal_vendor', 'A supplier or vendor relationship rather than a sales prospect.', segs.some(s => s.role === 'supplier') ? segs.filter(s => s.role === 'supplier') : hit.vendor);
  }

  // coaching: explicit refusal that the rep talked past, or an objection with no next step
  const coachNotes = [];
  if (stopSeg) {
    const after = segs.filter(s => s.n > stopSeg.n && (!isMeeting || s.role === 'rep' || true));
    if (after.length >= 3) coachNotes.push({ why: 'The contact asked not to be contacted or said they were not interested, and the conversation continued for several more passages.', hits: [stopSeg, after[0], after[after.length - 1]] });
  } else if (objections.length && !hit.commit.length && !hit.nextstep.length) {
    coachNotes.push({ why: 'An objection was raised and no next step or commitment was recorded.', hits: hit.objection.filter(external) });
  }
  for (const c of coachNotes) add('coaching', c.why, c.hits);

  const wasOutreach = !isMeeting && (stopSeg || hit.ooo.length || rec.payload.is_connected === false || ['uninterested', 'ooo', 'voicemail'].includes(rec.payload.observed_outcome));
  if (wasOutreach && !businessSignals())
    add('outreach_log', stopSeg ? 'The contact declined further outreach.' : hit.ooo.length ? 'Contact was away or unavailable; log and retry.' : 'Outreach attempt without a business outcome.', stopSeg ? [stopSeg] : hit.ooo.length ? hit.ooo : segs.slice(0, 1));
  if (!routes.length) add('intake_only', 'Text exists but no routing signal was strong enough; kept for reference.', segs.slice(0, 1));
  routes.sort((a, b) => ROUTE_ORDER.indexOf(a.route) - ROUTE_ORDER.indexOf(b.route));

  const topics = uniq([
    hit.buying.length && 'pricing / plan', hit.support.length && 'service problem', hit.existing.length && 'existing account',
    hit.partner.length && 'partnership / referral', hit.vendor.length && 'vendor', hit.ooo.length && 'availability', stopSeg && 'declined outreach',
  ].filter(Boolean));

  let score = 0;
  const has = r => routes.some(x => x.route === r);
  if (has('support_escalation')) score += 40; if (has('deal_next_steps')) score += 25; if (has('customer_followup')) score += 15;
  if (has('partner_channel')) score += 10; if (has('internal_vendor')) score += 5;
  score += Math.min(15, commitments.length * 5) + Math.min(10, objections.length * 5) - (stopSeg ? 30 : 0);
  score = Math.max(0, Math.min(100, score));
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

  const signalKinds = ['buying', 'nextstep', 'support', 'existing', 'partner', 'vendor', 'objection', 'commit', 'ooo'].filter(k => hit[k].length).length + (stopSeg ? 1 : 0);
  const confidence = signalKinds >= 3 ? 'high' : signalKinds >= 2 ? 'medium' : 'low';
  const lc = labelCheck(rec, { stop: !!stopSeg, ooo: hit.ooo.length > 0, partner: hit.partner.length >= 2, followup: commitments.length > 0 || hit.nextstep.length > 0 });
  const summary = `${isMeeting ? segs.length + ' turns' : segs.length + ' sentences'}; ` +
    (topics.length ? 'topics: ' + topics.join(', ') + '; ' : '') +
    `${commitments.length} commitment${commitments.length === 1 ? '' : 's'}, ${objections.length} objection${objections.length === 1 ? '' : 's'}. ` +
    `Suggested route: ${ROUTES[routes[0].route]}${routes.length > 1 ? ' (+' + (routes.length - 1) + ' more)' : ''}.`;

  return { ...base, summary, topics, routes, commitments, objections: objections.slice(0, 5),
    stop_request: stopSeg ? ev(stopSeg) : null, label_check: lc, confidence,
    review: reviewFor(rec, state, routes, lc, confidence, !!stopSeg, has('deal_next_steps')),
    priority: { score, level },
    not_established: [
      isMeeting ? 'Who owns each follow-up beyond the speaker labels in the transcript.' : 'Who said what: call text carries no speaker labels or timing.',
      'Anything outside the supplied text. Shortened transcripts do not show omitted passages.',
      'Deal value, stage or account ownership: no CRM data is supplied.',
    ] };
}

function labelCheck(rec, t) {
  if (rec.source_type !== 'call') return null;
  const stored = rec.payload.observed_outcome || null;
  if (!t) return { stored, from_text: null, agree: null, note: 'No text to compare with the stored label.' };
  const from = t.stop ? 'uninterested' : t.ooo ? 'ooo' : t.partner ? 'referred' : t.followup ? 'follow_up' : 'unclear';
  const agree = stored === from ? true : (stored === 'referred' && from === 'follow_up') || from === 'unclear' ? null : false;
  return { stored, from_text: from, agree, note: agree === false ? `Stored label "${stored}" but the text reads as "${from}".` : agree === null ? 'Partly consistent or inconclusive.' : 'Consistent.' };
}

function reviewFor(rec, state, routes, lc, confidence, stop, deal) {
  const r = [];
  if (state === 'awaiting_transcript') r.push('Transcript pending: analysis will update when it arrives.');
  if (lc && lc.agree === false) r.push(lc.note);
  if (stop && deal) r.push('Refusal and commercial signals both present: check the route.');
  if (confidence === 'low' && state === 'analysed') r.push('Low confidence: few distinct signals.');
  return r;
}

module.exports = { analyse, segmentsOf, textFingerprint, processingState, ROUTES, ROUTE_ORDER, STATES, ALGO_VERSION, roleOf };
