# Findings and decision

Every quote below is checked against the source by `npm test` (tests/findings.test.js).

## 1. Only 40.9% of the day can be judged; the connected-call count overstates what we know

18 of 44 records (40.9%) have usable text. 20 calls have no logged text, 3 meetings were silent and 3 were never captured. Of the 11 calls the source marks as connected, 2 (B11, B14) have no text and an outcome of 'unresponsive', so only 9 connected calls can be reviewed.

Evidence:
- **M05**: “The meeting was recorded but nobody spoke.”
- **B11** source fields: is_connected = true, observed_outcome = unresponsive, transcript = null
- **B14** source fields: is_connected = true, observed_outcome = unresponsive, transcript = null

So what: Do not read the dashboard as a team performance view. Fix capture (text logging for calls, notetaker on meetings) before judging reps.

## 2. M04 Cedarwave Distribution is the one record that needs a manager today

An existing customer is being moved off its prepaid card programme. The customer says moving from prepaid to credit is the main issue, our rep refuses to promise it, and both sides left with open follow-ups and no date.

Evidence:
- **M04** turn 10: “The replacement I described is still prepaid. I do not want to promise that this becomes a credit card in the near term.”
- **M04** turn 11: “moving from prepaid to credit is the main issue for us”
- **M04** turn 23: “I will check whether your already-issued cards can join the transaction-feed programme.”
- **M04** turn 32: “Okay. I will come back to you on that as well.”

So what: Highest priority score (80). Assign an owner and a date for the eligibility answer before the old programme closes.

## 3. The stored label on C09 is wrong: it is not a referral

The source labels C09 'referred'. The contact declined the offer, said they build their own software, and refused to let the rep use their name. Routing it to Deal next steps would put a dead lead in the pipeline; it goes to Outreach log with a coaching flag instead.

Evidence:
- **C09**: “we aren't looking for anything outside the organisation”
- **C09**: “No, please don't use my name.”
- **C09** source fields: observed_outcome = referred

So what: Stored outcome labels are an input to check, not a fact. The label-versus-text check flagged 5 of 10 text-covered calls; on reading them, C09 is a true mismatch and the others are false alarms (see limits).

## Decision considered and rejected

**Keep one route field and let the latest analysis overwrite it**

Considered: The simplest design stores a single 'route' per record that every import refreshes. It needs no override model, no 'suggestion changed' state and no superseded exports.

Why rejected: It destroys manager decisions. M07 shows it: the transcript was withheld in revision 1 and arrived in revision 2. A manager who routed M07 to Customer follow-up while waiting would lose that choice the moment the update ran, and the export would silently move the file. The same flaw would let a re-import of old data undo corrections.

Chosen instead: Store the manual route beside, not inside, the source and the suggestion. A newer revision may change the suggestion and shows a 'suggestion changed' banner, but the manual route stays in force until the manager keeps it or resets it. Costs: a second field, a banner, and 'superseded' bookkeeping in the manifest.

Tested in: tests/engine.test.js: 'import contract replay' and 'manual route survives a changed suggestion'

## Limits

- Rule-based analysis reads keywords, not meaning. The stored-label check flagged 5 of 10 text-covered calls (C02, C04, C06, C07, C09). On reading them, only C09 is a true mismatch; the other four are false alarms. They are flagged for review rather than silently changed.
- Priority score is a heuristic for ordering the queue, not a forecast.
- Call text has no speaker labels, so call commitments have no owner.
