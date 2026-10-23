# SalesDesk

A working inbox for a sales manager to review call and meeting records, see what happened, and decide what needs attention.
Node 18+ only. **No dependencies, nothing to install.**

## Run it

```bash
npm start                 # http://localhost:3000   (PORT=4000 npm start to change the port)
npm test                  # 20 tests: import contract, routing evidence, exports, API, persistence
npm run replay            # prints the import/update contract step by step in the terminal
npm run export            # writes ./export from the saved state (or the sample replay if empty)
```

Open the app, go to **Imports**, and click through the six replay steps (or **Import batch 1** on the welcome screen). State is saved to `data/state.json`, so it survives a refresh or a server restart. Delete that file, or use **Clear all data**, to start over.

## Deploy on Render (one service, UI and API together)

The Node server serves the UI from `public/` and the API from the same process and port, so there is a single service and no CORS or second host.

1. Push this folder to a GitHub repo (the folder root must contain `package.json` and `render.yaml`).
2. In Render choose **New → Blueprint** and select the repo (it reads `render.yaml`), or **New → Web Service** with: Runtime *Node*, Build command *(empty or `echo ok`)*, Start command `node server.js`, Health check path `/healthz`.
3. Environment variables: `SEED_SAMPLES=1` loads the two sample deliveries whenever the store is empty (recommended for a demo). `PORT` is set by Render; the server binds `0.0.0.0`.
4. **Storage:** on the free plan the disk is wiped at every deploy or restart, so data reverts to the seeded samples. For data that persists, use a paid instance, add a Disk mounted at `/var/data`, and set `STATE_FILE=/var/data/state.json` (already in `render.yaml`).
5. The free plan sleeps after inactivity, so the first request after a pause takes a few seconds.

Speed: responses are gzipped, static files use ETags, and API answers are memoised per data version, so the dashboard re-renders instantly until something is imported or edited.

Other hosts: anything that runs `node server.js`, or Docker: `docker build -t salesdesk . && docker run -p 3000:3000 -v salesdesk-data:/app/data salesdesk`.

## Submission contents
- Working app: run `npm start`, or the Render deploy below (add your live link here: `<LIVE LINK>`). Remember to open the link in a private window to confirm it needs no login.
- Editable source: this folder.
- Exports + manifest: `examples/export/` (`manifest.json`, `manifest.csv`), or generate with `npm run export`.
- Five slides: `docs/five_slides.pptx`
- Three findings and the rejected decision: `docs/FINDINGS.md` (quotes verified by `npm test`)
- Recording guide: `docs/narration_script.md` (record your own narration)
- Time spent: _add your hours here_

## What it does

| Need | Where |
|---|---|
| Useful dashboard | **Overview**: 8 metrics, each shown as `n / denominator · %` with its definition (ⓘ) and drill-down to the exact records; attention queue; routes, states, call outcomes; per-person table; filters for source type and person |
| Routing and analysis | Every record gets suggested route(s) with a reason and exact-quote evidence, a priority, commitments, objections, a stored-label-vs-text check, and a list of what is *not* established. Click evidence to jump to the highlighted transcript passage |
| Manual correction | Tick any routes on a record, add a note. Stored separately from the source and kept through re-imports and updates |
| Organised exports | **Export**: zip download, manifest (JSON and CSV), file preview, or write `./export` on the server |
| Repeats, updates, corrections | **Imports**: replay of the contract plus an upload for your own file |

### Routes
Support escalation, Deal next steps, Customer follow-up, Partner / channel, Internal / vendor, Coaching, Outreach log, Intake only. A record can be in several. The first in this order is the primary route.

### Import rules (lib/engine.js)
1. Identity is `(source_type, source_id)`. Never ref, title or position.
2. A strictly higher revision replaces the whole `payload` and `transcript_payload`, nulls included. Same or older revisions are ignored (and counted; a same-revision delivery with different content is flagged in the log).
3. Analysis and manual routes live beside the source fields. A newer revision re-runs the analysis and may change the *suggestion*; it never erases a manual route. The record shows "suggestion changed" until you keep yours or take the new one.
4. Freshness is `current`, `stale` or `pending`: the analysis stores the revision, rule-set version and a FNV-1a fingerprint of the text it read, and is compared with the live record.
5. Invalid records are rejected with a reason and do not stop the rest of the delivery.

### Analysis (lib/analyze.js)
Deterministic rules over the supplied text, no model call. Meetings are cited by 1-based turn number; call text has no trustworthy speaker or timing, so calls are cited by exact quote (sentence number). Quotes are tested against the source. Records with no text (no call text, silent or cancelled meeting, transcript not yet delivered) are never analysed: they go to Intake only with the reason, and appear in `intake/intake_log.csv`.

### Export layout
```
manifest.json / manifest.csv      one row per record: source_type, source_id, applied revision, routes,
                                  primary route, suggested vs manual, superseded routes, state, review reasons,
                                  analysis freshness, output paths (relative)
brief/manager_brief.md            numbers with denominators + attention list
routes/NN_<route>/<REF>__<slug>.md   one note per record per active route
records/<REF>__<slug>.json        source + derived data
intake/intake_log.csv             records with nothing to analyse
```
The export is a pure function of current state, and writing replaces the folder, so repeating it never leaves two active copies. When a manual route replaces a suggestion, the old destination is **not** exported and is listed under `superseded_routes`.

## API
`GET /api/metrics?type=&person=` · `GET /api/records?type=&person=&route=&state=&q=&review=1` · `GET /api/records/:key` · `POST /api/import` (body: delivery, or `{batch, shuffle}`) · `POST /api/import/sample {name:"initial"|"update"}` · `POST|DELETE /api/records/:key/override` · `POST /api/records/:key/acknowledge|reanalyse` · `GET /api/manifest` · `GET /api/export.zip` · `POST /api/export/write` · `POST /api/reset`

## Layout
```
server.js            HTTP + JSON API, static files
lib/engine.js        state, import contract, overrides, derived view, metrics
lib/analyze.js       rules, routing, evidence, freshness
lib/exporter.js      export builder
lib/zip.js           dependency-free zip writer
public/              the UI (vanilla JS, light/dark)
sample/              the two sample deliveries
tests/  scripts/     tests, replay and export CLIs
examples/export/     a generated export of the final state, for reference
```

## Known limits
- Rule-based analysis is transparent and fast but crude. It reads keywords, not meaning, so it can miss nuance (it flags label/text disagreements and low confidence for review instead of hiding them). Swapping in a model means replacing `analyse()` in `lib/analyze.js`; the rest does not change.
- Priority score is a heuristic: route weights + commitments + objections, minus a refusal. It orders the queue; it is not a forecast.
- No authentication and a single JSON file store: fine for one manager or a demo, not multi-user.
- Call text has no speakers, so call commitments have no owner. Talk ratios are not computed.
