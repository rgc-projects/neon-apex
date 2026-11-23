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

    const baseGeo = new THREE.BoxGeometry(0.95, 0.16, 0.95);
    const coneGeo = new THREE.ConeGeometry(0.36, 1.35, 8);
    const bandGeo = new THREE.CylinderGeometry(0.18, 0.27, 0.28, 8);

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x16192c,
      metalness: 0.7,
      roughness: 0.35,
    });
    const neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff7700).multiplyScalar(2.1),
      toneMapped: false,
    });
    const cyanBandMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00f2ff).multiplyScalar(1.9),
      toneMapped: false,
    });

    this.disposables.push(baseGeo, coneGeo, bandGeo, darkMat, neonMat, cyanBandMat);

    const basis = new THREE.Matrix4();

    for (const cluster of cfg.coneClusters) {
      const baseS = cluster.t * spline.totalLength;
      const d = cluster.side * (spline.halfWidth - 2.35);

      for (let i = 0; i < cluster.count; i++) {
        const s = (baseS + i * 5.2) % spline.totalLength;
        const f = spline.getFrameAtDistance(s);
        const homePos = f.pos.clone().addScaledVector(f.right, d);
        basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
        const homeQuat = new THREE.Quaternion().setFromRotationMatrix(basis);

        const coneGroup = new THREE.Group();
        const base = new THREE.Mesh(baseGeo, darkMat);
        base.position.y = 0.08;
        const body = new THREE.Mesh(coneGeo, neonMat);
        body.position.y = 0.78;
        const band = new THREE.Mesh(bandGeo, cyanBandMat);
        band.position.y = 0.76;

        coneGroup.add(base, body, band);
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
