import * as THREE from 'three';
import { CarSpec, InputState, RacerHUDTelemetry } from '../types';
import { SplineSample, TrackSpline } from '../track/TrackSpline';
import { clamp, damp, signedTrackDelta, wrapDistance } from '../utils/math';
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
  public speed = 0;        // forward velocity along car heading (m/s)
  public yawOffset = 0;    // heading offset vs road tangent (radians, +right, -left)

  // Arcade drift & boost states
  public isDrifting = false;
  public driftDir: -1 | 0 | 1 = 0;
  public driftDuration = 0;
  public driftDistance = 0;
  public driftCharge = 0; // 0..3
  public driftTier: 0 | 1 | 2 | 3 = 0;
  public miniBoostTimer = 0;
  public miniBoostPower = 0;

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
    // Classic 2x3 staggered F1/arcade starting grid behind the Start/Finish line
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

    // 1. Steering input smoothing (supports both digital keyboard and smooth analog touch/tilt)
    const digitalSteer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rawSteer =
      digitalSteer !== 0
        ? digitalSteer
        : input.steerAxis !== undefined
          ? clamp(input.steerAxis, -1, 1)
          : 0;
    this.steerSmooth = damp(this.steerSmooth, rawSteer, 12.0, dt);

    // 2. Nitro activation & Super Nitro logic
    const prevNitroActive = this.isNitroActive;
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
      // Subtle passive nitro trickling at high speeds & strong charging in slipstream
      const passive = (this.speed > 55 ? 2.1 : 0.6) + (this.isSlipstreaming ? 8.5 : 0);
      this.nitro = Math.min(100, this.nitro + passive * dt);
    }
    void prevNitroActive;

    // Active timers
    if (this.miniBoostTimer > 0) this.miniBoostTimer = Math.max(0, this.miniBoostTimer - dt);
    if (this.boostPadTimer > 0) this.boostPadTimer = Math.max(0, this.boostPadTimer - dt);

    // 3. Arcade Drift Mechanics (Banking-Controlled Drift Duration & Arc!)
    // Sample current road frame early so drift physics directly react to track tilt/banking angle
    spline.getFrameAtDistance(this.s, this.frame);

    const canDrift = !this.isAirborne && this.speed > 22 && input.drift;
    // Inward bank angle aligned with active drift direction (>0 means banked inward like a bowl!)
    const inwardBankRad = this.isDrifting ? -this.frame.bank * this.driftDir : 0;
    const bankNorm = clamp(inwardBankRad / THREE.MathUtils.degToRad(34), -0.35, 1.15);

    if (canDrift) {
      if (!this.isDrifting) {
        if (Math.abs(rawSteer) > 0.1 || Math.abs(this.steerSmooth) > 0.16) {
          this.isDrifting = true;
          this.driftDir = (rawSteer !== 0 ? rawSteer : this.steerSmooth) > 0 ? 1 : -1;
          this.driftDuration = 0;
          this.driftDistance = 0;
          this.driftCharge = 0;
          this.driftTier = 0;
          // Playful drift-hop micro bounce!
          this.suspensionVel = 1.65;
        }
      } else {
        this.driftDuration += dt;
        this.driftDistance += this.speed * dt;
        // Steering into the drift charges much faster than widening out
        const align = rawSteer * this.driftDir; // >0 into drift, <0 counter-steer
        const intoDrift = align > 0.2 ? 1.48 : align < -0.2 ? 0.68 : 1.0;
        const speedFactor = clamp(this.speed / 68, 0.58, 1.38);

        // Track banking angle controls drift pacing & duration:
        // - Flat/low-bank 90° street corners (bankNorm ~ 0): crisp fast snap-charge (~0.9s..1.4s)
        // - Steeply banked U-turn bowls (bankNorm ~ 1): stretched long sustained high-G drift (~2.2s..3.8s) with bonus nitro!
        const bankChargePace = 1.24 - clamp(bankNorm, 0, 1) * 0.42;
        this.driftCharge += dt * intoDrift * speedFactor * bankChargePace * this.spec.driftChargeRate;

        // Banked bowl drifts yield rich bonus Nitro flow!
        const bankNitroBonus = 1.0 + clamp(bankNorm, 0, 1) * 0.45;
        this.nitro = Math.min(100, this.nitro + dt * 12.2 * intoDrift * bankNitroBonus * this.spec.driftChargeRate);

        if (this.driftCharge >= 2.35) this.driftTier = 3;
        else if (this.driftCharge >= 1.32) this.driftTier = 2;
        else if (this.driftCharge >= 0.48) this.driftTier = 1;
        else this.driftTier = 0;
      }
    } else if (this.isDrifting) {
      // Released drift! Trigger Drift Mini-Turbo if charged!
      if (this.driftDistance > this.longestDriftMeters) {
        this.longestDriftMeters = this.driftDistance;
      }
      if (this.driftTier >= 1) {
        const tier = this.driftTier as 1 | 2 | 3;
        const powers = [0, 17, 25, 34];
        const durations = [0, 0.72, 1.15, 1.62];
        const nitroBonus = [0, 12, 22, 35];
        const points = [0, 180, 400, 750];

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
    }

    // 4. Longitudinal Acceleration, Road Slope Gravity & Banked Speed Retention
    const baseMax = this.spec.maxSpeed * paceScale;
    let boostMaxAdd = 0;
    let boostAccelAdd = 0;

    if (this.isNitroActive) {
      const nMult = this.spec.nitroPower;
      boostMaxAdd += (this.isSuperNitro ? 32 : 21) * nMult;
      boostAccelAdd += (this.isSuperNitro ? 58 : 38) * nMult;
    }
    if (this.miniBoostTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, this.miniBoostPower);
      boostAccelAdd += 36;
    }
    if (this.boostPadTimer > 0) {
      boostMaxAdd = Math.max(boostMaxAdd, 28);
      boostAccelAdd += 46;
    }
    if (this.isSlipstreaming) {
      boostMaxAdd += 12 * this.slipstreamLevel;
      boostAccelAdd += 18 * this.slipstreamLevel;
    }

    // Steep inward banking preserves blazing speed through banked U-turns; flat 90° bends scrub slightly more speed for sharp rotation!
    const driftDragFactor = this.isDrifting ? 0.91 + clamp(bankNorm, 0, 1) * 0.082 : 1.0;
    const effectiveMaxSpeed = (baseMax + boostMaxAdd) * driftDragFactor;

    // Downhill / uphill slope acceleration (like Mount Akina downhill hairpins!)
    const roadSlopeAccel = -this.frame.tangent.y * 16.5;

    if (!this.isAirborne) {
      if (input.throttle || this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0) {
        const speedRatio = clamp(this.speed / Math.max(effectiveMaxSpeed, 1), 0, 1.3);
        const torqueCurve = Math.max(0.18, 1.15 - speedRatio * 0.88);
        const accel = (this.spec.acceleration * paceScale * torqueCurve) + boostAccelAdd + roadSlopeAccel;
        if (this.speed < effectiveMaxSpeed) {
          this.speed = Math.min(effectiveMaxSpeed, this.speed + Math.max(4, accel) * dt);
        } else {
          this.speed = damp(this.speed, effectiveMaxSpeed, 2.8, dt);
        }
      } else {
        this.speed = Math.max(0, this.speed - (11 + this.speed * 0.14 - roadSlopeAccel) * dt);
      }

      if (input.brake) {
        if (this.speed > 2) {
          this.speed = Math.max(0, this.speed - 74 * dt);
        } else {
          this.speed = Math.max(-18, this.speed - 24 * dt);
        }
      }
    } else {
      this.speed = Math.max(10, this.speed - 2.2 * dt);
    }

    // 5. Steering & Banking-Modulated Arcade Drift Yaw Rotation
    // Normal high-speed grip has realistic understeer on tight 90°/180° bends -> makes DRIFTING essential & super rewarding!
    const speedSteerScale = clamp(Math.abs(this.speed) / 20, 0.25, 1.0) *
      (1.0 - clamp((this.speed - 48) / 72, 0, 0.56));
    const airSteerScale = this.isAirborne ? 0.22 : 1.0;
    const revSign = this.speed >= -0.1 ? 1 : -1;

    let yawRate = 0;
    if (this.isDrifting) {
      // Drift unlocks high cornering bite to slice cleanly through 90° corners & 180° hairpins!
      // - Low-bank flat 90° corners rotate extra crisply for quick snap-drifts
      // - Steep banked U-turns give wide, smooth, sustained high-speed arc modulation
      const mod = this.steerSmooth * this.driftDir; // +1 into drift, -1 counter-steer
      const bankSnapFactor = 1.12 - clamp(bankNorm, 0, 1) * 0.16;
      const arcFactor = (0.86 + mod * 0.72) * bankSnapFactor;
      const hairpinAssist = clamp(Math.abs(this.frame.curvature) * 32, 0, 0.42);
      yawRate = this.driftDir * (arcFactor + hairpinAssist) * 1.92 * this.spec.driftControl;
    } else {
      yawRate = this.steerSmooth * 1.38 * this.spec.handling * speedSteerScale * airSteerScale * revSign;
    }
    this.yawOffset += yawRate * dt;

    // 6. Advance Along Spline, Apply True Curvature Centrifugal Drift & Banked Gravity Hold
    const cosYaw = Math.cos(this.yawOffset);
    const sinYaw = Math.sin(this.yawOffset);
    const vForwardTrack = this.speed * cosYaw;
    const vLateral = this.speed * sinYaw;

    // Differential geometry arc-length correction: inside lane covers corners faster!
    const radiusFactor = clamp(1 - this.d * this.frame.curvature, 0.4, 1.95);
    const ds = (vForwardTrack * dt) / radiusFactor;

    const prevTangent = this.frame.tangent.clone();
    const prevFlatRight = this.frame.flatRight.clone();

    this.s = wrapDistance(this.s + ds, spline.totalLength);
    // Lateral gravity pull from track banking holds the car securely into steep banked bowls!
    // bank < 0 (right turn inward bank) pulls toward +d (right/inside); bank > 0 pulls toward -d (left/inside)
    const bankGravityLateral = !this.isAirborne ? -Math.sin(this.frame.bank) * (this.isDrifting ? 14.5 : 5.5) : 0;
    this.d += (vLateral + bankGravityLateral) * dt;

    // Update frame at new s and subtract actual track turn angle from yawOffset
    spline.getFrameAtDistance(this.s, this.frame);
    const dTurnRight = Math.atan2(
      this.frame.tangent.dot(prevFlatRight),
      this.frame.tangent.dot(prevTangent)
    );
    this.yawOffset -= dTurnRight;

    // Gentle high-speed arcade stability assist (prevents spinning backward uncontrollably while preserving genuine cornering feel)
    if (!this.isDrifting && Math.abs(rawSteer) < 0.05 && this.speed > 15) {
      this.yawOffset = damp(this.yawOffset, 0, 1.35, dt);
    }
    this.yawOffset = clamp(this.yawOffset, -Math.PI * 0.72, Math.PI * 0.72);
    this.isWrongWay = Math.abs(this.yawOffset) > Math.PI * 0.56 && this.speed > 6;

    // 7. Guardrail Collision & Spark Deflection
    const maxLat = spline.halfWidth - 1.38;
    if (Math.abs(this.d) > maxLat) {
      const side = Math.sign(this.d);
      this.d = side * maxLat;
      const impactIntensity = clamp(Math.abs(vLateral) / 28, 0.2, 1.0);

      // Smoothly bounce nose slightly away from wall so car NEVER sticks
      if (side * this.yawOffset > 0) {
        this.yawOffset = -side * Math.min(0.14, Math.abs(this.yawOffset) * 0.35);
      }
      this.speed *= 1 - 0.09 * impactIntensity;
      if (this.wallCooldown <= 0 && impactIntensity > 0.22) {
        this.wallCooldown = 0.14;
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
        // Just cleared the launch lip of the jump ramp -> TAKE OFF!
        this.isAirborne = true;
        this.currentAirTime = 0;
        this.vy = Math.max(12, vForwardTrack * Math.max(this.lastRampSlope, 0.24) * 1.15);
        this.wasOnRamp = false;
        events?.onJumpLaunch?.();
      } else {
        this.h = 0;
        this.vy = 0;
        this.wasOnRamp = false;
      }
    } else {
      // Airborne trajectory
      this.currentAirTime += dt;
      this.totalAirTime += dt;
      this.vy -= gravity * dt;
      this.h += this.vy * dt;

      if (this.h <= groundHeight) {
        // Touchdown!
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
        this.boostPadTimer = 1.25;
        this.boostPadCooldown = 0.8;
        this.speed = Math.max(this.speed + 16, baseMax + 20);
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

    // 12. Visual Body Dynamics (Drift slip, body roll, pitch squat/dive, suspension spring)
    const targetSlip = this.isDrifting
      ? this.driftDir * (0.34 + clamp(this.steerSmooth * this.driftDir, -0.4, 1.0) * 0.16)
      : this.steerSmooth * 0.04;
    this.visualSlipAngle = damp(this.visualSlipAngle, targetSlip, 8.5, dt);

    const targetRoll = (this.isDrifting ? this.driftDir * 0.085 : this.steerSmooth * 0.048) *
      clamp(this.speed / 65, 0.2, 1.15);
    this.bodyRoll = damp(this.bodyRoll, targetRoll, 10, dt);

    const isBoosting = this.isNitroActive || this.miniBoostTimer > 0 || this.boostPadTimer > 0;
    const targetPitch = isBoosting ? 0.045 : input.brake ? -0.055 : input.throttle ? 0.022 : 0;
    this.bodyPitch = damp(this.bodyPitch, targetPitch, 9, dt);

    // Spring-damper suspension bounce
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

    // World position = road center + d*right + h*up
    this.worldPos
      .copy(this.frame.pos)
      .addScaledVector(this.frame.right, this.d)
      .addScaledVector(this.frame.up, this.h);

    // Build orientation: road frame -> rotate by -yawOffset around road up -> tilt by airPitch around local right
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

    // Extract world basis vectors
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
      driftChargeNorm: clamp(this.driftCharge / 2.35, 0, 1),
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
      const ds = signedTrackDelta(a.s, b.s, L); // positive if b is ahead of a
      const dd = b.d - a.d;
      const dh = Math.abs(b.h - a.h);

      if (Math.abs(ds) < 4.55 && Math.abs(dd) < 2.25 && dh < 1.7) {
        // Compute separation along shorter penetration axis
        const overlapS = 4.55 - Math.abs(ds);
        const overlapD = 2.25 - Math.abs(dd);
        const involvesPlayer = a.isPlayer || b.isPlayer;

        if (overlapD < overlapS) {
          const pushDir = dd >= 0 ? 1 : -1;
          const push = overlapD * 0.55;
          a.d -= pushDir * push;
          b.d += pushDir * push;
          a.yawOffset -= pushDir * 0.06;
          b.yawOffset += pushDir * 0.06;
        } else {
          const dir = ds >= 0 ? 1 : -1; // b ahead of a if +1
          const push = overlapS * 0.52;
          a.s = wrapDistance(a.s - dir * push, L);
          b.s = wrapDistance(b.s + dir * push, L);

          // Momentum transfer (bump-draft / rear-end transfer)
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
