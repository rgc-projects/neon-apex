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
  public readonly sampleCount: number;

  private readonly _tmpA = new THREE.Vector3();
  private spatialHash: Map<number, number[]> | null = null;
  private readonly spatialCellSize = 240;

  constructor(config: TrackConfig) {
    this.config = config;
    this.roadWidth = config.roadWidth;
    this.halfWidth = config.roadWidth * 0.5;

    const pts = config.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    // 'centripetal' Catmull-Rom prevents loops/overshoots on sharp 90° bends and tight 180° hairpins!
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    // Ensure uniform arc-length parameterization even on 180+ control-point 60.7km endurance circuits!
    this.curve.arcLengthDivisions = Math.max(200, pts.length * 16);
    this.totalLength = this.curve.getLength();
    // Preserve exact 1500 samples for standard 3.4-4.3km circuits; scale density cleanly up to full 1:1 60.7km!
    this.sampleCount =
      this.totalLength <= 4500
        ? 1500
        : this.totalLength <= 35000
          ? Math.round(this.totalLength / 2.6)
          : Math.min(22000, Math.round(this.totalLength / 3.0));

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

    // 2. Signed curvature at each sample (positive = curving RIGHT, negative = curving LEFT)
    const rawCurv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const prev = rawTangents[(i - 1 + N) % N];
      const next = rawTangents[(i + 1) % N];
      const diff = this._tmpA.subVectors(next, prev);
      rawCurv[i] = diff.dot(rawFlatRights[i]) / (2 * ds);
    }

    // 3. Smooth curvature with a crisp window so tight hairpins & 90° turns bank responsively
    const smoothCurv = new Float32Array(N);
    const windowRadius = 11;
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

    // 4. Map explicit per-control-point `inwardBankDeg` onto nearest spline sample indices
    const cpBanks: { idx: number; deg: number }[] = [];
    for (let p = 0; p < config.points.length; p++) {
      const cp = config.points[p];
      if (cp.inwardBankDeg === undefined) continue;
      let bestIdx = 0;
      let bestDistSq = Infinity;
      for (let i = 0; i < N; i++) {
        const sp = rawPositions[i];
        const dx = sp.x - cp.x;
        const dy = sp.y - cp.y;
        const dz = sp.z - cp.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
      cpBanks.push({ idx: bestIdx, deg: cp.inwardBankDeg });
    }

    // Compute per-sample target banking radians
    const rawBank = new Float32Array(N);
    const maxBankRad = THREE.MathUtils.degToRad(config.maxBankDeg);
    const autoBankGain = 36.0;

    for (let i = 0; i < N; i++) {
      const t = i / N;
      const sc = smoothCurv[i];

      // Automatic inward banking proportional to curvature (curv > 0 right turn => bank < 0 lifts left edge)
      let targetBank = clamp(-sc * autoBankGain, -maxBankRad, maxBankRad);

      // Blend designer-authored corner banking angles (e.g., 5° flat 90° turn vs 34° steep banked U-turn!)
      if (cpBanks.length > 0 && Math.abs(sc) > 0.0018) {
        let influence = 0;
        let weightedDeg = 0;
        const influenceSpan = 34; // ~3% of track length around the corner apex
        for (const cb of cpBanks) {
          let di = Math.abs(i - cb.idx);
          if (di > N * 0.5) di = N - di;
          if (di < influenceSpan) {
            const w = smoothstep(influenceSpan, 0, di);
            weightedDeg += cb.deg * w;
            influence += w;
          }
        }
        if (influence > 0.001) {
          const explicitDeg = weightedDeg / influence;
          const explicitRad = THREE.MathUtils.degToRad(explicitDeg);
          const turnSign = -Math.sign(sc); // inward banking direction!
          const curveEnvelope = smoothstep(0.002, 0.0075, Math.abs(sc));
          const explicitBank = turnSign * explicitRad * curveEnvelope;
          targetBank = lerp(targetBank, explicitBank, clamp(influence, 0, 1));
        }
      }

      // Flatten start/finish grid & jump ramp takeoffs cleanly (physical meters on mega tracks so zones don't over-stretch)
      const isMega = this.totalLength > 4500;
      const distFromStart = Math.min(t, 1 - t);
      let bankMask = isMega
        ? smoothstep(45 / this.totalLength, 165 / this.totalLength, distFromStart)
        : smoothstep(0.012, 0.045, distFromStart);
      const rampPadPre = isMega ? 70 / this.totalLength : 0.02;
      const rampPadPost = isMega ? 90 / this.totalLength : 0.025;
      for (const ramp of config.jumpRamps) {
        if (t >= ramp.tStart - rampPadPre && t <= ramp.tEnd + rampPadPost) {
          bankMask *= 0.12;
        }
      }
      rawBank[i] = clamp(targetBank * bankMask, -maxBankRad, maxBankRad);
    }

    // Smooth final banking gently so there's zero sudden roll snap entering/exiting banked bowls
    const finalBank = new Float32Array(N);
    const bankSmoothR = 9;
    for (let i = 0; i < N; i++) {
      let sum = 0;
      let wSum = 0;
      for (let k = -bankSmoothR; k <= bankSmoothR; k++) {
        const w = 1 - Math.abs(k) / (bankSmoothR + 1);
        sum += rawBank[(i + k + N) % N] * w;
        wSum += w;
      }
      finalBank[i] = sum / wSum;
    }

    // 5. Build final orthonormal banked frames
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      const t = i / N;
      const pos = rawPositions[i];
      const tan = rawTangents[i];
      const flatRight = rawFlatRights[i];
      const flatUp = new THREE.Vector3().crossVectors(flatRight, tan).normalize();

      const bank = finalBank[i];
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

  public trackToWorld(s: number, d: number, h: number, out = new THREE.Vector3()): THREE.Vector3 {
    const f = this.getFrameAtDistance(s);
    out.copy(f.pos).addScaledVector(f.right, d).addScaledVector(f.up, h);
    return out;
  }

  public getRampSurface(sRaw: number, d: number): RampSurfaceInfo {
    const s = wrapDistance(sRaw, this.totalLength);
    const t = s / this.totalLength;

    for (const ramp of this.config.jumpRamps) {
      if (t >= ramp.tStart && t <= ramp.tEnd) {
        const rampHalfW = this.halfWidth * ramp.widthRatio;
        if (Math.abs(d) <= rampHalfW + 0.6) {
          const u = (t - ramp.tStart) / (ramp.tEnd - ramp.tStart);
          const rampLen = (ramp.tEnd - ramp.tStart) * this.totalLength;
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

  private ensureSpatialHash(): Map<number, number[]> {
    if (this.spatialHash) return this.spatialHash;
    const map = new Map<number, number[]>();
    const stride = this.sampleCount > 12000 ? 4 : 3;
    const cell = this.spatialCellSize;
    for (let i = 0; i < this.sampleCount; i += stride) {
      const p = this.samples[i].pos;
      const gx = Math.floor(p.x / cell);
      const gz = Math.floor(p.z / cell);
      const key = ((gx + 8192) << 14) | (gz + 8192);
      let b = map.get(key);
      if (!b) {
        b = [];
        map.set(key, b);
      }
      b.push(i);
    }
    this.spatialHash = map;
    return map;
  }

  /** Fast O(1) lookup of nearest road sample within ~240m (used by 60km terrain carving & landmark placement) */
  public getNearestRoadInfo(
    x: number,
    z: number,
    maxDist = 230
  ): { dist: number; y: number; bankDrop: number } | null {
    const map = this.ensureSpatialHash();
    const cell = this.spatialCellSize;
    const gx = Math.floor(x / cell);
    const gz = Math.floor(z / cell);
    let bestSq = maxDist * maxDist;
    let bestIdx = -1;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = ((gx + ox + 8192) << 14) | (gz + oz + 8192);
        const bucket = map.get(key);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const idx = bucket[k];
          const p = this.samples[idx].pos;
          const dx = p.x - x;
          const dz = p.z - z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestSq) {
            bestSq = dSq;
            bestIdx = idx;
          }
        }
      }
    }
    if (bestIdx < 0) return null;
    const s = this.samples[bestIdx];
    return {
      dist: Math.sqrt(bestSq),
      y: s.pos.y,
      bankDrop: this.halfWidth * Math.sin(Math.abs(s.bank)),
    };
  }

  public minHorizontalDistanceToTrack(x: number, z: number): number {
    if (this.sampleCount > 4500) {
      const near = this.getNearestRoadInfo(x, z, 235);
      if (near) return near.dist;
      let minSq = Infinity;
      const coarse = Math.max(12, Math.round(this.sampleCount / 400));
      for (let i = 0; i < this.sampleCount; i += coarse) {
        const p = this.samples[i].pos;
        const dx = p.x - x;
        const dz = p.z - z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minSq) minSq = dSq;
      }
      return Math.sqrt(minSq);
    }
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

  public getMinimapOutline(step = 6): {
    points: { x: number; y: number }[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } {
    const effStep = Math.max(step, Math.round(this.sampleCount / 260));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.sampleCount; i += effStep) {
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
    for (let i = 0; i < this.sampleCount; i += effStep) {
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
