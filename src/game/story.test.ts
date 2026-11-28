import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTERS,
  SIDE_QUESTS,
  createStoryState,
  createSideQuestState,
  acceptSideQuest,
  setSideQuestProgress,
  completeSideQuest,
  getCurrentChapterDef,
  getNextObjectiveLabel,
  getOdoDialogue,
  getMiraDialogue,
  getBramDialogue,
  recordStoryEvent,
} from './story';

test('new adventure begins at Chapter 1: The Warden’s Trial with 3 goals', () => {
  const st = createStoryState(1);
  assert.equal(st.currentChapter, 1);
  assert.equal(st.dawnLampUnlocked, false);
  assert.equal(st.storyFinished, false);
  const def = getCurrentChapterDef(st);
  assert.equal(def.title, "The Warden's Trial");
  assert.equal(def.goals.length, 3);
  assert.match(getNextObjectiveLabel(st), /Warden Odo/i);
});

test('completing Chapter 1 goals in any order advances to Chapter 2: The Hollow Deep', () => {
  let st = createStoryState(1);
  let res = recordStoryEvent(st, 'awakened_wind_shrine');
  st = res.state;
  assert.equal(res.chapterJustCompleted, null);
  assert.equal(st.currentChapter, 1);

  res = recordStoryEvent(st, 'spoke_odo');
  st = res.state;
  assert.equal(res.chapterJustCompleted, null);

  // Duplicate event is safely ignored
  const dup = recordStoryEvent(st, 'spoke_odo');
  assert.equal(dup.newlyCompletedGoal, null);

  res = recordStoryEvent(st, 'cleared_whisper_camp');
  st = res.state;
  assert.equal(res.chapterJustCompleted, 1);
  assert.equal(st.currentChapter, 2);
  assert.equal(getCurrentChapterDef(st).title, 'The Hollow Deep');
  assert.equal(st.dawnLampUnlocked, false);
});

test('completing Chapter 2 unlocks Dawn Lamp and Chapter 3: The Gloaming Fen, then finishes story', () => {
  let st = createStoryState(2);
  assert.equal(getOdoDialogue(st)[0].speaker, 'Warden Odo');
  assert.match(getOdoDialogue(st)[0].text, /Hollow Deep/i);

  st = recordStoryEvent(st, 'shattered_boulder').state;
  st = recordStoryEvent(st, 'cleared_canyon_camp').state;
  const ch2End = recordStoryEvent(st, 'awakened_ember_shrine');
  st = ch2End.state;
  assert.equal(ch2End.chapterJustCompleted, 2);
  assert.equal(st.currentChapter, 3);
  assert.equal(st.dawnLampUnlocked, true);
  assert.equal(CHAPTERS[3].title, 'The Gloaming Fen');
  assert.equal(CHAPTERS[3].atmosphere.dawnLampLit, true);

  st = recordStoryEvent(st, 'cleared_highland_camp').state;
  st = recordStoryEvent(st, 'defeated_sentinel').state;
  const finale = recordStoryEvent(st, 'awakened_stillness_shrine');
  assert.equal(finale.chapterJustCompleted, 3);
  assert.equal(finale.storyFinished, true);
  assert.equal(finale.state.storyFinished, true);
  assert.match(getOdoDialogue(finale.state)[0].text, /Great Dawnbell sings/i);
});

test('Side Quests track Mira harvest, Bram archery targets, and auto-completing valley trials', () => {
  let sq = createSideQuestState();
  assert.equal(sq.mira_harvest.status, 'available');
  assert.equal(sq.bram_archery.status, 'available');

  // Mira offers quest if player has < 3 apples/meals
  const miraIntro = getMiraDialogue(sq, 1);
  assert.equal(miraIntro.action, 'accept');
  sq = acceptSideQuest(sq, 'mira_harvest');
  assert.equal(sq.mira_harvest.status, 'active');

  // Once player gathers 3 apples, Mira completes the quest
  const miraTurnIn = getMiraDialogue(sq, SIDE_QUESTS.mira_harvest.targetCount);
  assert.equal(miraTurnIn.action, 'complete');
  const doneMira = completeSideQuest(sq, 'mira_harvest');
  sq = doneMira.state;
  assert.equal(doneMira.newlyCompleted, true);
  assert.equal(sq.mira_harvest.status, 'completed');

  // Bram archery targets progression
  const bramOffer = getBramDialogue(sq, 0);
  assert.equal(bramOffer.action, 'accept');
  sq = acceptSideQuest(sq, 'bram_archery');
  const hit3 = setSideQuestProgress(sq, 'bram_archery', 3, false);
  sq = hit3.state;
  assert.equal(hit3.justReady, true);
  assert.equal(sq.bram_archery.status, 'ready');
  assert.equal(getBramDialogue(sq, 3).action, 'complete');

  // Auto-complete valley puzzle quest
  const puzzlesDone = setSideQuestProgress(sq, 'ancient_sanctuaries', 3, true);
  assert.equal(puzzlesDone.justCompleted, true);
  assert.equal(puzzlesDone.state.ancient_sanctuaries.status, 'completed');
});
