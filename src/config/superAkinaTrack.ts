import { ControlPointDef, TrackConfig } from '../types';

/**
 * Generates a mathematically C²-continuous Serpentine S-Curve Drift Ribbon advancing along `dirAngle`
 * (0 = +X, +PI/2 = +Z, -PI/2 = -Z, PI = -X).
 * - Entry half-arch uses `L_lead = halfWaveLen / sqrt(2)` with `0.5 * A * (1 - cos(PI * u))`, so at the
 *   peak join `f`, `f'`, AND `f''` match the full cosine bends IDENTICALLY (`-A * (PI / L)^2`) ->
 *   ZERO curvature spikes, ZERO entry/exit kinks, and uniform sweeping drift radius across every bend!
 * - `numPeaks` alternating apex bends (`L -> R -> L -> R ...`), returning cleanly to `lat = 0, tangent = dirAngle`.
 */
function makeSerpentine(opts: {
  startX: number;
  startZ: number;
  dirAngle: number;
  numPeaks: number;       // total alternating L/R apex bends (e.g. 6, 8, 10, 12)
  halfWaveLen: number;    // axial meters from one peak to the opposite peak (220..310m)
  amplitude: number;      // lateral swing amplitude in meters (92..118m)
  firstSide: 1 | -1;      // +1 swings right first, -1 swings left first
  yStart: number;
  yEnd: number;
  bankDeg: number;
  stepsPerHalfWave?: number;
}): { pts: ControlPointDef[]; endX: number; endZ: number; totalAxis: number } {
  const {
    startX,
    startZ,
    dirAngle,
    numPeaks,
    halfWaveLen,
    amplitude,
    firstSide,
    yStart,
    yEnd,
    bankDeg,
    stepsPerHalfWave = 5,
  } = opts;

  const fx = Math.cos(dirAngle);
  const fz = Math.sin(dirAngle);
  const rx = -fz;
  const rz = fx;

  const leadLen = halfWaveLen / Math.SQRT2; // Exact C² curvature-matching lead-in/out length!
  const midAxis = Math.max(0, numPeaks - 1) * halfWaveLen;
  const totalAxis = leadLen * 2 + midAxis;

  const pts: ControlPointDef[] = [];
  const leadSteps = Math.max(3, Math.round(stepsPerHalfWave * 0.8));

  const pushPt = (along: number, lat: number, apexWeight: number) => {
    const uTotal = along / totalAxis;
    const localBank = apexWeight > 0.25 ? Math.round(bankDeg * Math.min(1, apexWeight * 1.15)) : 0;
    pts.push({
      x: Math.round(startX + fx * along + rx * lat),
      y: Math.round(yStart + (yEnd - yStart) * uTotal),
      z: Math.round(startZ + fz * along + rz * lat),
      inwardBankDeg: localBank,
    });
  };

  // 1. C²-matched Lead-in from lat=0 (tangent=0) -> Peak #1 (lat = firstSide * A, tangent=0)
  for (let i = 1; i <= leadSteps; i++) {
    const u = i / leadSteps;
    const along = u * leadLen;
    const lat = firstSide * amplitude * 0.5 * (1 - Math.cos(Math.PI * u));
    const apexWeight = Math.max(0, -Math.cos(Math.PI * u));
    pushPt(along, lat, apexWeight);
  }

  // 2. Alternating Full Cosine Bends from Peak #k -> Peak #(k+1)
  for (let k = 0; k < numPeaks - 1; k++) {
    const side = k % 2 === 0 ? firstSide : -firstSide;
    const baseAlong = leadLen + k * halfWaveLen;
    for (let i = 1; i <= stepsPerHalfWave; i++) {
      const u = i / stepsPerHalfWave;
      const along = baseAlong + u * halfWaveLen;
      const c = Math.cos(Math.PI * u);
      const lat = side * amplitude * c;
      const apexWeight = Math.abs(c);
      pushPt(along, lat, apexWeight);
    }
  }

  // 3. C²-matched Lead-out from Final Peak -> lat=0 (tangent=0)
  const endSide = (numPeaks - 1) % 2 === 0 ? firstSide : -firstSide;
  const exitBase = leadLen + midAxis;
  for (let i = 1; i <= leadSteps; i++) {
    const u = i / leadSteps;
    const along = exitBase + u * leadLen;
    const lat = endSide * amplitude * 0.5 * (1 + Math.cos(Math.PI * u));
    const apexWeight = Math.max(0, Math.cos(Math.PI * u));
    pushPt(along, lat, apexWeight);
  }

  return {
    pts,
    endX: Math.round(startX + fx * totalAxis),
    endZ: Math.round(startZ + fz * totalAxis),
    totalAxis,
  };
}

