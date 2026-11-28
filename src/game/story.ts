export type ChapterId = 1 | 2 | 3;

export type StoryEvent =
  | 'spoke_odo'
  | 'cleared_whisper_camp'
  | 'awakened_wind_shrine'
  | 'shattered_boulder'
  | 'cleared_canyon_camp'
  | 'awakened_ember_shrine'
  | 'cleared_highland_camp'
  | 'defeated_sentinel'
  | 'awakened_stillness_shrine';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface ChapterGoal {
  event: StoryEvent;
  label: string;
}

export interface ChapterAtmosphere {
  skyHex: string;
  fogHex: string;
  fogNear: number;
  fogFar: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  dawnLampLit: boolean;
}

export interface ChapterDef {
  id: ChapterId;
  roman: 'I' | 'II' | 'III';
  title: string;
  subtitle: string;
  regionFocus: string;
  summary: string;
  completionText: string;
  rewardText: string;
  goals: ChapterGoal[];
  introDialogue: DialogueLine[];
  atmosphere: ChapterAtmosphere;
}

export const CHAPTERS: Record<ChapterId, ChapterDef> = {
  1: {
    id: 1,
    roman: 'I',
    title: "The Warden's Trial",
    subtitle: "Chapter I · The Warden's Trial",
    regionFocus: 'Whisperwood & Windcrest Bluff',
    summary:
      'The Great Dawnbell fell silent when the valley seals fractured. Guided by Pip, young Wren must answer Warden Odo at Hearthbrook Outpost, clear the monsters holding Whisperwood Camp, and climb Windcrest Bluff to awaken the Shrine of Wind.',
    completionText:
      'The First Toll rings bright across Whisperwood! Beneath the eastern cliffs, ancient stone groans awake — the way to The Hollow Deep has opened.',
    rewardText: '+1 Heart Container · Full Heal · Way to Emberstone Canyon Opened',
    goals: [
      { event: 'spoke_odo', label: 'Speak with Warden Odo at Hearthbrook Outpost' },
      { event: 'cleared_whisper_camp', label: 'Clear Whisperwood Camp to break its seal' },
      { event: 'awakened_wind_shrine', label: 'Ascend Windcrest Bluff & awaken the Shrine of Wind' },
    ],
    introDialogue: [
      {
        speaker: 'Pip',
        text: "Wren! Wake up! The Great Dawnbell atop the Spire has gone quiet, and monsters have spilled into Whisperwood!",
      },
      {
        speaker: 'Pip',
        text: "Warden Odo is waiting down the eastern trail at Hearthbrook Outpost to start your Warden's Trial. Let's glide down or head straight for the camp!",
      },
    ],
    atmosphere: {
      skyHex: '#78bff2',
      fogHex: '#96cef7',
      fogNear: 62,
      fogFar: 162,
      sunHex: 0xffefc8,
      sunIntensity: 1.75,
      hemiSkyHex: 0xaad8ff,
      hemiGroundHex: 0x3b542c,
      hemiIntensity: 0.48,
      dawnLampLit: false,
    },
  },
  2: {
    id: 2,
    roman: 'II',
    title: 'The Hollow Deep',
    subtitle: 'Chapter II · The Hollow Deep',
    regionFocus: 'Emberstone Canyon',
    summary:
      'The First Toll shook the canyon vaults awake. Venture east into sunlit amber Emberstone Canyon, shatter a cracked Hollow Seal boulder with your Ember Bomb rune, rout Canyon Horn Camp, and ignite the Shrine of Embers.',
    completionText:
      'The Second Toll echoes through the canyon depths! As dusk gathers over the northern waters, Pip kindles the golden Dawn Lamp for the journey into The Gloaming Fen.',
    rewardText: '+1 Heart Container · Dawn Lamp Kindled · Gloaming Fen Awaits',
    goals: [
      { event: 'shattered_boulder', label: 'Shatter a cracked stone seal with Ember Bomb (1 + F)' },
      { event: 'cleared_canyon_camp', label: 'Clear Canyon Horn Camp in Emberstone Canyon' },
      { event: 'awakened_ember_shrine', label: 'Awaken the Shrine of Embers in the east canyon' },
    ],
    introDialogue: [
      {
        speaker: 'Pip',
        text: 'Did you feel that tremor, Wren? The First Toll shook the ancient seals inside Emberstone Canyon — the Hollow Deep is stirring!',
      },
      {
        speaker: 'Pip',
        text: 'Select your Ember Bomb rune (1 + F) to blast cracked canyon boulders, clear Canyon Horn Camp, and awaken the Shrine of Embers to the east.',
      },
    ],
    atmosphere: {
      skyHex: '#d99c68',
      fogHex: '#e3b080',
      fogNear: 54,
      fogFar: 148,
      sunHex: 0xffcf88,
      sunIntensity: 1.82,
      hemiSkyHex: 0xffd7a8,
      hemiGroundHex: 0x5c3e26,
      hemiIntensity: 0.44,
      dawnLampLit: false,
    },
  },
  3: {
    id: 3,
    roman: 'III',
    title: 'The Gloaming Fen',
    subtitle: 'Chapter III · The Gloaming Fen',
    regionFocus: 'Highland Lookout & Azure Mirror Lake',
    summary:
      'Indigo twilight mist rolls across Azure Mirror Lake as the Gloaming Fen awakens. With your golden Dawn Lamp piercing the mist, storm Highland Lookout, vanquish the Iron Sentinel on the island, and awaken the Shrine of Stillness to restore eternal dawn.',
    completionText:
      'All three Ancient Bell Shrines sing in harmony! Twilight parts across the valley as the Great Dawnbell tolls a golden morning over Whisperwood.',
    rewardText: 'Warden of the Dawnbell · Eternal Dawn Restored',
    goals: [
      { event: 'cleared_highland_camp', label: 'Clear Highland Lookout above the Gloaming Fen' },
      { event: 'defeated_sentinel', label: 'Defeat the Iron Sentinel on Azure Mirror Lake' },
      { event: 'awakened_stillness_shrine', label: 'Awaken the Shrine of Stillness & ring the Dawnbell' },
    ],
    introDialogue: [
      {
        speaker: 'Pip',
        text: 'Twilight mist is rolling off Azure Mirror Lake — the Gloaming Fen has awakened! Hold close: the Dawn Lamp on your belt will light our way through the fog.',
      },
      {
        speaker: 'Pip',
        text: 'Clear Highland Lookout, topple the ancient Iron Sentinel guarding the lake island, and awaken the Shrine of Stillness to ring the Grand Dawnbell!',
      },
    ],
    atmosphere: {
      skyHex: '#253554',
      fogHex: '#2d3f62',
      fogNear: 28,
      fogFar: 112,
      sunHex: 0x9bb8eb,
      sunIntensity: 0.96,
      hemiSkyHex: 0x627eb5,
      hemiGroundHex: 0x1d2924,
      hemiIntensity: 0.36,
      dawnLampLit: true,
    },
  },
};

