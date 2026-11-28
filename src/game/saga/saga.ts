// The Gallowmark saga: the story, people, buildings, rooms and quests from the original
// Dawnbell chapters, running on top of the open-world engine.
import * as THREE from 'three';
import type { MaterialLibrary } from '../voxelBuilder';
import type { SolidCollider } from '../collision';
import type { EnemyEntity, EnemyKind, EnemyVariant } from '../enemies';
import type { DialogueLine } from '../story';
import type { PlayerInventory } from '../mechanics';
import { POCKET_X, getTerrainHeight, setPocketHooks } from '../math';
import { buildPerson, type PersonLook } from './people';
import { buildRoom, type BuiltRoom, type RoomDef, TILE } from './rooms';

export type Flags = Record<string, number | boolean | string | undefined>;

export interface SagaChoice {
  label: string;
  disabled?: boolean;
  pick: () => void;
}

export interface SagaHost {
  mats: MaterialLibrary;
  scene: THREE.Scene;
  colliders: SolidCollider[];
  inv: () => PlayerInventory;
  say: (lines: DialogueLine[], after?: () => void) => void;
  choose: (speaker: string, text: string, options: SagaChoice[]) => void;
  toast: (text: string, dur?: number) => void;
  sfx: (kind: 'item' | 'coin' | 'gate' | 'boss' | 'win' | 'door' | 'heal') => void;
  save: () => void;
  teleport: (x: number, y: number, z: number, yaw: number) => void;
  spawnEnemy: (spec: SagaEnemySpec) => EnemyEntity;
  removeEnemies: (tag: string) => void;
  particles: (x: number, y: number, z: number, color: number, count: number, speed?: number) => void;
  shake: (amount: number) => void;
  player: () => { x: number; y: number; z: number };
  heal: () => void;
  /** Run the open-world game's own dialogue for one of its villagers (e.g. the archery side quest). */
  legacyTalk: (role: string) => void;
  /** Record a Bell Shrine questline event (the open-world side story). */
  storyEvent: (ev: 'spoke_odo') => void;
  anyEnemyAlive: (tag: string) => boolean;
}

export interface SagaEnemySpec {
  kind: EnemyKind;
  x: number;
  z: number;
  name?: string;
  hp?: number;
  tag?: string;
  scale?: number;
  variant?: EnemyVariant;
}

export type TalkResult = DialogueLine[] | { lines: DialogueLine[]; after?: () => void };

export interface SagaNpc {
  id: string;
  name: string;
  look: PersonLook;
  x: number;
  z: number;
  yaw: number;
  shown: () => boolean;
  talk: () => TalkResult;
  mesh?: THREE.Group;
  collider?: SolidCollider;
}

export interface SagaSpot {
  id: string;
  x: number;
  z: number;
  y?: number;
  radius: number;
  label: () => string;
  shown: () => boolean;
  act: () => void;
  /** Walk-in trigger instead of a button prompt */
  auto?: boolean;
}

export interface SagaRoomUse {
  def: RoomDef;
  gateFlags?: Record<string, string>;
}

export interface JournalEntry {
  title: string;
  meta: string;
  text: string;
  status: 'done' | 'active' | 'dim' | 'ready';
  badge: string;
  goals?: Array<{ label: string; met: boolean }>;
}

export const L = (speaker: string, text: string): DialogueLine => ({ speaker, text });

export class SagaSystem {
  readonly F: Flags = {};
  readonly host: SagaHost;
  readonly group = new THREE.Group();
  readonly rooms = new Map<string, BuiltRoom>();
  readonly npcs: SagaNpc[] = [];
  readonly spots: SagaSpot[] = [];
  private props: Array<{ obj: THREE.Object3D; shown: () => boolean; colliders?: SolidCollider[] }> = [];
  private roomUses: SagaRoomUse[] = [];
  private doorCooldown = 0;
  private enterHooks = new Map<string, () => void>();
  private killHooks: Array<(e: EnemyEntity) => void> = [];
  private updateHooks: Array<(dt: number) => void> = [];
  objectiveFn: () => string = () => '';
  chapterFn: () => { roman: string; title: string } = () => ({ roman: 'I', title: "The Warden's Trial" });
  journalFn: () => { main: JournalEntry[]; side: JournalEntry[] } = () => ({ main: [], side: [] });
  currentRoom: BuiltRoom | null = null;
  private nextRoomX = POCKET_X + 120;

