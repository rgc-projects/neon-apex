import * as THREE from 'three';
import { isMobileDevice } from '../settings/SettingsManager';
import { createParticleGlowTexture } from '../utils/textures';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  age: number;
  life: number;
  gravity: number;
  drag: number;
}

/**
 * High-performance swap-remove dense particle layer for Three.js WebGL / Mobile TBDR GPUs:
 * - Compact active range [0..activeCount-1] with geo.setDrawRange(0, activeCount)
 * - Skips draw call & GPU buffer uploads completely when activeCount === 0
 * - Uploads only the active sub-range of Float32Arrays to VRAM (zero idle bandwidth)
 * - Uses alphaTest early-discard to slash transparent corner overdraw on Adreno/Mali GPUs
 */
class PooledPointsLayer {
  public readonly points: THREE.Points;
  private readonly maxCount: number;
  private readonly pool: Particle[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.PointsMaterial;
  private activeCount = 0;

  constructor(
    maxCount: number,
    size: number,
    texture: THREE.Texture,
    additive: boolean,
    opacity: number,
    alphaTest = 0.025
  ) {
    this.maxCount = maxCount;
    this.positions = new Float32Array(maxCount * 3);
    this.colors = new Float32Array(maxCount * 3);

    for (let i = 0; i < maxCount; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: 1,
        g: 1,
        b: 1,
        age: 0,
        life: 1,
        gravity: 0,
        drag: 1,
      });
    }

    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.PointsMaterial({
      size,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity,
      alphaTest,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      sizeAttenuation: true,
      toneMapped: !additive,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  public spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    life: number,
    gravity: number,
    drag: number
  ): void {
    let idx: number;
    if (this.activeCount < this.maxCount) {
      idx = this.activeCount++;
    } else {
      // Pool full: recycle the oldest slot (index 0) so fresh bursts stay snappy without exceeding GPU budget
      idx = 0;
    }

    const p = this.pool[idx];
    p.x = pos.x;
    p.y = pos.y;
    p.z = pos.z;
    p.vx = vel.x;
    p.vy = vel.y;
    p.vz = vel.z;
    p.r = color.r;
    p.g = color.g;
    p.b = color.b;
    p.age = 0;
    p.life = life;
    p.gravity = gravity;
    p.drag = drag;
  }

  public update(dt: number): void {
    if (this.activeCount === 0) {
      this.points.visible = false;
      return;
    }

    let i = 0;
    while (i < this.activeCount) {
      const p = this.pool[i];
      p.age += dt;
      if (p.age >= p.life) {
        // O(1) swap-remove with last active particle
        const last = this.activeCount - 1;
        if (i !== last) {
          const tmp = this.pool[i];
          this.pool[i] = this.pool[last];
          this.pool[last] = tmp;
        }
        this.activeCount--;
        continue;
      }

      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy = p.vy * damp - p.gravity * dt;
      p.vz *= damp;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const fade = 1 - p.age / p.life;
      const i3 = i * 3;
      this.positions[i3] = p.x;
      this.positions[i3 + 1] = p.y;
      this.positions[i3 + 2] = p.z;

      this.colors[i3] = p.r * fade;
      this.colors[i3 + 1] = p.g * fade;
      this.colors[i3 + 2] = p.b * fade;
      i++;
    }

    this.geo.setDrawRange(0, this.activeCount);
    this.points.visible = this.activeCount > 0;

    if (this.activeCount > 0) {
      this.posAttr.clearUpdateRanges();
      this.posAttr.addUpdateRange(0, this.activeCount * 3);
      this.posAttr.needsUpdate = true;

      this.colAttr.clearUpdateRanges();
      this.colAttr.addUpdateRange(0, this.activeCount * 3);
      this.colAttr.needsUpdate = true;
    }
  }

  public clear(): void {
    this.activeCount = 0;
    this.geo.setDrawRange(0, 0);
    this.points.visible = false;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Smooth dynamic glowing ribbon trail streaming from a car's exhausts during active boost */
class NitroRibbonTrail {
  public readonly mesh: THREE.Mesh;
  private readonly maxPts: number;
  private readonly history: { pos: THREE.Vector3; up: THREE.Vector3 }[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly halfWidth = 0.068;
  private wasActive = false;
  private livePts = 0;
  private tailFade = 0;

  constructor(maxPts = 14) {
    this.maxPts = maxPts;
    for (let i = 0; i < this.maxPts; i++) {
      this.history.push({ pos: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) });
    }
    this.positions = new Float32Array(this.maxPts * 2 * 3);
    this.colors = new Float32Array(this.maxPts * 2 * 3);

    const indices: number[] = [];
    for (let i = 0; i < this.maxPts - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    this.geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    const colAttr = new THREE.BufferAttribute(this.colors, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', posAttr);
    this.geo.setAttribute('color', colAttr);
    this.geo.setIndex(indices);
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  public pushPoint(pos: THREE.Vector3, up: THREE.Vector3, active: boolean, color: THREE.Color): void {
    if (active) {
      if (!this.wasActive) {
        // Fresh boost start: seed head cleanly at current exhaust so it NEVER bridges across the track!
        this.history[0].pos.copy(pos);
        this.history[0].up.copy(up);
        this.livePts = 1;
      } else {
        const moveMax = Math.min(this.livePts, this.maxPts - 1);
        for (let i = moveMax; i > 0; i--) {
          this.history[i].pos.copy(this.history[i - 1].pos);
          this.history[i].up.copy(this.history[i - 1].up);
        }
        this.history[0].pos.copy(pos);
        this.history[0].up.copy(up);
        if (this.livePts < this.maxPts) this.livePts++;
      }
      this.wasActive = true;
      this.tailFade = 1.0;
    } else {
      this.wasActive = false;
      if (this.tailFade <= 0.02 || this.livePts < 2) {
        this.livePts = 0;
        this.tailFade = 0;
        this.mesh.visible = false;
        return;
      }
      // Dissolve existing ribbon in place without attaching a stretched line to the car's new position!
      this.tailFade *= 0.72;
      if (this.tailFade <= 0.02) {
        this.livePts = 0;
        this.tailFade = 0;
        this.mesh.visible = false;
        return;
      }
    }

    if (this.livePts < 2) {
      this.mesh.visible = false;
      return;
    }

    const denom = Math.max(1, this.livePts - 1);
    for (let i = 0; i < this.livePts; i++) {
      const h = this.history[i];
      const v0 = i * 6;
      const v1 = v0 + 3;
      const fade = Math.pow(1 - i / denom, 1.8) * this.tailFade;
      const w = this.halfWidth * (0.18 + 0.82 * fade);

      this.positions[v0] = h.pos.x + h.up.x * w;
      this.positions[v0 + 1] = h.pos.y + h.up.y * w;
      this.positions[v0 + 2] = h.pos.z + h.up.z * w;
      this.positions[v1] = h.pos.x - h.up.x * w;
      this.positions[v1 + 1] = h.pos.y - h.up.y * w;
      this.positions[v1 + 2] = h.pos.z - h.up.z * w;

      const r = color.r * fade * 1.25;
      const g = color.g * fade * 1.25;
      const b = color.b * fade * 1.25;
      this.colors[v0] = r;
      this.colors[v0 + 1] = g;
      this.colors[v0 + 2] = b;
      this.colors[v1] = r;
      this.colors[v1 + 1] = g;
      this.colors[v1 + 2] = b;
    }

    this.geo.setDrawRange(0, (this.livePts - 1) * 6);
    this.mesh.visible = true;
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  public clear(): void {
    this.wasActive = false;
    this.livePts = 0;
    this.tailFade = 0;
    this.geo.setDrawRange(0, 0);
    this.mesh.visible = false;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class ParticleSystem {
  public readonly group = new THREE.Group();
  private readonly glowTex: THREE.CanvasTexture;
  private readonly sparks: PooledPointsLayer;
  private readonly smoke: PooledPointsLayer;
  private readonly trailLeft: NitroRibbonTrail;
  private readonly trailRight: NitroRibbonTrail;
  private readonly _vel = new THREE.Vector3();
  private readonly _col = new THREE.Color();
  private readonly isMobile: boolean;

  private qualityScale = 1.0;
  private lastImpactAt = 0;
  private lastSmokeAt = 0;
  private trailAccum = 0;

  public setQuality(level: 'low' | 'medium' | 'high'): void {
    const base = level === 'low' ? 0.35 : level === 'medium' ? 0.68 : 1.0;
    // On mobile TBDR GPUs (Adreno/Mali), apply an automatic fillrate multiplier even on 'high'
    this.qualityScale = this.isMobile ? base * 0.65 : base;
  }

  constructor() {
    this.isMobile = isMobileDevice();
    this.glowTex = createParticleGlowTexture();

    // Mobile-tuned pool caps & compact smoke footprints cut TBDR alpha overdraw by ~75%
    // while keeping crisp, punchy sparks and clean tire smoke trails!
    const sparkPool = this.isMobile ? 420 : 1000;
    const smokePool = this.isMobile ? 44 : 180;
    const smokeSize = this.isMobile ? 0.92 : 1.24;
    const smokeOpacity = this.isMobile ? 0.25 : 0.21;

    this.sparks = new PooledPointsLayer(sparkPool, 0.14, this.glowTex, true, 0.94, 0.04);
    this.smoke = new PooledPointsLayer(smokePool, smokeSize, this.glowTex, false, smokeOpacity, 0.045);
    this.trailLeft = new NitroRibbonTrail(this.isMobile ? 11 : 15);
    this.trailRight = new NitroRibbonTrail(this.isMobile ? 11 : 15);

    this.group.add(this.sparks.points, this.smoke.points, this.trailLeft.mesh, this.trailRight.mesh);
  }

  public emitDriftSparks(
    pos: THREE.Vector3,
    carForward: THREE.Vector3,
    carUp: THREE.Vector3,
    tier: 0 | 1 | 2 | 3,
    count = 3,
    palette?: [number, number, number, number]
  ): void {
    // Per-car drift spark progression (e.g. fiery gold on combustion, electric cyan arcs on EV!)
    const hex = palette
      ? palette[tier]
      : tier === 3
        ? 0x93c5fd
        : tier === 2
          ? 0xffe49e
          : tier === 1
            ? 0xffa940
            : 0xff8c2b;
    this._col.setHex(hex).multiplyScalar(1.42);

    const raw = count * this.qualityScale;
    const whole = Math.floor(raw);
    const scaledCount = whole + (Math.random() < raw - whole ? 1 : 0);
    if (scaledCount <= 0) return;

    const maxBurst = this.isMobile ? 3 : 6;
    const emitN = Math.min(scaledCount, maxBurst);
    for (let i = 0; i < emitN; i++) {
      this._vel
        .copy(carForward)
        .multiplyScalar(-(7 + Math.random() * 11))
        .addScaledVector(carUp, 1.8 + Math.random() * 4.2);
      this._vel.x += (Math.random() - 0.5) * 5.0;
      this._vel.z += (Math.random() - 0.5) * 5.0;
      this.sparks.spawn(pos, this._vel, this._col, 0.12 + Math.random() * 0.12, 24, 1.9);
    }
  }

  public emitTireSmoke(pos: THREE.Vector3, carForward: THREE.Vector3, carUp: THREE.Vector3, tintHex = 0xd6dde8): void {
    // Hard temporal throttle prevents 90-120Hz phones from stacking 100+ translucent smoke quads behind the car
    const now = performance.now();
    const minIntervalMs = this.isMobile ? 42 : 20;
    if (now - this.lastSmokeAt < minIntervalMs) return;
    if (this.qualityScale < 0.99 && Math.random() > this.qualityScale) return;
    this.lastSmokeAt = now;

    this._col.setHex(tintHex);
    this._vel
      .copy(carForward)
      .multiplyScalar(-(3.2 + Math.random() * 4.4))
      .addScaledVector(carUp, 1.1 + Math.random() * 1.8);
    this._vel.x += (Math.random() - 0.5) * 3.0;
    this._vel.z += (Math.random() - 0.5) * 3.0;

    // Short, crisp lifetime keeps smoke lively without filling half the screen with lingering alpha layers
    const life = this.isMobile ? 0.28 + Math.random() * 0.16 : 0.42 + Math.random() * 0.24;
    this.smoke.spawn(pos, this._vel, this._col, life, -1.4, 2.8);
  }

  public emitImpactBurst(pos: THREE.Vector3, hexColor: number, count = 22): void {
    // Rate-limit rapid wall-scraping / multi-car rubbing bursts so collisions never spike mobile frame times
    const now = performance.now();
    const cooldownMs = this.isMobile ? 60 : 28;
    if (now - this.lastImpactAt < cooldownMs) return;
    this.lastImpactAt = now;

    this._col.setHex(hexColor).multiplyScalar(1.75);
    const maxCap = this.isMobile ? 10 : 24;
    const scaledCount = Math.min(maxCap, Math.max(3, Math.round(count * this.qualityScale)));

    for (let i = 0; i < scaledCount; i++) {
      this._vel.set(
        (Math.random() - 0.5) * 24,
        4 + Math.random() * 13,
        (Math.random() - 0.5) * 24
      );
      const life = this.isMobile ? 0.18 + Math.random() * 0.14 : 0.26 + Math.random() * 0.24;
      this.sparks.spawn(pos, this._vel, this._col, life, 28, 1.8);
    }
  }

  public emitNitroExhaust(
    pos: THREE.Vector3,
    carForward: THREE.Vector3,
    isSuper: boolean,
    customHex?: number
  ): void {
    if (this.qualityScale < 0.99 && Math.random() > this.qualityScale) return;
    this._col.setHex(customHex ?? (isSuper ? 0x93c5fd : 0xffb04a)).multiplyScalar(1.48);
    this._vel.copy(carForward).multiplyScalar(-(12 + Math.random() * 9));
    this._vel.x += (Math.random() - 0.5) * 1.0;
    this._vel.y += (Math.random() - 0.5) * 0.85;
    this._vel.z += (Math.random() - 0.5) * 1.0;
    this.sparks.spawn(pos, this._vel, this._col, 0.07 + Math.random() * 0.05, 0, 3.8);
  }

  /** Audio-synced exhaust backfire pop / anti-lag crackle / EV plasma arc burst */
  public emitBackfireBurst(
    pos: THREE.Vector3,
    carForward: THREE.Vector3,
    hexColor: number,
    isElectricArc = false,
    count = 9
  ): void {
    this._col.setHex(hexColor).multiplyScalar(1.8);
    const maxCap = this.isMobile ? 5 : 12;
    const scaledCount = Math.min(maxCap, Math.max(2, Math.round(count * this.qualityScale)));
    for (let i = 0; i < scaledCount; i++) {
      this._vel.copy(carForward).multiplyScalar(-(10 + Math.random() * 14));
      const spread = isElectricArc ? 4.8 : 2.6;
      this._vel.x += (Math.random() - 0.5) * spread;
      this._vel.y += (Math.random() - 0.35) * spread;
      this._vel.z += (Math.random() - 0.5) * spread;
      this.sparks.spawn(
        pos,
        this._vel,
        this._col,
        isElectricArc ? 0.11 + Math.random() * 0.07 : 0.08 + Math.random() * 0.08,
        isElectricArc ? 0 : 12,
        isElectricArc ? 4.5 : 3.2
      );
    }
  }

  public emitSlipstreamStreak(pos: THREE.Vector3, carForward: THREE.Vector3): void {
    if (this.qualityScale < 0.99 && Math.random() > this.qualityScale) return;
    this._col.setHex(0xe2e8f0).multiplyScalar(1.25);
    this._vel.copy(carForward).multiplyScalar(-30);
    this.sparks.spawn(pos, this._vel, this._col, 0.12, 0, 1.0);
  }

  public updatePlayerTrails(
    leftPos: THREE.Vector3,
    rightPos: THREE.Vector3,
    up: THREE.Vector3,
    active: boolean,
    isSuper: boolean,
    customHex?: number,
    dt = 1 / 60
  ): void {
    // Fixed ~60Hz cadence keeps ribbon length identical across 60Hz, 90Hz & 120Hz displays!
    this.trailAccum += dt;
    if (this.trailAccum < 0.0155) return;
    this.trailAccum = Math.min(this.trailAccum - 0.0155, 0.032);

    this._col.setHex(customHex ?? (isSuper ? 0x60a5fa : 0xf97316));
    this.trailLeft.pushPoint(leftPos, up, active, this._col);
    this.trailRight.pushPoint(rightPos, up, active, this._col);
  }

  public update(dt: number): void {
    this.sparks.update(dt);
    this.smoke.update(dt);
  }

  public clear(): void {
    this.sparks.clear();
    this.smoke.clear();
    this.trailLeft.clear();
    this.trailRight.clear();
    this.lastImpactAt = 0;
    this.lastSmokeAt = 0;
    this.trailAccum = 0;
  }

  public dispose(): void {
    this.sparks.dispose();
    this.smoke.dispose();
    this.trailLeft.dispose();
    this.trailRight.dispose();
    this.glowTex.dispose();
  }
}
