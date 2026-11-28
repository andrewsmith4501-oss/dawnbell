import { clamp } from './math';

export type RuneId = 'bomb' | 'stasis' | 'gale' | 'cryonis';
export type TimeOfDayPreset = 'day' | 'sunset' | 'starlight';

export interface StaminaState {
  current: number;
  max: number;
  exhausted: boolean;
  recoveryDelay: number;
}

export type StaminaActivity = 'idle' | 'sprint' | 'climb' | 'glide' | 'swim';

export const STAMINA_DRAIN: Record<StaminaActivity, number> = {
  idle: 0,
  sprint: 22,
  climb: 19,
  glide: 8.5,
  swim: 16,
};

export const STAMINA_RECOVERY_RATE = 38;
export const CLIMB_LEAP_COST = 18;

export function createStamina(max = 100): StaminaState {
  return { current: max, max, exhausted: false, recoveryDelay: 0 };
}

export function stepStamina(
  state: StaminaState,
  activity: StaminaActivity,
  dt: number,
  isGrounded: boolean
): StaminaState {
  let { current, max, exhausted, recoveryDelay } = state;
  const drain = STAMINA_DRAIN[activity];

  if (drain > 0 && !exhausted) {
    current = Math.max(0, current - drain * dt);
    recoveryDelay = 0.55;
    if (current <= 0) {
      exhausted = true;
      recoveryDelay = 0.75;
    }
  } else {
    if (recoveryDelay > 0) {
      recoveryDelay = Math.max(0, recoveryDelay - dt);
    } else if (isGrounded || activity === 'idle') {
      const rate = exhausted ? STAMINA_RECOVERY_RATE * 0.8 : STAMINA_RECOVERY_RATE;
      current = Math.min(max, current + rate * dt);
      if (exhausted && current >= max) {
        exhausted = false;
      }
    }
  }

  return { current, max, exhausted, recoveryDelay };
}

export function consumeClimbLeap(state: StaminaState): { state: StaminaState; allowed: boolean } {
  if (state.exhausted || state.current <= 4) {
    return { state, allowed: false };
  }
  const nextCurrent = Math.max(0, state.current - CLIMB_LEAP_COST);
  return {
    allowed: true,
    state: {
      ...state,
      current: nextCurrent,
      exhausted: nextCurrent <= 0,
      recoveryDelay: 0.6,
    },
  };
}

export const ROLL_STAMINA_COST = 12;

export type DodgeStyle = 'roll' | 'backflip' | 'sidehop_left' | 'sidehop_right';

/**
 * Consumes a light stamina burst for rolling or evasive backflips/side-hops.
 * Never locks out stamina unless already near zero.
 */
export function consumeRollStamina(state: StaminaState): { state: StaminaState; allowed: boolean } {
  if (state.exhausted || state.current < 4) {
    return { state, allowed: false };
  }
  const current = Math.max(1, clamp(state.current - ROLL_STAMINA_COST, 0, state.max));
  return {
    allowed: true,
    state: {
      ...state,
      current,
      recoveryDelay: 0.45,
    },
  };
}

/**
 * Classifies Breath-of-the-Wild style evasion:
 * - Free roam (no lock-on, no shield): Forward Combat Roll
 * - Locked-on or Shielding + lateral input: Side-Hop Left / Right
 * - Locked-on or Shielding + backward or neutral input: Acrobatic Backflip
 */
export function classifyDodgeStyle(input: {
  isLockedOn: boolean;
  isShielding: boolean;
  moveX: number;
  moveZ: number;
}): DodgeStyle {
  if (!input.isLockedOn && !input.isShielding) {
    return 'roll';
  }
  if (Math.abs(input.moveX) >= 0.35 && Math.abs(input.moveX) >= Math.abs(input.moveZ) * 0.85) {
    return input.moveX < 0 ? 'sidehop_left' : 'sidehop_right';
  }
  return 'backflip';
}

export function computeJumpSlamDamage(fallHeight: number, baseDamage = 20): number {
  const bonus = Math.min(18, Math.max(0, Math.round(fallHeight * 3.5)));
  return Math.round(baseDamage * 1.4) + bonus;
}

export interface CombatModifiers {
  comboStep: 1 | 2 | 3;
  isSpinAttack: boolean;
  isFlurryRush: boolean;
  isJumpStrike: boolean;
}

