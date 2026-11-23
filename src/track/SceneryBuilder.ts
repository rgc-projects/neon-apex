import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import {
  createBuildingPBRTextures,
  createConcreteTexture,
  createOceanNormalTexture,
  createRealisticSkyTexture,
} from '../utils/textures';
import { clamp, createSeededRandom, smoothstep } from '../utils/math';

export interface SceneryBuildResult {
  group: THREE.Group;
  update: (dt: number, elapsed: number, camPos: THREE.Vector3) => void;
  dispose: () => void;
}

/**
 * Modern Photorealistic Scenery Builder for all 4 circuits:
 * - city: Multi-tier architectural glass skyscrapers, concrete viaduct piers & Tokyo Bay dark water
 * - bridge: Animated normal-mapped golden-dusk ocean, A-frame concrete/steel cable-stayed towers & harbor skyline
 * - tunnel: Curved concrete arch highway tunnel vault, ceiling linear LEDs & jet ventilation fans
 * - mountain: Real sculpted 3D FBM terrain ridges, 350+ instanced layered pine trees & vermilion Torii gates
 */
export function buildScenery(spline: TrackSpline): SceneryBuildResult {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const cfg = spline.config;
  const rand = createSeededRandom(cfg.id.length * 9137 + 109);

  // 1. Photorealistic Atmospheric Sky Dome (natural clouds, twilight scattering & subtle stars)
  const isDusk = cfg.theme === 'bridge';
  const skyTex = createRealisticSkyTexture(
    cfg.skyTopHex,
    cfg.skyMidHex,
    cfg.skyHorizonHex,
    cfg.sunColorHex,
    isDusk
  );
  const skyGeo = new THREE.SphereGeometry(3200, 48, 28);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.renderOrder = -10;
  group.add(skyDome);
  disposables.push(skyTex, skyGeo, skyMat);

  // 2. Base Ground / Realistic Shimmering Ocean Water Plane
  const oceanNormal = createOceanNormalTexture();
  disposables.push(oceanNormal);

  const groundGeo = new THREE.PlaneGeometry(7600, 7600);
  groundGeo.rotateX(-Math.PI / 2);

  let groundMat: THREE.MeshStandardMaterial;
  if (cfg.theme === 'bridge' || cfg.theme === 'city') {
    groundMat = new THREE.MeshStandardMaterial({
      color: cfg.theme === 'bridge' ? 0x0d223a : 0x070f1c,
      normalMap: oceanNormal,
      normalScale: new THREE.Vector2(cfg.theme === 'bridge' ? 0.85 : 0.45, cfg.theme === 'bridge' ? 0.85 : 0.45),
      roughness: cfg.theme === 'bridge' ? 0.22 : 0.36,
      metalness: cfg.theme === 'bridge' ? 0.55 : 0.35,
      envMapIntensity: cfg.theme === 'bridge' ? 1.15 : 0.65,
    });
  } else {
    groundMat = new THREE.MeshStandardMaterial({
      color: cfg.theme === 'mountain' ? 0x0c1317 : 0x0b0f17,
      roughness: 0.92,
      metalness: 0.05,
    });
  }
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.position.y =
    cfg.theme === 'bridge' ? -2 : cfg.theme === 'tunnel' ? -56 : cfg.theme === 'mountain' ? -18 : -22;
  group.add(groundPlane);
  disposables.push(groundGeo, groundMat);

  // 3. Concrete Highway Arch Tunnel Vaults (for tunnel zones!)
  if (cfg.tunnelZones.length > 0) {
    buildRealisticConcreteTunnel(spline, group, disposables);
  }

  // 4. Realistic Concrete Viaduct Support Piers with Bank-Aligned T-Cap Crossbeams (Zero road clipping!)
  if (cfg.theme === 'city' || cfg.theme === 'bridge' || cfg.theme === 'mountain') {
    const floorY = groundPlane.position.y;
    const pierList: {
      pos: THREE.Vector3;
      right: THREE.Vector3;
      up: THREE.Vector3;
      bankQuat: THREE.Quaternion;
      flatQuat: THREE.Quaternion;
      leftColTopY: number;
      rightColTopY: number;
    }[] = [];
    const basis = new THREE.Matrix4();
    const flatUp = new THREE.Vector3(0, 1, 0);
    const colOffset = spline.roadWidth * 0.24;

    for (let i = 0; i < spline.sampleCount; i += 32) {
      const f = spline.samples[i];
      // Exact underside elevation of the banked concrete box-girder at left & right pier column anchor points
      const leftColTopY = f.pos.y + f.right.y * -colOffset - f.up.y * 4.35;
      const rightColTopY = f.pos.y + f.right.y * colOffset - f.up.y * 4.35;
      if (Math.min(leftColTopY, rightColTopY) - floorY > 3.5) {
        const negTan = f.tangent.clone().negate();
        basis.makeBasis(f.right, f.up, negTan);
        const bankQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
        basis.makeBasis(f.flatRight, flatUp, negTan);
        const flatQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
        pierList.push({
          pos: f.pos.clone(),
          right: f.right.clone(),
          up: f.up.clone(),
          bankQuat,
          flatQuat,
          leftColTopY,
          rightColTopY,
        });
      }
    }

    if (pierList.length > 0) {
      const concreteTex = createConcreteTexture();
      const pierMat = new THREE.MeshStandardMaterial({
        map: concreteTex,
        color: 0x64748b,
        roughness: 0.84,
        metalness: 0.1,
      });
      const colGeo = new THREE.BoxGeometry(3.4, 1, 3.4);
      const capGeo = new THREE.BoxGeometry(spline.roadWidth * 0.66, 2.0, 4.0);
      const colInst = new THREE.InstancedMesh(colGeo, pierMat, pierList.length * 2);
      const capInst = new THREE.InstancedMesh(capGeo, pierMat, pierList.length);
      const dummy = new THREE.Object3D();

      pierList.forEach((p, idx) => {
        // Twin vertical concrete columns terminating strictly UNDER the banked underside of the viaduct deck
        const sides: [number, number][] = [
          [-colOffset, p.leftColTopY],
          [colOffset, p.rightColTopY],
        ];
        sides.forEach(([offset, topY], s) => {
          const colH = Math.max(1, topY - floorY);
          dummy.position
            .set(
              p.pos.x + p.right.x * offset - p.up.x * 4.35,
              floorY + colH * 0.5,
              p.pos.z + p.right.z * offset - p.up.z * 4.35
            );
          dummy.quaternion.copy(p.flatQuat);
          dummy.scale.set(1, colH, 1);
          dummy.updateMatrix();
          colInst.setMatrixAt(idx * 2 + s, dummy.matrix);
        });

        // Bank-aligned concrete T-cap crossbeam tucked cleanly beneath the 3.2m box-girder deck (-4.35m along road up!)
        dummy.position.copy(p.pos).addScaledVector(p.up, -4.35);
        dummy.quaternion.copy(p.bankQuat);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        capInst.setMatrixAt(idx, dummy.matrix);
      });

      group.add(colInst, capInst);
      disposables.push(concreteTex, pierMat, colGeo, capGeo);
    }
  }

  // 5. Theme-Specific Photorealistic World Architecture
  const animatedFans: THREE.Object3D[] = [];

  if (cfg.theme === 'city') {
    buildRealisticCitySkyline(spline, group, disposables, rand, groundPlane.position.y);
  } else if (cfg.theme === 'bridge') {
    buildRealisticSuspensionBridge(spline, group, disposables, rand, groundPlane.position.y);
  } else if (cfg.theme === 'mountain') {
    buildRealisticMountainPass(spline, group, disposables, rand, groundPlane.position.y);
  } else {
    buildRealisticSubterraneanCavern(spline, group, disposables, rand, animatedFans);
  }

  return {
    group,
    update: (dt: number, elapsed: number, camPos: THREE.Vector3) => {
      skyDome.position.set(camPos.x, 0, camPos.z);
      if (cfg.theme === 'bridge' || cfg.theme === 'city') {
        oceanNormal.offset.y += dt * 0.08;
        oceanNormal.offset.x = Math.sin(elapsed * 0.25) * 0.08;
      }
      for (const fan of animatedFans) {
        fan.rotation.z += dt * 7.5;
      }
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** Realistic arched concrete expressway tunnel vault + recessed linear industrial LED ceiling luminaires */
function buildRealisticConcreteTunnel(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[]
): void {
  const ribFrames: number[] = [];
  const step = 4; // tight spacing for continuous vaulted tunnel feel
  for (let i = 0; i < spline.sampleCount; i += step) {
    if (spline.isInTunnel(i / spline.sampleCount)) {
      ribFrames.push(i);
    }
  }
  if (ribFrames.length === 0) return;

  const radius = spline.halfWidth + 2.4;
  const outerR = radius + 1.8;
  const shape = new THREE.Shape();
  const segs = 14;

  for (let s = 0; s <= segs; s++) {
    const a = -0.05 + (s / segs) * (Math.PI + 0.1);
    const x = Math.cos(a) * outerR;
    const y = Math.sin(a) * (outerR * 0.72);
    if (s === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let s = segs; s >= 0; s--) {
    const a = -0.05 + (s / segs) * (Math.PI + 0.1);
    shape.lineTo(Math.cos(a) * radius, Math.sin(a) * (radius * 0.72));
  }
  shape.closePath();

  const segDepth = (spline.totalLength / spline.sampleCount) * step * 1.08;
  const archGeo = new THREE.ExtrudeGeometry(shape, { depth: segDepth, bevelEnabled: false });
  archGeo.translate(0, 0, -segDepth * 0.5);

  const concreteTex = createConcreteTexture();
  const archMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0x3f4754,
    roughness: 0.76,
    metalness: 0.12,
  });

  // Twin industrial overhead white-amber LED roof fixture tubes inside tunnel ceiling
  const fixtureGeo = new THREE.BoxGeometry(0.45, 0.2, segDepth * 0.62);
  const fixtureMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfff1d6).multiplyScalar(1.45),
    toneMapped: false,
  });

  // Tunnel cylindrical jet ventilation fan housings every 6th segment
  const fanHousingGeo = new THREE.CylinderGeometry(0.95, 0.95, 2.8, 12);
  fanHousingGeo.rotateX(Math.PI / 2);
  const fanMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.75,
    roughness: 0.35,
  });

  const archInst = new THREE.InstancedMesh(archGeo, archMat, ribFrames.length);
  const fixL = new THREE.InstancedMesh(fixtureGeo, fixtureMat, ribFrames.length);
  const fixR = new THREE.InstancedMesh(fixtureGeo, fixtureMat, ribFrames.length);
  const fanInst = new THREE.InstancedMesh(fanHousingGeo, fanMat, Math.ceil(ribFrames.length / 5) + 1);

  const dummy = new THREE.Object3D();
  const basisMat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let fanIdx = 0;

  ribFrames.forEach((sampleIdx, idx) => {
    const f = spline.samples[sampleIdx];
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    q.setFromRotationMatrix(basisMat);

    dummy.position.copy(f.pos);
    dummy.quaternion.copy(q);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    archInst.setMatrixAt(idx, dummy.matrix);

    const ceilH = radius * 0.66;
    dummy.position.copy(f.pos).addScaledVector(f.right, -5.5).addScaledVector(f.up, ceilH);
    dummy.updateMatrix();
    fixL.setMatrixAt(idx, dummy.matrix);

    dummy.position.copy(f.pos).addScaledVector(f.right, 5.5).addScaledVector(f.up, ceilH);
    dummy.updateMatrix();
    fixR.setMatrixAt(idx, dummy.matrix);

    if (idx % 5 === 2 && fanIdx < fanInst.count) {
      dummy.position.copy(f.pos).addScaledVector(f.up, ceilH - 0.6);
      dummy.updateMatrix();
      fanInst.setMatrixAt(fanIdx++, dummy.matrix);
    }
  });
  fanInst.count = fanIdx;

  group.add(archInst, fixL, fixR, fanInst);
  disposables.push(archGeo, concreteTex, archMat, fixtureGeo, fixtureMat, fanHousingGeo, fanMat);
}

