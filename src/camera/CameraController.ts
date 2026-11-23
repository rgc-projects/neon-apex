import * as THREE from 'three';
import { CameraMode } from '../types';
import { clamp, damp } from '../utils/math';
import { RacerPhysics } from '../vehicle/CarPhysics';

export class CameraController {
  public readonly camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'CHASE';

  private readonly currentPos = new THREE.Vector3(0, 5, 12);
  private readonly currentLook = new THREE.Vector3(0, 1, 0);
  private readonly currentUp = new THREE.Vector3(0, 1, 0);

  private currentFov = 64;
  private shakeIntensity = 0;
  private menuOrbitAngle = 0.55;
  private menuOrbitVel = 0;
  private menuDragging = false;
  private finishOrbitAngle = 0;
  private initialized = false;

  private readonly _targetPos = new THREE.Vector3();
  private readonly _targetLook = new THREE.Vector3();
  private readonly _targetUp = new THREE.Vector3();
  private readonly _hoodPos = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(64, aspect, 0.25, 3200);
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public toggleMode(): CameraMode {
    this.mode = this.mode === 'CHASE' ? 'HOOD' : 'CHASE';
    this.initialized = false;
    return this.mode;
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(1.2, this.shakeIntensity + amount);
  }

  public resetSnap(): void {
    this.initialized = false;
    this.finishOrbitAngle = 0;
  }

  public setMenuDragging(dragging: boolean): void {
    this.menuDragging = dragging;
  }

  public orbitMenuBy(deltaRad: number): void {
    this.menuOrbitAngle += deltaRad;
    this.menuOrbitVel = deltaRad * 18;
  }

