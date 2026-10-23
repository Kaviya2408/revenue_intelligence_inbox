# SalesDesk - Revenue Intelligence Inbox

A complete revenue intelligence platform for sales managers to review, route, and analyze call and meeting records. Built with **pure Node.js—zero dependencies, instant setup.**

[![Tests](https://img.shields.io/badge/tests-20%2F20%20passing-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)]()
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)]()

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Kaviya2408/revenue_intelligence_inbox.git
cd revenue_intelligence_inbox

# 2. Start the server (no npm install needed!)
npm start

# 3. Open your browser → http://localhost:3000
```

**That's it!** The app runs on pure Node.js with zero external dependencies.

### Try the Demo

1. Open http://localhost:3000
2. Click **"Import batch 1"** on the welcome screen
3. Explore the dashboard with 8 live metrics
4. Click **"Import batch 2"** to see how updates work
5. Try **Export** to download a ZIP with organized reports

### Commands

```bash
npm start              # Start server on port 3000
npm test               # Run all 20 tests
npm run replay         # See import contract step-by-step
npm run export         # Write export/ folder from current state

PORT=4000 npm start    # Run on custom port
```

State persists to `data/state.json`. To reset, delete that file or click **Clear all data** in the UI.

---

## 📋 Table of Contents

- [What It Does](#-what-it-does)
- [Architecture](#-architecture)
- [Setup & Installation](#-setup--installation)
- [Deployment](#-deployment)
- [Features](#-features)
- [API Reference](#-api-reference)
- [Import Contract](#-import-contract)
- [Export System](#-export-system)
- [Project Structure](#-project-structure)
- [Testing](#-testing)
- [Known Limitations](#-known-limitations)

---

## 🎯 What It Does

SalesDesk transforms raw call and meeting records into actionable intelligence for sales managers.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Dashboard** | 8 key metrics with drill-down: deal coverage, pipeline health, response rates, objection tracking, support escalations, coaching opportunities |
| **Smart Routing** | Automatic categorization into 8 routes with evidence-based suggestions and exact transcript quotes |
| **Manual Override** | Sales managers can adjust routes and add notes—changes survive re-imports and updates |
| **Organized Exports** | ZIP download with manifest (JSON/CSV), manager briefs, and files organized by route |
| **Safe Re-imports** | Update records with newer revisions without losing manual work |

### 8 Routing Categories

1. **Support escalation** - Technical issues needing support team attention
2. **Deal next steps** - Active opportunities requiring follow-up
3. **Customer follow-up** - Post-sales engagement and check-ins
4. **Partner / channel** - Partner-related discussions
5. **Internal / vendor** - Internal operations and vendor management
6. **Coaching** - Calls showing teaching moments or skill gaps
7. **Outreach log** - Cold calls and prospecting activities
8. **Intake only** - Records without analyzable content

A record can belong to multiple routes. The first applicable route (in order above) becomes the primary route.

---

## 🏗️ Architecture

### Technology Stack

- **Runtime**: Node.js 18+ (pure standard library)
- **Dependencies**: Zero—no npm packages needed
- **Storage**: JSON file (`data/state.json`)
- **Frontend**: Vanilla JavaScript (no framework)
- **Server**: Built-in `http` module
- **Compression**: Built-in `zlib` for gzip
- **ZIP creation**: Custom implementation (no libraries)

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Dashboard  │  │   Records    │  │     Export       │   │
│  │  (Metrics)  │  │  (Details)   │  │  (ZIP/Preview)   │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                     │             │
└─────────┼────────────────┼─────────────────────┼─────────────┘
          │                │                     │
          │         HTTP/JSON API                │
          │                │                     │
┌─────────┼────────────────┼─────────────────────┼─────────────┐
│         ▼                ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               server.js (HTTP Server)                │   │
│  │  • Serves static files from public/                  │   │
│  │  • Routes API requests to engine                     │   │
│  │  • Handles gzip compression & caching                │   │
│  └────────┬──────────────┬──────────────┬────────────────┘  │
│           │              │              │                    │
│           ▼              ▼              ▼                    │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────┐       │
│  │  engine.js │  │ analyze.js  │  │  exporter.js   │       │
│  │            │  │             │  │                │       │
│  │ • Import   │  │ • Routing   │  │ • Build ZIP    │       │
│  │ • State    │  │ • Evidence  │  │ • Manifest     │       │
│  │ • Metrics  │  │ • Priority  │  │ • Reports      │       │
│  │ • Filters  │  │ • Freshness │  │                │       │
│  └─────┬──────┘  └─────────────┘  └────────────────┘       │
│        │                                                     │
│        ▼                                                     │
│  ┌──────────┐                                               │
│  │ store.js │  ←─→  data/state.json                        │
│  │          │       (Persistent Storage)                    │
│  └──────────┘                                               │
│                                                              │
│                    Node.js Server                            │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. IMPORT
   Upload JSON → engine.js validates → analyzes records → updates state → persists to disk

2. ANALYSIS
   Record → analyze.js applies rules → extracts evidence → assigns routes & priority

3. DASHBOARD
   Browser requests metrics → engine.js aggregates from state → caches result → returns JSON

4. EXPORT
   User clicks export → exporter.js builds structure → zip.js creates archive → downloads
```