/** Realistic Tokyo Bayshore Multi-Tier Glass Skyscraper Skyline */
function buildRealisticCitySkyline(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  floorY: number
): void {
  const bldgPBR = createBuildingPBRTextures();
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgPBR.map,
    emissive: 0xffe4b5,
    emissiveMap: bldgPBR.emissiveMap,
    emissiveIntensity: 0.95,
    roughness: 0.22,
    metalness: 0.72,
    envMapIntensity: 1.4,
  });

  const roofCapMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.45,
  });
  const beaconGeo = new THREE.SphereGeometry(0.95, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xef4444).multiplyScalar(1.9),
    toneMapped: false,
  });
  const spireGeo = new THREE.CylinderGeometry(0.18, 0.45, 22, 6);

  disposables.push(bldgPBR.map, bldgPBR.emissiveMap, bldgGeo, bldgMat, roofCapMat, beaconGeo, beaconMat, spireGeo);

  const placements: { x: number; z: number; w: number; d: number; h: number; tall: boolean }[] = [];
  let attempts = 0;
  while (placements.length < 220 && attempts < 2200) {
    attempts++;
    const x = -520 + rand() * 1950;
    const z = -1150 + rand() * 2250;
    const dist = spline.minHorizontalDistanceToTrack(x, z);
    const w = 26 + rand() * 48;
    const d = 26 + rand() * 48;
    const clearance = spline.halfWidth + Math.max(w, d) * 0.75 + 18;
    if (dist < clearance) continue;

    const h = dist > 150 ? 95 + rand() * 240 : 52 + rand() * 135;
    placements.push({ x, z, w, d, h, tall: h > 165 });
  }

  const mainInst = new THREE.InstancedMesh(bldgGeo, bldgMat, placements.length);
  const setbackInst = new THREE.InstancedMesh(bldgGeo, bldgMat, placements.length);
  const mechInst = new THREE.InstancedMesh(bldgGeo, roofCapMat, placements.length);
  const spireInst = new THREE.InstancedMesh(spireGeo, roofCapMat, placements.length);
  const beaconInst = new THREE.InstancedMesh(beaconGeo, beaconMat, placements.length);

  const dummy = new THREE.Object3D();
  let sCount = 0;

  placements.forEach((b, i) => {
    // Base skyscraper shaft
    dummy.position.set(b.x, floorY + b.h * 0.5, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    mainInst.setMatrixAt(i, dummy.matrix);

    // Architectural stepped upper setback tier (authentic modern high-rise silhouette!)
    const tierH = b.h * 0.24;
    dummy.position.set(b.x, floorY + b.h + tierH * 0.5, b.z);
    dummy.scale.set(b.w * 0.68, tierH, b.d * 0.68);
    dummy.updateMatrix();
    setbackInst.setMatrixAt(i, dummy.matrix);

    // Rooftop mechanical penthouse
    dummy.position.set(b.x, floorY + b.h + tierH + 3.2, b.z);
    dummy.scale.set(b.w * 0.36, 6.4, b.d * 0.36);
    dummy.updateMatrix();
    mechInst.setMatrixAt(i, dummy.matrix);

    if (b.tall) {
      const topY = floorY + b.h + tierH + 6.4;
      dummy.position.set(b.x, topY + 11, b.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      spireInst.setMatrixAt(sCount, dummy.matrix);

      dummy.position.set(b.x, topY + 22.5, b.z);
      dummy.updateMatrix();
      beaconInst.setMatrixAt(sCount, dummy.matrix);
      sCount++;
    }
  });
  spireInst.count = sCount;
  beaconInst.count = sCount;
  group.add(mainInst, setbackInst, mechInst, spireInst, beaconInst);
}

/** Realistic Concrete & Steel A-Frame Cable-Stayed Suspension Bridge + Dusk Harbor Skyline */
function buildRealisticSuspensionBridge(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number
): void {
  const concreteTex = createConcreteTexture();
  const towerMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xcbd5e1,
    metalness: 0.25,
    roughness: 0.62,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.22,
  });
  const aviationRed = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xef4444).multiplyScalar(2.0),
    toneMapped: false,
  });
  const archGlow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfff1d6).multiplyScalar(1.3),
    toneMapped: false,
  });
  disposables.push(concreteTex, towerMat, cableMat, aviationRed, archGlow);

  // Two colossal realistic cable-stayed bridge towers framing the main bay straight & menu view
  const pylonTs = [0.025, 0.115];
  const legGeo = new THREE.BoxGeometry(4.2, 148, 5.2);
  const braceGeo = new THREE.BoxGeometry(spline.roadWidth + 12, 3.8, 3.6);
  const beaconGeo = new THREE.SphereGeometry(1.8, 10, 10);
  const cableGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6);
  disposables.push(legGeo, braceGeo, beaconGeo, cableGeo);

  for (const pt of pylonTs) {
    const f = spline.getFrameAtDistance(pt * spline.totalLength);
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(f.pos.x, waterY, f.pos.z);
    const basis = new THREE.Matrix4().makeBasis(f.flatRight, new THREE.Vector3(0, 1, 0), f.tangent.clone().negate());
    pylonGroup.quaternion.setFromRotationMatrix(basis);

    const halfSpan = spline.halfWidth + 4.2;
    const leftLeg = new THREE.Mesh(legGeo, towerMat);
    leftLeg.position.set(-halfSpan, 74, 0);
    const rightLeg = new THREE.Mesh(legGeo, towerMat);
    rightLeg.position.set(halfSpan, 74, 0);

    const brace1 = new THREE.Mesh(braceGeo, towerMat);
    brace1.position.set(0, 56, 0);
    const brace2 = new THREE.Mesh(braceGeo, towerMat);
    brace2.position.set(0, 108, 0);
    const brace3 = new THREE.Mesh(braceGeo, towerMat);
    brace3.position.set(0, 144, 0);

    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(spline.roadWidth + 10, 0.45, 3.9), archGlow);
    lightBar.position.set(0, 108, 0);
    disposables.push(lightBar.geometry);

    const b1 = new THREE.Mesh(beaconGeo, aviationRed);
    b1.position.set(-halfSpan, 150, 0);
    const b2 = new THREE.Mesh(beaconGeo, aviationRed);
    b2.position.set(halfSpan, 150, 0);

    pylonGroup.add(leftLeg, rightLeg, brace1, brace2, brace3, lightBar, b1, b2);

    // Realistic steel stay cables fanning cleanly to the bridge deck
    const deckY = f.pos.y - waterY + 1.2;
    for (const side of [-1, 1]) {
      for (let c = 1; c <= 8; c++) {
        for (const dir of [-1, 1]) {
          const topPt = new THREE.Vector3(side * halfSpan, 78 + c * 8.2, 0);
          const botPt = new THREE.Vector3(side * (spline.halfWidth + 1.0), deckY, dir * c * 22);
          const delta = botPt.clone().sub(topPt);
          const len = delta.length();
          const cable = new THREE.Mesh(cableGeo, cableMat);
          cable.scale.set(1, len, 1);
          cable.position.copy(topPt).addScaledVector(delta, 0.5);
          cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
          pylonGroup.add(cable);
        }
      }
    }
    group.add(pylonGroup);
  }

  // Distant illuminated coastal harbor skyline
  const bldgPBR = createBuildingPBRTextures();
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgPBR.map,
    emissive: 0xffe4b5,
    emissiveMap: bldgPBR.emissiveMap,
    emissiveIntensity: 0.85,
    roughness: 0.3,
    metalness: 0.65,
  });
  disposables.push(bldgPBR.map, bldgPBR.emissiveMap, bldgGeo, bldgMat);

  const skylineInst = new THREE.InstancedMesh(bldgGeo, bldgMat, 110);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < 800 && placed < 110; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = 820 + rand() * 780;
    const x = 350 + Math.cos(angle) * rad;
    const z = -340 + Math.sin(angle) * rad;
    if (spline.minHorizontalDistanceToTrack(x, z) < 180) continue;
    const w = 34 + rand() * 58;
    const h = 55 + rand() * 230;
    dummy.position.set(x, waterY + h * 0.5, z);
    dummy.scale.set(w, h, w);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    skylineInst.setMatrixAt(placed++, dummy.matrix);
  }
  skylineInst.count = placed;
  group.add(skylineInst);
}

