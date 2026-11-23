import * as THREE from 'three';
import { CarSpec, InputState, RacerHUDTelemetry } from '../types';
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
}

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
  public speed = 0;        // forward velocity magnitude (m/s)
  public yawOffset = 0;    // velocity travel heading offset vs road tangent (+right, -left)

  // Arcade Drift & Boost states (Mario Kart x Ridge Racer x NFS hybrid)
  public isDrifting = false;
  public driftDir: -1 | 0 | 1 = 0;
  public driftDuration = 0;
  public driftDistance = 0;
  public driftCharge = 0; // 0..3
  public driftTier: 0 | 1 | 2 | 3 = 0;
  public miniBoostTimer = 0;
  public miniBoostPower = 0;
  private exitStraightenTimer = 0;

  public nitro = 40;       // 0..100
  public isNitroActive = false;
  public isSuperNitro = false;
  public boostPadTimer = 0;
  private boostPadCooldown = 0;

  // Slipstream & air states
  public slipstreamLevel = 0;
  public isSlipstreaming = false;
  public isAirborne = false;
  public currentAirTime = 0;
  private wasOnRamp = false;
  private lastRampSlope = 0;
  private airPitch = 0;

  // Visual smoothing states (decoupled car nose slip angle vs travel vector!)
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

  // Cached world transform for cameras, AI, VFX, collisions
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
    const startOffset = 14 + row * 11.5;
    this.s = wrapDistance(spline.totalLength - startOffset, spline.totalLength);
    this.d = col * 3.8;
    this.h = 0;
    this.vy = 0;
    this.speed = 0;
    this.yawOffset = 0;
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftDuration = 0;
    this.driftDistance = 0;
    this.driftCharge = 0;
    this.driftTier = 0;
    this.miniBoostTimer = 0;
    this.exitStraightenTimer = 0;
    this.boostPadTimer = 0;
    this.nitro = 40;
    this.isNitroActive = false;
    this.isSuperNitro = false;
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

    this.syncWorldTransform(spline, 0.016, false);
  }

  public resetToTrack(spline: TrackSpline): void {
    this.d = 0;
    this.h = 0.2;
    this.vy = 0;
    this.yawOffset = 0;
    this.speed = Math.min(this.speed, 28);
    this.isDrifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftTier = 0;
    this.exitStraightenTimer = 0;
    this.isAirborne = false;
    this.currentAirTime = 0;
    this.isWrongWay = false;
    this.syncWorldTransform(spline, 0.016, false);
  }

  public applyPerfectStart(): void {
    this.speed = Math.max(this.speed, 38);
    this.miniBoostTimer = 1.15;
    this.miniBoostPower = 26;
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

    // 1. Steering input smoothing (supports both digital keyboard and smooth analog touch/tilt)
    const digitalSteer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rawSteer =
      digitalSteer !== 0
        ? digitalSteer
        : input.steerAxis !== undefined
          ? clamp(input.steerAxis, -1, 1)
          : 0;
    this.steerSmooth = damp(this.steerSmooth, rawSteer, 13.0, dt);

    // 2. Nitro activation & Super Nitro logic
    if (input.nitro && this.nitro > (this.isNitroActive ? 0.5 : 12)) {
      if (!this.isNitroActive) {
        this.isSuperNitro = this.nitro >= 82;
        events?.onNitroStart?.(this.isSuperNitro);
      }
      this.isNitroActive = true;
      const drainRate = (this.isSuperNitro ? 28 : 22) / this.spec.nitroCapacity;
      this.nitro = Math.max(0, this.nitro - drainRate * dt);
      if (this.nitro <= 0.5) {
        this.isNitroActive = false;
        this.isSuperNitro = false;
      }
    } else {
      this.isNitroActive = false;
      this.isSuperNitro = false;
      const passive = (this.speed > 55 ? 2.0 : 0.5) + (this.isSlipstreaming ? 8.5 : 0);
      this.nitro = Math.min(100, this.nitro + passive * dt);
    }

    if (this.miniBoostTimer > 0) this.miniBoostTimer = Math.max(0, this.miniBoostTimer - dt);
    if (this.boostPadTimer > 0) this.boostPadTimer = Math.max(0, this.boostPadTimer - dt);

    // 3. Sample road frame & lookahead corner geometry
    spline.getFrameAtDistance(this.s, this.frame);
    spline.getFrameAtDistance(this.s + 14, this._lookFrame);

    // Effective corner curvature blends immediate road + slight lookahead so turn-in feels anticipatory!
    const effCurv = this.frame.curvature * 0.62 + this._lookFrame.curvature * 0.38;
    const effBank = this.frame.bank * 0.65 + this._lookFrame.bank * 0.35;

    // 4. Mature Corner-Flow Arcade Drift State Machine
    // Allow tiny micro-crest airtime (<0.18s) without cancelling an active drift!
    const groundedForDrift = !this.isAirborne || (this.isDrifting && this.currentAirTime < 0.18);
    const canDrift = groundedForDrift && this.speed > 18 && input.drift;

    if (canDrift) {
      if (!this.isDrifting) {
        // Effortless initiation: uses player steer direction, OR auto-locks to upcoming corner direction if pressing Drift early!
        let initDir: -1 | 0 | 1 = 0;
        if (Math.abs(rawSteer) > 0.1) {
          initDir = rawSteer > 0 ? 1 : -1;
        } else if (Math.abs(this.steerSmooth) > 0.14) {
          initDir = this.steerSmooth > 0 ? 1 : -1;
        } else if (Math.abs(effCurv) > 0.004) {
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
          // Playful Mario-Kart style initiation micro-hop!
          this.suspensionVel = 1.45;
        }
      }
    } else if (this.isDrifting) {
      // Released drift -> Snap-Straight Exit Recovery + Drift Boost!
      if (this.driftDistance > this.longestDriftMeters) {
        this.longestDriftMeters = this.driftDistance;
      }
      if (this.driftTier >= 1) {
        const tier = this.driftTier as 1 | 2 | 3;
        // Balanced arcade boost bursts: punchy & exhilarating without throwing you uncontrollably into the next bend
        const powers = [0, 10, 16, 22];
        const durations = [0, 0.72, 1.15, 1.6];
        const nitroBonus = [0, 14, 24, 38];
        const points = [0, 180, 420, 780];

        this.miniBoostPower = powers[tier];
        this.miniBoostTimer = durations[tier];
        this.nitro = Math.min(100, this.nitro + nitroBonus[tier]);
        const distPoints = Math.round(this.driftDistance * 1.5);
        const totalPts = points[tier] + distPoints;
        this.styleScore += totalPts;
        events?.onDriftBoost?.(tier, this.driftDistance, totalPts);
      }
      this.isDrifting = false;
      this.driftDir = 0;
      this.driftDuration = 0;
      this.driftDistance = 0;
      this.driftCharge = 0;
      this.driftTier = 0;
      this.exitStraightenTimer = 0.52;
    }

    // Inward bank angle aligned with active drift direction (>0 = banked inward like a bowl!)
    const inwardBankRad = this.isDrifting ? -effBank * this.driftDir : 0;
    const bankNorm = clamp(inwardBankRad / THREE.MathUtils.degToRad(34), 0, 1.15);
    const matchingCorner = this.isDrifting && effCurv * this.driftDir > 0.0018;
    const cornerSharpness = clamp((Math.abs(effCurv) - 0.0045) / 0.03, 0, 1);

    if (this.isDrifting) {
      this.driftDuration += dt;
      this.driftDistance += this.speed * dt;

      // Steering into the apex charges faster; counter-steering widens line while keeping drift alive
      const mod = this.steerSmooth * this.driftDir; // +1 into drift, -1 counter-steer
      const steerBonus = mod > 0.2 ? 1.4 : mod < -0.2 ? 0.72 : 1.05;
      const speedFactor = clamp(this.speed / 62, 0.65, 1.3);
      const cornerBonus = matchingCorner ? 1.2 : 0.7;

      // Track banking angle controls drift charge tempo & duration:
      // - Flat 90° street corners (bankNorm ~ 0): brisk snap charge (1.42x) -> Tier 1/2 in ~0.9-1.4s!
      // - Steep banked U-turn bowls (bankNorm ~ 1): stretched smooth pace (0.82x) across the full 180° bowl -> Tier 3 Purple + 50% bonus Nitro!
      const bankChargePace = 1.42 - clamp(bankNorm, 0, 1) * 0.6;
      this.driftCharge += dt * steerBonus * speedFactor * cornerBonus * bankChargePace * this.spec.driftChargeRate;

      const bankNitroBonus = 1.0 + clamp(bankNorm, 0, 1) * 0.5;
      this.nitro = Math.min(100, this.nitro + dt * 13.0 * steerBonus * bankNitroBonus * this.spec.driftChargeRate);

      if (this.driftCharge >= 2.35) this.driftTier = 3;
      else if (this.driftCharge >= 1.28) this.driftTier = 2;
      else if (this.driftCharge >= 0.44) this.driftTier = 1;
      else this.driftTier = 0;
    }

    // 5. Longitudinal Speed, Banking-Tuned Drift Cornering Speed & Road Slope Gravity
    const baseMax = this.spec.maxSpeed * paceScale;
    let boostMaxAdd = 0;
    let boostAccelAdd = 0;

    if (this.isNitroActive) {
      const nMult = this.spec.nitroPower;
      boostMaxAdd += (this.isSuperNitro ? 28 : 18) * nMult;
      boostAccelAdd += (this.isSuperNitro ? 54 : 36) * nMult;
    }
    if (this.miniBoostTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, this.miniBoostPower);
      boostAccelAdd += 38;
    }
    if (this.boostPadTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, 22);
      boostAccelAdd += 44;
    }
    if (this.isSlipstreaming) {
      boostMaxAdd += 11 * this.slipstreamLevel;
      boostAccelAdd += 18 * this.slipstreamLevel;
    }

    // Banking-controlled sweet-spot cornering speed while drifting:
    // - Flat tight 90° / hairpin (bankNorm=0, sharp=1): scrubs smoothly to ~56 m/s (202 km/h) -> super crisp snap drift!
    // - Moderate banked turn (bankNorm=0.5, sharp=1): ~68 m/s (245 km/h) -> rhythmic medium drift!
    // - Steep 34° banked U-turn bowl (bankNorm=1, sharp=1): holds ~81 m/s (292 km/h) -> epic rollercoaster slingshot!
    let effectiveMaxSpeed = baseMax + boostMaxAdd;
    if (this.isDrifting) {
      const flatCornerCap = lerp(baseMax * 0.9, baseMax * 0.56, cornerSharpness);
      const bankedCornerCap = lerp(baseMax * 0.96, baseMax * 0.82, cornerSharpness);
      const nitroCornerAllowance = this.isNitroActive ? boostMaxAdd * 0.55 : boostMaxAdd * 0.25;
      const driftCap = lerp(flatCornerCap, bankedCornerCap, clamp(bankNorm, 0, 1)) + nitroCornerAllowance;
      effectiveMaxSpeed = Math.min(effectiveMaxSpeed, driftCap);
    }

    // Downhill / uphill slope acceleration (Mount Akina downhill hairpins!)
    const roadSlopeAccel = -this.frame.tangent.y * 14.0;

    if (!this.isAirborne) {
      if (input.throttle || this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0) {
        const speedRatio = clamp(this.speed / Math.max(effectiveMaxSpeed, 1), 0, 1.3);
        const torqueCurve = Math.max(0.18, 1.15 - speedRatio * 0.88);
        const accel = this.spec.acceleration * paceScale * torqueCurve + boostAccelAdd + roadSlopeAccel;
        if (this.speed < effectiveMaxSpeed) {
          this.speed = Math.min(effectiveMaxSpeed, this.speed + Math.max(4, accel) * dt);
        } else {
          // Crisp corner-entry speed scrub so even 380 km/h entries settle cleanly into a hairpin drift!
          const scrubLambda = this.isDrifting && cornerSharpness > 0.25 ? 5.2 - clamp(bankNorm, 0, 1) * 1.8 : 2.6;
          this.speed = damp(this.speed, effectiveMaxSpeed, Math.max(1.5, scrubLambda), dt);
        }
      } else {
        this.speed = Math.max(0, this.speed - (11 + this.speed * 0.14 - roadSlopeAccel) * dt);
      }

      if (input.brake) {
        if (this.speed > 2) {
          this.speed = Math.max(0, this.speed - 78 * dt);
        } else {
          this.speed = Math.max(-18, this.speed - 24 * dt);
        }
      }
    } else {
      this.speed = Math.max(10, this.speed - 2.2 * dt);
    }

    // 6. Advance Along Spline & Apply Corner-Flow Drift Physics vs Grip Understeer!
    const cosYaw = Math.cos(this.yawOffset);
    const sinYaw = Math.sin(this.yawOffset);
    const vForwardTrack = this.speed * cosYaw;
    const vLateral = this.speed * sinYaw;

    // Inside lane covers corners faster (true racing line geometry!)
    const radiusFactor = clamp(1 - this.d * this.frame.curvature, 0.42, 1.9);
    const ds = (vForwardTrack * dt) / radiusFactor;

    const prevTangent = this.frame.tangent.clone();
    const prevFlatRight = this.frame.flatRight.clone();

    this.s = wrapDistance(this.s + ds, spline.totalLength);
    this.d += vLateral * dt;

    // Measure actual road rotation over ds
    spline.getFrameAtDistance(this.s, this.frame);
    const dTurnRight = Math.atan2(
      this.frame.tangent.dot(prevFlatRight),
      this.frame.tangent.dot(prevTangent)
    );

    if (this.isDrifting && !this.isAirborne) {
      // === MATURE ARCADE CORNER-FLOW DRIFT STEERING (Ridge Racer x Mario Kart x OutRun) ===
      const mod = this.steerSmooth * this.driftDir;
      const agility = this.spec.driftControl;
      const apexLine = spline.halfWidth - 3.9;  // ideal inner apex lane (clean margin off inner curb)
      const outerLine = spline.halfWidth - 3.6; // safe outer drift cushion
      const signedD = this.d * this.driftDir;   // + = inside of corner, - = outside of corner

      if (matchingCorner) {
        // Inside a matching corner: smooth arc magnetism absorbs centrifugal throw while letting player
        // carve anywhere from the inner apex curb (+mod) to the outer lane (-mod)!
        let targetTravelYaw = 0;
        if (mod > 0.05) {
          const distToApex = apexLine - signedD;
          const diveRate = clamp(distToApex / 8.5, -0.18, 1.0);
          targetTravelYaw = this.driftDir * diveRate * mod * (0.34 - clamp(bankNorm, 0, 1) * 0.04) * agility;
        } else if (mod < -0.05) {
          const distToOuter = outerLine + signedD;
          const widenRate = clamp(distToOuter / 8.5, -0.15, 1.0);
          targetTravelYaw = this.driftDir * widenRate * mod * 0.28 * agility;
        } else {
          // Neutral drift hold: ultra-smooth glide along your chosen lane
          const edgeRecover = signedD < -outerLine ? clamp((-outerLine - signedD) / 4, 0, 1) * 0.18 : 0;
          targetTravelYaw = this.driftDir * (0.015 + clamp(bankNorm, 0, 1) * 0.025 + edgeRecover);
        }

        // Outer-bank catch: if drifting near the outer rail on a fast late entry, gently pull inward so you surf the outer edge instead of hitting the wall!
        if (signedD < -(spline.halfWidth - 3.8) && mod >= -0.2) {
          const catchBoost = clamp((-(spline.halfWidth - 3.8) - signedD) / 2.6, 0, 1);
          targetTravelYaw += this.driftDir * catchBoost * 0.24;
        }

        // Only apply a tiny centrifugal push if player is NOT actively steering into the turn
        const centrifugalRatio = mod > 0.25 ? 0.0 : (1 - (0.93 + clamp(bankNorm, 0, 1) * 0.06));
        this.yawOffset -= centrifugalRatio * dTurnRight;

        // Extra snappy turn-in catch during first 0.35s of drift so late entries bite cleanly!
        const entrySnap = this.driftDuration < 0.35 ? 4.2 : 0;
        const trackLambda = 8.4 + clamp(bankNorm, 0, 1) * 2.2 + entrySnap;
        this.yawOffset = damp(this.yawOffset, targetTravelYaw, trackLambda, dt);
      } else {
        // Drifting on a straightaway (setting up early entry before Turn 1) or S-curve transition
        this.yawOffset -= dTurnRight * 0.65;
        const safeEdge = spline.halfWidth - 3.8;
        const edgeRoom = clamp((safeEdge - signedD) / 7.5, -0.15, 1.0);
        const rawStraightYaw = (0.07 + mod * 0.17) * agility;
        const straightTargetYaw = this.driftDir * (rawStraightYaw > 0 ? rawStraightYaw * edgeRoom : rawStraightYaw);
        this.yawOffset = damp(this.yawOffset, straightTargetYaw, 6.2, dt);
      }
    } else {
      // === NORMAL GRIP STEERING ===
      // Responsive on straights & gentle curves, realistic high-speed understeer on tight 90°/180° hairpins
      // so using DRIFT is unmistakably faster and cleaner!
      this.yawOffset -= dTurnRight;

      const speedSteerScale =
        clamp(Math.abs(this.speed) / 20, 0.25, 1.0) *
        (1.0 - clamp((this.speed - 45) / 70, 0, 0.58));
      const airSteerScale = this.isAirborne ? 0.22 : 1.0;
      const revSign = this.speed >= -0.1 ? 1 : -1;
      const gripYawRate = this.steerSmooth * 1.42 * this.spec.handling * speedSteerScale * airSteerScale * revSign;
      this.yawOffset += gripYawRate * dt;

      // Snap-Straight Exit Recovery right after releasing a drift (like Mario Kart / Burnout!)
      if (this.isAirborne) {
        // Gentle mid-air yaw stabilization so high-speed ramp jumps land cleanly down the road!
        this.yawOffset = damp(this.yawOffset, 0, 2.6, dt);
      } else if (this.exitStraightenTimer > 0 && Math.abs(rawSteer) < 0.25) {
        this.yawOffset = damp(this.yawOffset, 0, 7.5, dt);
      } else if (Math.abs(rawSteer) < 0.05 && this.speed > 14) {
        this.yawOffset = damp(this.yawOffset, 0, 2.0, dt);
      }
    }

    this.yawOffset = clamp(this.yawOffset, -Math.PI * 0.68, Math.PI * 0.68);
    this.isWrongWay = Math.abs(this.yawOffset) > Math.PI * 0.56 && this.speed > 6;

    // 7. Guardrail Collision & Smooth Drift Wall-Cushion (Zero Frustrating Pinball!)
    const maxLat = spline.halfWidth - 1.38;
    if (Math.abs(this.d) > maxLat) {
      const side = Math.sign(this.d);
      this.d = side * maxLat;
      const impactIntensity = clamp(Math.abs(vLateral) / 28, 0.18, 1.0);

      // Smoothly guide travel vector parallel to guardrail so car slides cleanly instead of bouncing/wedging
      if (side * this.yawOffset > 0) {
        this.yawOffset = -side * (this.isDrifting ? 0.02 : Math.min(0.08, Math.abs(this.yawOffset) * 0.25));
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

    // 8. Jump Ramps, Gravity & Airborne Stunt Tracking
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
        // Capped heroic arcade leap (~0.9s..1.35s hangtime) so jumps never overshoot the next corner!
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

    // 9. Boost Pad Detection
    if (!this.isAirborne && this.boostPadCooldown <= 0) {
      const pad = spline.getBoostPadAt(this.s, this.d);
      if (pad) {
        this.boostPadTimer = 1.15;
        this.boostPadCooldown = 0.85;
        this.speed = Math.min(baseMax + 24, Math.max(this.speed + 12, baseMax + 18));
        this.nitro = Math.min(100, this.nitro + 14);
        this.styleScore += 120;
        events?.onBoostPad?.();
      }
    }

    // 10. Lap & Race Progress Tracking
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

    // 11. Top Speed, Simulated 6-Speed Gearbox & RPM
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

    // 12. Visual Body Dynamics (Expressive Decoupled Slip Angle + Countersteer + Body Roll!)
    const modVis = this.isDrifting ? clamp(this.steerSmooth * this.driftDir, -0.5, 1.0) : 0;
    const targetSlip = this.isDrifting
      ? this.driftDir * (0.44 + modVis * 0.22 + cornerSharpness * 0.14)
      : this.steerSmooth * 0.045;
    this.visualSlipAngle = damp(this.visualSlipAngle, targetSlip, 9.5, dt);

    const targetRoll =
      (this.isDrifting ? this.driftDir * (0.095 + cornerSharpness * 0.03) : this.steerSmooth * 0.048) *
      clamp(this.speed / 65, 0.2, 1.15);
    this.bodyRoll = damp(this.bodyRoll, targetRoll, 10, dt);

    const isBoosting = this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0;
    const targetPitch = isBoosting ? 0.045 : input.brake ? -0.055 : input.throttle ? 0.022 : 0;
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

    // 13. Sync 3D Mesh Transform
    this.syncWorldTransform(spline, dt, input.brake);
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
      isSuperNitro: this.isSuperNitro,
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
      isDrifting: this.isDrifting,
      driftTier: this.driftTier,
      driftChargeNorm: clamp(this.driftCharge / 2.3, 0, 1),
      driftDistance: Math.round(this.driftDistance),
      bankAngleDeg: Math.round(THREE.MathUtils.radToDeg(Math.abs(this.frame.bank))),
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

  // 1. Slipstream detection
  for (const r of racers) {
    let drafting = false;
    if (r.speed > 45 && !r.isAirborne && !r.isWrongWay) {
      for (const other of racers) {
        if (other === r) continue;
        const ds = signedTrackDelta(r.s, other.s, L);
        if (ds > 5.5 && ds < 44 && Math.abs(other.d - r.d) < 3.4 && Math.abs(other.h - r.h) < 2.2) {
          drafting = true;
          break;
        }
      }
    }
    r.slipstreamLevel = damp(r.slipstreamLevel, drafting ? 1 : 0, drafting ? 3.5 : 5.0, dt);
    r.isSlipstreaming = r.slipstreamLevel > 0.35;
  }

  // 2. Pairwise car-to-car collision resolution
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
          a.yawOffset -= pushDir * 0.05;
          b.yawOffset += pushDir * 0.05;
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
