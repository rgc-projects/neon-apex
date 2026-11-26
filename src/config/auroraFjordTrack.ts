import { ControlPointDef, TrackConfig } from '../types';

/**
 * Generates a smooth, crease-free rounded hairpin finger pointing outward from (baseX, baseZ)
 * along `dirAngle` (radians in XZ: 0=+X, +PI/2=+Z, -PI/2=-Z) for length `armLen` and tip radius `tipRadius`.
 * Traces clockwise around the lobe: outbound leg (-tipRadius) -> 5-pt semicircular tip -> inbound leg (+tipRadius).
 */
function makeFinger(opts: {
  baseX: number;
  baseZ: number;
  dirAngle: number;
  armLen: number;
  tipRadius: number;
  curveMid?: number;
  yBase: number;
  yTip: number;
  bankTip: number;
}): ControlPointDef[] {
  const { baseX, baseZ, dirAngle, armLen, tipRadius, curveMid = 0, yBase, yTip, bankTip } = opts;
  const fx = Math.cos(dirAngle);
  const fz = Math.sin(dirAngle);
  const rx = -fz;
  const rz = fx;

  const pts: ControlPointDef[] = [];
  const tipCenterDist = Math.max(tipRadius + 75, armLen - tipRadius);

  // Outbound leg (left side of finger, offset -tipRadius)
  for (const u of [0.24, 0.56, 0.84]) {
    const dist = u * tipCenterDist;
    const bend = Math.sin(u * Math.PI) * curveMid;
    const lat = -tipRadius + bend;
    pts.push({
      x: Math.round(baseX + fx * dist + rx * lat),
      y: Math.round(yBase + (yTip - yBase) * u),
      z: Math.round(baseZ + fz * dist + rz * lat),
      inwardBankDeg: Math.abs(curveMid) > 35 ? 10 : 0,
    });
  }

  // Smooth 5-point semicircular 180° hairpin around the finger tip
  const cx = baseX + fx * tipCenterDist;
  const cz = baseZ + fz * tipCenterDist;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * Math.PI;
    const ox = -Math.cos(a) * rx + Math.sin(a) * fx;
    const oz = -Math.cos(a) * rz + Math.sin(a) * fz;
    pts.push({
      x: Math.round(cx + ox * tipRadius),
      y: Math.round(yTip),
      z: Math.round(cz + oz * tipRadius),
      inwardBankDeg: bankTip,
    });
  }

  // Inbound leg (right side of finger, returning toward the caldera hub)
  for (const u of [0.84, 0.56, 0.24]) {
    const dist = u * tipCenterDist;
    const bend = Math.sin(u * Math.PI) * curveMid;
    const lat = tipRadius + bend;
    pts.push({
      x: Math.round(baseX + fx * dist + rx * lat),
      y: Math.round(yBase + (yTip - yBase) * u),
      z: Math.round(baseZ + fz * dist + rz * lat),
      inwardBankDeg: Math.abs(curveMid) > 35 ? 10 : 0,
    });
  }

  return pts;
}

/** Smooth 3-point rounded inner valley arc (sweeps cleanly clockwise from previous finger's inbound leg into next finger's outbound leg!) */
function makeInnerValley(
  cx: number,
  cz: number,
  inwardDirAngle: number, // direction pointing INTO the caldera center
  radius: number,
  y: number,
  bankDeg: number
): ControlPointDef[] {
  const fx = Math.cos(inwardDirAngle);
  const fz = Math.sin(inwardDirAngle);
  const rx = -fz;
  const rz = fx;
  // Sweeps +rx (incoming finger side) -> +fx (valley apex) -> -rx (outgoing finger side): zero bow-tie loops!
  const pts: ControlPointDef[] = [];
  for (const a of [Math.PI * 0.18, Math.PI * 0.5, Math.PI * 0.82]) {
    const ox = Math.cos(a) * rx + Math.sin(a) * fx;
    const oz = Math.cos(a) * rz + Math.sin(a) * fz;
    pts.push({
      x: Math.round(cx + ox * radius),
      y: Math.round(y),
      z: Math.round(cz + oz * radius),
      inwardBankDeg: bankDeg,
    });
  }
  return pts;
}

/**
 * 极光星湾 24 弯迷宫 // AURORA FJORD // 24 BENDS:
 * - Faithfully recreates the hand-drawn 11-arm radial starfish/coral hairpin labyrinth!
 * - Pure long-distance technical drift touge (~18.5 km, >2.5× longer than Nujiang 72 Bends):
 *   4 tall Northern Crown vertical spikes + 2 East-Southeast angled coral spurs + deep central caldera loop
 *   + 1 deep Southern abyss arm + 1 broad Southwest hooked claw + 3 sweeping Western crescent horns
 *   = 24+ consecutive tight 180° hairpins & sweeping drift arcs with ZERO boring long straights!
 */
