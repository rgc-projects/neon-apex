import * as THREE from 'three';
import { CarSpec } from '../types';
import {
  createContactShadowTexture,
  createHeadlightBeamTexture,
  createParticleGlowTexture,
} from '../utils/textures';
import { supercarAssets } from './SupercarLoader';

let sharedShadowTex: THREE.CanvasTexture | null = null;
let sharedGlowTex: THREE.CanvasTexture | null = null;
let sharedBeamTex: THREE.CanvasTexture | null = null;

/**
 * Photorealistic GT3 / Street Hypercar Model.
 * Mounts the locally bundled open-source supercar GLB (Ferrari 458 Italia by vicent091036, CC BY 4.0)
 * customized with automotive metallic clearcoat paint, matte carbon-fiber GT3 aero kits,
 * stationary Brembo-style calipers with glowing carbon-ceramic brake discs, articulated front wheels,
 * realistic ground AO contact shadow, reactive taillights, and realistic afterburner exhaust flames.
 */
export class CarModel {
  public readonly root = new THREE.Group();
  public readonly driftYawPivot = new THREE.Group();
  public readonly chassis = new THREE.Group();

  private readonly wheelContainer = new THREE.Group();
  private readonly bodySlot = new THREE.Group();
  private readonly aeroSlot = new THREE.Group();

  private frontLeftPivot: THREE.Object3D | null = null;
  private frontRightPivot: THREE.Object3D | null = null;
  private wheelSpinNodes: THREE.Object3D[] = [];
  private steeringWheelNode: THREE.Object3D | null = null;
  private rearWingBlade: THREE.Mesh | null = null;
  private rearWingFlap: THREE.Mesh | null = null;
  private wingBaseAngle = 0.07;

  private readonly paintMat: THREE.MeshPhysicalMaterial;
  private readonly carbonMat: THREE.MeshStandardMaterial;
  private readonly glassMat: THREE.MeshPhysicalMaterial;
  private readonly caliperMat: THREE.MeshStandardMaterial;
  private readonly brakeDiscMat: THREE.MeshStandardMaterial;
  private readonly headlightMat: THREE.MeshBasicMaterial;
  private readonly brakeLightMat: THREE.MeshStandardMaterial;
  private readonly rearBounceMat: THREE.MeshBasicMaterial;

  private readonly nitroFlameGroup = new THREE.Group();
  private readonly flameInnerMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameOuterMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameCones: THREE.Mesh[] = [];
  private readonly nitroPointLight: THREE.PointLight;

  // Local anchor positions (matching ~1.12x scaled real supercar)
  private readonly rearLeftContact = new THREE.Vector3(-0.96, 0.06, 1.66);
  private readonly rearRightContact = new THREE.Vector3(0.96, 0.06, 1.66);
  private readonly exhaustLeftLocal = new THREE.Vector3(-0.36, 0.34, 2.52);
  private readonly exhaustRightLocal = new THREE.Vector3(0.36, 0.34, 2.52);
  private readonly hoodCamLocal = new THREE.Vector3(0, 1.18, -0.35);

  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private flamePhase = Math.random() * 10;
  private brakeHeat = 0;
  private disposed = false;

