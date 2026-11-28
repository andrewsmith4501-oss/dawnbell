// Shared dungeon pieces: chests, locked doors, crystal switches, grapple posts, room enemies.
import * as THREE from 'three';
import { addVoxelBox, buildTreasureChest } from '../voxelBuilder';
import type { SolidCollider } from '../collision';
import type { EnemyEntity } from '../enemies';
import { L, type SagaEnemySpec, type SagaSystem } from './saga';
import { TILE, WALL_H, type BuiltRoom } from './rooms';

/** Dungeon palettes */
export const DG_STONE = { floor: '#4c5262', wall: '#555b6c', wallTop: '#15131b', fog: '#0e1018' };
export const DG_MIRE = { floor: '#4c625a', wall: '#4f6e64', wallTop: '#0e1816', fog: '#0c1614' };
export const DG_SEA = { floor: '#6a6a72', wall: '#7a7e8a', wallTop: '#1a1e26', fog: '#101620' };

/** A treasure chest on tile (c, r). `flag` remembers it was opened. */
export function addChest(
  saga: SagaSystem,
  room: BuiltRoom,
  c: number,
  r: number,
  opts: { flag: string; shown?: () => boolean; yaw?: number; open: () => void }
): void {
  const F = saga.F;
  const { x, z } = room.tile(c, r);
  const chest = buildTreasureChest(saga.host.mats);
  chest.group.position.set(x, 0, z);
  chest.group.rotation.y = opts.yaw ?? 0;
  const col: SolidCollider = { id: `chest_${opts.flag}`, kind: 'box', x, z, minY: -1, maxY: 0.8, halfX: 0.62, halfZ: 0.44, blocksCamera: false, climbable: false, active: true };
  const shown = opts.shown ?? (() => true);
  saga.addProp(chest.group, shown, [col]);
  saga.onUpdate(() => {
    chest.lid.rotation.x = F[opts.flag] ? -1.9 : 0;
    chest.glow.visible = !F[opts.flag];
  });
  saga.addSpot({
    id: `chest_${opts.flag}`,
    x,
    z,
    y: 0,
    radius: 1.9,
    label: () => 'Open the chest',
    shown: () => shown() && !F[opts.flag],
    act: () => {
      F[opts.flag] = true;
      saga.host.sfx('item');
      saga.host.particles(x, 1.0, z, 0xffe478, 18, 5);
      opts.open();
    },
  });
}

/** Locked door slabs drawn over every tile of door `ch`, shown until `flag` is set. */
export function addDoorSlab(saga: SagaSystem, room: BuiltRoom, ch: string, flag: string, kind: 'wood' | 'bars' | 'big'): void {
  const m = saga.host.mats;
  const F = saga.F;
  const wood = m.getMat('#5a3820', { bump: 'wood', pattern: 'wood' });
  const iron = m.getMat('#3e434c', { roughness: 0.45, metalness: 0.75 });
  const gold = m.getMat('#e8b84a', { roughness: 0.3, metalness: 0.85 });
  for (const t of room.find(ch)) {
    const side = t.c === 0 ? -1 : t.c === room.w - 1 ? 1 : 0;
    const vert = side !== 0;
    const front = vert ? 0 : t.r === 0 ? -1 : 1;
    const g = new THREE.Group();
    const ox = vert ? side * TILE * 0.2 : 0;
    const oz = vert ? 0 : front * TILE * 0.2;
    if (kind === 'bars') {
      for (let i = -2; i <= 2; i++) addVoxelBox(g, 0.12, WALL_H, 0.12, iron, vert ? 0 : i * 0.3, WALL_H / 2, vert ? i * 0.3 : 0);
      addVoxelBox(g, vert ? 0.16 : TILE, 0.16, vert ? TILE : 0.16, iron, 0, WALL_H - 0.3, 0);
    } else {
      addVoxelBox(g, vert ? 0.3 : TILE, WALL_H, vert ? TILE : 0.3, kind === 'big' ? iron : wood, 0, WALL_H / 2, 0);
      addVoxelBox(g, vert ? 0.34 : TILE, 0.14, vert ? TILE : 0.34, iron, 0, 0.8, 0);
      addVoxelBox(g, vert ? 0.34 : TILE, 0.14, vert ? TILE : 0.34, iron, 0, 2.4, 0);
      addVoxelBox(g, 0.4, 0.5, 0.4, kind === 'big' ? gold : iron, 0, 1.5, 0, false);
      if (kind === 'big') addVoxelBox(g, 0.5, 0.5, 0.5, gold, 0, 2.2, 0, false);
    }
    g.position.set(t.x + ox, 0, t.z + oz);
    const col: SolidCollider = {
      id: `slab_${room.def.id}_${ch}_${t.c}_${t.r}`,
      kind: 'box',
      x: t.x + ox * 1.2,
      z: t.z + oz * 1.2,
      minY: -1,
      maxY: WALL_H + 4,
      halfX: vert ? TILE * 0.28 : TILE / 2,
      halfZ: vert ? TILE / 2 : TILE * 0.28,
      blocksCamera: false,
      climbable: false,
      active: true,
    };
    saga.addProp(g, () => !F[flag], [col]);
  }
}

