import { ControlPointDef, TrackConfig } from '../types';

/**
 * Generates a mathematically exact, crease-free 180° semicircular hairpin arc (5 evenly spaced points).
 * - Moving +X at z=zEntry turning toward -Z (exit heading -X at zEntry - 2*R):
 *     cx, cz = zEntry - R, entryAngle = +PI/2, turnSign = -1
 * - Moving -X at z=zEntry turning toward -Z (exit heading +X at zEntry - 2*R):
 *     cx, cz = zEntry - R, entryAngle = +PI/2, turnSign = +1
 * - Moving +X at z=zEntry turning toward +Z (exit heading -X at zEntry + 2*R):
 *     cx, cz = zEntry + R, entryAngle = -PI/2, turnSign = +1
 * - Moving -X at z=zEntry turning toward +Z (exit heading +X at zEntry + 2*R):
 *     cx, cz = zEntry + R, entryAngle = -PI/2, turnSign = -1
 */
function makeHairpin(
  cx: number,
  cz: number,
  radius: number,
  entryAngleRad: number,
  turnSign: 1 | -1,
  yStart: number,
  yEnd: number,
  bankDeg: number
): ControlPointDef[] {
  const pts: ControlPointDef[] = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const ang = entryAngleRad + turnSign * Math.PI * u;
    pts.push({
      x: Math.round(cx + Math.cos(ang) * radius),
      y: Math.round(yStart + (yEnd - yStart) * u),
      z: Math.round(cz + Math.sin(ang) * radius),
      inwardBankDeg: bankDeg,
    });
  }
  return pts;
}

/**
 * 怒江 72 拐 // G318 YELA MOUNTAIN 72 BENDS (Baxoi, Tibet):
 * - Dedicated technical hairpin-drift touge! Compact 24m cliffside mountain highway with ZERO boring long straights.
 * - Starts at the 4,658m Yela Mountain Pass Overlook (Y = 172m) draped in Tibetan prayer flags & white Chorten stupa.
 * - Sector 1 (The Legendary Stacked Cliff Descent): 6 consecutive, stacked Z-zigzag 180° hairpins (R = 56m)
 *   cascading down the sheer ochre Hengduan cliff wall (Y = 172m -> 46m), letting drivers look right down over
 *   multiple tiers of winding mountain switchbacks below!
 * - Sector 2 (Nujiang River Gorge): Rapid canyon S-bends plunging to the roaring emerald Nujiang River (Y = 18m),
 *   crossing the red-steel Nujiang Gorge Bridge and cutting through a short rock-hewn G318 mountain tunnel.
 * - Sector 3 (Bangda West-Wall Switchback Climb): 5 tight uphill 180° hairpins & rapid summit switchbacks climbing
 *   154m cleanly back to the Yela Mountain Pass summit finish!
 * - Total: 15+ tight bends (R = 48–62m, ~2× sharper than highway maps) in ~6.9 km with authentic 7°–15° mountain
 *   banking — pure non-stop sideways drift heaven!
 */