  constructor(host: SagaHost) {
    this.host = host;
    host.scene.add(this.group);
    setPocketHooks(
      () => 0,
      (x, z) => this.roomAt(x, z)?.def.name ?? 'Indoors'
    );
  }

  /* ---------------- registration ---------------- */
  addRoom(use: SagaRoomUse): BuiltRoom {
    const ox = this.nextRoomX;
    const oz = 0;
    const width = Math.max(...use.def.map.map((l) => l.length)) * TILE;
    this.nextRoomX += width + 60;
    const room = buildRoom(this.host.mats, use.def, ox, oz, use.gateFlags);
    this.group.add(room.group);
    this.host.colliders.push(...room.colliders);
    this.rooms.set(use.def.id, room);
    this.roomUses.push(use);
    return room;
  }

  addNpc(npc: SagaNpc): SagaNpc {
    const mesh = buildPerson(this.host.mats, npc.look);
    mesh.rotation.y = npc.yaw;
    this.group.add(mesh);
    npc.mesh = mesh;
    npc.collider = {
      id: `saga_npc_${npc.id}`,
      kind: 'cylinder',
      x: npc.x,
      z: npc.z,
      minY: -50,
      maxY: 500,
      halfX: 0.42,
      halfZ: 0.42,
      blocksCamera: false,
      climbable: false,
      active: true,
    };
    this.host.colliders.push(npc.collider);
    this.placeNpc(npc);
    this.npcs.push(npc);
    return npc;
  }

  private placeNpc(npc: SagaNpc): void {
    if (!npc.mesh || !npc.collider) return;
    const y = getTerrainHeight(npc.x, npc.z);
    npc.mesh.position.set(npc.x, y, npc.z);
    npc.collider.x = npc.x;
    npc.collider.z = npc.z;
    npc.collider.minY = y - 1;
    npc.collider.maxY = y + 2;
  }

  moveNpc(id: string, x: number, z: number, yaw?: number): void {
    const n = this.npcs.find((m) => m.id === id);
    if (!n) return;
    n.x = x;
    n.z = z;
    if (yaw !== undefined) n.yaw = yaw;
    this.placeNpc(n);
  }

  addSpot(spot: SagaSpot): SagaSpot {
    this.spots.push(spot);
    return spot;
  }

  addProp(obj: THREE.Object3D, shown: () => boolean = () => true, colliders?: SolidCollider[]): void {
    this.group.add(obj);
    if (colliders) this.host.colliders.push(...colliders);
    this.props.push({ obj, shown, colliders });
  }

  onEnterRoom(id: string, fn: () => void): void {
    this.enterHooks.set(id, fn);
  }

  onKill(fn: (e: EnemyEntity) => void): void {
    this.killHooks.push(fn);
  }

  onUpdate(fn: (dt: number) => void): void {
    this.updateHooks.push(fn);
  }

  roomAt(x: number, z: number): BuiltRoom | null {
    for (const r of this.rooms.values()) {
      if (x >= r.ox - 4 && x <= r.ox + r.w * TILE + 4 && z >= r.oz - 4 && z <= r.oz + r.h * TILE + 4) return r;
    }
    return null;
  }

