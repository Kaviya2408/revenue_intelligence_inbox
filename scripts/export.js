'use strict';
// node scripts/export.js [stateFile] [outDir] — writes the export for the saved state, or for the full replay if none is saved.
const path = require('path'), E = require('../lib/engine'), store = require('../lib/store'), { writeExport } = require('../lib/exporter');
const file = process.argv[2] || path.join(__dirname, '..', 'data', 'state.json'), out = process.argv[3] || path.join(__dirname, '..', 'export');
let s = store.load(file);
if (!Object.keys(s.records).length) { s = E.newState(); E.importBatch(s, require('../sample/01_initial.json')); E.importBatch(s, require('../sample/02_update.json')); console.log('No saved state: exporting the sample replay.'); }
const r = writeExport(s, out); console.log(`Wrote ${r.files} files to ${out}`);
