import { ControlPointDef, TrackConfig } from '../types';

function scalePts(
  pts: { x: number; y: number; z: number; inwardBankDeg?: number }[],
  xzScale = 1.66,
  yScale = 1.15
): ControlPointDef[] {
  return pts.map((p) => ({
    x: Math.round(p.x * xzScale),
    y: Math.round(p.y * yScale),
    z: Math.round(p.z * xzScale),
    inwardBankDeg: p.inwardBankDeg,
  }));
}

/**
 * TRUE 1:1 FULL-LENGTH ISLE OF MAN TT — SNAEFELL MOUNTAIN COURSE (~60.7 km / 37.73 miles)
 * Clockwise from Douglas TT Grandstand (Glencrutchery Road) -> Bray Hill -> Quarterbridge ->
 * Braddan -> Union Mills -> Crosby -> Greeba -> Ballacraine -> Glen Helen -> Sarah's Cottage ->
 * Cronk-y-Voddy -> Handley's -> Barregarrow -> Kirk Michael -> Bishopscourt -> Ballaugh Bridge ->
 * Quarry Bends -> Sulby Straight -> Ginger Hall -> Kerrowmoar -> Parliament Square -> Ramsey Hairpin ->
 * Waterworks -> Gooseneck -> Joey's -> Guthrie's -> Mountain Mile -> Mountain Box -> Verandah ->
 * Bungalow -> Hailwood's Height -> Brandywell -> Windy Corner -> Keppel Gate -> Kate's Cottage ->
 * Creg-ny-Baa -> Gob-ny-Geay -> Brandish -> Hillberry -> Signpost -> Governor's Bridge -> Douglas!
 */
