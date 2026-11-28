import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTerrainHeight,
  getTerrainNormal,
  getBiomeAt,
  getRegionName,
  WATER_Y,
} from './math';
import {
  createStamina,
  stepStamina,
  consumeClimbLeap,
  computeSwordDamage,
  checkPerfectParry,
  checkFlurryRush,
  createArrow,
  stepArrow,
  computeBombBlast,
  computeStillstoneLaunch,
  createInitialInventory,
  cookHeartyMeal,
  consumeHealingItem,
  activateShrine,
  AttackTokenPool,
  stepShieldSurf,
  planFrostrisePillars,
  collectWhisperSeed,
  nextTimeOfDay,
} from './mechanics';

test('terrain heightfield places Awakening Overlook above valley and Mirror Lake below water', () => {
  const overlookH = getTerrainHeight(0, 46);
  const spireH = getTerrainHeight(0, 0);
  const windPeakH = getTerrainHeight(-46, -22);
  const lakeH = getTerrainHeight(14, -50);
  const islandH = getTerrainHeight(2, -58);

  assert.ok(overlookH > 5.0 && overlookH < 7.0, `Expected overlook around 6m, got ${overlookH}`);
  assert.ok(spireH > 2.5 && spireH < 4.5, `Expected spire plaza around 3.4m, got ${spireH}`);
  assert.ok(windPeakH > 12.5, `Expected Windcrest Bluff > 12.5m, got ${windPeakH}`);
  assert.ok(lakeH < WATER_Y, `Expected lake basin below water (${WATER_Y}), got ${lakeH}`);
  assert.ok(islandH > WATER_Y + 2, `Expected Shrine of Stillness island above water, got ${islandH}`);

  const normal = getTerrainNormal(0, 46);
  assert.ok(normal.y > 0.9, 'Awakening overlook should be walkable flat ground');
  assert.equal(getBiomeAt(14, -50), 'lake');
  assert.equal(getRegionName(0, 0), 'The Dawnbell Spire');
});

test('stamina drains during sprint/climb/glide, locks on exhaustion, and recovers on ground', () => {
  let st = createStamina(100);
  st = stepStamina(st, 'sprint', 2.0, true);
  assert.ok(st.current < 100 && st.current > 40);
  assert.equal(st.exhausted, false);

  // Exhaust stamina completely while climbing
  for (let i = 0; i < 6; i++) {
    st = stepStamina(st, 'climb', 1.0, false);
  }
  assert.equal(st.current, 0);
  assert.equal(st.exhausted, true);

  // Climb leap disallowed when exhausted
  const leapDenied = consumeClimbLeap(st);
  assert.equal(leapDenied.allowed, false);

  // Recover fully on ground
  for (let i = 0; i < 6; i++) {
    st = stepStamina(st, 'idle', 1.0, true);
  }
  assert.equal(st.current, 100);
  assert.equal(st.exhausted, false);

  const leapAllowed = consumeClimbLeap(st);
  assert.equal(leapAllowed.allowed, true);
  assert.ok(leapAllowed.state.current < 100);
});

test('combat damage, perfect parry, flurry rush, and attack token pool work deterministically', () => {
  const hit1 = computeSwordDamage({ comboStep: 1, isSpinAttack: false, isFlurryRush: false, isJumpStrike: false });
  const hit3 = computeSwordDamage({ comboStep: 3, isSpinAttack: false, isFlurryRush: false, isJumpStrike: false });
  const spin = computeSwordDamage({ comboStep: 1, isSpinAttack: true, isFlurryRush: false, isJumpStrike: false });
  const flurry = computeSwordDamage({ comboStep: 2, isSpinAttack: false, isFlurryRush: true, isJumpStrike: false });

  assert.ok(hit3 > hit1);
  assert.ok(spin > hit3);
  assert.ok(flurry > hit1);

  assert.equal(checkPerfectParry(0.12), true);
  assert.equal(checkPerfectParry(0.5), false);
  assert.equal(checkFlurryRush(0.15, true, 3.2), true);
  assert.equal(checkFlurryRush(0.45, true, 3.2), false);

  const pool = new AttackTokenPool(2);
  assert.equal(pool.request('e1'), true);
  assert.equal(pool.request('e2'), true);
  assert.equal(pool.request('e3'), false);
  pool.release('e1');
  assert.equal(pool.request('e3'), true);
});

test('arrows follow gravity arc, bombs blast cracked rocks, and stasis launches charged targets', () => {
  const arrow = createArrow({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -1 }, 1.0);
  const next = stepArrow(arrow, 0.2);
  assert.ok(next.z < arrow.z);
  assert.ok(next.vy < arrow.vy);

  const nearBlast = computeBombBlast(2.0);
  const farBlast = computeBombBlast(10.0);
  assert.equal(nearBlast.hit, true);
  assert.equal(nearBlast.breaksCrackedRock, true);
  assert.equal(farBlast.hit, false);

  const stasisZero = computeStillstoneLaunch({ hits: 0, dirX: 1, dirZ: 0 });
  const stasisCharged = computeStillstoneLaunch({ hits: 4, dirX: 0, dirZ: -1 });
  assert.equal(stasisZero.power, 0);
  assert.ok(stasisCharged.vz < -20);
  assert.ok(stasisCharged.vy > 6);
});

