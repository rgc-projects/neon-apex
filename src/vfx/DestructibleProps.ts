import * as THREE from 'three';
import { TrackSpline } from '../track/TrackSpline';

export interface SmashableCone {
  mesh: THREE.Group;
  homePos: THREE.Vector3;
  homeQuat: THREE.Quaternion;
  pos: THREE.Vector3;
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

  constructor(spline: TrackSpline) {
    const cfg = spline.config;

    const baseGeo = new THREE.BoxGeometry(0.84, 0.12, 0.84);
    const coneGeo = new THREE.ConeGeometry(0.32, 1.18, 18);
    const bandLowGeo = new THREE.CylinderGeometry(0.185, 0.24, 0.18, 18, 1, true);
    const bandHighGeo = new THREE.CylinderGeometry(0.115, 0.155, 0.14, 18, 1, true);

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
      bandLowGeo,
      bandHighGeo,
      rubberBaseMat,
      trafficOrangeMat,
      reflectiveBandMat
    );

    const basis = new THREE.Matrix4();

    for (const cluster of cfg.coneClusters) {
      const baseS = cluster.t * spline.totalLength;
      const d = cluster.side * (spline.halfWidth - 2.45);

      for (let i = 0; i < cluster.count; i++) {
        const s = (baseS + i * 6.2) % spline.totalLength;
        const f = spline.getFrameAtDistance(s);
        const homePos = f.pos.clone().addScaledVector(f.right, d);
        basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
        const homeQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

        const coneGroup = new THREE.Group();
        const base = new THREE.Mesh(baseGeo, rubberBaseMat);
        base.position.y = 0.06;
        const body = new THREE.Mesh(coneGeo, trafficOrangeMat);
        body.position.y = 0.66;
        const bandLow = new THREE.Mesh(bandLowGeo, reflectiveBandMat);
        bandLow.position.y = 0.56;
        const bandHigh = new THREE.Mesh(bandHighGeo, reflectiveBandMat);
        bandHigh.position.y = 0.84;

        coneGroup.add(base, body, bandLow, bandHigh);
        coneGroup.position.copy(homePos);
        coneGroup.quaternion.copy(homeQuat);
        this.group.add(coneGroup);

        this.cones.push({
          mesh: coneGroup,
          homePos,
          homeQuat,
          pos: homePos.clone(),
          vel: new THREE.Vector3(),
          angVel: new THREE.Vector3(),
          s,
          d,
          hit: false,
          respawnTimer: 0,
        });
      }
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
        const away = c.pos.clone().sub(carPos).normalize();
        c.vel
          .copy(carForward)
          .multiplyScalar(launchSpeed * 0.85)
          .addScaledVector(away, 12 + Math.random() * 8);
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
    for (const c of this.cones) {
      if (!c.hit) continue;
      c.respawnTimer -= dt;
      if (c.respawnTimer <= 0) {
        c.hit = false;
        c.pos.copy(c.homePos);
        c.vel.set(0, 0, 0);
        c.angVel.set(0, 0, 0);
        c.mesh.position.copy(c.homePos);
        c.mesh.quaternion.copy(c.homeQuat);
        c.mesh.scale.set(1, 1, 1);
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

      c.mesh.position.copy(c.pos);
      c.mesh.rotation.x += c.angVel.x * dt;
      c.mesh.rotation.y += c.angVel.y * dt;
      c.mesh.rotation.z += c.angVel.z * dt;

      // Fade scale down near respawn
      if (c.respawnTimer < 1.0) {
        const sc = Math.max(0.01, c.respawnTimer);
        c.mesh.scale.setScalar(sc);
      }
    }
  }

  public resetAll(): void {
    for (const c of this.cones) {
      c.hit = false;
      c.respawnTimer = 0;
      c.pos.copy(c.homePos);
      c.vel.set(0, 0, 0);
      c.angVel.set(0, 0, 0);
      c.mesh.position.copy(c.homePos);
      c.mesh.quaternion.copy(c.homeQuat);
      c.mesh.scale.set(1, 1, 1);
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
