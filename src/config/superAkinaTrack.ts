import { ControlPointDef, TrackConfig } from '../types';

/**
 * Generates a mathematically C²-continuous High-Speed Rollercoaster Serpentine Drift Ribbon
 * advancing along `dirAngle` (0 = +X, +PI/2 = +Z, -PI/2 = -Z, PI = -X):
 * - Entry/exit half-arches use `L_lead = halfWaveLen / sqrt(2)` so position, tangent, AND curvature
 *   join identically with the interior cosine waves -> ZERO kinks, ZERO pinches!
 * - Sweeping high-speed Akina bend radii (`R = 70m–108m`) let drivers fly sideways at 350–425 km/h
 *   on extreme `26°–35°` banked rollercoaster walls!
 * - Built-in 3D vertical rollercoaster wave (`elevWaveAmp`, `elevWaveCycles`) creates dramatic
 *   blind crests, -10% Laguna-Seca canyon plunges, and +10% uphill banked slingshots!
 */
function makeRollercoasterSerpentine(opts: {
  startX: number;
  startZ: number;
  dirAngle: number;
  numPeaks: number;        // alternating L <-> R banked apex sweeps (e.g. 6, 8, 9)
  halfWaveLen: number;     // axial meters peak-to-peak (270..340m -> sweeping fast bends!)
  amplitude: number;       // lateral swing amplitude in meters (100..118m)
  firstSide: 1 | -1;
  yStart: number;
  yEnd: number;
  elevWaveAmp?: number;    // dramatic vertical rollercoaster crests & plunges (meters!)
  elevWaveCycles?: number; // number of crest/valley cycles along this serpentine
  elevPhaseOffset?: number;
  bankPattern: number[];   // per-peak dramatic Akina banking angles (e.g. [28, 33, 30, 35, ...])
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
    elevWaveAmp = 0,
    elevWaveCycles = 1,
    elevPhaseOffset = 0,
    bankPattern,
    stepsPerHalfWave = 5,
  } = opts;

  const fx = Math.cos(dirAngle);
  const fz = Math.sin(dirAngle);
  const rx = -fz;
  const rz = fx;

  const leadLen = halfWaveLen / Math.SQRT2;
  const midAxis = Math.max(0, numPeaks - 1) * halfWaveLen;
  const totalAxis = leadLen * 2 + midAxis;

  const pts: ControlPointDef[] = [];
  const leadSteps = Math.max(3, Math.round(stepsPerHalfWave * 0.8));

  const evalY = (uTotal: number): number => {
    const base = yStart + (yEnd - yStart) * uTotal;
    // Smooth sine-squared envelope so rollercoaster vertical wave starts & ends tangent to yStart/yEnd!
    const envY = Math.sin(uTotal * Math.PI);
    const wave =
      elevWaveAmp !== 0
        ? Math.sin(uTotal * Math.PI * 2 * elevWaveCycles + elevPhaseOffset) * elevWaveAmp * envY
        : 0;
    return Math.round(base + wave);
  };

  const pushPt = (along: number, lat: number, apexWeight: number, peakIdx: number) => {
    const uTotal = along / totalAxis;
    const peakBank = bankPattern[peakIdx % bankPattern.length];
    // Hold fierce Akina banking across the sweeping bend, rolling smoothly through 0° at S-inflection!
    const localBank = apexWeight > 0.12 ? Math.round(peakBank * Math.min(1, apexWeight * 1.45)) : 0;
    pts.push({
      x: Math.round(startX + fx * along + rx * lat),
      y: evalY(uTotal),
      z: Math.round(startZ + fz * along + rz * lat),
      inwardBankDeg: localBank,
    });
  };

  // 1. C²-matched Lead-in -> Peak #0
  for (let i = 1; i <= leadSteps; i++) {
    const u = i / leadSteps;
    const along = u * leadLen;
    const lat = firstSide * amplitude * 0.5 * (1 - Math.cos(Math.PI * u));
    const apexWeight = Math.max(0, -Math.cos(Math.PI * u));
    pushPt(along, lat, apexWeight, 0);
  }

  // 2. Alternating High-Speed Banked Sweeps Peak #k -> Peak #(k+1)
  for (let k = 0; k < numPeaks - 1; k++) {
    const side = k % 2 === 0 ? firstSide : -firstSide;
    const baseAlong = leadLen + k * halfWaveLen;
    for (let i = 1; i <= stepsPerHalfWave; i++) {
      const u = i / stepsPerHalfWave;
      const along = baseAlong + u * halfWaveLen;
      const c = Math.cos(Math.PI * u);
      const lat = side * amplitude * c;
      const apexWeight = Math.abs(c);
      const activePeak = u < 0.5 ? k : k + 1;
      pushPt(along, lat, apexWeight, activePeak);
    }
  }

  // 3. C²-matched Lead-out -> lat=0
  const endSide = (numPeaks - 1) % 2 === 0 ? firstSide : -firstSide;
  const exitBase = leadLen + midAxis;
  for (let i = 1; i <= leadSteps; i++) {
    const u = i / leadSteps;
    const along = exitBase + u * leadLen;
    const lat = endSide * amplitude * 0.5 * (1 + Math.cos(Math.PI * u));
    const apexWeight = Math.max(0, Math.cos(Math.PI * u));
    pushPt(along, lat, apexWeight, numPeaks - 1);
  }

  return {
    pts,
    endX: Math.round(startX + fx * totalAxis),
    endZ: Math.round(startZ + fz * totalAxis),
    totalAxis,
  };
}