/** Smooth 4-step 90° quarter-circle corner connecting two orthogonal corridors cleanly */
function makeQuarterTurn(
  cx: number,
  cz: number,
  radius: number,
  startAngleRad: number,
  turnSign: 1 | -1,
  yStart: number,
  yEnd: number,
  bankDeg: number
): ControlPointDef[] {
  const pts: ControlPointDef[] = [];
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const ang = startAngleRad + turnSign * (Math.PI * 0.5) * u;
    pts.push({
      x: Math.round(cx + Math.cos(ang) * radius),
      y: Math.round(yStart + (yEnd - yStart) * u),
      z: Math.round(cz + Math.sin(ang) * radius),
      inwardBankDeg: i === steps ? Math.round(bankDeg * 0.4) : bankDeg,
    });
  }
  return pts;
}

/** Smooth 5-point 180° semicircular hairpin (zero kinks on tight stacked touge switchbacks) */
function makeHairpin180(
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

/** Generates evenly-spaced ruler-straight highway control points (zero Catmull-Rom sag) */
function makeStraight(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  segments: number
): ControlPointDef[] {
  const pts: ControlPointDef[] = [];
  for (let i = 1; i <= segments; i++) {
    const u = i / segments;
    pts.push({
      x: Math.round(x0 + (x1 - x0) * u),
      y: Math.round(y0 + (y1 - y0) * u),
      z: Math.round(z0 + (z1 - z0) * u),
      inwardBankDeg: 0,
    });
  }
  return pts;
}

// Build parametric serpentine ribbons with exact chained endpoint coordinates (zero duplicate/pinched control points!)
// Sector 2: North Ridge "Giant Python" 11-Bend Downhill Serpentine (Eastbound along Z=-2090)
const serpNorth = makeSerpentine({
  startX: 250,
  startZ: -2090,
  dirAngle: 0, // +X
  numPeaks: 11,
  halfWaveLen: 265,
  amplitude: 112,
  firstSide: -1,
  yStart: 212,
  yEnd: 122,
  bankDeg: 16,
});
// Corner 2 center: (serpNorth.endX, -1900), radius 190 -> exits South at (serpNorth.endX + 190, -1900)
const eastAxisX = serpNorth.endX + 190;

// Sector 3A: East Cliff "Cedar Rapids" 6-Bend Technical Serpentine (Southbound along X=eastAxisX)
const serpEast = makeSerpentine({
  startX: eastAxisX,
  startZ: -1840,
  dirAngle: Math.PI / 2, // +Z
  numPeaks: 6,
  halfWaveLen: 225,
  amplitude: 90,
  firstSide: 1,
  yStart: 116,
  yEnd: 78,
  bankDeg: 13,
});
// Corner into Hairpins: Southbound -> Westbound at z = serpEast.endZ + 180
const hpBaseZ = serpEast.endZ + 180;
const hpWestX = eastAxisX - 480;
const hpEastX = eastAxisX + 100;
const hpExitZ = hpBaseZ + 720; // 5 hairpins * 144m = 720m!
const eastLowX = eastAxisX + 120;

// Sector 3C: Southeast Foothill 7-Bend Flowing Serpentine (Southbound along X=eastLowX)
const serpSE = makeSerpentine({
  startX: eastLowX,
  startZ: hpExitZ + 170,
  dirAngle: Math.PI / 2, // +Z
  numPeaks: 7,
  halfWaveLen: 240,
  amplitude: 96,
  firstSide: -1,
  yStart: 29,
  yEnd: 28,
  bankDeg: 15,
});
const southAxisZ = serpSE.endZ + 190;
const straight2StartX = eastLowX - 190;
const straight2EndX = straight2StartX - 2550; // 2.55km ruler-straight Ikaho Foothill Super-Straight #2!

// Sector 5: Akagi Gorge 9-Bend High-Speed Flowing Serpentine (Westbound along Z=southAxisZ)
const serpSouth = makeSerpentine({
  startX: straight2EndX,
  startZ: southAxisZ,
  dirAngle: Math.PI, // -X
  numPeaks: 9,
  halfWaveLen: 300,
  amplitude: 110,
  firstSide: -1,
  yStart: 28,
  yEnd: 70,
  bankDeg: 20,
});
const westAxisX = serpSouth.endX - 200;

// Sector 6A: Haruna West Wall 8-Bend Uphill Serpentine (Northbound along X=westAxisX)
const serpWest = makeSerpentine({
  startX: westAxisX,
  startZ: southAxisZ - 200,
  dirAngle: -Math.PI / 2, // -Z
  numPeaks: 8,
  halfWaveLen: 215,
  amplitude: 88,
  firstSide: 1,
  yStart: 76,
  yEnd: 162,
  bankDeg: 15,
});
const returnAxisZ = serpWest.endZ - 190;

/**
 * 超级秋名山 · 蛇形天道 // SUPER AKINA // SERPENTINE TOUGE (~28.8 km Grand Hybrid Mountain Circuit):
 * - Comprehensive mega Japanese touge uniting 5 MASSIVE C²-continuous Left<->Right Serpentine Drift Ribbons
 *   (40 alternating sweeping S-bends, every bend smooth R=52m-84m and 160m-250m long for sustained chained drifts!),
 *   the legendary Akina 5-Consecutive Stacked Downhill Hairpins, AND 3 epic 1.9km-2.6km Super-Straights!
 * - 196m vertical elevation drop from moonlit Lake Haruna Crater Summit (Y=224m) down to Ikaho Onsen Valley (Y=28m)
 *   and back up through the Haruna Western Wall & illuminated mountain express tunnels!
 */
export const SUPER_AKINA_TRACK: TrackConfig = {
  id: 'super-akina',
  name: 'SUPER AKINA // SERPENTINE TOUGE',
  nameZh: '超级秋名山 · 蛇形天道',
  theme: 'akina',
  difficulty: 'GRAND',
  description:
    '全长 27.2 km 的终极综合盘山大满贯！集结 5 大连续左右蛇形漂移区（共 41 组超长 S 弯）、秋名传奇五连发卡弯与 3 段 1.6–2.6 km 全油门超长直道；纵跨榛名湖 224m 火山垭口至伊香保温泉夜街，极速冲刺与连环甩尾无缝交织！',
  roadWidth: 26,
  maxBankDeg: 26,
  laps: 1,
  // Moonlit Mt. Haruna midnight indigo sky + warm autumn-amber Ikaho valley glow
  skyTopHex: '#04091a',
  skyMidHex: '#10203d',
  skyHorizonHex: '#57425d',
  sunColorHex: '#ffc285',
  fogColor: 0x0e182c,
  fogDensity: 0.00024,
  railLeftColor: 0xf59e0b,
  railRightColor: 0xf8fafc,
  accentColorHex: '#fb923c',
  asphaltTint: '#191d25',
  points: [
    // =========================================================================
    // SECTOR 1: LAKE HARUNA SUMMIT SUPER-STRAIGHT #1 (Northbound along X=0, ~2.1 km!)
    // =========================================================================
    { x: 0, y: 224, z: 0, inwardBankDeg: 0 },
    ...makeStraight(0, 224, 0, 0, 218, -1900, 10),

    // Corner 1: Smooth 22°-Banked 90° Right Summit Crest Turn -> Eastbound along Z=-2090
    ...makeQuarterTurn(190, -1900, 190, Math.PI, 1, 218, 212, 22),
    { x: 250, y: 212, z: -2090, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 2: NORTH RIDGE "GIANT PYTHON" 11-BEND DOWNHILL SERPENTINE (~3.9 km!)
    // =========================================================================
    ...serpNorth.pts,

    // Corner 2: East Cape 24°-Banked 90° Right -> Southbound along X=eastAxisX
    ...makeQuarterTurn(serpNorth.endX, -1900, 190, -Math.PI / 2, 1, 122, 116, 24),
    { x: eastAxisX, y: 116, z: -1840, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 3A: EAST CLIFF "CEDAR RAPIDS" 6-BEND TECHNICAL SERPENTINE (~1.75 km!)
    // =========================================================================
    ...serpEast.pts,

    // Entry transition into Iconic Akina 5-Consecutive Stacked Hairpins -> Westbound along Z=hpBaseZ
    ...makeQuarterTurn(eastAxisX - 180, serpEast.endZ, 180, 0, 1, 78, 74, 16),
    { x: hpWestX + 160, y: 73, z: hpBaseZ, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 3B: LEGENDARY AKINA 5-CONSECUTIVE STACKED DOWNHILL HAIRPINS (~3.3 km!)
    // =========================================================================
    // Hairpin #1 (West Cliff, 180° Left, heading -X -> +X)
    ...makeHairpin180(hpWestX, hpBaseZ + 72, 72, -Math.PI / 2, -1, 72, 66, 10),
    { x: (hpWestX + hpEastX) * 0.5, y: 63, z: hpBaseZ + 144, inwardBankDeg: 0 },

    // Hairpin #2 (East Cliff, 180° Right, heading +X -> -X)
    ...makeHairpin180(hpEastX, hpBaseZ + 216, 72, -Math.PI / 2, 1, 60, 54, 11),
    { x: (hpWestX + hpEastX) * 0.5, y: 51, z: hpBaseZ + 288, inwardBankDeg: 0 },

    // Hairpin #3 (West Cliff, 180° Left, heading -X -> +X)
    ...makeHairpin180(hpWestX, hpBaseZ + 360, 72, -Math.PI / 2, -1, 48, 43, 9),
    { x: (hpWestX + hpEastX) * 0.5, y: 41, z: hpBaseZ + 432, inwardBankDeg: 0 },

    // Hairpin #4 (East Cliff, 180° Right, heading +X -> -X)
    ...makeHairpin180(hpEastX, hpBaseZ + 504, 72, -Math.PI / 2, 1, 39, 35, 11),
    { x: (hpWestX + hpEastX) * 0.5, y: 34, z: hpBaseZ + 576, inwardBankDeg: 0 },

    // Hairpin #5 (West Cliff, 180° Left, heading -X -> +X)
    ...makeHairpin180(hpWestX, hpBaseZ + 648, 72, -Math.PI / 2, -1, 33, 30, 10),
    { x: eastLowX - 170, y: 30, z: hpExitZ, inwardBankDeg: 0 },

    // Smooth 90° Right exiting Hairpin #5 -> Southbound along X=eastLowX
    ...makeQuarterTurn(eastLowX - 170, hpExitZ + 170, 170, -Math.PI / 2, 1, 30, 29, 16),

    // =========================================================================
    // SECTOR 3C: SOUTHEAST FOOTHILL 6-BEND FLOWING SERPENTINE (~1.85 km!)
    // =========================================================================
    ...serpSE.pts,

    // Corner 3: Ikaho Valley Entry 22°-Banked 90° Right -> Westbound along Z=southAxisZ
    ...makeQuarterTurn(straight2StartX, serpSE.endZ, 190, 0, 1, 28, 28, 22),

    // =========================================================================
    // SECTOR 4: IKAHO ONSEN FOOTHILL SUPER-STRAIGHT #2 (~2.55 km!)
    // =========================================================================
    ...makeStraight(straight2StartX, 28, southAxisZ, straight2EndX, 28, southAxisZ, 12),

    // =========================================================================
    // SECTOR 5: AKAGI GORGE 9-BEND HIGH-SPEED FLOWING SERPENTINE (~3.35 km!)
    // =========================================================================
    ...serpSouth.pts,

    // Corner 4: Southwest Volcanic Gorge 26°-Banked 90° Right Bowl -> Northbound along X=westAxisX
    ...makeQuarterTurn(serpSouth.endX, southAxisZ - 200, 200, Math.PI / 2, 1, 70, 76, 26),

    // =========================================================================
    // SECTOR 6A: HARUNA WEST WALL 8-BEND UPHILL SERPENTINE (~2.45 km!)
    // =========================================================================
    ...serpWest.pts,

    // Corner 5: West Ridge Overlook 22°-Banked 90° Right -> Eastbound along Z=returnAxisZ
    ...makeQuarterTurn(westAxisX + 190, serpWest.endZ, 190, Math.PI, 1, 162, 168, 22),

    // =========================================================================
    // SECTOR 6B: HARUNA RIDGE TUNNEL SUPER-STRAIGHT #3 (Eastbound along Z=returnAxisZ, ~2.0 km!)
    // =========================================================================
    ...makeStraight(westAxisX + 190, 168, returnAxisZ, -200, 222, returnAxisZ, 10),

    // Final Corner: 22°-Banked 90° Left Summit Sweeper back onto Lake Haruna Start/Finish Straight (X=0)
    ...makeQuarterTurn(-200, returnAxisZ - 200, 200, Math.PI / 2, -1, 222, 224, 22),
    { x: 0, y: 224, z: Math.round((returnAxisZ - 200) * 0.5), inwardBankDeg: 0 },
  ],
  boostPads: [
    // Sector 1: Lake Haruna Launch Super-Straight #1
    { t: 0.014, d: 0, length: 34, width: 7.8 },
    { t: 0.048, d: 0, length: 36, width: 8.0 },
    // Sector 2: North Ridge Giant Python rhythm boosts
    { t: 0.140, d: 0, length: 28, width: 6.8 },
    { t: 0.205, d: 0, length: 28, width: 6.8 },
    // Sector 3: Cedar Snake -> Hairpins -> Foothill Snake
    { t: 0.285, d: 0, length: 26, width: 6.6 },
    { t: 0.430, d: 0, length: 26, width: 6.6 },
    // Sector 4: Ikaho Onsen Foothill Super-Straight #2 (post-tunnel + post-jump sprints!)
    { t: 0.607, d: 0, length: 36, width: 8.0 },
    { t: 0.652, d: 0, length: 36, width: 8.0 },
    // Sector 5 & 6A: Akagi Gorge & West Wall serpentine rhythm boosts
    { t: 0.720, d: 0, length: 28, width: 6.8 },
    { t: 0.835, d: 0, length: 28, width: 6.8 },
    // Sector 6B: Haruna Ridge Uphill Super-Straight #3 + Finish Straight sprint!
    { t: 0.908, d: 0, length: 36, width: 8.0 },
    { t: 0.958, d: 0, length: 36, width: 8.0 },
  ],
  jumpRamps: [
    // Single thrilling highway crest jump squarely in the middle of the 2.55km Ikaho Valley Super-Straight #2!
    { tStart: 0.622, tEnd: 0.625, height: 3.4, widthRatio: 0.62 },
  ],
  tunnelZones: [
    // Tunnel #1: ~440m illuminated Ikaho Foothill Express Tunnel along Super-Straight #2
    { tStart: 0.586, tEnd: 0.602 },
    // Tunnel #2: ~460m high-altitude Haruna Summit Express Tunnel along Super-Straight #3
    { tStart: 0.920, tEnd: 0.937 },
  ],
  coneClusters: [
    { t: 0.075, side: -1, count: 5 },
    { t: 0.165, side: 1, count: 5 },
    { t: 0.255, side: -1, count: 5 },
    { t: 0.345, side: 1, count: 5 },
    { t: 0.475, side: -1, count: 5 },
    { t: 0.665, side: 1, count: 5 },
    { t: 0.745, side: -1, count: 5 },
    { t: 0.855, side: 1, count: 5 },
    { t: 0.980, side: -1, count: 5 },
  ],
};
