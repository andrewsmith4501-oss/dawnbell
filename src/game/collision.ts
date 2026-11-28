/**
 * Pure, deterministic collision math for simplified invisible collision volumes.
 * Supports:
 *  - Oriented Bounding Boxes (OBB) with arbitrary Y-axis rotation (`rotY`)
 *  - Smooth cylinders for trees, boulders, wells, NPCs, posts, and campfires
 *  - Walkable stair & bridge ramp proxies (`ramp`) for flicker-free elevation changes
 *  - Multi-pass iterative resolution with skin-width epsilon to prevent corner jitter
 */

export interface RampSurface {
  /** Local-space axis along which elevation rises from lowY to highY */
  axis: 'x' | 'z';
  /** +1 means height rises toward +axis, -1 means height rises toward -axis */
  dir: 1 | -1;
  lowY: number;
  highY: number;
}

export interface SolidCollider {
  id: string;
  kind: 'box' | 'cylinder';
  x: number;
  z: number;
  minY: number;
  maxY: number;
  halfX: number;
  halfZ: number;
  /** Optional Y-axis rotation in radians (matches Three.js Object3D.rotation.y) */
  rotY?: number;
  /** Walkable sloped ramp proxy (stairs, bridge approaches) — never blocks horizontally */
  ramp?: RampSurface;
  /** Allows smooth automatic step-up when actor feet are within stepUpHeight of maxY */
  stepUp?: boolean;
  /** Whether an invisible raycast proxy mesh should block the camera / line-of-sight */
  blocksCamera?: boolean;
  climbable: boolean;
  active: boolean;
}

export interface SupportSurfaceResult {
  floorY: number;
  onCollider: boolean;
  collider: SolidCollider | null;
}

export interface ActorCollisionOptions {
  stepUpHeight?: number;
  passes?: number;
  skinEps?: number;
}

export interface ActorCollisionResult {
  x: number;
  z: number;
  collided: boolean;
  hitCollider: SolidCollider | null;
  hitNormalX: number;
  hitNormalZ: number;
}

export const DEFAULT_STEP_UP_HEIGHT = 0.68;
export const DEFAULT_SKIN_EPS = 0.008;

/**
 * Transform a world XZ point into a collider's local XZ frame (inverse of Three.js Y-rotation).
 * In Three.js, rotating local (lx, lz) by +rotY around Y yields:
 *   wx = cx + lx * cos(rotY) + lz * sin(rotY)
 *   wz = cz - lx * sin(rotY) + lz * cos(rotY)
 * So the inverse transform is:
 *   lx =  dx * cos(rotY) - dz * sin(rotY)
 *   lz =  dx * sin(rotY) + dz * cos(rotY)
 */
export function worldToLocalXZ(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  rotY = 0
): { lx: number; lz: number } {
  const dx = px - cx;
  const dz = pz - cz;
  if (!rotY) return { lx: dx, lz: dz };
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    lx: dx * c - dz * s,
    lz: dx * s + dz * c,
  };
}

/** Rotate a local XZ direction/normal vector back into world XZ coordinates. */
export function localToWorldDirXZ(
  lx: number,
  lz: number,
  rotY = 0
): { wx: number; wz: number } {
  if (!rotY) return { wx: lx, wz: lz };
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    wx: lx * c + lz * s,
    wz: -lx * s + lz * c,
  };
}

/** Check whether world point (x, z) lies within a collider's XZ footprint expanded by `pad`. */
export function isPointInsideColliderXZ(
  x: number,
  z: number,
  c: SolidCollider,
  pad = 0
): boolean {
  if (c.kind === 'cylinder') {
    const r = c.halfX + pad;
    const dx = x - c.x;
    const dz = z - c.z;
    return dx * dx + dz * dz <= r * r;
  }
  const { lx, lz } = worldToLocalXZ(x, z, c.x, c.z, c.rotY);
  return Math.abs(lx) <= c.halfX + pad && Math.abs(lz) <= c.halfZ + pad;
}