/** Realistic Sculpted 3D Mountain Terrain + 350 Instanced Layered Pine Trees + Traditional Vermilion Torii Gates */
function buildRealisticMountainPass(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  floorY: number
): void {
  // 1. Real Sculpted 3D FBM Mountain Terrain Heightfield around the entire 3.7km mountain pass!
  // Compute track bounding box
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }
  const margin = 460;
  const widthX = maxX - minX + margin * 2;
  const depthZ = maxZ - minZ + margin * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const segX = 128;
  const segZ = 128;
  const terrainGeo = new THREE.PlaneGeometry(widthX, depthZ, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);

  // Smooth trigonometric multi-octave FBM ridge noise (zero jagged artifacts)
  const fbm = (x: number, z: number): number => {
    const n1 = Math.sin(x * 0.0042 + 1.1) * Math.cos(z * 0.0038 - 0.7);
    const n2 = Math.sin(x * 0.0095 - z * 0.0072 + 2.3) * 0.5;
    const n3 = Math.cos(x * 0.019 + z * 0.017) * 0.22;
    return (n1 + n2 + n3) * 0.5 + 0.5; // ~0..1
  };

  // Pre-downsample spline samples (including banking!) for accurate roadbed carving beneath banked hairpins
  const coarseSamples: { x: number; y: number; z: number; bankDrop: number }[] = [];
  for (let i = 0; i < spline.sampleCount; i += 4) {
    const s = spline.samples[i];
    coarseSamples.push({
      x: s.pos.x,
      y: s.pos.y,
      z: s.pos.z,
      bankDrop: spline.halfWidth * Math.sin(Math.abs(s.bank)),
    });
  }

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const col = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) + centerX;
    const vz = posAttr.getZ(i) + centerZ;

    // Find nearest road sample to carve a clean natural mountain roadbed beneath even 34° banked hairpins
    let minD2 = Infinity;
    let nearestY = floorY;
    let nearestBankDrop = 0;
    for (let k = 0; k < coarseSamples.length; k++) {
      const p = coarseSamples[k];
      const dx = vx - p.x;
      const dz = vz - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD2) {
        minD2 = d2;
        nearestY = p.y;
        nearestBankDrop = p.bankDrop;
      }
    }
    const dist = Math.sqrt(minD2);

    // Base sculpted mountain ridge elevation
    const ridgeNoise = fbm(vx, vz);
    const rawMountainY = floorY - 4 + ridgeNoise * 165 + Math.max(0, (dist - 120) * 0.22);

    // Carve generously below the lowest edge of the banked viaduct deck (NEVER pokes through asphalt!)
    const roadClearance = spline.halfWidth + 26;
    const blend = smoothstep(roadClearance, roadClearance + 82, dist);
    const carvedY = nearestY - nearestBankDrop - 8.5;
    const finalY = carvedY * (1 - blend) + rawMountainY * blend;

    posAttr.setXYZ(i, vx, finalY, vz);

    // Realistic dark nocturnal Japanese cedar-forest & volcanic basalt slope shading
    const elevNorm = clamp((finalY - floorY) / 170, 0, 1);
    const grain = ((Math.sin(vx * 0.14) * Math.cos(vz * 0.14)) * 0.5 + 0.5) * 0.025;
    if (elevNorm < 0.42) {
      col.setRGB(0.02 + grain * 0.5, 0.045 + grain, 0.032 + grain * 0.5); // deep cedar valley
    } else if (elevNorm < 0.78) {
      col.setRGB(0.03 + grain, 0.05 + grain, 0.045 + grain); // forested basalt mountainside
    } else {
      col.setRGB(0.055 + grain, 0.068 + grain, 0.088 + grain); // twilight alpine granite ridge
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  // Procedural alpine forest & basalt cliff texture so slopes never look like smooth grey clay
  const terrainTex = createConcreteTexture();
  terrainTex.repeat.set(36, 36);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
    envMapIntensity: 0.16,
  });
  group.add(new THREE.Mesh(terrainGeo, terrainMat));
  disposables.push(terrainTex, terrainGeo, terrainMat);

  // 2. 520 Dense Japanese Cedar / Pine Trees lining the Mountain Pass (InstancedMesh!)
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 4.5, 6);
  const foliageGeo1 = new THREE.ConeGeometry(3.4, 8.0, 7);
  const foliageGeo2 = new THREE.ConeGeometry(2.6, 7.0, 7);
  const foliageGeo3 = new THREE.ConeGeometry(1.7, 5.5, 7);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.95, envMapIntensity: 0.2 });
  const pineMatDark = new THREE.MeshStandardMaterial({ color: 0x0b2219, roughness: 0.92, envMapIntensity: 0.22 });
  const pineMatMid = new THREE.MeshStandardMaterial({ color: 0x113024, roughness: 0.9, envMapIntensity: 0.22 });
  disposables.push(trunkGeo, foliageGeo1, foliageGeo2, foliageGeo3, trunkMat, pineMatDark, pineMatMid);

  const trees: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 2400 && trees.length < 520; i++) {
    // Cluster trees organically alongside the mountain pass road!
    const sample = spline.samples[Math.floor(rand() * spline.sampleCount)];
    const side = rand() > 0.5 ? 1 : -1;
    const offset = spline.halfWidth + 8 + rand() * 58;
    const tx = sample.pos.x + sample.flatRight.x * side * offset + (rand() - 0.5) * 14;
    const tz = sample.pos.z + sample.flatRight.z * side * offset + (rand() - 0.5) * 14;

    if (spline.minHorizontalDistanceToTrack(tx, tz) < spline.halfWidth + 9.5) continue;
    // Place naturally along embankment height
    const ty = sample.pos.y - 4.5 + (rand() - 0.35) * 6;
    trees.push({ x: tx, y: Math.max(floorY, ty), z: tz, s: 0.85 + rand() * 1.1 });
  }

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const fol1Inst = new THREE.InstancedMesh(foliageGeo1, pineMatDark, trees.length);
  const fol2Inst = new THREE.InstancedMesh(foliageGeo2, pineMatMid, trees.length);
  const fol3Inst = new THREE.InstancedMesh(foliageGeo3, pineMatDark, trees.length);
  const dummy = new THREE.Object3D();

  trees.forEach((tr, i) => {
    const rotY = rand() * Math.PI * 2;
    dummy.rotation.set(0, rotY, 0);

    dummy.position.set(tr.x, tr.y + 2.2 * tr.s, tr.z);
    dummy.scale.setScalar(tr.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tr.x, tr.y + 6.8 * tr.s, tr.z);
    dummy.updateMatrix();
    fol1Inst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tr.x, tr.y + 10.6 * tr.s, tr.z);
    dummy.updateMatrix();
    fol2Inst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tr.x, tr.y + 13.8 * tr.s, tr.z);
    dummy.updateMatrix();
    fol3Inst.setMatrixAt(i, dummy.matrix);
  });
  group.add(trunkInst, fol1Inst, fol2Inst, fol3Inst);

  // 3. Authentic Traditional Japanese Vermilion Shrine Torii Gates straddling Pass Overlooks
  const vermilionMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.52,
    metalness: 0.1,
  });
  const blackEaveMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.55,
    metalness: 0.2,
  });
  const warmLanternMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd28a).multiplyScalar(1.45),
    toneMapped: false,
  });
  const legGeo = new THREE.CylinderGeometry(0.65, 0.8, 14.5, 10);
  const kasagiGeo = new THREE.BoxGeometry(spline.roadWidth + 10.5, 1.1, 1.6);
  const capEaveGeo = new THREE.BoxGeometry(spline.roadWidth + 11.4, 0.45, 1.9);
  const nukiGeo = new THREE.BoxGeometry(spline.roadWidth + 6.0, 0.72, 1.0);
  const lanternGeo = new THREE.BoxGeometry(0.65, 1.1, 0.65);
  disposables.push(vermilionMat, blackEaveMat, warmLanternMat, legGeo, kasagiGeo, capEaveGeo, nukiGeo, lanternGeo);

  const basis = new THREE.Matrix4();
  const hw = spline.halfWidth + 2.2;

  for (const t of [0.06, 0.34, 0.68, 0.90]) {
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const gate = new THREE.Group();
    gate.position.copy(f.pos);
    basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
    gate.quaternion.setFromRotationMatrix(basis);

    const lL = new THREE.Mesh(legGeo, vermilionMat);
    lL.position.set(-hw, 7.25, 0);
    const lR = new THREE.Mesh(legGeo, vermilionMat);
    lR.position.set(hw, 7.25, 0);
    const kasagi = new THREE.Mesh(kasagiGeo, vermilionMat);
    kasagi.position.set(0, 14.4, 0);
    const eave = new THREE.Mesh(capEaveGeo, blackEaveMat);
    eave.position.set(0, 15.1, 0);
    const nuki = new THREE.Mesh(nukiGeo, vermilionMat);
    nuki.position.set(0, 11.8, 0);

    const lanL = new THREE.Mesh(lanternGeo, warmLanternMat);
    lanL.position.set(-hw + 1.2, 10.6, 0);
    const lanR = new THREE.Mesh(lanternGeo, warmLanternMat);
    lanR.position.set(hw - 1.2, 10.6, 0);

    gate.add(lL, lR, kasagi, eave, nuki, lanL, lanR);
    group.add(gate);
  }
}

