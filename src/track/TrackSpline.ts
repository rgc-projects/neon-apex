import * as THREE from 'three';
import { BoostPadDef, JumpRampDef, TrackConfig } from '../types';
import { clamp, lerp, smoothstep, wrapDistance, WORLD_UP } from '../utils/math';

export interface SplineSample {
  s: number;           // arc distance in meters
  t: number;           // normalized 0..1
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  flatRight: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  bank: number;        // radians (>0 lifts right side for left turn; <0 lifts left side for right turn)
  curvature: number;   // signed curvature (positive = curving right, negative = curving left)
}

export interface RampSurfaceInfo {
  height: number;      // meters above road surface
  slope: number;       // dy/ds (dimensionless rise/run)
  onRamp: boolean;
  nearLip: boolean;
}

export class TrackSpline {
  public readonly config: TrackConfig;
  public readonly curve: THREE.CatmullRomCurve3;
  public readonly samples: SplineSample[] = [];
  public readonly totalLength: number;
  public readonly roadWidth: number;
  public readonly halfWidth: number;
  public readonly sampleCount = 960;

  private readonly _tmpA = new THREE.Vector3();
  private readonly _tmpB = new THREE.Vector3();

  constructor(config: TrackConfig) {
    this.config = config;
    this.roadWidth = config.roadWidth;
    this.halfWidth = config.roadWidth * 0.5;

    const pts = config.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.totalLength = this.curve.getLength();

    const N = this.sampleCount;
    const ds = this.totalLength / N;

    // 1. Sample uniform positions & tangents along arc length
    const rawPositions: THREE.Vector3[] = [];
    const rawTangents: THREE.Vector3[] = [];
    const rawFlatRights: THREE.Vector3[] = [];

    for (let i = 0; i < N; i++) {
      const u = i / N;
      const pos = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u).normalize();
      const flatRight = new THREE.Vector3().crossVectors(tan, WORLD_UP).normalize();
      rawPositions.push(pos);
      rawTangents.push(tan);
      rawFlatRights.push(flatRight);
    }