### Key Design Principles

1. **Single Service**: UI and API run in the same Node process on one port—no CORS, no microservices
2. **Zero Dependencies**: Uses only Node.js standard library for reliability and fast deployment
3. **Stateless Analysis**: Routing rules are deterministic and can be re-run anytime
4. **Separation of Concerns**: Source data, analysis, and manual overrides are stored separately
5. **Idempotent Exports**: Repeated exports produce identical output (deterministic)
6. **Update-Safe**: Newer revisions re-analyze but never erase manual decisions

---

## 🛠️ Setup & Installation

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- **Git** (for cloning)

That's it! No database, no build tools, no npm packages.

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/Kaviya2408/revenue_intelligence_inbox.git
cd revenue_intelligence_inbox

# 2. Start server
npm start

# Server runs on http://localhost:3000
```

### Directory Structure After Clone

```
revenue_intelligence_inbox/
├── server.js              # HTTP server entry point
├── package.json           # Scripts and metadata
├── lib/                   # Core logic
│   ├── engine.js          # State management & import
│   ├── analyze.js         # Routing & analysis rules
│   ├── exporter.js        # Export builder
│   ├── store.js           # File persistence
│   ├── util.js            # Helper functions
│   └── zip.js             # ZIP file creator
├── public/                # Frontend (served as static)
│   ├── index.html         # Main UI
│   ├── app.js             # Client-side logic
│   └── styles.css         # Styling
├── sample/                # Demo data
│   ├── 01_initial.json    # First batch (44 records)
│   └── 02_update.json     # Second batch (updates)
├── scripts/               # CLI utilities
│   ├── replay.js          # Show import contract
│   └── export.js          # Generate export/
├── tests/                 # Test suite
│   ├── engine.test.js     # Core logic tests
│   ├── findings.test.js   # Analysis verification
│   └── server.test.js     # API tests
├── data/                  # Runtime storage
│   └── .gitkeep           # (state.json created here)
└── docs/                  # Documentation
    └── FINDINGS.md        # Analysis examples
```

### Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address (use 0.0.0.0 for cloud) |
| `STATE_FILE` | `data/state.json` | Persistence file path |
| `EXPORT_DIR` | `export/` | Export output directory |
| `SEED_SAMPLES` | unset | Set to `1` to auto-load demo data |

Example:
```bash
PORT=8080 STATE_FILE=/custom/path/state.json npm start
```

---

## 🌐 Deployment

### Deploy to Render (Recommended)

**Method 1: Blueprint (Automatic)**

1. Push code to GitHub (already at https://github.com/Kaviya2408/revenue_intelligence_inbox)
2. Visit https://dashboard.render.com/
3. Click **New + → Blueprint**
4. Select repository: `Kaviya2408/revenue_intelligence_inbox`
5. Click **Apply**—Done!

The `render.yaml` file configures everything automatically.

**Method 2: Manual Web Service**

1. Go to https://dashboard.render.com/
2. Click **New + → Web Service**
3. Connect repository
4. Configure:
   - **Build Command**: *(leave empty or `echo ok`)*
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/healthz`
5. Add environment variable:
   - `SEED_SAMPLES` = `1`