export interface StoryState {
  currentChapter: ChapterId;
  completedChapters: ChapterId[];
  completedEvents: StoryEvent[];
  dawnLampUnlocked: boolean;
  storyFinished: boolean;
}

export function createStoryState(startChapter: ChapterId = 1): StoryState {
  const completedChapters: ChapterId[] = [];
  if (startChapter >= 2) completedChapters.push(1);
  if (startChapter >= 3) completedChapters.push(2);
  return {
    currentChapter: startChapter,
    completedChapters,
    completedEvents: [],
    dawnLampUnlocked: startChapter === 3,
    storyFinished: false,
  };
}

export function getCurrentChapterDef(state: StoryState): ChapterDef {
  return CHAPTERS[state.currentChapter];
}

export function isChapterGoalsComplete(state: StoryState, chapterId: ChapterId): boolean {
  const def = CHAPTERS[chapterId];
  return def.goals.every((g) => state.completedEvents.includes(g.event));
}

export function getNextObjectiveLabel(state: StoryState): string {
  if (state.storyFinished) return 'Eternal Dawn Restored — Explore Whisperwood Valley';
  const def = CHAPTERS[state.currentChapter];
  const nextGoal = def.goals.find((g) => !state.completedEvents.includes(g.event));
  return nextGoal ? nextGoal.label : def.title;
}

