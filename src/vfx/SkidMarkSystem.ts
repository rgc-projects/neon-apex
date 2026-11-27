import * as THREE from 'three';

/** Ring-buffer persistent tire skid marks conformed directly to 3D banked roads */
export class SkidMarkSystem {
  public readonly mesh: THREE.Mesh;
  private readonly maxQuads = 640;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.MeshBasicMaterial;
  private quadCursor = 0;
  private activeQuads = 0;

  private readonly prevLeft = new Map<string, THREE.Vector3>();
  private readonly prevRight = new Map<string, THREE.Vector3>();
  private readonly _dir = new THREE.Vector3();
  private readonly _side = new THREE.Vector3();
  private readonly _p0 = new THREE.Vector3();
  private readonly _p1 = new THREE.Vector3();
  private readonly _p2 = new THREE.Vector3();
  private readonly _p3 = new THREE.Vector3();
  private readonly _col = new THREE.Color();

  constructor() {
    this.positions = new Float32Array(this.maxQuads * 4 * 3);
    this.colors = new Float32Array(this.maxQuads * 4 * 3);

    const indices: number[] = [];
    for (let i = 0; i < this.maxQuads; i++) {
      const base = i * 4;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
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
      opacity: 0.64,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  public recordWheelPair(
    racerId: string,
    leftPos: THREE.Vector3,
    rightPos: THREE.Vector3,
    roadUp: THREE.Vector3,
    active: boolean,
    driftTier: 0 | 1 | 2 | 3
  ): void {
    if (!active) {
      this.prevLeft.delete(racerId);
      this.prevRight.delete(racerId);
      return;
    }

    const pL = this.prevLeft.get(racerId);
    const pR = this.prevRight.get(racerId);

    // Realistic scorched black rubber tracks on damp asphalt (warmer rubber edge at deep slip)
    const tint = driftTier === 3 ? 0x1d1614 : driftTier === 2 ? 0x161312 : 0x0b0d12;
    this._col.setHex(tint);

    if (pL && pR) {
      const dist = pL.distanceTo(leftPos);
      if (dist > 0.55 && dist < 12) {
        this.pushQuad(pL, leftPos, roadUp, 0.21, this._col);
        this.pushQuad(pR, rightPos, roadUp, 0.21, this._col);
        pL.copy(leftPos);
        pR.copy(rightPos);
        (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      } else if (dist >= 12) {
        pL.copy(leftPos);
        pR.copy(rightPos);
      }
    } else {
      this.prevLeft.set(racerId, leftPos.clone());
      this.prevRight.set(racerId, rightPos.clone());
    }
  }

  private pushQuad(
    from: THREE.Vector3,
    to: THREE.Vector3,
    up: THREE.Vector3,
    halfWidth: number,
    color: THREE.Color
  ): void {
    this._dir.subVectors(to, from).normalize();
    this._side.crossVectors(this._dir, up).normalize().multiplyScalar(halfWidth);

    const lift = 0.06;
    this._p0.copy(from).addScaledVector(up, lift).sub(this._side);
    this._p1.copy(from).addScaledVector(up, lift).add(this._side);
    this._p2.copy(to).addScaledVector(up, lift).sub(this._side);
    this._p3.copy(to).addScaledVector(up, lift).add(this._side);

    const base = this.quadCursor * 12;
    this.quadCursor = (this.quadCursor + 1) % this.maxQuads;
    if (this.activeQuads < this.maxQuads) {
      this.activeQuads++;
      this.geo.setDrawRange(0, this.activeQuads * 6);
    }
    this.mesh.visible = true;

    this.positions[base + 0] = this._p0.x;
    this.positions[base + 1] = this._p0.y;
    this.positions[base + 2] = this._p0.z;
    this.positions[base + 3] = this._p1.x;
    this.positions[base + 4] = this._p1.y;
    this.positions[base + 5] = this._p1.z;
    this.positions[base + 6] = this._p2.x;
    this.positions[base + 7] = this._p2.y;
    this.positions[base + 8] = this._p2.z;
    this.positions[base + 9] = this._p3.x;
    this.positions[base + 10] = this._p3.y;
    this.positions[base + 11] = this._p3.z;

    for (let v = 0; v < 4; v++) {
      this.colors[base + v * 3] = color.r;
      this.colors[base + v * 3 + 1] = color.g;
      this.colors[base + v * 3 + 2] = color.b;
    }
  }

  public clear(): void {
    this.positions.fill(0);
    this.prevLeft.clear();
    this.prevRight.clear();
    this.quadCursor = 0;
    this.activeQuads = 0;
    this.geo.setDrawRange(0, 0);
    this.mesh.visible = false;
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  public dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