    // 2. Signed curvature at each sample (positive = track curves RIGHT)
    const rawCurv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const prev = rawTangents[(i - 1 + N) % N];
      const next = rawTangents[(i + 1) % N];
      const diff = this._tmpA.subVectors(next, prev);
      rawCurv[i] = diff.dot(rawFlatRights[i]) / (2 * ds);
    }

    // 3. Smooth curvature for silky banking transitions
    const smoothCurv = new Float32Array(N);
    const windowRadius = 16;
    for (let i = 0; i < N; i++) {
      let sum = 0;
      let weightSum = 0;
      for (let k = -windowRadius; k <= windowRadius; k++) {
        const w = 1 - Math.abs(k) / (windowRadius + 1);
        sum += rawCurv[(i + k + N) % N] * w;
        weightSum += w;
      }
      smoothCurv[i] = sum / weightSum;
    }

    // 4. Construct final banked frames
    const maxBankRad = THREE.MathUtils.degToRad(config.maxBankDeg);
    const bankGain = 48.0; // radians per (1/m) curvature

    for (let i = 0; i < N; i++) {
      const s = i * ds;
      const t = i / N;
      const pos = rawPositions[i];
      const tan = rawTangents[i];
      const flatRight = rawFlatRights[i];
      const flatUp = new THREE.Vector3().crossVectors(flatRight, tan).normalize();

      // Suppress banking near Start/Finish straight & jump ramps so takeoff is clean
      const distFromStart = Math.min(t, 1 - t);
      let bankMask = smoothstep(0.015, 0.06, distFromStart);
      for (const ramp of config.jumpRamps) {
        if (t >= ramp.tStart - 0.025 && t <= ramp.tEnd + 0.03) {
          bankMask *= 0.15;
        }
      }

      // Curvature > 0 (right turn) => bank < 0 (left/outside raised)
      const bank = clamp(-smoothCurv[i] * bankGain, -maxBankRad, maxBankRad) * bankMask;
      const c = Math.cos(bank);
      const sn = Math.sin(bank);

      const right = flatRight.clone().multiplyScalar(c).addScaledVector(flatUp, sn).normalize();
      const up = flatUp.clone().multiplyScalar(c).addScaledVector(flatRight, -sn).normalize();

      this.samples.push({
        s,
        t,
        pos,
        tangent: tan,
        flatRight,
        right,
        up,
        bank,
        curvature: rawCurv[i],
      });
    }
  }

  public getFrameAtDistance(sRaw: number, out?: SplineSample): SplineSample {
    const s = wrapDistance(sRaw, this.totalLength);
    const fIdx = (s / this.totalLength) * this.sampleCount;
    const i0 = Math.floor(fIdx) % this.sampleCount;
    const i1 = (i0 + 1) % this.sampleCount;
    const alpha = fIdx - Math.floor(fIdx);

    const a = this.samples[i0];
    const b = this.samples[i1];

    const res: SplineSample = out ?? {
      s: 0,
      t: 0,
      pos: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      flatRight: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      bank: 0,
      curvature: 0,
    };

    res.s = s;
    res.t = s / this.totalLength;
    res.pos.lerpVectors(a.pos, b.pos, alpha);
    res.tangent.lerpVectors(a.tangent, b.tangent, alpha).normalize();
    res.flatRight.lerpVectors(a.flatRight, b.flatRight, alpha).normalize();
    res.right.lerpVectors(a.right, b.right, alpha).normalize();
    res.up.lerpVectors(a.up, b.up, alpha).normalize();
    res.bank = lerp(a.bank, b.bank, alpha);
    res.curvature = lerp(a.curvature, b.curvature, alpha);
    return res;
  }

  /** Computes world position for track coordinates (s, lateral d, height above deck h) */
  public trackToWorld(s: number, d: number, h: number, out = new THREE.Vector3()): THREE.Vector3 {
    const f = this.getFrameAtDistance(s);
    out.copy(f.pos).addScaledVector(f.right, d).addScaledVector(f.up, h);
    return out;
  }

  /** Evaluates ramp deck elevation & launch slope at (s, d) */
  public getRampSurface(sRaw: number, d: number): RampSurfaceInfo {
    const s = wrapDistance(sRaw, this.totalLength);
    const t = s / this.totalLength;

    for (const ramp of this.config.jumpRamps) {
      if (t >= ramp.tStart && t <= ramp.tEnd) {
        const rampHalfW = this.halfWidth * ramp.widthRatio;
        if (Math.abs(d) <= rampHalfW + 0.6) {
          const u = (t - ramp.tStart) / (ramp.tEnd - ramp.tStart);
          const rampLen = (ramp.tEnd - ramp.tStart) * this.totalLength;
          // Smoothly rising quadratic launch kicker: h(u) = H * u^1.65
          const exp = 1.65;
          const height = ramp.height * Math.pow(u, exp);
          const dhdu = ramp.height * exp * Math.pow(Math.max(u, 0.02), exp - 1);
          const slope = dhdu / Math.max(rampLen, 1);
          return {
            height,
            slope,
            onRamp: true,
            nearLip: u > 0.88,
          };
        }
      }
    }
    return { height: 0, slope: 0, onRamp: false, nearLip: false };
  }

  /** Returns matching BoostPadDef if (s, d) is inside a boost pad */
  public getBoostPadAt(sRaw: number, d: number): BoostPadDef | null {
    const s = wrapDistance(sRaw, this.totalLength);
    for (const pad of this.config.boostPads) {
      const padS = pad.t * this.totalLength;
      const halfL = pad.length * 0.5;
      let ds = Math.abs(s - padS);
      if (ds > this.totalLength * 0.5) ds = this.totalLength - ds;
      if (ds <= halfL && Math.abs(d - pad.d) <= pad.width * 0.55) {
        return pad;
      }
    }
    return null;
  }

  public isInTunnel(t: number): boolean {
    for (const z of this.config.tunnelZones) {
      if (t >= z.tStart && t <= z.tEnd) return true;
    }
    return false;
  }

  public getJumpRamps(): JumpRampDef[] {
    return this.config.jumpRamps;
  }

  /** Minimum horizontal (XZ) distance from any point to the track centerline (for safe scenery placement) */
  public minHorizontalDistanceToTrack(x: number, z: number): number {
    let minSq = Infinity;
    for (let i = 0; i < this.sampleCount; i += 4) {
      const p = this.samples[i].pos;
      const dx = p.x - x;
      const dz = p.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minSq) minSq = dSq;
    }
    return Math.sqrt(minSq);
  }

  /** Normalized 2D points (0..1) for HUD minimap & menu preview SVG */
  public getMinimapOutline(step = 6): {
    points: { x: number; y: number }[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.sampleCount; i += step) {
      const p = this.samples[i].pos;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const spanX = Math.max(maxX - minX, 1);
    const spanZ = Math.max(maxZ - minZ, 1);
    const scale = Math.max(spanX, spanZ);
    const padX = (scale - spanX) * 0.5;
    const padZ = (scale - spanZ) * 0.5;

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < this.sampleCount; i += step) {
      const p = this.samples[i].pos;
      points.push({
        x: (p.x - minX + padX) / scale,
        y: (p.z - minZ + padZ) / scale,
      });
    }
    return { points, minX, maxX, minZ, maxZ };
  }

  public projectToMinimap(
    worldPos: THREE.Vector3,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  ): { x: number; y: number } {
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1);
    const scale = Math.max(spanX, spanZ);
    const padX = (scale - spanX) * 0.5;
    const padZ = (scale - spanZ) * 0.5;
    return {
      x: (worldPos.x - bounds.minX + padX) / scale,
      y: (worldPos.z - bounds.minZ + padZ) / scale,
    };
  }
}