export function recordStoryEvent(
  state: StoryState,
  event: StoryEvent
): {
  state: StoryState;
  newlyCompletedGoal: string | null;
  chapterJustCompleted: ChapterId | null;
  storyFinished: boolean;
} {
  if (state.completedEvents.includes(event)) {
    return {
      state,
      newlyCompletedGoal: null,
      chapterJustCompleted: null,
      storyFinished: state.storyFinished,
    };
  }

  const nextEvents = [...state.completedEvents, event];
  let newlyCompletedGoal: string | null = null;
  const activeDef = CHAPTERS[state.currentChapter];
  const matchedGoal = activeDef.goals.find((g) => g.event === event);
  if (matchedGoal) newlyCompletedGoal = matchedGoal.label;

  let nextState: StoryState = {
    ...state,
    completedEvents: nextEvents,
  };

  let chapterJustCompleted: ChapterId | null = null;
  if (!nextState.completedChapters.includes(nextState.currentChapter) && isChapterGoalsComplete(nextState, nextState.currentChapter)) {
    chapterJustCompleted = nextState.currentChapter;
    const nextCompleted = [...nextState.completedChapters, chapterJustCompleted];
    if (chapterJustCompleted === 3) {
      nextState = {
        ...nextState,
        completedChapters: nextCompleted,
        storyFinished: true,
      };
    } else {
      const nextChapter = (chapterJustCompleted + 1) as ChapterId;
      nextState = {
        ...nextState,
        completedChapters: nextCompleted,
        currentChapter: nextChapter,
        dawnLampUnlocked: nextState.dawnLampUnlocked || nextChapter === 3,
      };
    }
  }

  return {
    state: nextState,
    newlyCompletedGoal,
    chapterJustCompleted,
    storyFinished: nextState.storyFinished,
  };
}

export function getOdoDialogue(state: StoryState): DialogueLine[] {
  if (state.storyFinished) {
    return [
      {
        speaker: 'Warden Odo',
        text: 'The Great Dawnbell sings across Whisperwood once more! You have passed the Trial, braved the Hollow Deep, and banished the Gloaming Fen, Wren.',
      },
      {
        speaker: 'Warden Odo',
        text: 'The valley is yours to roam under endless golden skies. May the wind always lift your Paraglider!',
      },
    ];
  }

  if (state.currentChapter === 1) {
    const doneCamp = state.completedEvents.includes('cleared_whisper_camp');
    const doneWind = state.completedEvents.includes('awakened_wind_shrine');
    if (doneCamp && doneWind) {
      return [
        {
          speaker: 'Warden Odo',
          text: "By the Bell — you've already cleared Whisperwood Camp and awakened the Shrine of Wind! You have proven yourself a true Warden, Wren!",
        },
      ];
    }
    return [
      {
        speaker: 'Warden Odo',
        text: "Ah, Wren! You made it down from Awakening Overlook. The Great Dawnbell fell silent last dusk — so today begins your Warden's Trial.",
      },
      {
        speaker: 'Warden Odo',
        text: "First, break the monster hold on Whisperwood Camp to the west. Then climb the Dawnbell Spire or ride a Gale Updraft (3 + F) up Windcrest Bluff to awaken the Shrine of Wind!",
      },
    ];
  }

  if (state.currentChapter === 2) {
    return [
      {
        speaker: 'Warden Odo',
        text: 'That First Toll rang clear to the peaks! Now the Hollow Deep stirs in Emberstone Canyon just east of Hearthbrook.',
      },
      {
        speaker: 'Warden Odo',
        text: 'Use Ember Bombs (1 + F) to shatter the cracked canyon seals, rout Canyon Horn Camp, and awaken the Shrine of Embers. Watch out for armoured beetles!',
      },
    ];
  }

  return [
    {
      speaker: 'Warden Odo',
      text: 'The Gloaming Fen has swallowed Azure Mirror Lake in twilight mist, Wren. Keep your Dawn Lamp burning bright — it will guide you across the dark waters.',
    },
    {
      speaker: 'Warden Odo',
      text: 'Clear Highland Lookout, parry or shoot the glowing eye of the Iron Sentinel, and awaken the Shrine of Stillness to restore the dawn!',
    },
  ];
}