/** A crystal switch: strike it (prompt) to set `flag`. */
export function addCrystal(saga: SagaSystem, room: BuiltRoom, c: number, r: number, flag: string, color = '#62c8ff', onHit?: () => void): void {
  const m = saga.host.mats;
  const F = saga.F;
  const { x, z } = room.tile(c, r);
  const g = new THREE.Group();
  addVoxelBox(g, 0.9, 0.4, 0.9, m.getMat('#3a3e48', { bump: 'stone' }), 0, 0.2, 0);
  const gemOff = m.getMat(color, { emissive: color, emissiveIntensity: 0.5, roughness: 0.15 });
  const gemOn = m.getMat('#ffe070', { emissive: '#ffb030', emissiveIntensity: 1.6, roughness: 0.15 });
  const gem = addVoxelBox(g, 0.5, 0.9, 0.5, gemOff, 0, 0.95, 0);
  gem.rotation.y = Math.PI / 4;
  g.position.set(x, 0, z);
  const col: SolidCollider = { id: `crystal_${flag}`, kind: 'box', x, z, minY: -1, maxY: 1.4, halfX: 0.45, halfZ: 0.45, blocksCamera: false, climbable: false, active: true };
  saga.addProp(g, () => true, [col]);
  let t = 0;
  saga.onUpdate((dt) => {
    t += dt;
    gem.material = F[flag] ? gemOn : gemOff;
    gem.rotation.y = Math.PI / 4 + t * 0.8;
    gem.position.y = 0.95 + Math.sin(t * 2) * 0.06;
  });
  saga.addSpot({
    id: `crystal_${flag}`,
    x,
    z,
    y: 0,
    radius: 2.0,
    label: () => 'Strike the crystal',
    shown: () => !F[flag],
    act: () => {
      F[flag] = true;
      saga.host.sfx('gate');
      saga.host.shake(0.25);
      saga.host.particles(x, 1.2, z, 0xffe070, 20, 6);
      saga.host.save();
      onHit?.();
    },
  });
}

/**
 * Enemies that appear each time Wren walks into a room. With `clearFlag`, they stay gone once
 * beaten, and `onClear` runs the first time.
 */
export function roomEnemies(
  saga: SagaSystem,
  roomId: string,
  specs: (room: BuiltRoom) => SagaEnemySpec[],
  opts: { clearFlag?: string; onClear?: () => void } = {}
): void {
  const F = saga.F;
  const tag = `room_${roomId}`;
  const room = saga.rooms.get(roomId)!;
  saga.onEnterRoom(roomId, () => {
    if (opts.clearFlag && F[opts.clearFlag]) return;
    saga.host.removeEnemies(tag);
    for (const s of specs(room)) saga.host.spawnEnemy({ ...s, tag });
  });
  if (opts.clearFlag) {
    saga.onKill((e: EnemyEntity) => {
      if (e.tag !== tag || F[opts.clearFlag!]) return;
      window.setTimeout(() => {
        if (F[opts.clearFlag!] || saga.host.anyEnemyAlive(tag)) return;
        F[opts.clearFlag!] = true;
        saga.host.save();
        opts.onClear?.();
      }, 500);
    });
  }
}

/** The Grapple Claw: pulls Wren to wooden posts, and stuns monsters (flipping beetles). */
export function setupGrapple(saga: SagaSystem): void {
  const F = saga.F;
  const host = saga.host;
  saga.addPrompt(() => {
    if (!F.hook) return null;
    const p = host.player();
    const fx = Math.sin(p.yaw);
    const fz = Math.cos(p.yaw);
    const room = saga.currentRoom;
    if (room) {
      let best: { x: number; z: number; c: number; r: number } | null = null;
      let bestDot = 0.86;
      for (const v of room.find('v')) {
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        if (d < 2.4 || d > 15.5) continue;
        const dot = ((v.x - p.x) * fx + (v.z - p.z) * fz) / d;
        if (dot > bestDot) {
          bestDot = dot;
          best = v;
        }
      }
      if (best) {
        const post = best;
        return {
          label: 'Throw the Grapple Claw',
          act: () => {
            let land: { x: number; z: number } | null = null;
            let ld = Infinity;
            for (const [dc, dr] of [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]) {
              const t = room.tile(post.c + dc, post.r + dr);
              if (!room.isFloor(t.x, t.z) || room.isPit(t.x, t.z)) continue;
              const d = Math.hypot(t.x - p.x, t.z - p.z);
              if (d < ld) {
                ld = d;
                land = t;
              }
            }
            if (land) saga.startGrapple(land.x, land.z, post.x, post.z);
          },
        };
      }
    }
    // Monsters in front
    let target: EnemyEntity | null = null;
    let bestDot = 0.88;
    for (const e of host.enemiesTagged('*')) {
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < 1.5 || d > 9) continue;
      if (e.state === 'stunned') continue;
      const dot = ((e.x - p.x) * fx + (e.z - p.z) * fz) / d;
      if (dot > bestDot) {
        bestDot = dot;
        target = e;
      }
    }
    if (target) {
      const e = target;
      return {
        label: 'Throw the Grapple Claw',
        act: () => {
          saga.flashChain(e.x, e.y + e.height * 0.5, e.z);
          host.stunEnemy(e, e.kind === 'beetle' ? 3.6 : 2.2);
          host.particles(e.x, e.y + e.height * 0.6, e.z, 0xffe070, 10, 4);
          if (e.armored) host.toast('Flipped! Strike now!', 1.4);
        },
      };
    }
    return null;
  });
}

/** The little line every dungeon uses for a small key. */
export function smallKey(saga: SagaSystem, pool: string, where: string): void {
  saga.F[pool] = Number(saga.F[pool] || 0) + 1;
  saga.gotItem('Small Key', [L('', `It opens one locked door in ${where}.`)]);
}
