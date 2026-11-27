import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMobileDevice } from '../settings/SettingsManager';
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

interface ModelMountProfile {
  /** Y-axis rotation (radians) to orient the GLB nose toward -Z */
  rotY: number;
  /** Uniform scale so the mounted car spans ~4.6-5.1 m with perfectly circular wheels */
  scale: number;
  /** Longitudinal center Z offset after bounding-box centering */
  centerZOffset: number;
  /** Whether the GLB already includes its own factory rear wing */
  hasBuiltInWing: boolean;
  /** Whether the GLB already includes visible brake calipers inside wheel hubs */
  hasBuiltInCalipers: boolean;
  /** Rear wing dimensions (used when hasBuiltInWing is false) */
  wing: {
    width: number;
    y: number;
    z: number;
    strutBaseY: number;
    strutX: number;
    endH: number;
    baseAngle: number;
  };
  /** Carbon side skirts / front splitter / diffuser fit */
  aero: {
    skirtX: number;
    skirtLen: number;
    splitterW: number;
    splitterZ: number;
    diffuserZ: number;
    addAeroSkirts: boolean;
  };
  /** Exhaust flame coordinates */
  exhaust: {
    y: number;
    z: number;
    offsets: number[];
  };
  /** Hood camera anchor */
  hoodCam: [number, number, number];
}

const MODEL_PROFILES: Record<string, ModelMountProfile> = {
  // Ferrari 458 Spider (APEX-V12)
  'supercar.glb': {
    rotY: 0,
    scale: 1.12,
    centerZOffset: 0.02,
    hasBuiltInWing: false,
    hasBuiltInCalipers: false,
    wing: { width: 1.98, y: 1.21, z: 2.12, strutBaseY: 0.88, strutX: 0.5, endH: 0.25, baseAngle: 0.07 },
    aero: { skirtX: 1.04, skirtLen: 2.34, splitterW: 2.04, splitterZ: -2.32, diffuserZ: 2.34, addAeroSkirts: true },
    exhaust: { y: 0.34, z: 2.46, offsets: [-0.32, 0.32] },
    hoodCam: [0, 1.18, -0.35],
  },
  // 2015 McLaren P1 GTR (PHANTOM-X)
  'phantom-p1.glb': {
    rotY: Math.PI,
    scale: 1.07,
    centerZOffset: 0.0,
    hasBuiltInWing: true,
    hasBuiltInCalipers: false,
    wing: { width: 2.08, y: 1.18, z: 2.22, strutBaseY: 0.86, strutX: 0.48, endH: 0.26, baseAngle: 0.08 },
    aero: { skirtX: 1.02, skirtLen: 2.26, splitterW: 2.0, splitterZ: -2.36, diffuserZ: 2.38, addAeroSkirts: false },
    exhaust: { y: 0.52, z: 2.42, offsets: [-0.24, 0.24] },
    hoodCam: [0, 1.16, -0.38],
  },
  // BMW M4 Competition Touge Drift Spec (KATANA-RS)
  'katana-m4.glb': {
    rotY: Math.PI,
    scale: 0.255,
    centerZOffset: 0.0,
    hasBuiltInWing: false,
    hasBuiltInCalipers: true,
    wing: { width: 2.04, y: 1.4, z: 2.08, strutBaseY: 1.05, strutX: 0.5, endH: 0.3, baseAngle: 0.12 },
    aero: { skirtX: 1.04, skirtLen: 2.24, splitterW: 2.0, splitterZ: -2.32, diffuserZ: 2.34, addAeroSkirts: false },
    exhaust: { y: 0.32, z: 2.48, offsets: [-0.46, -0.3, 0.3, 0.46] },
    hoodCam: [0, 1.24, -0.32],
  },
  // Lamborghini Aventador S-Class Wedge (VALKYRIE-GT)
  'valkyrie-aventador.glb': {
    rotY: -Math.PI / 2,
    scale: 0.1875,
    centerZOffset: 0.0,
    hasBuiltInWing: false,
    hasBuiltInCalipers: true,
    wing: { width: 2.18, y: 1.18, z: 2.22, strutBaseY: 0.86, strutX: 0.52, endH: 0.26, baseAngle: 0.08 },
    aero: { skirtX: 1.12, skirtLen: 2.36, splitterW: 2.16, splitterZ: -2.4, diffuserZ: 2.4, addAeroSkirts: false },
    exhaust: { y: 0.42, z: 2.48, offsets: [-0.26, -0.09, 0.09, 0.26] },
    hoodCam: [0, 1.12, -0.36],
  },
  // Khronos Concept EV Hypercar (ECLIPSE-EVO)
  'eclipse-concept.glb': {
    rotY: Math.PI,
    scale: 1.04,
    centerZOffset: 0.0,
    hasBuiltInWing: false,
    hasBuiltInCalipers: true,
    wing: { width: 2.12, y: 1.16, z: 2.04, strutBaseY: 0.84, strutX: 0.5, endH: 0.24, baseAngle: 0.07 },
    aero: { skirtX: 1.14, skirtLen: 2.15, splitterW: 2.18, splitterZ: -2.2, diffuserZ: 2.14, addAeroSkirts: false },
    exhaust: { y: 0.38, z: 2.22, offsets: [-0.46, -0.18, 0.18, 0.46] },
    hoodCam: [0, 1.1, -0.34],
  },
};