// ================= SIDE QUESTS =================

export type SideQuestId =
  | 'mira_harvest'
  | 'bram_archery'
  | 'whisper_canopy'
  | 'ancient_sanctuaries'
  | 'ore_prospector';

export type SideQuestStatus = 'available' | 'active' | 'ready' | 'completed';

export interface SideQuestDef {
  id: SideQuestId;
  title: string;
  giver: string;
  region: string;
  targetCount: number;
  summary: string;
  objectiveLabel: string;
  rewardText: string;
  x: number;
  z: number;
}

export const SIDE_QUESTS: Record<SideQuestId, SideQuestDef> = {
  mira_harvest: {
    id: 'mira_harvest',
    title: 'Hearthbrook Harvest',
    giver: 'Mira the Herbalist',
    region: 'Hearthbrook Keep',
    targetCount: 3,
    summary:
      'Mira is preparing a warm Hearthbrook Stew for returning travelers. Forage 3 Wild Apples (or cook Hearty Skewers) and bring them to Mira at Hearthbrook Keep.',
    objectiveLabel: 'Wild Apples / Meals brought to Mira',
    rewardText: '+2 Hearty Skewers · +40 Marks · +10 Arrows',
    x: 24.4,
    z: 22.8,
  },
  bram_archery: {
    id: 'bram_archery',
    title: "Bram's Fletcher Trial",
    giver: 'Bram the Smith',
    region: 'Hearthbrook Keep',
    targetCount: 3,
    summary:
      "Test Bram's newly fletched recurve arrows by shooting all 3 Crimson Bull's-Eye Targets set around the hills of Hearthbrook Keep.",
    objectiveLabel: "Crimson Archery Targets struck",
    rewardText: '+1 Heart Container · +20 Arrows · +50 Marks',
    x: 28.4,
    z: 19.6,
  },
  whisper_canopy: {
    id: 'whisper_canopy',
    title: 'Voices of the Canopy',
    giver: 'Pip',
    region: 'Whisperwood Valley',
    targetCount: 3,
    summary:
      'Playful Whisper-Sprites hide inside spinning hillside pinwheels and sky balloons across the valley. Uncover at least 3 sprites to earn the woodland blessing.',
    objectiveLabel: 'Whisper-Sprites discovered',
    rewardText: '+60 Marks · +20 Max Stamina Blessing',
    x: -7.4,
    z: 43.2,
  },
  ancient_sanctuaries: {
    id: 'ancient_sanctuaries',
    title: 'The Three Ancient Trials',
    giver: 'Warden Odo',
    region: 'Whisperwood Valley',
    targetCount: 3,
    summary:
      'Solve all 3 ancient puzzles left by the old Bell-Keepers: the Resonance Bells at the Crossroads, the Heavy Stone Socket near Overlook Ridge, and the Three Dawn Braziers ringing the Spire.',
    objectiveLabel: 'Ancient Puzzles solved',
    rewardText: "Warden's Relic (+1 Heart Container · +100 Marks · Full Heal)",
    x: 0,
    z: 7.6,
  },
  ore_prospector: {
    id: 'ore_prospector',
    title: 'Dwarven Ore Assay',
    giver: 'Guildmaster Keldor',
    region: 'Dwarven Ore Quarry',
    targetCount: 3,
    summary:
      'Strike or blast 3 gleaming Copper, Gold, or Mithril Ore Veins across the Dwarven Ore Quarry, Emberstone Canyon, or Ashen Wilds to supply the Valenrock smithies.',
    objectiveLabel: 'Gleaming Ore Veins mined',
    rewardText: '+90 Golden Marks · +15 Arrows · Full Stamina Surge',
    x: 108,
    z: -28,
  },
};