  /* ---------------- travel ---------------- */
  enterRoom(roomId: string, doorChar: string, offset = 1): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const t = room.find(doorChar)[0];
    if (!t) return;
    // Step into the room, away from the door, towards the nearest open tile
    let dx = 0;
    let dz = 0;
    const map = room.def.map;
    const open = (c: number, r: number) => {
      const ch = map[r]?.[c];
      return ch !== undefined && ch !== '#' && ch !== ' ' && !room.def.doors[ch];
    };
    if (open(t.c, t.r - 1)) dz = -1;
    else if (open(t.c, t.r + 1)) dz = 1;
    else if (open(t.c - 1, t.r)) dx = -1;
    else if (open(t.c + 1, t.r)) dx = 1;
    const x = t.x + dx * TILE * offset;
    const z = t.z + dz * TILE * offset;
    const yaw = Math.atan2(dx, dz);
    this.host.teleport(x, 0.05, z, yaw);
    this.doorCooldown = 0.8;
    this.currentRoom = room;
    this.host.sfx('door');
    const hook = this.enterHooks.get(roomId);
    if (hook) hook();
  }

  exitToWorld(x: number, z: number, yaw: number): void {
    this.host.teleport(x, getTerrainHeight(x, z) + 0.1, z, yaw);
    this.doorCooldown = 0.8;
    this.currentRoom = null;
    this.host.sfx('door');
  }

  /* ---------------- per frame ---------------- */
  update(dt: number): void {
    const p = this.host.player();
    this.doorCooldown = Math.max(0, this.doorCooldown - dt);
    this.currentRoom = p.x > POCKET_X ? this.roomAt(p.x, p.z) : null;

    // Visibility of NPCs + props
    for (const n of this.npcs) {
      const show = n.shown();
      if (n.mesh) {
        n.mesh.visible = show;
        if (show) {
          const d = Math.hypot(p.x - n.x, p.z - n.z);
          const target = d < 6 ? Math.atan2(p.x - n.x, p.z - n.z) : n.yaw;
          let diff = target - n.mesh.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          n.mesh.rotation.y += diff * Math.min(1, dt * 5);
        }
      }
      if (n.collider) n.collider.active = show;
    }
    for (const pr of this.props) {
      const show = pr.shown();
      pr.obj.visible = show;
      if (pr.colliders) for (const c of pr.colliders) c.active = show;
    }
    // Room gates
    for (const r of this.rooms.values()) {
      for (const [flag, g] of r.gates) {
        const open = Boolean(this.F[flag]);
        for (const c of g.colliders) c.active = !open;
        for (const m of g.meshes) m.visible = !open;
      }
    }

    // Doors inside rooms (walk-in)
    if (this.doorCooldown <= 0 && this.currentRoom) {
      const room = this.currentRoom;
      for (const [ch, door] of Object.entries(room.def.doors)) {
        for (const t of room.find(ch)) {
          if (Math.hypot(p.x - t.x, p.z - t.z) < TILE * 0.55) {
            if (door.needs && !this.F[door.needs]) {
              if (door.lockedText) this.host.toast(door.lockedText, 2.2);
              this.doorCooldown = 1.5;
              continue;
            }
            if (door.to === 'world') this.exitToWorld(door.x ?? 0, door.z ?? 0, door.yaw ?? 0);
            else this.enterRoom(door.to, door.door ?? 'D');
            return;
          }
        }
      }
    }
    // Walk-in spots (world doors etc.)
    if (this.doorCooldown <= 0) {
      for (const s of this.spots) {
        if (!s.auto || !s.shown()) continue;
        const sy = s.y ?? getTerrainHeight(s.x, s.z);
        if (Math.hypot(p.x - s.x, p.z - s.z) < s.radius && Math.abs(p.y - sy) < 2.5) {
          this.doorCooldown = 1.0;
          s.act();
          return;
        }
      }
    }
    for (const fn of this.updateHooks) fn(dt);
  }

  /** Closest talk / use prompt, for the engine's interaction system. */
  interaction(maxDist: number): { label: string; dist: number; act: () => void } | null {
    const p = this.host.player();
    let best: { label: string; dist: number; act: () => void } | null = null;
    for (const n of this.npcs) {
      if (!n.shown()) continue;
      const d = Math.hypot(p.x - n.x, p.z - n.z);
      if (d < 2.6 && d < (best?.dist ?? maxDist)) {
        best = { label: `Talk to ${n.name}`, dist: d, act: () => this.talkTo(n) };
      }
    }
    for (const s of this.spots) {
      if (s.auto || !s.shown()) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      const sy = s.y ?? getTerrainHeight(s.x, s.z);
      if (d < s.radius && Math.abs(p.y - sy) < 2.6 && d < (best?.dist ?? maxDist)) {
        best = { label: s.label(), dist: d, act: () => s.act() };
      }
    }
    return best;
  }

  talkTo(n: SagaNpc): void {
    const res = n.talk();
    if (Array.isArray(res)) this.host.say(res);
    else this.host.say(res.lines, res.after);
  }

  onEnemyKilled(e: EnemyEntity): void {
    for (const fn of this.killHooks) fn(e);
  }

  /* ---------------- helpers for content ---------------- */
  gotItem(name: string, lines: DialogueLine[] = [], after?: () => void): void {
    this.host.sfx('item');
    this.host.say([L('', `You got: ${name}!`), ...lines], () => {
      this.host.save();
      after?.();
    });
  }

  addHeartPiece(after?: () => void): void {
    const n = ((this.F.hpieces as number) || 0) + 1;
    this.F.hpieces = n;
    const inv = this.host.inv();
    if (n % 4 === 0) {
      inv.maxHp += 2;
      inv.hp = inv.maxHp;
      this.host.sfx('win');
      this.host.say([L('', 'You found a Piece of Heart! That makes four, and they join into a whole new heart.')], () => {
        this.host.save();
        after?.();
      });
    } else {
      this.host.sfx('item');
      this.host.say([L('', `You found a Piece of Heart! (${n % 4} of 4)`)], () => {
        this.host.save();
        after?.();
      });
    }
  }

  anyTagged(tag: string): boolean {
    return this.host.anyEnemyAlive(tag);
  }

  legacy(role: string): TalkResult {
    return { lines: [], after: () => this.host.legacyTalk(role) };
  }

  /** Brother Aldous tells of the three Bell Shrines once, which starts that side story. */
  withShrineLore(lines: DialogueLine[], lore: DialogueLine[]): TalkResult {
    if (this.F.shrine_lore) return lines;
    return {
      lines: lines.concat(lore),
      after: () => {
        this.F.shrine_lore = true;
        this.host.storyEvent('spoke_odo');
        this.host.toast('Side story: wake the three Bell Shrines (see your Quest Journal)', 3.4);
        this.host.save();
      },
    };
  }

  openShop(): void {
    const inv = this.host.inv();
    const F = this.F;
    this.host.choose('Tilda', `You have ${inv.marks} marks. What'll it be?`, [
      {
        label: `Meat pie, heals like a skewer: 15 marks${inv.marks < 15 ? ' (not enough)' : ''}`,
        disabled: inv.marks < 15,
        pick: () => {
          inv.marks -= 15;
          inv.meals += 1;
          this.host.sfx('coin');
          this.host.save();
          this.openShop();
        },
      },
      {
        label: F.heart_bought ? 'Heart container: sold' : `Heart container: 40 marks${inv.marks < 40 ? ' (not enough)' : ''}`,
        disabled: Boolean(F.heart_bought) || inv.marks < 40,
        pick: () => {
          inv.marks -= 40;
          F.heart_bought = true;
          inv.maxHp += 2;
          inv.hp = inv.maxHp;
          this.host.sfx('item');
          this.host.save();
          this.openShop();
        },
      },
      { label: 'Leave', pick: () => this.host.save() },
    ]);
  }

  talkVennHall: () => TalkResult = () => [];
  talkFenHome: () => TalkResult = () => [];
  talkNell: () => TalkResult = () => [];

  serialize(): Flags {
    return this.F;
  }

  /** Replace all flags in place (content code keeps a reference to this object). */
  load(f: Flags | undefined): void {
    for (const k of Object.keys(this.F)) delete this.F[k];
    if (f) Object.assign(this.F, f);
    this.currentRoom = null;
  }
}
