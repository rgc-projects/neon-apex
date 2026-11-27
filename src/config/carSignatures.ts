import { CarSpec } from '../types';

export type EngineShiftStyle = 'classic' | 'dct_crack' | 'bov_pssh' | 'crackle_pop' | 'v12_bang' | 'ev_pulse';
export type NitroSoundStyle = 'classic' | 'jet' | 'turbo' | 'plasma';
export type BackfireVfxStyle = 'spark' | 'flame' | 'pop_multi' | 'arc';

export interface CarAudioSignature {
  /** Restores the exact original launch-version sawtooth+triangle+sine synth (used by APEX-V12) */
  useClassicOriginalSynth?: boolean;
  /** Pure electric propulsion uses speed-linear clean chordal inverter hum */
  isElectric: boolean;
  /**
   * Custom PeriodicWave harmonic weights (index 0 = 1st harmonic / fundamental).
   * Eliminates harsh sawtooth buzz by sculpting warm cylinder firing-order spectra.
   */
  harmonicWeights: number[];
  /** Secondary voice ratio relative to fundamental (e.g. 1.5 I6 fifth, 2.0 V12 octave) */
  secondRatio: number;
  secondGain: number;
  /** Warm sub-bass body foundation ratio (0.5 = one octave down) */
  subGain: number;
  /** Fundamental frequency (Hz) at idle & sweep range across RPM / speed */
  pitchBase: number;
  pitchSpan: number;
  gearPitchStep: number;
  /** Fixed acoustic exhaust-chamber formants (Hz) */
  bodyFormantHz: number;
  throatFormantHz: number;
  /** Gentle master lowpass sweep */
  lpfBase: number;
  lpfSpan: number;
  lpfQ: number;
  /** Warmth saturation drive */
  warmthDrive: number;
  /** Organic Brown Noise exhaust roar level & center frequency (Hz) */
  roarGain: number;
  roarFreqBase: number;
  roarFreqSpan: number;
  /** Subtle turbo air spool / EV inverter shimmer gain (0 = none) */
  airWhineGain: number;
  airWhineBaseHz: number;
  airWhineSpanHz: number;
  /** Overall engine loudness multiplier */
  volumeScale: number;
  /** Characteristic upshift sound */
  shiftStyle: EngineShiftStyle;
  /** Probability of warm muffled exhaust burble during drift/decel (0..1) */
  overrunCrackle: number;
  /** Nitro continuous & ignition sound character */
  nitroSound: NitroSoundStyle;
}

export interface CarVfxSignature {
  /** Standard nitro flame [outer, inner] hex colors */
  flameOuter: number;
  flameInner: number;
  /** Super nitro / Overdrive II flame [outer, inner] hex colors */
  superOuter: number;
  superInner: number;
  /** Flame cone scale multiplier [radiusScale, lengthScale] */
  flameScale: [number, number];
  /** Exhaust light ribbon trail colors [normal, super] */
  trailHex: number;
  superTrailHex: number;
  /** Exhaust ember/plasma particle colors [normal, super] */
  exhaustHex: number;
  superExhaustHex: number;
  /** 4-tier drift spark palette [tier0, tier1, tier2, tier3] */
  sparkPalette: [number, number, number, number];
  /** Extra drift sparks per tick (e.g. +2 for touge drift master) */
  sparkBonus: number;
  /** Tire smoke tint hex & emission probability */
  smokeTint: number;
  smokeChance: number;
  /** Shift & overrun backfire burst style and color */
  backfireStyle: BackfireVfxStyle;
  backfireHex: number;
}

export interface CarSignatureProfile {
  audio: CarAudioSignature;
  vfx: CarVfxSignature;
}

