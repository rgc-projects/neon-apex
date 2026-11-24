import * as THREE from 'three';
import { CarSpec, InputState, RacerHUDTelemetry, UpcomingCornerInfo } from '../types';
import { SplineSample, TrackSpline } from '../track/TrackSpline';
import { clamp, damp, lerp, signedTrackDelta, wrapDistance } from '../utils/math';
import { CarModel } from './CarModel';

export interface PhysicsEvents {
  onDriftBoost?: (tier: 1 | 2 | 3, distanceMeters: number, points: number) => void;
  onBoostPad?: () => void;
  onJumpLaunch?: () => void;
  onLanding?: (airTime: number, points: number) => void;
  onWallHit?: (worldPos: THREE.Vector3, intensity: number) => void;
  onGearShift?: (newGear: number) => void;
  onLapComplete?: (newLap: number, lapTime: number) => void;
  onRaceFinish?: (totalTime: number) => void;
  onNitroStart?: (isSuper: boolean) => void;
  onOverdriveStage?: (stage: 1 | 2) => void;
  onHyperZoneEnter?: (lengthMeters: number) => void;
}

/**
 * Modern Sim-Cade Slip-Angle Drift Physics (Forza Horizon x OutRun 2 x NFS Heat):
 * - Truly decouples Car Nose Heading (`headingYaw`) from Velocity Travel Direction (`yawOffset`).
 * - Real slip angle `slipAngle = headingYaw - yawOffset` dynamically drives rear-end swing,
 *   counter-steer catch, tire smoke/sparks, and front-wheel counter-steering!
 * - Dual intuitive drift triggers:
 *   1) Hold `Space` / `DRIFT` (Handbrake / Arcade Drift)
 *   2) Tap `S` / `BRAKE` while turning at high speed (>125 km/h) -> Brake-to-Drift!
 * - Track banking (`frame.bank`) applies genuine inward centripetal gravity assist so
 *   steeply banked U-turns naturally sustain high-speed, long-duration drifts!
 */
export class RacerPhysics {
  public readonly id: string;
  public readonly name: string;
  public readonly spec: CarSpec;
  public readonly model: CarModel;
  public readonly isPlayer: boolean;
  public readonly colorHex: string;

  // Curvilinear track-surface + 3D jump coordinates
  public s = 0;            // meters along track spline
  public d = 0;            // lateral offset from centerline (meters, +right, -left)
  public h = 0;            // height above base road surface (meters)
  public vy = 0;           // vertical velocity (m/s)
  public speed = 0;        // velocity magnitude (m/s)

  // Decoupled heading vs velocity vectors (relative to road tangent: +right, -left)
  public yawOffset = 0;    // Velocity travel direction relative to road tangent
  public headingYaw = 0;   // Car nose orientation relative to road tangent
  public slipAngle = 0;    // Real physical drift angle: headingYaw - yawOffset
  private angularVel = 0;  // Yaw rotation rate (rad/s)

  // Arcade Drift & Boost states
  public isDrifting = false;
  public driftDir: -1 | 0 | 1 = 0;
  public driftDuration = 0;
  public driftDistance = 0;
  public driftCharge = 0;  // 0..3
  public driftTier: 0 | 1 | 2 | 3 = 0;
  public miniBoostTimer = 0;
  public miniBoostPower = 0;
  private exitStraightenTimer = 0;
  private brakeTapTimer = 0;
  private brakeDriftLatch = false;
  private switchbackTimer = 0;

  public nitro = 40;       // 0..100
  public isNitroActive = false;
  public isSuperNitro = false;
  public allowDriftNitro = false; // Default OFF: simultaneous Nitro is disabled while drifting
  public enableStraightOverdrive = false; // Default OFF: optional 2-stage auto-overdrive & momentum lock on mega island straights
  public enableHyperNitro = false; // Default OFF: optional infinite-nitro corridors on mega island straightaways
  public boostPadTimer = 0;
  private boostPadCooldown = 0;

  // Global Straightaway Auto-Escalating Overdrive + Zero-Drop Momentum Handoff + Hyper Straight Infinite Nitro
  public straightOverdriveTimer = 0;
  public overdriveStage: 0 | 1 | 2 = 0;
  public inHyperZone = false;
  public hyperZoneRemaining = 0;
  public hyperZoneTotal = 0;
  private lastHyperZoneId = -1;
  private momentumFloor = 0;

  // Slipstream & air states
  public slipstreamLevel = 0;
  public isSlipstreaming = false;
  public isAirborne = false;
  public currentAirTime = 0;
  private wasOnRamp = false;
  private lastRampSlope = 0;
  private airPitch = 0;

  // Visual smoothing states
  public steerSmooth = 0;
  public visualSlipAngle = 0;
  public bodyRoll = 0;
  public bodyPitch = 0;
  public suspensionY = 0;
  public suspensionVel = 0;

  // Engine RPM & Gear simulation
  public gear = 1;
  public rpmNorm = 0.2;

  // Race telemetry & stats
  public lap = 1;
  public totalLaps = 3;
  public totalProgress = 0;
  public rank = 1;
  public finished = false;
  public finishTime: number | null = null;
  public raceTime = 0;
  public lapStartTime = 0;
  public bestLapTime: number | null = null;
  public topSpeedKmh = 0;
  public longestDriftMeters = 0;
  public totalAirTime = 0;
  public styleScore = 0;
  public isWrongWay = false;
  private prevWrappedS = 0;
  public upcomingCorner: UpcomingCornerInfo | null = null;