/** Realistic Concrete Subterranean Cavern & Industrial Infrastructure */
function buildRealisticSubterraneanCavern(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  animatedFans: THREE.Object3D[]
): void {
  const concreteTex = createConcreteTexture();
  const pillarGeo = new THREE.BoxGeometry(1, 1, 1);
  const pillarMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0x334155,
    roughness: 0.78,
    metalness: 0.2,
  });
  const stripGeo = new THREE.BoxGeometry(1.04, 0.5, 1.04);
  const stripMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xf59e0b).multiplyScalar(1.3),
    toneMapped: false,
  });
  disposables.push(concreteTex, pillarGeo, pillarMat, stripGeo, stripMat);

  const monos: { x: number; y: number; z: number; w: number; h: number }[] = [];
  for (let i = 0; i < 1200 && monos.length < 140; i++) {
    const x = -1100 + rand() * 1450;
    const z = -950 + rand() * 1850;
    const d = spline.minHorizontalDistanceToTrack(x, z);
    if (d < spline.halfWidth + 24) continue;
    const w = 16 + rand() * 28;
    const h = 85 + rand() * 165;
    monos.push({ x, y: -56 + h * 0.5, z, w, h });
  }

  const monoInst = new THREE.InstancedMesh(pillarGeo, pillarMat, monos.length);
  const stripInst = new THREE.InstancedMesh(stripGeo, stripMat, monos.length);
  const dummy = new THREE.Object3D();

  monos.forEach((m, idx) => {
    dummy.position.set(m.x, m.y, m.z);
    dummy.rotation.set(0, rand() * Math.PI * 0.25, 0);
    dummy.scale.set(m.w, m.h, m.w);
    dummy.updateMatrix();
    monoInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(m.x, m.y + m.h * 0.14, m.z);
    dummy.scale.set(m.w, 1.4, m.w);
    dummy.updateMatrix();
    stripInst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(monoInst, stripInst);

  // Giant spinning industrial ventilation turbines mounted cleanly HIGH overhead in the cavern
  const ringGeo = new THREE.TorusGeometry(21, 1.1, 10, 32);
  const bladeGeo = new THREE.BoxGeometry(38, 2.0, 0.5);
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.8,
    roughness: 0.3,
  });
  disposables.push(ringGeo, bladeGeo, steelMat);

  for (const t of [0.30, 0.72]) {
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const hub = new THREE.Group();
    hub.position.copy(f.pos).addScaledVector(f.up, 44);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate());
    hub.quaternion.setFromRotationMatrix(basis);

    const frameRing = new THREE.Mesh(ringGeo, steelMat);
    const rotor = new THREE.Group();
    const b1 = new THREE.Mesh(bladeGeo, steelMat);
    const b2 = new THREE.Mesh(bladeGeo, steelMat);
    b2.rotation.z = Math.PI / 3;
    const b3 = new THREE.Mesh(bladeGeo, steelMat);
    b3.rotation.z = (Math.PI * 2) / 3;
    rotor.add(b1, b2, b3);
    hub.add(frameRing, rotor);
    group.add(hub);
    animatedFans.push(rotor);
  }
}
