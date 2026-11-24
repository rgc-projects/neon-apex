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
  private mobileMode = false;

  private readonly _targetPos = new THREE.Vector3();
  private readonly _targetLook = new THREE.Vector3();
  private readonly _targetUp = new THREE.Vector3();
  private readonly _hoodPos = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(64, aspect, 0.25, 5000);
  }

  public setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public setMobileMode(mobile: boolean): void {
    this.mobileMode = mobile;
  }

  private isMobileViewport(): boolean {
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    return this.mobileMode || minDim <= 560;
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
    const isMobLandscape = this.isMobileViewport() && this.camera.aspect >= 1.35;
    const isMobPortrait = window.innerWidth < 760 && window.innerHeight > window.innerWidth;
    const dist = isMobPortrait ? 9.4 : isMobLandscape ? 6.9 : 8.4;
    const camX = showcaseOrigin.x + Math.sin(this.menuOrbitAngle) * dist;
    const camZ = showcaseOrigin.z + Math.cos(this.menuOrbitAngle) * dist;
    const camY =
      showcaseOrigin.y +
      (isMobPortrait ? 2.8 : isMobLandscape ? 2.15 : 2.45) +
      Math.sin(this.menuOrbitAngle * 0.7) * 0.25;

    this.camera.position.set(camX, camY, camZ);
    this.camera.up.set(0, 1, 0);
    // Shift lookAt slightly down in portrait so car shines cleanly in upper showroom window!
    const lookYOffset = isMobPortrait ? -0.35 : isMobLandscape ? 0.55 : 0.65;
    this.camera.lookAt(showcaseOrigin.x, showcaseOrigin.y + lookYOffset, showcaseOrigin.z);

    const menuFov = isMobLandscape ? 40 : 44;
    if (Math.abs(this.camera.fov - menuFov) > 0.1) {
      this.camera.fov = damp(this.camera.fov, menuFov, 6, dt);
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

    // Dynamic Arcade 3rd-Person Chase Camera with Corner-Apex Lookahead during Drift!
    // Desktop PC framing stays 100% untouched; Mobile viewports adapt seamlessly to ultrawide (19.5:9 / 20:9 / 21:9) & portrait!
    const isMob = this.isMobileViewport();
    const aspect = this.camera.aspect;
    const isMobLandscape = isMob && aspect >= 1.35;
    const isMobPortrait = isMob && aspect < 0.95;

    let backDist: number;
    let height: number;
    let lookAhead: number;
    let lookUp: number;
    let baseFov: number;
    let speedFovAdd: number;
    let boostFovAdd: number;
    let minFov: number;
    let maxFov: number;

    if (isMobLandscape) {
      // Continuous Horizontal-FOV compensation for modern long phones (16:9 -> 19.5:9 -> 20:9 -> 2.6:1 with browser bar)
      // Pulls camera closer & tightens vertical FOV so the Ferrari looks heroic & sharp instead of tiny/fisheyed!
      const ultra = clamp((aspect - 1.65) / 0.85, 0, 1);
      backDist = (5.95 - ultra * 0.45) + speedRatio * 0.85 + boostAdd * 0.85 + (racer.isDrifting ? 0.48 : 0);
      height = (2.22 - ultra * 0.14) + (racer.isAirborne ? 0.55 : 0) - boostAdd * 0.14 + (racer.isDrifting ? 0.15 : 0);
      lookAhead = 15.5;
      lookUp = 0.98;
      baseFov = 51.5 - ultra * 7.5;
      speedFovAdd = 12.0;
      boostFovAdd = 9.5;
      minFov = 42;
      maxFov = 70;
    } else if (isMobPortrait) {
      backDist = 7.1 + speedRatio * 1.15 + boostAdd * 1.05 + (racer.isDrifting ? 0.65 : 0);
      height = 2.82 + (racer.isAirborne ? 0.65 : 0) - boostAdd * 0.2 + (racer.isDrifting ? 0.2 : 0);
      lookAhead = 16.5;
      lookUp = 1.12;
      baseFov = 66;
      speedFovAdd = 14;
      boostFovAdd = 11;
      minFov = 64;
      maxFov = 92;
    } else {
      // Original Desktop PC framing (100% preserved!)
      backDist = 7.4 + speedRatio * 1.45 + boostAdd * 1.35 + (racer.isDrifting ? 0.75 : 0);
      height = 2.75 + (racer.isAirborne ? 0.75 : 0) - boostAdd * 0.25 + (racer.isDrifting ? 0.22 : 0);
      lookAhead = 17;
      lookUp = 1.15;
      baseFov = 62;
      speedFovAdd = 18;
      boostFovAdd = 15;
      minFov = 60;
      maxFov = 96;
    }

    // Swing camera slightly to the OUTSIDE of the drift while aiming lookAt INTO the apex!
    const driftCamSwing = racer.visualSlipAngle * (isMobLandscape ? 2.1 : 2.65);
    const apexLookBias = racer.isDrifting ? racer.driftDir * (isMobLandscape ? 2.6 : 3.1) : 0;

    // Follow road-aligned forward blended with car forward so hairpin exits stay crystal clear!
    const followDir = racer.frame.tangent.clone().lerp(racer.worldForward, racer.isDrifting ? 0.32 : 0.55).normalize();
    const followRight = racer.frame.right;
    const followUp = racer.frame.up;

    this._targetPos
      .copy(racer.worldPos)
      .addScaledVector(followDir, -backDist)
      .addScaledVector(followUp, height)
      .addScaledVector(followRight, -driftCamSwing);

    this._targetLook
      .copy(racer.worldPos)
      .addScaledVector(followDir, lookAhead)
      .addScaledVector(followRight, apexLookBias)
      .addScaledVector(followUp, lookUp);

    // Subtle banking roll with the banked highway (55% bank sells high-G banked bowl thrills!)
    this._targetUp.set(0, 1, 0).lerp(followUp, 0.58).normalize();

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
    const targetFov = baseFov + speedRatio * speedFovAdd + boostAdd * boostFovAdd;
    this.currentFov = damp(this.currentFov, clamp(targetFov, minFov, maxFov), 7.5, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