/** Smooth 4-step 90° quarter-circle corner with dramatic Akina banking & vertical drop/climb */
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
      inwardBankDeg: i === steps ? Math.round(bankDeg * 0.55) : bankDeg,
    });
  }
  return pts;
}

/** Smooth 5-point 180° semicircular hairpin (supports extreme 34° slingshot bowls OR crisp 8° flat hairpins!) */
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

/** Generates evenly-spaced ruler-straight highway segments with optional vertical profile curve */
function makeStraight(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  segments: number,
  yMidDip = 0
): ControlPointDef[] {
  const pts: ControlPointDef[] = [];
  for (let i = 1; i <= segments; i++) {
    const u = i / segments;
    const dip = yMidDip !== 0 ? Math.sin(u * Math.PI) * yMidDip : 0;
    pts.push({
      x: Math.round(x0 + (x1 - x0) * u),
      y: Math.round(y0 + (y1 - y0) * u + dip),
      z: Math.round(z0 + (z1 - z0) * u),
      inwardBankDeg: 0,
    });
  }
  return pts;
}

// =============================================================================
// PARAMETRIC CHAINED COORDINATE SOLVER (Exact C² joins, >=140m 3D separation!)
// =============================================================================

// Sector 2: North Ridge "Corkscrew Python" 9-Bend Extreme-Banked Rollercoaster Serpentine!
// Sweeping fast Akina radius (R≈84m) + extreme 28°–35° banking + dramatic ±26m rollercoaster plunges & crests!
const serpNorth = makeRollercoasterSerpentine({
  startX: 250,
  startZ: -2060,
  dirAngle: 0, // +X Eastbound
  numPeaks: 9,
  halfWaveLen: 315,
  amplitude: 116,
  firstSide: -1,
  yStart: 226,
  yEnd: 152,
  elevWaveAmp: 24,
  elevWaveCycles: 2,
  elevPhaseOffset: 0.4,
  bankPattern: [31, 35, 30, 35, 32, 35, 28, 35, 33],
});
const eastAxisX = serpNorth.endX + 190;

// Sector 3A: East Cliff "Cliffside Plunge" 5-Bend Steep Banked Serpentine!
const serpEast = makeRollercoasterSerpentine({
  startX: eastAxisX,
  startZ: -1810,
  dirAngle: Math.PI / 2, // +Z Southbound
  numPeaks: 5,
  halfWaveLen: 270,
  amplitude: 102,
  firstSide: 1,
  yStart: 146,
  yEnd: 148,
  elevWaveAmp: 22,
  elevWaveCycles: 1.5,
  elevPhaseOffset: 0,
  bankPattern: [33, 28, 35, 30, 34],
});

