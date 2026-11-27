import { CarSpec } from '../types';

export type EngineShiftStyle = 'dct_crack' | 'bov_pssh' | 'crackle_pop' | 'v12_bang' | 'ev_pulse';
export type NitroSoundStyle = 'jet' | 'turbo' | 'plasma';
export type BackfireVfxStyle = 'spark' | 'flame' | 'pop_multi' | 'arc';

export interface CarAudioSignature {
  /** Pure electric propulsion uses speed-linear energetic harmonic inverter synth */
  isElectric: boolean;
  /**
   * Custom 12-harmonic PeriodicWave spectrum: preserves crisp motorsport bite & upper-mid
   * racing energy (sounds punchy even on phone speakers!) while rolling off harsh buzz above 12th.
   */
  harmonicWeights: number[];
  /** Secondary voice ratio relative to fundamental (e.g. 1.5 I6 fifth, 2.0 V8/V12 octave) */
  secondRatio: number;
  secondGain: number;
  /** Punchy sub-bass body foundation */
  subGain: number;
  /** Fundamental frequency (Hz) at idle & sweep range across RPM / speed */
  pitchBase: number;
  pitchSpan: number;
  gearPitchStep: number;
  /** Fixed acoustic exhaust-chamber formants (Hz) — bright racing throat + body punch */
  bodyFormantHz: number;
  throatFormantHz: number;
  /** Lively master lowpass sweep (Q = 1.65 for exciting racing bite without piercing whistle) */
  lpfBase: number;
  lpfSpan: number;
  lpfQ: number;
  /** Analog motorsport saturation drive (2.1..2.65 = punchy growl like original!) */
  warmthDrive: number;
  /** Organic Brown Noise exhaust roar level & center frequency (Hz) */
  roarGain: number;
  roarFreqBase: number;
  roarFreqSpan: number;
  /** Airy turbo spool / EV electric turbine shimmer */
  airWhineGain: number;
  airWhineBaseHz: number;
  airWhineSpanHz: number;
  /** Overall engine loudness multiplier */
  volumeScale: number;
  /** Characteristic upshift sound */
  shiftStyle: EngineShiftStyle;
  /** Probability of punchy exhaust overrun burble during drift/decel (0..1) */
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
  // APEX-V12 (Ferrari 458 Spider GT3) — Crisp, punchy, high-revving Italian NA V8 scream!
  'apex-v12': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.82, 0.44, 0.56, 0.28, 0.34, 0.18, 0.2, 0.11, 0.09, 0.05, 0.03],
      secondRatio: 2.0,
      secondGain: 0.34,
      subGain: 0.42,
      pitchBase: 52,
      pitchSpan: 142,
      gearPitchStep: 13,
      bodyFormantHz: 185,
      throatFormantHz: 960,
      lpfBase: 520,
      lpfSpan: 2450,
      lpfQ: 1.75,
      warmthDrive: 2.35,
      roarGain: 0.32,
      roarFreqBase: 320,
      roarFreqSpan: 860,
      airWhineGain: 0.0,
      airWhineBaseHz: 1600,
      airWhineSpanHz: 900,
      volumeScale: 1.08,
      shiftStyle: 'dct_crack',
      overrunCrackle: 0.16,
      nitroSound: 'jet',
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

  // PHANTOM-X (McLaren P1 GTR) — Muscular Twin-Turbo V8 roar + turbo compressor spool & crisp BOV!
  'phantom-x': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.74, 0.52, 0.38, 0.26, 0.2, 0.13, 0.09, 0.06, 0.04, 0.02, 0.01],
      secondRatio: 1.5,
      secondGain: 0.3,
      subGain: 0.54,
      pitchBase: 46,
      pitchSpan: 118,
      gearPitchStep: 11,
      bodyFormantHz: 150,
      throatFormantHz: 760,
      lpfBase: 440,
      lpfSpan: 2050,
      lpfQ: 1.55,
      warmthDrive: 2.45,
      roarGain: 0.42,
      roarFreqBase: 260,
      roarFreqSpan: 720,
      airWhineGain: 0.11,
      airWhineBaseHz: 1450,
      airWhineSpanHz: 1550,
      volumeScale: 1.1,
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

  // KATANA-RS (BMW M4 Competition) — Singing aggressive Inline-6 S58 + punchy touge Pop & Bang!
  'drift-k': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.54, 0.72, 0.34, 0.24, 0.36, 0.14, 0.11, 0.09, 0.06, 0.03, 0.02],
      secondRatio: 1.5,
      secondGain: 0.38,
      subGain: 0.44,
      pitchBase: 49,
      pitchSpan: 132,
      gearPitchStep: 12,
      bodyFormantHz: 170,
      throatFormantHz: 880,
      lpfBase: 480,
      lpfSpan: 2250,
      lpfQ: 1.85,
      warmthDrive: 2.5,
      roarGain: 0.38,
      roarFreqBase: 300,
      roarFreqSpan: 820,
      airWhineGain: 0.06,
      airWhineBaseHz: 1650,
      airWhineSpanHz: 1150,
      volumeScale: 1.08,
      shiftStyle: 'crackle_pop',
      overrunCrackle: 0.56,
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

  // VALKYRIE-GT (Lamborghini Aventador) — Ferocious high-RPM F1-style 6.5L NA V12 howl!
  'valkyrie-gt': {
    audio: {
      isElectric: false,
      harmonicWeights: [1.0, 0.88, 0.68, 0.54, 0.38, 0.32, 0.22, 0.18, 0.12, 0.09, 0.06, 0.04],
      secondRatio: 2.0,
      secondGain: 0.4,
      subGain: 0.5,
      pitchBase: 58,
      pitchSpan: 164,
      gearPitchStep: 14,
      bodyFormantHz: 205,
      throatFormantHz: 1120,
      lpfBase: 580,
      lpfSpan: 2750,
      lpfQ: 1.9,
      warmthDrive: 2.65,
      roarGain: 0.38,
      roarFreqBase: 360,
      roarFreqSpan: 980,
      airWhineGain: 0.0,
      airWhineBaseHz: 1800,
      airWhineSpanHz: 1000,
      volumeScale: 1.12,
      shiftStyle: 'v12_bang',
      overrunCrackle: 0.26,
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

  // ECLIPSE-EVO (Khronos Concept EV) — Energetic Formula-E / Rimac dual-motor electric surge!
  'eclipse-evo': {
    audio: {
      isElectric: true,
      harmonicWeights: [1.0, 0.52, 0.28, 0.16, 0.08, 0.04],
      secondRatio: 1.5,
      secondGain: 0.4,
      subGain: 0.44,
      pitchBase: 108,
      pitchSpan: 245,
      gearPitchStep: 0,
      bodyFormantHz: 220,
      throatFormantHz: 820,
      lpfBase: 860,
      lpfSpan: 2200,
      lpfQ: 1.4,
      warmthDrive: 1.35,
      roarGain: 0.2,
      roarFreqBase: 480,
      roarFreqSpan: 1200,
      airWhineGain: 0.12,
      airWhineBaseHz: 1150,
      airWhineSpanHz: 1650,
      volumeScale: 1.06,
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