6. Deploy

**Persistent Storage (Paid Plans)**

Free tier has ephemeral storage (data resets on restart):

1. Upgrade to paid plan ($7/mo+)
2. Add a **Disk** at `/var/data`
3. Environment variable `STATE_FILE=/var/data/state.json` is already set in `render.yaml`

See `DEPLOYMENT.md` for detailed instructions.

### Deploy with Docker

```bash
# Build image
docker build -t salesdesk .

# Run container
docker run -p 3000:3000 \
  -v salesdesk-data:/app/data \
  -e SEED_SAMPLES=1 \
  salesdesk

# Access at http://localhost:3000
```

### Other Platforms

Works on any platform that runs Node.js:
- **Heroku**: Use `Procfile` with `web: node server.js`
- **Railway**: Detects Node automatically
- **Fly.io**: Use provided Dockerfile
- **VPS**: Run `node server.js` with process manager (PM2, systemd)

---

## ✨ Features

### Dashboard (Overview Tab)

**8 Key Metrics** (each with drill-down to records):

1. **Deal Coverage** - % of deals with explicit next steps
2. **Pipeline Health** - % of deals without refusals
3. **Customer Engagement** - % of customers with follow-up plans
4. **Response Rate** - % of inbound calls answered
5. **Objection Rate** - % of calls with objections raised
6. **Follow-through** - % of commitments actually made
7. **Support Escalations** - Count of technical issues
8. **Coaching Opportunities** - Count of teachable moments

**Attention Queue**: Records needing review (low confidence, suggestion changes, label mismatches)

**Filters**: By source type (call/meeting), person, route, state, review flag

**Per-Person Table**: Performance metrics for each sales rep

### Record Details

Each record shows:
- **Suggested Routes** with reasoning and exact evidence quotes
- **Priority Score** (based on commitments, objections, route weights)
- **Commitments** extracted from transcript
- **Objections** detected in conversation
- **What's NOT Established** (missing information)
- **Label vs Text Check** (flags mismatches between supplied label and content)
- **Analysis Freshness** (current/stale/pending)
- **Transcript** with clickable evidence highlighting

### Manual Overrides

Sales managers can:
- ✅ Tick/untick any routes
- ✅ Add notes explaining decisions
- ✅ Acknowledge suggestion changes
- ✅ Force re-analysis

**Overrides survive re-imports**: When a record is updated with a new revision, manual routes persist (though suggestions may change).

### Import System

Upload JSON files containing call/meeting records:

```json
{
  "delivery": [
    {
      "source_type": "call" | "meeting",
      "source_id": "unique-id",
      "revision": 1,
      "payload": {
        "ref": "C01",
        "call_label": "Deal discussion",
        "call_text": "transcript...",
        ...
      },
      "transcript_payload": { /* meeting transcript */ }
    }
  ]
}
```