export const SIDE_QUEST_LIST: readonly SideQuestDef[] = [
  SIDE_QUESTS.mira_harvest,
  SIDE_QUESTS.bram_archery,
  SIDE_QUESTS.whisper_canopy,
  SIDE_QUESTS.ancient_sanctuaries,
  SIDE_QUESTS.ore_prospector,
];

export interface SideQuestEntry {
  status: SideQuestStatus;
  progress: number;
}

export type SideQuestState = Record<SideQuestId, SideQuestEntry>;

export function createSideQuestState(): SideQuestState {
  return {
    mira_harvest: { status: 'available', progress: 0 },
    bram_archery: { status: 'available', progress: 0 },
    whisper_canopy: { status: 'active', progress: 0 },
    ancient_sanctuaries: { status: 'active', progress: 0 },
    ore_prospector: { status: 'active', progress: 0 },
  };
}

export function acceptSideQuest(state: SideQuestState, id: SideQuestId): SideQuestState {
  const cur = state[id];
  if (cur.status !== 'available') return state;
  const target = SIDE_QUESTS[id].targetCount;
  return {
    ...state,
    [id]: {
      status: cur.progress >= target ? 'ready' : 'active',
      progress: cur.progress,
    },
  };
}

export function setSideQuestProgress(
  state: SideQuestState,
  id: SideQuestId,
  progress: number,
  autoComplete = false
): { state: SideQuestState; justCompleted: boolean; justReady: boolean } {
  const cur = state[id];
  if (cur.status === 'completed') {
    return { state, justCompleted: false, justReady: false };
  }
  const target = SIDE_QUESTS[id].targetCount;
  const clamped = Math.max(0, Math.min(target, progress));
  if (clamped >= target) {
    if (autoComplete) {
      return {
        state: {
          ...state,
          [id]: { status: 'completed', progress: target },
        },
        justCompleted: true,
        justReady: false,
      };
    }
    const wasReady = cur.status === 'ready';
    return {
      state: {
        ...state,
        [id]: { status: 'ready', progress: target },
      },
      justCompleted: false,
      justReady: !wasReady,
    };
  }

  return {
    state: {
      ...state,
      [id]: { status: cur.status === 'available' && clamped > 0 ? 'active' : cur.status, progress: clamped },
    },
    justCompleted: false,
    justReady: false,
  };
}

export function completeSideQuest(
  state: SideQuestState,
  id: SideQuestId
): { state: SideQuestState; newlyCompleted: boolean } {
  const cur = state[id];
  if (cur.status === 'completed') {
    return { state, newlyCompleted: false };
  }
  const target = SIDE_QUESTS[id].targetCount;
  return {
    state: {
      ...state,
      [id]: { status: 'completed', progress: target },
    },
    newlyCompleted: true,
  };
}

