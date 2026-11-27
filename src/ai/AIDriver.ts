import { AIRacerProfile } from '../config/cars';
import { AIDifficulty } from '../settings/SettingsManager';
import { InputState } from '../types';
import { TrackSpline } from '../track/TrackSpline';
import { clamp, signedTrackDelta } from '../utils/math';
import { RacerPhysics } from '../vehicle/CarPhysics';

export class AIDriver {
  public readonly profile: AIRacerProfile;
  private laneOffsetTimer = 0;
  private dynamicLaneBias = 0;
  private nitroCooldown = 0;

  constructor(profile: AIRacerProfile) {
    this.profile = profile;
    this.dynamicLaneBias = profile.preferredLine;
  }

  public computeInput(
    dt: number,
    self: RacerPhysics,
    allRacers: RacerPhysics[],
    player: RacerPhysics,
    spline: TrackSpline,
    difficulty: AIDifficulty = 'pro'
  ): { input: InputState; paceScale: number } {
    this.laneOffsetTimer -= dt;
    this.nitroCooldown = Math.max(0, this.nitroCooldown - dt);

    if (this.laneOffsetTimer <= 0) {
      this.laneOffsetTimer = 2.5 + Math.random() * 3.0;
      this.dynamicLaneBias = this.profile.preferredLine + (Math.random() - 0.5) * 0.35;
    }

    const halfW = spline.halfWidth;
    const fHere = spline.getFrameAtDistance(self.s + 6);
    const fNear = spline.getFrameAtDistance(self.s + 22);
    const fMid = spline.getFrameAtDistance(self.s + 48);
    const fFar = spline.getFrameAtDistance(self.s + 86);

    const avgCurv = (fHere.curvature * 1.1 + fNear.curvature * 1.4 + fMid.curvature * 1.2 + fFar.curvature * 0.6) / 4.3;
    const peakCurv = Math.max(Math.abs(fHere.curvature), Math.abs(fNear.curvature), Math.abs(fMid.curvature));

    // 1. Optimal racing line (hug corner apex on tight 90° & 180° bends, cruise preferred line on straights)
    let targetD = this.dynamicLaneBias * (halfW - 3.6);
    if (Math.abs(avgCurv) > 0.0028) {
      // Curvature > 0 = turning right => apex is +d (right side)
      const apexSign = Math.sign(avgCurv);
      targetD = apexSign * (halfW - 3.6) * clamp(Math.abs(avgCurv) * 115, 0.35, 0.92);
    }

    // 2. Aim for upcoming Boost Pads & Jump Ramps!
    const L = spline.totalLength;
    for (const pad of spline.config.boostPads) {
      const ds = signedTrackDelta(self.s, pad.t * L, L);
      if (ds > 8 && ds < 68 && Math.abs(pad.d - self.d) < 7.5) {
        targetD = pad.d;
        break;
      }
    }
    for (const ramp of spline.config.jumpRamps) {
      const ds = signedTrackDelta(self.s, ramp.tStart * L, L);
      if (ds > -20 && ds < 65) {
        targetD = clamp(targetD, -halfW * ramp.widthRatio * 0.65, halfW * ramp.widthRatio * 0.65);
      }
    }

    // 3. Overtaking & Car Avoidance Steering
    for (const other of allRacers) {
      if (other === self) continue;
      const ds = signedTrackDelta(self.s, other.s, L);
      if (ds > 2 && ds < 34) {
        const latGap = other.d - self.d;
        if (Math.abs(latGap) < 4.2) {
          // Steer cleanly around the car ahead toward the more open side of the track
          const avoidSide = other.d > 0 ? -1 : 1;
          targetD = clamp(other.d + avoidSide * 4.8, -(halfW - 3.0), halfW - 3.0);
        }
      }
    }

    targetD = clamp(targetD, -(halfW - 2.8), halfW - 2.8);

    // 4. Compute desired heading offset to smoothly converge on targetD
    const lookaheadDist = clamp(self.speed * 0.38, 14, 36);
    const desiredYaw = Math.atan2(targetD - self.d, lookaheadDist) + fHere.curvature * 11.5;
    const yawError = desiredYaw - self.yawOffset;

    const steerDeadzone = 0.04;
    const left = yawError < -steerDeadzone;
    const right = yawError > steerDeadzone;

    // 5. Engage real arcade corner-flow drifting on 90° corners & 180° hairpins!
    const sharpCorner = (peakCurv > 0.0068 || Math.abs(avgCurv) > 0.0048) && self.speed > 38;
    const drift = sharpCorner && ((avgCurv > 0 && right) || (avgCurv < 0 && left));

    // With corner-flow drift physics, AI smoothly glides through hairpins without harsh braking
    const needsEntryBrake = false;

    // 6. Fair Nitro deployment: never spam nitro to run away once comfortably ahead of the player!
    const straightAhead = Math.abs(fNear.curvature) < 0.004 && Math.abs(fMid.curvature) < 0.004 && Math.abs(fFar.curvature) < 0.0045;
    const progressGap = self.totalProgress - player.totalProgress;
    let nitro = false;
    const maxLeadForNitro = difficulty === 'rookie' ? 22 : difficulty === 'apex' ? 85 : 48;
    const nitroThreshold =
      difficulty === 'rookie'
        ? 86
        : difficulty === 'apex'
          ? (this.profile.aggression > 0.65 ? 48 : 66)
          : (this.profile.aggression > 0.7 ? 58 : 78);

    if (
      self.inHyperZone &&
      straightAhead &&
      self.speed > 55 &&
      progressGap < maxLeadForNitro + 35 &&
      (difficulty !== 'rookie' || progressGap < 20)
    ) {
      nitro = true;
    } else if (self.isNitroActive && self.nitro > 16 && straightAhead && progressGap < maxLeadForNitro + 20) {
      nitro = true;
    } else if (
      this.nitroCooldown <= 0 &&
      straightAhead &&
      self.speed > 52 &&
      progressGap < maxLeadForNitro &&
      self.nitro >= nitroThreshold
    ) {
      nitro = true;
      const cdBase = difficulty === 'rookie' ? 6.8 : difficulty === 'apex' ? 3.6 : 4.8;
      this.nitroCooldown = cdBase + Math.random() * 3.0;
    }

    // 7. Fair, Anti-Slingshot Rubber-Banding:
    //    - Catch-up ONLY engages far behind (-105m+) and tapers to ZERO before reaching the player (no unfair slingshot!)
    //    - Once ahead (+28m+ in Pro, +50m+ in Apex), AI eases smoothly so the player can always fight back cleanly!
    let rubberBand = 0;
    if (!player.finished) {
      const leadStart = difficulty === 'rookie' ? 18 : difficulty === 'apex' ? 50 : 28;
      const leadSpan = difficulty === 'rookie' ? 140 : difficulty === 'apex' ? 220 : 170;
      const slowCap = difficulty === 'rookie' ? 0.13 : difficulty === 'apex' ? 0.065 : 0.095;
      const catchStart = 105; // Zero catch-up within 105m behind player -> prevents slingshot overtakes!
      const catchCap = difficulty === 'rookie' ? 0.025 : difficulty === 'apex' ? 0.06 : 0.045;

      if (progressGap > leadStart) {
        rubberBand = -clamp((progressGap - leadStart) / leadSpan, 0, slowCap);
      } else if (progressGap < -catchStart) {
        rubberBand = clamp((-progressGap - catchStart) / 240, 0, catchCap);
      }
    }

    const diffBias = difficulty === 'rookie' ? -0.07 : difficulty === 'apex' ? 0.025 : 0;
    const minPace = difficulty === 'rookie' ? 0.76 : difficulty === 'apex' ? 0.91 : 0.84;
    const maxPace = difficulty === 'rookie' ? 0.94 : difficulty === 'apex' ? 1.055 : 1.02;
    let paceScale = clamp(this.profile.skill + diffBias + rubberBand, minPace, maxPace);

    // 8. Player Car-Class Fairness Guard: prevent faster-chassis AI (e.g. VEX-01 in PHANTOM-X) from unfairly
    //    out-dragging a player in a drift/balanced car once close or ahead!
    if (self.spec.maxSpeed > player.spec.maxSpeed && progressGap > -25) {
      const classRatio = player.spec.maxSpeed / self.spec.maxSpeed;
      const maxFairSpeedRatio =
        difficulty === 'rookie' ? classRatio * 0.96 : difficulty === 'apex' ? Math.min(1.045, classRatio * 1.045) : Math.min(1.01, classRatio * 1.015);
      paceScale = Math.min(paceScale, Math.max(minPace, maxFairSpeedRatio));
    }

    return {
      input: {
        throttle: !needsEntryBrake,
        brake: needsEntryBrake,
        left,
        right,
        drift,
        nitro,
      },
      paceScale,
    };
  }
}
