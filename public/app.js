'use strict';
const S = { meta: null, type: 'all', person: 'all', inbox: { q: '', route: 'all', state: 'all', review: false, ids: null, label: '' }, last: null };
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(path, method = 'GET', body) {
  const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); }
const qs = () => `type=${S.type}&person=${encodeURIComponent(S.person)}`;
const R = r => S.meta.routes[r] || r;
const pill = (txt, cls = '') => `<span class="pill ${cls}">${esc(txt)}</span>`;
const fmtPct = t => (t.den ? `${t.num}<span class="d"> / ${t.den} · ${t.pct}%</span>` : `${t.num}`);
const go = h => { location.hash = h; };

// ---- router ----
async function render() {
  const h = location.hash.replace(/^#/, '') || '/';
  const view = h.startsWith('/record/') ? 'record' : h.startsWith('/inbox') ? 'inbox' : h.startsWith('/imports') ? 'imports' : h.startsWith('/export') ? 'export' : 'dash';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === (view === 'record' ? 'inbox' : view)));
  try {
    if (view === 'dash') await dash(); else if (view === 'inbox') await inbox(); else if (view === 'record') await record(decodeURIComponent(h.slice(8)));
    else if (view === 'imports') await imports(); else await exportView();
  } catch (e) { $('#app').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
}
async function loadFilters() {
  const m = await api('/api/metrics?type=all&person=all'); const sel = $('#fPerson'), cur = S.person;
  sel.innerHTML = '<option value="all">Everyone</option>' + m.people_options.map(p => `<option value="${esc(p.person)}">${esc(p.label || p.person)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all'; S.person = sel.value;
}

// ---- dashboard ----
function bars(obj, labelFn, onClickKey, order) {
  const keys = (order || Object.keys(obj)).filter(k => obj[k]); const max = Math.max(1, ...keys.map(k => obj[k].n));
  if (!keys.length) return '<p class="mute">Nothing yet.</p>';
  return keys.map(k => `<div class="bar" data-k="${esc(k)}" data-act="${onClickKey}" title="Open these records"><span class="lab">${esc(labelFn(k))}</span><span class="trk"><span class="fil" style="display:block;width:${obj[k].n / max * 100}%"></span></span><span class="v">${obj[k].n}</span></div>`).join('');
}
async function dash() {
  const m = await api('/api/metrics?' + qs());
  if (!m.total_all) {
    $('#app').innerHTML = `<h1>Welcome</h1><p class="lead">No records yet. Import the sample deliveries or your own batch file.</p>
    <div class="row"><button class="primary" data-act="sample" data-name="initial">Import sample batch 1</button><a href="#/imports">Open the Imports page</a></div>`; return;
  }
  const byId = {}; (await api('/api/records?' + qs())).forEach(d => byId[d.key] = d);
  const att = m.attention.map(k => byId[k]).filter(Boolean);
  window._tiles = m.tiles;
  $('#app').innerHTML = `<h1>Overview</h1><p class="lead">${m.tiles[0].num} records in view. Click a number to see which records it counts; ⓘ shows how it is defined.</p>
  <div class="grid tiles">${m.tiles.map((t, i) => `<div class="card tile" data-act="tile" data-i="${i}" tabindex="0"><button class="info" data-act="def" data-i="${i}" aria-label="Definition">ⓘ</button><div class="l">${esc(t.label)}</div><div class="n">${fmtPct(t)}</div>${t.sub ? `<div class="d">${esc(t.sub)}</div>` : ''}<div class="def">${esc(t.definition)}</div></div>`).join('')}</div>
  <h3>Needs attention first</h3>
  <div class="card wrap">${att.length ? `<table><thead><tr><th>Ref</th><th>Conversation</th><th>Route</th><th>Priority</th><th>Why it is here</th></tr></thead><tbody>${att.map(d => `<tr class="click" data-act="open" data-k="${esc(d.key)}"><td class="mono">${esc(d.ref)}</td><td>${esc(d.title)}<div class="mute">${esc(d.person_label)}</div></td><td>${d.routes.map(r => pill(R(r), d.manual_override ? 'manual' : '')).join(' ')}</td><td>${pill(d.priority.level + ' ' + d.priority.score, d.priority.level)}</td><td>${esc(d.review[0] || d.summary)}</td></tr>`).join('')}</tbody></table>` : '<p class="mute">Nothing needs attention.</p>'}</div>
  <div class="grid two" style="margin-top:12px">
   <div class="card"><h2>Where records are routed</h2><p class="mute">A record can sit in more than one route, so these add up to more than the record count.</p>${bars(m.byRoute, R, 'route', S.meta.order)}</div>
   <div class="card"><h2>What can and cannot be analysed</h2><p class="mute">Records with no usable text go to intake and are listed, not hidden.</p>${bars(m.byState, k => S.meta.states[k], 'state')}</div>
   <div class="card"><h2>Call outcomes (stored label)</h2>${bars(m.byOutcome, k => k, 'none')}</div>
   <div class="card wrap" style="grid-column:1/-1"><h2>By person</h2><table><thead><tr><th>Person</th><th>Calls</th><th>Connected</th><th>Meetings</th><th>Analysed</th><th>Review</th></tr></thead><tbody>${m.persons.map(p => `<tr><td>${esc(p.label || p.person)}</td><td>${p.calls}</td><td>${p.calls ? p.connected + '/' + p.calls : '–'}</td><td>${p.meetings}</td><td>${p.analysed}</td><td>${p.review}</td></tr>`).join('')}</tbody></table><p class="mute">Calls belong to the rep; meetings to the organiser. An organiser is not automatically the salesperson.</p></div>
  </div>`;
}

// ---- inbox ----
async function inbox() {
  const f = S.inbox; const p = new URLSearchParams({ type: S.type, person: S.person, route: f.route, state: f.state, q: f.q, review: f.review ? '1' : '' });
  let rows = await api('/api/records?' + p); if (f.ids) rows = rows.filter(d => f.ids.includes(d.key));
  $('#app').innerHTML = `<h1>Inbox</h1><p class="lead">${rows.length} record${rows.length === 1 ? '' : 's'} · sorted by priority</p>
  <div class="toolbar"><input type="search" id="iq" placeholder="Search title, ref, summary" value="${esc(f.q)}">
  <select id="ir"><option value="all">All routes</option>${S.meta.order.map(r => `<option value="${r}" ${f.route === r ? 'selected' : ''}>${esc(R(r))}</option>`).join('')}</select>
  <select id="is"><option value="all">All states</option>${Object.entries(S.meta.states).map(([k, v]) => `<option value="${k}" ${f.state === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
  <label><input type="checkbox" id="irv" ${f.review ? 'checked' : ''}> Needs review</label>
  ${f.ids ? `<span class="chip">Showing: ${esc(f.label)} <a href="#" data-act="clearids">clear</a></span>` : ''}</div>
  <div class="card wrap"><table><thead><tr><th>Ref</th><th>Conversation</th><th>Person</th><th>Route(s)</th><th>Priority</th><th>State</th><th>Flags</th></tr></thead><tbody>
  ${rows.map(d => `<tr class="click" data-act="open" data-k="${esc(d.key)}"><td class="mono">${esc(d.ref)}</td><td>${esc(d.title)}<div class="mute">${esc((d.when || '').slice(0, 10))} · ${esc(d.type)}</div></td><td>${esc(d.person_label)}</td>
  <td>${d.routes.map(r => pill(R(r), d.manual_override ? 'manual' : '')).join(' ')}</td><td>${d.state === 'analysed' ? pill(d.priority.level + ' ' + d.priority.score, d.priority.level) : '–'}</td><td>${esc(S.meta.states[d.state])}</td>
  <td>${d.manual_override ? pill('manual', 'manual') : ''} ${d.needs_review ? pill('review', 'warn') : ''} ${d.freshness !== 'current' ? pill(d.freshness, 'stale') : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="mute">No records match.</td></tr>'}</tbody></table></div>`;
  $('#iq').oninput = e => { f.q = e.target.value; clearTimeout(inbox.t); inbox.t = setTimeout(async () => { const pos = e.target.selectionStart; await inbox(); const i = $('#iq'); i.focus(); i.setSelectionRange(pos, pos); }, 250); };
  $('#ir').onchange = e => { f.route = e.target.value; inbox(); }; $('#is').onchange = e => { f.state = e.target.value; inbox(); }; $('#irv').onchange = e => { f.review = e.target.checked; inbox(); };
}

// ---- record ----
async function record(key) {
  const d = await api('/api/records/' + encodeURIComponent(key)); const a = d.analysis;
  const evList = [...(a.routes.flatMap(r => r.evidence)), ...(a.commitments.map(c => c.evidence)), ...(a.objections)];
  const evKey = e => e.n;
  const hlSet = new Set(evList.map(evKey));
  const evBtn = e => `<div class="ev" data-act="jump" data-n="${e.n}">“${esc(e.quote)}”<div class="mute">${e.speaker ? esc(e.speaker) + ' · turn ' + e.n : 'sentence ' + e.n + ' · call text (no speaker labels)'}</div></div>`;
  const p = d.payload;
  $('#app').innerHTML = `<div class="crumbs"><a href="#/inbox">← Inbox</a></div>
  <div class="row"><h1>${esc(d.ref)} · ${esc(d.title)}</h1><span class="sp"></span>${pill('revision ' + d.revision)} ${pill('analysis ' + d.freshness, d.freshness)} ${pill(d.state === 'analysed' ? d.priority.level + ' priority' : S.meta.states[d.state], d.state === 'analysed' ? d.priority.level : '')}</div>
  <p class="lead">${esc(d.person_label)} · ${esc((d.when || '').replace('T', ' ').slice(0, 16))} · ${esc(d.type)} · <span class="mono">${esc(d.id)}</span></p>
  ${d.suggestion_changed ? `<div class="alert">The suggested route changed since you set a manual route (now: ${d.suggested.map(R).join(', ')}). Your manual route still applies. <button data-act="ack" data-k="${esc(d.key)}">Keep mine, dismiss</button> <button data-act="clearov" data-k="${esc(d.key)}">Use the suggestion</button></div>` : ''}
  ${d.review.filter(x => !x.startsWith('The suggested route')).map(x => `<div class="alert">${esc(x)}</div>`).join('')}
  <div class="grid two">
   <div class="card routes"><h2>Routing</h2>
    <p>Applies now: ${d.routes.map(r => pill(R(r), d.manual_override ? 'manual' : 'ok')).join(' ')} <span class="mute">(${d.route_source})</span></p>
    ${a.routes.map(r => `<div class="mute"><b>${esc(R(r.route))}</b>: ${esc(r.why)}</div>${r.evidence.map(evBtn).join('')}`).join('')}
    <h3>Change the route</h3>
    <form id="ovf">${S.meta.order.map(r => `<label><input type="checkbox" name="r" value="${r}" ${d.routes.includes(r) ? 'checked' : ''}> ${esc(R(r))}</label>`).join('')}
    <div style="margin:8px 0"><input type="text" id="ovn" style="width:100%" placeholder="Why? (optional note)" value="${esc(d.manual ? d.manual.note : '')}"></div>
    <div class="row"><button class="primary" type="submit">Save manual route</button>${d.manual_override ? `<button type="button" class="danger" data-act="clearov" data-k="${esc(d.key)}">Reset to suggestion</button>` : ''}</div></form>
    <p class="mute">A manual route is stored apart from the source data and survives re-imports and updates.${d.superseded.length ? ' Superseded suggestion: ' + d.superseded.map(R).join(', ') + '.' : ''}</p></div>
   <div class="card"><h2>Analysis</h2><p>${esc(a.summary)}</p>
    <div class="row">${pill('confidence ' + a.confidence)} ${a.topics.map(t => pill(t)).join(' ')}</div>
    ${a.label_check ? `<h3>Stored label vs text</h3><p>${esc(a.label_check.note)} <span class="mute">stored “${esc(a.label_check.stored)}”, text suggests “${esc(a.label_check.from_text || '–')}”</span></p>` : ''}
    ${a.commitments.length ? `<h3>Commitments</h3><ul>${a.commitments.map(c => `<li><span data-act="jump" data-n="${c.evidence.n}" style="cursor:pointer">${esc(c.text)}</span><div class="mute">owner: ${esc(c.owner)}${c.due ? ' · due: ' + esc(c.due) : ' · no due date stated'}</div></li>`).join('')}</ul>` : ''}
    ${a.objections.length ? `<h3>Objections</h3>${a.objections.map(evBtn).join('')}` : ''}
    <h3>Not established</h3><ul class="mute">${a.not_established.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="mute">Analysis computed by ${esc(a.algo)} from revision ${a.based_on_revision} · text fingerprint <span class="mono">${esc(a.text_fingerprint)}</span> <button data-act="reanalyse" data-k="${esc(d.key)}">Re-run</button></p></div>
  </div>
  <div class="card" style="margin-top:12px"><h2>${d.type === 'meeting' ? 'Transcript' : 'Call text'}</h2>
   ${d.segments.length ? `<p class="mute">Highlighted passages are cited above. ${d.type === 'call' ? 'Call text is shown as sentences; it has no trustworthy speaker or timing.' : ''}</p><div id="segs">${d.segments.map(s => `<div class="seg ${hlSet.has(s.n) ? 'hl' : ''}" id="seg${s.n}"><div class="who">${d.type === 'meeting' ? esc(s.speaker) + ' · turn ' + s.n + (s.timecode ? ' · ' + esc(s.timecode) : '') : 'sentence ' + s.n}</div>${esc(s.text)}</div>`).join('')}</div>` : `<p>${esc(a.summary)}${d.transcript_note ? ' (' + esc(d.transcript_note) + ')' : ''}</p>`}</div>
  <details class="card" style="margin-top:12px"><summary>Source metadata (revision ${d.revision})</summary><pre class="file">${esc(JSON.stringify(p, (k, v) => k === 'transcript' ? (v ? '[' + v.length + ' chars, shown above]' : v) : v, 2))}</pre></details>`;
  $('#ovf').onsubmit = async e => { e.preventDefault(); const routes = [...document.querySelectorAll('#ovf input[name=r]:checked')].map(x => x.value);
    try { await api(`/api/records/${encodeURIComponent(key)}/override`, 'POST', { routes, note: $('#ovn').value }); toast('Manual route saved'); render(); } catch (err) { toast(err.message); } };
}

// ---- imports ----
function reportRow(r) { return `<tr><td>${esc(r.batch_id || 'file')} · rev ${r.revision}</td><td>${r.received}</td><td>${r.added}</td><td>${r.updated}</td><td>${r.ignored_same + r.ignored_older}</td><td>${r.rejected.length}</td><td><b>${r.unique_after}</b></td><td><b>${r.usable_after}</b></td></tr>`; }
async function imports() {
  const [log, all] = await Promise.all([api('/api/imports'), api('/api/records?type=all&person=all')]);
  const m7 = all.find(d => d.ref === 'M07'), usable = all.filter(d => d.state === 'analysed').length;
  $('#app').innerHTML = `<h1>Imports</h1><p class="lead">Records are identified by (source type, source id). A higher revision replaces the whole record; the same or an older revision is ignored. Analysis and manual routes are stored separately and are not overwritten.</p>
  <div class="grid two"><div class="card"><h2>Replay the import contract</h2><ol class="steps">
    <li><button data-act="sample" data-name="initial">Import batch 1 (initial)</button></li>
    <li><button data-act="sample" data-name="initial" data-shuffle="1">Import batch 1 again, reordered</button></li>
    <li><button data-act="m7"${m7 ? '' : ' disabled'}>Set M07 route manually (Customer follow-up)</button></li>
    <li><button data-act="sample" data-name="update">Import update (revision 2)</button></li>
    <li><button data-act="sample" data-name="initial">Import batch 1 again (older revision)</button></li>
    <li><button data-act="reload">Refresh the page</button> <span class="mute">state is saved on the server</span></li></ol>
    <button class="danger" data-act="reset">Clear all data</button></div>
   <div class="card"><h2>Import your own file</h2><p class="mute">A delivery is JSON: <span class="mono">{ batch_id, revision, records: [{ record_ref, source_type, source_id, payload, transcript_payload }] }</span></p>
    <input type="file" id="file" accept=".json,application/json"> <label><input type="checkbox" id="shuf"> reverse record order</label>
    <h3>Live checks</h3><ul id="checks"><li>${all.length ? pill(all.length + ' unique records', all.length === 44 ? 'ok' : '') : 'No data'} ${all.length ? '<span class="mute">(stays at 44 for the sample)</span>' : ''}</li><li>${pill(usable + ' with usable text', 'ok')} <span class="mute">(17 before the update, 18 after)</span></li>
    <li>${m7 ? `M07: revision ${m7.revision}, ${m7.state}, route ${m7.routes.map(R).join(', ')} (${m7.route_source})${m7.suggestion_changed ? ' · suggestion changed, manual kept' : ''}` : 'M07 not loaded'}</li></ul></div></div>
  <h3>Import log</h3><div class="card wrap"><table><thead><tr><th>Delivery</th><th>Received</th><th>Added</th><th>Updated</th><th>Ignored</th><th>Rejected</th><th>Unique after</th><th>Usable after</th></tr></thead><tbody>${log.map(reportRow).join('') || '<tr><td colspan="8" class="mute">No imports yet.</td></tr>'}</tbody></table></div>
  ${log[0] && log[0].changes.some(c => c.kind === 'updated') ? `<h3>Latest changes</h3><div class="card">${log[0].changes.filter(c => c.kind === 'updated').map(c => `<p><b>${esc(c.ref)}</b> revision ${c.from_revision} → ${c.to_revision}${c.text_changed ? ', text changed' : ''}; suggestion ${esc(c.suggestion_before.map(R).join('+'))} → ${esc(c.suggestion_after.map(R).join('+'))}${c.manual_route_kept ? '; manual route kept' : ''}</p>`).join('')}</div>` : ''}`;
  $('#file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const batch = JSON.parse(await f.text()); const r = await api('/api/import', 'POST', { batch, shuffle: $('#shuf').checked }); toast(`Imported: ${r.added} added, ${r.updated} updated, ${r.ignored_same + r.ignored_older} ignored`); await loadFilters(); render(); } catch (err) { toast('Import failed: ' + err.message); } };
}

// ---- export ----
async function exportView() {
  const [list, man] = await Promise.all([api('/api/export/list'), api('/api/manifest')]);
  const groups = {}; list.forEach(p => { const g = p.includes('/') ? p.split('/').slice(0, p.startsWith('routes/') ? 2 : 1).join('/') : '(root)'; (groups[g] = groups[g] || []).push(p); });
  $('#app').innerHTML = `<h1>Export</h1><p class="lead">Built from the current state, so re-exporting replaces the previous export and never adds a second active copy. ${man.record_count} records · ${list.length} files.</p>
  <div class="toolbar"><a href="/api/export.zip"><button class="primary">Download export (.zip)</button></a><a href="/api/export/file?path=manifest.json" target="_blank"><button>manifest.json</button></a><a href="/api/export/file?path=manifest.csv" target="_blank"><button>manifest.csv</button></a><button data-act="writeexport">Write to ./export on the server</button></div>
  <div class="grid two"><div class="card" style="max-height:480px;overflow:auto"><h2>Files</h2>${Object.entries(groups).map(([g, fs]) => `<h3>${esc(g)} (${fs.length})</h3>${fs.map(f => `<div><a href="#" data-act="preview" data-p="${esc(f)}" class="mono">${esc(f.split('/').slice(-1)[0])}</a></div>`).join('')}`).join('')}</div>
  <div class="card"><h2 id="pt">Preview</h2><pre class="file" id="pv">Pick a file.</pre></div></div>
  <h3>Manifest</h3><div class="card wrap"><table><thead><tr><th>Ref</th><th>Rev</th><th>Routes</th><th>Source</th><th>State</th><th>Freshness</th><th>Superseded</th></tr></thead><tbody>${man.records.map(r => `<tr><td class="mono">${esc(r.record_ref)}</td><td>${r.applied_revision}</td><td>${esc(r.routes.join(', '))}</td><td>${r.manual_override ? pill('manual', 'manual') : 'suggested'}</td><td>${esc(r.processing_state)}</td><td>${esc(r.analysis_freshness)}</td><td>${esc((r.superseded_routes || []).join(', '))}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---- actions (event delegation) ----
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;
  try {
    if (act === 'def') { e.stopPropagation(); t.closest('.tile').classList.toggle('open'); return; }
    if (act === 'tile') { const x = window._tiles[+t.dataset.i]; S.inbox = { q: '', route: 'all', state: 'all', review: false, ids: x.ids, label: x.label }; go('/inbox'); return; }
    if (act === 'open') return go('/record/' + encodeURIComponent(t.dataset.k));
    if (act === 'route') { S.inbox = { q: '', route: t.dataset.k, state: 'all', review: false, ids: null, label: '' }; return go('/inbox'); }
    if (act === 'state') { S.inbox = { q: '', route: 'all', state: t.dataset.k, review: false, ids: null, label: '' }; return go('/inbox'); }
    if (act === 'clearids') { e.preventDefault(); S.inbox.ids = null; return inbox(); }
    if (act === 'jump') { const el = document.getElementById('seg' + t.dataset.n); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('hl'); } return; }
    if (act === 'sample') { const r = await api('/api/import/sample', 'POST', { name: t.dataset.name, shuffle: !!t.dataset.shuffle }); toast(`${r.added} added · ${r.updated} updated · ${r.ignored_same + r.ignored_older} ignored · ${r.unique_after} unique`); await loadFilters(); return render(); }
    if (act === 'm7') { const all = await api('/api/records?type=all&person=all'); const m7 = all.find(d => d.ref === 'M07'); await api(`/api/records/${encodeURIComponent(m7.key)}/override`, 'POST', { routes: ['customer_followup'], note: 'Provisional manual route' }); toast('M07 routed manually'); return render(); }
    if (act === 'reload') return location.reload();
    if (act === 'reset') { await api('/api/reset', 'POST', {}); S.inbox.ids = null; await loadFilters(); toast('Cleared'); return render(); }
    if (act === 'ack') { await api(`/api/records/${encodeURIComponent(t.dataset.k)}/acknowledge`, 'POST', {}); return render(); }
    if (act === 'clearov') { await api(`/api/records/${encodeURIComponent(t.dataset.k)}/override`, 'DELETE'); toast('Back to the suggested route'); return render(); }
    if (act === 'reanalyse') { await api(`/api/records/${encodeURIComponent(t.dataset.k)}/reanalyse`, 'POST', {}); toast('Analysis re-run'); return render(); }
    if (act === 'writeexport') { const r = await api('/api/export/write', 'POST', {}); return toast(`Wrote ${r.files} files to ${r.dir}`); }
    if (act === 'preview') { e.preventDefault(); const txt = await (await fetch('/api/export/file?path=' + encodeURIComponent(t.dataset.p))).text(); $('#pt').textContent = t.dataset.p; $('#pv').textContent = txt; return; }
  } catch (err) { toast(err.message); }
});
$('#fType').onchange = e => { S.type = e.target.value; render(); };
$('#fPerson').onchange = e => { S.person = e.target.value; render(); };
window.addEventListener('hashchange', render);
(async () => {
  S.meta = await api('/api/meta'); S.meta.order = Object.keys(S.meta.routes);
  await loadFilters(); render();
})();
