export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private musicTimer = 2.5;
  private noteIndex = 0;

  // Gentle BotW-inspired D-major / pentatonic exploration motifs (Hz)
  private readonly motif = [
    587.33, 659.25, 739.99, 880.0, 1174.66, 987.77, 880.0, 739.99,
    587.33, 440.0, 493.88, 587.33, 739.99, 659.25,
  ];

  unlock(): void {
    if (this.muted) return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private getNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuf) return this.noiseBuf;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return buf;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08,
    endFreq?: number,
    delay = 0
  ): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, filterFreq: number, filterType: BiquadFilterType, gainPeak: number): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const buf = this.getNoise();
    if (!buf) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t0);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainPeak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  tickAmbience(dt: number, inCombat: boolean): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      const f = this.motif[this.noteIndex % this.motif.length];
      this.noteIndex++;
      if (inCombat) {
        // Subtle tense plucked cello pulse
        this.tone(f * 0.25, 0.35, 'sawtooth', 0.025, f * 0.245);
        this.musicTimer = 0.65;
      } else {
        // Sparse BotW piano / chime shimmer
        this.tone(f, 1.4, 'sine', 0.032, f * 0.998);
        this.tone(f * 2, 0.7, 'triangle', 0.012, f * 2);
        this.musicTimer = 1.6 + Math.random() * 2.2;
      }
    }
  }

  playStep(onStone: boolean): void {
    const pitch = 1 + (Math.random() - 0.5) * 0.16;
    this.noise(0.055, (onStone ? 1800 : 750) * pitch, 'bandpass', onStone ? 0.045 : 0.03);
  }

  playJump(): void {
    this.tone(240, 0.14, 'triangle', 0.06, 460);
    this.noise(0.07, 1200, 'highpass', 0.025);
  }

  playLand(heavy: boolean): void {
    this.tone(heavy ? 110 : 150, heavy ? 0.16 : 0.09, 'sine', heavy ? 0.09 : 0.05, 55);
    this.noise(heavy ? 0.14 : 0.07, 450, 'lowpass', heavy ? 0.07 : 0.035);
  }

  playGlideOpen(): void {
    this.noise(0.24, 900, 'bandpass', 0.08);
    this.tone(330, 0.18, 'sine', 0.04, 520);
  }

  playClimbGrab(): void {
    const pitch = 1 + (Math.random() - 0.5) * 0.14;
    this.noise(0.06, 1500 * pitch, 'bandpass', 0.04);
  }

  playSwordSwing(comboStep: number, spin = false): void {
    const base = spin ? 520 : 280 + comboStep * 70;
    this.noise(spin ? 0.28 : 0.12, base * 3, 'bandpass', spin ? 0.09 : 0.06);
    this.tone(base, spin ? 0.25 : 0.1, 'triangle', 0.055, base * 0.55);
  }

  playHit(heavy = false): void {
    this.tone(heavy ? 180 : 260, heavy ? 0.16 : 0.09, 'sawtooth', heavy ? 0.09 : 0.06, 70);
    this.noise(heavy ? 0.12 : 0.06, 1600, 'bandpass', heavy ? 0.08 : 0.05);
  }

  playParry(): void {
    // Crisp metallic ring + low impact
    this.tone(1180, 0.35, 'triangle', 0.1, 1240);
    this.tone(1760, 0.28, 'sine', 0.08, 1760, 0.02);
    this.tone(160, 0.2, 'sine', 0.11, 70);
  }

  playFlurryTrigger(): void {
    this.tone(420, 0.35, 'sine', 0.08, 120);
    this.tone(880, 0.4, 'triangle', 0.06, 1320, 0.04);
  }

  playBowShoot(): void {
    this.tone(340, 0.11, 'triangle', 0.06, 190);
    this.noise(0.08, 2800, 'highpass', 0.045);
  }

  playBombThrow(): void {
    this.tone(380, 0.12, 'sine', 0.05, 520);
  }

  playExplosion(): void {
    this.tone(120, 0.45, 'sawtooth', 0.14, 32);
    this.noise(0.42, 420, 'lowpass', 0.16);
  }

  playStasisLock(): void {
    this.tone(520, 0.14, 'square', 0.045, 780);
    this.tone(1040, 0.22, 'sine', 0.05, 1040, 0.06);
  }

  playStasisHit(hits: number): void {
    const f = 440 + hits * 110;
    this.tone(f, 0.12, 'triangle', 0.07, f * 1.15);
  }

  playStasisLaunch(): void {
    this.tone(240, 0.32, 'sawtooth', 0.09, 920);
    this.noise(0.2, 1800, 'bandpass', 0.08);
  }

  playGale(): void {
    this.noise(0.55, 1400, 'bandpass', 0.11);
    this.tone(280, 0.45, 'sine', 0.06, 860);
    this.tone(440, 0.4, 'triangle', 0.045, 1180, 0.05);
  }

  playPickup(): void {
    this.tone(660, 0.09, 'sine', 0.06, 880);
    this.tone(990, 0.14, 'sine', 0.055, 1180, 0.06);
  }

  playCook(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, 0.2, 'triangle', 0.065, n, i * 0.09));
  }

  playChestOpen(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => this.tone(n, 0.28, 'triangle', 0.075, n * 1.005, i * 0.11));
  }

  playShrineActivate(): void {
    const notes = [587.33, 739.99, 880, 1174.66, 1479.98];
    notes.forEach((n, i) => {
      this.tone(n, 0.65, 'sine', 0.075, n, i * 0.13);
      this.tone(n * 0.5, 0.7, 'triangle', 0.04, n * 0.5, i * 0.13);
    });
  }

  playHurt(): void {
    this.tone(210, 0.22, 'sawtooth', 0.1, 85);
    this.noise(0.14, 700, 'lowpass', 0.07);
  }

  playTelegraph(): void {
    this.tone(740, 0.16, 'sine', 0.045, 1120);
  }
}