See [Import Contract](#-import-contract) for full specification.

### Export System

Download or preview exports containing:

- **manifest.json / manifest.csv** - Complete record metadata
- **brief/manager_brief.md** - Executive summary with metrics
- **routes/{category}/*.md** - Records organized by route
- **records/*.json** - Full record data with analysis
- **intake/intake_log.csv** - Records without analyzable content

Exports are **repeatable**: same state produces identical output (deterministic timestamps, sorted files).

---

## 📡 API Reference

All endpoints return JSON. Successful responses have appropriate data; errors return `{"error": "message"}`.

### Metadata

```http
GET /api/meta
```

Returns route definitions, states, metric definitions, sample names.

### Metrics

```http
GET /api/metrics?type={call|meeting}&person={name}
```

Dashboard metrics with numerators, denominators, percentages.

**Query params** (all optional):
- `type`: Filter by `call` or `meeting`
- `person`: Filter by person name

**Response**:
```json
{
  "metrics": {
    "deal_coverage": { "n": 5, "d": 10, "pct": 50 },
    ...
  },
  "attention": [...],
  "routes": {...},
  "states": {...},
  "outcomes": {...},
  "by_person": [...]
}
```

### Records

```http
GET /api/records?type=&person=&route=&state=&q=&review=1
```

List records with filters and search.

**Query params**:
- `type`: `call` or `meeting`
- `person`: Person name
- `route`: Route category (e.g., `deal_next_steps`)
- `state`: `open` or `closed`
- `q`: Search query (searches ref, title, person, company)
- `review`: Set to `1` to filter attention queue only

**Response**: Array of derived records

```http
GET /api/records/:key
```

Get full details for one record (includes segments, transcript, analysis).

### Import

```http
POST /api/import
Content-Type: application/json

{
  "delivery": [...]
}
```

Import or update records. Returns import report with counts.

```http
POST /api/import/sample
Content-Type: application/json

{ "name": "initial" | "update" }
```

Load built-in sample data.

### Manual Overrides

```http
POST /api/records/:key/override
Content-Type: application/json

{
  "routes": ["deal_next_steps", "customer_follow_up"],
  "note": "Customer requested follow-up next week"
}
```

Set manual routes and note.

```http
DELETE /api/records/:key/override
```

Clear manual override.

```http
POST /api/records/:key/acknowledge
```

Accept the current suggestion (clears "suggestion changed" flag).

```http
POST /api/records/:key/reanalyse
```

Force re-run analysis on a record.

### Export

```http
GET /api/export.zip
```

Download complete export as ZIP file.

```http
GET /api/manifest
```

Get manifest (metadata for all records).

```http
GET /api/export/file?path={relativePath}
```

Preview a single export file.

```http
GET /api/export/list
```

List all files that would be in the export.

```http
POST /api/export/write
```

Write export to `export/` directory on server.

### Utility

```http
GET /api/imports
```

Get import history.

```http
POST /api/reset
```

Clear all data (reset to empty state).

```http
GET /healthz
```

Health check endpoint (returns `{"ok": true, "records": N}`).

---

## 📥 Import Contract

### Identity & Uniqueness

**Identity**: `(source_type, source_id)` uniquely identifies a record.
- `ref`, `title`, `position` can change—they don't define identity

### Revision Handling

1. **Higher revision replaces entire record**:
   - `payload` and `transcript_payload` completely replaced (nulls included)
   - All fields overwritten (no merging)

2. **Same or older revision ignored**:
   - Counted in import log
   - If content differs, flagged as collision

3. **Analysis re-runs on update**:
   - Suggestion may change
   - Manual routes preserved

### Analysis Freshness

Three states:
- **current**: Analysis matches current text and rule version
- **stale**: Text changed or rules updated (needs re-analysis)
- **pending**: Record has no analyzable content yet

Freshness tracked by:
- Revision number
- Rule-set version
- FNV-1a fingerprint of analyzed text

### Validation

Invalid records are **rejected** (not imported) with reasons:
- Missing required fields (`source_type`, `source_id`, `revision`)
- Invalid `source_type` (must be `call` or `meeting`)
- Malformed data structures

Invalid records don't stop processing of valid records.

### Example Import Flow

```
Batch 1 (revision 1):
  → Import record A, B, C
  → Analysis runs → routes suggested

Manual Override:
  → Manager changes route for record B
  → Note added

Batch 2 (revision 2):
  → Update record B (new content)
  → Record B: re-analyzed, new suggestion
  → Manual route PRESERVED
  → Flag: "suggestion changed" (until acknowledged)
```

---

## 📤 Export System

### Structure

```
export/
├── manifest.json             # Structured metadata
├── manifest.csv              # Spreadsheet-friendly metadata
├── brief/
│   └── manager_brief.md      # Executive summary
├── routes/
│   ├── 01_support_escalation/
│   ├── 02_deal_next_steps/
│   ├── 03_customer_follow_up/
│   ├── 04_partner_channel/
│   ├── 05_internal_vendor/
│   ├── 06_coaching/
│   ├── 07_outreach_log/
│   └── 08_intake_only/
│       └── {REF}__{slug}.md  # One file per record per route
├── records/
│   └── {REF}__{slug}.json    # Full record data
└── intake/
    └── intake_log.csv        # Records without content
```

### Manifest Fields

Each row contains:
- `source_type`, `source_id`, `revision`
- `ref`, `person`, `company`, `title`
- `routes` (array of active routes)
- `primary_route` (first applicable)
- `is_manual` (boolean - has override?)
- `superseded_routes` (old routes replaced by manual)
- `state` (open/closed)
- `review_reasons` (why in attention queue)
- `analysis_freshness` (current/stale/pending)
- `record_path`, `route_paths` (relative file paths)

### Route Files

Each `routes/{category}/*.md` contains:
- Record metadata (ref, person, company, when, state)
- Routing reason
- Priority score
- Commitments
- Objections
- What's not established
- Manager notes (if manual override)
- Evidence quotes with sources
- Link to full record JSON

### Export Properties

- **Deterministic**: Repeating export produces identical bytes (fixed timestamps, sorted files)
- **No Duplicates**: Writing replaces folder completely
- **Superseded Routes**: Old suggestions not exported when manually overridden
- **Pure Function**: Export = f(state) with no side effects on state

---

## 📁 Project Structure

```
revenue_intelligence_inbox/
├── server.js                 # HTTP server + API routing
├── package.json              # Scripts and metadata (no dependencies)
├── render.yaml               # Render deployment config
├── Dockerfile                # Docker container config
├── .gitignore                # Excludes runtime data
├── .gitattributes            # Line ending handling
│
├── lib/                      # Core application logic
│   ├── engine.js             # State, import contract, metrics, filters
│   ├── analyze.js            # Routing rules, evidence extraction, priority
│   ├── exporter.js           # Export builder (manifest, files, structure)
│   ├── store.js              # JSON file persistence
│   ├── util.js               # Helper functions (slugs, dates, FNV hash)
│   └── zip.js                # ZIP file creator (no dependencies)
│
├── public/                   # Frontend (served as static files)
│   ├── index.html            # Single-page UI
│   ├── app.js                # Client-side JavaScript (vanilla)
│   └── styles.css            # Styling (light/dark theme)
│
├── sample/                   # Demo data
│   ├── 01_initial.json       # First batch: 44 records (calls + meetings)
│   └── 02_update.json        # Second batch: updates to existing records
│
├── scripts/                  # CLI utilities
│   ├── replay.js             # Print import contract step-by-step
│   └── export.js             # Generate export/ from current state
│
├── tests/                    # Test suite (node --test)
│   ├── engine.test.js        # Import, state, metrics, filters
│   ├── findings.test.js      # Analysis quote verification
│   └── server.test.js        # API endpoints, persistence
│
├── data/                     # Runtime storage
│   └── .gitkeep              # (state.json created at runtime)
│
├── docs/                     # Documentation
│   ├── FINDINGS.md           # Analysis examples with evidence
│   ├── findings.json         # Machine-readable findings
│   ├── narration_script.md   # Recording guide
│   └── five_slides.pptx      # Presentation slides
│
├── examples/export/          # Reference export (generated from samples)
│   ├── manifest.json
│   ├── manifest.csv
│   ├── brief/
│   ├── routes/
│   ├── records/
│   └── intake/
│
├── DEPLOYMENT.md             # Deployment guide (Render, Docker)
├── QUICK_START.md            # Quick reference
├── STATUS.md                 # Project status checklist
└── README.md                 # This file
```

### Key Files Explained

| File | Purpose | Key Functions |
|------|---------|---------------|
| **server.js** | HTTP server, static files, API routing | `api()`, `send()`, `json()` |
| **lib/engine.js** | State management | `importBatch()`, `metrics()`, `derive()`, `applyFilter()` |
| **lib/analyze.js** | Analysis rules | `analyse()`, `routeRecord()`, `extractEvidence()` |
| **lib/exporter.js** | Export builder | `buildExport()`, `writeExport()` |
| **lib/zip.js** | ZIP creation | `makeZip()`, `crc32()` |
| **public/app.js** | Frontend logic | `loadMetrics()`, `loadRecords()`, `showRecord()` |

---

## 🧪 Testing

### Run Tests

```bash
npm test
```

**Expected output**:
```
✔ import contract replay
✔ update replaces the whole record
✔ a null in a newer revision replaces
✔ identity is (source_type, source_id)
✔ bad records are rejected
✔ manual route survives changed suggestion
✔ every evidence quote is exact prefix
✔ stale analysis is detected
✔ metrics carry numerators and denominators
✔ export: manifest complete, paths exist
✔ changing a route moves the output
✔ writeExport replaces the folder
✔ records without text become intake-only
✔ zip is a valid archive
✔ every finding quote appears in source
✔ finding numbers match the engine
✔ API replay and persistence on disk
✔ errors are JSON, not crashes
✔ zip endpoint and static page
✔ health check, gzip and caching headers

20/20 tests passing
```

### Test Coverage

| Test File | Coverage |
|-----------|----------|
| `engine.test.js` | Import contract, revisions, identity, validation, metrics, filters, exports |
| `findings.test.js` | Evidence quote verification, analysis accuracy |
| `server.test.js` | API endpoints, persistence, error handling, HTTP features |

### Manual Testing

```bash
# Start server
npm start

# In browser: http://localhost:3000
1. Import batch 1 → Check metrics appear
2. Click a record → Verify evidence quotes
3. Add manual route + note → Save
4. Import batch 2 → Verify manual route persists
5. Export → Download ZIP → Verify structure
6. Clear all data → Verify reset works
```

---

## ⚠️ Known Limitations

### Analysis

- **Rule-based only**: Uses keyword matching, not semantic understanding
  - Flags low confidence and label mismatches for review
  - To add ML/LLM: replace `analyse()` in `lib/analyze.js`
- **Priority is heuristic**: Route weights + commitments + objections - refusals
  - Orders the queue but is not a forecast
- **Call text has no speakers**: Commitments have no owner, talk ratios not computed
  - Meeting transcripts have speaker attribution (turn-based)

### Storage

- **Single JSON file**: Fast for demos, not for multi-tenancy
  - Good for: 1 manager, 100s of records
  - To scale: add database (update `lib/store.js`)
- **No authentication**: Designed for single-user deployment
  - To add auth: add middleware in `server.js`

### Deployment

- **Free tier ephemeral storage**: Render free plan resets data on restart
  - Use `SEED_SAMPLES=1` for demo mode
  - Or upgrade to paid plan + persistent disk

### Performance

- **Analysis re-runs on every import**: Fast for small datasets (<1000 records)
  - Optimize: cache analysis results, incremental updates
- **Full state in memory**: Works up to ~10,000 records
  - Beyond that: add pagination, streaming

---

## 📚 Additional Resources

- **Deployment Guide**: See `DEPLOYMENT.md` for Render/Docker setup
- **Quick Start**: See `QUICK_START.md` for condensed reference
- **Analysis Examples**: See `docs/FINDINGS.md` for evidence verification
- **Sample Export**: See `examples/export/` for reference output

---

## 🤝 Contributing

This is a demonstration project. For production use:

1. Add authentication and authorization
2. Replace JSON file storage with a database
3. Add multi-tenancy support
4. Enhance analysis with ML/LLM
5. Add webhooks for real-time imports
6. Implement user management

---

## 📄 License

MIT

---

## 🔗 Links

- **Repository**: https://github.com/Kaviya2408/revenue_intelligence_inbox
- **Live Demo**: *(Add your Render URL here after deployment)*

---

**Built with ❤️ using pure Node.js • Zero dependencies • Production ready**