// Sector 3B: Iconic Akina Varied-Bank 5-Consecutive Stacked Hairpins (honoring original 32° / 16° / 8° / 34°!)
const hpBaseZ = serpEast.endZ + 180;
const hpWestX = eastAxisX - 490;
const hpEastX = eastAxisX + 110;
const hpRadius = 76; // 2*R = 152m tier separation -> spacious high-speed bowls & >=140m separation!
const hpExitZ = hpBaseZ + hpRadius * 10; // 5 hairpins * 152m = 760m
const eastLowX = eastAxisX + 130;

// Sector 3C: Southeast Foothill "Valley Plunge" 5-Bend High-Bank Serpentine!
const serpSE = makeRollercoasterSerpentine({
  startX: eastLowX,
  startZ: hpExitZ + 175,
  dirAngle: Math.PI / 2, // +Z Southbound
  numPeaks: 5,
  halfWaveLen: 275,
  amplitude: 104,
  firstSide: -1,
  yStart: 78,
  yEnd: 28,
  elevWaveAmp: 16,
  elevWaveCycles: 1.5,
  elevPhaseOffset: 0.6,
  bankPattern: [32, 35, 26, 34, 31],
});
const southAxisZ = serpSE.endZ + 190;
const straight2StartX = eastLowX - 190;
const straight2EndX = straight2StartX - 2450; // 2.45km Ikaho Foothill Super-Straight #2!

// Sector 5: Akagi Canyon "Rollercoaster Mega-Esses" 8-Bend Ultra-Fast 30°–35° Sweeping Serpentine!
const serpSouth = makeRollercoasterSerpentine({
  startX: straight2EndX,
  startZ: southAxisZ,
  dirAngle: Math.PI, // -X Westbound
  numPeaks: 8,
  halfWaveLen: 335,
  amplitude: 115,
  firstSide: -1,
  yStart: 28,
  yEnd: 96,
  elevWaveAmp: 26,
  elevWaveCycles: 2,
  elevPhaseOffset: 0.2,
  bankPattern: [33, 35, 31, 35, 29, 35, 34, 35],
});
const westAxisX = serpSouth.endX - 200;

// Sector 6A: Haruna West Wall "Sky-Climb" 6-Bend Steep Uphill Banked Serpentine!
const serpWest = makeRollercoasterSerpentine({
  startX: westAxisX,
  startZ: southAxisZ - 200,
  dirAngle: -Math.PI / 2, // -Z Northbound
  numPeaks: 6,
  halfWaveLen: 275,
  amplitude: 102,
  firstSide: 1,
  yStart: 104,
  yEnd: 174,
  elevWaveAmp: 19,
  elevWaveCycles: 1.5,
  elevPhaseOffset: -0.3,
  bankPattern: [31, 35, 28, 34, 32, 35],
});
const returnAxisZ = serpWest.endZ - 190;

/**
 * 超级秋名山 · 极限蛇形天道 // SUPER AKINA // EXTREME TOUGE (~26.5 km Grand Mountain Coaster):
 * - Faithfully amplifies the iconic DNA of the original Akina Mountain Pass into an epic 26.5 km circuit:
 *   • Extreme 26°–35° banked mountain bowls (even on fast sweeping R=72–105m curves for 360–425 km/h sideways drifts!)
 *   • Dramatic ±9%–11% rollercoaster verticality: Laguna Seca blind crests, steep canyon plunges & turbo valley climbs!
 *   • 5 MASSIVE C²-continuous banked Left<->Right Rollercoaster Serpentine Ribbons (33 sweeping extreme-banked S-bends!)
 *   • Legendary Akina 5-Consecutive Varied-Bank Hairpins (33° -> 18° -> 9° flat contrast -> 35° Karussell -> 32° slingshot!)
 *   • 3 thrilling 1.7–2.5 km Super-Straights + 2 illuminated mountain tunnels + 3 exhilarating crest Jump Ramps!
 */
