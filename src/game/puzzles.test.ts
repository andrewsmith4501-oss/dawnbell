import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPuzzleState,
  ringChimeBell,
  checkStasisSocketLock,
  igniteDawnBrazier,
  countSolvedPuzzles,
  isAllPuzzlesSolved,
  DAWN_BRAZIER_IDS,
} from './puzzles';

test('Resonance Chime Bells require Gold -> Teal -> Coral sequence and recover cleanly on misstep', () => {
  let st = createPuzzleState();

  // Wrong first bell does not progress
  let r = ringChimeBell(st, 'coral');
  st = r.state;
  assert.equal(r.matchedStep, false);
  assert.equal(r.stepIndex, 0);

  // Correct step 1 & 2
  r = ringChimeBell(st, 'gold');
  st = r.state;
  assert.equal(r.matchedStep, true);
  assert.equal(r.stepIndex, 1);

  r = ringChimeBell(st, 'teal');
  st = r.state;
  assert.equal(r.matchedStep, true);
  assert.equal(r.stepIndex, 2);

  // Wrong third bell (gold) restarts cleanly at step 1
  r = ringChimeBell(st, 'gold');
  st = r.state;
  assert.equal(r.matchedStep, true);
  assert.equal(r.reset, true);
  assert.equal(r.stepIndex, 1);

  // Complete full sequence
  st = ringChimeBell(st, 'teal').state;
  r = ringChimeBell(st, 'coral');
  st = r.state;
  assert.equal(r.justSolved, true);
  assert.equal(countSolvedPuzzles(st), 1);

  // Re-ringing after solve is idempotent
  const after = ringChimeBell(st, 'gold');
  assert.equal(after.justSolved, false);
});

test('Stasis Runic Socket locks only when boulder enters socket radius', () => {
  let st = createPuzzleState();
  const miss = checkStasisSocketLock(st, 8.8, 36.2, 13.2, 29.0);
  assert.equal(miss.justSolved, false);
  assert.equal(miss.state.socketLocked, false);

  const hit = checkStasisSocketLock(st, 12.6, 29.8, 13.2, 29.0);
  st = hit.state;
  assert.equal(hit.justSolved, true);
  assert.equal(st.socketLocked, true);
  assert.equal(countSolvedPuzzles(st), 1);

  // Second check is idempotent
  const repeat = checkStasisSocketLock(st, 13.2, 29.0, 13.2, 29.0);
  assert.equal(repeat.justSolved, false);
});

test('Dawn Braziers solve when all three Spire braziers are ignited', () => {
  let st = createPuzzleState();
  const r1 = igniteDawnBrazier(st, DAWN_BRAZIER_IDS[0]);
  st = r1.state;
  assert.equal(r1.newlyLit, true);
  assert.equal(r1.litCount, 1);
  assert.equal(r1.justSolved, false);

  // Duplicate brazier ignition is ignored
  const dup = igniteDawnBrazier(st, DAWN_BRAZIER_IDS[0]);
  assert.equal(dup.newlyLit, false);
  assert.equal(dup.litCount, 1);

  st = igniteDawnBrazier(st, DAWN_BRAZIER_IDS[1]).state;
  const r3 = igniteDawnBrazier(st, DAWN_BRAZIER_IDS[2]);
  st = r3.state;
  assert.equal(r3.justSolved, true);
  assert.equal(r3.litCount, 3);

  // Complete all 3 puzzles
  st = ringChimeBell(st, 'gold').state;
  st = ringChimeBell(st, 'teal').state;
  st = ringChimeBell(st, 'coral').state;
  st = checkStasisSocketLock(st, 13.2, 29.0, 13.2, 29.0).state;
  assert.equal(isAllPuzzlesSolved(st), true);
  assert.equal(countSolvedPuzzles(st), 3);
});
