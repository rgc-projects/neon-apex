import * as THREE from 'three';
import { CarSpec } from '../types';
import { createHeadlightBeamTexture, createParticleGlowTexture } from '../utils/textures';
import { supercarAssets } from './SupercarLoader';

let sharedUnderglowTex: THREE.CanvasTexture | null = null;
let sharedBeamTex: THREE.CanvasTexture | null = null;

/**
 * High-detail Cyber GT Supercar Model.
 * Mounts the locally bundled open-source supercar GLB (Ferrari 458 Italia by vicent091036, CC BY 4.0)
 * customized with metallic clearcoat racing paint, distinct cyber aero kits (GT wings, fins, splitters),
 * glowing neon rim rings, articulated front steering wheels, reactive brake lights, and dual/quad nitro thrusters.
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

  private readonly paintMat: THREE.MeshPhysicalMaterial;
  private readonly carbonMat: THREE.MeshStandardMaterial;
  private readonly glassMat: THREE.MeshPhysicalMaterial;
  private readonly neonMat: THREE.MeshBasicMaterial;
  private readonly headlightMat: THREE.MeshBasicMaterial;
  private readonly brakeLightMat: THREE.MeshStandardMaterial;
  private readonly underglowMat: THREE.MeshBasicMaterial;

  private readonly nitroFlameGroup = new THREE.Group();
  private readonly flameInnerMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameOuterMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameCones: THREE.Mesh[] = [];
  private readonly nitroPointLight: THREE.PointLight;

  // Local anchor positions (matching ~1.12x scaled real supercar)
  private readonly rearLeftContact = new THREE.Vector3(-0.96, 0.06, 1.66);
  private readonly rearRightContact = new THREE.Vector3(0.96, 0.06, 1.66);
  private readonly exhaustLeftLocal = new THREE.Vector3(-0.42, 0.34, 2.52);
  private readonly exhaustRightLocal = new THREE.Vector3(0.42, 0.34, 2.52);
  private readonly hoodCamLocal = new THREE.Vector3(0, 1.18, -0.35);

  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  private flamePhase = Math.random() * 10;
  private disposed = false;

  constructor(
    public readonly spec: CarSpec,
    overridePrimary?: number,
    overrideNeon?: number,
    private readonly isPlayer = false
  ) {
    this.root.add(this.driftYawPivot);
    this.driftYawPivot.add(this.chassis);
    this.driftYawPivot.add(this.wheelContainer);
    this.chassis.add(this.bodySlot, this.aeroSlot);

    if (!sharedUnderglowTex) sharedUnderglowTex = createParticleGlowTexture();
    if (!sharedBeamTex) sharedBeamTex = createHeadlightBeamTexture();

    const bodyHex = overridePrimary ?? spec.primaryColor;
    const neonHex = overrideNeon ?? spec.neonColor;

    // Automotive Metallic Clearcoat Paint
    this.paintMat = new THREE.MeshPhysicalMaterial({
      color: bodyHex,
      metalness: 0.84,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.85,
    });

    this.carbonMat = new THREE.MeshStandardMaterial({
      color: 0x10141f,
      metalness: 0.55,
      roughness: 0.36,
      envMapIntensity: 1.2,
    });

    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x071326,
      metalness: 0.25,
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.78,
      envMapIntensity: 2.2,
    });

    this.neonMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(neonHex).multiplyScalar(1.36),
      toneMapped: false,
    });

    this.headlightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xe6ffff).multiplyScalar(1.75),
      toneMapped: false,
    });

    this.brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xcc0a2c,
      emissive: 0xff1144,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.2,
      toneMapped: false,
    });

    this.underglowMat = new THREE.MeshBasicMaterial({
      map: sharedUnderglowTex,
      color: new THREE.Color(neonHex).multiplyScalar(1.25),
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    this.disposables.push(
      this.paintMat,
      this.carbonMat,
      this.glassMat,
      this.neonMat,
      this.headlightMat,
      this.brakeLightMat,
      this.underglowMat
    );

    // Underglow soft radial halo
    const glowPlaneGeo = new THREE.PlaneGeometry(3.8, 6.4);
    glowPlaneGeo.rotateX(-Math.PI / 2);
    const underglow = new THREE.Mesh(glowPlaneGeo, this.underglowMat);
    underglow.position.set(0, 0.07, 0.08);
    this.chassis.add(underglow);
    this.disposables.push(glowPlaneGeo);

    // Player tapered headlight beams on road surface
    if (isPlayer) {
      const beamGeo = new THREE.PlaneGeometry(3.1, 16);
      beamGeo.rotateX(-Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        map: sharedBeamTex,
        color: 0xc8fbff,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const beamL = new THREE.Mesh(beamGeo, beamMat);
      beamL.position.set(-0.74, 0.1, -10.3);
      const beamR = new THREE.Mesh(beamGeo, beamMat);
      beamR.position.set(0.74, 0.1, -10.3);
      this.chassis.add(beamL, beamR);
      this.disposables.push(beamGeo, beamMat);
    }

    // Build custom Cyber GT Aero Kit & Nitro Thrusters
    this.buildCyberAeroKit();
    this.nitroPointLight = new THREE.PointLight(0x00e5ff, 0, 16, 1.5);
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
    // Clear any temporary fallback
    this.bodySlot.clear();
    this.wheelContainer.clear();
    this.wheelSpinNodes = [];
    this.frontLeftPivot = null;
    this.frontRightPivot = null;
    this.steeringWheelNode = null;

    const clone = template.clone(true);
    const modelScale = 1.12;
    clone.scale.setScalar(modelScale);

    // Collect wheel nodes before detaching them into independent suspension/steering container
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
          const shinyMat = new THREE.MeshStandardMaterial({
            color: name.includes('rim') ? 0xdbeafe : 0x8da2b8,
            metalness: 0.94,
            roughness: 0.14,
            envMapIntensity: 1.8,
          });
          obj.material = shinyMat;
          this.disposables.push(shinyMat);
        } else if (matName.includes('yellow') || name === 'yellow_trim') {
          obj.material = this.neonMat;
        } else if (matName.includes('tires')) {
          const tireMat = new THREE.MeshStandardMaterial({
            color: 0x11131a,
            roughness: 0.78,
            metalness: 0.15,
          });
          obj.material = tireMat;
          this.disposables.push(tireMat);
        }
      }
    });

    // Attach neon glowing rim halo to all 4 wheels and wrap front wheels in steering pivots!
    const rimHaloGeo = new THREE.TorusGeometry(0.255, 0.017, 8, 28);
    rimHaloGeo.rotateY(Math.PI / 2);
    this.disposables.push(rimHaloGeo);

    clone.updateMatrixWorld(true);

    const mountWheel = (key: string, isFront: boolean, side: -1 | 1) => {
      const wheel = wheelMap[key];
      if (!wheel) return;

      // Capture wheel's scaled local position in car frame
      const worldPos = new THREE.Vector3();
      wheel.getWorldPosition(worldPos);

      // Detach from cloned hierarchy and place in wheelContainer (so chassis body-roll tilts realistically above wheels!)
      wheel.removeFromParent();

      const pivot = new THREE.Group();
      pivot.position.copy(worldPos);
      pivot.scale.setScalar(modelScale);

      // Reset wheel position inside pivot while preserving its GLTF orientation
      wheel.position.set(0, 0, 0);

      // Attach razor-crisp neon LED rim halo ring to outer face of wheel
      const halo = new THREE.Mesh(rimHaloGeo, this.neonMat);
      halo.position.set(side * 0.132, 0, 0);
      wheel.add(halo);

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

  /** Distinct custom Cyber GT race aero packages mounted to the supercar silhouette */
  private buildCyberAeroKit(): void {
    const style = this.spec.bodyStyle;

    // 1. Custom GT Carbon Rear Wing (sized & positioned cleanly on rear deck of the 1.12x supercar)
    const wingW = style === 'katana' ? 2.28 : style === 'phantom' ? 2.12 : 1.98;
    const wingY = style === 'katana' ? 1.32 : style === 'phantom' ? 1.18 : 1.22;
    const wingZ = style === 'phantom' ? 2.24 : 2.12;

    const mainBladeGeo = new THREE.BoxGeometry(wingW, 0.055, 0.36);
    const mainBlade = new THREE.Mesh(mainBladeGeo, this.carbonMat);
    mainBlade.position.set(0, wingY, wingZ);
    mainBlade.rotation.x = style === 'katana' ? 0.14 : 0.08;

    const wingEdgeGeo = new THREE.BoxGeometry(wingW + 0.04, 0.028, 0.045);
    const wingEdge = new THREE.Mesh(wingEdgeGeo, this.neonMat);
    wingEdge.position.set(0, wingY + 0.025, wingZ + 0.17);

    const strutH = wingY - 0.88;
    const strutGeo = new THREE.BoxGeometry(0.055, strutH, 0.24);
    const strutL = new THREE.Mesh(strutGeo, this.carbonMat);
    strutL.position.set(-0.52, 0.88 + strutH * 0.5, wingZ - 0.02);
    const strutR = new THREE.Mesh(strutGeo, this.carbonMat);
    strutR.position.set(0.52, 0.88 + strutH * 0.5, wingZ - 0.02);

    const endH = style === 'katana' ? 0.36 : 0.26;
    const endGeo = new THREE.BoxGeometry(0.045, endH, 0.46);
    const endL = new THREE.Mesh(endGeo, this.paintMat);
    endL.position.set(-wingW * 0.5, wingY - 0.02, wingZ);
    const endR = new THREE.Mesh(endGeo, this.paintMat);
    endR.position.set(wingW * 0.5, wingY - 0.02, wingZ);

    this.aeroSlot.add(mainBlade, wingEdge, strutL, strutR, endL, endR);
    this.disposables.push(mainBladeGeo, wingEdgeGeo, strutGeo, endGeo);

    // 2. Archetype-specific extra GT aero pieces
    if (style === 'phantom') {
      // Le Mans dorsal shark fin + twin upper wing flap
      const finGeo = new THREE.BoxGeometry(0.05, 0.34, 1.48);
      const fin = new THREE.Mesh(finGeo, this.carbonMat);
      fin.position.set(0, 1.15, 1.18);
      const finNeonGeo = new THREE.BoxGeometry(0.06, 0.028, 1.44);
      const finNeon = new THREE.Mesh(finNeonGeo, this.neonMat);
      finNeon.position.set(0, 1.32, 1.18);

      const flapGeo = new THREE.BoxGeometry(wingW - 0.14, 0.04, 0.18);
      const flap = new THREE.Mesh(flapGeo, this.carbonMat);
      flap.position.set(0, wingY + 0.12, wingZ + 0.1);
      flap.rotation.x = 0.22;

      this.aeroSlot.add(fin, finNeon, flap);
      this.disposables.push(finGeo, finNeonGeo, flapGeo);
    } else if (style === 'katana') {
      // Aggressive rear diffuser vortex fins + front drift canards
      const canardGeo = new THREE.BoxGeometry(0.24, 0.03, 0.36);
      const cL = new THREE.Mesh(canardGeo, this.carbonMat);
      cL.position.set(-1.02, 0.36, -2.18);
      cL.rotation.z = 0.28;
      const cR = new THREE.Mesh(canardGeo, this.carbonMat);
      cR.position.set(1.02, 0.36, -2.18);
      cR.rotation.z = -0.28;
      this.aeroSlot.add(cL, cR);
      this.disposables.push(canardGeo);
    }

    // 3. Sleek Carbon Side Skirts with Neon Ground-Effect Light Blades
    const skirtGeo = new THREE.BoxGeometry(0.12, 0.055, 2.38);
    const skirtL = new THREE.Mesh(skirtGeo, this.carbonMat);
    skirtL.position.set(-1.05, 0.17, 0.16);
    const skirtR = new THREE.Mesh(skirtGeo, this.carbonMat);
    skirtR.position.set(1.05, 0.17, 0.16);

    const bladeGeo = new THREE.BoxGeometry(0.032, 0.028, 2.28);
    const bladeL = new THREE.Mesh(bladeGeo, this.neonMat);
    bladeL.position.set(-1.11, 0.18, 0.16);
    const bladeR = new THREE.Mesh(bladeGeo, this.neonMat);
    bladeR.position.set(1.11, 0.18, 0.16);

    // Front carbon splitter lip with neon edge
    const splitGeo = new THREE.BoxGeometry(2.08, 0.045, 0.42);
    const splitter = new THREE.Mesh(splitGeo, this.carbonMat);
    splitter.position.set(0, 0.16, -2.35);

    const splitNeonGeo = new THREE.BoxGeometry(1.86, 0.024, 0.036);
    const splitNeon = new THREE.Mesh(splitNeonGeo, this.neonMat);
    splitNeon.position.set(0, 0.17, -2.56);

    // Rear lower diffuser accent strip
    const rearNeonGeo = new THREE.BoxGeometry(1.52, 0.026, 0.035);
    const rearNeon = new THREE.Mesh(rearNeonGeo, this.neonMat);
    rearNeon.position.set(0, 0.24, 2.48);

    this.aeroSlot.add(skirtL, skirtR, bladeL, bladeR, splitter, splitNeon, rearNeon);
    this.disposables.push(skirtGeo, bladeGeo, splitGeo, splitNeonGeo, rearNeonGeo);
  }

  private buildNitroThrusters(): void {
    const flameOuterGeo = new THREE.ConeGeometry(0.19, 2.15, 10, 1, true);
    flameOuterGeo.rotateX(Math.PI / 2);
    flameOuterGeo.translate(0, 0, 1.08);
    const flameInnerGeo = new THREE.ConeGeometry(0.095, 1.38, 8, 1, true);
    flameInnerGeo.rotateX(Math.PI / 2);
    flameInnerGeo.translate(0, 0, 0.69);
    this.disposables.push(flameOuterGeo, flameInnerGeo);

    const exhaustOffsets =
      this.spec.bodyStyle === 'phantom' ? [-0.46, -0.18, 0.18, 0.46] : [-0.32, 0.32];

    for (const ex of exhaustOffsets) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x00d9ff).multiplyScalar(1.55),
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff).multiplyScalar(1.7),
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

    this.nitroPointLight.position.set(0, 0.55, 3.3);
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
    } = params;

    // Spin all 4 real supercar wheels proportional to road speed
    const wheelDelta = (speed / 0.4) * dt;
    for (const w of this.wheelSpinNodes) {
      w.rotation.x -= wheelDelta;
    }

    // Articulate real front wheels (+ counter-steer naturally during drift!)
    const wheelSteerRad = -steerVisual * 0.44 + visualSlipAngle * 0.58;
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

    // Reactive real Ferrari brake taillights (glow blazing red on brake/drift)
    this.brakeLightMat.emissiveIntensity = isBraking ? 3.2 : isDrifting ? 2.1 : 1.05;

    // Animated nitro / mini-boost exhaust flames
    if (boostIntensity > 0.05) {
      this.flamePhase += dt * 44;
      this.nitroFlameGroup.visible = true;
      const flicker = 0.85 + Math.sin(this.flamePhase) * 0.22 + Math.cos(this.flamePhase * 1.7) * 0.1;
      const lenScale = (0.55 + boostIntensity * 1.15) * flicker;
      const radScale = 0.72 + boostIntensity * 0.34;

      const outerHex = isSuperNitro ? 0xc026ff : 0x00d9ff;
      const innerHex = isSuperNitro ? 0xff99ff : 0xe0ffff;

      for (const m of this.flameOuterMats) {
        m.color.setHex(outerHex).multiplyScalar(1.55);
      }
      for (const m of this.flameInnerMats) {
        m.color.setHex(innerHex).multiplyScalar(1.7);
      }
      for (let i = 0; i < this.flameCones.length; i++) {
        this.flameCones[i].scale.set(radScale, radScale, lenScale);
      }

      this.nitroPointLight.color.setHex(outerHex);
      this.nitroPointLight.intensity = 2.6 * boostIntensity * flicker;
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
