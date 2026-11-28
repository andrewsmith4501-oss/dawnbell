export type PuzzleId = 'chime_bells' | 'stasis_socket' | 'dawn_braziers';
export type ChimeBellColor = 'gold' | 'teal' | 'coral';

export interface PuzzleDef {
  id: PuzzleId;
  title: string;
  region: string;
  x: number;
  z: number;
  hint: string;
  rewardText: string;
}

export const CHIME_SEQUENCE: readonly ChimeBellColor[] = ['gold', 'teal', 'coral'];
export const DAWN_BRAZIER_IDS: readonly string[] = [
  'brazier_spire_sw',
  'brazier_spire_se',
  'brazier_spire_n',
];

export const PUZZLE_DEFS: Record<PuzzleId, PuzzleDef> = {
  chime_bells: {
    id: 'chime_bells',
    title: 'Resonance Bells of Whisperwood',
    region: 'Whisperwood Crossroads',
    x: -5.2,
    z: 22.8,
    hint: 'Strike or shoot the three roadside bells from dawn to dusk: Gold, then Teal, then Coral.',
    rewardText: 'Resonance Relic Chest: +10 Arrows · +45 Marks · +1 Apple',
  },
  stasis_socket: {
    id: 'stasis_socket',
    title: 'The Heavy Stone Socket',
    region: 'Overlook Ridge',
    x: 13.2,
    z: 29.0,
    hint: 'Lock the Ancient Stillstone Boulder upslope (2 + F), strike it toward the glowing floor seal, and launch it into the socket.',
    rewardText: 'Stillstone Vault Chest: +1 Heartstone · +40 Marks',
  },
  dawn_braziers: {
    id: 'dawn_braziers',
    title: 'The Three Dawn Braziers',
    region: 'Dawnbell Spire Courtyard',
    x: 0,
    z: 7.6,
    hint: 'Ignite all three stone braziers ringing the Dawnbell Spire with Ember Bombs (1 + F) or your Dawn Lamp (E).',
    rewardText: 'Spire Brazier Chest: +15 Arrows · +55 Marks · +2 Apples',
  },
};

export const PUZZLE_LIST: readonly PuzzleDef[] = [
  PUZZLE_DEFS.chime_bells,
  PUZZLE_DEFS.stasis_socket,
  PUZZLE_DEFS.dawn_braziers,
];

export interface PuzzleState {
  solved: PuzzleId[];
  chimeProgress: ChimeBellColor[];
  litBraziers: string[];
  socketLocked: boolean;
}

export function createPuzzleState(): PuzzleState {
  return {
    solved: [],
    chimeProgress: [],
    litBraziers: [],
    socketLocked: false,
  };
}

export function isPuzzleSolved(state: PuzzleState, id: PuzzleId): boolean {
  return state.solved.includes(id);
}

export function countSolvedPuzzles(state: PuzzleState): number {
  return state.solved.length;
}

export function isAllPuzzlesSolved(state: PuzzleState): boolean {
  return PUZZLE_LIST.every((p) => state.solved.includes(p.id));
}

export function ringChimeBell(
  state: PuzzleState,
  color: ChimeBellColor
): {
  state: PuzzleState;
  matchedStep: boolean;
  stepIndex: number;
  reset: boolean;
  justSolved: boolean;
} {
  if (state.solved.includes('chime_bells')) {
    return {
      state,
      matchedStep: true,
      stepIndex: CHIME_SEQUENCE.length,
      reset: false,
      justSolved: false,
    };
  }

  const expected = CHIME_SEQUENCE[state.chimeProgress.length];
  if (color === expected) {
    const nextProgress = [...state.chimeProgress, color];
    const justSolved = nextProgress.length === CHIME_SEQUENCE.length;
    return {
      state: {
        ...state,
        chimeProgress: nextProgress,
        solved: justSolved ? [...state.solved, 'chime_bells'] : state.solved,
      },
      matchedStep: true,
      stepIndex: nextProgress.length,
      reset: false,
      justSolved,
    };
  }

  // If player rings the first bell ('gold') while mid-sequence, restart cleanly at step 1
  if (color === CHIME_SEQUENCE[0]) {
    return {
      state: {
        ...state,
        chimeProgress: [color],
      },
      matchedStep: true,
      stepIndex: 1,
      reset: state.chimeProgress.length > 0,
      justSolved: false,
    };
  }

  return {
    state: {
      ...state,
      chimeProgress: [],
    },
    matchedStep: false,
    stepIndex: 0,
    reset: state.chimeProgress.length > 0,
    justSolved: false,
  };
}

export function checkStillstoneSocketLock(
  state: PuzzleState,
  boulderX: number,
  boulderZ: number,
  socketX: number,
  socketZ: number,
  lockRadius = 2.15
): { state: PuzzleState; justSolved: boolean } {
  if (state.socketLocked || state.solved.includes('stasis_socket')) {
    return { state, justSolved: false };
  }
  const dist = Math.hypot(boulderX - socketX, boulderZ - socketZ);
  if (dist <= lockRadius) {
    return {
      state: {
        ...state,
        socketLocked: true,
        solved: [...state.solved, 'stasis_socket'],
      },
      justSolved: true,
    };
  }
  return { state, justSolved: false };
}

export function igniteDawnBrazier(
  state: PuzzleState,
  brazierId: string
): {
  state: PuzzleState;
  newlyLit: boolean;
  litCount: number;
  justSolved: boolean;
} {
  if (!DAWN_BRAZIER_IDS.includes(brazierId) || state.litBraziers.includes(brazierId)) {
    return {
      state,
      newlyLit: false,
      litCount: state.litBraziers.length,
      justSolved: false,
    };
  }

  const nextLit = [...state.litBraziers, brazierId];
  const allLit = DAWN_BRAZIER_IDS.every((id) => nextLit.includes(id));
  const justSolved = allLit && !state.solved.includes('dawn_braziers');

  return {
    state: {
      ...state,
      litBraziers: nextLit,
      solved: justSolved ? [...state.solved, 'dawn_braziers'] : state.solved,
    },
    newlyLit: true,
    litCount: nextLit.length,
    justSolved,
  };
}