export const ISLE_OF_MAN_TRACK: TrackConfig = {
  id: 'isle-of-man',
  name: 'ASTRAL ISLAND GP // 60.7KM',
  nameZh: '星穹环岛耐力赛',
  theme: 'manx',
  difficulty: 'GRAND',
  description:
    '全长 60.7km 的超长环岛公路耐力赛！16 大环岛地标路段、超 160 组高速弯道与风脊/云岭极速超频直道，搭配 1/2/3 圈自由选择，体验真正史诗级公路环岛耐力赛！',
  roadWidth: 27,
  maxBankDeg: 32,
  laps: 1,
  skyTopHex: '#0c1d36',
  skyMidHex: '#284568',
  skyHorizonHex: '#c99b6a',
  sunColorHex: '#ffe3a3',
  fogColor: 0x1a2b40,
  fogDensity: 0.00024,
  railLeftColor: 0xdc2626,
  railRightColor: 0xfacc15,
  accentColorHex: '#ef4444',
  asphaltTint: '#242932',
  points: scalePts([
    // === MS 0-1: Douglas TT Grandstand (Glencrutchery Road) -> St Ninian's -> Bray Hill -> Ago's Leap ===
    { x: 0, y: 34, z: 0, inwardBankDeg: 0 },
    { x: 0, y: 33, z: -320, inwardBankDeg: 0 },
    // Bray Hill Iconic Steep Downhill Compression (OVERDRIVE I -> II launch straight!)
    { x: 0, y: 24, z: -720, inwardBankDeg: 0 },
    { x: 0, y: 16, z: -1140, inwardBankDeg: 0 },
    { x: 0, y: 15, z: -1520, inwardBankDeg: 0 },
    // Quarterbridge: Crisp 7° Urban 90° Left onto A1 Peel Road
    { x: -38, y: 15, z: -1655, inwardBankDeg: 7 },
    { x: -165, y: 16, z: -1700, inwardBankDeg: 7 },

    // === MS 2-4: Braddan Bridge S-Bends -> Snugborough -> Union Mills -> Glen Vine ===
    { x: -345, y: 17, z: -1665, inwardBankDeg: 11 },
    { x: -505, y: 18, z: -1785, inwardBankDeg: 13 },
    { x: -690, y: 20, z: -1725, inwardBankDeg: 11 },
    // Union Mills Fast Sweeping Village Bends
    { x: -910, y: 22, z: -1835, inwardBankDeg: 14 },
    { x: -1150, y: 24, z: -1775, inwardBankDeg: 12 },
    { x: -1410, y: 26, z: -1810, inwardBankDeg: 0 },

    // === MS 5-7: Crosby Straight (Overdrive Straight!) -> Greeba Castle -> Gorse Lea -> Ballagarey ===
    { x: -1860, y: 28, z: -1825, inwardBankDeg: 0 },
    { x: -2320, y: 29, z: -1835, inwardBankDeg: 0 },
    // Crosby Leap -> Greeba Castle Technical Flowing S-Curves
    { x: -2620, y: 27, z: -1945, inwardBankDeg: 15 },
    { x: -2880, y: 24, z: -1835, inwardBankDeg: 16 },
    { x: -3160, y: 22, z: -1955, inwardBankDeg: 15 },
    { x: -3440, y: 21, z: -1865, inwardBankDeg: 12 },
    // Ballagarey High-Speed Approach into Ballacraine
    { x: -3760, y: 20, z: -1920, inwardBankDeg: 0 },
    { x: -4060, y: 20, z: -1960, inwardBankDeg: 0 },

    // === MS 8-10: Ballacraine (7.7 mi) -> Ballaspur -> Laurel Bank -> Glen Helen Wooded Switchbacks ===
    // BALLACRAINE: Legendary Crisp 6° Flat 90° Right onto A3 North!
    { x: -4210, y: 20, z: -1990, inwardBankDeg: 6 },
    { x: -4265, y: 21, z: -2120, inwardBankDeg: 6 },
    // Ballaspur & Doran's Bend
    { x: -4215, y: 23, z: -2325, inwardBankDeg: 14 },
    { x: -4370, y: 25, z: -2510, inwardBankDeg: 16 },
    { x: -4200, y: 27, z: -2695, inwardBankDeg: 17 },
    // Laurel Bank & Black Dub Technical S-Chain
    { x: -4365, y: 30, z: -2885, inwardBankDeg: 18 },
    { x: -4190, y: 33, z: -3085, inwardBankDeg: 19 },
    // GLEN HELEN: Iconic Double Wooded Valley Switchbacks!
    { x: -4375, y: 37, z: -3280, inwardBankDeg: 20 },
    { x: -4195, y: 41, z: -3475, inwardBankDeg: 19 },
    { x: -4380, y: 46, z: -3670, inwardBankDeg: 18 },
    // Sarah's Cottage Technical Corner -> Creg Willey's Hill Climb!
    { x: -4210, y: 52, z: -3860, inwardBankDeg: 14 },
    { x: -4350, y: 60, z: -4075, inwardBankDeg: 15 },
    { x: -4285, y: 68, z: -4320, inwardBankDeg: 10 },

    // === MS 11-13: Cronk-y-Voddy Straight (+Jump #1) -> Molyneux -> Handley's -> McGuinness's -> Barregarrow ===
    // CRONK-Y-VODDY: 1.8km Ridge Overdrive Straight!
    { x: -4290, y: 74, z: -4740, inwardBankDeg: 0 },
    { x: -4290, y: 73, z: -5180, inwardBankDeg: 0 },
    { x: -4280, y: 68, z: -5560, inwardBankDeg: 0 },
    // Handley's Corner (18° sweeping right-left) -> 13th Milestone
    { x: -4120, y: 58, z: -5775, inwardBankDeg: 18 },
    { x: -4245, y: 48, z: -6005, inwardBankDeg: 18 },
    { x: -4095, y: 40, z: -6225, inwardBankDeg: 15 },
    // Barregarrow Steep Downhill Compression & High-Speed Left-Right
    { x: -4185, y: 30, z: -6490, inwardBankDeg: 14 },
    { x: -4075, y: 24, z: -6790, inwardBankDeg: 0 },
    { x: -4010, y: 21, z: -7090, inwardBankDeg: 0 },

    // === MS 14-16: Kirk Michael Village -> Rhencullen -> Bishopscourt -> Alpine Cottage ===
    // KIRK MICHAEL: Stone-Wall Village Technical S-Chicane (8°-9°)
    { x: -3915, y: 20, z: -7260, inwardBankDeg: 9 },
    { x: -3755, y: 19, z: -7320, inwardBankDeg: 9 },
    { x: -3655, y: 18, z: -7445, inwardBankDeg: 8 },
    // Rhencullen Flying Crest Bends -> Bishopscourt Straight
    { x: -3505, y: 19, z: -7595, inwardBankDeg: 14 },
    { x: -3280, y: 18, z: -7735, inwardBankDeg: 0 },
    { x: -2940, y: 17, z: -7860, inwardBankDeg: 0 },
    // Alpine Cottage Sweeper into Ballaugh Approach
    { x: -2685, y: 17, z: -7985, inwardBankDeg: 12 },
    { x: -2420, y: 16, z: -8040, inwardBankDeg: 0 },

    // === MS 17-19: Ballaugh Bridge (Iconic Jump #2!) -> Ballacrye -> Quarry Bends ===
    // BALLAUGH BRIDGE Approach & FAMOUS HUMPBACK FLYING JUMP!
    { x: -2060, y: 16, z: -8085, inwardBankDeg: 0 },
    { x: -1680, y: 16, z: -8115, inwardBankDeg: 0 },
    // Ballacrye Jump Crest -> QUARRY BENDS Rapid Technical S-Chicane!
    { x: -1465, y: 16, z: -8025, inwardBankDeg: 14 },
    { x: -1275, y: 16, z: -8165, inwardBankDeg: 16 },
    { x: -1075, y: 16, z: -8045, inwardBankDeg: 15 },
    { x: -865, y: 15, z: -8175, inwardBankDeg: 12 },

    // === MS 20-21: SULBY STRAIGHT (2.6km Ultimate Flat-Out OVERDRIVE II Drag Strip!) ===
    { x: -520, y: 15, z: -8200, inwardBankDeg: 0 },
    { x: -40, y: 15, z: -8210, inwardBankDeg: 0 },
    { x: 460, y: 15, z: -8210, inwardBankDeg: 0 },
    { x: 960, y: 15, z: -8205, inwardBankDeg: 0 },
    { x: 1440, y: 15, z: -8190, inwardBankDeg: 0 },

    // === MS 22-23: Sulby Bridge -> Ginger Hall -> Kerrowmoar -> Glen Duff -> Parliament Square ===
    // Sulby Bridge 9° Right-Left -> Ginger Hall
    { x: 1675, y: 15, z: -8105, inwardBankDeg: 9 },
    { x: 1865, y: 15, z: -8195, inwardBankDeg: 11 },
    { x: 2110, y: 15, z: -8135, inwardBankDeg: 0 },
    // KERROWMOAR Dense Country S-Bends (15°-17°)
    { x: 2335, y: 15, z: -8015, inwardBankDeg: 16 },
    { x: 2545, y: 15, z: -8155, inwardBankDeg: 17 },
    { x: 2775, y: 14, z: -8020, inwardBankDeg: 16 },
    { x: 2995, y: 14, z: -8145, inwardBankDeg: 15 },
    // Glen Duff -> Milntown -> Parliament Square Technical Entry into Ramsey
    { x: 3320, y: 14, z: -8085, inwardBankDeg: 0 },
    { x: 3630, y: 14, z: -8055, inwardBankDeg: 10 },
    { x: 3860, y: 14, z: -8115, inwardBankDeg: 8 },
    { x: 4075, y: 14, z: -8025, inwardBankDeg: 8 },

    // === MS 24-25: RAMSEY HAIRPIN -> Stella Maris -> Waterworks -> Tower Bends -> THE GOOSENECK ===
    // RAMSEY HAIRPIN: Legendary Tight Low-Bank 6° 180° Town-to-Mountain Hairpin Right!
    { x: 4215, y: 16, z: -7945, inwardBankDeg: 6 },
    { x: 4255, y: 22, z: -7820, inwardBankDeg: 6 },
    { x: 4135, y: 29, z: -7730, inwardBankDeg: 6 },
    // Stella Maris & Waterworks Climbing S-Switchbacks
    { x: 3930, y: 37, z: -7760, inwardBankDeg: 15 },
    { x: 3750, y: 46, z: -7645, inwardBankDeg: 16 },
    { x: 3560, y: 55, z: -7710, inwardBankDeg: 15 },
    // Tower Bends -> THE GOOSENECK (Iconic Steep Uphill 14° Scenic Hairpin Left!)
    { x: 3395, y: 65, z: -7615, inwardBankDeg: 14 },
    { x: 3380, y: 76, z: -7470, inwardBankDeg: 14 },
    { x: 3525, y: 86, z: -7370, inwardBankDeg: 14 },

    // === MS 26-27: Joey's -> 26th Milestone -> Guthrie's Memorial -> Mountain Mile Approach ===
    // Climbing onto the Open, Wild, Tree-Free A18 Snaefell Mountain Road!
    { x: 3765, y: 96, z: -7295, inwardBankDeg: 18 },
    { x: 3985, y: 106, z: -7135, inwardBankDeg: 22 },
    // 26th Milestone Flowing Upland S-Bends
    { x: 4165, y: 116, z: -6925, inwardBankDeg: 20 },
    { x: 4075, y: 125, z: -6685, inwardBankDeg: 18 },
    // GUTHRIE'S MEMORIAL: Sweeping High-Altitude 24° Corner!
    { x: 4245, y: 134, z: -6455, inwardBankDeg: 24 },
    { x: 4415, y: 142, z: -6205, inwardBankDeg: 22 },
    { x: 4475, y: 149, z: -5915, inwardBankDeg: 0 },

    // === MS 28-29: MOUNTAIN MILE (2.2km High-Altitude Overdrive Climb!) -> Mountain Box -> VERANDAH ===
    { x: 4485, y: 157, z: -5455, inwardBankDeg: 0 },
    { x: 4485, y: 165, z: -4985, inwardBankDeg: 0 },
    { x: 4475, y: 172, z: -4545, inwardBankDeg: 0 },
    // Mountain Box (22°) -> VERANDAH (Legendary 30° Banked Exposed Moorland Sweeper!)
    { x: 4415, y: 177, z: -4275, inwardBankDeg: 24 },
    { x: 4265, y: 181, z: -4065, inwardBankDeg: 30 },
    { x: 4045, y: 184, z: -3985, inwardBankDeg: 30 },
    { x: 3835, y: 186, z: -3865, inwardBankDeg: 26 },
    // Verandah Second Sweeper -> Les Graham Memorial
    { x: 3715, y: 188, z: -3645, inwardBankDeg: 22 },
    { x: 3545, y: 190, z: -3465, inwardBankDeg: 18 },

    // === MS 30-31: THE BUNGALOW Tramway Chicane -> HAILWOOD'S HEIGHT (422m Real / 221m In-Game Summit + Jump #3!) ===
    { x: 3365, y: 191, z: -3325, inwardBankDeg: 10 },
    { x: 3275, y: 192, z: -3155, inwardBankDeg: 9 },
    { x: 3385, y: 192, z: -2965, inwardBankDeg: 10 },
    // HAILWOOD'S HEIGHT SUMMIT STRAIGHT (1.4km Roof-of-the-Island Overdrive + Jump Ramp #3!)
    { x: 3395, y: 192, z: -2605, inwardBankDeg: 0 },
    { x: 3395, y: 190, z: -2225, inwardBankDeg: 0 },
    { x: 3395, y: 184, z: -1845, inwardBankDeg: 0 },

    // === MS 32-33: Brandywell -> 32nd Milestone -> WINDY CORNER -> 33rd Milestone -> Keppel Gate ===
    // Brandywell Sweeping Moorland Descent (20°-24°)
    { x: 3495, y: 172, z: -1565, inwardBankDeg: 20 },
    { x: 3685, y: 158, z: -1325, inwardBankDeg: 24 },
    { x: 3825, y: 144, z: -1055, inwardBankDeg: 22 },
    // WINDY CORNER: Dramatic 28° Banked Exposed Moorland Plunge!
    { x: 3895, y: 130, z: -795, inwardBankDeg: 28 },
    { x: 3795, y: 118, z: -555, inwardBankDeg: 28 },
    { x: 3595, y: 108, z: -415, inwardBankDeg: 26 },
    // 33rd Milestone Fast S-Descent -> Keppel Gate
    { x: 3365, y: 98, z: -265, inwardBankDeg: 20 },
    { x: 3445, y: 88, z: -15, inwardBankDeg: 22 },
    { x: 3245, y: 78, z: 225, inwardBankDeg: 20 },
    // Kate's Cottage High-Speed Descent Chute
    { x: 3045, y: 68, z: 485, inwardBankDeg: 16 },
    { x: 2865, y: 58, z: 765, inwardBankDeg: 0 },
    { x: 2695, y: 50, z: 1045, inwardBankDeg: 0 },

    // === MS 34-35: CREG-NY-BAA (Pub Corner!) -> Gob-ny-Geay (+Jump #4) -> Brandish -> Hillberry ===
    // CREG-NY-BAA: Iconic Crisp 9° Right Sweeper past Whitewashed Creg-ny-Baa Pub!
    { x: 2565, y: 44, z: 1225, inwardBankDeg: 9 },
    { x: 2415, y: 40, z: 1285, inwardBankDeg: 9 },
    // Gob-ny-Geay High-Speed Descent Straight (1.1km + Jump Ramp #4!)
    { x: 2045, y: 38, z: 1295, inwardBankDeg: 0 },
    { x: 1665, y: 37, z: 1295, inwardBankDeg: 0 },
    // BRANDISH (24° sweeping left) -> HILLBERRY (18° sweeping right)
    { x: 1385, y: 36, z: 1185, inwardBankDeg: 24 },
    { x: 1165, y: 35, z: 1325, inwardBankDeg: 20 },
    { x: 925, y: 35, z: 1205, inwardBankDeg: 18 },
    { x: 705, y: 34, z: 1315, inwardBankDeg: 16 },

    // === MS 36-37.73: Cronk-ny-Mona -> Signpost Corner -> Bedstead -> GOVERNOR'S BRIDGE -> Douglas Grandstand ===
    { x: 465, y: 34, z: 1235, inwardBankDeg: 12 },
    // Signpost Corner (11° crisp right) -> Bedstead Approach
    { x: 285, y: 34, z: 1095, inwardBankDeg: 11 },
    { x: 325, y: 34, z: 895, inwardBankDeg: 9 },
    { x: 225, y: 34, z: 735, inwardBankDeg: 9 },
    // GOVERNOR'S BRIDGE: Iconic Tight 6° Final Hairpin!
    { x: 145, y: 34, z: 615, inwardBankDeg: 6 },
    { x: 35, y: 34, z: 575, inwardBankDeg: 6 },
    { x: 0, y: 34, z: 445, inwardBankDeg: 6 },
    // Glencrutchery Road Flat-Out Sprint Past Douglas TT Grandstand!
    { x: 0, y: 34, z: 225, inwardBankDeg: 0 },
  ]),
  boostPads: [
    { t: 0.005, d: 0, length: 38, width: 8.0 },
    { t: 0.022, d: 0, length: 38, width: 8.0 },
    { t: 0.095, d: 0, length: 36, width: 7.8 },
    { t: 0.155, d: 0, length: 36, width: 7.8 },
    { t: 0.254, d: 0, length: 36, width: 7.8 },
    { t: 0.276, d: 0, length: 36, width: 7.8 },
    { t: 0.324, d: 0, length: 36, width: 7.8 },
    { t: 0.362, d: 0, length: 36, width: 7.8 },
    { t: 0.384, d: 0, length: 36, width: 7.8 },
    { t: 0.442, d: 0, length: 40, width: 8.2 },
    { t: 0.462, d: 0, length: 40, width: 8.2 },
    { t: 0.482, d: 0, length: 40, width: 8.2 },
    { t: 0.548, d: 0, length: 36, width: 7.8 },
    { t: 0.674, d: 0, length: 38, width: 8.0 },
    { t: 0.696, d: 0, length: 38, width: 8.0 },
    { t: 0.774, d: 0, length: 38, width: 8.0 },
    { t: 0.793, d: 0, length: 38, width: 8.0 },
    { t: 0.884, d: 0, length: 36, width: 7.8 },
    { t: 0.910, d: 0, length: 36, width: 7.8 },
    { t: 0.994, d: 0, length: 40, width: 8.2 },
  ],
  jumpRamps: [
    { tStart: 0.264, tEnd: 0.2656, height: 3.9, widthRatio: 0.64 },
    { tStart: 0.391, tEnd: 0.3926, height: 4.8, widthRatio: 0.68 },
    { tStart: 0.783, tEnd: 0.7846, height: 4.2, widthRatio: 0.64 },
    { tStart: 0.916, tEnd: 0.9175, height: 3.7, widthRatio: 0.62 },
  ],
  tunnelZones: [],
  coneClusters: [
    { t: 0.040, side: -1, count: 6 },
    { t: 0.062, side: 1, count: 6 },
    { t: 0.165, side: -1, count: 6 },
    { t: 0.205, side: 1, count: 6 },
    { t: 0.290, side: -1, count: 6 },
    { t: 0.330, side: -1, count: 6 },
    { t: 0.390, side: 1, count: 6 },
    { t: 0.478, side: -1, count: 6 },
    { t: 0.548, side: -1, count: 6 },
    { t: 0.585, side: 1, count: 6 },
    { t: 0.700, side: -1, count: 6 },
    { t: 0.742, side: 1, count: 6 },
    { t: 0.822, side: -1, count: 6 },
    { t: 0.892, side: -1, count: 6 },
    { t: 0.972, side: 1, count: 6 },
  ],
};