test('cooking, healing, and 3-shrine activation progress cleanly to victory', () => {
  let inv = createInitialInventory();
  const cookRes = cookHeartyMeal(inv);
  assert.equal(cookRes.cooked, true);
  assert.equal(cookRes.inv.apples, inv.apples - 1);
  assert.equal(cookRes.inv.meals, inv.meals + 1);

  inv = { ...cookRes.inv, hp: 4 };
  const healRes = consumeHealingItem(inv);
  assert.equal(healRes.item, 'meal');
  assert.equal(healRes.healed, 6);
  assert.equal(healRes.inv.hp, 10);

  let prog = activateShrine(healRes.inv, 'shrine_wind');
  assert.equal(prog.newlyActivated, true);
  assert.equal(prog.allComplete, false);
  assert.equal(prog.inv.maxHp, 12);

  prog = activateShrine(prog.inv, 'shrine_embers');
  assert.equal(prog.allComplete, false);

  prog = activateShrine(prog.inv, 'shrine_stillness');
  assert.equal(prog.allComplete, true);
  assert.equal(prog.inv.maxHp, 16);
});

test('shield surfing accelerates downhill and cryonis caps active ice pillars at 3', () => {
  const downhill = stepShieldSurf(0, -6, 0, -0.4, 0, 0, 0.25);
  assert.ok(downhill.speed > 6, `Expected downhill acceleration, got ${downhill.speed}`);
  assert.equal(downhill.keepSurfing, true);

  const stalled = stepShieldSurf(0, -1, 0, 0, 0, 0, 0.25);
  assert.equal(stalled.keepSurfing, false);

  let slots: Array<{ id: string; x: number; z: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const res = planFrostrisePillars(slots, { id: `ice_${i}`, x: i * 4, z: -40 });
    slots = res.slots;
    assert.equal(res.evicted, null);
  }
  const fourth = planFrostrisePillars(slots, { id: 'ice_4', x: 16, z: -40 });
  assert.equal(fourth.slots.length, 3);
  assert.equal(fourth.evicted?.id, 'ice_1');
});

test('whisper-sprite seeds award marks and expand max stamina every 2 seeds', () => {
  let inv = createInitialInventory();
  const s1 = collectWhisperSeed(inv, 'seed_spire');
  assert.equal(s1.newlyFound, true);
  assert.equal(s1.staminaUpgraded, false);
  assert.equal(s1.inv.maxStamina, 100);

  const dup = collectWhisperSeed(s1.inv, 'seed_spire');
  assert.equal(dup.newlyFound, false);

  const s2 = collectWhisperSeed(s1.inv, 'seed_balloon_1');
  assert.equal(s2.newlyFound, true);
  assert.equal(s2.staminaUpgraded, true);
  assert.equal(s2.inv.maxStamina, 115);

  assert.equal(nextTimeOfDay('day'), 'sunset');
  assert.equal(nextTimeOfDay('sunset'), 'starlight');
  assert.equal(nextTimeOfDay('starlight'), 'day');
});

test('free-roam dodge rolls forward, locked/shielded dodge backflips or side-hops, and jump slam scales with height', async () => {
  const { consumeRollStamina, classifyDodgeStyle, computeJumpSlamDamage } = await import('./mechanics');
  assert.equal(classifyDodgeStyle({ isLockedOn: false, isShielding: false, moveX: 0, moveZ: -1 }), 'roll');
  assert.equal(classifyDodgeStyle({ isLockedOn: false, isShielding: false, moveX: 1, moveZ: 0 }), 'roll');
  assert.equal(classifyDodgeStyle({ isLockedOn: true, isShielding: false, moveX: -0.9, moveZ: 0 }), 'sidehop_left');
  assert.equal(classifyDodgeStyle({ isLockedOn: true, isShielding: false, moveX: 0.9, moveZ: 0 }), 'sidehop_right');
  assert.equal(classifyDodgeStyle({ isLockedOn: true, isShielding: false, moveX: 0, moveZ: 1 }), 'backflip');
  assert.equal(classifyDodgeStyle({ isLockedOn: false, isShielding: true, moveX: 0, moveZ: 0 }), 'backflip');

  const st = createStamina(100);
  const rolled = consumeRollStamina(st);
  assert.equal(rolled.allowed, true);
  assert.ok(rolled.state.current < 100 && rolled.state.current >= 80);

  const exhausted = { ...st, current: 0, exhausted: true };
  assert.equal(consumeRollStamina(exhausted).allowed, false);

  const lowSlam = computeJumpSlamDamage(1.0);
  const highSlam = computeJumpSlamDamage(5.0);
  assert.ok(highSlam > lowSlam && lowSlam >= 28);
});