/**
 * Sample the walkable surface elevation provided by a single simplified collider at (x, z).
 * Returns -Infinity if the collider does not support an actor currently at `actorY`.
 */
export function sampleColliderSurfaceY(
  x: number,
  z: number,
  actorY: number,
  c: SolidCollider,
  actorRadius = 0.42,
  stepUpHeight = DEFAULT_STEP_UP_HEIGHT
): number {
  if (!c.active) return -Infinity;

  // Walkable sloped ramp proxy (e.g. Dawnbell Spire stairs, Shrine steps, Bridge aprons)
  if (c.ramp) {
    const { lx, lz } = worldToLocalXZ(x, z, c.x, c.z, c.rotY);
    const padX = c.ramp.axis === 'x' ? 0.16 : actorRadius * 0.55;
    const padZ = c.ramp.axis === 'z' ? 0.16 : actorRadius * 0.55;
    if (Math.abs(lx) > c.halfX + padX || Math.abs(lz) > c.halfZ + padZ) {
      return -Infinity;
    }
    const halfSpan = c.ramp.axis === 'x' ? c.halfX : c.halfZ;
    const coord = c.ramp.axis === 'x' ? lx : lz;
    const rawT = halfSpan > 1e-4 ? (coord + halfSpan) / (halfSpan * 2) : 0.5;
    const clampedT = Math.max(0, Math.min(1, rawT));
    const t = c.ramp.dir === 1 ? clampedT : 1 - clampedT;
    const surfY = c.ramp.lowY + (c.ramp.highY - c.ramp.lowY) * t;
    // Allow stepping smoothly onto the ramp from slightly below or landing from above
    if (actorY < surfY - stepUpHeight - 0.15) return -Infinity;
    return surfY;
  }

  // Flat top deck / walkable plinth / bridge deck / roof / pillar top
  const allowance = c.stepUp ? stepUpHeight : 0.62;
  if (actorY < c.maxY - allowance) return -Infinity;

  const supportPad = actorRadius * 0.72;
  if (!isPointInsideColliderXZ(x, z, c, supportPad)) return -Infinity;
  return c.maxY;
}

/**
 * Unified vertical support query combining natural terrain height with all active
 * simplified invisible collision surfaces (ramps, bridge decks, stepped plinths, roofs).
 */
export function sampleSupportSurfaceHeight(
  x: number,
  z: number,
  actorY: number,
  terrainY: number,
  colliders: readonly SolidCollider[],
  actorRadius = 0.42,
  stepUpHeight = DEFAULT_STEP_UP_HEIGHT
): SupportSurfaceResult {
  let bestY = terrainY;
  let bestCollider: SolidCollider | null = null;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c.active) continue;
    const sy = sampleColliderSurfaceY(x, z, actorY, c, actorRadius, stepUpHeight);
    if (sy > bestY) {
      bestY = sy;
      bestCollider = c;
    }
  }

  return {
    floorY: bestY,
    onCollider: bestCollider !== null,
    collider: bestCollider,
  };
}

/**
 * Multi-pass horizontal collision resolution for an actor cylinder against simplified
 * invisible OBB & cylinder colliders.
 * - Skips walkable ramps and low step-up ledges the actor can smoothly step onto.
 * - Uses 2 passes + tiny skin-width epsilon so corners never oscillate or flicker.
 */
