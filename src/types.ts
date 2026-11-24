export type GameState = 'MENU' | 'COUNTDOWN' | 'RACING' | 'PAUSED' | 'FINISH_SLOWMO' | 'RESULTS';
export type CameraMode = 'CHASE' | 'HOOD';
export type TrackTheme = 'city' | 'bridge' | 'tunnel' | 'mountain';

export interface CarSpec {
  id: string;
  name: string;
  subtitle: string;
  archetype: 'BALANCED' | 'TOP SPEED' | 'DRIFT MASTER';
  archetypeZh: string;
  description: string;
  // Colors
  primaryColor: number;
  secondaryColor: number;
  neonColor: number;
  neonHex: string;
  primaryHex: string;
  bodyStyle: 'interceptor' | 'phantom' | 'katana';
  // Gameplay Physics Parameters
  maxSpeed: number;        // m/s (1 m/s = 3.6 km/h, e.g. 96 m/s = 345 km/h base, 430+ with nitro)
  acceleration: number;    // m/s^2
  handling: number;        // steering responsiveness
  driftControl: number;    // cornering agility & stability during drift
  driftChargeRate: number; // multiplier on drift boost/nitro charging
  nitroPower: number;      // extra speed & accel under nitro
  nitroCapacity: number;   // drain duration multiplier
  // Display stats (0..100)
  stats: {
    speed: number;
    accel: number;
    drift: number;
    nitro: number;
  };
}

export interface ControlPointDef {
  x: number;
  y: number;
  z: number;
  /** Optional explicit inward corner banking angle in degrees (0 = flat street corner, 34 = steep Karussell bowl) */
  inwardBankDeg?: number;
}

export interface TrackZone {
  tStart: number; // 0..1 normalized along spline
  tEnd: number;
}

export interface BoostPadDef {
  t: number;      // 0..1 position along spline
  d: number;      // lateral offset in meters (-halfWidth..+halfWidth)
  length: number; // meters
  width: number;  // meters
}

export interface JumpRampDef {
  tStart: number;
  tEnd: number;
  height: number; // peak ramp elevation above road deck (meters)
  widthRatio: number; // e.g., 0.72 of road width
}

export interface TrackConfig {
  id: string;
  name: string;
  nameZh: string;
  theme: TrackTheme;
  difficulty: 'MEDIUM' | 'HARD' | 'EXTREME';
  description: string;
  roadWidth: number;
  maxBankDeg: number;
  laps: number;
  // Colors & lighting
  skyTopHex: string;
  skyMidHex: string;
  skyHorizonHex: string;
  sunColorHex: string;
  fogColor: number;
  fogDensity: number;
  railLeftColor: number;
  railRightColor: number;
  accentColorHex: string;
  asphaltTint: string;
  // Geometry
  points: ControlPointDef[];
  boostPads: BoostPadDef[];
  jumpRamps: JumpRampDef[];
  tunnelZones: TrackZone[];
  coneClusters: { t: number; side: -1 | 1; count: number }[];
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  nitro: boolean;
  /** Optional analog steering (-1..+1) from touch slide pad or phone gyroscope */
  steerAxis?: number;
}

export interface UpcomingCornerInfo {
  direction: -1 | 1;     // -1 left, +1 right
  distanceMeters: number;
  isHairpin: boolean;
  bankDeg: number;
}

export interface RacerHUDTelemetry {
  speedKmh: number;
  rpmNorm: number;       // 0..1
  gear: number;          // 1..6
  nitro: number;         // 0..100
  isNitroActive: boolean;
  isSuperNitro: boolean;
  nitroLockedByDrift: boolean;
  isDrifting: boolean;
  driftTier: 0 | 1 | 2 | 3;
  driftChargeNorm: number;
  driftDistance: number;
  driftAngleDeg: number; // live physical slip angle in degrees
  bankAngleDeg: number;  // current absolute road banking angle in degrees
  upcomingCorner: UpcomingCornerInfo | null;
  isAirborne: boolean;
  airTime: number;
  isSlipstreaming: boolean;
  isWrongWay: boolean;
  lap: number;
  totalLaps: number;
  rank: number;
  totalRacers: number;
  raceTime: number;
  bestLapTime: number | null;
  styleScore: number;
}

export interface RacerStanding {
  id: string;
  name: string;
  carName: string;
  colorHex: string;
  isPlayer: boolean;
  rank: number;
  finished: boolean;
  finishTime: number | null;
  totalProgress: number;
}

export interface RaceResults {
  rank: number;
  totalRacers: number;
  totalTime: number;
  bestLapTime: number | null;
  topSpeedKmh: number;
  longestDriftMeters: number;
  totalAirTime: number;
  styleScore: number;
  standings: RacerStanding[];
}
