# Quick Start Guide

## 🎯 What is SalesDesk?

A complete sales intelligence inbox that helps sales managers review call and meeting records, route them appropriately, and export organized reports. **Zero npm dependencies.**

## 🚀 Run Locally (30 seconds)

```bash
# Clone the repo
git clone https://github.com/Kaviya2408/revenue_intelligence_inbox.git
cd revenue_intelligence_inbox

# Start the server (no npm install needed!)
npm start

# Visit http://localhost:3000
```

## 📦 What You Get

### Dashboard (Overview)
- **8 key metrics** with drill-down:
  - Deal coverage, pipeline health, customer engagement
  - Response rate, objection rate, follow-through
  - Support escalations, coaching opportunities
- **Attention queue** - records needing review
- **Per-person performance** table
- **Filters** by source type, person, route, state

### Routing Engine
- **8 route categories**: Support escalation, Deal next steps, Customer follow-up, Partner/channel, Internal/vendor, Coaching, Outreach log, Intake only
- **Evidence-based suggestions** with exact transcript quotes
- **Priority scoring** based on commitments, objections, confidence
- **Manual override** with notes (survives re-imports)

### Export System
- **ZIP download** or write to `./export/`
- **Manifest** (JSON + CSV) with all metadata
- **Organized by route** - one markdown file per record per route
- **Manager brief** with summary metrics
- **Intake log** for records without analyzable content

### Import Contract
- **Identity**: `(source_type, source_id)` - never ref/title
- **Revision handling**: higher revision replaces entire payload
- **Analysis freshness**: tracks when analysis needs refresh
- **Update-safe**: manual routes survive re-imports
- **Validation**: invalid records rejected with reasons

## 🎮 Try It

1. **Start**: `npm start`
2. **Import sample data**: Click "Import batch 1" on welcome screen
3. **Explore dashboard**: See metrics, attention queue, drill-downs
4. **Review a record**: Click any record → see evidence, routing, transcript
5. **Manual override**: Tick/untick routes, add notes
6. **Export**: Download ZIP or preview files
7. **Update**: Click "Import batch 2" → see how updates work

## 🧪 Test It

```bash
npm test          # 20 tests - all should pass
npm run replay    # See import contract in terminal
npm run export    # Write export to ./export/
```

## 🌐 Deploy to Render

See `DEPLOYMENT.md` for full instructions, or:

1. Go to https://dashboard.render.com/
2. New → Blueprint
3. Connect `Kaviya2408/revenue_intelligence_inbox`
4. Done! (reads `render.yaml` automatically)

## 📖 Key Files

| File | Purpose |
|------|---------|
| `server.js` | HTTP server + API + static files |
| `lib/engine.js` | State management + import contract |
| `lib/analyze.js` | Routing rules + evidence extraction |
| `lib/exporter.js` | Export builder |
| `public/` | UI (vanilla JS, light/dark theme) |
| `sample/` | Two sample deliveries for testing |
| `tests/` | 20 comprehensive tests |
| `render.yaml` | Render deployment config |

## 🔑 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | HTTP port |
| `STATE_FILE` | `data/state.json` | Persistence file |
| `SEED_SAMPLES` | unset | Set to `1` to load demo data when empty |
| `EXPORT_DIR` | `export/` | Where `npm run export` writes |

## ⚡ Key Features

- ✅ **Zero dependencies** - pure Node.js
- ✅ **Single service** - UI + API in one process
- ✅ **Fast** - gzip, ETags, memoization
- ✅ **Repeatable** - exports are deterministic
- ✅ **Update-safe** - re-imports preserve manual work
- ✅ **Evidence-based** - every claim has a quote
- ✅ **Transparent** - rule-based analysis (no black box)

## 🎯 Use Cases

- **Sales managers**: Review calls, prioritize follow-ups
- **Revenue ops**: Track metrics, export reports
- **Team leads**: Coach reps, monitor objections
- **Analysts**: Import data, export structured outputs

## 📚 Learn More

- `README.md` - Complete documentation
- `DEPLOYMENT.md` - Deploy to Render/Docker
- `examples/export/` - Sample export layout
- `docs/FINDINGS.md` - Analysis capabilities

## 🆘 Support

- Run `npm test` to verify everything works
- Check `data/state.json` for persistence issues
- See Render logs for deployment issues
- Free plan sleeps after inactivity (first load slow)

---

**Repository**: https://github.com/Kaviya2408/revenue_intelligence_inbox
**No dependencies** • **Node 18+** • **Production ready**
