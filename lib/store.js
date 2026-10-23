'use strict';
const fs = require('fs'), path = require('path');
const { newState } = require('./engine');
function load(file) {
  try { const s = JSON.parse(fs.readFileSync(file, 'utf8')); if (s && s.records) return s; } catch (e) { /* first run or unreadable */ }
  return newState();
}
function save(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, file);   // atomic replace
}
module.exports = { load, save };
