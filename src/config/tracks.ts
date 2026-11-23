import { TrackConfig } from '../types';

/** Helper to cleanly scale track XZ coordinates by modern highway factor while keeping elevation natural */
function scalePoints(
  pts: { x: number; y: number; z: number; inwardBankDeg?: number }[],
  xzScale: number,
  yScale = 1.15
) {
  return pts.map((p) => ({
    x: Math.round(p.x * xzScale),
    y: Math.round(p.y * yScale),
    z: Math.round(p.z * xzScale),
    inwardBankDeg: p.inwardBankDeg,
  }));
}

export const TRACK_CONFIGS: TrackConfig[] = [
  {
    id: 'neo-tokyo',
    name: 'TOKYO BAYSHORE EXPWY',
    nameZh: '东京湾岸高速',
    theme: 'city',
    difficulty: 'MEDIUM',
    description: '宽达 29m 的现代写实都市高架夜景，融合 90° 街区匝道、22° 倾斜高架弯与 30° 摩天楼大倾角 U 型碗弯。',
    roadWidth: 29,
    maxBankDeg: 30,
    laps: 3,
    skyTopHex: '#060c1a',
    skyMidHex: '#101d35',
    skyHorizonHex: '#33486b',
    sunColorHex: '#ffb067',
    fogColor: 0x0c1424,
    fogDensity: 0.00068,
    railLeftColor: 0x38bdf8,
    railRightColor: 0xf59e0b,
    accentColorHex: '#38bdf8',
    asphaltTint: '#1b1f27',
    points: scalePoints(
      [
        // Main Start/Finish Expressway Straight
        { x: 0, y: 0, z: 0, inwardBankDeg: 0 },
        { x: 0, y: 0, z: -200, inwardBankDeg: 0 },
        // Turn 1: Crisp Flat 90° Urban Interchange Right (6° bank -> crisp snap-drift!)
        { x: 14, y: 0, z: -278, inwardBankDeg: 6 },
        { x: 88, y: 2, z: -298, inwardBankDeg: 6 },
        // Bayshore East Sprint
        { x: 260, y: 8, z: -298, inwardBankDeg: 0 },
        // Turn 2: Tilted 90° Elevated Overpass Right (22° bank)
        { x: 348, y: 12, z: -282, inwardBankDeg: 22 },
        { x: 372, y: 16, z: -205, inwardBankDeg: 22 },
        // Elevated Skyline Straight (Jump Ramp #1)
        { x: 372, y: 23, z: -30, inwardBankDeg: 0 },
        { x: 372, y: 19, z: 105, inwardBankDeg: 0 },
        // Turn 3: Steep 30° Banked 180° Harbor Bowl U-Turn Right (sustained Mega-Drift!)
        { x: 362, y: 17, z: 192, inwardBankDeg: 30 },
        { x: 295, y: 15, z: 235, inwardBankDeg: 30 },
        { x: 228, y: 13, z: 182, inwardBankDeg: 28 },
        // Inner City Return Chute
        { x: 225, y: 11, z: 55, inwardBankDeg: 0 },
        // Turn 4 & 5: Technical 90° Left -> 90° Left Urban Double-Right-Angle S (8° & 18° bank)
        { x: 215, y: 9, z: -22, inwardBankDeg: 8 },
        { x: 145, y: 7, z: -52, inwardBankDeg: 8 },
        { x: 86, y: 6, z: -2, inwardBankDeg: 18 },
        { x: 96, y: 8, z: 95, inwardBankDeg: 12 },
        // Sunset Downhill Approach into Final Hairpin
        { x: 112, y: 12, z: 240, inwardBankDeg: 0 },
        // Turn 6: Downhill Sloped 180° Hairpin Right (24° bank!)
        { x: 112, y: 10, z: 332, inwardBankDeg: 24 },
        { x: 52, y: 5, z: 390, inwardBankDeg: 24 },
        { x: -10, y: 1, z: 325, inwardBankDeg: 18 },
        // Final Tunnel Turbo Straight to Start/Finish
        { x: 0, y: 0, z: 165, inwardBankDeg: 0 },
      ],
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.045, d: 0, length: 30, width: 7.5 },
      { t: 0.145, d: 0, length: 28, width: 7.2 },
      { t: 0.292, d: 0, length: 30, width: 7.5 },
      { t: 0.495, d: -3.0, length: 28, width: 7 },
      { t: 0.725, d: 3.0, length: 30, width: 7.2 },
      { t: 0.935, d: 0, length: 32, width: 8 },
    ],
    jumpRamps: [
      { tStart: 0.258, tEnd: 0.276, height: 3.8, widthRatio: 0.64 },
      { tStart: 0.865, tEnd: 0.883, height: 3.6, widthRatio: 0.62 },
    ],
    tunnelZones: [{ tStart: 0.905, tEnd: 0.968 }],
    coneClusters: [
      { t: 0.09, side: -1, count: 6 },
      { t: 0.21, side: -1, count: 6 },
      { t: 0.41, side: -1, count: 6 },
      { t: 0.56, side: 1, count: 6 },
      { t: 0.81, side: -1, count: 6 },
    ],
  },
  {
    id: 'hyperion-bay',
    name: 'HYPERION BAY BRIDGE',
    nameZh: '海湾跨海大桥',
    theme: 'bridge',
    difficulty: 'HARD',
    description: '黄金黄昏海湾上的 32m 超宽斜拉跨海大桥，包含 34° 赞德沃特式海面倾斜大 U 弯与铃鹿连续 S 弯。',
    roadWidth: 32,
    maxBankDeg: 34,
    laps: 3,
    skyTopHex: '#09152b',
    skyMidHex: '#1f365c',
    skyHorizonHex: '#e08b55',
    sunColorHex: '#ffd185',
    fogColor: 0x16243d,
    fogDensity: 0.00052,
    railLeftColor: 0x38bdf8,
    railRightColor: 0xfbbf24,
    accentColorHex: '#38bdf8',
    asphaltTint: '#1c222d',
    points: scalePoints(
      [
        // Main Twin-Pylon Suspension Bridge Launch Straight
        { x: 0, y: 14, z: 0, inwardBankDeg: 0 },
        { x: 0, y: 19, z: -275, inwardBankDeg: 0 },
        { x: 0, y: 28, z: -535, inwardBankDeg: 0 },
        // Turn 1: Zandvoort-Style 34° Extreme Banked 180° Ocean Bowl U-Turn Right!
        { x: 16, y: 26, z: -618, inwardBankDeg: 34 },
        { x: 64, y: 24, z: -678, inwardBankDeg: 34 },
        { x: 138, y: 21, z: -676, inwardBankDeg: 34 },
        { x: 186, y: 18, z: -614, inwardBankDeg: 32 },
        // Parallel Offshore Straight
        { x: 192, y: 14, z: -455, inwardBankDeg: 0 },
        // Turn 2: Tilted 90° Left onto Sea Causeway (22° bank)
        { x: 208, y: 12, z: -375, inwardBankDeg: 22 },
        { x: 295, y: 12, z: -362, inwardBankDeg: 20 },
        // Causeway Straight into Turn 3 (26° Banked 90° Right)
        { x: 425, y: 16, z: -362, inwardBankDeg: 0 },
        { x: 505, y: 20, z: -322, inwardBankDeg: 26 },
        { x: 515, y: 24, z: -232, inwardBankDeg: 26 },
        // Suzuka-Inspired Flowing S-Curves over the Dusk Sea
        { x: 455, y: 22, z: -115, inwardBankDeg: 18 },
        { x: 525, y: 16, z: 18, inwardBankDeg: 20 },
        // Turn 4: Steep 32° Banked 180° Southern Bay U-Turn Right!
        { x: 518, y: 12, z: 125, inwardBankDeg: 32 },
        { x: 468, y: 10, z: 196, inwardBankDeg: 32 },
        { x: 382, y: 10, z: 204, inwardBankDeg: 32 },
        { x: 318, y: 10, z: 162, inwardBankDeg: 26 },
        // Low Sea-Skimming Return Straight
        { x: 225, y: 11, z: 215, inwardBankDeg: 10 },
        { x: 100, y: 12, z: 225, inwardBankDeg: 0 },
        // Turn 5: Crisp 12° Banked 90° Right back onto Bridge
        { x: 16, y: 13, z: 208, inwardBankDeg: 12 },
        { x: 0, y: 14, z: 132, inwardBankDeg: 10 },
      ],
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.04, d: 0, length: 34, width: 8 },
      { t: 0.11, d: 0, length: 34, width: 8 },
      { t: 0.305, d: 0, length: 30, width: 7.4 },
      { t: 0.445, d: -3.0, length: 30, width: 7 },
      { t: 0.845, d: 0, length: 32, width: 7.6 },
    ],
    jumpRamps: [
      { tStart: 0.075, tEnd: 0.094, height: 4.2, widthRatio: 0.66 },
      { tStart: 0.395, tEnd: 0.414, height: 3.6, widthRatio: 0.62 },
    ],
    tunnelZones: [],
    coneClusters: [
      { t: 0.22, side: -1, count: 6 },
      { t: 0.36, side: 1, count: 6 },
      { t: 0.49, side: -1, count: 6 },
      { t: 0.72, side: -1, count: 6 },
      { t: 0.91, side: -1, count: 6 },
    ],
  },
  {
    id: 'sub-zero',
    name: 'SUB-ZERO EXPRESS TUNNEL',
    nameZh: '地下高速隧道',
    theme: 'tunnel',
    difficulty: 'HARD',
    description: '工业混凝土拱顶与通风涡扇构成的写实地下高速干线，包含 35° 卡鲁塞尔极限倾斜弯碗与 90° 地下交汇弯。',
    roadWidth: 26,
    maxBankDeg: 35,
    laps: 3,
    skyTopHex: '#070b14',
    skyMidHex: '#101828',
    skyHorizonHex: '#1e293b',
    sunColorHex: '#38bdf8',
    fogColor: 0x0b111c,
    fogDensity: 0.00095,
    railLeftColor: 0xf59e0b,
    railRightColor: 0x38bdf8,
    accentColorHex: '#f59e0b',
    asphaltTint: '#1a1e26',
    points: scalePoints(
      [
        // Start Bay Downhill Concrete Tunnel
        { x: 0, y: 0, z: 0, inwardBankDeg: 0 },
        { x: 0, y: -6, z: -205, inwardBankDeg: 0 },
        // Turn 1: Crisp 10° Banked 90° Left Bunker Turn
        { x: -16, y: -10, z: -282, inwardBankDeg: 10 },
        { x: -96, y: -13, z: -302, inwardBankDeg: 10 },
        // Deep Reactor Cavern West Straight
        { x: -265, y: -22, z: -302, inwardBankDeg: 0 },
        // Turn 2: Extreme 35° Karussell Banked 180° U-Turn Left!
        { x: -362, y: -26, z: -285, inwardBankDeg: 35 },
        { x: -412, y: -28, z: -208, inwardBankDeg: 35 },
        { x: -355, y: -25, z: -132, inwardBankDeg: 33 },
        // Cavern Floor East Boost Straight (Jump Ramp #1)
        { x: -195, y: -18, z: -125, inwardBankDeg: 0 },
        // Turn 3 & 4: Sharp 90° Right -> 90° Left Underground Chicane (8° bank!)
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
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.045, d: 0, length: 30, width: 7.0 },
      { t: 0.185, d: 0, length: 30, width: 6.8 },
      { t: 0.375, d: 0, length: 30, width: 7.0 },
      { t: 0.775, d: 0, length: 30, width: 7.2 },
      { t: 0.935, d: 0, length: 30, width: 7.0 },
    ],
    jumpRamps: [
      { tStart: 0.365, tEnd: 0.384, height: 3.6, widthRatio: 0.64 },
      { tStart: 0.755, tEnd: 0.774, height: 3.6, widthRatio: 0.62 },
    ],
    tunnelZones: [
      { tStart: 0.015, tEnd: 0.22 },
      { tStart: 0.46, tEnd: 0.68 },
      { tStart: 0.86, tEnd: 0.985 },
    ],
    coneClusters: [
      { t: 0.11, side: 1, count: 6 },
      { t: 0.30, side: 1, count: 6 },
      { t: 0.49, side: -1, count: 6 },
      { t: 0.57, side: 1, count: 6 },
      { t: 0.71, side: 1, count: 6 },
    ],
  },
  {
    id: 'akina-touge',
    name: 'AKINA MOUNTAIN PASS',
    nameZh: '秋名山盘山夜道',
    theme: 'mountain',
    difficulty: 'EXTREME',
    description: '真实起伏山脉、松林夜雾与暖黄钠灯勾勒的 27m 写实盘山赛道！连续 4 组不同倾角下坡发卡弯与 90° 悬崖折返。',
    roadWidth: 27,
    maxBankDeg: 34,
    laps: 3,
    skyTopHex: '#050a18',
    skyMidHex: '#101d34',
    skyHorizonHex: '#3b4a69',
    sunColorHex: '#ffba73',
    fogColor: 0x0d1526,
    fogDensity: 0.00062,
    railLeftColor: 0xf59e0b,
    railRightColor: 0xe2e8f0,
    accentColorHex: '#f59e0b',
    asphaltTint: '#1a1d24',
    points: scalePoints(
      [
        // Mountain Summit Start Straight (55m elevation!)
        { x: 0, y: 48, z: 0, inwardBankDeg: 0 },
        { x: 0, y: 48, z: -190, inwardBankDeg: 0 },
        // Turn 1: Tilted 24° 90° Summit Cliffside Corner Right
        { x: 16, y: 48, z: -265, inwardBankDeg: 24 },
        { x: 96, y: 46, z: -282, inwardBankDeg: 24 },
        // Laguna Seca Corkscrew Crest & Steep Plunge!
        { x: 225, y: 45, z: -282, inwardBankDeg: 0 },
        { x: 315, y: 38, z: -240, inwardBankDeg: 18 },
        { x: 360, y: 27, z: -150, inwardBankDeg: 20 },
        // HAIRPIN #1: Steep 32° Banked Downhill 180° U-Turn Right!
        { x: 398, y: 23, z: -78, inwardBankDeg: 32 },
        { x: 342, y: 19, z: -12, inwardBankDeg: 32 },
        { x: 255, y: 17, z: -48, inwardBankDeg: 28 },
        // Switchback Chute West
        { x: 155, y: 15, z: -55, inwardBankDeg: 0 },
        // HAIRPIN #2: Moderate 16° Banked Downhill 180° U-Turn Left!
        { x: 82, y: 13, z: -32, inwardBankDeg: 16 },
        { x: 75, y: 9, z: 45, inwardBankDeg: 16 },
        { x: 150, y: 7, z: 85, inwardBankDeg: 14 },
        // Switchback Chute East
        { x: 295, y: 6, z: 90, inwardBankDeg: 0 },
        // HAIRPIN #3: Crisp Flat 7° 90° Mountain Switchback Right!
        { x: 375, y: 5, z: 112, inwardBankDeg: 7 },
        { x: 390, y: 4, z: 190, inwardBankDeg: 7 },
        // HAIRPIN #4: Extreme 34° Mega-Banked Slingshot 180° U-Turn Bowl Right!
        { x: 378, y: 4, z: 262, inwardBankDeg: 34 },
        { x: 328, y: 4, z: 326, inwardBankDeg: 34 },
        { x: 248, y: 5, z: 326, inwardBankDeg: 34 },
        { x: 196, y: 7, z: 282, inwardBankDeg: 30 },
        // Valley Floor Turbo Climb Straight
        { x: 85, y: 15, z: 298, inwardBankDeg: 0 },
        // Turn 6: Tilted 22° 90° Uphill Climb Right back to Summit
        { x: 12, y: 25, z: 256, inwardBankDeg: 22 },
        { x: 0, y: 36, z: 162, inwardBankDeg: 16 },
      ],
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.04, d: 0, length: 30, width: 7.2 },
      { t: 0.175, d: 0, length: 28, width: 6.8 },
      { t: 0.395, d: 0, length: 28, width: 6.8 },
      { t: 0.56, d: 0, length: 28, width: 6.8 },
      { t: 0.958, d: 0, length: 30, width: 7.2 },
    ],
    jumpRamps: [
      { tStart: 0.145, tEnd: 0.162, height: 3.4, widthRatio: 0.62 },
      { tStart: 0.925, tEnd: 0.943, height: 3.6, widthRatio: 0.64 },
    ],
    tunnelZones: [],
    coneClusters: [
      { t: 0.10, side: -1, count: 6 },
      { t: 0.33, side: -1, count: 6 },
      { t: 0.49, side: 1, count: 6 },
      { t: 0.64, side: -1, count: 6 },
      { t: 0.74, side: -1, count: 6 },
    ],
  },
];