  constructor(
    public readonly spec: CarSpec,
    overridePrimary?: number,
    overrideAccent?: number,
    private readonly isPlayer = false
  ) {
    this.root.add(this.driftYawPivot);
    this.driftYawPivot.add(this.chassis);
    this.driftYawPivot.add(this.wheelContainer);
    this.chassis.add(this.bodySlot, this.aeroSlot);

    if (!sharedShadowTex) sharedShadowTex = createContactShadowTexture();
    if (!sharedGlowTex) sharedGlowTex = createParticleGlowTexture();
    if (!sharedBeamTex) sharedBeamTex = createHeadlightBeamTexture();

    const bodyHex = overridePrimary ?? spec.primaryColor;
    const accentHex = overrideAccent ?? spec.neonColor;

    // Deep Automotive Metallic Clearcoat Paint (GT7 / Forza Horizon style)
    this.paintMat = new THREE.MeshPhysicalMaterial({
      color: bodyHex,
      metalness: 0.82,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.85,
    });

    // Dry-Weave Satin Motorsport Carbon Fiber
    this.carbonMat = new THREE.MeshStandardMaterial({
      color: 0x181b24,
      metalness: 0.42,
      roughness: 0.44,
      envMapIntensity: 1.1,
    });

    // Tinted Laminated Automotive Cockpit Glass
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1320,
      metalness: 0.15,
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 2.1,
    });

    // Painted Performance Brake Calipers & Brushed Anodized Trim
    this.caliperMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      metalness: 0.58,
      roughness: 0.28,
      envMapIntensity: 1.35,
    });

    // Ventilated Carbon-Ceramic Brake Rotors (glow subtly cherry-orange under hard braking!)
    this.brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x525866,
      emissive: 0xff3b0a,
      emissiveIntensity: 0,
      metalness: 0.88,
      roughness: 0.32,
    });

    // Crisp Xenon / Laser Headlight Projectors
    this.headlightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xf4f8ff).multiplyScalar(1.6),
      toneMapped: false,
    });

    // Realistic Deep LED Crimson Taillights
    this.brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xb80d22,
      emissive: 0xff162c,
      emissiveIntensity: 1.1,
      roughness: 0.18,
      metalness: 0.15,
      toneMapped: false,
    });

    // Subtle crimson taillight reflection wash on damp asphalt behind car
    this.rearBounceMat = new THREE.MeshBasicMaterial({
      map: sharedGlowTex,
      color: 0xff1f2d,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Grounded Dark Ambient-Occlusion Contact Shadow under chassis (eliminates "floating car" look)
    const shadowMat = new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    this.disposables.push(
      this.paintMat,
      this.carbonMat,
      this.glassMat,
      this.caliperMat,
      this.brakeDiscMat,
      this.headlightMat,
      this.brakeLightMat,
      this.rearBounceMat,
      shadowMat
    );

    const shadowGeo = new THREE.PlaneGeometry(3.05, 5.75);
    shadowGeo.rotateX(-Math.PI / 2);
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.set(0, 0.045, 0.08);
    this.driftYawPivot.add(contactShadow);
    this.disposables.push(shadowGeo);

    const bounceGeo = new THREE.PlaneGeometry(3.6, 4.4);
    bounceGeo.rotateX(-Math.PI / 2);
    const rearBounce = new THREE.Mesh(bounceGeo, this.rearBounceMat);
    rearBounce.position.set(0, 0.07, 3.15);
    this.chassis.add(rearBounce);
    this.disposables.push(bounceGeo);

    // Player tapered xenon headlight beams on damp tarmac (feathered realistic pools, never a hard white strip)
    if (isPlayer) {
      const beamGeo = new THREE.PlaneGeometry(2.4, 18);
      beamGeo.rotateX(-Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        map: sharedBeamTex,
        color: 0xeef5ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beamL = new THREE.Mesh(beamGeo, beamMat);
      beamL.position.set(-0.82, 0.09, -11.2);
      const beamR = new THREE.Mesh(beamGeo, beamMat);
      beamR.position.set(0.82, 0.09, -11.2);
      this.chassis.add(beamL, beamR);
      this.disposables.push(beamGeo, beamMat);
    }

    // Build custom GT3 Carbon Aero Kit & Afterburner Exhaust Thrusters
    this.buildGTAeroKit();
    this.nitroPointLight = new THREE.PointLight(0xff9a3c, 0, 15, 1.6);
    this.buildNitroThrusters();

    // Mount real supercar GLB immediately if cached, else mount fallback & swap seamlessly on load
    const cached = supercarAssets.getCachedSync();
    if (cached) {
      this.mountRealSupercar(cached);
    } else {
      this.buildQuickFallbackShell();
      supercarAssets
        .loadTemplate()
        .then((tpl) => {
          if (!this.disposed) {
            this.mountRealSupercar(tpl);
          }
        })
        .catch(() => {
          // Fallback shell remains cleanly rendered if GLB fails
        });
    }
  }

  private mountRealSupercar(template: THREE.Group): void {
    this.bodySlot.clear();
    this.wheelContainer.clear();
    this.wheelSpinNodes = [];
    this.frontLeftPivot = null;
    this.frontRightPivot = null;
    this.steeringWheelNode = null;

    const clone = template.clone(true);
    const modelScale = 1.12;
    clone.scale.setScalar(modelScale);

    const wheelMap: Record<string, THREE.Object3D> = {};

    clone.traverse((obj) => {
      const name = obj.name.toLowerCase();
      if (name === 'wheel_fl' || name === 'wheel_fr' || name === 'wheel_rl' || name === 'wheel_rr') {
        wheelMap[name] = obj;
      }
      if (name === 'steering_wheel') {
        this.steeringWheelNode = obj;
      }

      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.Material | undefined;
        const matName = (mat?.name || '').toLowerCase();

        if (matName.includes('body_color') || name === 'body') {
          obj.material = this.paintMat;
        } else if (matName.includes('glass_gray') || name === 'glass') {
          obj.material = this.glassMat;
        } else if (matName.includes('taillight') || name === 'lights_red' || name === 'brakes') {
          obj.material = this.brakeLightMat;
        } else if (matName.includes('turn_signal') || matName.includes('projector') || name === 'leds') {
          obj.material = this.headlightMat;
        } else if (matName.includes('carbon_fiber') || name.includes('carbon')) {
          obj.material = this.carbonMat;
        } else if (matName.includes('metal_chrome') || matName.includes('metal_gray')) {
          const alloyMat = new THREE.MeshStandardMaterial({
            color: name.includes('rim') ? 0xcfd6df : 0x7c8796,
            metalness: 0.92,
            roughness: name.includes('rim') ? 0.2 : 0.28,
            envMapIntensity: 1.7,
          });
          obj.material = alloyMat;
          this.disposables.push(alloyMat);
        } else if (matName.includes('yellow') || name === 'yellow_trim') {
          obj.material = this.caliperMat;
        } else if (matName.includes('tires')) {
          const tireMat = new THREE.MeshStandardMaterial({
            color: 0x17191e,
            roughness: 0.86,
            metalness: 0.06,
          });
          obj.material = tireMat;
          this.disposables.push(tireMat);
        }
      }
    });

    // Ventilated carbon-ceramic brake discs & stationary painted Brembo-style calipers
    const discGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.032, 24);
    discGeo.rotateZ(Math.PI / 2);
    const caliperGeo = new THREE.BoxGeometry(0.075, 0.15, 0.11);
    this.disposables.push(discGeo, caliperGeo);

    clone.updateMatrixWorld(true);

    const mountWheel = (key: string, isFront: boolean, side: -1 | 1) => {
      const wheel = wheelMap[key];
      if (!wheel) return;

      const worldPos = new THREE.Vector3();
      wheel.getWorldPosition(worldPos);
      wheel.removeFromParent();

      const pivot = new THREE.Group();
      pivot.position.copy(worldPos);
      pivot.scale.setScalar(modelScale);

      wheel.position.set(0, 0, 0);

      // Stationary brake disc + caliper inside wheel barrel (pivots with steering, does NOT spin with tire!)
      const disc = new THREE.Mesh(discGeo, this.brakeDiscMat);
      disc.position.set(side * 0.035, 0, 0);
      const caliper = new THREE.Mesh(caliperGeo, this.caliperMat);
      caliper.position.set(side * 0.055, 0.03, isFront ? 0.13 : -0.13);
      pivot.add(disc, caliper);

      pivot.add(wheel);
      this.wheelContainer.add(pivot);
      this.wheelSpinNodes.push(wheel);

      if (isFront) {
        if (side < 0) this.frontLeftPivot = pivot;
        else this.frontRightPivot = pivot;
      }
    };

    mountWheel('wheel_fl', true, -1);
    mountWheel('wheel_fr', true, 1);
    mountWheel('wheel_rl', false, -1);
    mountWheel('wheel_rr', false, 1);

    this.bodySlot.add(clone);
  }

  /** Authentic Motorsport GT3 Dry-Carbon Aero Packages */
  private buildGTAeroKit(): void {
    const style = this.spec.bodyStyle;

    // 1. Swan-Neck / Twin-Strut Carbon GT3 Rear Wing
    const wingW = style === 'katana' ? 2.24 : style === 'phantom' ? 2.1 : 1.96;
    const wingY = style === 'katana' ? 1.3 : style === 'phantom' ? 1.18 : 1.21;
    const wingZ = style === 'phantom' ? 2.22 : 2.12;

    const mainBladeGeo = new THREE.BoxGeometry(wingW, 0.048, 0.34);
    const mainBlade = new THREE.Mesh(mainBladeGeo, this.carbonMat);
    mainBlade.position.set(0, wingY, wingZ);
    this.wingBaseAngle = style === 'katana' ? 0.13 : 0.07;
    mainBlade.rotation.x = this.wingBaseAngle;
    this.rearWingBlade = mainBlade;

    const strutH = wingY - 0.88;
    const strutGeo = new THREE.BoxGeometry(0.048, strutH, 0.22);
    const strutL = new THREE.Mesh(strutGeo, this.carbonMat);
    strutL.position.set(-0.5, 0.88 + strutH * 0.5, wingZ - 0.02);
    const strutR = new THREE.Mesh(strutGeo, this.carbonMat);
    strutR.position.set(0.5, 0.88 + strutH * 0.5, wingZ - 0.02);

    const endH = style === 'katana' ? 0.34 : 0.25;
    const endGeo = new THREE.BoxGeometry(0.04, endH, 0.44);
    const endL = new THREE.Mesh(endGeo, this.paintMat);
    endL.position.set(-wingW * 0.5, wingY - 0.02, wingZ);
    const endR = new THREE.Mesh(endGeo, this.paintMat);
    endR.position.set(wingW * 0.5, wingY - 0.02, wingZ);

    this.aeroSlot.add(mainBlade, strutL, strutR, endL, endR);
    this.disposables.push(mainBladeGeo, strutGeo, endGeo);

    // 2. Archetype-specific authentic GT aero components
    if (style === 'phantom') {
      // Le Mans dorsal stabilizer fin + upper biplane wing element
      const finGeo = new THREE.BoxGeometry(0.042, 0.3, 1.42);
      const fin = new THREE.Mesh(finGeo, this.carbonMat);
      fin.position.set(0, 1.13, 1.16);

      const flapGeo = new THREE.BoxGeometry(wingW - 0.14, 0.036, 0.17);
      const flap = new THREE.Mesh(flapGeo, this.carbonMat);
      flap.position.set(0, wingY + 0.11, wingZ + 0.1);
      flap.rotation.x = 0.2;
      this.rearWingFlap = flap;

      this.aeroSlot.add(fin, flap);
      this.disposables.push(finGeo, flapGeo);
    } else if (style === 'katana') {
      // Front carbon dive-plane canards (touge / GT3 spec)
      const canardGeo = new THREE.BoxGeometry(0.22, 0.028, 0.34);
      const cL = new THREE.Mesh(canardGeo, this.carbonMat);
      cL.position.set(-1.01, 0.36, -2.16);
      cL.rotation.z = 0.26;
      const cR = new THREE.Mesh(canardGeo, this.carbonMat);
      cR.position.set(1.01, 0.36, -2.16);
      cR.rotation.z = -0.26;
      this.aeroSlot.add(cL, cR);
      this.disposables.push(canardGeo);
    }

    // 3. Dry-Carbon Side Skirts, Front Splitter & 4-Strake Rear Venturi Diffuser
    const skirtGeo = new THREE.BoxGeometry(0.11, 0.048, 2.34);
    const skirtL = new THREE.Mesh(skirtGeo, this.carbonMat);
    skirtL.position.set(-1.04, 0.17, 0.16);
    const skirtR = new THREE.Mesh(skirtGeo, this.carbonMat);
    skirtR.position.set(1.04, 0.17, 0.16);

    const splitGeo = new THREE.BoxGeometry(2.04, 0.04, 0.38);
    const splitter = new THREE.Mesh(splitGeo, this.carbonMat);
    splitter.position.set(0, 0.16, -2.32);

    const strakeGeo = new THREE.BoxGeometry(0.032, 0.18, 0.36);
    for (const sx of [-0.62, -0.24, 0.24, 0.62]) {
      const strake = new THREE.Mesh(strakeGeo, this.carbonMat);
      strake.position.set(sx, 0.22, 2.34);
      this.aeroSlot.add(strake);
    }

    this.aeroSlot.add(skirtL, skirtR, splitter);
    this.disposables.push(skirtGeo, splitGeo, strakeGeo);
  }

  private buildNitroThrusters(): void {
    const flameOuterGeo = new THREE.ConeGeometry(0.16, 1.85, 10, 1, true);
    flameOuterGeo.rotateX(Math.PI / 2);
    flameOuterGeo.translate(0, 0, 0.92);
    const flameInnerGeo = new THREE.ConeGeometry(0.085, 1.18, 8, 1, true);
    flameInnerGeo.rotateX(Math.PI / 2);
    flameInnerGeo.translate(0, 0, 0.59);
    this.disposables.push(flameOuterGeo, flameInnerGeo);

    const exhaustOffsets =
      this.spec.bodyStyle === 'phantom' ? [-0.46, -0.18, 0.18, 0.46] : [-0.32, 0.32];

    for (const ex of exhaustOffsets) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xff8c2b).multiplyScalar(1.45),
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x93d5ff).multiplyScalar(1.65),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      this.flameOuterMats.push(outerMat);
      this.flameInnerMats.push(innerMat);
      this.disposables.push(outerMat, innerMat);

      const outerCone = new THREE.Mesh(flameOuterGeo, outerMat);
      outerCone.position.set(ex, 0.34, 2.46);
      const innerCone = new THREE.Mesh(flameInnerGeo, innerMat);
      innerCone.position.set(ex, 0.34, 2.46);
      this.nitroFlameGroup.add(outerCone, innerCone);
      this.flameCones.push(outerCone, innerCone);
    }

    this.nitroFlameGroup.visible = false;
    this.chassis.add(this.nitroFlameGroup);

    this.nitroPointLight.position.set(0, 0.55, 3.2);
    if (this.isPlayer) {
      this.chassis.add(this.nitroPointLight);
    }
  }

  /** Lightweight sleek silhouette shown only for ~50ms while GLB decodes */
  private buildQuickFallbackShell(): void {
    const geo = new THREE.BoxGeometry(2.05, 0.72, 4.65);
    const mesh = new THREE.Mesh(geo, this.paintMat);
    mesh.position.set(0, 0.62, 0.1);
    this.bodySlot.add(mesh);
    this.disposables.push(geo);
  }

  public updateVisuals(params: {
    dt: number;
    speed: number;
    steerVisual: number;
    visualSlipAngle: number;
    bodyRoll: number;
    bodyPitch: number;
    suspensionY: number;
    isBraking: boolean;
    isDrifting: boolean;
    boostIntensity: number;
    isSuperNitro: boolean;
    overdriveStage?: 0 | 1 | 2;
  }): void {
    const {
      dt,
      speed,
      steerVisual,
      visualSlipAngle,
      bodyRoll,
      bodyPitch,
      suspensionY,
      isBraking,
      isDrifting,
      boostIntensity,
      isSuperNitro,
      overdriveStage = 0,
    } = params;

    // Spin all 4 real supercar wheels proportional to road speed
    const wheelDelta = (speed / 0.4) * dt;
    for (const w of this.wheelSpinNodes) {
      w.rotation.x -= wheelDelta;
    }

    // Articulate real front wheels (+ natural counter-steer into the slide during drift!)
    const wheelSteerRad = -steerVisual * 0.44 + visualSlipAngle * 0.64;
    if (this.frontLeftPivot) this.frontLeftPivot.rotation.y = wheelSteerRad;
    if (this.frontRightPivot) this.frontRightPivot.rotation.y = wheelSteerRad;

    if (this.steeringWheelNode) {
      this.steeringWheelNode.rotation.y = wheelSteerRad * 1.6;
    }

    // Drift yaw slip, realistic chassis suspension body-roll & accel/brake pitch
    this.driftYawPivot.rotation.y = -visualSlipAngle;
    this.chassis.rotation.z = bodyRoll;
    this.chassis.rotation.x = bodyPitch;
    this.chassis.position.y = suspensionY;

    // Active Aero DRS Rear Wing (flattens low-drag during Straightaway Overdrive, tilts up as air-brake on braking!)
    if (this.rearWingBlade) {
      const targetWingX =
        overdriveStage >= 2
          ? -0.09
          : overdriveStage === 1
            ? -0.04
            : isBraking && speed > 30
              ? this.wingBaseAngle + 0.22
              : this.wingBaseAngle;
      this.rearWingBlade.rotation.x += (targetWingX - this.rearWingBlade.rotation.x) * Math.min(1, dt * 10);
    }
    if (this.rearWingFlap) {
      const targetFlapX = overdriveStage >= 1 ? 0.0 : isBraking && speed > 30 ? 0.42 : 0.2;
      this.rearWingFlap.rotation.x += (targetFlapX - this.rearWingFlap.rotation.x) * Math.min(1, dt * 10);
    }

    // Reactive real Ferrari brake taillights + wet-tarmac crimson bounce + glowing hot brake rotors!
    this.brakeLightMat.emissiveIntensity = isBraking ? 3.2 : isDrifting ? 1.95 : 1.0;
    this.rearBounceMat.opacity = isBraking ? 0.28 : isDrifting ? 0.18 : 0.09;

    const targetHeat = isBraking && speed > 18 ? 1.8 : isDrifting ? 0.55 : 0;
    this.brakeHeat += (targetHeat - this.brakeHeat) * Math.min(1, dt * (targetHeat > this.brakeHeat ? 5.5 : 2.2));
    this.brakeDiscMat.emissiveIntensity = this.brakeHeat;

    // Animated realistic afterburner exhaust flames
    if (boostIntensity > 0.05) {
      this.flamePhase += dt * 46;
      this.nitroFlameGroup.visible = true;
      const flicker = 0.85 + Math.sin(this.flamePhase) * 0.22 + Math.cos(this.flamePhase * 1.7) * 0.1;
      const lenScale = (0.5 + boostIntensity * 1.1) * flicker;
      const radScale = 0.72 + boostIntensity * 0.3;

      const outerHex = isSuperNitro ? 0x3b82f6 : 0xff7a1a;
      const innerHex = isSuperNitro ? 0xe0f2fe : 0xdbeafe;

      for (const m of this.flameOuterMats) {
        m.color.setHex(outerHex).multiplyScalar(1.48);
      }
      for (const m of this.flameInnerMats) {
        m.color.setHex(innerHex).multiplyScalar(1.68);
      }
      for (let i = 0; i < this.flameCones.length; i++) {
        this.flameCones[i].scale.set(radScale, radScale, lenScale);
      }

      this.nitroPointLight.color.setHex(outerHex);
      this.nitroPointLight.intensity = 2.4 * boostIntensity * flicker;
    } else {
      this.nitroFlameGroup.visible = false;
      this.nitroPointLight.intensity = 0;
    }
  }

  public getRearWheelWorldPositions(outLeft: THREE.Vector3, outRight: THREE.Vector3): void {
    this.driftYawPivot.updateWorldMatrix(true, false);
    outLeft.copy(this.rearLeftContact).applyMatrix4(this.driftYawPivot.matrixWorld);
    outRight.copy(this.rearRightContact).applyMatrix4(this.driftYawPivot.matrixWorld);
  }

  public getExhaustWorldPositions(outLeft: THREE.Vector3, outRight: THREE.Vector3): void {
    this.chassis.updateWorldMatrix(true, false);
    outLeft.copy(this.exhaustLeftLocal).applyMatrix4(this.chassis.matrixWorld);
    outRight.copy(this.exhaustRightLocal).applyMatrix4(this.chassis.matrixWorld);
  }

  public getHoodCameraPos(out: THREE.Vector3): THREE.Vector3 {
    this.chassis.updateWorldMatrix(true, false);
    return out.copy(this.hoodCamLocal).applyMatrix4(this.chassis.matrixWorld);
  }

  public dispose(): void {
    this.disposed = true;
    this.disposables.forEach((d) => d.dispose());
  }
}
