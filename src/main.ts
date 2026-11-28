import './styles.css';
import { DawnbellEngine } from './game/engine';
import { createDefaultKeybinds, loadKeybinds } from './game/keybinds';
import type { ChapterId } from './game/story';
import { GameHud } from './ui/hud';

// Clear any legacy offline service worker from the previous static version so fresh 3D bundles always load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}));
  }).catch(() => {});
}

const canvasMount = document.getElementById('canvas-mount')!;
const uiMount = document.getElementById('ui-mount')!;

let engine: DawnbellEngine | null = null;

const hud = new GameHud(uiMount, {
  onNewGame: (ch?: ChapterId) => engine?.startNewGame(ch ?? 1, false),
  onContinue: () => engine?.continueGame(),
  onResume: () => engine?.resumeGame(),
  onPause: () => engine?.pauseGame(),
  onReturnTitle: () => engine?.returnToTitle(),
  onToggleMute: () => {
    engine?.toggleMute();
  },
  onToggleMap: () => engine?.toggleMap(),
  onToggleJournal: () => engine?.toggleJournal(),
  onSelectMapTab: (tab) => engine?.openMapTab(tab),
  onToggleLamp: () => engine?.toggleDawnLamp(),
  onCycleTime: () => engine?.cycleTimeOfDay(),
  onFastTravel: (id) => engine?.fastTravelTo(id),
  onSelectRune: (id) => engine?.selectRune(id),
  onDismissDialogue: () => engine?.dismissDialogue(),
  hasSave: () => Boolean(engine?.hasSave()),
  getKeybinds: () => engine?.getKeybinds() ?? loadKeybinds(),
  onRebindKey: (action, code) => engine?.rebindKey(action, code) ?? createDefaultKeybinds(),
  onRebindPad: (action, btnIndex) => engine?.rebindPad(action, btnIndex) ?? createDefaultKeybinds(),
  onResetKeybinds: () => engine?.resetKeybinds() ?? createDefaultKeybinds(),
  onTouchMove: (x, z, sprint) => engine?.setTouchMove(x, z, sprint),
  onTouchLook: (dx, dy) => engine?.addTouchLook(dx, dy),
  onTouchAction: (action, down) => engine?.setTouchAction(action, down),
  onTouchTap: (action) => engine?.triggerTouchTap(action),
});

engine = new DawnbellEngine(canvasMount, (snap) => {
  hud.render(snap);
});
engine.setPadMenuHandler((ev) => hud.handleGamepadMenu(ev));

// Support ?autostart=1 (& optional ?chapter=2|3) for instant unobstructed gameplay boot
const params = new URLSearchParams(window.location.search);
if (params.get('autostart') === '1') {
  const chParam = Number(params.get('chapter'));
  const startCh: ChapterId = chParam === 2 ? 2 : chParam === 3 ? 3 : 1;
  engine.startNewGame(startCh, true);
}

window.addEventListener('beforeunload', () => {
  engine?.dispose();
});