export const AURORA_FJORD_TRACK: TrackConfig = {
  id: 'aurora-fjord',
  name: 'AURORA FJORD // 24 BENDS',
  nameZh: '极光星湾 24 弯迷宫',
  theme: 'fjord',
  difficulty: 'EXTREME',
  description:
    '超长 20.8 km 放射状“星形峡湾”终极漂移迷宫！精准还原 11 条形态各异的玄武岩半岛触角与 11 座中心折返谷，共计 24+ 组密集发卡弯与弯月 S 弯，北极光映照冰海峡湾，从头漂到尾！',
  roadWidth: 25,
  maxBankDeg: 20,
  laps: 1,
  // Arctic twilight indigo zenith + glacial teal-blue horizon (paired with animated Aurora Borealis curtains!)
  skyTopHex: '#040b22',
  skyMidHex: '#0c264a',
  skyHorizonHex: '#3c6e8f',
  sunColorHex: '#9be7ff',
  fogColor: 0x0b1c36,
  fogDensity: 0.00020,
  railLeftColor: 0x00f2ff,
  railRightColor: 0xff3b7a,
  accentColorHex: '#ff3b7a',
  asphaltTint: '#212835',
  points: [
    // === START/FINISH: Straight North Launch along West side of Crown Finger #1 ===
    { x: -640, y: 44, z: -600, inwardBankDeg: 0 },
    { x: -640, y: 44, z: -760, inwardBankDeg: 0 },

    // === SECTOR 1: NORTHERN CROWN (4 TALL PARALLEL VERTICAL HAIRPIN SPIKES!) ===
    // Finger #1 (Top-Left Crown Spike, R=64m)
    ...makeFinger({
      baseX: -576,
      baseZ: -770,
      dirAngle: -Math.PI / 2,
      armLen: 520,
      tipRadius: 64,
      curveMid: -10,
      yBase: 44,
      yTip: 22,
      bankTip: 12,
    }),
    // Rounded Inner Valley #1 -> #2
    ...makeInnerValley(-420, -640, Math.PI / 2, 76, 52, 13),

    // Finger #2 (Top-Mid-Left Tall Crown Spike, R=65m)
    ...makeFinger({
      baseX: -264,
      baseZ: -690,
      dirAngle: -Math.PI / 2,
      armLen: 645,
      tipRadius: 65,
      curveMid: 12,
      yBase: 52,
      yTip: 74,
      bankTip: 14,
    }),
    // Rounded Inner Valley #2 -> #3
    ...makeInnerValley(-106, -630, Math.PI / 2, 76, 58, 13),

    // Finger #3 (Top-Mid-Right Tall Crown Spike, R=65m)
    ...makeFinger({
      baseX: 52,
      baseZ: -680,
      dirAngle: -Math.PI / 2,
      armLen: 710,
      tipRadius: 65,
      curveMid: 18,
      yBase: 56,
      yTip: 24,
      bankTip: 11,
    }),
    // Rounded Inner Valley #3 -> #4 (dips slightly deeper toward hub like the sketch!)
    ...makeInnerValley(218, -560, Math.PI / 2, 78, 48, 14),

    // Finger #4 (Top-Right Tallest Crown Spire, slight eastward lean, R=68m)
    ...makeFinger({
      baseX: 386,
      baseZ: -600,
      dirAngle: -Math.PI / 2 + 0.08,
      armLen: 830,
      tipRadius: 68,
      curveMid: -24,
      yBase: 48,
      yTip: 84,
      bankTip: 15,
    }),

    // === SECTOR 2: EAST-SOUTHEAST CORAL REEF SPURS (2 ANGLED PENINSULAS + DEEP HUB LOOP!) ===
    // Rounded Inner Valley #4 -> #5 (wide smooth transition into East spur!)
    ...makeInnerValley(470, -345, Math.PI - 0.22, 86, 44, 13),

    // Finger #5 (East-Southeast Sharp Pointed Spur jutting right-down!)
    ...makeFinger({
      baseX: 575,
      baseZ: -135,
      dirAngle: 0.34,
      armLen: 670,
      tipRadius: 66,
      curveMid: -18,
      yBase: 42,
      yTip: 20,
      bankTip: 13,
    }),
    // Rounded Inner Valley #5 -> #6 (wide smooth transition into Southeast coral lobe!)
    ...makeInnerValley(472, 68, Math.PI - 0.52, 84, 44, 14),

    // Finger #6 (Southeast Wide Rounded Coral Lobe!)
    ...makeFinger({
      baseX: 465,
      baseZ: 245,
      dirAngle: 0.88,
      armLen: 700,
      tipRadius: 96,
      curveMid: 28,
      yBase: 44,
      yTip: 18,
      bankTip: 16,
    }),

    // Deep Inner Caldera Switchback Loop (cuts UP into the center between Finger #6 & #7 — signature detail!)
    { x: 268, y: 58, z: 168, inwardBankDeg: 11 },
    { x: 210, y: 68, z: -22, inwardBankDeg: 13 },
    ...makeInnerValley(118, -38, -Math.PI / 2, 82, 74, 15),
    { x: 30, y: 66, z: 96, inwardBankDeg: 11 },

    // === SECTOR 3: DEEP SOUTHERN ABYSS ARM & SOUTHWEST HOOKED CLAW ===
    // Finger #7 (Bottom-Center Deep Vertical U-Arm plunging straight South!)
    ...makeFinger({
      baseX: 58,
      baseZ: 285,
      dirAngle: Math.PI / 2 - 0.05,
      armLen: 730,
      tipRadius: 80,
      curveMid: -18,
      yBase: 56,
      yTip: 16,
      bankTip: 14,
    }),

    // Rounded Inner Hub Valley between Finger #7 & Southwest Claw #8
    ...makeInnerValley(-162, 265, -Math.PI / 2, 76, 52, 14),

    // Finger #8 (Southwest Wide Hooked Claw Bay — descends South, broad bottom sweep West, curls North, notches inward!)
    { x: -272, y: 44, z: 540, inwardBankDeg: 9 },
    { x: -282, y: 34, z: 810, inwardBankDeg: 12 },
    { x: -385, y: 24, z: 950, inwardBankDeg: 13 },
    { x: -620, y: 20, z: 970, inwardBankDeg: 10 },
    { x: -810, y: 22, z: 880, inwardBankDeg: 13 },
    { x: -848, y: 28, z: 705, inwardBankDeg: 12 },
    // Characteristic inward hook notch on the Southwest Claw
    { x: -732, y: 36, z: 590, inwardBankDeg: 13 },
    { x: -585, y: 42, z: 618, inwardBankDeg: 14 },
    { x: -502, y: 48, z: 505, inwardBankDeg: 14 },
    { x: -552, y: 52, z: 375, inwardBankDeg: 12 },

    // === SECTOR 4: WESTERN CRESCENT HORNS (3 WELL-SPACED FINGERS SWEEPING WEST & NORTHWEST!) ===
    // Finger #9 (West-Southwest Sharp Horizontal Spur jutting left!)
    ...makeFinger({
      baseX: -620,
      baseZ: 245,
      dirAngle: Math.PI - 0.12,
      armLen: 580,
      tipRadius: 65,
      curveMid: -16,
      yBase: 50,
      yTip: 24,
      bankTip: 12,
    }),
    // Rounded Inner Valley #9 -> #10
    ...makeInnerValley(-548, 86, 0, 72, 56, 14),

    // Finger #10 (Mid-West Sweeping Crescent Arm curving gently West-Northwest!)
    ...makeFinger({
      baseX: -620,
      baseZ: -55,
      dirAngle: Math.PI + 0.14,
      armLen: 630,
      tipRadius: 68,
      curveMid: 26,
      yBase: 56,
      yTip: 22,
      bankTip: 15,
    }),
    // Rounded Inner Valley #10 -> #11
    ...makeInnerValley(-575, -242, 0.15, 74, 54, 14),

    // Finger #11 (Upper-West Long Horn jutting far West-Northwest, sweeping smoothly into Start/Finish Straight!)
    ...makeFinger({
      baseX: -740,
      baseZ: -445,
      dirAngle: Math.PI + 0.18,
      armLen: 650,
      tipRadius: 66,
      curveMid: -16,
      yBase: 46,
      yTip: 76,
      bankTip: 13,
    }),
    // Smooth 90° transition corner onto the Northbound Start/Finish Straight
    { x: -678, y: 44, z: -518, inwardBankDeg: 11 },
    { x: -644, y: 44, z: -552, inwardBankDeg: 9 },
  ],
  boostPads: [
    { t: 0.006, d: 0, length: 24, width: 6.4 },
    { t: 0.125, d: 0, length: 24, width: 6.4 },
    { t: 0.245, d: 0, length: 24, width: 6.4 },
    { t: 0.365, d: 0, length: 24, width: 6.4 },
    { t: 0.485, d: 0, length: 24, width: 6.4 },
    { t: 0.615, d: 0, length: 24, width: 6.4 },
    { t: 0.745, d: 0, length: 24, width: 6.4 },
    { t: 0.875, d: 0, length: 24, width: 6.4 },
  ],
  jumpRamps: [],
  tunnelZones: [],
  coneClusters: [
    { t: 0.06, side: -1, count: 5 },
    { t: 0.18, side: 1, count: 5 },
    { t: 0.31, side: -1, count: 5 },
    { t: 0.43, side: 1, count: 5 },
    { t: 0.56, side: -1, count: 5 },
    { t: 0.68, side: 1, count: 5 },
    { t: 0.81, side: -1, count: 5 },
    { t: 0.93, side: 1, count: 5 },
  ],
};