export function computeSwordDamage(mod: CombatModifiers, baseDamage = 18): number {
  let mult = 1;
  if (mod.isSpinAttack) mult = 1.9;
  else if (mod.isJumpStrike) mult = 1.5;
  else if (mod.comboStep === 3) mult = 1.45;
  else if (mod.comboStep === 2) mult = 1.15;

  if (mod.isFlurryRush) mult *= 1.35;
  return Math.round(baseDamage * mult);
}

export function checkPerfectParry(shieldRaisedDuration: number, windowSeconds = 0.24): boolean {
  return shieldRaisedDuration >= 0 && shieldRaisedDuration <= windowSeconds;
}

export function checkFlurryRush(
  dodgeElapsed: number,
  enemyAttackImminent: boolean,
  distToAttacker: number
): boolean {
  return enemyAttackImminent && dodgeElapsed <= 0.28 && distToAttacker <= 5.5;
}

export interface ArrowState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  damage: number;
  critMultiplier: number;
}

export function createArrow(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  drawCharge: number
): ArrowState {
  const charge = clamp(drawCharge, 0.25, 1);
  const speed = 26 + charge * 26;
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  return {
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: (dir.x / len) * speed,
    vy: (dir.y / len) * speed + 1.4,
    vz: (dir.z / len) * speed,
    life: 3.5,
    damage: Math.round(14 + charge * 20),
    critMultiplier: 2.0,
  };
}

export function stepArrow(arrow: ArrowState, dt: number, gravity = 15.5): ArrowState {
  return {
    ...arrow,
    x: arrow.x + arrow.vx * dt,
    y: arrow.y + arrow.vy * dt,
    z: arrow.z + arrow.vz * dt,
    vy: arrow.vy - gravity * dt,
    life: arrow.life - dt,
  };
}

export interface BlastResult {
  hit: boolean;
  damage: number;
  knockback: number;
  breaksCrackedRock: boolean;
}

export function computeBombBlast(distance: number, radius = 6.2, maxDamage = 48): BlastResult {
  if (distance > radius) {
    return { hit: false, damage: 0, knockback: 0, breaksCrackedRock: false };
  }
  const falloff = 1 - clamp(distance / radius, 0, 1) * 0.65;
  return {
    hit: true,
    damage: Math.round(maxDamage * falloff),
    knockback: 11 * falloff,
    breaksCrackedRock: distance <= radius * 0.92,
  };
}

export interface StasisCharge {
  hits: number;
  dirX: number;
  dirZ: number;
}

export function computeStasisLaunch(charge: StasisCharge): { vx: number; vy: number; vz: number; power: number } {
  const clampedHits = clamp(charge.hits, 0, 6);
  if (clampedHits === 0) return { vx: 0, vy: 0, vz: 0, power: 0 };
  const len = Math.hypot(charge.dirX, charge.dirZ) || 1;
  const power = 8 + clampedHits * 4.5;
  return {
    vx: (charge.dirX / len) * power,
    vy: 4.2 + clampedHits * 1.3,
    vz: (charge.dirZ / len) * power,
    power,
  };
}

export interface PlayerInventory {
  hp: number;
  maxHp: number; // each full heart = 2 hp
  marks: number;
  arrows: number;
  apples: number;
  meals: number;
  shrinesActivated: string[];
  chestsOpened: string[];
  seedsFound: string[];
  maxStamina: number;
}

export const TOTAL_SHRINES = 3;
export const TOTAL_SEEDS = 6;

export function createInitialInventory(): PlayerInventory {
  return {
    hp: 10, // 5 hearts
    maxHp: 10,
    marks: 0,
    arrows: 18,
    apples: 3,
    meals: 1,
    shrinesActivated: [],
    chestsOpened: [],
    seedsFound: [],
    maxStamina: 100,
  };
}

export function cookHeartyMeal(inv: PlayerInventory): { inv: PlayerInventory; cooked: boolean } {
  if (inv.apples < 1) return { inv, cooked: false };
  return {
    cooked: true,
    inv: {
      ...inv,
      apples: inv.apples - 1,
      meals: inv.meals + 1,
    },
  };
}

