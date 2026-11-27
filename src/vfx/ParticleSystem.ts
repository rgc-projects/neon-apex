import * as THREE from 'three';
import { createParticleGlowTexture } from '../utils/textures';

interface Particle {
  active: boolean;
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

class PooledPointsLayer {
  public readonly points: THREE.Points;
  private readonly maxCount: number;
  private readonly pool: Particle[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.PointsMaterial;
  private cursor = 0;

  constructor(
    maxCount: number,
    size: number,
    texture: THREE.Texture,
    additive: boolean,
    opacity: number
  ) {
    this.maxCount = maxCount;
    this.positions = new Float32Array(maxCount * 3);
    this.colors = new Float32Array(maxCount * 3);

    for (let i = 0; i < maxCount; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: -9999,
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
      this.positions[i * 3 + 1] = -9999;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.mat = new THREE.PointsMaterial({
      size,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: !additive,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  public spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.Color,
    life: number,
    gravity: number,
    drag: number
  ): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.maxCount;
    p.active = true;
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
    for (let i = 0; i < this.maxCount; i++) {
      const p = this.pool[i];
      const i3 = i * 3;
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this.positions[i3 + 1] = -9999;
        this.colors[i3] = 0;
        this.colors[i3 + 1] = 0;
        this.colors[i3 + 2] = 0;
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
      this.positions[i3] = p.x;
      this.positions[i3 + 1] = p.y;
      this.positions[i3 + 2] = p.z;

      this.colors[i3] = p.r * fade;
      this.colors[i3 + 1] = p.g * fade;
      this.colors[i3 + 2] = p.b * fade;
    }

    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  public clear(): void {
    for (let i = 0; i < this.maxCount; i++) {
      this.pool[i].active = false;
      this.positions[i * 3 + 1] = -9999;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Smooth dynamic glowing ribbon trail streaming from a car's exhausts/taillights */
class NitroRibbonTrail {
  public readonly mesh: THREE.Mesh;
  private readonly maxPts = 28;
  private readonly history: { pos: THREE.Vector3; up: THREE.Vector3; active: boolean }[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly halfWidth = 0.085;

  constructor() {
    for (let i = 0; i < this.maxPts; i++) {
      this.history.push({ pos: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), active: false });
    }
    this.positions = new Float32Array(this.maxPts * 2 * 3);
    this.colors = new Float32Array(this.maxPts * 2 * 3);

    const indices: number[] = [];
    for (let i = 0; i < this.maxPts - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geo.setIndex(indices);

    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
  }

  public pushPoint(pos: THREE.Vector3, up: THREE.Vector3, active: boolean, color: THREE.Color): void {
    // Shift history back
    for (let i = this.maxPts - 1; i > 0; i--) {
      this.history[i].pos.copy(this.history[i - 1].pos);
      this.history[i].up.copy(this.history[i - 1].up);
      this.history[i].active = this.history[i - 1].active;
    }
    this.history[0].pos.copy(pos);
    this.history[0].up.copy(up);
    this.history[0].active = active;

    for (let i = 0; i < this.maxPts; i++) {
      const h = this.history[i];
      const v0 = i * 6;
      const v1 = v0 + 3;
      const fade = h.active ? Math.pow(1 - i / (this.maxPts - 1), 1.6) : 0;
      const w = this.halfWidth * (0.25 + 0.75 * fade);

      if (!h.active) {
        this.positions[v0] = pos.x;
        this.positions[v0 + 1] = pos.y;
        this.positions[v0 + 2] = pos.z;
        this.positions[v1] = pos.x;
        this.positions[v1 + 1] = pos.y;
        this.positions[v1 + 2] = pos.z;
      } else {
        this.positions[v0] = h.pos.x + h.up.x * w;
        this.positions[v0 + 1] = h.pos.y + h.up.y * w;
        this.positions[v0 + 2] = h.pos.z + h.up.z * w;
        this.positions[v1] = h.pos.x - h.up.x * w;
        this.positions[v1 + 1] = h.pos.y - h.up.y * w;
        this.positions[v1 + 2] = h.pos.z - h.up.z * w;
      }

      const r = color.r * fade * 1.35;
      const g = color.g * fade * 1.35;
      const b = color.b * fade * 1.35;
      this.colors[v0] = r;
      this.colors[v0 + 1] = g;
      this.colors[v0 + 2] = b;
      this.colors[v1] = r;
      this.colors[v1 + 1] = g;
      this.colors[v1 + 2] = b;
    }

    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  public clear(): void {
    for (const h of this.history) h.active = false;
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
  private qualityScale = 1.0;

  public setQuality(level: 'low' | 'medium' | 'high'): void {
    this.qualityScale = level === 'low' ? 0.35 : level === 'medium' ? 0.7 : 1.0;
  }

  constructor() {
    this.glowTex = createParticleGlowTexture();
    this.sparks = new PooledPointsLayer(1400, 0.13, this.glowTex, true, 0.92);
    this.smoke = new PooledPointsLayer(620, 1.45, this.glowTex, false, 0.2);
    this.trailLeft = new NitroRibbonTrail();
    this.trailRight = new NitroRibbonTrail();

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
    this._col.setHex(hex).multiplyScalar(1.38);

    const scaledCount = Math.max(
      this.qualityScale >= 0.65 ? 1 : Math.random() < this.qualityScale ? 1 : 0,
      Math.round(count * this.qualityScale)
    );
    for (let i = 0; i < scaledCount; i++) {
      this._vel
        .copy(carForward)
        .multiplyScalar(-(7 + Math.random() * 11))
        .addScaledVector(carUp, 1.8 + Math.random() * 4.5);
      this._vel.x += (Math.random() - 0.5) * 5.2;
      this._vel.z += (Math.random() - 0.5) * 5.2;
      this.sparks.spawn(pos, this._vel, this._col, 0.14 + Math.random() * 0.14, 24, 1.8);
    }
  }

  public emitTireSmoke(pos: THREE.Vector3, carForward: THREE.Vector3, carUp: THREE.Vector3, tintHex = 0xd6dde8): void {
    if (this.qualityScale < 0.99 && Math.random() > this.qualityScale) return;
    this._col.setHex(tintHex);
    this._vel
      .copy(carForward)
      .multiplyScalar(-(2.8 + Math.random() * 4.5))
      .addScaledVector(carUp, 1.4 + Math.random() * 2.4);
    this._vel.x += (Math.random() - 0.5) * 3.8;
    this._vel.z += (Math.random() - 0.5) * 3.8;
    this.smoke.spawn(pos, this._vel, this._col, 0.55 + Math.random() * 0.35, -1.6, 2.4);
  }

  public emitImpactBurst(pos: THREE.Vector3, hexColor: number, count = 22): void {
    this._col.setHex(hexColor).multiplyScalar(1.7);
    const scaledCount = Math.max(
      this.qualityScale >= 0.65 ? 1 : Math.random() < this.qualityScale ? 1 : 0,
      Math.round(count * this.qualityScale)
    );
    for (let i = 0; i < scaledCount; i++) {
      this._vel.set(
        (Math.random() - 0.5) * 24,
        4 + Math.random() * 14,
        (Math.random() - 0.5) * 24
      );
      this.sparks.spawn(pos, this._vel, this._col, 0.28 + Math.random() * 0.3, 28, 1.6);
    }
  }

  public emitNitroExhaust(
    pos: THREE.Vector3,
    carForward: THREE.Vector3,
    isSuper: boolean,
    customHex?: number
  ): void {
    this._col.setHex(customHex ?? (isSuper ? 0x93c5fd : 0xffb04a)).multiplyScalar(1.48);
    this._vel.copy(carForward).multiplyScalar(-(12 + Math.random() * 9));
    this._vel.x += (Math.random() - 0.5) * 1.1;
    this._vel.y += (Math.random() - 0.5) * 0.9;
    this._vel.z += (Math.random() - 0.5) * 1.1;
    this.sparks.spawn(pos, this._vel, this._col, 0.08 + Math.random() * 0.06, 0, 3.8);
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
    const scaledCount = Math.max(2, Math.round(count * this.qualityScale));
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
        isElectricArc ? 0.12 + Math.random() * 0.08 : 0.09 + Math.random() * 0.09,
        isElectricArc ? 0 : 12,
        isElectricArc ? 4.5 : 3.2
      );
    }
  }

  public emitSlipstreamStreak(pos: THREE.Vector3, carForward: THREE.Vector3): void {
    this._col.setHex(0xe2e8f0).multiplyScalar(1.25);
    this._vel.copy(carForward).multiplyScalar(-30);
    this.sparks.spawn(pos, this._vel, this._col, 0.14, 0, 1.0);
  }

  public updatePlayerTrails(
    leftPos: THREE.Vector3,
    rightPos: THREE.Vector3,
    up: THREE.Vector3,
    active: boolean,
    isSuper: boolean,
    customHex?: number
  ): void {
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
  }

  public dispose(): void {
    this.sparks.dispose();
    this.smoke.dispose();
    this.trailLeft.dispose();
    this.trailRight.dispose();
    this.glowTex.dispose();
  }
}
