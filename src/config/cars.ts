import { CarSpec } from '../types';

export const CAR_SPECS: CarSpec[] = [
  {
    id: 'apex-v12',
    name: 'APEX-V12',
    subtitle: 'NEON INTERCEPTOR',
    archetype: 'BALANCED',
    archetypeZh: '均衡型',
    description: '全能未来旗舰超跑，兼顾高速稳定性、精准转向与流畅漂移手感。',
    primaryColor: 0x1e56a8,
    secondaryColor: 0x2c72d4,
    neonColor: 0x00f2ff,
    neonHex: '#00f2ff',
    primaryHex: '#1a437e',
    bodyStyle: 'interceptor',
    maxSpeed: 100,        // ~360 km/h base, ~445 km/h super nitro
    acceleration: 52,
    handling: 1.04,
    driftControl: 1.05,
    driftChargeRate: 1.05,
    nitroPower: 1.05,
    nitroCapacity: 1.05,
    stats: {
      speed: 86,
      accel: 85,
      drift: 86,
      nitro: 88,
    },
  },
  {
    id: 'phantom-x',
    name: 'PHANTOM-X',
    subtitle: 'HYPER VELOCITY GT',
    archetype: 'TOP SPEED',
    archetypeZh: '极速型',
    description: '低风阻长尾极速猛兽，拥有全场最高极速与狂暴的超级氮气推进力。',
    primaryColor: 0x991b6e,
    secondaryColor: 0xc2278e,
    neonColor: 0xff2a9d,
    neonHex: '#ff2a9d',
    primaryHex: '#5c146e',
    bodyStyle: 'phantom',
    maxSpeed: 107,        // ~385 km/h base, ~478 km/h super nitro
    acceleration: 48,
    handling: 0.94,
    driftControl: 0.92,
    driftChargeRate: 0.96,
    nitroPower: 1.18,
    nitroCapacity: 1.12,
    stats: {
      speed: 98,
      accel: 80,
      drift: 74,
      nitro: 96,
    },
  },
  {
    id: 'drift-k',
    name: 'KATANA-RS',
    subtitle: 'CYBER DRIFT SPEC',
    archetype: 'DRIFT MASTER',
    archetypeZh: '漂移型',
    description: '轻量化弯道大师，极致响应的甩尾操控与闪电般极速漂移集气能力。',
    primaryColor: 0xb3680a,
    secondaryColor: 0xd98214,
    neonColor: 0xffb800,
    neonHex: '#ffb800',
    primaryHex: '#7c4a0a',
    bodyStyle: 'katana',
    maxSpeed: 96,         // ~345 km/h base, super fast out of corners with constant boost!
    acceleration: 56,
    handling: 1.16,
    driftControl: 1.24,
    driftChargeRate: 1.32,
    nitroPower: 1.02,
    nitroCapacity: 1.0,
    stats: {
      speed: 78,
      accel: 96,
      drift: 99,
      nitro: 86,
    },
  },
];

export interface AIRacerProfile {
  name: string;
  carSpecIndex: number;
  overridePrimary: number;
  overrideNeon: number;
  overrideNeonHex: string;
  skill: number;        // 0.90..1.04
  aggression: number;   // 0..1
  preferredLine: number;// -0.45..0.45 fraction of half-width
}

export const AI_PROFILES: AIRacerProfile[] = [
  {
    name: 'VEX-01',
    carSpecIndex: 1,
    overridePrimary: 0x260818,
    overrideNeon: 0xff2e63,
    overrideNeonHex: '#ff2e63',
    skill: 1.02,
    aggression: 0.85,
    preferredLine: -0.22,
  },
  {
    name: 'KIRA-9',
    carSpecIndex: 2,
    overridePrimary: 0x05211c,
    overrideNeon: 0x00ffaa,
    overrideNeonHex: '#00ffaa',
    skill: 0.99,
    aggression: 0.72,
    preferredLine: 0.25,
  },
  {
    name: 'NOVA-X',
    carSpecIndex: 0,
    overridePrimary: 0x130a2e,
    overrideNeon: 0xa855f7,
    overrideNeonHex: '#a855f7',
    skill: 0.96,
    aggression: 0.65,
    preferredLine: -0.1,
  },
  {
    name: 'SOLAR',
    carSpecIndex: 2,
    overridePrimary: 0x261505,
    overrideNeon: 0xff7b00,
    overrideNeonHex: '#ff7b00',
    skill: 0.93,
    aggression: 0.78,
    preferredLine: 0.14,
  },
  {
    name: 'ZERO-K',
    carSpecIndex: 1,
    overridePrimary: 0x091a2e,
    overrideNeon: 0x38bdf8,
    overrideNeonHex: '#38bdf8',
    skill: 0.90,
    aggression: 0.55,
    preferredLine: 0.0,
  },
];
