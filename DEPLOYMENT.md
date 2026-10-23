# Deployment Guide

## ✅ GitHub Repository
Your code is now at: https://github.com/Kaviya2408/revenue_intelligence_inbox

## 🚀 Deploy to Render

### Option 1: Blueprint (Recommended - Automatic Setup)

1. **Go to Render Dashboard**: https://dashboard.render.com/
2. **Click "New +" → "Blueprint"**
3. **Connect your GitHub repository**: `Kaviya2408/revenue_intelligence_inbox`
4. **Render will automatically read `render.yaml`** and configure everything

The `render.yaml` file already includes:
- Service type: Web Service
- Runtime: Node 20
- Build command: `echo no build step` (no dependencies needed!)
- Start command: `node server.js`
- Health check: `/healthz`
- Environment variables:
  - `SEED_SAMPLES=1` (loads demo data when empty)
  - `STATE_FILE=/var/data/state.json` (if you add persistent storage)

### Option 2: Manual Setup

1. **Go to Render Dashboard**: https://dashboard.render.com/
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**: `Kaviya2408/revenue_intelligence_inbox`
4. **Configure the service**:
   - **Name**: `salesdesk` (or your choice)
   - **Runtime**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: Leave empty or `echo ok`
   - **Start Command**: `node server.js`
   - **Plan**: `Free` (or paid for persistent storage)

5. **Add Environment Variables**:
   - `SEED_SAMPLES` = `1` (recommended for demo)
   - `NODE_VERSION` = `20`

6. **Advanced Settings**:
   - **Health Check Path**: `/healthz`
   - **Auto-Deploy**: Yes (optional - deploys on every push)

### 🗄️ Persistent Storage (Paid Plans Only)

The free plan wipes data on restart. For persistent data:

1. **Upgrade to a paid plan** ($7/month minimum)
2. **Add a Disk**:
   - Go to your service → Storage
   - Click "Add Disk"
   - Mount path: `/var/data`
   - Size: 1 GB (minimum)
3. **The `STATE_FILE` env var is already set** to `/var/data/state.json` in `render.yaml`

### 📝 Important Notes

- **First request after sleep**: The free plan sleeps after 15 minutes of inactivity. First request takes ~30 seconds.
- **No dependencies**: This app has ZERO npm dependencies, so builds are instant.
- **Data seeding**: With `SEED_SAMPLES=1`, the app loads sample data automatically when empty.
- **Port binding**: The app binds to `0.0.0.0` and respects Render's `PORT` environment variable.
- **Health checks**: The `/healthz` endpoint returns `{"ok":true,"records":N}`.

### 🔗 Access Your App

After deployment, Render will give you a URL like:
- `https://salesdesk-xxxx.onrender.com`

Test the health check:
- `https://salesdesk-xxxx.onrender.com/healthz`

### ✅ Verify Deployment

1. Visit your Render URL
2. Click **"Import batch 1"** on the welcome screen
3. Check the **Overview** dashboard loads with metrics
4. Try **Export** → Download ZIP

### 🧪 Run Tests Locally

```bash
cd revenue_intelligence_inbox
npm test
```

All 20 tests should pass.

### 🐳 Docker Alternative (Optional)

If you prefer Docker:

```bash
docker build -t salesdesk .
docker run -p 3000:3000 -v salesdesk-data:/app/data salesdesk
```

Then visit: http://localhost:3000

### 📊 What's Included

- ✅ Complete sales intelligence inbox
- ✅ 8 metrics with drill-down
- ✅ Routing engine with evidence
- ✅ Export to ZIP with manifest
- ✅ Import/update contract
- ✅ 20 passing tests
- ✅ Sample data included
- ✅ Zero dependencies
- ✅ Single service deployment
- ✅ Gzip compression
- ✅ ETag caching
- ✅ Health checks

### 🔧 Troubleshooting

**App won't start:**
- Check Render logs for errors
- Verify `node server.js` runs locally
- Ensure PORT environment variable is not hardcoded

**No data after restart (free plan):**
- This is expected - free plan has ephemeral storage
- Set `SEED_SAMPLES=1` to auto-load demo data
- Upgrade to paid plan + add disk for persistence

**Slow first load:**
- Free plan sleeps after inactivity
- First request wakes it up (~30 seconds)
- Subsequent requests are fast

**Build fails:**
- This app has no build step
- Set build command to empty or `echo ok`

### 📚 Documentation

See `README.md` for:
- Full API documentation
- Import contract details
- Analysis rules
- Export layout
- Local development

---

**Repository**: https://github.com/Kaviya2408/revenue_intelligence_inbox
**Stack**: Node.js 18+ (zero dependencies)
**Status**: ✅ Ready for production deployment