export function resolveActorAgainstColliders(
  x: number,
  y: number,
  z: number,
  actorRadius: number,
  actorHeight: number,
  colliders: readonly SolidCollider[],
  options?: ActorCollisionOptions
): ActorCollisionResult {
  const stepUpHeight = options?.stepUpHeight ?? DEFAULT_STEP_UP_HEIGHT;
  const passes = options?.passes ?? 2;
  const skinEps = options?.skinEps ?? DEFAULT_SKIN_EPS;

  let outX = x;
  let outZ = z;
  let collided = false;
  let hitCollider: SolidCollider | null = null;
  let hitNormalX = 0;
  let hitNormalZ = 0;
  let bestPen = -1;

  for (let pass = 0; pass < passes; pass++) {
    let anyHitThisPass = false;

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!c.active || c.ramp) continue;

      // Vertical clearance check: let actor step cleanly onto low walkable surfaces
      const topClear = c.stepUp ? stepUpHeight : 0.36;
      if (y >= c.maxY - topClear || y + actorHeight <= c.minY + 0.04) {
        continue;
      }

      if (c.kind === 'cylinder') {
        const dx = outX - c.x;
        const dz = outZ - c.z;
        const minDist = c.halfX + actorRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const nx = dist > 1e-4 ? dx / dist : 1;
          const nz = dist > 1e-4 ? dz / dist : 0;
          const pen = minDist - dist;
          outX = c.x + nx * (minDist + skinEps);
          outZ = c.z + nz * (minDist + skinEps);
          collided = true;
          anyHitThisPass = true;
          if (pen > bestPen || (c.climbable && !hitCollider?.climbable)) {
            bestPen = pen;
            hitCollider = c;
            hitNormalX = nx;
            hitNormalZ = nz;
          }
        }
      } else {
        // Oriented Bounding Box (OBB) vs Circle in collider's local XZ frame
        const rot = c.rotY ?? 0;
        const { lx, lz } = worldToLocalXZ(outX, outZ, c.x, c.z, rot);

        // Closest point on local box [-halfX..halfX, -halfZ..halfZ]
        const clampedX = Math.max(-c.halfX, Math.min(c.halfX, lx));
        const clampedZ = Math.max(-c.halfZ, Math.min(c.halfZ, lz));
        const diffX = lx - clampedX;
        const diffZ = lz - clampedZ;
        const distSq = diffX * diffX + diffZ * diffZ;

        if (distSq >= actorRadius * actorRadius) continue;

        let localNx = 0;
        let localNz = 0;
        let pen = 0;

        if (distSq > 1e-8) {
          // Circle center is outside the box — push smoothly along closest-point normal (rounded corner!)
          const dist = Math.sqrt(distSq);
          localNx = diffX / dist;
          localNz = diffZ / dist;
          pen = actorRadius - dist;
        } else {
          // Circle center penetrated inside the box — eject along shallowest local axis
          const penX = c.halfX - Math.abs(lx) + actorRadius;
          const penZ = c.halfZ - Math.abs(lz) + actorRadius;
          if (penX < penZ) {
            localNx = lx >= 0 ? 1 : -1;
            pen = penX;
          } else {
            localNz = lz >= 0 ? 1 : -1;
            pen = penZ;
          }
        }

        const { wx: nx, wz: nz } = localToWorldDirXZ(localNx, localNz, rot);
        outX += nx * (pen + skinEps);
        outZ += nz * (pen + skinEps);
        collided = true;
        anyHitThisPass = true;

        if (pen > bestPen || (c.climbable && !hitCollider?.climbable)) {
          bestPen = pen;
          hitCollider = c;
          hitNormalX = nx;
          hitNormalZ = nz;
        }
      }
    }

    if (!anyHitThisPass) break;
  }

  return {
    x: outX,
    z: outZ,
    collided,
    hitCollider,
    hitNormalX,
    hitNormalZ,
  };
}

/**
 * Lightweight circle-vs-colliders separation for enemies & wildlife (supports OBBs & cylinders).
 */
export function resolveCircleOverlapXZ(
  x: number,
  z: number,
  actorY: number,
  actorHeight: number,
  radius: number,
  colliders: readonly SolidCollider[]
): { x: number; z: number } {
  const res = resolveActorAgainstColliders(x, actorY, z, radius, actorHeight, colliders, {
    stepUpHeight: 0.25,
    passes: 2,
    skinEps: 0.01,
  });
  return { x: res.x, z: res.z };
}
