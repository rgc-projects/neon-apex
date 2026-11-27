import { clamp } from '../utils/math';

/**
 * Pure Web Audio API Procedural Sound & Synthwave Music Engine.
 * Zero external audio URLs -> 100% self-contained & glitch-free.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;

  // Continuous engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Continuous tire screech nodes
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  // Continuous nitro jet nodes
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  public muted = false;
  private masterVol = 0.75;
  private sfxVol = 0.85;
  private musicVol = 0.48;
  private initialized = false;
  private engineActive = false;
  private racingIntensity = 0;

  public setVolumes(master: number, sfx: number, music: number): void {
    this.masterVol = clamp(master, 0, 1);
    this.sfxVol = clamp(sfx, 0, 1);
    this.musicVol = clamp(music, 0, 1);
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol * 0.96, now, 0.04);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.04);
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicVol * 0.72, now, 0.04);
    }
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    // Master chain with subtle safety compressor
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVol * 0.96;
    this.masterGain.connect(comp);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.masterGain);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2600;
    this.musicFilter.Q.value = 1.2;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVol * 0.72;
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.masterGain);

    // Reusable 2-second white noise buffer
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 2, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;

    this.setupContinuousEngine(ctx);
    this.setupContinuousTireScreech(ctx, buf);
    this.setupContinuousNitro(ctx, buf);
    this.startSynthwaveBGM();

    this.initialized = true;
  }

  private setupContinuousEngine(ctx: AudioContext): void {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = Math.tanh(x * 2.4);
    }
    shaper.curve = curve;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 2.6;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 62;

    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 124;

    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'sine';
    this.engineSub.frequency.value = 31;

    const g1 = ctx.createGain();
    g1.gain.value = 0.45;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    const g3 = ctx.createGain();
    g3.gain.value = 0.4;

    this.engineOsc1.connect(g1).connect(shaper);
    this.engineOsc2.connect(g2).connect(shaper);
    this.engineSub.connect(g3).connect(shaper);

    shaper.connect(this.engineFilter).connect(this.engineGain).connect(this.sfxGain!);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineSub.start();
  }

  private setupContinuousTireScreech(ctx: AudioContext, buf: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    this.screechFilter = ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 1450;
    this.screechFilter.Q.value = 7.5;

    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;

    src.connect(this.screechFilter).connect(this.screechGain).connect(this.sfxGain!);
    src.start();
  }

  private setupContinuousNitro(ctx: AudioContext, buf: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    this.nitroFilter = ctx.createBiquadFilter();
    this.nitroFilter.type = 'bandpass';
    this.nitroFilter.frequency.value = 900;
    this.nitroFilter.Q.value = 1.6;

    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;

    src.connect(this.nitroFilter).connect(this.nitroGain).connect(this.sfxGain!);
    src.start();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVol * 0.96, this.ctx.currentTime, 0.04);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Cleanly suspend AudioContext when tab/app moves to background to stop BGM & engine noise */
  public suspend(): void {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.engineGain?.gain.setTargetAtTime(0, now, 0.03);
    this.screechGain?.gain.setTargetAtTime(0, now, 0.03);
    this.nitroGain?.gain.setTargetAtTime(0, now, 0.03);
    if (this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => {});
    }
  }

  /** Resume AudioContext when returning to foreground */
  public resumeIfAllowed(): void {
    if (!this.initialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setEngineActive(active: boolean, racingMode: boolean): void {
    this.engineActive = active;
    this.racingIntensity = racingMode ? 1 : 0;
    if (this.musicFilter && this.ctx) {
      this.musicFilter.frequency.setTargetAtTime(racingMode ? 5200 : 1900, this.ctx.currentTime, 0.3);
    }
    if (!active && this.ctx) {
      const now = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain?.gain.setTargetAtTime(0, now, 0.05);
      this.nitroGain?.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  public updateTelemetry(params: {
    speedKmh: number;
    rpmNorm: number;
    gear: number;
    isDrifting: boolean;
    driftTier: number;
    isNitro: boolean;
    isSuperNitro: boolean;
    isAirborne: boolean;
  }): void {
    if (!this.initialized || !this.ctx || !this.engineActive) return;
    const now = this.ctx.currentTime;

    const rpm = clamp(params.rpmNorm, 0.1, 1.15);
    const speedFactor = clamp(params.speedKmh / 380, 0, 1.2);
    const baseFreq = 46 + rpm * 128 + params.gear * 13 + (params.isNitro ? 26 : 0);

    this.engineOsc1!.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2!.frequency.setTargetAtTime(baseFreq * 1.995, now, 0.04);
    this.engineSub!.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);
    this.engineFilter!.frequency.setTargetAtTime(360 + rpm * 1850 + (params.isNitro ? 800 : 0), now, 0.05);
    this.engineGain!.gain.setTargetAtTime(0.14 + speedFactor * 0.12 + (params.isNitro ? 0.06 : 0), now, 0.05);

    // Drift tire screech
    const screechTarget = params.isDrifting && !params.isAirborne ? 0.095 + params.driftTier * 0.025 : 0;
    this.screechGain!.gain.setTargetAtTime(screechTarget, now, 0.045);
    this.screechFilter!.frequency.setTargetAtTime(1250 + params.driftTier * 210 + speedFactor * 260, now, 0.06);

    // Nitro turbine whoosh
    const nitroTarget = params.isNitro ? (params.isSuperNitro ? 0.24 : 0.16) : 0;
    this.nitroGain!.gain.setTargetAtTime(nitroTarget, now, 0.05);
    this.nitroFilter!.frequency.setTargetAtTime(params.isSuperNitro ? 1650 : 1050, now, 0.06);
  }

  public playGearShift(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    // Brief crisp exhaust pop & torque cut
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(0.06, now);
      this.engineGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
    }
    this.playTone(130, 58, 0.09, 'triangle', 0.12);
  }

  public playCountdownBeep(isGo: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    if (isGo) {
      this.playTone(523.25, 1046.5, 0.38, 'sawtooth', 0.2);
      this.playTone(659.25, 1318.5, 0.38, 'triangle', 0.18);
    } else {
      this.playTone(440, 440, 0.16, 'square', 0.14);
    }
  }

  public playPerfectStart(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(330, 880, 0.28, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(660, 1320, 0.32, 'triangle', 0.18), 90);
  }

  public playNitroStart(isSuper: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(isSuper ? 220 : 180, isSuper ? 980 : 620, 0.42, 'sawtooth', 0.22);
    if (isSuper) {
      this.playTone(330, 1480, 0.48, 'triangle', 0.18);
    }
  }

  public playDriftBoost(tier: 1 | 2 | 3): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const base = 260 + tier * 110;
    this.playTone(base, base * 2.1, 0.26, 'sawtooth', 0.18);
    this.playTone(base * 1.5, base * 3.0, 0.24, 'triangle', 0.14);
  }

  public playBoostPad(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(380, 1180, 0.25, 'sine', 0.22);
    this.playTone(570, 1560, 0.22, 'triangle', 0.14);
  }

  public playJumpLaunch(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(180, 540, 0.3, 'sine', 0.18);
  }

  public playLanding(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(140, 42, 0.18, 'triangle', 0.25);
  }

  public playCollision(intensity: number): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const vol = clamp(intensity * 0.28, 0.06, 0.32);
    this.playTone(185, 48, 0.18, 'sawtooth', vol);
    this.playNoiseBurst(0.14, 1400, vol * 0.9);
  }

  public playConeSmash(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(620, 240, 0.08, 'triangle', 0.14);
    this.playNoiseBurst(0.06, 2600, 0.08);
  }

  public playLapChime(isFinalLap: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const notes = isFinalLap ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.01, 0.2, 'triangle', 0.18), idx * 85);
    });
  }

  public playFinishFanfare(won: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const notes = won
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [440, 523.25, 659.25, 783.99];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n, 0.42, 'sawtooth', 0.15), idx * 110);
    });
  }

  private playTone(
    fStart: number,
    fEnd: number,
    dur: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + dur);

    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g).connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private playNoiseBurst(dur: number, freq: number, volume: number): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = 1.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /** Driving 126 BPM OutRun / Synthwave procedural sequencer */
  private startSynthwaveBGM(): void {
    if (this.bgmTimer !== null) return;
    const stepMs = (60 / 126 / 4) * 1000; // 16th note at 126 BPM (~119ms)

    // Classic OutRun Am - F - C - G chord roots (Hz)
    const bassRoots = [55.0, 43.65, 65.41, 49.0];
    const leadScale = [
      440, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25,
      349.23, 440, 523.25, 659.25, 523.25, 440, 523.25, 587.33,
      523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33, 523.25,
      392.0, 493.88, 587.33, 783.99, 659.25, 587.33, 493.88, 440,
    ];

    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicFilter || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % 64;
      const bar = Math.floor(step / 16);
      const beatInBar = step % 16;

      // 1. Driving 16th-note analog Synthwave bassline
      const root = bassRoots[bar];
      const oct = beatInBar % 4 === 2 ? 2 : 1;
      const bassOsc = this.ctx.createOscillator();
      const bassG = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(root * oct, now);
      bassG.gain.setValueAtTime(0.24, now);
      bassG.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      bassOsc.connect(bassG).connect(this.musicFilter);
      bassOsc.start(now);
      bassOsc.stop(now + 0.12);

      // 2. Four-on-the-floor 80s Kick drum (steps 0, 4, 8, 12)
      if (beatInBar % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kG = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(145, now);
        kick.frequency.exponentialRampToValueAtTime(36, now + 0.13);
        kG.gain.setValueAtTime(0.45, now);
        kG.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kick.connect(kG).connect(this.musicGain!);
        kick.start(now);
        kick.stop(now + 0.17);
      }

      // 3. Punchy Synthwave gated snare (steps 4 & 12)
      if (beatInBar === 4 || beatInBar === 12) {
        if (this.noiseBuffer) {
          const sn = this.ctx.createBufferSource();
          sn.buffer = this.noiseBuffer;
          const snF = this.ctx.createBiquadFilter();
          snF.type = 'highpass';
          snF.frequency.value = 1100;
          const snG = this.ctx.createGain();
          snG.gain.setValueAtTime(0.22, now);
          snG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          sn.connect(snF).connect(snG).connect(this.musicFilter);
          sn.start(now);
          sn.stop(now + 0.15);
        }
      }

      // 4. Crisp off-beat Hi-Hat
      if (beatInBar % 2 === 1 && this.noiseBuffer) {
        const hh = this.ctx.createBufferSource();
        hh.buffer = this.noiseBuffer;
        const hhF = this.ctx.createBiquadFilter();
        hhF.type = 'highpass';
        hhF.frequency.value = 6500;
        const hhG = this.ctx.createGain();
        hhG.gain.setValueAtTime(0.06, now);
        hhG.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        hh.connect(hhF).connect(hhG).connect(this.musicFilter);
        hh.start(now);
        hh.stop(now + 0.05);
      }

      // 5. Shimmering retro lead arpeggio (stronger during racing)
      if (step % 2 === 0 && (this.racingIntensity > 0.5 || step % 4 === 0)) {
        const note = leadScale[Math.floor(step / 2) % leadScale.length];
        const lead = this.ctx.createOscillator();
        const lG = this.ctx.createGain();
        lead.type = 'square';
        lead.frequency.setValueAtTime(note, now);
        const vol = this.racingIntensity > 0.5 ? 0.075 : 0.04;
        lG.gain.setValueAtTime(vol, now);
        lG.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        lead.connect(lG).connect(this.musicFilter);
        lead.start(now);
        lead.stop(now + 0.21);
      }

      // 6. Warm retro pad chord hit on bar start
      if (beatInBar === 0) {
        const chordMults = [4, 5, 6]; // triad over root*4
        for (const m of chordMults) {
          const pad = this.ctx.createOscillator();
          const pG = this.ctx.createGain();
          pad.type = 'triangle';
          pad.frequency.setValueAtTime(root * m, now);
          pG.gain.setValueAtTime(0.05, now);
          pG.gain.exponentialRampToValueAtTime(0.001, now + 1.65);
          pad.connect(pG).connect(this.musicFilter);
          pad.start(now);
          pad.stop(now + 1.7);
        }
      }

      this.bgmStep++;
    }, stepMs);
  }

  public dispose(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
