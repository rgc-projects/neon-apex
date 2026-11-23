import { TrackConfig } from '../types';

export const TRACK_CONFIGS: TrackConfig[] = [
  {
    id: 'neo-tokyo',
    name: 'NEO TOKYO OVERDRIVE',
    nameZh: '霓虹都市高速',
    theme: 'city',
    difficulty: 'MEDIUM',
    description: '摩纳哥式都市 90° 平直街区直角弯、22° 高架倾斜直角弯与 30° 摩天楼大倾角 U 型发卡弯的完美融合。',
    roadWidth: 23.5,
    maxBankDeg: 30,
    laps: 3,
    skyTopHex: '#050214',
    skyMidHex: '#1b0736',
    skyHorizonHex: '#ff2975',
    sunColorHex: '#ffae00',
    fogColor: 0x140728,
    fogDensity: 0.00118,
    railLeftColor: 0x00f2ff,
    railRightColor: 0xff2a9d,
    accentColorHex: '#00f2ff',
    asphaltTint: '#141726',
    points: [
      // Main Start/Finish Straight
      { x: 0, y: 0, z: 0, inwardBankDeg: 0 },
      { x: 0, y: 0, z: -200, inwardBankDeg: 0 },
      // Turn 1: Crisp Flat 90° Street Intersection Right (6° bank -> fast snap-drift!)
      { x: 14, y: 0, z: -278, inwardBankDeg: 6 },
      { x: 88, y: 2, z: -298, inwardBankDeg: 6 },
      // Downtown East Sprint
      { x: 260, y: 8, z: -298, inwardBankDeg: 0 },
      // Turn 2: Tilted 90° Elevated Overpass Right (22° bank -> fast flowing corner!)
      { x: 348, y: 12, z: -282, inwardBankDeg: 22 },
      { x: 372, y: 16, z: -205, inwardBankDeg: 22 },
      // Elevated Skyline Straight (Jump Ramp #1)
      { x: 372, y: 23, z: -30, inwardBankDeg: 0 },
      { x: 372, y: 19, z: 105, inwardBankDeg: 0 },
      // Turn 3: Steep 30° Banked 180° Sky-Bowl U-Turn Right (sustained Mega-Drift!)
      { x: 362, y: 17, z: 192, inwardBankDeg: 30 },
      { x: 295, y: 15, z: 235, inwardBankDeg: 30 },
      { x: 228, y: 13, z: 182, inwardBankDeg: 28 },
      // Inner City Return Chute
      { x: 225, y: 11, z: 55, inwardBankDeg: 0 },
      // Turn 4 & 5: Technical 90° Left -> 90° Left Urban Double-Right-Angle S (8° & 18° bank!)
      { x: 215, y: 9, z: -22, inwardBankDeg: 8 },
      { x: 145, y: 7, z: -52, inwardBankDeg: 8 },
      { x: 86, y: 6, z: -2, inwardBankDeg: 18 },
      { x: 96, y: 8, z: 95, inwardBankDeg: 12 },
      // Sunset Downhill Approach into Final Hairpin
      { x: 112, y: 12, z: 240, inwardBankDeg: 0 },
      // Turn 6: Downhill Sloped 180° Hairpin Right (24° bank, dropping 10m!)
      { x: 112, y: 10, z: 332, inwardBankDeg: 24 },
      { x: 52, y: 5, z: 390, inwardBankDeg: 24 },
      { x: -10, y: 1, z: 325, inwardBankDeg: 18 },
      // Final Tunnel Turbo Straight to Start/Finish
      { x: 0, y: 0, z: 165, inwardBankDeg: 0 },
    ],
    boostPads: [
      { t: 0.045, d: 0, length: 24, width: 6.5 },
      { t: 0.145, d: 0, length: 22, width: 6.2 },
      { t: 0.275, d: 0, length: 24, width: 6.5 },
      { t: 0.495, d: -2.5, length: 22, width: 6 },
      { t: 0.725, d: 2.5, length: 24, width: 6.2 },
      { t: 0.935, d: 0, length: 26, width: 7 },
    ],
    jumpRamps: [
      { tStart: 0.298, tEnd: 0.322, height: 4.8, widthRatio: 0.68 },
      { tStart: 0.895, tEnd: 0.918, height: 4.2, widthRatio: 0.66 },
    ],
    tunnelZones: [
      { tStart: 0.91, tEnd: 0.968 },
    ],
    coneClusters: [
      { t: 0.09, side: -1, count: 5 },
      { t: 0.21, side: -1, count: 5 },
      { t: 0.41, side: -1, count: 6 },
      { t: 0.56, side: 1, count: 5 },
      { t: 0.81, side: -1, count: 6 },
    ],
  },
  {
    id: 'hyperion-bay',
    name: 'HYPERION BAY BRIDGE',
    nameZh: '赛博跨海大桥',
    theme: 'bridge',
    difficulty: 'HARD',
    description: '融合赞德沃特 34° 超大倾角跨海 U 型碗弯、铃鹿式高速连续 S 弯与离岸 90° 高架弯道。',
    roadWidth: 24,
    maxBankDeg: 34,
    laps: 3,
    skyTopHex: '#020617',
    skyMidHex: '#071b3b',
    skyHorizonHex: '#00d9ff',
    sunColorHex: '#ff4ecd',
    fogColor: 0x06152d,
    fogDensity: 0.001,
    railLeftColor: 0x00ffe5,
    railRightColor: 0x5b7cff,
    accentColorHex: '#00ffe5',
    asphaltTint: '#111a2b',
    points: [
      // Main Twin-Pylon Suspension Bridge Launch Straight
      { x: 0, y: 12, z: 0, inwardBankDeg: 0 },
      { x: 0, y: 17, z: -275, inwardBankDeg: 0 },
      { x: 0, y: 26, z: -535, inwardBankDeg: 0 },
      // Turn 1: Zandvoort-Style 34° Extreme Banked 180° Ocean Bowl U-Turn Right!
      { x: 18, y: 24, z: -645, inwardBankDeg: 34 },
      { x: 105, y: 20, z: -702, inwardBankDeg: 34 },
      { x: 188, y: 16, z: -632, inwardBankDeg: 32 },
      // Parallel Offshore Straight
      { x: 192, y: 12, z: -455, inwardBankDeg: 0 },
      // Turn 2: Tilted 90° Left onto Sea Causeway (22° bank)
      { x: 208, y: 10, z: -375, inwardBankDeg: 22 },
      { x: 295, y: 10, z: -362, inwardBankDeg: 20 },
      // Causeway Straight into Turn 3 (26° Banked 90° Right)
      { x: 425, y: 14, z: -362, inwardBankDeg: 0 },
      { x: 505, y: 18, z: -322, inwardBankDeg: 26 },
      { x: 515, y: 22, z: -232, inwardBankDeg: 26 },
      // Suzuka-Inspired Flowing S-Curves over the Cyber Sea
      { x: 455, y: 20, z: -115, inwardBankDeg: 18 },
      { x: 525, y: 14, z: 18, inwardBankDeg: 20 },
      // Turn 4: Steep 32° Banked 180° Southern Bay U-Turn Right!
      { x: 518, y: 10, z: 145, inwardBankDeg: 32 },
      { x: 422, y: 8, z: 220, inwardBankDeg: 32 },
      { x: 325, y: 8, z: 165, inwardBankDeg: 26 },
      // Low Sea-Skimming Return Straight
      { x: 215, y: 9, z: 215, inwardBankDeg: 10 },
      { x: 100, y: 10, z: 225, inwardBankDeg: 0 },
      // Turn 5: Crisp 12° Banked 90° Right back onto Bridge
      { x: 16, y: 11, z: 208, inwardBankDeg: 12 },
      { x: 0, y: 12, z: 132, inwardBankDeg: 10 },
    ],
    boostPads: [
      { t: 0.045, d: 0, length: 28, width: 7 },
      { t: 0.115, d: 0, length: 28, width: 7 },
      { t: 0.305, d: 0, length: 24, width: 6.4 },
      { t: 0.445, d: -2.5, length: 24, width: 6 },
      { t: 0.625, d: 3.0, length: 24, width: 6 },
      { t: 0.855, d: 0, length: 26, width: 6.8 },
    ],
    jumpRamps: [
      { tStart: 0.135, tEnd: 0.158, height: 5.4, widthRatio: 0.7 },
      { tStart: 0.565, tEnd: 0.588, height: 4.5, widthRatio: 0.66 },
    ],
    tunnelZones: [],
    coneClusters: [
      { t: 0.22, side: -1, count: 6 },
      { t: 0.36, side: 1, count: 5 },
      { t: 0.49, side: -1, count: 6 },
      { t: 0.72, side: -1, count: 6 },
      { t: 0.91, side: -1, count: 5 },
    ],
  },
  {
    id: 'sub-zero',
    name: 'SUB-ZERO TUNNEL',
    nameZh: '地下霓虹隧道',
    theme: 'tunnel',
    difficulty: 'HARD',
    description: '纽博格林 Karussell 风格 36° 极限倾斜反应堆 U 型弯与 90° 地下堡垒连环急弯的极限速度压迫。',
    roadWidth: 22.5,
    maxBankDeg: 36,
    laps: 3,
    skyTopHex: '#04010f',
    skyMidHex: '#12052c',
    skyHorizonHex: '#7c3aed',
    sunColorHex: '#00ffaa',
    fogColor: 0x0b0520,
    fogDensity: 0.00165,
    railLeftColor: 0x00ffaa,
    railRightColor: 0xc026d3,
    accentColorHex: '#00ffaa',
    asphaltTint: '#131224',
    points: [
      // Start Bay Downhill Hex Tunnel
      { x: 0, y: 0, z: 0, inwardBankDeg: 0 },
      { x: 0, y: -6, z: -205, inwardBankDeg: 0 },
      // Turn 1: Crisp 10° Banked 90° Left Bunker Turn
      { x: -16, y: -10, z: -282, inwardBankDeg: 10 },
      { x: -96, y: -13, z: -302, inwardBankDeg: 10 },
      // Deep Reactor Cavern West Straight
      { x: -265, y: -22, z: -302, inwardBankDeg: 0 },
      // Turn 2: Extreme 36° Karussell Banked 180° U-Turn Left! (Longest high-G drift!)
      { x: -362, y: -26, z: -285, inwardBankDeg: 36 },
      { x: -412, y: -28, z: -208, inwardBankDeg: 36 },
      { x: -355, y: -25, z: -132, inwardBankDeg: 34 },
      // Cavern Floor East Boost Straight (Jump Ramp #1)
      { x: -195, y: -18, z: -125, inwardBankDeg: 0 },
      // Turn 3 & 4: Sharp 90° Right -> 90° Left Underground Reactor Chicane (8° bank!)
      { x: -125, y: -14, z: -102, inwardBankDeg: 8 },
      { x: -118, y: -10, z: -10, inwardBankDeg: 8 },
      { x: -145, y: -6, z: 65, inwardBankDeg: 12 },
      { x: -235, y: -2, z: 85, inwardBankDeg: 12 },
      // Turn 5: Sloped Uphill 30° Banked 180° Upper Gallery U-Turn Left!
      { x: -332, y: 4, z: 108, inwardBankDeg: 30 },
      { x: -368, y: 11, z: 198, inwardBankDeg: 30 },
      { x: -302, y: 15, z: 274, inwardBankDeg: 28 },
      // Upper Gallery Straight (Jump Ramp #2)
      { x: -110, y: 12, z: 278, inwardBankDeg: 0 },
      // Turn 6: Tilted 22° 90° Left back into Start Tunnel
      { x: -18, y: 6, z: 256, inwardBankDeg: 22 },
      { x: 0, y: 2, z: 175, inwardBankDeg: 16 },
    ],
    boostPads: [
      { t: 0.045, d: 0, length: 24, width: 6.4 },
      { t: 0.185, d: 0, length: 24, width: 6.2 },
      { t: 0.375, d: 0, length: 24, width: 6.4 },
      { t: 0.775, d: 0, length: 24, width: 6.5 },
      { t: 0.935, d: 0, length: 24, width: 6.4 },
    ],
    jumpRamps: [
      { tStart: 0.405, tEnd: 0.43, height: 4.8, widthRatio: 0.68 },
      { tStart: 0.805, tEnd: 0.83, height: 4.6, widthRatio: 0.66 },
    ],
    tunnelZones: [
      { tStart: 0.015, tEnd: 0.22 },
      { tStart: 0.46, tEnd: 0.68 },
      { tStart: 0.86, tEnd: 0.985 },
    ],
    coneClusters: [
      { t: 0.11, side: 1, count: 5 },
      { t: 0.30, side: 1, count: 6 },
      { t: 0.49, side: -1, count: 5 },
      { t: 0.57, side: 1, count: 5 },
      { t: 0.71, side: 1, count: 6 },
    ],
  },
  {
    id: 'akina-touge',
    name: 'AKINA NEON TOUGE',
    nameZh: '秋名赛博山道',
    theme: 'mountain',
    difficulty: 'EXTREME',
    description: '致敬秋名山连续下坡发卡弯与拉古纳塞卡螺旋落差弯！4 连不同倾角 U 型弯 + 90° 悬崖直角，专为极限漂移而生。',
    roadWidth: 22,
    maxBankDeg: 35,
    laps: 3,
    skyTopHex: '#040112',
    skyMidHex: '#1d0632',
    skyHorizonHex: '#ff3d8b',
    sunColorHex: '#ff9500',
    fogColor: 0x160728,
    fogDensity: 0.0011,
    railLeftColor: 0xff2a9d,
    railRightColor: 0x00ffaa,
    accentColorHex: '#ff2a9d',
    asphaltTint: '#151324',
    points: [
      // Mountain Summit Start Straight (48m elevation!)
      { x: 0, y: 48, z: 0, inwardBankDeg: 0 },
      { x: 0, y: 48, z: -190, inwardBankDeg: 0 },
      // Turn 1: Tilted 24° 90° Summit Cliffside Corner Right
      { x: 16, y: 48, z: -265, inwardBankDeg: 24 },
      { x: 96, y: 46, z: -282, inwardBankDeg: 24 },
      // Laguna Seca Corkscrew Crest & Steep Plunge!
      { x: 225, y: 45, z: -282, inwardBankDeg: 0 },
      { x: 315, y: 38, z: -240, inwardBankDeg: 18 },
      { x: 360, y: 27, z: -150, inwardBankDeg: 20 },
      // HAIRPIN #1: Steep 32° Banked Downhill 180° U-Turn Right (long high-speed drift!)
      { x: 398, y: 23, z: -78, inwardBankDeg: 32 },
      { x: 342, y: 19, z: -12, inwardBankDeg: 32 },
      { x: 255, y: 17, z: -48, inwardBankDeg: 28 },
      // Switchback Chute West
      { x: 155, y: 15, z: -55, inwardBankDeg: 0 },
      // HAIRPIN #2: Moderate 16° Banked Downhill 180° U-Turn Left (tighter technical snap!)
      { x: 82, y: 13, z: -32, inwardBankDeg: 16 },
      { x: 75, y: 9, z: 45, inwardBankDeg: 16 },
      { x: 150, y: 7, z: 85, inwardBankDeg: 14 },
      // Switchback Chute East
      { x: 295, y: 6, z: 90, inwardBankDeg: 0 },
      // HAIRPIN #3: Crisp Flat 7° 90° Mountain Switchback Right!
      { x: 375, y: 5, z: 112, inwardBankDeg: 7 },
      { x: 390, y: 4, z: 190, inwardBankDeg: 7 },
      // HAIRPIN #4: Extreme 35° Mega-Banked Slingshot 180° U-Turn Bowl Right!
      { x: 378, y: 4, z: 282, inwardBankDeg: 35 },
      { x: 292, y: 4, z: 338, inwardBankDeg: 35 },
      { x: 200, y: 7, z: 290, inwardBankDeg: 30 },
      // Valley Floor Turbo Climb Straight (Jump Ramp!)
      { x: 85, y: 15, z: 298, inwardBankDeg: 0 },
      // Turn 6: Tilted 22° 90° Uphill Climb Right back to Summit
      { x: 12, y: 25, z: 256, inwardBankDeg: 22 },
      { x: 0, y: 36, z: 162, inwardBankDeg: 16 },
    ],
    boostPads: [
      { t: 0.04, d: 0, length: 24, width: 6.4 },
      { t: 0.165, d: 0, length: 22, width: 6 },
      { t: 0.395, d: 0, length: 22, width: 6 },
      { t: 0.56, d: 0, length: 22, width: 6 },
      { t: 0.825, d: 0, length: 26, width: 6.8 },
      { t: 0.945, d: 0, length: 24, width: 6.4 },
    ],
    jumpRamps: [
      { tStart: 0.185, tEnd: 0.208, height: 4.2, widthRatio: 0.66 },
      { tStart: 0.845, tEnd: 0.868, height: 4.8, widthRatio: 0.68 },
    ],
    tunnelZones: [],
    coneClusters: [
      { t: 0.10, side: -1, count: 5 },
      { t: 0.33, side: -1, count: 6 },
      { t: 0.49, side: 1, count: 6 },
      { t: 0.64, side: -1, count: 5 },
      { t: 0.74, side: -1, count: 6 },
    ],
  },
];