export const NUJIANG_72_TRACK: TrackConfig = {
  id: 'nujiang-72',
  name: 'NUJIANG 72 BENDS // G318',
  nameZh: '怒江 72 拐盘山天路',
  theme: 'nujiang',
  difficulty: 'EXTREME',
  description:
    '致敬川藏线 G318 传奇业拉山怒江 72 拐！专为极致连续漂移打造的 24m 高原悬崖天路：154m 垂直落差、6 连层叠“之”字下坡发卡弯、怒江峡谷大桥与穿山石洞、5 连上坡回头弯，全程 15 组紧密急弯几乎无长直道！',
  roadWidth: 24,
  maxBankDeg: 18,
  laps: 2,
  // Crystalline Tibetan plateau cobalt afternoon sky + sunlit golden horizon
  skyTopHex: '#0a2254',
  skyMidHex: '#1f5498',
  skyHorizonHex: '#eab984',
  sunColorHex: '#fff0c2',
  fogColor: 0x263954,
  fogDensity: 0.00026,
  railLeftColor: 0xf59e0b,
  railRightColor: 0xe2e8f0,
  accentColorHex: '#f97316',
  asphaltTint: '#282c36',
  points: [
    // === SECTOR 0: Yela Mountain Pass Summit Start/Finish (业拉山垭口观景台, Y=172m) ===
    { x: 0, y: 172, z: 0, inwardBankDeg: 0 },
    { x: 0, y: 172, z: -135, inwardBankDeg: 0 },

    // Corner 1: Crisp 90° Right Summit Turn onto the sheer ochre cliff wall (Y=172 -> 166)
    { x: 18, y: 171, z: -198, inwardBankDeg: 10 },
    { x: 74, y: 168, z: -228, inwardBankDeg: 10 },
    { x: 200, y: 164, z: -228, inwardBankDeg: 0 },

    // === SECTOR 1: 6 STACKED Z-ZIGZAG CLIFF HAIRPINS (East <-> West, stepping -114m in Z & -20m in Y per tier!) ===
    // HAIRPIN #1 (East edge, 180° Left turning North from +X to -X, R=57m, z: -228 -> -342, Y=160 -> 148)
    ...makeHairpin(330, -285, 57, Math.PI / 2, -1, 160, 148, 10),
    { x: 215, y: 144, z: -342, inwardBankDeg: 0 },

    // HAIRPIN #2 (West edge, 180° Right turning North from -X to +X, R=57m, z: -342 -> -456, Y=140 -> 128)
    ...makeHairpin(105, -399, 57, Math.PI / 2, 1, 140, 128, 8),
    { x: 225, y: 124, z: -456, inwardBankDeg: 0 },

    // HAIRPIN #3 (East edge, 180° Left, R=57m, z: -456 -> -570, Y=120 -> 108)
    ...makeHairpin(345, -513, 57, Math.PI / 2, -1, 120, 108, 12),
    { x: 225, y: 104, z: -570, inwardBankDeg: 0 },

    // HAIRPIN #4 (West edge, 180° Right, R=57m, z: -570 -> -684, 7° flat technical bend, Y=100 -> 88)
    ...makeHairpin(115, -627, 57, Math.PI / 2, 1, 100, 88, 7),
    { x: 235, y: 84, z: -684, inwardBankDeg: 0 },

    // HAIRPIN #5 (East edge, 180° Left, R=57m, Tongni Village Overlook, z: -684 -> -798, Y=80 -> 68)
    ...makeHairpin(360, -741, 57, Math.PI / 2, -1, 80, 68, 14),
    { x: 235, y: 64, z: -798, inwardBankDeg: 0 },

    // HAIRPIN #6 (West edge, 180° Right, R=57m, z: -798 -> -912, Y=60 -> 48)
    ...makeHairpin(125, -855, 57, Math.PI / 2, 1, 60, 48, 9),
    { x: 265, y: 42, z: -912, inwardBankDeg: 0 },

    // HAIRPIN #7 (East plunge into Nujiang Gorge, 180° Left, R=58m, z: -912 -> -1028, Y=38 -> 26)
    ...makeHairpin(375, -970, 58, Math.PI / 2, -1, 38, 26, 12),

    // === SECTOR 2: NUJIANG RIVER GORGE S-CHICANE, STEEL BRIDGE & ROCK TUNNEL (Y=24m -> 18m -> 38m) ===
    { x: 245, y: 23, z: -1034, inwardBankDeg: 9 },
    { x: 145, y: 20, z: -1096, inwardBankDeg: 11 },
    { x: 45, y: 18, z: -1124, inwardBankDeg: 8 },
    // Nujiang River Steel Gorge Bridge crossing West across the emerald canyon rapids (Y = 18m)
    { x: -120, y: 18, z: -1126, inwardBankDeg: 0 },
    { x: -315, y: 18, z: -1126, inwardBankDeg: 0 },

    // HAIRPIN #8 (West Riverbank 180° Right turning South from -X to +X, R=58m, z: -1126 -> -1010, Y=19 -> 28)
    ...makeHairpin(-425, -1068, 58, -Math.PI / 2, -1, 19, 28, 13),
    // Rock-Cut G318 Canyon Tunnel climbing East out of the gorge
    { x: -305, y: 34, z: -1010, inwardBankDeg: 0 },

    // === SECTOR 3: BANGDA WEST-WALL SWITCHBACK CLIMB BACK TO YELA PASS (4 STACKED UPHILL HAIRPINS, Y=40m -> 172m) ===
    // HAIRPIN #9 (Inner West wall, 180° Right turning South from +X to -X, R=57m, z: -1010 -> -896, Y=39 -> 51)
    ...makeHairpin(-195, -953, 57, -Math.PI / 2, 1, 39, 51, 13),
    { x: -315, y: 56, z: -896, inwardBankDeg: 0 },

    // HAIRPIN #10 (Outer West cliff, 180° Left turning South from -X to +X, R=57m, z: -896 -> -782, Y=62 -> 74)
    ...makeHairpin(-435, -839, 57, -Math.PI / 2, -1, 62, 74, 12),
    { x: -315, y: 79, z: -782, inwardBankDeg: 0 },

    // HAIRPIN #11 (Inner West wall, 180° Right, R=57m, z: -782 -> -668, Y=85 -> 97)
    ...makeHairpin(-195, -725, 57, -Math.PI / 2, 1, 85, 97, 14),
    { x: -315, y: 103, z: -668, inwardBankDeg: 0 },

    // HAIRPIN #12 (Outer West cliff, 180° Left, R=57m, z: -668 -> -554, Y=109 -> 121)
    ...makeHairpin(-435, -611, 57, -Math.PI / 2, -1, 109, 121, 11),
    { x: -315, y: 127, z: -554, inwardBankDeg: 0 },

    // HAIRPIN #13 (High-Altitude Ridge 180° Right, R=57m, z: -554 -> -440, Y=133 -> 144)
    ...makeHairpin(-195, -497, 57, -Math.PI / 2, 1, 133, 144, 13),
    { x: -315, y: 149, z: -440, inwardBankDeg: 0 },

    // High-Ridge Rapid Drift S-Curve & Final Summit 180° Switchback back to Yela Pass Overlook (Y=154 -> 172m)
    { x: -395, y: 155, z: -395, inwardBankDeg: 11 },
    { x: -405, y: 161, z: -285, inwardBankDeg: 12 },
    { x: -315, y: 166, z: -205, inwardBankDeg: 12 },
    { x: -240, y: 170, z: -110, inwardBankDeg: 10 },
    // Final crisp 180° Summit Bend back onto Yela Pass Start/Finish Straight!
    { x: -222, y: 172, z: 12, inwardBankDeg: 12 },
    { x: -162, y: 172, z: 96, inwardBankDeg: 12 },
    { x: -64, y: 172, z: 108, inwardBankDeg: 11 },
    { x: -4, y: 172, z: 58, inwardBankDeg: 6 },
  ],
  boostPads: [
    { t: 0.012, d: 0, length: 22, width: 6.2 },
    { t: 0.140, d: 0, length: 22, width: 6.2 },
    { t: 0.275, d: 0, length: 22, width: 6.2 },
    { t: 0.405, d: 0, length: 22, width: 6.2 },
    { t: 0.506, d: 0, length: 26, width: 6.8 }, // Nujiang Gorge Steel Bridge sprint!
    { t: 0.720, d: 0, length: 22, width: 6.2 },
    { t: 0.855, d: 0, length: 22, width: 6.2 },
  ],
  jumpRamps: [],
  tunnelZones: [{ tStart: 0.576, tEnd: 0.603 }], // Short ~200m rock-cut G318 mountain tunnel cleanly between Hairpins #8 and #9!
  coneClusters: [
    { t: 0.07, side: -1, count: 5 },
    { t: 0.20, side: 1, count: 5 },
    { t: 0.34, side: -1, count: 5 },
    { t: 0.47, side: 1, count: 5 },
    { t: 0.67, side: -1, count: 5 },
    { t: 0.80, side: 1, count: 5 },
    { t: 0.94, side: -1, count: 5 },
  ],
};