  // Cached world transform
  public readonly worldPos = new THREE.Vector3();
  public readonly worldForward = new THREE.Vector3(0, 0, -1);
  public readonly worldRight = new THREE.Vector3(1, 0, 0);
  public readonly worldUp = new THREE.Vector3(0, 1, 0);
  public readonly frame: SplineSample = {
    s: 0,
    t: 0,
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(0, 0, -1),
    flatRight: new THREE.Vector3(1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    bank: 0,
    curvature: 0,
  };
  private readonly _lookFrame: SplineSample = {
    s: 0,
    t: 0,
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(0, 0, -1),
    flatRight: new THREE.Vector3(1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    bank: 0,
    curvature: 0,
  };
  private readonly _lookFarFrame: SplineSample = {
    s: 0,
    t: 0,
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(0, 0, -1),
    flatRight: new THREE.Vector3(1, 0, 0),
    right: new THREE.Vector3(1, 0, 0),
    up: new THREE.Vector3(0, 1, 0),
    bank: 0,
    curvature: 0,
  };

  private readonly _basisMat = new THREE.Matrix4();
  private readonly _quatA = new THREE.Quaternion();
  private readonly _quatB = new THREE.Quaternion();
  private readonly _upAxis = new THREE.Vector3(0, 1, 0);
  private readonly _rightAxis = new THREE.Vector3(1, 0, 0);
  private wallCooldown = 0;

  constructor(opts: {
    id: string;
    name: string;
    spec: CarSpec;
    model: CarModel;
    isPlayer: boolean;
    colorHex: string;
    totalLaps: number;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.spec = opts.spec;
    this.model = opts.model;
    this.isPlayer = opts.isPlayer;
    this.colorHex = opts.colorHex;
    this.totalLaps = opts.totalLaps;
  }

  public placeOnGrid(spline: TrackSpline, gridIndex: number): void {
    const row = Math.floor(gridIndex / 2);
    const col = gridIndex % 2 === 0 ? -1 : 1;
    const startOffset = 16 + row * 12.0;
    this.s = wrapDistance(spline.totalLength - startOffset, spline.totalLength);
    this.d = col * 4.2;
    this.h = 0;
    this.vy = 0;
    this.speed = 0;
    this.yawOffset = 0;
    this.headingYaw = 0;
    this.slipAngle = 0;
    this.angularVel = 0;
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftDuration = 0;
    this.driftDistance = 0;
    this.driftCharge = 0;
    this.driftTier = 0;
    this.miniBoostTimer = 0;
    this.exitStraightenTimer = 0;
    this.brakeTapTimer = 0;
    this.brakeDriftLatch = false;
    this.switchbackTimer = 0;
    this.boostPadTimer = 0;
    this.nitro = 40;
    this.isNitroActive = false;
    this.isSuperNitro = false;
    this.straightOverdriveTimer = 0;
    this.overdriveStage = 0;
    this.inHyperZone = false;
    this.hyperZoneRemaining = 0;
    this.hyperZoneTotal = 0;
    this.lastHyperZoneId = -1;
    this.momentumFloor = 0;
    this.slipstreamLevel = 0;
    this.isSlipstreaming = false;
    this.isAirborne = false;
    this.currentAirTime = 0;
    this.wasOnRamp = false;
    this.airPitch = 0;
    this.steerSmooth = 0;
    this.visualSlipAngle = 0;
    this.bodyRoll = 0;
    this.bodyPitch = 0;
    this.suspensionY = 0;
    this.suspensionVel = 0;
    this.gear = 1;
    this.rpmNorm = 0.2;
    this.lap = 1;
    this.totalProgress = -startOffset;
    this.prevWrappedS = this.s;
    this.finished = false;
    this.finishTime = null;
    this.raceTime = 0;
    this.lapStartTime = 0;
    this.bestLapTime = null;
    this.topSpeedKmh = 0;
    this.longestDriftMeters = 0;
    this.totalAirTime = 0;
    this.styleScore = 0;
    this.isWrongWay = false;
    this.upcomingCorner = null;

    this.syncWorldTransform(spline, 0.016, false);
  }

  public resetToTrack(spline: TrackSpline): void {
    this.d = 0;
    this.h = 0.2;
    this.vy = 0;
    this.yawOffset = 0;
    this.headingYaw = 0;
    this.slipAngle = 0;
    this.angularVel = 0;
    this.speed = Math.min(this.speed, 28);
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftTier = 0;
    this.brakeDriftLatch = false;
    this.exitStraightenTimer = 0;
    this.straightOverdriveTimer = 0;
    this.overdriveStage = 0;
    this.inHyperZone = false;
    this.hyperZoneRemaining = 0;
    this.hyperZoneTotal = 0;
    this.lastHyperZoneId = -1;
    this.momentumFloor = 0;
    this.isAirborne = false;
    this.currentAirTime = 0;
    this.isWrongWay = false;
    this.syncWorldTransform(spline, 0.016, false);
  }

  public applyPerfectStart(): void {
    this.speed = Math.max(this.speed, 38);
    this.miniBoostTimer = 1.15;
    this.miniBoostPower = 24;
    this.nitro = Math.min(100, this.nitro + 18);
    this.styleScore += 300;
  }

  public step(
    dt: number,
    input: InputState,
    spline: TrackSpline,
    paceScale: number,
    events?: PhysicsEvents
  ): void {
    this.raceTime += dt;
    if (this.wallCooldown > 0) this.wallCooldown -= dt;
    if (this.boostPadCooldown > 0) this.boostPadCooldown -= dt;
    if (this.exitStraightenTimer > 0) this.exitStraightenTimer = Math.max(0, this.exitStraightenTimer - dt);

    // 1. Steering input smoothing (supports digital keyboard + proportional touch/tilt)
    const digitalSteer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rawSteer =
      digitalSteer !== 0
        ? digitalSteer
        : input.steerAxis !== undefined
          ? clamp(input.steerAxis, -1, 1)
          : 0;
    this.steerSmooth = damp(this.steerSmooth, rawSteer, 12.5, dt);

    if (this.miniBoostTimer > 0) this.miniBoostTimer = Math.max(0, this.miniBoostTimer - dt);
    if (this.boostPadTimer > 0) this.boostPadTimer = Math.max(0, this.boostPadTimer - dt);

    // 2. Road Frame & Upcoming Corner Telemetry Scan (for player HUD callouts!)
    spline.getFrameAtDistance(this.s, this.frame);
    spline.getFrameAtDistance(this.s + 18, this._lookFrame);
    spline.getFrameAtDistance(this.s + 38, this._lookFarFrame);
    if (this.isPlayer) {
      this.upcomingCorner = this.scanUpcomingCorner(spline);
    }

    const effCurv = this.frame.curvature * 0.65 + this._lookFrame.curvature * 0.35;
    const effBank = this.frame.bank * 0.65 + this._lookFrame.bank * 0.35;

    // 4. Dual Drift Trigger: Hold `Space`/DRIFT OR NFS-style `Brake-Tap` while turning!
    if (input.brake) {
      this.brakeTapTimer += dt;
    } else {
      this.brakeTapTimer = 0;
    }

    const groundedForDrift = !this.isAirborne || (this.isDrifting && this.currentAirTime < 0.18);
    const brakeTapInitiates =
      this.isPlayer &&
      input.brake &&
      this.brakeTapTimer < 0.28 &&
      Math.abs(rawSteer) > 0.35 &&
      this.speed > 36;

    // Brake-to-drift stays latched while you hold throttle & maintain slip/steering through the corner
    if (this.brakeDriftLatch) {
      const counterReleased = rawSteer * this.driftDir < -0.55 && Math.abs(this.slipAngle) < 0.14;
      const onStraightNoSteer = Math.abs(effCurv) < 0.0035 && Math.abs(rawSteer) < 0.12 && this.driftDuration > 0.55;
      if (!groundedForDrift || this.speed < 20 || counterReleased || onStraightNoSteer || input.drift) {
        if (!input.drift) this.brakeDriftLatch = false;
      }
    }

    const wantsDrift = input.drift || this.brakeDriftLatch || brakeTapInitiates;
    const canDrift = groundedForDrift && this.speed > 18 && wantsDrift;

    if (canDrift) {
      if (!this.isDrifting) {
        let initDir: -1 | 0 | 1 = 0;
        if (Math.abs(rawSteer) > 0.1) {
          initDir = rawSteer > 0 ? 1 : -1;
        } else if (Math.abs(this.steerSmooth) > 0.14) {
          initDir = this.steerSmooth > 0 ? 1 : -1;
        } else if (Math.abs(effCurv) > 0.0035) {
          initDir = effCurv > 0 ? 1 : -1;
        }

        if (initDir !== 0) {
          this.isDrifting = true;
          this.driftDir = initDir;
          this.driftDuration = 0;
          this.driftDistance = 0;
          this.driftCharge = 0;
          this.driftTier = 0;
          this.exitStraightenTimer = 0;
          if (brakeTapInitiates && !input.drift) {
            this.brakeDriftLatch = true;
          }
          // Authentic weight-transfer initiation kick (rear swings out cleanly!)
          this.suspensionVel = 1.35;
          this.angularVel += initDir * 1.45;
          this.slipAngle = clamp(this.slipAngle + initDir * 0.14, -0.72, 0.72);
          this.switchbackTimer = 0;
        }
      } else {
        // Seamless S-curve Switchback Drift Transition!
        // If you steer hard in the opposite direction as the current bend finishes into an opposite bend,
        // cash in the current drift boost and smoothly flip into the next bend without fighting the lock!
        const opposingSteer = rawSteer * this.driftDir < -0.68;
        const curveExited = this.frame.curvature * this.driftDir < 0.0018;
        const nextOpposite = this._lookFarFrame.curvature * this.driftDir < -0.0046;
        const opposingCorner = effCurv * this.driftDir < -0.0046 || (curveExited && nextOpposite);
        if (opposingSteer && opposingCorner && this.driftDuration > 0.2) {
          this.switchbackTimer += dt;
          if (this.switchbackTimer >= 0.11) {
            if (this.driftDistance > this.longestDriftMeters) {
              this.longestDriftMeters = this.driftDistance;
            }
            if (this.driftTier >= 1) {
              const tier = this.driftTier as 1 | 2 | 3;
              const powers = [0, 10, 16, 23];
              const durations = [0, 0.75, 1.18, 1.65];
              const nitroBonus = [0, 14, 24, 38];
              const points = [0, 180, 420, 780];
              this.miniBoostPower = powers[tier];
              this.miniBoostTimer = durations[tier];
              this.nitro = Math.min(100, this.nitro + nitroBonus[tier]);
              const totalPts = points[tier] + Math.round(this.driftDistance * 1.35);
              this.styleScore += totalPts;
              events?.onDriftBoost?.(tier, this.driftDistance, totalPts);
            }
            this.driftDir = (this.driftDir === 1 ? -1 : 1) as -1 | 1;
            this.driftDuration = 0;
            this.driftDistance = 0;
            this.driftCharge = 0;
            this.driftTier = 0;
            this.switchbackTimer = 0;
            this.suspensionVel = 1.25;
            this.slipAngle = this.driftDir * 0.16;
          }
        } else {
          this.switchbackTimer = 0;
        }
      }
    } else if (this.isDrifting) {
      // Drift Exit! Award Boost & smoothly realign heading -> velocity -> exit straight
      if (this.driftDistance > this.longestDriftMeters) {
        this.longestDriftMeters = this.driftDistance;
      }
      if (this.driftTier >= 1) {
        const tier = this.driftTier as 1 | 2 | 3;
        const powers = [0, 10, 16, 23];
        const durations = [0, 0.75, 1.18, 1.65];
        const nitroBonus = [0, 14, 24, 38];
        const points = [0, 180, 420, 780];

        this.miniBoostPower = powers[tier];
        this.miniBoostTimer = durations[tier];
        this.nitro = Math.min(100, this.nitro + nitroBonus[tier]);
        const distPoints = Math.round(this.driftDistance * 1.35);
        const totalPts = points[tier] + distPoints;
        this.styleScore += totalPts;
        events?.onDriftBoost?.(tier, this.driftDistance, totalPts);
      }
      this.isDrifting = false;
      this.brakeDriftLatch = false;
      this.driftDir = 0;
      this.driftDuration = 0;
      this.driftDistance = 0;
      this.driftCharge = 0;
      this.driftTier = 0;
      // CRITICAL: Keep velocity vector continuous on exit — do NOT snap velocity toward sideways slip nose!
      this.slipAngle = 0;
      this.headingYaw = this.yawOffset;
      this.angularVel = 0;
      this.exitStraightenTimer = 0.55;
    }

    // Track banking aligned with active drift direction (>0 = banked inward!)
    const inwardBankRad = this.isDrifting ? -effBank * this.driftDir : 0;
    const bankNorm = clamp(inwardBankRad / THREE.MathUtils.degToRad(34), 0, 1.15);
    const matchingCorner = this.isDrifting && effCurv * this.driftDir > 0.0014;
    const cornerSharpness = clamp((Math.abs(effCurv) - 0.0038) / 0.024, 0, 1);

    // Drift Charge & Nitro generation driven by ACTUAL physical slipAngle + banking!
    if (this.isDrifting) {
      this.driftDuration += dt;
      this.driftDistance += this.speed * dt;

      const slipFactor = clamp(Math.abs(this.slipAngle) / 0.42, 0.45, 1.55);
      const speedFactor = clamp(this.speed / 62, 0.62, 1.32);
      const cornerBonus = matchingCorner ? 1.22 : 0.65;

      // Track banking controls drift duration & charge rhythm:
      // - Flat 90° corners (bankNorm ~ 0): brisk snap-charge (1.38x) -> crisp Tier 1-2 boost on short 90° bend!
      // - Steep banked U-turns (bankNorm ~ 1): smooth stretched charge (0.78x) across the long 180° bowl -> Tier 3 + 50% bonus Nitro!
      const bankChargePace = 1.38 - clamp(bankNorm, 0, 1) * 0.6;
      this.driftCharge += dt * slipFactor * speedFactor * cornerBonus * bankChargePace * this.spec.driftChargeRate;

      const bankNitroBonus = 1.0 + clamp(bankNorm, 0, 1) * 0.5;
      this.nitro = Math.min(100, this.nitro + dt * 12.0 * slipFactor * bankNitroBonus * this.spec.driftChargeRate);

      if (this.driftCharge >= 2.35) this.driftTier = 3;
      else if (this.driftCharge >= 1.28) this.driftTier = 2;
      else if (this.driftCharge >= 0.42) this.driftTier = 1;
      else this.driftTier = 0;
    }

    // 4.4. Mega Straightaway Circuits (Apex Island, Isle of Man & Super Akina) — TWO INDEPENDENT OPT-IN SWITCHES (both default OFF!):
    // - `enableHyperNitro`: infinite 100% Nitro inside strict arrow-straight corridors (never on serpentine S-bends!)
    // - `enableStraightOverdrive`: 2-stage automatic DRS/Hyper speed boost + zero-drop momentum handoff on clean straights
    // When BOTH are OFF, mega circuits behave with 100% pure classic speed caps & manual Nitro!
    const isMegaCircuit =
      spline.config.theme === 'island' ||
      spline.config.theme === 'manx' ||
      spline.config.theme === 'akina';
    const overdriveAllowed = isMegaCircuit && this.enableStraightOverdrive;
    const hz =
      isMegaCircuit && this.enableHyperNitro && this.totalProgress > 18
        ? spline.getHyperZoneAt(this.s)
        : null;
    this.inHyperZone = hz !== null;
    if (hz) {
      this.hyperZoneRemaining = hz.remainingMeters;
      this.hyperZoneTotal = hz.totalMeters;
      if (hz.zoneId !== this.lastHyperZoneId) {
        this.lastHyperZoneId = hz.zoneId;
        events?.onHyperZoneEnter?.(hz.totalMeters);
      }
    } else {
      this.hyperZoneRemaining = 0;
      this.hyperZoneTotal = 0;
      this.lastHyperZoneId = -1;
    }

    const baseMax = this.spec.maxSpeed * paceScale;
    const prevOverdriveStage = this.overdriveStage;
    // Use smoothed steering + actual yaw angle so brief digital A/D lane corrections NEVER kill Overdrive!
    const steeringCalm = Math.abs(this.steerSmooth) < 0.78 && Math.abs(this.yawOffset) < 0.22;
    const fullThrottleClean =
      input.throttle &&
      !input.brake &&
      !this.isDrifting &&
      !this.isWrongWay &&
      this.wallCooldown <= 0;
    const cleanStraightRun =
      overdriveAllowed &&
      fullThrottleClean &&
      this.speed > baseMax * 0.72 &&
      Math.abs(effCurv) < 0.0068 &&
      steeringCalm;

    if (!overdriveAllowed) {
      this.straightOverdriveTimer = 0;
      this.overdriveStage = 0;
      this.momentumFloor = 0;
    } else if (cleanStraightRun) {
      if (!this.isAirborne) {
        // Nitro / Drift Boost / Hyper Zone rapidly ignite Stage 2 Overdrive so boost handoff has ZERO speed dip!
        const boostIgniting = this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0;
        const chargeMult = this.inHyperZone
          ? 2.8
          : boostIgniting
            ? 2.6
            : this.isSlipstreaming
              ? 1.5
              : 1.0;
        this.straightOverdriveTimer = Math.min(6.0, this.straightOverdriveTimer + dt * chargeMult);

        // Velocity-assisted ignition: once Nitro/Boost already rockets you to Overdrive velocity on a straight, lock the stage in!
        if (boostIgniting || this.inHyperZone) {
          if (this.speed >= baseMax + 24) {
            this.straightOverdriveTimer = Math.max(this.straightOverdriveTimer, 5.25);
          } else if (this.speed >= baseMax + 11) {
            this.straightOverdriveTimer = Math.max(this.straightOverdriveTimer, 2.15);
          }
        }
      }
    } else if (!fullThrottleClean) {
      this.straightOverdriveTimer = 0;
      this.momentumFloor = 0;
    } else if (!this.isAirborne) {
      // Gentle decay on sweeping curves or quick lane weaves so momentum stays fluid
      this.straightOverdriveTimer = Math.max(0, this.straightOverdriveTimer - dt * 0.85);
    }

    this.overdriveStage = overdriveAllowed
      ? this.straightOverdriveTimer >= 5.2
        ? 2
        : this.straightOverdriveTimer >= 2.0
          ? 1
          : 0
      : 0;
    if (this.overdriveStage > prevOverdriveStage && this.overdriveStage >= 1 && !this.inHyperZone) {
      events?.onOverdriveStage?.(this.overdriveStage as 1 | 2);
    }

    // 4.5. Nitro, Hyper Zone Infinite Nitro & Drift Cutoff Logic
    const overdriveRegen = this.overdriveStage === 2 ? 9.2 : this.overdriveStage === 1 ? 6.2 : this.speed > 55 ? 2.0 : 0.4;
    const slipRegen = this.isSlipstreaming ? 13.5 : 0;
    const nitroBlockedByDrift = this.isDrifting && !this.allowDriftNitro;
    const infiniteNitroActive = this.inHyperZone && !nitroBlockedByDrift && !this.isWrongWay;

    if (nitroBlockedByDrift) {
      this.isNitroActive = false;
      this.isSuperNitro = false;
      this.miniBoostTimer = 0;
      this.miniBoostPower = 0;
      this.boostPadTimer = 0;
      this.straightOverdriveTimer = 0;
      this.overdriveStage = 0;
      this.momentumFloor = 0;
      const passive = (this.speed > 55 ? 1.8 : 0.4) + slipRegen;
      this.nitro = Math.min(100, this.nitro + passive * dt);
    } else if (infiniteNitroActive) {
      // Inside a Hyper Straight Zone: Nitro locks at 100% with ZERO drain!
      this.nitro = 100;
      if (input.nitro) {
        if (!this.isNitroActive) {
          this.isSuperNitro = true;
          events?.onNitroStart?.(true);
        }
        this.isNitroActive = true;
        this.isSuperNitro = true;
      } else {
        this.isNitroActive = false;
        this.isSuperNitro = false;
      }
    } else if (input.nitro && this.nitro > (this.isNitroActive ? 0.5 : 12)) {
      if (!this.isNitroActive) {
        this.isSuperNitro = this.nitro >= 82;
        events?.onNitroStart?.(this.isSuperNitro);
      }
      this.isNitroActive = true;
      const drainRate = (this.isSuperNitro ? 26 : 20) / this.spec.nitroCapacity;
      this.nitro = Math.max(0, this.nitro - drainRate * dt);
      if (this.nitro <= 0.5) {
        this.isNitroActive = false;
        this.isSuperNitro = false;
      }
    } else {
      this.isNitroActive = false;
      this.isSuperNitro = false;
      this.nitro = Math.min(100, this.nitro + (overdriveRegen + slipRegen) * dt);
    }

    // 5. Longitudinal Speed, Zero-Drop Momentum Lock, Banking Corner Speed & Slope Gravity
    let boostMaxAdd = 0;
    let boostAccelAdd = 0;

    // Straightaway Overdrive breaks base speed limit smoothly without burning Nitro!
    // Stage 1 (DRS): +52 km/h (~405 km/h); Stage 2 (Hyper): +104 km/h (~460–495 km/h on long straights!)
    if (this.overdriveStage === 2) {
      boostMaxAdd += 29.0;
      boostAccelAdd += 28;
    } else if (this.overdriveStage === 1) {
      boostMaxAdd += 14.5;
      boostAccelAdd += 16;
    }

    if (this.isNitroActive) {
      const nMult = this.spec.nitroPower;
      // Manual Nitro stacks thrillingly on top of Overdrive (515–540 km/h slingshot & Hyper Straight runs!)
      const nitroAdd = (this.isSuperNitro ? 28 : 18) * nMult;
      boostMaxAdd = Math.min(48, boostMaxAdd + nitroAdd * (this.overdriveStage === 2 ? 0.65 : this.overdriveStage === 1 ? 0.82 : 1.0));
      boostAccelAdd += (this.isSuperNitro ? 54 : 36) * nMult;
    }
    if (this.miniBoostTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, this.miniBoostPower);
      boostAccelAdd += 38;
    }
    if (this.boostPadTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, this.overdriveStage === 2 ? 36 : 24);
      boostAccelAdd += 44;
    }
    if (this.isSlipstreaming) {
      boostMaxAdd += 12 * this.slipstreamLevel;
      boostAccelAdd += 20 * this.slipstreamLevel;
    }

    // Zero-Drop Momentum Lock (active only when Straightaway Overdrive switch is ON!)
    const cruiseCap = baseMax + (this.overdriveStage === 2 ? 29.0 : this.overdriveStage === 1 ? 14.5 : 0);
    if (!overdriveAllowed || !fullThrottleClean) {
      this.momentumFloor = 0;
    } else if (this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0 || this.inHyperZone) {
      this.momentumFloor = Math.max(this.momentumFloor, Math.min(this.speed, baseMax + 37));
    } else if (this.momentumFloor > cruiseCap) {
      this.momentumFloor = damp(this.momentumFloor, cruiseCap, 0.2, dt);
    } else {
      this.momentumFloor = cruiseCap;
    }

    // Real slip-angle tire scrub reduced dramatically by steep inward banking!
    let effectiveMaxSpeed = overdriveAllowed
      ? Math.max(baseMax + boostMaxAdd, this.momentumFloor)
      : baseMax + boostMaxAdd;
    if (this.isDrifting) {
      const flatCornerCap = lerp(baseMax * 0.92, baseMax * 0.62, cornerSharpness);
      const bankedCornerCap = lerp(baseMax * 0.97, baseMax * 0.87, cornerSharpness);
      const nitroAllowance = this.isNitroActive ? boostMaxAdd * 0.58 : boostMaxAdd * 0.3;
      const driftCap = lerp(flatCornerCap, bankedCornerCap, clamp(bankNorm, 0, 1)) + nitroAllowance;
      effectiveMaxSpeed = Math.min(effectiveMaxSpeed, driftCap);
    }

    const roadSlopeAccel = -this.frame.tangent.y * 14.5;

    if (!this.isAirborne) {
      if (input.throttle || this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0) {
        const speedRatio = clamp(this.speed / Math.max(effectiveMaxSpeed, 1), 0, 1.3);
        const torqueCurve = Math.max(0.18, 1.15 - speedRatio * 0.88);
        const accel = this.spec.acceleration * paceScale * torqueCurve + boostAccelAdd + roadSlopeAccel;
        if (this.speed < effectiveMaxSpeed) {
          this.speed = Math.min(effectiveMaxSpeed, this.speed + Math.max(4, accel) * dt);
        } else {
          // Ultra-low aerodynamic coasting drag when Overdrive is enabled; classic 2.2 otherwise!
          const scrubLambda =
            this.isDrifting && cornerSharpness > 0.2
              ? 4.4 - clamp(bankNorm, 0, 1) * 1.6
              : overdriveAllowed && fullThrottleClean
                ? 0.35
                : 2.2;
          this.speed = damp(this.speed, effectiveMaxSpeed, scrubLambda, dt);
        }
      } else {
        this.speed = Math.max(0, this.speed - (11 + this.speed * 0.14 - roadSlopeAccel) * dt);
      }

      // Brake-tap initiating a drift shouldn't kill your momentum; sustained braking slows down cleanly
      const hardBraking = input.brake && (!this.brakeDriftLatch || this.brakeTapTimer > 0.28);
      if (hardBraking) {
        if (this.speed > 2) {
          this.speed = Math.max(0, this.speed - 76 * dt);
        } else {
          this.speed = Math.max(-18, this.speed - 24 * dt);
        }
      }
    } else {
      this.speed = Math.max(10, this.speed - 2.2 * dt);
    }

    // 6. Advance Along Spline Using TRUE Velocity Travel Vector (`yawOffset`)
    const cosYaw = Math.cos(this.yawOffset);
    const sinYaw = Math.sin(this.yawOffset);
    const vForwardTrack = this.speed * cosYaw;
    const vLateral = this.speed * sinYaw;

    const radiusFactor = clamp(1 - this.d * this.frame.curvature, 0.42, 1.9);
    const ds = (vForwardTrack * dt) / radiusFactor;

    const prevTangent = this.frame.tangent.clone();
    const prevFlatRight = this.frame.flatRight.clone();

    this.s = wrapDistance(this.s + ds, spline.totalLength);
    this.d += vLateral * dt;

    spline.getFrameAtDistance(this.s, this.frame);
    const dTurnRight = Math.atan2(
      this.frame.tangent.dot(prevFlatRight),
      this.frame.tangent.dot(prevTangent)
    );

    // Both nose heading and velocity travel angle naturally lose `dTurnRight` as road curves away
    this.yawOffset -= dTurnRight;
    this.headingYaw -= dTurnRight;

    // 7. TRUE DECOUPLED HEADING vs VELOCITY VECTOR STEERING & DRIFT PHYSICS!
    if (this.isDrifting && !this.isAirborne) {
      const agility = this.spec.driftControl;
      // mod: +1 steering deeper into drift, 0 neutral hold, -1 counter-steering outward
      const mod = this.steerSmooth * this.driftDir;

      // (A) Real Physical Slip Angle (`headingYaw - yawOffset`):
      // Steering IN opens a heroic 36-42° drift angle; neutral holds ~24°; counter-steering catches to ~12°!
      const desiredSlip = this.driftDir * clamp(0.40 + mod * 0.25 + cornerSharpness * 0.10, 0.14, 0.72);
      this.slipAngle = damp(this.slipAngle, desiredSlip, mod < -0.1 ? 9.0 : 7.0, dt);

      // (B) Smooth Travel Vector Control (`yawOffset`) + Banking Centripetal Stability + Apex Curb Cushion:
      const roadTurnRate = ds > 0.001 ? dTurnRight / dt : 0;
      const sameDirCorner = roadTurnRate * this.driftDir > 0.04;

      // Smooth clearance ramps near inside apex & outside guardrail (lets you hug curbs cleanly without slamming!)
      const signedD = this.d * this.driftDir; // + = inside apex side, - = outside edge
      const innerClearance = clamp((spline.halfWidth - 2.6 - signedD) / 5.5, 0, 1);
      const outerClearance = clamp((spline.halfWidth - 2.6 + signedD) / 5.5, 0, 1);

      // Flat sharp corners carry mild outward centrifugal drift unless you steer in;
      // steeply banked U-turns hold inward naturally via banking gravity!
      const flatOutwardPush = sameDirCorner ? -0.055 * cornerSharpness * (1 - clamp(bankNorm, 0, 1)) : 0;
      const bankInwardAssist = sameDirCorner ? 0.045 * clamp(bankNorm, 0, 1) : 0;

      // Desired lateral travel angle relative to road tangent (in driftDir frame)
      let rawSignedTargetYaw: number;
      if (sameDirCorner) {
        // Inside steer (+1) -> cut smoothly to apex (+0.175 rad); Neutral (0) -> hold arc; Counter (-1) -> widen out (-0.17 rad)
        rawSignedTargetYaw = 0.025 + mod * 0.165 * agility + bankInwardAssist + flatOutwardPush;
      } else {
        // Early drift initiation on straight / before bend -> responsive line setup without wall-slamming
        rawSignedTargetYaw = 0.065 + mod * 0.135 * agility;
      }

      // Apply smooth apex / outer-edge clearance taper so holding steer hugs the curb like silk!
      if (rawSignedTargetYaw > 0) {
        rawSignedTargetYaw *= innerClearance;
      } else {
        rawSignedTargetYaw *= outerClearance;
      }

      const targetYawOffset = clamp(this.driftDir * rawSignedTargetYaw, -0.32, 0.32);

      // Banking boosts arc-tracking stability so high-speed banked bowls feel glued & effortless
      const followRate = sameDirCorner
        ? (5.2 + clamp(bankNorm, 0, 1) * 2.6) * agility
        : 4.8 * agility;
      const counterBoost = mod < -0.15 ? 1.35 : 1.0;

      // Apply smooth velocity vector redirection toward target arc
      this.yawOffset = damp(this.yawOffset, targetYawOffset, followRate * counterBoost, dt);
      this.angularVel = (targetYawOffset - this.yawOffset) * followRate;

      // Car nose heading = travel vector + physical slip angle!
      this.headingYaw = this.yawOffset + this.slipAngle;
    } else {
      // === NORMAL GRIP STEERING ===
      // Crisp, rock-solid straight-line stability + authentic high-speed understeer on sharp bends
      // so drifting (Space OR Brake-Tap) is genuinely faster & tighter through 90° and U-turns!
      const speedSteerScale =
        clamp(Math.abs(this.speed) / 20, 0.25, 1.0) *
        (1.0 - clamp((this.speed - 48) / 74, 0, 0.56));
      const airSteerScale = this.isAirborne ? 0.2 : 1.0;
      const revSign = this.speed >= -0.1 ? 1 : -1;

      const targetGripYawRate = this.steerSmooth * 1.48 * this.spec.handling * speedSteerScale * airSteerScale * revSign;
      this.angularVel = damp(this.angularVel, targetGripYawRate, 15.0, dt);
      this.yawOffset += this.angularVel * dt;
      this.slipAngle = damp(this.slipAngle, 0, 12.0, dt);

      // Mid-air stabilization, smooth post-drift exit straightening, and gentle straight-line centering
      if (this.isAirborne) {
        this.yawOffset = damp(this.yawOffset, 0, 2.8, dt);
      } else if (this.exitStraightenTimer > 0 && Math.abs(rawSteer) < 0.28) {
        this.yawOffset = damp(this.yawOffset, 0, 7.2, dt);
      } else if (Math.abs(rawSteer) < 0.05 && this.speed > 14) {
        this.yawOffset = damp(this.yawOffset, 0, 3.8, dt);
      }

      this.headingYaw = this.yawOffset;
    }

    this.yawOffset = clamp(this.yawOffset, -Math.PI * 0.65, Math.PI * 0.65);
    this.headingYaw = clamp(this.headingYaw, -Math.PI * 0.72, Math.PI * 0.72);
    this.isWrongWay = Math.abs(this.yawOffset) > Math.PI * 0.56 && this.speed > 6;

    // 8. Guardrail Collision & Smooth Wall-Slide Forgiveness
    const maxLat = spline.halfWidth - 1.42;
    if (Math.abs(this.d) > maxLat) {
      const side = Math.sign(this.d);
      this.d = side * maxLat;
      const impactIntensity = clamp(Math.abs(vLateral) / 28, 0.18, 1.0);

      if (side * this.yawOffset > 0) {
        this.yawOffset = -side * (this.isDrifting ? 0.02 : Math.min(0.08, Math.abs(this.yawOffset) * 0.25));
        this.headingYaw = this.yawOffset + this.slipAngle;
      }
      this.speed *= 1 - (this.isDrifting ? 0.04 : 0.085) * impactIntensity;

      if (this.wallCooldown <= 0 && impactIntensity > 0.24) {
        this.wallCooldown = 0.16;
        const hitPos = this.frame.pos
          .clone()
          .addScaledVector(this.frame.right, side * (spline.halfWidth - 0.5))
          .addScaledVector(this.frame.up, this.h + 0.5);
        events?.onWallHit?.(hitPos, impactIntensity);
      }
    }

    // 9. Jump Ramps, Gravity & Airborne Stunt Tracking
    const rampInfo = spline.getRampSurface(this.s, this.d);
    const groundHeight = rampInfo.height;
    const gravity = 34.0;

    if (!this.isAirborne) {
      if (rampInfo.onRamp) {
        this.h = groundHeight;
        this.vy = Math.max(0, vForwardTrack * rampInfo.slope);
        this.wasOnRamp = true;
        this.lastRampSlope = rampInfo.slope;
      } else if (this.wasOnRamp && this.h > 0.35) {
        this.isAirborne = true;
        this.currentAirTime = 0;
        this.vy = clamp(vForwardTrack * Math.max(this.lastRampSlope, 0.22), 12, 20.5);
        this.wasOnRamp = false;
        events?.onJumpLaunch?.();
      } else {
        this.h = 0;
        this.vy = 0;
        this.wasOnRamp = false;
      }
    } else {
      this.currentAirTime += dt;
      this.totalAirTime += dt;
      this.vy -= gravity * dt;
      this.h += this.vy * dt;

      if (this.h <= groundHeight) {
        this.h = groundHeight;
        const landedAir = this.currentAirTime;
        this.isAirborne = false;
        this.vy = 0;
        this.suspensionVel = -clamp(landedAir * 2.4, 0.9, 2.8);
        if (landedAir > 0.45) {
          const airPts = Math.round(landedAir * 420);
          this.styleScore += airPts;
          this.nitro = Math.min(100, this.nitro + clamp(landedAir * 12, 6, 24));
          events?.onLanding?.(landedAir, airPts);
        }
        this.currentAirTime = 0;
      }
    }

    // 10. Boost Pad Detection (still awards nitro + score, and skips flame burst if currently locked in drift!)
    if (!this.isAirborne && this.boostPadCooldown <= 0) {
      const pad = spline.getBoostPadAt(this.s, this.d);
      if (pad) {
        this.boostPadCooldown = 0.85;
        if (!this.isDrifting || this.allowDriftNitro) {
          this.boostPadTimer = 1.15;
          // Boost pads must NEVER slow down a car already running in Overdrive II / Hyper Zone!
          this.speed = Math.max(this.speed, Math.min(baseMax + 46, Math.max(this.speed + 10, baseMax + 22)));
        }
        this.nitro = Math.min(100, this.nitro + 14);
        this.styleScore += 120;
        events?.onBoostPad?.();
      }
    }

    // 11. Lap & Race Progress Tracking
    const deltaWrapped = signedTrackDelta(this.prevWrappedS, this.s, spline.totalLength);
    this.totalProgress += deltaWrapped;
    this.prevWrappedS = this.s;

    const computedLap = Math.floor(this.totalProgress / spline.totalLength) + 1;
    if (!this.finished && computedLap > this.lap && this.totalProgress > 0) {
      const lapDuration = this.raceTime - this.lapStartTime;
      if (this.lap >= 1 && lapDuration > 5) {
        if (this.bestLapTime === null || lapDuration < this.bestLapTime) {
          this.bestLapTime = lapDuration;
        }
      }
      this.lapStartTime = this.raceTime;
      this.lap = computedLap;

      if (this.lap > this.totalLaps) {
        this.lap = this.totalLaps;
        this.finished = true;
        this.finishTime = this.raceTime;
        events?.onRaceFinish?.(this.raceTime);
      } else {
        events?.onLapComplete?.(this.lap, lapDuration);
      }
    }

    // 12. Top Speed, 6-Speed Gearbox & RPM
    const speedKmh = Math.max(0, this.speed * 3.6);
    if (speedKmh > this.topSpeedKmh) this.topSpeedKmh = speedKmh;

    const gearThresholds = [0, 82, 142, 205, 272, 342, 520];
    let newGear = 1;
    for (let g = 1; g <= 6; g++) {
      if (speedKmh >= gearThresholds[g - 1]) newGear = g;
    }
    if (newGear !== this.gear) {
      if (newGear > this.gear) events?.onGearShift?.(newGear);
      this.gear = newGear;
    }
    const gMin = gearThresholds[this.gear - 1];
    const gMax = gearThresholds[this.gear];
    const targetRpm = clamp((speedKmh - gMin * 0.72) / Math.max(gMax - gMin * 0.72, 1), 0.16, 1.0);
    this.rpmNorm = damp(this.rpmNorm, targetRpm, 12, dt);

    // 13. Visual Body Dynamics driven directly by REAL physical `slipAngle`!
    this.visualSlipAngle = damp(this.visualSlipAngle, this.slipAngle, 12.0, dt);

    const targetRoll =
      (this.isDrifting ? this.slipAngle * 0.22 : this.steerSmooth * 0.045) *
      clamp(this.speed / 65, 0.2, 1.15);
    this.bodyRoll = damp(this.bodyRoll, targetRoll, 10, dt);

    const isBoosting = this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0;
    const targetPitch = isBoosting ? 0.04 : input.brake ? -0.055 : input.throttle ? 0.018 : 0;
    this.bodyPitch = damp(this.bodyPitch, targetPitch, 9, dt);

    const springK = 140;
    const springDamp = 14;
    this.suspensionVel += (-springK * this.suspensionY - springDamp * this.suspensionVel) * dt;
    this.suspensionY = clamp(this.suspensionY + this.suspensionVel * dt, -0.18, 0.25);

    const targetAirPitch = this.isAirborne
      ? clamp(this.vy * 0.015, -0.26, 0.34)
      : rampInfo.onRamp
        ? Math.atan(rampInfo.slope)
        : 0;
    this.airPitch = damp(this.airPitch, targetAirPitch, 10, dt);

    // 14. Sync 3D Mesh Transform
    this.syncWorldTransform(spline, dt, input.brake);
  }

  /** Scans 35m..195m ahead for upcoming 90° turns & hairpins to telegraph corner entry cleanly */
  private scanUpcomingCorner(spline: TrackSpline): UpcomingCornerInfo | null {
    let peakAbsK = 0;
    let peakSign: -1 | 1 = 1;
    let firstSign: -1 | 0 | 1 = 0;
    let firstDist = -1;
    let peakBankDeg = 0;
    let totalTurnRad = 0;

    const step = 14;
    for (let dist = 30; dist <= 210; dist += step) {
      spline.getFrameAtDistance(this.s + dist, this._lookFrame);
      const k = this._lookFrame.curvature;
      const absK = Math.abs(k);
      if (absK > 0.0052) {
        const kSign: -1 | 1 = k >= 0 ? 1 : -1;
        if (firstDist < 0) {
          firstDist = dist;
          firstSign = kSign;
        } else if (kSign !== firstSign) {
          // Stop before the next opposite bend of a serpentine S-curve so HUD always telegraphs the IMMEDIATE bend!
          break;
        }
        if (absK > peakAbsK) {
          peakAbsK = absK;
          peakSign = kSign;
        }
        const bDeg = Math.abs(THREE.MathUtils.radToDeg(this._lookFrame.bank));
        if (bDeg > peakBankDeg) peakBankDeg = bDeg;
        if (kSign === peakSign) {
          totalTurnRad += absK * step;
        }
      } else if (firstDist >= 0 && dist - firstDist > 55) {
        break;
      }
    }

    if (firstDist < 0 || peakAbsK < 0.0062) return null;
    return {
      direction: peakSign,
      distanceMeters: Math.round(firstDist),
      isHairpin: totalTurnRad > 1.95,
      bankDeg: Math.round(peakBankDeg),
    };
  }

  public syncWorldTransform(spline: TrackSpline, dt: number, isBraking: boolean): void {
    spline.getFrameAtDistance(this.s, this.frame);

    this.worldPos
      .copy(this.frame.pos)
      .addScaledVector(this.frame.right, this.d)
      .addScaledVector(this.frame.up, this.h);

    this._basisMat.makeBasis(
      this.frame.right,
      this.frame.up,
      this.frame.tangent.clone().negate()
    );
    this._quatA.setFromRotationMatrix(this._basisMat);
    this._quatB.setFromAxisAngle(this._upAxis, -this.yawOffset);
    this._quatA.multiply(this._quatB);

    if (Math.abs(this.airPitch) > 0.001) {
      this._quatB.setFromAxisAngle(this._rightAxis, this.airPitch);
      this._quatA.multiply(this._quatB);
    }

    this.model.root.position.copy(this.worldPos);
    this.model.root.quaternion.copy(this._quatA);

    this.worldForward.set(0, 0, -1).applyQuaternion(this._quatA).normalize();
    this.worldRight.set(1, 0, 0).applyQuaternion(this._quatA).normalize();
    this.worldUp.set(0, 1, 0).applyQuaternion(this._quatA).normalize();

    const boostIntensity = this.isNitroActive
      ? this.isSuperNitro
        ? 1.45
        : 1.05
      : this.miniBoostTimer > 0 || this.boostPadTimer > 0
        ? 0.9
        : this.overdriveStage === 2
          ? 1.05
          : this.overdriveStage === 1
            ? 0.52
            : 0;

    this.model.updateVisuals({
      dt,
      speed: this.speed,
      steerVisual: this.steerSmooth,
      visualSlipAngle: this.visualSlipAngle,
      bodyRoll: this.bodyRoll,
      bodyPitch: this.bodyPitch,
      suspensionY: this.suspensionY,
      isBraking,
      isDrifting: this.isDrifting,
      boostIntensity,
      isSuperNitro: this.isSuperNitro || (!this.isNitroActive && this.overdriveStage >= 1),
      overdriveStage: this.overdriveStage,
    });
  }

  public getTelemetry(totalRacers: number): RacerHUDTelemetry {
    return {
      speedKmh: Math.round(Math.max(0, this.speed * 3.6)),
      rpmNorm: this.rpmNorm,
      gear: this.gear,
      nitro: this.nitro,
      isNitroActive: this.isNitroActive,
      isSuperNitro: this.isSuperNitro,
      nitroLockedByDrift: this.isDrifting && !this.allowDriftNitro,
      overdriveStage: this.overdriveStage,
      overdriveProgress: clamp(this.straightOverdriveTimer / 5.2, 0, 1),
      inHyperZone: this.inHyperZone,
      hyperZoneRemaining: Math.round(this.hyperZoneRemaining),
      isDrifting: this.isDrifting,
      driftTier: this.driftTier,
      driftChargeNorm: clamp(this.driftCharge / 2.35, 0, 1),
      driftDistance: Math.round(this.driftDistance),
      driftAngleDeg: Math.round(Math.abs(THREE.MathUtils.radToDeg(this.slipAngle))),
      bankAngleDeg: Math.round(THREE.MathUtils.radToDeg(Math.abs(this.frame.bank))),
      upcomingCorner: this.upcomingCorner,
      isAirborne: this.isAirborne,
      airTime: this.currentAirTime,
      isSlipstreaming: this.isSlipstreaming,
      isWrongWay: this.isWrongWay,
      lap: Math.min(this.lap, this.totalLaps),
      totalLaps: this.totalLaps,
      rank: this.rank,
      totalRacers,
      raceTime: this.raceTime,
      bestLapTime: this.bestLapTime,
      styleScore: this.styleScore,
    };
  }
}

/** Updates slipstream status for every racer & resolves car-to-car impacts */
export function resolveMultiCarInteractions(
  racers: RacerPhysics[],
  spline: TrackSpline,
  dt: number,
  onCarImpact?: (midPoint: THREE.Vector3, intensity: number, involvesPlayer: boolean) => void
): void {
  const L = spline.totalLength;

  for (const r of racers) {
    let drafting = false;
    if (r.speed > 45 && !r.isAirborne && !r.isWrongWay) {
      for (const other of racers) {
        if (other === r) continue;
        const ds = signedTrackDelta(r.s, other.s, L);
        if (ds > 5.5 && ds < 80 && Math.abs(other.d - r.d) < 4.6 && Math.abs(other.h - r.h) < 2.4) {
          drafting = true;
          break;
        }
      }
    }
    r.slipstreamLevel = damp(r.slipstreamLevel, drafting ? 1 : 0, drafting ? 3.5 : 5.0, dt);
    r.isSlipstreaming = r.slipstreamLevel > 0.35;
  }

  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i];
      const b = racers[j];
      const ds = signedTrackDelta(a.s, b.s, L);
      const dd = b.d - a.d;
      const dh = Math.abs(b.h - a.h);

