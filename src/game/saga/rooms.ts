// Tile-map rooms (interiors and dungeons) built in the pocket area beyond POCKET_X.
import * as THREE from 'three';
import { MaterialLibrary, addVoxelBox } from '../voxelBuilder';
import type { SolidCollider } from '../collision';

export const TILE = 1.6;
export const WALL_H = 3.4;

/*
 Legend
  #  wall            .  floor           ,  rug / alt floor     (space) nothing
  T  table           B  barrel          X  crate               K  bookshelf
  b  bed             A  altar           F  forge (glows)       N  anvil
  R  counter         H  hearth (glows)  P  pew                 p  pillar
  l  lamp post       W  shallow water   C  chest (flagged)     o  ore rock
  a..z (other lower-case, see room.marks) are free floor markers
  D S U E Q Y Z      doors / stairs (see room.doors)
*/

export interface DoorDef {
  /** 'world' or another room id */
  to: string;
  /** For world exits: destination in world space */
  x?: number;
  z?: number;
  yaw?: number;
  /** For room-to-room: door char in target room */
  door?: string;
  label: string;
  /** Flag that must be truthy to pass */
  needs?: string;
  lockedText?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  map: string[];
  floor: string;
  floor2?: string;
  wall: string;
  wallTop?: string;
  dark?: boolean;
  doors: Record<string, DoorDef>;
  /** Fog colour inside */
  fog?: string;
}

export interface BuiltRoom {
  def: RoomDef;
  ox: number;
  oz: number;
  w: number;
  h: number;
  group: THREE.Group;
  /** Tile centre in world space */
  tile: (c: number, r: number) => { x: number; z: number };
  /** Find marker tiles by char */
  find: (ch: string) => Array<{ x: number; z: number; c: number; r: number }>;
  colliders: SolidCollider[];
  gates: Map<string, { colliders: SolidCollider[]; meshes: THREE.Object3D[] }>;
}

let roomSerial = 0;

