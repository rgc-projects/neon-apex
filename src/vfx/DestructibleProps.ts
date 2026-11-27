import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TrackSpline } from '../track/TrackSpline';

export interface SmashableCone {
  index: number;
  homePos: THREE.Vector3;
  homeQuat: THREE.Quaternion;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  s: number;
  d: number;
  hit: boolean;
  respawnTimer: number;
}

export class DestructibleProps {
  public readonly group = new THREE.Group();
  public readonly cones: SmashableCone[] = [];
  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private readonly instMeshes: THREE.InstancedMesh[] = [];
  private readonly tmpMat = new THREE.Matrix4();
  private readonly tmpQuat = new THREE.Quaternion();
  private readonly tmpScale = new THREE.Vector3(1, 1, 1);
  private readonly tmpAway = new THREE.Vector3();

  constructor(spline: TrackSpline) {
    const cfg = spline.config;

    // Bake local vertical offsets into shared geometries so all cones across the
    // entire circuit render in just 3 InstancedMesh draw calls instead of 4 * N!
    const baseGeo = new THREE.BoxGeometry(0.84, 0.12, 0.84);
    baseGeo.translate(0, 0.06, 0);

    const coneGeo = new THREE.ConeGeometry(0.32, 1.18, 16);
    coneGeo.translate(0, 0.66, 0);

    const bandLowGeo = new THREE.CylinderGeometry(0.185, 0.24, 0.18, 16, 1, true);
    bandLowGeo.translate(0, 0.56, 0);
    const bandHighGeo = new THREE.CylinderGeometry(0.115, 0.155, 0.14, 16, 1, true);
    bandHighGeo.translate(0, 0.84, 0);
    const bandsGeo = mergeGeometries([bandLowGeo, bandHighGeo], false) ?? bandLowGeo;
    bandLowGeo.dispose();
    bandHighGeo.dispose();

    const rubberBaseMat = new THREE.MeshStandardMaterial({
      color: 0x181b21,
      metalness: 0.08,
      roughness: 0.88,
    });
    const trafficOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xf95715,
      emissive: 0x451203,
      emissiveIntensity: 0.45,
      metalness: 0.06,
      roughness: 0.42,
    });
    const reflectiveBandMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xdce7f5,
      emissiveIntensity: 0.65,
      metalness: 0.25,
      roughness: 0.22,
    });

    this.disposables.push(
      baseGeo,
      coneGeo,
      bandsGeo,
      rubberBaseMat,
      trafficOrangeMat,
      reflectiveBandMat
    );

    const basis = new THREE.Matrix4();
    const negTan = new THREE.Vector3();

    for (const cluster of cfg.coneClusters) {
      const baseS = cluster.t * spline.totalLength;
      const d = cluster.side * (spline.halfWidth - 2.45);

      for (let i = 0; i < cluster.count; i++) {
        const s = (baseS + i * 6.2) % spline.totalLength;
        const f = spline.getFrameAtDistance(s);
        const homePos = f.pos.clone().addScaledVector(f.right, d);
        negTan.copy(f.tangent).negate();
        basis.makeBasis(f.right, f.up, negTan);
        const homeQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

        this.cones.push({
          index: this.cones.length,
          homePos,
          homeQuat,
          pos: homePos.clone(),
          rot: new THREE.Euler().setFromQuaternion(homeQuat),
          vel: new THREE.Vector3(),
          angVel: new THREE.Vector3(),
          s,
          d,
          hit: false,
          respawnTimer: 0,
        });
      }
    }

    const total = this.cones.length;
    if (total > 0) {
      const baseInst = new THREE.InstancedMesh(baseGeo, rubberBaseMat, total);
      const bodyInst = new THREE.InstancedMesh(coneGeo, trafficOrangeMat, total);
      const bandsInst = new THREE.InstancedMesh(bandsGeo, reflectiveBandMat, total);

      for (const c of this.cones) {
        this.tmpScale.set(1, 1, 1);
        this.tmpMat.compose(c.homePos, c.homeQuat, this.tmpScale);
        baseInst.setMatrixAt(c.index, this.tmpMat);
        bodyInst.setMatrixAt(c.index, this.tmpMat);
        bandsInst.setMatrixAt(c.index, this.tmpMat);
      }
      baseInst.instanceMatrix.needsUpdate = true;
      bodyInst.instanceMatrix.needsUpdate = true;
      bandsInst.instanceMatrix.needsUpdate = true;
      // Cones span the entire circuit; disable bounding-sphere cull so flying cones never vanish
      baseInst.frustumCulled = false;
      bodyInst.frustumCulled = false;
      bandsInst.frustumCulled = false;

      this.instMeshes.push(baseInst, bodyInst, bandsInst);
      this.group.add(baseInst, bodyInst, bandsInst);
    }
  }

  private writeConeMatrix(index: number, pos: THREE.Vector3, quat: THREE.Quaternion, scale: number): void {
    this.tmpScale.setScalar(scale);
    this.tmpMat.compose(pos, quat, this.tmpScale);
    for (let i = 0; i < this.instMeshes.length; i++) {
      this.instMeshes[i].setMatrixAt(index, this.tmpMat);
    }
  }

  private markMatricesDirty(): void {
    for (let i = 0; i < this.instMeshes.length; i++) {
      this.instMeshes[i].instanceMatrix.needsUpdate = true;
    }
  }

  /** Checks car proximity and launches cones dramatically on impact */
  public checkHit(
    carPos: THREE.Vector3,
    carForward: THREE.Vector3,
    carSpeed: number,
    onSmash?: (pos: THREE.Vector3) => void
  ): number {
    let hitCount = 0;
    const hitRadiusSq = 2.65 * 2.65;

    for (const c of this.cones) {
      if (c.hit) continue;
      if (c.pos.distanceToSquared(carPos) < hitRadiusSq) {
        c.hit = true;
        c.respawnTimer = 14.0;
        const launchSpeed = Math.max(22, carSpeed * 0.95);
        this.tmpAway.copy(c.pos).sub(carPos).normalize();
        c.vel
          .copy(carForward)
          .multiplyScalar(launchSpeed * 0.85)
          .addScaledVector(this.tmpAway, 12 + Math.random() * 8);
        c.vel.y += 10 + Math.random() * 9;

        c.angVel.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18
        );

        hitCount++;
        if (onSmash) onSmash(c.pos);
      }
    }
    return hitCount;
  }

  public update(dt: number): void {
    const gravity = 32;
    let dirty = false;

    for (const c of this.cones) {
      if (!c.hit) continue;
      dirty = true;
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0) {
        c.hit = false;
        c.pos.copy(c.homePos);
        c.rot.setFromQuaternion(c.homeQuat);
        c.vel.set(0, 0, 0);
        c.angVel.set(0, 0, 0);
        this.writeConeMatrix(c.index, c.homePos, c.homeQuat, 1);
        continue;
      }

      c.vel.y -= gravity * dt;
      c.pos.addScaledVector(c.vel, dt);

      // Bounce off local floor elevation
      if (c.pos.y < c.homePos.y) {
        c.pos.y = c.homePos.y;
        c.vel.y = Math.abs(c.vel.y) * 0.48;
        c.vel.x *= 0.84;
        c.vel.z *= 0.84;
      }

      c.rot.x += c.angVel.x * dt;
      c.rot.y += c.angVel.y * dt;
      c.rot.z += c.angVel.z * dt;
      this.tmpQuat.setFromEuler(c.rot);

      const sc = c.respawnTimer < 1.0 ? Math.max(0.01, c.respawnTimer) : 1;
      this.writeConeMatrix(c.index, c.pos, this.tmpQuat, sc);
    }

    if (dirty) {
      this.markMatricesDirty();
    }
  }

  public resetAll(): void {
    if (this.cones.length === 0) return;
    for (const c of this.cones) {
      c.hit = false;
      c.respawnTimer = 0;
      c.pos.copy(c.homePos);
      c.rot.setFromQuaternion(c.homeQuat);
      c.vel.set(0, 0, 0);
      c.angVel.set(0, 0, 0);
      this.writeConeMatrix(c.index, c.homePos, c.homeQuat, 1);
    }
    this.markMatricesDirty();
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