export const CAR_SIGNATURES: Record<string, CarSignatureProfile> = {
  // APEX-V12 (Ferrari 458 Spider GT3) — Exact original initial engine sound!
  'apex-v12': {
    audio: {
      useClassicOriginalSynth: true,
      isElectric: false,
      harmonicWeights: [1.0, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12],
      secondRatio: 1.995,
      secondGain: 0.35,
      subGain: 0.4,
      pitchBase: 46,
      pitchSpan: 128,
      gearPitchStep: 13,
      bodyFormantHz: 145,
      throatFormantHz: 560,
      lpfBase: 360,
      lpfSpan: 1850,
      lpfQ: 2.6,
      warmthDrive: 2.4,
      roarGain: 0.0,
      roarFreqBase: 220,
      roarFreqSpan: 520,
      airWhineGain: 0.0,
      airWhineBaseHz: 1400,
      airWhineSpanHz: 800,
      volumeScale: 1.0,
      shiftStyle: 'classic',
      overrunCrackle: 0.0,
      nitroSound: 'classic',
    },
    vfx: {
      flameOuter: 0xff4d12,
      flameInner: 0xffe4a0,
      superOuter: 0x38bdf8,
      superInner: 0xe0f2fe,
      flameScale: [1.0, 1.04],
      trailHex: 0xff5a1f,
      superTrailHex: 0x38bdf8,
      exhaustHex: 0xff7b29,
      superExhaustHex: 0x7dd3fc,
      sparkPalette: [0xff7b29, 0xffaa3b, 0xffe49e, 0x93c5fd],
      sparkBonus: 0,
      smokeTint: 0xd6dde8,
      smokeChance: 0.72,
      backfireStyle: 'spark',
      backfireHex: 0xff6b1a,
    },
  },

  // PHANTOM-X (McLaren P1 GTR) — Exact v2.1.3 warm Twin-Turbo V8 + airy turbo spool & BOV
  'phantom-x': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.62, 0.38, 0.22, 0.12, 0.07, 0.03, 0.02],
      secondRatio: 1.5,
      secondGain: 0.22,
      subGain: 0.58,
      pitchBase: 40,
      pitchSpan: 92,
      gearPitchStep: 9,
      bodyFormantHz: 115,
      throatFormantHz: 420,
      lpfBase: 320,
      lpfSpan: 1150,
      lpfQ: 0.85,
      warmthDrive: 1.6,
      roarGain: 0.44,
      roarFreqBase: 175,
      roarFreqSpan: 420,
      airWhineGain: 0.08,
      airWhineBaseHz: 1350,
      airWhineSpanHz: 1350,
      volumeScale: 1.05,
      shiftStyle: 'bov_pssh',
      overrunCrackle: 0.08,
      nitroSound: 'turbo',
    },
    vfx: {
      flameOuter: 0x2563eb,
      flameInner: 0xbae6fd,
      superOuter: 0x38bdf8,
      superInner: 0xffffff,
      flameScale: [0.92, 1.26],
      trailHex: 0x3b82f6,
      superTrailHex: 0x93c5fd,
      exhaustHex: 0x60a5fa,
      superExhaustHex: 0xe0f2fe,
      sparkPalette: [0x60a5fa, 0x93c5fd, 0xdbeafe, 0xffffff],
      sparkBonus: 0,
      smokeTint: 0xcbd5e1,
      smokeChance: 0.68,
      backfireStyle: 'flame',
      backfireHex: 0x60a5fa,
    },
  },

  // KATANA-RS (BMW M4 Competition) — Exact v2.1.3 silky Twin-Turbo Inline-6 + warm muffled burble
  'drift-k': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.44, 0.56, 0.22, 0.14, 0.16, 0.05, 0.03],
      secondRatio: 1.5,
      secondGain: 0.3,
      subGain: 0.46,
      pitchBase: 45,
      pitchSpan: 102,
      gearPitchStep: 10,
      bodyFormantHz: 130,
      throatFormantHz: 490,
      lpfBase: 360,
      lpfSpan: 1320,
      lpfQ: 0.85,
      warmthDrive: 1.55,
      roarGain: 0.4,
      roarFreqBase: 200,
      roarFreqSpan: 480,
      airWhineGain: 0.045,
      airWhineBaseHz: 1550,
      airWhineSpanHz: 1050,
      volumeScale: 1.02,
      shiftStyle: 'crackle_pop',
      overrunCrackle: 0.52,
      nitroSound: 'jet',
    },
    vfx: {
      flameOuter: 0xf59e0b,
      flameInner: 0xfef3c7,
      superOuter: 0xf43f5e,
      superInner: 0xfde68a,
      flameScale: [1.1, 1.08],
      trailHex: 0xf59e0b,
      superTrailHex: 0xfb7185,
      exhaustHex: 0xfbbf24,
      superExhaustHex: 0xfda4af,
      sparkPalette: [0xf59e0b, 0xfbbf24, 0xfef08a, 0xfb7185],
      sparkBonus: 2,
      smokeTint: 0xe2e8f0,
      smokeChance: 0.92,
      backfireStyle: 'pop_multi',
      backfireHex: 0xff9f1c,
    },
  },

  // VALKYRIE-GT (Lamborghini Aventador) — Exact v2.1.3 chesty 6.5L NA V12 howl
  'valkyrie-gt': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.78, 0.58, 0.38, 0.24, 0.18, 0.09, 0.06],
      secondRatio: 2.0,
      secondGain: 0.32,
      subGain: 0.56,
      pitchBase: 54,
      pitchSpan: 134,
      gearPitchStep: 12,
      bodyFormantHz: 155,
      throatFormantHz: 650,
      lpfBase: 460,
      lpfSpan: 1780,
      lpfQ: 0.85,
      warmthDrive: 1.75,
      roarGain: 0.42,
      roarFreqBase: 240,
      roarFreqSpan: 600,
      airWhineGain: 0.0,
      airWhineBaseHz: 1600,
      airWhineSpanHz: 900,
      volumeScale: 1.06,
      shiftStyle: 'v12_bang',
      overrunCrackle: 0.24,
      nitroSound: 'jet',
    },
    vfx: {
      flameOuter: 0x9333ea,
      flameInner: 0xf5d0fe,
      superOuter: 0xd946ef,
      superInner: 0xffffff,
      flameScale: [1.12, 1.2],
      trailHex: 0xa855f7,
      superTrailHex: 0xf0abfc,
      exhaustHex: 0xc084fc,
      superExhaustHex: 0xf5d0fe,
      sparkPalette: [0xa855f7, 0xc084fc, 0xf0abfc, 0xffffff],
      sparkBonus: 1,
      smokeTint: 0xd8b4fe,
      smokeChance: 0.74,
      backfireStyle: 'flame',
      backfireHex: 0xc084fc,
    },
  },

  // ECLIPSE-EVO (Khronos Concept EV) — Exact v2.1.3 warm futuristic Electric Sport Sound
  'eclipse-evo': {
    audio: {
      isElectric: true,
      harmonicWeights: [1.0, 0.38, 0.16, 0.06, 0.02],
      secondRatio: 1.5,
      secondGain: 0.34,
      subGain: 0.48,
      pitchBase: 76,
      pitchSpan: 168,
      gearPitchStep: 0,
      bodyFormantHz: 165,
      throatFormantHz: 460,
      lpfBase: 620,
      lpfSpan: 1450,
      lpfQ: 0.85,
      warmthDrive: 1.05,
      roarGain: 0.16,
      roarFreqBase: 360,
      roarFreqSpan: 900,
      airWhineGain: 0.075,
      airWhineBaseHz: 920,
      airWhineSpanHz: 1250,
      volumeScale: 0.98,
      shiftStyle: 'ev_pulse',
      overrunCrackle: 0,
      nitroSound: 'plasma',
    },
    vfx: {
      flameOuter: 0x06b6d4,
      flameInner: 0xcffafe,
      superOuter: 0x2dd4bf,
      superInner: 0xffffff,
      flameScale: [0.95, 1.24],
      trailHex: 0x2dd4bf,
      superTrailHex: 0x67e8f9,
      exhaustHex: 0x22d3ee,
      superExhaustHex: 0xa5f3fc,
      sparkPalette: [0x06b6d4, 0x2dd4bf, 0x67e8f9, 0xffffff],
      sparkBonus: 1,
      smokeTint: 0xa5f3fc,
      smokeChance: 0.48,
      backfireStyle: 'arc',
      backfireHex: 0x22d3ee,
    },
  },
};

export function getCarSignature(spec: CarSpec | string): CarSignatureProfile {
  const id = typeof spec === 'string' ? spec : spec.id;
  return CAR_SIGNATURES[id] ?? CAR_SIGNATURES['apex-v12'];
}