      if (Math.abs(ds) < 4.55 && Math.abs(dd) < 2.25 && dh < 1.7) {
        const overlapS = 4.55 - Math.abs(ds);
        const overlapD = 2.25 - Math.abs(dd);
        const involvesPlayer = a.isPlayer || b.isPlayer;

        if (overlapD < overlapS) {
          const pushDir = dd >= 0 ? 1 : -1;
          const push = overlapD * 0.55;
          a.d -= pushDir * push;
          b.d += pushDir * push;
          a.yawOffset -= pushDir * 0.04;
          b.yawOffset += pushDir * 0.04;
        } else {
          const dir = ds >= 0 ? 1 : -1;
          const push = overlapS * 0.52;
          a.s = wrapDistance(a.s - dir * push, L);
          b.s = wrapDistance(b.s + dir * push, L);

          const avgSpeed = (a.speed + b.speed) * 0.5;
          a.speed = a.speed * 0.55 + avgSpeed * 0.45 - dir * 2.5;
          b.speed = b.speed * 0.55 + avgSpeed * 0.45 + dir * 2.5;
        }

        const mid = a.worldPos.clone().lerp(b.worldPos, 0.5);
        mid.y += 0.6;
        const relSpeed = Math.abs(a.speed - b.speed);
        const intensity = clamp(0.35 + relSpeed / 40, 0.3, 1.0);
        onCarImpact?.(mid, intensity, involvesPlayer);
      }
    }
  }
}