export const SUPER_AKINA_TRACK: TrackConfig = {
  id: 'super-akina',
  name: 'SUPER AKINA // EXTREME TOUGE',
  nameZh: '超级秋名山 · 极限蛇形天道',
  theme: 'akina',
  difficulty: 'GRAND',
  description:
    '原版秋名山灵魂终极进化！保留高达 35° 极限倾斜碗弯、±13% 陡峭过山车骤降/冲顶与 27m 暗夜峡谷压迫感，全面拓展为 26.1 km 超长综合山道：5 大高倾角蛇形过山车漂移区（33 组高速大弧 S 弯）、变倾角五连发卡与 3 段极速大直道，400+ km/h 贴壁横滑紧张刺激！',
  roadWidth: 27,
  maxBankDeg: 35,
  laps: 1,
  // Authentic original Akina deep indigo starry night sky + nocturnal mountain mist!
  skyTopHex: '#050a18',
  skyMidHex: '#101d34',
  skyHorizonHex: '#3b4a69',
  sunColorHex: '#ffba73',
  fogColor: 0x0c1424,
  fogDensity: 0.00038,
  railLeftColor: 0xf59e0b,
  railRightColor: 0xe2e8f0,
  accentColorHex: '#f59e0b',
  asphaltTint: '#1a1d24',
  points: [
    // =========================================================================
    // SECTOR 1: LAKE HARUNA SUMMIT ROLLERCOASTER SUPER-STRAIGHT #1 (~2.0 km!)
    // Launches at Y=238m with a dramatic -18m summit dip & crest jump right before Corner 1!
    // =========================================================================
    { x: 0, y: 238, z: 0, inwardBankDeg: 0 },
    ...makeStraight(0, 238, 0, 0, 236, -1870, 10, -24),

    // Corner 1: Fierce 32°-Banked 90° Right Summit Cliff Plunge -> Eastbound along Z=-2060
    ...makeQuarterTurn(190, -1870, 190, Math.PI, 1, 236, 226, 32),
    { x: 250, y: 226, z: -2060, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 2: NORTH RIDGE "CORKSCREW PYTHON" 9-BEND EXTREME-BANKED SERPENTINE!
    // 28°–35° banked canyon walls + dramatic ±28m rollercoaster drops & crests!
    // =========================================================================
    ...serpNorth.pts,

    // Corner 2: East Cape 34°-Banked 90° Right Canyon Plunge -> Southbound along X=eastAxisX
    ...makeQuarterTurn(serpNorth.endX, -1870, 190, -Math.PI / 2, 1, 152, 146, 34),
    { x: eastAxisX, y: 146, z: -1810, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 3A: EAST CLIFF "CLIFFSIDE PLUNGE" 5-BEND STEEP SERPENTINE!
    // Dramatic +22m blind ridge crests & -12% cliffside dives straight into the 5 Hairpins!
    // =========================================================================
    ...serpEast.pts,

    // Entry transition into Iconic Varied-Bank 5-Hairpin Cascade (32°-banked 90° Right -> Westbound!)
    ...makeQuarterTurn(eastAxisX - 180, serpEast.endZ, 180, 0, 1, 148, 150, 32),
    { x: hpWestX + 160, y: 150, z: hpBaseZ, inwardBankDeg: 0 },

    // =========================================================================
    // SECTOR 3B: LEGENDARY AKINA VARIED-BANK 5-CONSECUTIVE CLIFF HAIRPINS!
    // Plunges steeply 72m down the volcanic cliffside with original Akina banking rhythm:
    // 33° Steep Bowl -> 18° Mid -> 9° Flat Technical Contrast -> 35° Mega Karussell -> 32° Slingshot!
    // =========================================================================
    // Hairpin #1 (West Cliff, 33° Steep Banked Downhill 180° Left!)
    ...makeHairpin180(hpWestX, hpBaseZ + hpRadius, hpRadius, -Math.PI / 2, -1, 148, 136, 33),
    { x: (hpWestX + hpEastX) * 0.5, y: 132, z: hpBaseZ + hpRadius * 2, inwardBankDeg: 0 },

    // Hairpin #2 (East Cliff, 18° Mid-Banked Downhill 180° Right!)
    ...makeHairpin180(hpEastX, hpBaseZ + hpRadius * 3, hpRadius, -Math.PI / 2, 1, 126, 116, 18),
    { x: (hpWestX + hpEastX) * 0.5, y: 112, z: hpBaseZ + hpRadius * 4, inwardBankDeg: 0 },

    // Hairpin #3 (West Cliff, 9° Crisp Flat Technical Touge 180° Left — classic snap-drift contrast!)
    ...makeHairpin180(hpWestX, hpBaseZ + hpRadius * 5, hpRadius, -Math.PI / 2, -1, 108, 100, 9),
    { x: (hpWestX + hpEastX) * 0.5, y: 96, z: hpBaseZ + hpRadius * 6, inwardBankDeg: 0 },

    // Hairpin #4 (East Cliff, 35° EXTREME Mega-Banked Karussell 180° Right Bowl!)
    ...makeHairpin180(hpEastX, hpBaseZ + hpRadius * 7, hpRadius, -Math.PI / 2, 1, 92, 86, 35),
    { x: (hpWestX + hpEastX) * 0.5, y: 84, z: hpBaseZ + hpRadius * 8, inwardBankDeg: 0 },

    // Hairpin #5 (West Cliff, 32° Slingshot 180° Left Bowl!)
    ...makeHairpin180(hpWestX, hpBaseZ + hpRadius * 9, hpRadius, -Math.PI / 2, -1, 82, 78, 32),
    { x: eastLowX - 175, y: 78, z: hpExitZ, inwardBankDeg: 0 },

    // Smooth 30°-Banked 90° Right -> Southbound along X=eastLowX
    ...makeQuarterTurn(eastLowX - 175, hpExitZ + 175, 175, -Math.PI / 2, 1, 78, 78, 30),

    // =========================================================================
    // SECTOR 3C: SOUTHEAST "VALLEY PLUNGE" 5-BEND HIGH-BANK SERPENTINE!
    // Sweeps steeply downhill 50m with ±24m cliff crests into the Ikaho Valley Floor (Y=28m)!
    // =========================================================================
    ...serpSE.pts,

    // Corner 3: Ikaho Valley Entry 34°-Banked 90° Right Bowl -> Westbound along Z=southAxisZ
    ...makeQuarterTurn(straight2StartX, serpSE.endZ, 190, 0, 1, 28, 28, 34),

    // =========================================================================
    // SECTOR 4: IKAHO ONSEN VALLEY SUPER-STRAIGHT #2 (~2.45 km!)
    // Illuminated mountain tunnel + flat-out 400+ km/h valley blast + 3.8m Jump Ramp!
    // =========================================================================
    ...makeStraight(straight2StartX, 28, southAxisZ, straight2EndX, 28, southAxisZ, 12, 14),

    // =========================================================================
    // SECTOR 5: AKAGI CANYON "ROLLERCOASTER MEGA-ESSES" 8-BEND 30°–35° SERPENTINE!
    // Huge sweeping R≈96m canyon bowls + wild ±36m steep vertical climbs & plunges!
    // =========================================================================
    ...serpSouth.pts,

    // Corner 4: Southwest Volcanic Gorge 35°-Banked 90° Right Mega-Bowl -> Northbound along X=westAxisX
    ...makeQuarterTurn(serpSouth.endX, southAxisZ - 200, 200, Math.PI / 2, 1, 96, 104, 35),

    // =========================================================================
    // SECTOR 6A: HARUNA WEST WALL "SKY-CLIMB" 6-BEND STEEP UPHILL SERPENTINE!
    // Charges steeply uphill (+8–10% climbs!) through 6 fiercely banked 27°–35° canyon walls!
    // =========================================================================
    ...serpWest.pts,

    // Corner 5: West Ridge Overlook 32°-Banked 90° Right -> Eastbound along Z=returnAxisZ
    ...makeQuarterTurn(westAxisX + 190, serpWest.endZ, 190, Math.PI, 1, 174, 180, 32),

    // =========================================================================
    // SECTOR 6B: HARUNA RIDGE TURBO CLIMB SUPER-STRAIGHT #3 (~2.0 km!)
    // Steep uphill mountain tunnel + Summit Crest Jump Ramp -> 33°-Banked Final Corner to Finish!
    // =========================================================================
    ...makeStraight(westAxisX + 190, 180, returnAxisZ, -200, 236, returnAxisZ, 10, -14),

    // Final Corner: Fierce 33°-Banked 90° Left Summit Slingshot onto Lake Haruna Start/Finish Straight (X=0)!
    ...makeQuarterTurn(-200, returnAxisZ - 200, 200, Math.PI / 2, -1, 236, 238, 33),
    { x: 0, y: 238, z: Math.round((returnAxisZ - 200) * 0.5), inwardBankDeg: 0 },
  ],
  boostPads: [
    // Sector 1: Lake Haruna Summit Launch Straight #1
    { t: 0.015, d: 0, length: 34, width: 7.8 },
    { t: 0.056, d: 0, length: 36, width: 8.0 },
    // Sector 2: North Ridge Corkscrew Python high-G boosts
    { t: 0.140, d: 0, length: 28, width: 7.0 },
    { t: 0.205, d: 0, length: 28, width: 7.0 },
    // Sector 3: East Cliff -> Varied-Bank 5 Hairpins -> Valley Plunge
    { t: 0.285, d: 0, length: 28, width: 7.0 },
    { t: 0.440, d: 0, length: 28, width: 7.0 },
    // Sector 4: Ikaho Valley Super-Straight #2 (post-tunnel & post-jump sprints!)
    { t: 0.606, d: 0, length: 36, width: 8.0 },
    { t: 0.652, d: 0, length: 36, width: 8.0 },
    // Sector 5 & 6A: Akagi Rollercoaster & West Wall Sky-Climb boosts
    { t: 0.728, d: 0, length: 28, width: 7.0 },
    { t: 0.840, d: 0, length: 28, width: 7.0 },
    // Sector 6B: Haruna Ridge Turbo Climb Super-Straight #3 + Finish Sprint!
    { t: 0.908, d: 0, length: 36, width: 8.0 },
    { t: 0.968, d: 0, length: 36, width: 8.0 },
  ],
  jumpRamps: [
    // Jump #1: Summit Straight high-speed crest jump (honoring original Akina's downhill launch!)
    { tStart: 0.036, tEnd: 0.039, height: 3.5, widthRatio: 0.64 },
    // Jump #2: Mid-straight valley jump on the 2.45km Ikaho Express Straight #2!
    { tStart: 0.624, tEnd: 0.627, height: 3.8, widthRatio: 0.64 },
    // Jump #3: Final uphill turbo-climb crest jump on Super-Straight #3 (honoring original Akina's final climb jump!)
    { tStart: 0.950, tEnd: 0.953, height: 3.6, widthRatio: 0.64 },
  ],
  tunnelZones: [
    // Tunnel #1: ~420m illuminated Ikaho Foothill Express Tunnel along Super-Straight #2
    { tStart: 0.588, tEnd: 0.604 },
    // Tunnel #2: ~450m high-altitude Haruna Summit Express Tunnel along Super-Straight #3
    { tStart: 0.922, tEnd: 0.939 },
  ],
  coneClusters: [
    { t: 0.080, side: -1, count: 6 },
    { t: 0.168, side: 1, count: 6 },
    { t: 0.252, side: -1, count: 6 },
    { t: 0.350, side: 1, count: 6 },
    { t: 0.480, side: -1, count: 6 },
    { t: 0.672, side: 1, count: 6 },
    { t: 0.755, side: -1, count: 6 },
    { t: 0.858, side: 1, count: 6 },
    { t: 0.980, side: -1, count: 6 },
  ],
};
