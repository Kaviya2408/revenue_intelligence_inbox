'use strict';
// Runs the full import contract from the command line and prints each step.
const path = require('path');
const E = require('../lib/engine');
const a = require('../sample/01_initial.json'), b = require('../sample/02_update.json');
const s = E.newState(), show = (t, r) => console.log(t.padEnd(34), `added ${r.added} updated ${r.updated} ignored ${r.ignored_same + r.ignored_older} | unique ${r.unique_after} usable ${r.usable_after}`);
show('1 import initial', E.importBatch(s, a));
show('2 import again, reordered', E.importBatch(s, a, { shuffle: true }));
const m7 = Object.values(s.records).find(r => r.record_ref === 'M07');
E.setOverride(s, m7.key, ['customer_followup'], 'provisional until transcript arrives');
console.log('3 manual route on M07'.padEnd(34), E.derive(m7).routes.join(','));
show('4 import update (rev 2)', E.importBatch(s, b));
show('5 import initial again (stale)', E.importBatch(s, a));
const d = E.derive(s.records[m7.key]);
console.log('6 M07 now'.padEnd(34), `rev ${d.revision}, state ${d.state}, routes ${d.routes.join(',')} (${d.route_source}), suggestion changed: ${d.suggestion_changed}`);
