import { AIRacerProfile } from '../config/cars';
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
    spline: TrackSpline
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

    // 5. Engage real arcade drifting on 90° corners & 180° hairpins!
    const sharpCorner = (peakCurv > 0.0075 || Math.abs(avgCurv) > 0.0052) && self.speed > 44;
    const drift = sharpCorner && ((avgCurv > 0 && right) || (avgCurv < 0 && left));

    // Gently trail-brake before ultra-tight flat hairpins so AI nails apexes cleanly
    const needsEntryBrake = peakCurv > 0.0155 && self.speed > 76 && Math.abs(fHere.bank) < 0.25;

    // 6. Smart Nitro deployment on straightaways or chasing player
    const straightAhead = Math.abs(fNear.curvature) < 0.004 && Math.abs(fMid.curvature) < 0.004 && Math.abs(fFar.curvature) < 0.0045;
    let nitro = false;
    if (self.isNitroActive && self.nitro > 14 && straightAhead) {
      nitro = true;
    } else if (
      this.nitroCooldown <= 0 &&
      straightAhead &&
      self.speed > 52 &&
      self.nitro >= (this.profile.aggression > 0.7 ? 52 : 76)
    ) {
      nitro = true;
      this.nitroCooldown = 4.2 + Math.random() * 3.2;
    }

    // 7. Gentle, Fun Rubber-Banding so races stay intense without ever feeling unfair!
    const progressGap = self.totalProgress - player.totalProgress;
    let rubberBand = 0;
    if (!player.finished) {
      if (progressGap > 65) {
        rubberBand = -clamp((progressGap - 65) / 280, 0, 0.085);
      } else if (progressGap < -65) {
        rubberBand = clamp((-progressGap - 65) / 260, 0, 0.095);
      }
    }

    const paceScale = clamp(this.profile.skill + rubberBand, 0.85, 1.08);

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
