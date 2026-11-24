import { TrackConfig } from '../types';
import { ISLE_OF_MAN_TRACK } from './isleOfManTrack';
import { NUJIANG_72_TRACK } from './nujiangTrack';

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
  {
    id: 'monaco-harbor',
    name: 'MONACO HARBOR GP',
    nameZh: '摩纳哥海滨赛道',
    theme: 'city',
    difficulty: 'HARD',
    description: '专精小倾角技术漂移的 28m 写实海滨街道赛！包含 5 组 4°–11° 低倾角平直 U 型发卡弯与海港短隧道，体验精准控速与出弯快喷节奏。',
    roadWidth: 28,
    maxBankDeg: 11,
    laps: 3,
    skyTopHex: '#071228',
    skyMidHex: '#152d52',
    skyHorizonHex: '#b87458',
    sunColorHex: '#ffc58f',
    fogColor: 0x0d1b30,
    fogDensity: 0.00058,
    railLeftColor: 0x10b981,
    railRightColor: 0xf59e0b,
    accentColorHex: '#10b981',
    asphaltTint: '#1c212b',
    points: scalePoints(
      [
        // Start/Finish Harbor Boulevard Straight
        { x: 0, y: 6, z: 0, inwardBankDeg: 0 },
        { x: 0, y: 6, z: -185, inwardBankDeg: 0 },
        // U-Turn #1: Sainte-Dévote Flat 4° Low-Bank 180° Hairpin Right!
        { x: 12, y: 8, z: -265, inwardBankDeg: 4 },
        { x: 75, y: 11, z: -318, inwardBankDeg: 4 },
        { x: 142, y: 14, z: -272, inwardBankDeg: 4 },
        // Beau Rivage Coastal Sprint South
        { x: 152, y: 16, z: -165, inwardBankDeg: 0 },
        // U-Turn #2: Fairmont Iconic 6° Low-Bank 180° Hairpin Left!
        { x: 162, y: 16, z: -85, inwardBankDeg: 6 },
        { x: 225, y: 14, z: -32, inwardBankDeg: 6 },
        { x: 295, y: 12, z: -78, inwardBankDeg: 6 },
        // Casino Terrace North Straight (Jump Ramp #1)
        { x: 312, y: 12, z: -195, inwardBankDeg: 0 },
        { x: 312, y: 14, z: -320, inwardBankDeg: 0 },
        // U-Turn #3: Mirabeau 8° Low-Bank Sweeping 180° Hairpin Right!
        { x: 326, y: 14, z: -400, inwardBankDeg: 8 },
        { x: 392, y: 12, z: -452, inwardBankDeg: 8 },
        { x: 460, y: 10, z: -396, inwardBankDeg: 8 },
        // Port Hercules Waterfront Straight South (Louis II Harbor Tunnel!)
        { x: 472, y: 8, z: -210, inwardBankDeg: 0 },
        { x: 472, y: 7, z: 10, inwardBankDeg: 0 },
        // U-Turn #4: Tabac 10° Low-Bank Coastal 180° Hairpin Right!
        { x: 462, y: 7, z: 98, inwardBankDeg: 10 },
        { x: 398, y: 7, z: 156, inwardBankDeg: 10 },
        { x: 328, y: 7, z: 108, inwardBankDeg: 10 },
        // Smooth Low-Bank Harbor S-Bend West (6°–8° bank!)
        { x: 296, y: 8, z: 56, inwardBankDeg: 6 },
        { x: 222, y: 8, z: 88, inwardBankDeg: 6 },
        { x: 184, y: 7, z: 176, inwardBankDeg: 8 },
        // U-Turn #5: La Rascasse 11° Final Low-Bank 180° Hairpin Right!
        { x: 122, y: 6, z: 246, inwardBankDeg: 11 },
        { x: 40, y: 6, z: 236, inwardBankDeg: 11 },
        { x: 0, y: 6, z: 152, inwardBankDeg: 8 },
      ],
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.035, d: 0, length: 28, width: 7.2 },
      { t: 0.30, d: 0, length: 28, width: 7.2 },
      { t: 0.565, d: 0, length: 30, width: 7.5 },
      { t: 0.945, d: 0, length: 30, width: 7.4 },
    ],
    jumpRamps: [
      { tStart: 0.328, tEnd: 0.345, height: 3.4, widthRatio: 0.62 },
    ],
    tunnelZones: [{ tStart: 0.50, tEnd: 0.56 }],
    coneClusters: [
      { t: 0.09, side: -1, count: 6 },
      { t: 0.22, side: 1, count: 6 },
      { t: 0.42, side: -1, count: 6 },
      { t: 0.65, side: -1, count: 6 },
      { t: 0.86, side: -1, count: 6 },
    ],
  },
  {
    id: 'apex-island',
    name: 'APEX GRAND ISLAND',
    nameZh: '极境环岛大满贯',
    theme: 'island',
    difficulty: 'GRAND',
    description:
      '全长超 11km 的集大成环岛终极赛道！一条公路串起海港都市、跨海悬索大桥、34° 海洋大碗弯、76m 火山松林连续发卡弯、穿山弧形隧道、灯塔 5°–9° 低倾角发卡弯与铃鹿连续 S 弯。',
    roadWidth: 29,
    maxBankDeg: 34,
    laps: 2,
    skyTopHex: '#07142b',
    skyMidHex: '#18365e',
    skyHorizonHex: '#e88b5a',
    sunColorHex: '#ffd080',
    fogColor: 0x11223a,
    fogDensity: 0.00036,
    railLeftColor: 0x22d3ee,
    railRightColor: 0xfbbf24,
    accentColorHex: '#38f9d7',
    asphaltTint: '#1b2029',
    points: scalePoints(
      [
        // === SECTOR 1: West Harbor Metropolis (Start/Finish Waterfront Straight -> Urban 90° Chicane) ===
        { x: 0, y: 14, z: 0, inwardBankDeg: 0 },
        { x: 0, y: 14, z: -235, inwardBankDeg: 0 },
        // Turn 1: Crisp 7° Flat Urban 90° Right -> 9° 90° Left Harbor Interchange
        { x: 24, y: 14, z: -325, inwardBankDeg: 7 },
        { x: 118, y: 15, z: -355, inwardBankDeg: 8 },
        { x: 205, y: 16, z: -390, inwardBankDeg: 9 },
        { x: 225, y: 18, z: -485, inwardBankDeg: 8 },

        // === SECTOR 2: North Strait Cable-Stayed Suspension Bridge & 34° Zandvoort Ocean Bowl ===
        // Colossal Twin-Pylon Cross-Bay Suspension Bridge Straight (y=18 -> 34, full-throttle 430+ km/h!)
        { x: 225, y: 26, z: -725, inwardBankDeg: 0 },
        { x: 225, y: 34, z: -965, inwardBankDeg: 0 },
        // Turn 2: 34° Extreme Zandvoort Banked 180° Ocean Bowl Sweeper Right!
        { x: 248, y: 33, z: -1070, inwardBankDeg: 34 },
        { x: 350, y: 31, z: -1135, inwardBankDeg: 34 },
        { x: 472, y: 29, z: -1112, inwardBankDeg: 34 },
        { x: 548, y: 27, z: -1022, inwardBankDeg: 30 },
        // High-Speed Coastal Causeway Sweeper East (Breathing Space & Flow State)
        { x: 645, y: 26, z: -915, inwardBankDeg: 14 },
        { x: 805, y: 30, z: -875, inwardBankDeg: 16 },
        { x: 965, y: 38, z: -855, inwardBankDeg: 12 },

        // === SECTOR 3: Northeast Volcanic Mountain Pass, Blind Crest & Cliffside Switchbacks ===
        // Turn 3: 24° Summit Approach Corner Right (climbing to 76m summit!)
        { x: 1105, y: 50, z: -815, inwardBankDeg: 22 },
        { x: 1205, y: 60, z: -725, inwardBankDeg: 24 },
        { x: 1235, y: 66, z: -595, inwardBankDeg: 18 },
        // Summit Overlook Straight & Laguna-Seca Style Blind Crest Downhill Plunge!
        { x: 1275, y: 66, z: -445, inwardBankDeg: 0 },
        { x: 1365, y: 55, z: -335, inwardBankDeg: 18 },
        // Turn 4: 30° Banked Volcanic Cliffside 180° Hairpin Right!
        { x: 1475, y: 44, z: -285, inwardBankDeg: 30 },
        { x: 1545, y: 38, z: -185, inwardBankDeg: 30 },
        { x: 1475, y: 34, z: -90, inwardBankDeg: 28 },
        // Mountain Mid-Chute West
        { x: 1325, y: 31, z: -72, inwardBankDeg: 0 },
        // Turn 5: 18° Technical Mountain Touge 180° Hairpin Left!
        { x: 1225, y: 28, z: -38, inwardBankDeg: 18 },
        { x: 1212, y: 25, z: 65, inwardBankDeg: 18 },
        { x: 1305, y: 23, z: 132, inwardBankDeg: 16 },
        // Cliffside Sprint into Volcanic Express Tunnel Mouth
        { x: 1465, y: 22, z: 148, inwardBankDeg: 0 },
        { x: 1575, y: 21, z: 218, inwardBankDeg: 14 },

        // === SECTOR 4: East Cape Volcanic Arch Express Tunnel & 33° Underground Karussell ===
        // Long Vaulted Concrete Arch Tunnel Straight + 33° Karussell Bowl (y=20..22, safely high above sea!)
        { x: 1605, y: 20, z: 365, inwardBankDeg: 0 },
        { x: 1605, y: 20, z: 565, inwardBankDeg: 0 },
        // Turn 6: 33° Karussell Banked 180° Tunnel-Exit Sweeper Right!
        { x: 1578, y: 20, z: 685, inwardBankDeg: 33 },
        { x: 1478, y: 19, z: 775, inwardBankDeg: 33 },
        { x: 1352, y: 18, z: 745, inwardBankDeg: 32 },
        { x: 1285, y: 17, z: 645, inwardBankDeg: 26 },
        // Tunnel Exit Daylight Burst Straight North-West
        { x: 1255, y: 16, z: 505, inwardBankDeg: 0 },

        // === SECTOR 5: Southeast Riviera Low-Bank Technical Hairpins & Lighthouse Peninsula ===
        // Turn 7: Monaco-Style 5° Flat-Bank 90° Left -> Crisp 6° Tight U-Turn Left -> 9° Lighthouse Hairpin Right!
        { x: 1212, y: 15, z: 408, inwardBankDeg: 5 },
        { x: 1118, y: 15, z: 378, inwardBankDeg: 5 },
        { x: 995, y: 15, z: 418, inwardBankDeg: 0 },
        // Turn 8: 6° Low-Bank Tight Coastal 180° Hairpin Left (Monaco Fairmont technical precision!)
        { x: 912, y: 15, z: 472, inwardBankDeg: 6 },
        { x: 918, y: 15, z: 562, inwardBankDeg: 6 },
        { x: 1008, y: 15, z: 625, inwardBankDeg: 6 },
        // Turn 9: 9° Low-Bank Lighthouse Peninsula Tight 180° Hairpin Right!
        { x: 1052, y: 15, z: 735, inwardBankDeg: 9 },
        { x: 978, y: 15, z: 838, inwardBankDeg: 9 },
        { x: 868, y: 15, z: 818, inwardBankDeg: 8 },

        // === SECTOR 6: South Coast Suzuka Flowing S-Curves, Bay Inlet Jump & Grand Harbor Finale ===
        // Turn 10: Rapid Suzuka-Style Flowing S-Curves (Left -> Right -> Left, 15°-18° bank!)
        { x: 715, y: 15, z: 762, inwardBankDeg: 15 },
        { x: 565, y: 16, z: 878, inwardBankDeg: 18 },
        { x: 405, y: 16, z: 780, inwardBankDeg: 16 },
        { x: 258, y: 15, z: 856, inwardBankDeg: 14 },
        // Turn 11: 28° Banked Southwest Cape Sweeper Right (launching onto West Bay Return Expressway!)
        { x: 132, y: 16, z: 818, inwardBankDeg: 28 },
        { x: 75, y: 17, z: 702, inwardBankDeg: 28 },
        { x: 122, y: 18, z: 572, inwardBankDeg: 22 },
        // West Bay Coastal Turbo Chute (Jump Ramp #3 across Marina Inlet -> Final Technical Corner!)
        { x: 138, y: 18, z: 415, inwardBankDeg: 0 },
        // Turn 12: Final 11° Low-Bank Harbor Chicane Left -> Right onto Main Straight
        { x: 105, y: 16, z: 305, inwardBankDeg: 11 },
        { x: 18, y: 15, z: 252, inwardBankDeg: 11 },
        // Final Grand Harbor Express Straight (Harbor Tunnel #2 + Twin Boost Pads to Finish Line!)
        { x: 0, y: 14, z: 155, inwardBankDeg: 0 },
      ],
      1.55,
      1.15
    ),
    boostPads: [
      { t: 0.012, d: 0, length: 34, width: 8.0 },
      { t: 0.098, d: 0, length: 36, width: 8.2 },
      { t: 0.136, d: 0, length: 36, width: 8.2 },
      { t: 0.245, d: 0, length: 32, width: 7.6 },
      { t: 0.342, d: 0, length: 32, width: 7.4 },
      { t: 0.426, d: 0, length: 30, width: 7.4 },
      { t: 0.535, d: 0, length: 34, width: 7.8 },
      { t: 0.635, d: 0, length: 32, width: 7.6 },
      { t: 0.785, d: 0, length: 30, width: 7.4 },
      { t: 0.872, d: 0, length: 32, width: 7.6 },
      { t: 0.938, d: 0, length: 32, width: 7.6 },
      { t: 0.986, d: 0, length: 36, width: 8.2 },
    ],
    jumpRamps: [
      { tStart: 0.115, tEnd: 0.121, height: 4.3, widthRatio: 0.66 },
      { tStart: 0.324, tEnd: 0.330, height: 3.7, widthRatio: 0.62 },
      { tStart: 0.922, tEnd: 0.928, height: 3.9, widthRatio: 0.64 },
    ],
    tunnelZones: [
      { tStart: 0.515, tEnd: 0.622 },
      { tStart: 0.972, tEnd: 0.990 },
    ],
    coneClusters: [
      { t: 0.040, side: -1, count: 6 },
      { t: 0.165, side: -1, count: 6 },
      { t: 0.295, side: -1, count: 6 },
      { t: 0.382, side: -1, count: 6 },
      { t: 0.440, side: 1, count: 6 },
      { t: 0.652, side: 1, count: 6 },
      { t: 0.732, side: -1, count: 6 },
      { t: 0.800, side: 1, count: 6 },
      { t: 0.840, side: -1, count: 6 },
      { t: 0.952, side: 1, count: 6 },
    ],
  },
  ISLE_OF_MAN_TRACK,
  NUJIANG_72_TRACK,
];