export function buildRoom(
  mats: MaterialLibrary,
  def: RoomDef,
  ox: number,
  oz: number,
  gateFlags: Record<string, string> = {}
): BuiltRoom {
  const group = new THREE.Group();
  const h = def.map.length;
  const w = Math.max(...def.map.map((l) => l.length));
  const at = (c: number, r: number) => (r >= 0 && r < h && c >= 0 && c < def.map[r].length ? def.map[r][c] : ' ');
  const tile = (c: number, r: number) => ({ x: ox + (c + 0.5) * TILE, z: oz + (r + 0.5) * TILE });
  const colliders: SolidCollider[] = [];
  const gates: BuiltRoom['gates'] = new Map();
  const rid = `${def.id}_${roomSerial++}`;

  const floorMat = mats.getMat(def.floor, { roughness: 0.9, bump: 'stone', pattern: 'stone' });
  const floor2Mat = mats.getMat(def.floor2 ?? def.floor, { roughness: 0.86, pattern: 'cloth' });
  const wallMat = mats.getMat(def.wall, { roughness: 0.92, bump: 'stone', pattern: 'stone' });
  const wallTop = mats.getMat(def.wallTop ?? def.wall, { roughness: 0.9 });
  const wood = mats.getMat('#7a4e2a', { roughness: 0.82, bump: 'wood', pattern: 'wood' });
  const woodD = mats.getMat('#5a3820', { roughness: 0.84, bump: 'wood', pattern: 'wood' });
  const iron = mats.getMat('#4a4f58', { roughness: 0.45, metalness: 0.75 });
  const glow = mats.getMat('#ffcf70', { emissive: '#ff9a30', emissiveIntensity: 1.6 });
  const cloth = mats.getMat('#9a3a3a', { roughness: 0.9, pattern: 'cloth' });
  const water = mats.getMat('#2a6a9a', { roughness: 0.1, transparent: true, opacity: 0.8 });

  const isWall = (ch: string) => ch === '#';
  const isOpen = (ch: string) => ch !== ' ' && ch !== '#';

  // Dark base under everything so gaps never show the void.
  addVoxelBox(group, w * TILE + 40, 1, h * TILE + 40, mats.getMat('#0c0a0a', { roughness: 1 }), ox + (w * TILE) / 2, -0.52, oz + (h * TILE) / 2, false, false);

  // Floors per tile run
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      const ch = at(c, r);
      if (!isOpen(ch) || ch === 'W') {
        c++;
        continue;
      }
      const alt = ch === ',';
      let c2 = c;
      while (c2 + 1 < w && isOpen(at(c2 + 1, r)) && at(c2 + 1, r) !== 'W' && (at(c2 + 1, r) === ',') === alt) c2++;
      const n = c2 - c + 1;
      addVoxelBox(group, n * TILE, 0.2, TILE, alt ? floor2Mat : floorMat, ox + (c + n / 2) * TILE, -0.1, oz + (r + 0.5) * TILE, false, true);
      c = c2 + 1;
    }
  }

  // Walls: merge horizontal runs into boxes
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      if (!isWall(at(c, r))) {
        c++;
        continue;
      }
      let c2 = c;
      while (c2 + 1 < w && isWall(at(c2 + 1, r))) c2++;
      const n = c2 - c + 1;
      const cx = ox + (c + n / 2) * TILE;
      const cz = oz + (r + 0.5) * TILE;
      addVoxelBox(group, n * TILE, WALL_H, TILE, wallMat, cx, WALL_H / 2, cz, true, true);
      addVoxelBox(group, n * TILE + 0.04, 0.16, TILE + 0.04, wallTop, cx, WALL_H + 0.08, cz, false, true);
      colliders.push({
        id: `${rid}_w${r}_${c}`,
        kind: 'box',
        x: cx,
        z: cz,
        minY: -1,
        maxY: WALL_H + 6,
        halfX: (n * TILE) / 2,
        halfZ: TILE / 2,
        blocksCamera: true,
        climbable: false,
        active: true,
      });
      c = c2 + 1;
    }
  }

  const solid = (id: string, x: number, z: number, hx: number, hz: number, maxY: number) => {
    const col: SolidCollider = { id: `${rid}_${id}`, kind: 'box', x, z, minY: -1, maxY, halfX: hx, halfZ: hz, blocksCamera: false, climbable: false, active: true };
    colliders.push(col);
    return col;
  };

  // Props
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = at(c, r);
      const { x, z } = tile(c, r);
      const id = `${c}_${r}`;
      // Facing: towards the nearest open neighbour, for wall-mounted props
      switch (ch) {
        case 'T':
          addVoxelBox(group, 1.3, 0.12, 1.0, wood, x, 0.86, z);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) addVoxelBox(group, 0.1, 0.8, 0.1, woodD, x + sx * 0.55, 0.4, z + sz * 0.4);
          addVoxelBox(group, 0.18, 0.18, 0.18, mats.getMat('#c8c0b0'), x + 0.2, 1.0, z - 0.1);
          solid(id, x, z, 0.7, 0.55, 0.95);
          break;
        case 'B':
          addVoxelBox(group, 0.9, 1.1, 0.9, wood, x, 0.55, z);
          addVoxelBox(group, 0.96, 0.08, 0.96, iron, x, 0.3, z);
          addVoxelBox(group, 0.96, 0.08, 0.96, iron, x, 0.85, z);
          solid(id, x, z, 0.48, 0.48, 1.12);
          break;
        case 'X':
          addVoxelBox(group, 1.1, 1.0, 1.1, mats.getMat('#9a6a3a', { bump: 'wood', pattern: 'wood' }), x, 0.5, z);
          solid(id, x, z, 0.56, 0.56, 1.02);
          break;
        case 'K':
          addVoxelBox(group, 1.5, 2.6, 0.7, woodD, x, 1.3, z);
          for (let i = 0; i < 4; i++) addVoxelBox(group, 1.3, 0.38, 0.5, mats.getMat(['#7a2a2a', '#2a4a7a', '#3a6a2a', '#8a6a2a'][i]), x, 0.45 + i * 0.6, z + 0.05);
          solid(id, x, z, 0.76, 0.4, 2.6);
          break;
        case 'b':
          addVoxelBox(group, 1.0, 0.5, 1.5, wood, x, 0.25, z);
          addVoxelBox(group, 0.92, 0.14, 1.4, mats.getMat('#d8d0c0', { pattern: 'cloth' }), x, 0.56, z);
          addVoxelBox(group, 0.92, 0.1, 0.8, cloth, x, 0.62, z + 0.25);
          solid(id, x, z, 0.52, 0.76, 0.62);
          break;
        case 'A':
          addVoxelBox(group, 1.6, 1.0, 0.9, mats.getMat('#d8d2c4', { bump: 'stone' }), x, 0.5, z);
          addVoxelBox(group, 1.7, 0.1, 1.0, mats.getMat('#f0c65a', { metalness: 0.7, roughness: 0.3 }), x, 1.04, z);
          addVoxelBox(group, 0.12, 0.3, 0.12, glow, x - 0.6, 1.25, z, false);
          addVoxelBox(group, 0.12, 0.3, 0.12, glow, x + 0.6, 1.25, z, false);
          solid(id, x, z, 0.82, 0.48, 1.05);
          break;
        case 'F':
          addVoxelBox(group, 1.4, 1.0, 1.4, mats.getMat('#5a5048', { bump: 'stone' }), x, 0.5, z);
          addVoxelBox(group, 1.0, 0.2, 1.0, glow, x, 1.02, z, false);
          solid(id, x, z, 0.72, 0.72, 1.05);
          break;
        case 'N':
          addVoxelBox(group, 0.5, 0.5, 0.4, woodD, x, 0.25, z);
          addVoxelBox(group, 0.9, 0.28, 0.42, iron, x, 0.64, z);
          solid(id, x, z, 0.45, 0.25, 0.78);
          break;
        case 'R':
          addVoxelBox(group, TILE + 0.02, 1.1, 0.9, wood, x, 0.55, z);
          addVoxelBox(group, TILE + 0.06, 0.1, 1.0, woodD, x, 1.14, z);
          solid(id, x, z, TILE / 2, 0.5, 1.2);
          break;
        case 'H':
          addVoxelBox(group, 1.5, 1.6, 0.9, mats.getMat('#6a625a', { bump: 'stone', pattern: 'stone' }), x, 0.8, z);
          addVoxelBox(group, 0.9, 0.5, 0.3, glow, x, 0.4, z + 0.32, false);
          solid(id, x, z, 0.78, 0.48, 1.6);
          break;
        case 'P':
          addVoxelBox(group, 1.5, 0.12, 0.5, wood, x, 0.5, z);
          addVoxelBox(group, 1.5, 0.6, 0.1, wood, x, 0.8, z + 0.24);
          addVoxelBox(group, 0.1, 0.5, 0.5, woodD, x - 0.68, 0.25, z);
          addVoxelBox(group, 0.1, 0.5, 0.5, woodD, x + 0.68, 0.25, z);
          solid(id, x, z, 0.76, 0.3, 0.6);
          break;
        case 'p':
          addVoxelBox(group, 0.9, WALL_H, 0.9, wallMat, x, WALL_H / 2, z);
          solid(id, x, z, 0.46, 0.46, WALL_H + 4);
          break;
        case 'l':
          addVoxelBox(group, 0.12, 2.0, 0.12, iron, x, 1.0, z);
          addVoxelBox(group, 0.34, 0.34, 0.34, glow, x, 2.1, z, false);
          solid(id, x, z, 0.12, 0.12, 2.3);
          break;
        case 'W':
          addVoxelBox(group, TILE, 0.2, TILE, mats.getMat('#22303a'), x, -0.7, z, false, true);
          addVoxelBox(group, TILE, 0.06, TILE, water, x, -0.12, z, false, false);
          break;
        case 'o':
          addVoxelBox(group, 1.0, 0.8, 0.9, mats.getMat('#6a6468', { bump: 'stone' }), x, 0.4, z);
          addVoxelBox(group, 0.3, 0.3, 0.3, mats.getMat('#b87a4a', { metalness: 0.6, roughness: 0.4 }), x + 0.2, 0.75, z + 0.1);
          break;
        default:
          break;
      }
      // Wall torches on wall tiles that face open floor (every few tiles)
      if (ch === '#' && (c * 7 + r * 3) % 5 === 0) {
        const dirs: Array<[number, number]> = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dc, dr] of dirs) {
          const n = at(c + dc, r + dr);
          if (n === '.' || n === ',') {
            const tx = x + dc * (TILE / 2 + 0.06);
            const tz = z + dr * (TILE / 2 + 0.06);
            addVoxelBox(group, 0.12, 0.4, 0.12, woodD, tx, 1.9, tz, false);
            addVoxelBox(group, 0.2, 0.22, 0.2, glow, tx, 2.2, tz, false);
            break;
          }
        }
      }
    }
  }

  // Gates: letters 'G' (+ flag), built as iron bars that open when the flag is set
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (at(c, r) !== 'G') continue;
      const { x, z } = tile(c, r);
      const flag = gateFlags[`${c},${r}`] ?? gateFlags['*'] ?? 'never';
      const vertical = isWall(at(c, r - 1)) || isWall(at(c, r + 1));
      const meshes: THREE.Object3D[] = [];
      for (let i = -2; i <= 2; i++) {
        const bar = addVoxelBox(group, vertical ? 0.12 : 0.12, WALL_H, 0.12, iron, x + (vertical ? 0 : i * 0.3), WALL_H / 2, z + (vertical ? i * 0.3 : 0));
        meshes.push(bar);
      }
      const col = solid(`gate${c}_${r}`, x, z, vertical ? 0.2 : TILE / 2, vertical ? TILE / 2 : 0.2, WALL_H + 4);
      const entry = gates.get(flag) ?? { colliders: [], meshes: [] };
      entry.colliders.push(col);
      entry.meshes.push(...meshes);
      gates.set(flag, entry);
    }
  }

  // Ceiling (no shadow so the sun still lights the room like windows do)
  const ceil = addVoxelBox(group, w * TILE, 0.3, h * TILE, mats.getMat('#1a1410', { roughness: 1 }), ox + (w * TILE) / 2, WALL_H + 0.35, oz + (h * TILE) / 2, false, false);
  ceil.visible = false; // camera sits above walls; keep it open so the view is never blocked

  const find = (chf: string) => {
    const out: Array<{ x: number; z: number; c: number; r: number }> = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (at(c, r) === chf) out.push({ ...tile(c, r), c, r });
    return out;
  };

  return { def, ox, oz, w, h, group, tile, find, colliders, gates };
}