/**
 * Multi-chassis photorealistic GT3 / Hypercar 3D Vehicle Model.
 * Mounts each car's dedicated locally bundled Draco-compressed GLB with:
 * - Automatic bounding-box grounding (Y=0) & centering
 * - Universal axle-centered wheel detachment via Object3D.attach() (front steering + 4-wheel spin)
 * - Automotive metallic clearcoat PBR paint, tinted glass, reactive LED taillights & glowing brake rotors
 * - Model-tailored carbon aero packages, ground AO contact shadows & animated afterburner flames
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
  private rearWingBlade: THREE.Object3D | null = null;
  private rearWingFlap: THREE.Object3D | null = null;
  private wingBaseAngle = 0.07;

  private readonly profile: ModelMountProfile;
  private readonly paintMat: THREE.MeshStandardMaterial;
  private readonly secondaryPaintMat: THREE.MeshStandardMaterial;
  private readonly carbonMat: THREE.MeshStandardMaterial;
  private readonly glassMat: THREE.MeshStandardMaterial;
  private readonly caliperMat: THREE.MeshStandardMaterial;
  private readonly brakeDiscMat: THREE.MeshStandardMaterial;
  private readonly headlightMat: THREE.MeshBasicMaterial;
  private readonly brakeLightMat: THREE.MeshStandardMaterial;
  private readonly rearBounceMat: THREE.MeshBasicMaterial;
  private readonly alloyMat: THREE.MeshStandardMaterial;
  private readonly darkAlloyMat: THREE.MeshStandardMaterial;
  private readonly tireMat: THREE.MeshStandardMaterial;

  private readonly nitroFlameGroup = new THREE.Group();
  private readonly flameInnerMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameOuterMats: THREE.MeshBasicMaterial[] = [];
  private readonly flameCones: THREE.Mesh[] = [];
  private readonly nitroPointLight: THREE.PointLight;

  // Local anchor positions (refined dynamically once wheel centers are detached)
  private readonly rearLeftContact = new THREE.Vector3(-0.96, 0.06, 1.56);
  private readonly rearRightContact = new THREE.Vector3(0.96, 0.06, 1.56);
  private readonly exhaustLeftLocal = new THREE.Vector3(-0.36, 0.34, 2.46);
  private readonly exhaustRightLocal = new THREE.Vector3(0.36, 0.34, 2.46);
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
    this.profile = MODEL_PROFILES[spec.modelFile] ?? MODEL_PROFILES['supercar.glb'];
    this.hoodCamLocal.set(...this.profile.hoodCam);
    this.exhaustLeftLocal.set(-0.36, this.profile.exhaust.y, this.profile.exhaust.z + 0.06);
    this.exhaustRightLocal.set(0.36, this.profile.exhaust.y, this.profile.exhaust.z + 0.06);

    this.root.add(this.driftYawPivot);
    this.driftYawPivot.add(this.chassis);
    this.driftYawPivot.add(this.wheelContainer);
    this.chassis.add(this.bodySlot, this.aeroSlot);

    if (!sharedShadowTex) sharedShadowTex = createContactShadowTexture();
    if (!sharedGlowTex) sharedGlowTex = createParticleGlowTexture();
    if (!sharedBeamTex) sharedBeamTex = createHeadlightBeamTexture();

    const bodyHex = overridePrimary ?? spec.primaryColor;
    const accentHex = overrideAccent ?? spec.neonColor;

    const mobileGpu = isMobileDevice();

    // Automotive Metallic Clearcoat Paint (full clearcoat Physical shader on Desktop;
    // tuned glossy Standard shader on mobile WebView for 2x fragment throughput!)
    this.paintMat = mobileGpu
      ? new THREE.MeshStandardMaterial({
          color: bodyHex,
          metalness: 0.86,
          roughness: 0.14,
          envMapIntensity: 1.85,
        })
      : new THREE.MeshPhysicalMaterial({
          color: bodyHex,
          metalness: 0.82,
          roughness: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          envMapIntensity: 1.85,
        });

    // Secondary Accent Trim Paint (used on two-tone concept bodywork)
    this.secondaryPaintMat = mobileGpu
      ? new THREE.MeshStandardMaterial({
          color: spec.secondaryColor,
          metalness: 0.8,
          roughness: 0.18,
          envMapIntensity: 1.6,
        })
      : new THREE.MeshPhysicalMaterial({
          color: spec.secondaryColor,
          metalness: 0.78,
          roughness: 0.2,
          clearcoat: 0.9,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.6,
        });

    // Dry-Weave Satin Motorsport Carbon Fiber
    this.carbonMat = new THREE.MeshStandardMaterial({
      color: 0x181b24,
      metalness: 0.42,
      roughness: 0.44,
      envMapIntensity: 1.1,
    });

    // Tinted Laminated Automotive Cockpit Glass
    this.glassMat = mobileGpu
      ? new THREE.MeshStandardMaterial({
          color: 0x0a1320,
          metalness: 0.28,
          roughness: 0.08,
          transparent: true,
          opacity: 0.82,
          envMapIntensity: 1.95,
        })
      : new THREE.MeshPhysicalMaterial({
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

    // Shared Alloy Rim, Satin Metal & Rubber Tire Materials
    this.alloyMat = new THREE.MeshStandardMaterial({
      color: 0xcfd6df,
      metalness: 0.92,
      roughness: 0.2,
      envMapIntensity: 1.7,
    });

    this.darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x5c6675,
      metalness: 0.88,
      roughness: 0.28,
      envMapIntensity: 1.45,
    });

    this.tireMat = new THREE.MeshStandardMaterial({
      color: 0x17191e,
      roughness: 0.86,
      metalness: 0.06,
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
      this.secondaryPaintMat,
      this.carbonMat,
      this.glassMat,
      this.caliperMat,
      this.brakeDiscMat,
      this.headlightMat,
      this.brakeLightMat,
      this.rearBounceMat,
      this.alloyMat,
      this.darkAlloyMat,
      this.tireMat,
      shadowMat
    );

    const shadowGeo = new THREE.PlaneGeometry(3.1, 5.75);
    shadowGeo.rotateX(-Math.PI / 2);
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.set(0, 0.045, 0.06);
    this.driftYawPivot.add(contactShadow);
    this.disposables.push(shadowGeo);

    const bounceGeo = new THREE.PlaneGeometry(3.6, 4.4);
    bounceGeo.rotateX(-Math.PI / 2);
    const rearBounce = new THREE.Mesh(bounceGeo, this.rearBounceMat);
    rearBounce.position.set(0, 0.07, this.profile.exhaust.z + 0.65);
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

    // Build model-tailored GT3 Carbon Aero Kit & Afterburner Exhaust Thrusters
    this.buildGTAeroKit();
    this.nitroPointLight = new THREE.PointLight(0xff9a3c, 0, 15, 1.6);
    this.buildNitroThrusters();

    // Mount dedicated supercar GLB immediately if cached, else mount fallback & swap seamlessly on load
    const cached = supercarAssets.getCachedSync(spec.modelFile);
    if (cached) {
      this.mountRealSupercar(cached);
    } else {
      this.buildQuickFallbackShell();
      supercarAssets
        .loadModel(spec.modelFile)
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

    const modelFile = this.spec.modelFile;
    const clone = template.clone(true);

    // IMPORTANT: Perform ALL bounding-box grounding, centering, and wheel detachment inside
    // a completely detached identity-transform localRoot so async GLB loads NEVER pick up
    // world track/turntable position or showcase rotation!
    const localRoot = new THREE.Group();
    const wrapper = new THREE.Group();
    clone.rotation.y = this.profile.rotY;
    clone.scale.setScalar(this.profile.scale);
    wrapper.add(clone);
    localRoot.add(wrapper);

    // Collect wheel roots, straighten pre-steered rest poses, and map materials
    const wheelCandidates: THREE.Object3D[] = [];
    clone.traverse((obj) => {
      const name = obj.name.toLowerCase();

      if (modelFile === 'supercar.glb') {
        if (name === 'wheel_fl' || name === 'wheel_fr' || name === 'wheel_rl' || name === 'wheel_rr') {
          wheelCandidates.push(obj);
        }
        if (name === 'steering_wheel') this.steeringWheelNode = obj;
      } else if (modelFile === 'phantom-p1.glb') {
        if (name.startsWith('lod_a_wheel_mm_wheel')) {
          wheelCandidates.push(obj);
        }
        if (name.includes('steering_wheel')) this.steeringWheelNode = obj;
      } else if (modelFile === 'katana-m4.glb') {
        if (name === 'wheel_q0' || name === 'wheel_q1' || name === 'wheel_q2' || name === 'wheel_q3') {
          wheelCandidates.push(obj);
        }
      } else if (modelFile === 'valkyrie-aventador.glb') {
        if (name.startsWith('obj_wheelhub_')) {
          wheelCandidates.push(obj);
        }
        if (name.includes('shadow_plane')) {
          obj.visible = false;
        }
      } else if (modelFile === 'eclipse-concept.glb') {
        if (
          name === 'wheelfrontl' ||
          name === 'wheelfrontr' ||
          name === 'wheelrearl' ||
          name === 'wheelrearr'
        ) {
          // Khronos CarConcept ships with front wheels pre-steered ~30 deg in rest pose.
          // Resetting to identity straightens all 4 wheels to 0 deg before axle alignment!
          obj.quaternion.identity();
          wheelCandidates.push(obj);
        }
      }

      if (obj instanceof THREE.Mesh) {
        this.applyMeshMaterial(obj, modelFile);
      }
    });

    // Ground Y=0 and center X/Z in pure car-local space (localRoot has identity world matrix)
    localRoot.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    if (!bounds.isEmpty()) {
      const centerX = (bounds.min.x + bounds.max.x) * 0.5;
      const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
      wrapper.position.set(-centerX, -bounds.min.y, this.profile.centerZOffset - centerZ);
      localRoot.updateMatrixWorld(true);
    }

    // Detach all 4 wheels into car-aligned steering & axle-spin pivots inside localRoot
    const localWheelsGroup = new THREE.Group();
    localRoot.add(localWheelsGroup);
    localRoot.updateMatrixWorld(true);
    this.mountWheelsUniversal(wheelCandidates, modelFile, localWheelsGroup);

    // Batch static body sub-meshes by shared material (cuts ~50-97 draw calls/car -> ~6-10!)
    this.batchStaticBodyMeshes(wrapper);

    // Transfer normalized body wrapper & detached wheel pivots into live car hierarchy
    this.bodySlot.add(wrapper);
    const pivots = [...localWheelsGroup.children];
    for (const p of pivots) {
      this.wheelContainer.add(p);
    }
  }

  /**
   * Merges static non-animated body meshes inside `wrapper` that share the same material reference
   * into single batched BufferGeometries, slashing WebGL draw calls by ~80% on mobile WebView.
   */
  private batchStaticBodyMeshes(wrapper: THREE.Group): void {
    wrapper.updateMatrixWorld(true);
    const invWrapper = wrapper.matrixWorld.clone().invert();

    // Never merge the rotating steering wheel subtree
    const protectedSet = new Set<THREE.Object3D>();
    if (this.steeringWheelNode) {
      this.steeringWheelNode.traverse((o) => protectedSet.add(o));
    }

    const groups = new Map<THREE.Material, { meshes: THREE.Mesh[]; geos: THREE.BufferGeometry[] }>();
    wrapper.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh) || !obj.visible || protectedSet.has(obj)) return;
      if (Array.isArray(obj.material) || !obj.material || !obj.geometry) return;
      if (!obj.geometry.getAttribute('position')) return;
      const mat = obj.material;
      let entry = groups.get(mat);
      if (!entry) {
        entry = { meshes: [], geos: [] };
        groups.set(mat, entry);
      }
      entry.meshes.push(obj);
    });

    const relMatrix = new THREE.Matrix4();

    for (const [mat, entry] of groups.entries()) {
      if (entry.meshes.length < 2) continue;

      // Only preserve UV if every mesh in this material group has a UV attribute
      const hasTex = Boolean((mat as THREE.MeshStandardMaterial).map || (mat as THREE.MeshStandardMaterial).normalMap);
      let allHaveUv = hasTex;
      if (allHaveUv) {
        for (const m of entry.meshes) {
          if (!m.geometry.getAttribute('uv')) {
            allHaveUv = false;
            break;
          }
        }
      }

      const prepared: THREE.BufferGeometry[] = [];
      let canMerge = true;

      for (const m of entry.meshes) {
        const src = m.geometry;
        let g = src.index ? src.toNonIndexed() : src.clone();
        relMatrix.multiplyMatrices(invWrapper, m.matrixWorld);
        g.applyMatrix4(relMatrix);

        // Fix inverted winding if negative mirror scale was present on a sub-node
        if (relMatrix.determinant() < 0) {
          const posAttr = g.getAttribute('position');
          const normAttr = g.getAttribute('normal');
          const uvAttr = g.getAttribute('uv');
          for (let i = 0; i < posAttr.count; i += 3) {
            const x1 = posAttr.getX(i + 1), y1 = posAttr.getY(i + 1), z1 = posAttr.getZ(i + 1);
            posAttr.setXYZ(i + 1, posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
            posAttr.setXYZ(i + 2, x1, y1, z1);
            if (normAttr) {
              const nx1 = normAttr.getX(i + 1), ny1 = normAttr.getY(i + 1), nz1 = normAttr.getZ(i + 1);
              normAttr.setXYZ(i + 1, normAttr.getX(i + 2), normAttr.getY(i + 2), normAttr.getZ(i + 2));
              normAttr.setXYZ(i + 2, nx1, ny1, nz1);
            }
            if (uvAttr) {
              const u1 = uvAttr.getX(i + 1), v1 = uvAttr.getY(i + 1);
              uvAttr.setXY(i + 1, uvAttr.getX(i + 2), uvAttr.getY(i + 2));
              uvAttr.setXY(i + 2, u1, v1);
            }
          }
        }

        if (!g.getAttribute('normal')) {
          g.computeVertexNormals();
        }

        // Strip mismatched extra attributes (tangent, color, uv1, etc.) so mergeGeometries never fails
        for (const attrName of Object.keys(g.attributes)) {
          if (attrName === 'position' || attrName === 'normal') continue;
          if (attrName === 'uv' && allHaveUv) continue;
          g.deleteAttribute(attrName);
        }
        g.morphAttributes = {};
        g.clearGroups();

        if (!g.getAttribute('position') || !g.getAttribute('normal')) {
          g.dispose();
          canMerge = false;
          break;
        }
        prepared.push(g);
      }

      if (!canMerge || prepared.length < 2) {
        prepared.forEach((g) => g.dispose());
        continue;
      }

      const merged = mergeGeometries(prepared, false);
      prepared.forEach((g) => g.dispose());
      if (!merged) continue;

      const batchedMesh = new THREE.Mesh(merged, mat);
      batchedMesh.name = `batched_${mat.name || 'part'}`;
      wrapper.add(batchedMesh);
      this.disposables.push(merged);

      for (const m of entry.meshes) {
        m.removeFromParent();
      }
    }
  }

  private applyMeshMaterial(mesh: THREE.Mesh, modelFile: string): void {
    const name = mesh.name.toLowerCase();
    const mapSingleMat = (mat: THREE.Material | undefined): THREE.Material | undefined => {
      const matName = (mat?.name || '').toLowerCase();

      if (modelFile === 'supercar.glb') {
        if (matName.includes('body_color') || name === 'body') return this.paintMat;
        if (matName.includes('glass_gray') || name === 'glass') return this.glassMat;
        if (matName.includes('taillight') || name === 'lights_red' || name === 'brakes') return this.brakeLightMat;
        if (matName.includes('turn_signal') || matName.includes('projector') || name === 'leds') return this.headlightMat;
        if (matName.includes('carbon_fiber') || name.includes('carbon')) return this.carbonMat;
        if (matName.includes('metal_chrome') || matName.includes('metal_gray')) {
          return name.includes('rim') ? this.alloyMat : this.darkAlloyMat;
        }
        if (matName.includes('yellow') || name === 'yellow_trim') return this.caliperMat;
        if (matName.includes('tires')) return this.tireMat;
        return mat;
      }

      if (modelFile === 'phantom-p1.glb') {
        if (name.includes('headlight')) return this.headlightMat;
        if (name.includes('taillight') || name.includes('brakes')) return this.brakeLightMat;
        if (matName.includes('mm_ext')) return this.paintMat;
        if (matName.includes('mm_windows')) return this.glassMat;
        if (matName.includes('mm_lights')) return name.includes('chassis') ? this.headlightMat : this.brakeLightMat;
        if (matName.includes('mm_wheel')) return this.alloyMat;
        if (matName.includes('mm_tyre')) return this.tireMat;
        if (matName.includes('mm_rotor')) return this.brakeDiscMat;
        if (matName.includes('mm_chassis') || matName.includes('mm_misc') || matName.includes('mm_badges')) {
          return this.carbonMat;
        }
        return mat;
      }

      if (modelFile === 'katana-m4.glb') {
        if (matName === 'meshesbody151mtl') return this.paintMat;
        if (matName === 'mesheswindows1mtl') return this.glassMat;
        if (matName === 'meshesredlight1mtl') return this.brakeLightMat;
        if (matName === 'meshesled111mtl') return this.headlightMat;
        if (matName === 'caliper1mtl') return this.caliperMat;
        if (matName === 'meshesm8rim1mtl' || matName === 'mesheschrome51mtl') return this.alloyMat;
        if (matName === 'meshesm8rim0011mtl') return this.tireMat;
        if (
          matName === 'meshesblack161mtl' ||
          matName === 'meshespiggrill1mtl' ||
          matName === 'meshespillars1mtl' ||
          matName === 'mesheszx1mtl' ||
          matName === 'meshesengine51mtl'
        ) {
          return this.carbonMat;
        }
        return mat;
      }

      if (modelFile === 'valkyrie-aventador.glb') {
        if (name.includes('discrotor')) return this.brakeDiscMat;
        if (matName.includes('mt_body') || matName.includes('mt_mirrorcover')) return this.paintMat;
        if (matName.includes('mt_windscreens') || matName.includes('mt_glass')) return this.glassMat;
        if (
          matName.includes('mt_tail_light') ||
          matName.includes('reflector_bl') ||
          matName.includes('reflector_rl') ||
          matName.includes('reflector_tl')
        ) {
          return this.brakeLightMat;
        }
        if (matName.includes('mt_light_emissive')) {
          return this.headlightMat;
        }
        if (matName.includes('mt_turnlights')) {
          return this.caliperMat;
        }
        if (matName.includes('mt_brakecaliper') || name.includes('caliper')) return this.caliperMat;
        if (matName.includes('mt_alloywheels') || matName.includes('mt_chrome') || matName.includes('mt_metal_brushed')) {
          return this.alloyMat;
        }
        if (matName.includes('mt_tyres') || name.includes('tyre')) return this.tireMat;
        if (matName.includes('mt_abs_black') || matName.includes('mt_metal_black')) return this.carbonMat;
        return mat;
      }

      if (modelFile === 'eclipse-concept.glb') {
        if (matName.startsWith('paint 1')) return this.paintMat;
        if (matName.startsWith('paint 2')) return this.secondaryPaintMat;
        if (matName === 'glass') return this.glassMat;
        if (matName === 'brakelight' || name.includes('taillight')) return this.brakeLightMat;
        if (matName === 'headlight' || matName === 'signallight' || name.includes('headlight')) return this.headlightMat;
        if (matName === 'brake' || name.includes('brakepad')) return this.caliperMat;
        if (matName === 'disc' || name.includes('brakedisc')) return this.brakeDiscMat;
        if (matName === 'rim1') return this.darkAlloyMat;
        if (matName === 'rim2') return this.caliperMat;
        if (matName === 'tireside' || matName === 'tiretread') return this.tireMat;
        if (matName === 'mechanical' || matName === 'hardware' || matName === 'panel sides') return this.carbonMat;
        return mat;
      }

      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => mapSingleMat(m) ?? m);
    } else {
      const mapped = mapSingleMat(mesh.material);
      if (mapped) mesh.material = mapped;
    }
  }

  /**
   * Detaches wheel meshes into normalized car-space pivots so front steering (Y)
   * and 4-wheel rolling (X) work identically regardless of GLB native axis/scale/origin.
   * Runs inside a detached identity-transform localWheelsGroup for 100% async safety.
   */
  private mountWheelsUniversal(
    wheelNodes: THREE.Object3D[],
    modelFile: string,
    localWheelsGroup: THREE.Group
  ): void {
    if (wheelNodes.length === 0) return;

    const hasSeparatedCalipers =
      modelFile === 'valkyrie-aventador.glb' ||
      modelFile === 'eclipse-concept.glb' ||
      modelFile === 'katana-m4.glb';

    // Optional brake disc & painted caliper for models that don't ship visible calipers inside wheel barrels
    let discGeo: THREE.CylinderGeometry | null = null;
    let caliperGeo: THREE.BoxGeometry | null = null;
    if (!this.profile.hasBuiltInCalipers) {
      discGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.036, 20);
      discGeo.rotateZ(Math.PI / 2);
      caliperGeo = new THREE.BoxGeometry(0.08, 0.16, 0.12);
      this.disposables.push(discGeo, caliperGeo);
    }

    const box = new THREE.Box3();
    const localCenter = new THREE.Vector3();

    for (const wheelNode of wheelNodes) {
      // Measure true spinning axle center ONLY from spinning tire/rim meshes (excluding off-center brake pads/calipers)
      box.makeEmpty();
      if (hasSeparatedCalipers) {
        for (const ch of wheelNode.children) {
          const cname = ch.name.toLowerCase();
          if (cname.includes('caliper') || cname.includes('brakepad')) continue;
          box.expandByObject(ch);
        }
      }
      if (box.isEmpty()) {
        box.setFromObject(wheelNode);
      }
      if (box.isEmpty()) continue;

      box.getCenter(localCenter);

      const isFront = localCenter.z < 0;
      const side: -1 | 1 = localCenter.x < 0 ? -1 : 1;

      // Record exact rear wheel ground contact anchors for drift skid marks & tire smoke
      if (!isFront) {
        if (side < 0) {
          this.rearLeftContact.set(localCenter.x, 0.06, localCenter.z);
        } else {
          this.rearRightContact.set(localCenter.x, 0.06, localCenter.z);
        }
      }

      const steerPivot = new THREE.Group();
      steerPivot.position.copy(localCenter);
      localWheelsGroup.add(steerPivot);

      const spinPivot = new THREE.Group();
      steerPivot.add(spinPivot);
      steerPivot.updateMatrixWorld(true);

      if (hasSeparatedCalipers) {
        // Keep stationary brake calipers attached to steerPivot; spin rims/tyres/discs on spinPivot
        const children = [...wheelNode.children];
        for (const ch of children) {
          const cname = ch.name.toLowerCase();
          if (cname.includes('caliper') || cname.includes('brakepad')) {
            steerPivot.attach(ch);
          } else {
            spinPivot.attach(ch);
          }
        }
        wheelNode.removeFromParent();
      } else {
        spinPivot.attach(wheelNode);
        if (discGeo && caliperGeo) {
          const disc = new THREE.Mesh(discGeo, this.brakeDiscMat);
          disc.position.set(side * 0.04, 0, 0);
          const caliper = new THREE.Mesh(caliperGeo, this.caliperMat);
          caliper.position.set(side * 0.06, 0.03, isFront ? 0.14 : -0.14);
          steerPivot.add(disc, caliper);
        }
      }

      this.wheelSpinNodes.push(spinPivot);
      if (isFront) {
        if (side < 0) this.frontLeftPivot = steerPivot;
        else this.frontRightPivot = steerPivot;
      }
    }
  }

  /** Model-Tailored Motorsport GT3 Dry-Carbon Aero Packages */
  private buildGTAeroKit(): void {
    const style = this.spec.bodyStyle;
    const { wing, aero, hasBuiltInWing } = this.profile;

    // 1. Swan-Neck / Twin-Strut Carbon GT3 Rear Wing (skipped on cars with factory race wings like P1 GTR)
    if (!hasBuiltInWing) {
      const mainBladeGeo = new THREE.BoxGeometry(wing.width, 0.048, 0.34);
      const mainBlade = new THREE.Mesh(mainBladeGeo, this.carbonMat);
      mainBlade.position.set(0, wing.y, wing.z);
      this.wingBaseAngle = wing.baseAngle;
      mainBlade.rotation.x = this.wingBaseAngle;
      this.rearWingBlade = mainBlade;

      const strutH = Math.max(0.16, wing.y - wing.strutBaseY);
      const strutGeo = new THREE.BoxGeometry(0.048, strutH, 0.22);
      const strutL = new THREE.Mesh(strutGeo, this.carbonMat);
      strutL.position.set(-wing.strutX, wing.strutBaseY + strutH * 0.5, wing.z - 0.02);
      const strutR = new THREE.Mesh(strutGeo, this.carbonMat);
      strutR.position.set(wing.strutX, wing.strutBaseY + strutH * 0.5, wing.z - 0.02);

      const endGeo = new THREE.BoxGeometry(0.04, wing.endH, 0.44);
      const endL = new THREE.Mesh(endGeo, this.paintMat);
      endL.position.set(-wing.width * 0.5, wing.y - 0.02, wing.z);
      const endR = new THREE.Mesh(endGeo, this.paintMat);
      endR.position.set(wing.width * 0.5, wing.y - 0.02, wing.z);

      this.aeroSlot.add(mainBlade, strutL, strutR, endL, endR);
      this.disposables.push(mainBladeGeo, strutGeo, endGeo);
    }

    // 2. Archetype-specific authentic GT aero components
    if (style === 'katana') {
      // Front carbon dive-plane canards (touge / GT3 drift spec)
      const canardGeo = new THREE.BoxGeometry(0.22, 0.028, 0.34);
      const cL = new THREE.Mesh(canardGeo, this.carbonMat);
      cL.position.set(-0.98, 0.34, -2.18);
      cL.rotation.z = 0.26;
      const cR = new THREE.Mesh(canardGeo, this.carbonMat);
      cR.position.set(0.98, 0.34, -2.18);
      cR.rotation.z = -0.26;
      this.aeroSlot.add(cL, cR);
      this.disposables.push(canardGeo);
    } else if (style === 'valkyrie') {
      // Upper biplane active-aero DRS flap on S-Class wedge hypercar
      const flapGeo = new THREE.BoxGeometry(wing.width - 0.18, 0.034, 0.16);
      const flap = new THREE.Mesh(flapGeo, this.carbonMat);
      flap.position.set(0, wing.y + 0.11, wing.z + 0.09);
      flap.rotation.x = 0.18;
      this.rearWingFlap = flap;
      this.aeroSlot.add(flap);
      this.disposables.push(flapGeo);
    }

    // 3. Dry-Carbon Side Skirts, Front Splitter & 4-Strake Rear Venturi Diffuser
    if (aero.addAeroSkirts) {
      const skirtGeo = new THREE.BoxGeometry(0.11, 0.048, aero.skirtLen);
      const skirtL = new THREE.Mesh(skirtGeo, this.carbonMat);
      skirtL.position.set(-aero.skirtX, 0.16, 0.12);
      const skirtR = new THREE.Mesh(skirtGeo, this.carbonMat);
      skirtR.position.set(aero.skirtX, 0.16, 0.12);

      const splitGeo = new THREE.BoxGeometry(aero.splitterW, 0.04, 0.36);
      const splitter = new THREE.Mesh(splitGeo, this.carbonMat);
      splitter.position.set(0, 0.15, aero.splitterZ);

      const strakeGeo = new THREE.BoxGeometry(0.032, 0.17, 0.34);
      for (const sx of [-0.6, -0.22, 0.22, 0.6]) {
        const strake = new THREE.Mesh(strakeGeo, this.carbonMat);
        strake.position.set(sx, 0.2, aero.diffuserZ);
        this.aeroSlot.add(strake);
      }

      this.aeroSlot.add(skirtL, skirtR, splitter);
      this.disposables.push(skirtGeo, splitGeo, strakeGeo);
    }
  }

  private buildNitroThrusters(): void {
    const flameOuterGeo = new THREE.ConeGeometry(0.15, 1.85, 10, 1, true);
    flameOuterGeo.rotateX(Math.PI / 2);
    flameOuterGeo.translate(0, 0, 0.92);
    const flameInnerGeo = new THREE.ConeGeometry(0.08, 1.18, 8, 1, true);
    flameInnerGeo.rotateX(Math.PI / 2);
    flameInnerGeo.translate(0, 0, 0.59);
    this.disposables.push(flameOuterGeo, flameInnerGeo);

    const { y, z, offsets } = this.profile.exhaust;
    for (const ex of offsets) {
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
      outerCone.position.set(ex, y, z);
      const innerCone = new THREE.Mesh(flameInnerGeo, innerMat);
      innerCone.position.set(ex, y, z);
      this.nitroFlameGroup.add(outerCone, innerCone);
      this.flameCones.push(outerCone, innerCone);
    }

    this.nitroFlameGroup.visible = false;
    this.chassis.add(this.nitroFlameGroup);

    this.nitroPointLight.position.set(0, 0.55, z + 0.7);
    this.nitroPointLight.visible = false;
    if (this.isPlayer && !isMobileDevice()) {
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

    // Reactive LED brake taillights + wet-tarmac crimson bounce + glowing hot brake rotors!
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

      const isEV = this.spec.bodyStyle === 'eclipse';
      const outerHex = isSuperNitro
        ? 0x3b82f6
        : isEV
          ? 0x06b6d4
          : 0xff7a1a;
      const innerHex = isSuperNitro
        ? 0xe0f2fe
        : isEV
          ? 0xcffafe
          : 0xdbeafe;

      for (const m of this.flameOuterMats) {
        m.color.setHex(outerHex).multiplyScalar(1.48);
      }
      for (const m of this.flameInnerMats) {
        m.color.setHex(innerHex).multiplyScalar(1.68);
      }
      for (let i = 0; i < this.flameCones.length; i++) {
        this.flameCones[i].scale.set(radScale, radScale, lenScale);
      }

      this.nitroPointLight.visible = true;
      this.nitroPointLight.color.setHex(outerHex);
      this.nitroPointLight.intensity = 2.4 * boostIntensity * flicker;
    } else {
      this.nitroFlameGroup.visible = false;
      this.nitroPointLight.visible = false;
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
