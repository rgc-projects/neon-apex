import { CarSpec } from '../types';

export const CAR_SPECS: CarSpec[] = [
  {
    id: 'apex-v12',
    name: 'APEX-V12',
    subtitle: 'GT3 CORSA',
    archetype: 'BALANCED',
    archetypeZh: '均衡型',
    description: '全能 GT3 赛车调校，兼顾高速直道下压力、精准转向与流畅可控的漂移平衡。',
    primaryColor: 0xb91c1c, // Realistic Rosso Corsa Metallic Ferrari Red
    secondaryColor: 0x7f1d1d,
    neonColor: 0x38bdf8,
    neonHex: '#38bdf8',
    primaryHex: '#b91c1c',
    bodyStyle: 'interceptor',
    modelFile: 'supercar.glb',
    maxSpeed: 100,
    acceleration: 52,
    handling: 1.04,
    driftControl: 1.06,
    driftChargeRate: 1.06,
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
    subtitle: 'HYPER ENDURANCE',
    archetype: 'TOP SPEED',
    archetypeZh: '极速型',
    description: '低风阻耐力赛极速猛兽，拥有全场最高极速与狂暴的涡轮氮气推进力。',
    primaryColor: 0x1d4ed8, // Deep Metallic Sapphire Racing Blue
    secondaryColor: 0x1e3a8a,
    neonColor: 0x60a5fa,
    neonHex: '#60a5fa',
    primaryHex: '#1d4ed8',
    bodyStyle: 'phantom',
    modelFile: 'phantom-p1.glb',
    maxSpeed: 107,
    acceleration: 48,
    handling: 0.96,
    driftControl: 0.94,
    driftChargeRate: 0.98,
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
    subtitle: 'TOUGE DRIFT GT',
    archetype: 'DRIFT MASTER',
    archetypeZh: '漂移型',
    description: '轻量化山道漂移战车，超大鹅颈尾翼配极速甩尾响应与闪电集气能力。',
    primaryColor: 0xd97706, // Metallic Giallo Modena / Solar Amber Gold
    secondaryColor: 0x92400e,
    neonColor: 0xfbbf24,
    neonHex: '#fbbf24',
    primaryHex: '#d97706',
    bodyStyle: 'katana',
    modelFile: 'katana-m4.glb',
    maxSpeed: 96,
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
  {
    id: 'valkyrie-gt',
    name: 'VALKYRIE-GT',
    subtitle: 'APEX S-CLASS',
    archetype: 'S-HYPER',
    archetypeZh: 'S级全能',
    description: '专为车神难度与超长史诗赛道打造的 S 级旗舰超跑，兼具顶级极速、迅猛爆发与稳健高倾角漂移抓地力。',
    primaryColor: 0xdbe4f0, // Metallic Pearl Titanium White
    secondaryColor: 0x312e81,
    neonColor: 0xc084fc,
    neonHex: '#c084fc',
    primaryHex: '#dbe4f0',
    bodyStyle: 'valkyrie',
    modelFile: 'valkyrie-aventador.glb',
    maxSpeed: 109,
    acceleration: 56,
    handling: 1.12,
    driftControl: 1.16,
    driftChargeRate: 1.16,
    nitroPower: 1.16,
    nitroCapacity: 1.12,
    stats: {
      speed: 99,
      accel: 94,
      drift: 92,
      nitro: 96,
    },
  },
  {
    id: 'eclipse-evo',
    name: 'ECLIPSE-EVO',
    subtitle: 'CYBER EV HYPER',
    archetype: 'EV HYPER',
    archetypeZh: 'S级电驱',
    description: '四电机瞬时扭矩赛博电驱原型车，拥有全场最强出弯加速与闪电漂移集气，征服暗夜山道与赤崖 72 拐的弯道利器。',
    primaryColor: 0x111827, // Stealth Obsidian Carbon Black
    secondaryColor: 0x0f766e,
    neonColor: 0x2dd4bf,
    neonHex: '#2dd4bf',
    primaryHex: '#111827',
    bodyStyle: 'eclipse',
    modelFile: 'eclipse-concept.glb',
    maxSpeed: 105,
    acceleration: 62,
    handling: 1.18,
    driftControl: 1.26,
    driftChargeRate: 1.36,
    nitroPower: 1.12,
    nitroCapacity: 1.08,
    stats: {
      speed: 93,
      accel: 100,
      drift: 99,
      nitro: 94,
    },
  },
];

export interface AIRacerProfile {
  name: string;
  carSpecIndex: number;
  overridePrimary: number;
  overrideNeon: number;
  overrideNeonHex: string;
  skill: number;
  aggression: number;
  preferredLine: number;
}

export const AI_PROFILES: AIRacerProfile[] = [
  {
    name: 'VEX-01',
    carSpecIndex: 1,
    overridePrimary: 0xe2e8f0, // Metallic Pearl Silver
    overrideNeon: 0x38bdf8,
    overrideNeonHex: '#38bdf8',
    skill: 0.985,
    aggression: 0.78,
    preferredLine: -0.22,
  },
  {
    name: 'KIRA-9',
    carSpecIndex: 2,
    overridePrimary: 0x065f46, // British Racing Metallic Emerald
    overrideNeon: 0x10b981,
    overrideNeonHex: '#10b981',
    skill: 0.97,
    aggression: 0.7,
    preferredLine: 0.25,
  },
  {
    name: 'NOVA-X',
    carSpecIndex: 0,
    overridePrimary: 0x334155, // Gunmetal Titanium Grey
    overrideNeon: 0xf43f5e,
    overrideNeonHex: '#f43f5e',
    skill: 0.955,
    aggression: 0.64,
    preferredLine: -0.1,
  },
  {
    name: 'SOLAR',
    carSpecIndex: 2,
    overridePrimary: 0xc2410c, // Burnt Copper Metallic Orange
    overrideNeon: 0xf97316,
    overrideNeonHex: '#f97316',
    skill: 0.93,
    aggression: 0.72,
    preferredLine: 0.14,
  },
  {
    name: 'ZERO-K',
    carSpecIndex: 1,
    overridePrimary: 0x1e293b, // Stealth Obsidian Carbon
    overrideNeon: 0x60a5fa,
    overrideNeonHex: '#60a5fa',
    skill: 0.9,
    aggression: 0.55,
    preferredLine: 0.0,
  },
];