export function getMiraDialogue(
  sideQuests: SideQuestState,
  applesAndMealsCount: number
): { lines: DialogueLine[]; action: 'accept' | 'complete' | 'none' } {
  const q = sideQuests.mira_harvest;
  if (q.status === 'completed') {
    return {
      action: 'none',
      lines: [
        {
          speaker: 'Mira the Herbalist',
          text: 'The Hearthbrook Stew smells heavenly thanks to your fresh apples, Wren! Drop by any campfire cauldron whenever you need more Hearty Skewers.',
        },
      ],
    };
  }
  if (applesAndMealsCount >= SIDE_QUESTS.mira_harvest.targetCount) {
    return {
      action: 'complete',
      lines: [
        {
          speaker: 'Mira the Herbalist',
          text: 'Oh, look at those crisp Whisperwood apples! You brought plenty for the whole Hearthbrook harvest cauldron!',
        },
        {
          speaker: 'Mira the Herbalist',
          text: 'Here — take two fresh Hearty Skewers, a pouch of 40 Marks, and a bundle of 10 Arrows for the road ahead!',
        },
      ],
    };
  }
  if (q.status === 'available') {
    return {
      action: 'accept',
      lines: [
        {
          speaker: 'Mira the Herbalist',
          text: "Hello, Wren! I'm simmering a pot of Hearthbrook Harvest Stew, but the monsters drove me away from the apple groves.",
        },
        {
          speaker: 'Mira the Herbalist',
          text: 'Bring me 3 Wild Apples (or Hearty Skewers) and I will reward you with cooked Skewers, Marks, and Arrows! Look under the trees near Overlook and Hearthbrook.',
        },
      ],
    };
  }
  const need = Math.max(1, SIDE_QUESTS.mira_harvest.targetCount - applesAndMealsCount);
  return {
    action: 'none',
    lines: [
      {
        speaker: 'Mira the Herbalist',
        text: `Just ${need} more Wild Apple${need > 1 ? 's' : ''} for the Hearthbrook Stew, Wren! Check beneath the fruit trees around Hearthbrook and Awakening Overlook.`,
      },
    ],
  };
}

export function getBramDialogue(
  sideQuests: SideQuestState,
  targetsHit: number
): { lines: DialogueLine[]; action: 'accept' | 'complete' | 'none' } {
  const q = sideQuests.bram_archery;
  if (q.status === 'completed') {
    return {
      action: 'none',
      lines: [
        {
          speaker: 'Bram the Smith',
          text: "Sharpest archer in Whisperwood! Remember: press V on a grassy ridge to Shield Surf, or time a Perfect Parry right when the Iron Sentinel's eye flashes!",
        },
      ],
    };
  }
  if (targetsHit >= SIDE_QUESTS.bram_archery.targetCount) {
    return {
      action: 'complete',
      lines: [
        {
          speaker: 'Bram the Smith',
          text: 'Three clean bull’s-eyes! Ha! Every single fletched shaft flew true as a bell chime!',
        },
        {
          speaker: 'Bram the Smith',
          text: "Take this Hearthbrook Heart Container, 20 fine Arrows, and 50 Marks — you've earned every bit of it, Warden!",
        },
      ],
    };
  }
  if (q.status === 'available') {
    return {
      action: 'accept',
      lines: [
        {
          speaker: 'Bram the Smith',
          text: "Wren! Your Dawnbell Blade looks keen, and I just strung a fresh batch of recurve arrows. Care for a Fletcher's Trial?",
        },
        {
          speaker: 'Bram the Smith',
          text: "I've set up 3 crimson Bull's-Eye Targets around Hearthbrook Outpost. Hold Right-Click (or RT) to shoot all three, then come back for a smith's reward!",
        },
      ],
    };
  }
  const left = Math.max(1, SIDE_QUESTS.bram_archery.targetCount - targetsHit);
  return {
    action: 'none',
    lines: [
      {
        speaker: 'Bram the Smith',
        text: `${left} crimson archery target${left > 1 ? 's' : ''} left standing around Hearthbrook Outpost! Draw your bow with Right-Click (or RT) and ring the bull’s-eye.`,
      },
    ],
  };
}