export function consumeHealingItem(
  inv: PlayerInventory
): { inv: PlayerInventory; healed: number; item: 'meal' | 'apple' | null } {
  if (inv.hp >= inv.maxHp) return { inv, healed: 0, item: null };
  if (inv.meals > 0) {
    const nextHp = Math.min(inv.maxHp, inv.hp + 6);
    return {
      healed: nextHp - inv.hp,
      item: 'meal',
      inv: { ...inv, hp: nextHp, meals: inv.meals - 1 },
    };
  }
  if (inv.apples > 0) {
    const nextHp = Math.min(inv.maxHp, inv.hp + 2);
    return {
      healed: nextHp - inv.hp,
      item: 'apple',
      inv: { ...inv, hp: nextHp, apples: inv.apples - 1 },
    };
  }
  return { inv, healed: 0, item: null };
}

export function activateShrine(
  inv: PlayerInventory,
  shrineId: string
): { inv: PlayerInventory; newlyActivated: boolean; allComplete: boolean } {
  if (inv.shrinesActivated.includes(shrineId)) {
    return {
      inv,
      newlyActivated: false,
      allComplete: inv.shrinesActivated.length >= TOTAL_SHRINES,
    };
  }
  const nextShrines = [...inv.shrinesActivated, shrineId];
  const nextMaxHp = inv.maxHp + 2; // +1 Heart Container per Bell Shrine!
  return {
    newlyActivated: true,
    allComplete: nextShrines.length >= TOTAL_SHRINES,
    inv: {
      ...inv,
      shrinesActivated: nextShrines,
      maxHp: nextMaxHp,
      hp: nextMaxHp, // Shrine blessing restores full hearts
    },
  };
}

export class AttackTokenPool {
  private readonly maxConcurrent: number;
  private readonly holders = new Set<string>();

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  request(id: string): boolean {
    if (this.holders.has(id)) return true;
    if (this.holders.size >= this.maxConcurrent) return false;
    this.holders.add(id);
    return true;
  }

  release(id: string): void {
    this.holders.delete(id);
  }

  clear(): void {
    this.holders.clear();
  }

  get activeCount(): number {
    return this.holders.size;
  }
}

export interface ShieldSurfResult {
  vx: number;
  vz: number;
  speed: number;
  keepSurfing: boolean;
}

export function stepShieldSurf(
  vx: number,
  vz: number,
  normalX: number,
  normalZ: number,
  steerX: number,
  steerZ: number,
  dt: number
): ShieldSurfResult {
  // Downhill gravity acceleration along terrain normal projection
  const slopeAccel = 21.5;
  let nvx = vx + normalX * slopeAccel * dt + steerX * 8.5 * dt;
  let nvz = vz + normalZ * slopeAccel * dt + steerZ * 8.5 * dt;

  // Mild grass friction; downhill slopes overcome drag smoothly
  const drag = Math.exp(-0.78 * dt);
  nvx *= drag;
  nvz *= drag;

  let speed = Math.hypot(nvx, nvz);
  const maxSpeed = 16.2;
  if (speed > maxSpeed) {
    const k = maxSpeed / speed;
    nvx *= k;
    nvz *= k;
    speed = maxSpeed;
  }

  return {
    vx: nvx,
    vz: nvz,
    speed,
    keepSurfing: speed >= 2.2 || Math.hypot(normalX, normalZ) >= 0.16,
  };
}

export interface CryonisSlot {
  id: string;
  x: number;
  z: number;
}

export function planCryonisPillars(
  existing: CryonisSlot[],
  next: CryonisSlot,
  maxPillars = 3
): { slots: CryonisSlot[]; evicted: CryonisSlot | null } {
  const slots = [...existing];
  let evicted: CryonisSlot | null = null;
  if (slots.length >= maxPillars) {
    evicted = slots.shift() ?? null;
  }
  slots.push(next);
  return { slots, evicted };
}

export function collectWhisperSeed(
  inv: PlayerInventory,
  seedId: string
): { inv: PlayerInventory; newlyFound: boolean; staminaUpgraded: boolean } {
  if (inv.seedsFound.includes(seedId)) {
    return { inv, newlyFound: false, staminaUpgraded: false };
  }
  const nextSeeds = [...inv.seedsFound, seedId];
  const staminaUpgraded = nextSeeds.length % 2 === 0;
  return {
    newlyFound: true,
    staminaUpgraded,
    inv: {
      ...inv,
      seedsFound: nextSeeds,
      marks: inv.marks + 15,
      maxStamina: inv.maxStamina + (staminaUpgraded ? 15 : 0),
    },
  };
}

export function nextTimeOfDay(current: TimeOfDayPreset): TimeOfDayPreset {
  if (current === 'day') return 'sunset';
  if (current === 'sunset') return 'starlight';
  return 'day';
}

