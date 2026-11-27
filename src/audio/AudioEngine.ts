import { CAR_SIGNATURES, CarAudioSignature } from '../config/carSignatures';
import { clamp } from '../utils/math';

function createWarmthCurve(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(256 * 4));
  const norm = Math.tanh(drive) || 1;
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

function createEnginePeriodicWave(ctx: AudioContext, weights: number[]): PeriodicWave {
  const real = new Float32Array(weights.length + 1);
  const imag = new Float32Array(weights.length + 1);
  for (let i = 0; i < weights.length; i++) {
    // Phase-varied warm harmonic spectrum avoids harsh sawtooth edge clicks
    const phase = i * 0.42;
    real[i + 1] = weights[i] * Math.sin(phase) * 0.35;
    imag[i + 1] = weights[i] * Math.cos(phase);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * seconds, sr);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.025 * white) / 1.025;
    data[i] = clamp(last * 3.4, -1, 1);
  }
  return buf;
}

/**
 * Pure Web Audio API Acoustic Engine & Synthwave Music Synthesizer.
 * Uses custom cylinder PeriodicWaves, fixed exhaust-chamber formant resonators,
 * organic Brown Noise airflow roar, and gentle analog warmth (zero harsh sawtooth buzz).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;

  // Active vehicle acoustic signature
  private carProfile: CarAudioSignature = CAR_SIGNATURES['apex-v12'].audio;
  private activeWave: PeriodicWave | null = null;

  // Continuous acoustic engine chain
  private engineMainOsc: OscillatorNode | null = null;
  private engineSecondOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineSecondGain: GainNode | null = null;
  private engineSubGain: GainNode | null = null;
  private engineRoarFilter: BiquadFilterNode | null = null;
  private engineRoarGain: GainNode | null = null;
  private engineAirFilter: BiquadFilterNode | null = null;
  private engineAirGain: GainNode | null = null;
  private engineShaper: WaveShaperNode | null = null;
  private bodyFormant: BiquadFilterNode | null = null;
  private throatFormant: BiquadFilterNode | null = null;
  private engineMasterLpf: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Continuous tire screech nodes
  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  // Continuous nitro thrust nodes
  private nitroFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroHumOsc: OscillatorNode | null = null;
  private nitroHumGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;
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

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

    // Reusable 2-second White Noise + Organic Brown Noise buffers
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 2, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    this.brownBuffer = createBrownNoiseBuffer(ctx, 2);

    this.setupContinuousEngine(ctx);
    this.setupContinuousTireScreech(ctx, buf);
    this.setupContinuousNitro(ctx, this.brownBuffer);
    this.startSynthwaveBGM();

    this.initialized = true;
  }

  public setCarAudioProfile(profile: CarAudioSignature): void {
    this.carProfile = profile;
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    this.activeWave = createEnginePeriodicWave(this.ctx, profile.harmonicWeights);
    this.engineMainOsc?.setPeriodicWave(this.activeWave);
    if (this.engineSecondOsc) {
      this.engineSecondOsc.type = profile.isElectric ? 'sine' : 'triangle';
    }
    if (this.engineSecondGain) {
      this.engineSecondGain.gain.setTargetAtTime(profile.secondGain, now, 0.04);
    }
    if (this.engineSubGain) {
      this.engineSubGain.gain.setTargetAtTime(profile.subGain, now, 0.04);
    }
    if (this.engineShaper) {
      this.engineShaper.curve = createWarmthCurve(profile.warmthDrive);
    }
    if (this.bodyFormant) {
      this.bodyFormant.frequency.setTargetAtTime(profile.bodyFormantHz, now, 0.05);
    }
    if (this.throatFormant) {
      this.throatFormant.frequency.setTargetAtTime(profile.throatFormantHz, now, 0.05);
    }
    if (this.engineAirGain) {
      this.engineAirGain.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  private setupContinuousEngine(ctx: AudioContext): void {
    const p = this.carProfile;
    this.activeWave = createEnginePeriodicWave(ctx, p.harmonicWeights);

    // 1. Warm analog saturation stage (gentle tanh, never harsh square clipping)
    this.engineShaper = ctx.createWaveShaper();
    this.engineShaper.curve = createWarmthCurve(p.warmthDrive);

    // 2. Fixed physical exhaust-chamber formant resonators (gives real body weight!)
    this.bodyFormant = ctx.createBiquadFilter();
    this.bodyFormant.type = 'peaking';
    this.bodyFormant.frequency.value = p.bodyFormantHz;
    this.bodyFormant.Q.value = 1.1;
    this.bodyFormant.gain.value = 4.8;

    this.throatFormant = ctx.createBiquadFilter();
    this.throatFormant.type = 'peaking';
    this.throatFormant.frequency.value = p.throatFormantHz;
    this.throatFormant.Q.value = 1.3;
    this.throatFormant.gain.value = 3.2;

    // 3. Gentle master lowpass (Q = 0.85 prevents piercing synthesizer whistle!)
    this.engineMasterLpf = ctx.createBiquadFilter();
    this.engineMasterLpf.type = 'lowpass';
    this.engineMasterLpf.frequency.value = p.lpfBase;
    this.engineMasterLpf.Q.value = 0.85;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;

    // 4. Harmonic voices: Custom PeriodicWave main + smooth secondary voice + warm sine sub-bass
    this.engineMainOsc = ctx.createOscillator();
    this.engineMainOsc.setPeriodicWave(this.activeWave);
    this.engineMainOsc.frequency.value = p.pitchBase;

    this.engineSecondOsc = ctx.createOscillator();
    this.engineSecondOsc.type = p.isElectric ? 'sine' : 'triangle';
    this.engineSecondOsc.frequency.value = p.pitchBase * p.secondRatio;

    this.engineSubOsc = ctx.createOscillator();
    this.engineSubOsc.type = 'sine';
    this.engineSubOsc.frequency.value = p.pitchBase * 0.5;

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.56;
    this.engineSecondGain = ctx.createGain();
    this.engineSecondGain.gain.value = p.secondGain;
    this.engineSubGain = ctx.createGain();
    this.engineSubGain.gain.value = p.subGain;

    this.engineMainOsc.connect(mainGain).connect(this.engineShaper);
    this.engineSecondOsc.connect(this.engineSecondGain).connect(this.engineShaper);
    this.engineSubOsc.connect(this.engineSubGain).connect(this.bodyFormant);

    // 5. Organic Brown Noise exhaust/intake airflow roar (gives realistic throaty weight!)
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = this.brownBuffer!;
    roarSrc.loop = true;

    this.engineRoarFilter = ctx.createBiquadFilter();
    this.engineRoarFilter.type = 'bandpass';
    this.engineRoarFilter.frequency.value = p.roarFreqBase;
    this.engineRoarFilter.Q.value = 0.85;

    this.engineRoarGain = ctx.createGain();
    this.engineRoarGain.gain.value = p.roarGain * 0.4;

    roarSrc.connect(this.engineRoarFilter).connect(this.engineRoarGain).connect(this.bodyFormant);

    // 6. Soft airy bandpass turbo spool / EV inverter shimmer (NEVER a harsh sine beep!)
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = this.noiseBuffer!;
    airSrc.loop = true;

    this.engineAirFilter = ctx.createBiquadFilter();
    this.engineAirFilter.type = 'bandpass';
    this.engineAirFilter.frequency.value = p.airWhineBaseHz;
    this.engineAirFilter.Q.value = 7.5;

    this.engineAirGain = ctx.createGain();
    this.engineAirGain.gain.value = 0;

    airSrc.connect(this.engineAirFilter).connect(this.engineAirGain).connect(this.engineGain);

    // Connect acoustic chain
    this.engineShaper
      .connect(this.bodyFormant)
      .connect(this.throatFormant)
      .connect(this.engineMasterLpf)
      .connect(this.engineGain)
      .connect(this.sfxGain!);

    this.engineMainOsc.start();
    this.engineSecondOsc.start();
    this.engineSubOsc.start();
    roarSrc.start();
    airSrc.start();
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

  private setupContinuousNitro(ctx: AudioContext, brownBuf: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = brownBuf;
    src.loop = true;

    this.nitroFilter = ctx.createBiquadFilter();
    this.nitroFilter.type = 'bandpass';
    this.nitroFilter.frequency.value = 620;
    this.nitroFilter.Q.value = 0.9;

    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;

    src.connect(this.nitroFilter).connect(this.nitroGain).connect(this.sfxGain!);
    src.start();

    // Warm harmonic layer for EV plasma thrust
    this.nitroHumOsc = ctx.createOscillator();
    this.nitroHumOsc.type = 'sine';
    this.nitroHumOsc.frequency.value = 320;
    this.nitroHumGain = ctx.createGain();
    this.nitroHumGain.gain.value = 0;
    this.nitroHumOsc.connect(this.nitroHumGain).connect(this.sfxGain!);
    this.nitroHumOsc.start();
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
    this.nitroHumGain?.gain.setTargetAtTime(0, now, 0.03);
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
      this.nitroHumGain?.gain.setTargetAtTime(0, now, 0.05);
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
    const p = this.carProfile;

    const rpm = clamp(params.rpmNorm, 0.1, 1.15);
    const speedFactor = clamp(params.speedKmh / 380, 0, 1.25);

    const baseFreq = p.isElectric
      ? p.pitchBase + speedFactor * p.pitchSpan + rpm * 16 + (params.isNitro ? 36 : 0)
      : p.pitchBase + rpm * p.pitchSpan + params.gear * p.gearPitchStep + (params.isNitro ? 18 : 0);

    const detune = p.isElectric ? 1.0 : 0.997;
    this.engineMainOsc!.frequency.setTargetAtTime(baseFreq, now, 0.045);
    this.engineSecondOsc!.frequency.setTargetAtTime(baseFreq * p.secondRatio * detune, now, 0.045);
    this.engineSubOsc!.frequency.setTargetAtTime(Math.max(24, baseFreq * 0.5), now, 0.045);

    // Organic exhaust roar tracks RPM & throttle load
    const roarLevel = p.roarGain * (0.28 + rpm * 0.58 + speedFactor * 0.25 + (params.isNitro ? 0.22 : 0));
    this.engineRoarGain!.gain.setTargetAtTime(roarLevel, now, 0.06);
    this.engineRoarFilter!.frequency.setTargetAtTime(
      p.roarFreqBase + (p.isElectric ? speedFactor : rpm) * p.roarFreqSpan,
      now,
      0.06
    );

    // Subtle airy turbo spool / EV electric shimmer (strictly gentle & non-fatiguing)
    if (p.airWhineGain > 0) {
      const airDrive = p.isElectric ? speedFactor : clamp(rpm * 0.65 + speedFactor * 0.55, 0, 1.2);
      const airTarget = p.airWhineGain * (0.15 + airDrive * 0.85 + (params.isNitro ? 0.35 : 0));
      this.engineAirGain!.gain.setTargetAtTime(airTarget, now, 0.09);
      this.engineAirFilter!.frequency.setTargetAtTime(
        p.airWhineBaseHz + airDrive * p.airWhineSpanHz,
        now,
        0.1
      );
    } else {
      this.engineAirGain!.gain.setTargetAtTime(0, now, 0.06);
    }

    // Gentle master lowpass opens smoothly with RPM without whistling
    const lpfTarget =
      p.lpfBase + (p.isElectric ? speedFactor : rpm) * p.lpfSpan + (params.isNitro ? 420 : 0);
    this.engineMasterLpf!.frequency.setTargetAtTime(Math.min(3400, lpfTarget), now, 0.06);

    const gainTarget =
      (0.16 + speedFactor * 0.12 + (params.isNitro ? 0.05 : 0)) * p.volumeScale;
    this.engineGain!.gain.setTargetAtTime(gainTarget, now, 0.055);

    // Drift tire screech
    const screechTarget = params.isDrifting && !params.isAirborne ? 0.09 + params.driftTier * 0.022 : 0;
    this.screechGain!.gain.setTargetAtTime(screechTarget, now, 0.045);
    this.screechFilter!.frequency.setTargetAtTime(1250 + params.driftTier * 210 + speedFactor * 260, now, 0.06);

    // Warm Nitro Roar / Turbo Jet / EV Plasma Hum
    if (params.isNitro) {
      if (p.nitroSound === 'plasma') {
        this.nitroGain!.gain.setTargetAtTime(params.isSuperNitro ? 0.16 : 0.11, now, 0.05);
        this.nitroFilter!.frequency.setTargetAtTime(params.isSuperNitro ? 1400 : 980, now, 0.06);
        this.nitroHumOsc!.type = 'sine';
        this.nitroHumOsc!.frequency.setTargetAtTime(
          (params.isSuperNitro ? 380 : 280) + speedFactor * 120,
          now,
          0.06
        );
        this.nitroHumGain!.gain.setTargetAtTime(params.isSuperNitro ? 0.09 : 0.06, now, 0.06);
      } else {
        this.nitroGain!.gain.setTargetAtTime(params.isSuperNitro ? 0.3 : 0.22, now, 0.05);
        this.nitroFilter!.frequency.setTargetAtTime(
          p.nitroSound === 'turbo'
            ? params.isSuperNitro ? 1250 : 880
            : params.isSuperNitro ? 960 : 620,
          now,
          0.06
        );
        this.nitroHumGain!.gain.setTargetAtTime(0, now, 0.05);
      }
    } else {
      this.nitroGain!.gain.setTargetAtTime(0, now, 0.05);
      this.nitroHumGain!.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  public playGearShift(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const style = this.carProfile.shiftStyle;

    if (style === 'ev_pulse') {
      // Smooth warm electric surge accent (zero combustion bang)
      this.playTone(280, 420, 0.11, 'sine', 0.055);
      return;
    }

    // Natural brief torque dip during gear engagement
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(0.065, now);
      this.engineGain.gain.linearRampToValueAtTime(0.24 * this.carProfile.volumeScale, now + 0.085);
    }

    if (style === 'bov_pssh') {
      // Soft realistic turbo Blow-Off Valve air release ("Psssh")
      this.playNoiseSweep(0.19, 2600, 950, 2.6, 0.11);
      this.playTone(95, 52, 0.09, 'sine', 0.11);
    } else if (style === 'crackle_pop') {
      // Warm muffled BMW M4 exhaust burble ("blub-pop")
      this.playExhaustBurble(0.14);
      setTimeout(() => this.playExhaustBurble(0.1), 78);
    } else if (style === 'v12_bang') {
      // Deep, warm Aventador chest-thump upshift bark
      this.playTone(108, 38, 0.14, 'triangle', 0.19);
      this.playBrownBurst(0.11, 280, 0.22);
    } else {
      // Crisp Ferrari 458 DCT exhaust bark
      this.playTone(135, 62, 0.085, 'triangle', 0.13);
      this.playBrownBurst(0.07, 420, 0.13);
    }
  }

  /** Warm muffled low-end exhaust overrun burble (never harsh white-noise snap) */
  public playOverrunPop(): void {
    if (!this.ctx || !this.sfxGain || this.muted || this.carProfile.isElectric) return;
    this.playExhaustBurble(0.12);
  }

  private playExhaustBurble(volume: number): void {
    if (!this.ctx || !this.sfxGain || !this.brownBuffer) return;
    const freq = 220 + Math.random() * 190;
    this.playBrownBurst(0.075, freq, volume * 1.35);
    this.playTone(105 + Math.random() * 30, 44, 0.075, 'sine', volume * 0.85);
  }

  /** Smooth, rich 0.85s acoustic rev-blip in the garage showroom using the same warm PeriodicWave + Formant + Brown Noise DSP */
  public playGarageRevPreview(profile: CarAudioSignature): void {
    this.setCarAudioProfile(profile);
    if (!this.initialized || !this.ctx || !this.sfxGain || !this.brownBuffer || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const wave = createEnginePeriodicWave(ctx, profile.harmonicWeights);

    const shaper = ctx.createWaveShaper();
    shaper.curve = createWarmthCurve(profile.warmthDrive);

    const bodyF = ctx.createBiquadFilter();
    bodyF.type = 'peaking';
    bodyF.frequency.value = profile.bodyFormantHz;
    bodyF.Q.value = 1.1;
    bodyF.gain.value = 4.8;

    const throatF = ctx.createBiquadFilter();
    throatF.type = 'peaking';
    throatF.frequency.value = profile.throatFormantHz;
    throatF.Q.value = 1.3;
    throatF.gain.value = 3.2;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.Q.value = 0.85;
    lpf.frequency.setValueAtTime(profile.lpfBase, now);
    lpf.frequency.exponentialRampToValueAtTime(
      Math.min(3200, profile.lpfBase + profile.lpfSpan * 0.85),
      now + 0.34
    );
    lpf.frequency.exponentialRampToValueAtTime(profile.lpfBase * 0.85, now + 0.86);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.24 * profile.volumeScale, now + 0.11);
    env.gain.setValueAtTime(0.23 * profile.volumeScale, now + 0.36);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.88);

    shaper.connect(bodyF).connect(throatF).connect(lpf).connect(env).connect(this.sfxGain);

    const startBase = profile.pitchBase * 1.04;
    const peakBase = profile.pitchBase + profile.pitchSpan * (profile.isElectric ? 0.68 : 0.78);

    // Main PeriodicWave + secondary voice + warm sub
    const mainOsc = ctx.createOscillator();
    mainOsc.setPeriodicWave(wave);
    mainOsc.frequency.setValueAtTime(startBase, now);
    mainOsc.frequency.exponentialRampToValueAtTime(peakBase, now + 0.34);
    mainOsc.frequency.exponentialRampToValueAtTime(startBase * 0.94, now + 0.86);
    const mainG = ctx.createGain();
    mainG.gain.value = 0.56;
    mainOsc.connect(mainG).connect(shaper);

    const secOsc = ctx.createOscillator();
    secOsc.type = profile.isElectric ? 'sine' : 'triangle';
    const secDetune = profile.isElectric ? 1.0 : 0.997;
    secOsc.frequency.setValueAtTime(startBase * profile.secondRatio * secDetune, now);
    secOsc.frequency.exponentialRampToValueAtTime(peakBase * profile.secondRatio * secDetune, now + 0.34);
    secOsc.frequency.exponentialRampToValueAtTime(startBase * profile.secondRatio * 0.94, now + 0.86);
    const secG = ctx.createGain();
    secG.gain.value = profile.secondGain;
    secOsc.connect(secG).connect(shaper);

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(Math.max(24, startBase * 0.5), now);
    subOsc.frequency.exponentialRampToValueAtTime(peakBase * 0.5, now + 0.34);
    subOsc.frequency.exponentialRampToValueAtTime(Math.max(24, startBase * 0.47), now + 0.86);
    const subG = ctx.createGain();
    subG.gain.value = profile.subGain;
    subOsc.connect(subG).connect(bodyF);

    // Organic Brown Noise exhaust roar
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = this.brownBuffer;
    const roarF = ctx.createBiquadFilter();
    roarF.type = 'bandpass';
    roarF.Q.value = 0.85;
    roarF.frequency.setValueAtTime(profile.roarFreqBase, now);
    roarF.frequency.exponentialRampToValueAtTime(profile.roarFreqBase + profile.roarFreqSpan * 0.8, now + 0.34);
    roarF.frequency.exponentialRampToValueAtTime(profile.roarFreqBase, now + 0.86);
    const roarG = ctx.createGain();
    roarG.gain.value = profile.roarGain * 0.72;
    roarSrc.connect(roarF).connect(roarG).connect(bodyF);

    mainOsc.start(now);
    secOsc.start(now);
    subOsc.start(now);
    roarSrc.start(now);
    mainOsc.stop(now + 0.9);
    secOsc.stop(now + 0.9);
    subOsc.stop(now + 0.9);
    roarSrc.stop(now + 0.9);

    // Subtle lift-off acoustic character right after the rev peak
    if (profile.shiftStyle === 'bov_pssh') {
      setTimeout(() => this.playNoiseSweep(0.22, 2600, 950, 2.8, 0.11), 350);
    } else if (profile.shiftStyle === 'crackle_pop') {
      setTimeout(() => this.playExhaustBurble(0.11), 390);
      setTimeout(() => this.playExhaustBurble(0.09), 500);
      setTimeout(() => this.playExhaustBurble(0.075), 605);
    } else if (profile.shiftStyle === 'v12_bang') {
      setTimeout(() => {
        this.playTone(105, 40, 0.12, 'triangle', 0.15);
        this.playBrownBurst(0.1, 290, 0.18);
      }, 360);
    } else if (profile.shiftStyle === 'ev_pulse') {
      setTimeout(() => this.playTone(320, 480, 0.18, 'sine', 0.065), 260);
    }
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
    const mode = this.carProfile.nitroSound;
    if (mode === 'plasma') {
      // Smooth warm cyber plasma surge (pleasant musical fifth, never shrill)
      this.playTone(isSuper ? 260 : 210, isSuper ? 680 : 520, 0.44, 'sine', 0.18);
      this.playTone(isSuper ? 390 : 315, isSuper ? 1020 : 780, 0.46, 'triangle', 0.11);
      this.playBrownBurst(0.32, 680, 0.16);
    } else if (mode === 'turbo') {
      // Twin-turbo intake surge + smooth compressor whoosh
      this.playBrownBurst(0.35, 520, 0.22);
      this.playNoiseSweep(0.34, 900, isSuper ? 2400 : 1800, 2.2, 0.12);
    } else {
      // Deep warm racing afterburner ignite
      this.playTone(isSuper ? 190 : 150, isSuper ? 560 : 420, 0.38, 'triangle', 0.18);
      this.playBrownBurst(0.34, isSuper ? 680 : 460, 0.24);
    }
  }

  public playDriftBoost(tier: 1 | 2 | 3): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const base = 260 + tier * 110;
    this.playTone(base, base * 2.1, 0.26, 'triangle', 0.17);
    this.playTone(base * 1.5, base * 3.0, 0.24, 'sine', 0.13);
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
    this.playTone(185, 48, 0.18, 'triangle', vol);
    this.playBrownBurst(0.16, 480, vol * 1.1);
  }

  public playConeSmash(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playTone(620, 240, 0.08, 'triangle', 0.14);
    this.playNoiseBurst(0.06, 2200, 0.07);
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
      setTimeout(() => this.playTone(n, n, 0.42, 'triangle', 0.16), idx * 110);
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

  private playBrownBurst(dur: number, freq: number, volume: number): void {
    if (!this.ctx || !this.sfxGain || !this.brownBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownBuffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = 0.9;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  private playNoiseSweep(
    dur: number,
    fStart: number,
    fEnd: number,
    qVal: number,
    volume: number
  ): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = qVal;
    filt.frequency.setValueAtTime(fStart, now);
    filt.frequency.exponentialRampToValueAtTime(Math.max(80, fEnd), now + dur);

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