  public updateMenuShowcase(dt: number, showcaseOrigin: THREE.Vector3): void {
    if (!this.menuDragging) {
      this.menuOrbitVel = damp(this.menuOrbitVel, 0, 5.5, dt);
      this.menuOrbitAngle += (0.34 + this.menuOrbitVel) * dt;
    }
    const dist = window.innerWidth < 760 ? 9.4 : 8.4;
    const camX = showcaseOrigin.x + Math.sin(this.menuOrbitAngle) * dist;
    const camZ = showcaseOrigin.z + Math.cos(this.menuOrbitAngle) * dist;
    const camY = showcaseOrigin.y + (window.innerWidth < 760 ? 2.8 : 2.45) + Math.sin(this.menuOrbitAngle * 0.7) * 0.25;

    this.camera.position.set(camX, camY, camZ);
    this.camera.up.set(0, 1, 0);
    // Shift lookAt slightly down in portrait so car shines cleanly in upper showroom window!
    const lookYOffset = window.innerWidth < 760 && window.innerHeight > window.innerWidth ? -0.35 : 0.65;
    this.camera.lookAt(showcaseOrigin.x, showcaseOrigin.y + lookYOffset, showcaseOrigin.z);

    if (Math.abs(this.camera.fov - 44) > 0.1) {
      this.camera.fov = damp(this.camera.fov, 44, 6, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  public updateRace(dt: number, racer: RacerPhysics, isFinishSlowMo: boolean): void {
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.6);

    const speedRatio = clamp(racer.speed / 110, 0, 1.3);
    const boostAdd = racer.isNitroActive
      ? racer.isSuperNitro
        ? 1.0
        : 0.65
      : racer.miniBoostTimer > 0 || racer.boostPadTimer > 0
        ? 0.45
        : 0;

    if (isFinishSlowMo) {
      // Dramatic low-angle cinematic orbit around the crossing car!
      this.finishOrbitAngle += dt * 1.45;
      const rad = 6.2;
      const forward = racer.worldForward;
      const right = racer.worldRight;
      const up = racer.frame.up;

      this._targetPos
        .copy(racer.worldPos)
        .addScaledVector(forward, Math.cos(this.finishOrbitAngle) * rad)
        .addScaledVector(right, Math.sin(this.finishOrbitAngle) * rad)
        .addScaledVector(up, 2.0);
      this._targetLook.copy(racer.worldPos).addScaledVector(up, 0.85);
      this._targetUp.set(0, 1, 0);

      this.currentPos.lerp(this._targetPos, 1 - Math.exp(-6 * dt));
      this.currentLook.lerp(this._targetLook, 1 - Math.exp(-8 * dt));
      this.camera.position.copy(this.currentPos);
      this.camera.up.copy(this._targetUp);
      this.camera.lookAt(this.currentLook);
      this.currentFov = damp(this.currentFov, 54, 5, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.mode === 'HOOD') {
      // Intense First-Person Hood View
      racer.model.getHoodCameraPos(this._hoodPos);
      this._targetLook
        .copy(this._hoodPos)
        .addScaledVector(racer.worldForward, 36)
        .addScaledVector(racer.worldUp, -0.45);
      this._targetUp.copy(racer.frame.up).lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();

      this.camera.position.copy(this._hoodPos);
      this.camera.up.copy(this._targetUp);

      // Subtle micro-vibration at ultra high speed or nitro
      const microShake = (this.shakeIntensity + (racer.isNitroActive ? 0.14 : speedRatio * 0.03)) * 0.08;
      if (microShake > 0.002) {
        this.camera.position.x += (Math.random() - 0.5) * microShake;
        this.camera.position.y += (Math.random() - 0.5) * microShake;
      }

      this.camera.lookAt(this._targetLook);

      const targetFov = 70 + speedRatio * 17 + boostAdd * 13;
      this.currentFov = damp(this.currentFov, clamp(targetFov, 68, 102), 8, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    // Dynamic Arcade 3rd-Person Chase Camera
    const backDist = 7.4 + speedRatio * 1.45 + boostAdd * 1.35;
    const height = 2.75 + (racer.isAirborne ? 0.75 : 0) - boostAdd * 0.25;
    const driftSwing = racer.visualSlipAngle * 2.15;

    // Follow road-aligned forward blended with car forward so corners feel panoramic
    const followDir = racer.frame.tangent.clone().lerp(racer.worldForward, 0.58).normalize();
    const followRight = racer.frame.right;
    const followUp = racer.frame.up;

    this._targetPos
      .copy(racer.worldPos)
      .addScaledVector(followDir, -backDist)
      .addScaledVector(followUp, height)
      .addScaledVector(followRight, -driftSwing);

    this._targetLook
      .copy(racer.worldPos)
      .addScaledVector(followDir, 15)
      .addScaledVector(followUp, 1.15);

    // Subtle banking roll with the banked highway (50% bank feels thrilling without motion sickness)
    this._targetUp.set(0, 1, 0).lerp(followUp, 0.52).normalize();

    if (!this.initialized) {
      this.currentPos.copy(this._targetPos);
      this.currentLook.copy(this._targetLook);
      this.currentUp.copy(this._targetUp);
      this.initialized = true;
    } else {
      const posLambda = 12.5;
      const lookLambda = 16.0;
      this.currentPos.lerp(this._targetPos, 1 - Math.exp(-posLambda * dt));
      this.currentLook.lerp(this._targetLook, 1 - Math.exp(-lookLambda * dt));
      this.currentUp.lerp(this._targetUp, 1 - Math.exp(-8 * dt)).normalize();
    }

    this.camera.position.copy(this.currentPos);

    // Apply camera shake (impacts, landings, super nitro roar)
    const activeShake = this.shakeIntensity + (racer.isSuperNitro ? 0.18 : racer.isNitroActive ? 0.08 : 0);
    if (activeShake > 0.01) {
      const mag = activeShake * 0.28;
      this.camera.position.x += (Math.random() - 0.5) * mag;
      this.camera.position.y += (Math.random() - 0.5) * mag;
      this.camera.position.z += (Math.random() - 0.5) * mag;
    }

    this.camera.up.copy(this.currentUp);
    this.camera.lookAt(this.currentLook);

    // Dynamic FOV pull for insane arcade speed feel
    const targetFov = 62 + speedRatio * 18 + boostAdd * 15;
    this.currentFov = damp(this.currentFov, clamp(targetFov, 60, 96), 7.5, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
