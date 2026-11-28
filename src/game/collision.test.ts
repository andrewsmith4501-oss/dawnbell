import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SolidCollider,
  isPointInsideColliderXZ,
  resolveActorAgainstColliders,
  sampleSupportSurfaceHeight,
  worldToLocalXZ,
} from './collision';

test('oriented bounding box (OBB) resolves rotated walls accurately without corner clipping', () => {
  const rotY = Math.PI / 4; // 45-degree rotated cottage
  const cottage: SolidCollider = {
    id: 'rotated_cottage',
    kind: 'box',
    x: 20,
    z: 20,
    minY: 0,
    maxY: 5,
    halfX: 3.0,
    halfZ: 2.0,
    rotY,
    climbable: true,
    active: true,
  };

  // Push into the +localZ face of the rotated cottage (local (0, 2.2) -> world)
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const wx = 20 + 2.2 * sin;
  const wz = 20 + 2.2 * cos;

  const res = resolveActorAgainstColliders(wx, 0.5, wz, 0.48, 1.7, [cottage]);
  assert.equal(res.collided, true);
  assert.equal(res.hitCollider?.id, 'rotated_cottage');

  // After resolution, actor center in local space must be cleanly outside halfZ + radius
  const localAfter = worldToLocalXZ(res.x, res.z, cottage.x, cottage.z, rotY);
  assert.ok(localAfter.lz >= 2.0 + 0.48, `Expected local Z >= 2.48, got ${localAfter.lz}`);

  // A point near the diagonal outside the OBB (which an AABB would wrongly block!) stays free
  const freeX = 20 + 2.9 * cos + 2.6 * sin;
  const freeZ = 20 - 2.9 * sin + 2.6 * cos;
  const freeRes = resolveActorAgainstColliders(freeX, 0.5, freeZ, 0.48, 1.7, [cottage]);
  assert.equal(freeRes.collided, false);
});

test('multi-pass resolution cleanly resolves 90-degree corners without oscillation', () => {
  const wallA: SolidCollider = {
    id: 'wall_a',
    kind: 'box',
    x: 0,
    z: -2,
    minY: 0,
    maxY: 4,
    halfX: 4,
    halfZ: 0.5,
    climbable: false,
    active: true,
  };
  const wallB: SolidCollider = {
    id: 'wall_b',
    kind: 'box',
    x: -2,
    z: 0,
    minY: 0,
    maxY: 4,
    halfX: 0.5,
    halfZ: 4,
    climbable: false,
    active: true,
  };

  // Actor wedged right into the inner corner of wallA & wallB
  const res = resolveActorAgainstColliders(-1.3, 0.5, -1.3, 0.48, 1.7, [wallA, wallB]);
  assert.equal(res.collided, true);
  assert.ok(res.x >= -1.5 + 0.48, `Expected x outside wallB, got ${res.x}`);
  assert.ok(res.z >= -1.5 + 0.48, `Expected z outside wallA, got ${res.z}`);

  // Running a second resolution at the resolved position must produce zero additional movement (no flicker!)
  const stable = resolveActorAgainstColliders(res.x, 0.5, res.z, 0.48, 1.7, [wallA, wallB]);
  assert.equal(stable.collided, false);
  assert.equal(stable.x, res.x);
  assert.equal(stable.z, res.z);
});

test('walkable stair ramp smoothly elevates actor onto Spire plinth without sideways wall blocking', () => {
  const stairRamp: SolidCollider = {
    id: 'spire_stair_s',
    kind: 'box',
    x: 0,
    z: 6.75,
    minY: 0,
    maxY: 1.22,
    halfX: 1.75,
    halfZ: 0.9,
    ramp: { axis: 'z', dir: -1, lowY: 0, highY: 1.22 },
    climbable: false,
    active: true,
  };
  const plinth: SolidCollider = {
    id: 'spire_plinth_base',
    kind: 'box',
    x: 0,
    z: 0,
    minY: 0,
    maxY: 1.22,
    halfX: 5.95,
    halfZ: 5.95,
    stepUp: true,
    climbable: true,
    active: true,
  };

  // Walk northward continuously in fine 0.2m steps from z=8.4 -> z=5.0
  let y = 0;
  let prevY = -1;
  for (let z = 8.4; z >= 5.0; z -= 0.2) {
    const hRes = resolveActorAgainstColliders(0, y, z, 0.48, 1.65, [stairRamp, plinth], { stepUpHeight: 0.68 });
    assert.equal(hRes.collided, false, `Unexpected wall block/climb grab while walking up stairs at z=${z.toFixed(2)}, y=${y.toFixed(2)}`);

    const sup = sampleSupportSurfaceHeight(hRes.x, hRes.z, y, 0, [stairRamp, plinth], 0.46, 0.68);
    assert.ok(sup.floorY >= prevY - 1e-4, `Expected monotonic rise at z=${z.toFixed(2)}, got ${sup.floorY} < ${prevY}`);
    y = sup.floorY;
    prevY = y;
  }
  assert.ok(Math.abs(y - 1.22) < 0.05, `Expected arrival at plinth height 1.22, got ${y}`);
});

test('rotated Stone Arch Bridge supports walking across deck while stone parapets contain the actor', () => {
  const rotY = 1.28;
  const deck: SolidCollider = {
    id: 'bridge_deck',
    kind: 'box',
    x: -11.5,
    z: 19.5,
    minY: 1.0,
    maxY: 2.55,
    halfX: 2.1,
    halfZ: 4.4,
    rotY,
    stepUp: true,
    climbable: false,
    active: true,
  };
  // Right parapet offset +2.38 along local X
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const parapetR: SolidCollider = {
    id: 'bridge_parapet_r',
    kind: 'box',
    x: -11.5 + 2.38 * cos,
    z: 19.5 - 2.38 * sin,
    minY: 2.4,
    maxY: 3.7,
    halfX: 0.34,
    halfZ: 4.35,
    rotY,
    climbable: false,
    active: true,
  };

  // Standing in the center of the bridge deck elevates actor to 2.55
  const sup = sampleSupportSurfaceHeight(-11.5, 19.5, 2.1, 1.2, [deck, parapetR]);
  assert.equal(sup.onCollider, true);
  assert.equal(sup.floorY, 2.55);

  // Pushing sideways into the right parapet pushes actor cleanly back onto the deck
  const sideX = -11.5 + 1.85 * cos;
  const sideZ = 19.5 - 1.85 * sin;
  const hRes = resolveActorAgainstColliders(sideX, 2.55, sideZ, 0.48, 1.7, [deck, parapetR]);
  assert.equal(hRes.collided, true);
  assert.equal(hRes.hitCollider?.id, 'bridge_parapet_r');
  assert.equal(isPointInsideColliderXZ(hRes.x, hRes.z, deck, 0.1), true);
});

test('inactive dynamic colliders (shattered boulders, evicted ice pillars) are completely ignored', () => {
  const boulder: SolidCollider = {
    id: 'cracked_rock',
    kind: 'cylinder',
    x: 10,
    z: 10,
    minY: 0,
    maxY: 2.5,
    halfX: 1.5,
    halfZ: 1.5,
    climbable: true,
    active: false,
  };

  const hRes = resolveActorAgainstColliders(10.2, 0.2, 10.1, 0.48, 1.7, [boulder]);
  assert.equal(hRes.collided, false);
  const sup = sampleSupportSurfaceHeight(10, 10, 2.6, 0, [boulder]);
  assert.equal(sup.onCollider, false);
  assert.equal(sup.floorY, 0);
});
