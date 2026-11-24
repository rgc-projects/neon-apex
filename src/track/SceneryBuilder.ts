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
 * Modern Photorealistic Scenery Builder for all circuits:
 * - city: Multi-tier architectural glass skyscrapers, concrete viaduct piers & Tokyo Bay dark water
 * - bridge: Animated normal-mapped golden-dusk ocean, A-frame concrete/steel cable-stayed towers & harbor skyline
 * - tunnel: Curved concrete arch highway tunnel vault, ceiling linear LEDs & jet ventilation fans
 * - mountain: Real sculpted 3D FBM terrain ridges, 520+ instanced layered pine trees & vermilion Torii gates
 * - island: 11.9km Grand Island multi-biome world (volcanic massif, Pacific ocean, twin suspension bridge towers,
 *           harbor skyline, cedar forest + Torii gates, vaulted mountain tunnel & rotating coastal lighthouse!)
 * - manx: 17.2km Isle of Man TT Snaefell Mountain Course (emerald rolling hills, purple-heather moorland,
 *         Douglas TT Grandstand & Timing Tower, whitewashed Manx cottages, Ballaugh stone bridge, Creg-ny-Baa pub,
 *         broadleaf lowland valleys & wild tree-free Snaefell summit!)
 */
export function buildScenery(spline: TrackSpline): SceneryBuildResult {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const cfg = spline.config;
  const rand = createSeededRandom(cfg.id.length * 9137 + 109);

  // Compute track horizontal center for large-world ocean/sky alignment
  let tMinX = Infinity, tMaxX = -Infinity, tMinZ = Infinity, tMaxZ = -Infinity;
  for (let i = 0; i < spline.sampleCount; i += 4) {
    const p = spline.samples[i].pos;
    if (p.x < tMinX) tMinX = p.x;
    if (p.x > tMaxX) tMaxX = p.x;
    if (p.z < tMinZ) tMinZ = p.z;
    if (p.z > tMaxZ) tMaxZ = p.z;
  }
  const trackCenterX = (tMinX + tMaxX) * 0.5;
  const trackCenterZ = (tMinZ + tMaxZ) * 0.5;

  // 1. Photorealistic Atmospheric Sky Dome (natural clouds, twilight scattering & subtle stars)
  const isMegaSea = cfg.theme === 'island' || cfg.theme === 'manx';
  const isDusk = cfg.theme === 'bridge' || isMegaSea;
  const skyTex = createRealisticSkyTexture(
    cfg.skyTopHex,
    cfg.skyMidHex,
    cfg.skyHorizonHex,
    cfg.sunColorHex,
    isDusk
  );
  const skyRadius = cfg.theme === 'manx' ? 7200 : cfg.theme === 'island' ? 3900 : 3200;
  const skyGeo = new THREE.SphereGeometry(skyRadius, 48, 28);
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
  if (cfg.theme === 'manx') {
    oceanNormal.repeat.set(280, 280);
  } else if (cfg.theme === 'island') {
    oceanNormal.repeat.set(95, 95);
  }
  disposables.push(oceanNormal);

  const groundSpan = cfg.theme === 'manx' ? 44000 : cfg.theme === 'island' ? 14000 : 7600;
  const groundGeo = new THREE.PlaneGeometry(groundSpan, groundSpan);
  groundGeo.rotateX(-Math.PI / 2);

  let groundMat: THREE.MeshStandardMaterial;
  if (cfg.theme === 'bridge' || cfg.theme === 'city' || isMegaSea) {
    const isOcean = cfg.theme === 'bridge' || isMegaSea;
    groundMat = new THREE.MeshStandardMaterial({
      color:
        cfg.theme === 'manx'
          ? 0x0e2538
          : cfg.theme === 'island'
            ? 0x0b243c
            : cfg.theme === 'bridge'
              ? 0x0d223a
              : 0x070f1c,
      normalMap: oceanNormal,
      normalScale: new THREE.Vector2(
        cfg.theme === 'manx' ? 0.72 : isOcean ? 0.82 : 0.45,
        cfg.theme === 'manx' ? 0.72 : isOcean ? 0.82 : 0.45
      ),
      roughness: cfg.theme === 'manx' ? 0.28 : isOcean ? 0.23 : 0.36,
      metalness: cfg.theme === 'manx' ? 0.48 : isOcean ? 0.54 : 0.35,
      envMapIntensity: cfg.theme === 'manx' ? 1.0 : isOcean ? 1.15 : 0.65,
    });
  } else {
    groundMat = new THREE.MeshStandardMaterial({
      color: cfg.theme === 'mountain' ? 0x0c1317 : 0x0b0f17,
      roughness: 0.92,
      metalness: 0.05,
    });
  }
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.position.set(
    isMegaSea ? trackCenterX : 0,
    cfg.theme === 'bridge' || isMegaSea
      ? -2
      : cfg.theme === 'tunnel'
        ? -56
        : cfg.theme === 'mountain'
          ? -18
          : -22,
    isMegaSea ? trackCenterZ : 0
  );
  group.add(groundPlane);
  disposables.push(groundGeo, groundMat);

  // 3. Concrete Highway Arch Tunnel Vaults (for tunnel zones!)
  if (cfg.tunnelZones.length > 0) {
    buildRealisticConcreteTunnel(spline, group, disposables);
  }

  // 4. Realistic Concrete Viaduct Support Piers with Bank-Aligned T-Cap Crossbeams (Zero road clipping!)
  if (
    cfg.theme === 'city' ||
    cfg.theme === 'bridge' ||
    cfg.theme === 'mountain' ||
    cfg.theme === 'island' ||
    cfg.theme === 'manx'
  ) {
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
  const animatedBeacons: THREE.Object3D[] = [];

  if (cfg.theme === 'city') {
    buildRealisticCitySkyline(spline, group, disposables, rand, groundPlane.position.y);
  } else if (cfg.theme === 'bridge') {
    buildRealisticSuspensionBridge(spline, group, disposables, rand, groundPlane.position.y);
  } else if (cfg.theme === 'mountain') {
    buildRealisticMountainPass(spline, group, disposables, rand, groundPlane.position.y);
  } else if (cfg.theme === 'island') {
    buildGrandIslandWorld(spline, group, disposables, rand, groundPlane.position.y, animatedBeacons);
  } else if (cfg.theme === 'manx') {
    buildIsleOfManWorld(spline, group, disposables, rand, groundPlane.position.y, animatedBeacons);
  } else {
    buildRealisticSubterraneanCavern(spline, group, disposables, rand, animatedFans);
  }

  return {
    group,
    update: (dt: number, elapsed: number, camPos: THREE.Vector3) => {
      skyDome.position.set(camPos.x, 0, camPos.z);
      if (cfg.theme === 'bridge' || cfg.theme === 'city' || isMegaSea) {
        oceanNormal.offset.y += dt * 0.08;
        oceanNormal.offset.x = Math.sin(elapsed * 0.25) * 0.08;
      }
      for (const fan of animatedFans) {
        fan.rotation.z += dt * 7.5;
      }
      for (const beacon of animatedBeacons) {
        beacon.rotation.y += dt * 0.85;
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
  const segs = 22;

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
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 4.5, 8);
  const foliageGeo1 = new THREE.ConeGeometry(3.4, 8.0, 12);
  const foliageGeo2 = new THREE.ConeGeometry(2.6, 7.0, 12);
  const foliageGeo3 = new THREE.ConeGeometry(1.7, 5.5, 12);

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

/**
 * Grand Island Multi-Biome World (11.9km Ultimate Loop):
 * - Sculpted 3D central volcanic island massif & coastal cliffs (strictly carved >=9.5m below roadbed!)
 * - Twin 150m cable-stayed suspension bridge towers over the North Strait
 * - Illuminated West Harbor coastal skyscraper skyline
 * - 660 instanced layered cedar/pine mountain forest trees + 4 vermilion Torii summit gates
 * - Animated 64m coastal headland Lighthouse with rotating volumetric sunset searchlight beams
 */
function buildGrandIslandWorld(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number,
  animatedBeacons: THREE.Object3D[]
): void {
  // 1. Sculpted 3D Central Volcanic Island Massif & Headlands
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }
  const margin = 240;
  const widthX = maxX - minX + margin * 2;
  const depthZ = maxZ - minZ + margin * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const segX = 164;
  const segZ = 164;
  const terrainGeo = new THREE.PlaneGeometry(widthX, depthZ, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);

  const fbm = (x: number, z: number): number => {
    const n1 = Math.sin(x * 0.0024 + 0.9) * Math.cos(z * 0.0022 - 0.6);
    const n2 = Math.sin(x * 0.0058 - z * 0.0049 + 2.1) * 0.5;
    const n3 = Math.cos(x * 0.0125 + z * 0.0112) * 0.24;
    return (n1 + n2 + n3) * 0.5 + 0.5; // ~0..1
  };

  // Pre-downsample spline samples (~13m spacing) for fast, exact zero-clipping roadbed carving
  const coarseSamples: { x: number; y: number; z: number; bankDrop: number }[] = [];
  for (let i = 0; i < spline.sampleCount; i += 5) {
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
  const roadClearance = spline.halfWidth + 32; // 46.5m full clearance buffer

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) + centerX;
    const vz = posAttr.getZ(i) + centerZ;

    // Organic central island landmass mask (open Pacific ocean outside perimeter + open North Bridge Strait!)
    const coastNoise = (fbm(vx * 0.65, vz * 0.65) - 0.5) * 0.28;
    const u = (vx - 1260) / 1180;
    const v = (vz - -110) / 1320;
    const rad = Math.sqrt(u * u + v * v) + coastNoise;
    let landMask = smoothstep(1.06, 0.62, rad);

    // Keep North Strait Bridge Channel & West Harbor outer ocean wide open!
    const bridgeStraitCut = smoothstep(820, 420, vx) * smoothstep(-620, -960, vz);
    const westOceanCut = smoothstep(220, -40, vx);
    landMask *= (1 - bridgeStraitCut * 0.96) * (1 - westOceanCut * 0.92);

    // Towering Central Volcanic Peak + Northeast Mountain Massif right beside Sector 3!
    const peakDist = Math.hypot((vx - 1340) / 720, (vz - -520) / 680);
    const volcanicPeak = Math.pow(smoothstep(1.25, 0.0, peakDist), 1.65) * 235;
    const ridgeNoise = fbm(vx, vz);

    const rawIslandY =
      waterY - 14 + landMask * (26 + ridgeNoise * 108 + volcanicPeak);

    // Nearest road sample with fast bounding-box pre-rejection
    let minD2 = Infinity;
    let nearestY = waterY + 20;
    let nearestBankDrop = 0;
    for (let k = 0; k < coarseSamples.length; k++) {
      const p = coarseSamples[k];
      const dx = vx - p.x;
      if (dx > 180 || dx < -180) continue;
      const dz = vz - p.z;
      if (dz > 180 || dz < -180) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD2) {
        minD2 = d2;
        nearestY = p.y;
        nearestBankDrop = p.bankDrop;
      }
    }

    let finalY = rawIslandY;
    if (minD2 < 170 * 170) {
      const dist = Math.sqrt(minD2);
      const blend = smoothstep(roadClearance, roadClearance + 95, dist);
      // Use Math.min so ocean channels stay submerged while mountain slopes carve cleanly >=9.5m below roadbed!
      const carvedY = Math.min(rawIslandY, nearestY - nearestBankDrop - 9.5);
      finalY = carvedY * (1 - blend) + rawIslandY * blend;
    }

    posAttr.setXYZ(i, vx, finalY, vz);

    // Rich Pacific volcanic island coastal-to-alpine vertex shading
    const elev = finalY - waterY;
    const grain = ((Math.sin(vx * 0.11) * Math.cos(vz * 0.11)) * 0.5 + 0.5) * 0.025;
    if (elev < 1.5) {
      col.setRGB(0.03 + grain * 0.4, 0.09 + grain * 0.6, 0.12 + grain * 0.8); // coastal reef sand
    } else if (elev < 24) {
      col.setRGB(0.08 + grain, 0.09 + grain * 0.8, 0.075 + grain * 0.6); // twilight limestone shore
    } else if (elev < 115) {
      col.setRGB(0.025 + grain * 0.6, 0.068 + grain, 0.044 + grain * 0.6); // lush dark cedar slopes
    } else {
      col.setRGB(0.065 + grain, 0.062 + grain, 0.078 + grain); // volcanic basalt summit crags
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const islandTex = createConcreteTexture();
  islandTex.repeat.set(64, 64);
  const islandMat = new THREE.MeshStandardMaterial({
    map: islandTex,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.03,
    envMapIntensity: 0.2,
  });
  group.add(new THREE.Mesh(terrainGeo, islandMat));
  disposables.push(islandTex, terrainGeo, islandMat);

  // 2. Twin Colossal 150m Cable-Stayed Suspension Bridge Towers (Sector 2 North Strait!)
  const concreteTex = createConcreteTexture();
  const towerMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xdbe4ef,
    metalness: 0.26,
    roughness: 0.58,
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
    color: new THREE.Color(0xfff1d6).multiplyScalar(1.35),
    toneMapped: false,
  });
  const legGeo = new THREE.BoxGeometry(4.2, 152, 5.2);
  const braceGeo = new THREE.BoxGeometry(spline.roadWidth + 12, 3.8, 3.6);
  const beaconGeo = new THREE.SphereGeometry(1.8, 10, 10);
  const cableGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6);
  const lightBarGeo = new THREE.BoxGeometry(spline.roadWidth + 10, 0.45, 3.9);
  disposables.push(concreteTex, towerMat, cableMat, aviationRed, archGlow, legGeo, braceGeo, beaconGeo, cableGeo, lightBarGeo);

  for (const pt of [0.095, 0.132]) {
    const f = spline.getFrameAtDistance(pt * spline.totalLength);
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(f.pos.x, waterY, f.pos.z);
    const basis = new THREE.Matrix4().makeBasis(f.flatRight, new THREE.Vector3(0, 1, 0), f.tangent.clone().negate());
    pylonGroup.quaternion.setFromRotationMatrix(basis);

    const halfSpan = spline.halfWidth + 4.2;
    const leftLeg = new THREE.Mesh(legGeo, towerMat);
    leftLeg.position.set(-halfSpan, 76, 0);
    const rightLeg = new THREE.Mesh(legGeo, towerMat);
    rightLeg.position.set(halfSpan, 76, 0);

    const brace1 = new THREE.Mesh(braceGeo, towerMat);
    brace1.position.set(0, 58, 0);
    const brace2 = new THREE.Mesh(braceGeo, towerMat);
    brace2.position.set(0, 112, 0);
    const brace3 = new THREE.Mesh(braceGeo, towerMat);
    brace3.position.set(0, 148, 0);

    const lightBar = new THREE.Mesh(lightBarGeo, archGlow);
    lightBar.position.set(0, 112, 0);

    const b1 = new THREE.Mesh(beaconGeo, aviationRed);
    b1.position.set(-halfSpan, 154, 0);
    const b2 = new THREE.Mesh(beaconGeo, aviationRed);
    b2.position.set(halfSpan, 154, 0);

    pylonGroup.add(leftLeg, rightLeg, brace1, brace2, brace3, lightBar, b1, b2);

    const deckY = f.pos.y - waterY + 1.2;
    for (const side of [-1, 1]) {
      for (let c = 1; c <= 8; c++) {
        for (const dir of [-1, 1]) {
          const topPt = new THREE.Vector3(side * halfSpan, 82 + c * 8.2, 0);
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

  // 3. West Harbor Waterfront Skyscraper Skyline (Sector 1 & 6 Marina District)
  const bldgPBR = createBuildingPBRTextures();
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgPBR.map,
    emissive: 0xffe4b5,
    emissiveMap: bldgPBR.emissiveMap,
    emissiveIntensity: 0.92,
    roughness: 0.24,
    metalness: 0.7,
    envMapIntensity: 1.35,
  });
  const roofCapMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.45,
  });
  const spireGeo = new THREE.CylinderGeometry(0.18, 0.45, 22, 6);
  const bBeaconGeo = new THREE.SphereGeometry(0.95, 8, 8);
  disposables.push(bldgPBR.map, bldgPBR.emissiveMap, bldgGeo, bldgMat, roofCapMat, spireGeo, bBeaconGeo);

  const cityPlacements: { x: number; z: number; w: number; d: number; h: number; tall: boolean }[] = [];
  let cityAttempts = 0;
  while (cityPlacements.length < 145 && cityAttempts < 1800) {
    cityAttempts++;
    const x = 120 + rand() * 980;
    const z = -480 + rand() * 980;
    const dist = spline.minHorizontalDistanceToTrack(x, z);
    const w = 26 + rand() * 44;
    const d = 26 + rand() * 44;
    if (dist < spline.halfWidth + Math.max(w, d) * 0.78 + 26) continue;
    const h = dist > 180 ? 88 + rand() * 210 : 52 + rand() * 120;
    cityPlacements.push({ x, z, w, d, h, tall: h > 165 });
  }

  const mainInst = new THREE.InstancedMesh(bldgGeo, bldgMat, cityPlacements.length);
  const setbackInst = new THREE.InstancedMesh(bldgGeo, bldgMat, cityPlacements.length);
  const mechInst = new THREE.InstancedMesh(bldgGeo, roofCapMat, cityPlacements.length);
  const spireInst = new THREE.InstancedMesh(spireGeo, roofCapMat, cityPlacements.length);
  const bBeaconInst = new THREE.InstancedMesh(bBeaconGeo, aviationRed, cityPlacements.length);

  const dummy = new THREE.Object3D();
  let spireCount = 0;
  cityPlacements.forEach((b, i) => {
    dummy.position.set(b.x, waterY + b.h * 0.5, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    mainInst.setMatrixAt(i, dummy.matrix);

    const tierH = b.h * 0.24;
    dummy.position.set(b.x, waterY + b.h + tierH * 0.5, b.z);
    dummy.scale.set(b.w * 0.68, tierH, b.d * 0.68);
    dummy.updateMatrix();
    setbackInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(b.x, waterY + b.h + tierH + 3.2, b.z);
    dummy.scale.set(b.w * 0.36, 6.4, b.d * 0.36);
    dummy.updateMatrix();
    mechInst.setMatrixAt(i, dummy.matrix);

    if (b.tall) {
      const topY = waterY + b.h + tierH + 6.4;
      dummy.position.set(b.x, topY + 11, b.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      spireInst.setMatrixAt(spireCount, dummy.matrix);

      dummy.position.set(b.x, topY + 22.5, b.z);
      dummy.updateMatrix();
      bBeaconInst.setMatrixAt(spireCount, dummy.matrix);
      spireCount++;
    }
  });
  spireInst.count = spireCount;
  bBeaconInst.count = spireCount;
  group.add(mainInst, setbackInst, mechInst, spireInst, bBeaconInst);

  // 4. 660 Pacific Cedar/Pine Forest Trees + 4 Traditional Vermilion Torii Gates (Sector 3 Mountain Pass!)
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 4.5, 8);
  const fol1Geo = new THREE.ConeGeometry(3.4, 8.0, 10);
  const fol2Geo = new THREE.ConeGeometry(2.6, 7.0, 10);
  const fol3Geo = new THREE.ConeGeometry(1.7, 5.5, 10);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.95, envMapIntensity: 0.2 });
  const pineDark = new THREE.MeshStandardMaterial({ color: 0x0b241a, roughness: 0.92, envMapIntensity: 0.22 });
  const pineMid = new THREE.MeshStandardMaterial({ color: 0x123526, roughness: 0.9, envMapIntensity: 0.22 });
  disposables.push(trunkGeo, fol1Geo, fol2Geo, fol3Geo, trunkMat, pineDark, pineMid);

  const trees: { x: number; y: number; z: number; s: number }[] = [];
  const mountainStartIdx = Math.floor(spline.sampleCount * 0.23);
  const mountainEndIdx = Math.floor(spline.sampleCount * 0.52);

  for (let i = 0; i < 3200 && trees.length < 660; i++) {
    const sampleIdx = mountainStartIdx + Math.floor(rand() * (mountainEndIdx - mountainStartIdx));
    const sample = spline.samples[sampleIdx];
    const side = rand() > 0.42 ? 1 : -1;
    const offset = spline.halfWidth + 11 + rand() * 72;
    const tx = sample.pos.x + sample.flatRight.x * side * offset + (rand() - 0.5) * 16;
    const tz = sample.pos.z + sample.flatRight.z * side * offset + (rand() - 0.5) * 16;
    if (spline.minHorizontalDistanceToTrack(tx, tz) < spline.halfWidth + 11.5) continue;
    const ty = sample.pos.y - 5.5 + (rand() - 0.3) * 8;
    if (ty < waterY + 5) continue; // Keep trees strictly on land above shoreline
    trees.push({ x: tx, y: ty, z: tz, s: 0.85 + rand() * 1.15 });
  }

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const fol1Inst = new THREE.InstancedMesh(fol1Geo, pineDark, trees.length);
  const fol2Inst = new THREE.InstancedMesh(fol2Geo, pineMid, trees.length);
  const fol3Inst = new THREE.InstancedMesh(fol3Geo, pineDark, trees.length);

  trees.forEach((tr, i) => {
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(tr.s);

    dummy.position.set(tr.x, tr.y + 2.2 * tr.s, tr.z);
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

  // 4 Traditional Vermilion Mountain Torii Gates framing the Volcanic Pass
  const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.52, metalness: 0.1 });
  const blackEaveMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.2 });
  const warmLanternMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd28a).multiplyScalar(1.45),
    toneMapped: false,
  });
  const tLegGeo = new THREE.CylinderGeometry(0.65, 0.8, 14.5, 10);
  const kasagiGeo = new THREE.BoxGeometry(spline.roadWidth + 10.5, 1.1, 1.6);
  const capEaveGeo = new THREE.BoxGeometry(spline.roadWidth + 11.4, 0.45, 1.9);
  const nukiGeo = new THREE.BoxGeometry(spline.roadWidth + 6.0, 0.72, 1.0);
  const lanternGeo = new THREE.BoxGeometry(0.65, 1.1, 0.65);
  disposables.push(vermilionMat, blackEaveMat, warmLanternMat, tLegGeo, kasagiGeo, capEaveGeo, nukiGeo, lanternGeo);

  const basis = new THREE.Matrix4();
  const hw = spline.halfWidth + 2.2;
  for (const t of [0.285, 0.365, 0.435, 0.495]) {
    if (spline.isInTunnel(t)) continue;
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const gate = new THREE.Group();
    gate.position.copy(f.pos);
    basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
    gate.quaternion.setFromRotationMatrix(basis);

    const lL = new THREE.Mesh(tLegGeo, vermilionMat);
    lL.position.set(-hw, 7.25, 0);
    const lR = new THREE.Mesh(tLegGeo, vermilionMat);
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

  // 5. Iconic Animated Coastal Headland Lighthouse overlooking Sector 5's Turn 9 Peninsula!
  const lhFrame = spline.getFrameAtDistance(0.757 * spline.totalLength);
  // Place cleanly 76m off the outer oceanward side of the Lighthouse Hairpin apex
  const lhPos = lhFrame.pos.clone().addScaledVector(lhFrame.flatRight, -76);
  if (spline.minHorizontalDistanceToTrack(lhPos.x, lhPos.z) >= spline.halfWidth + 32) {
    const lhGroup = new THREE.Group();
    lhGroup.position.set(lhPos.x, waterY, lhPos.z);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x262e36, roughness: 0.94, metalness: 0.04 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55, metalness: 0.08 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48, metalness: 0.12 });
    const glassLampMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff3c4).multiplyScalar(2.4),
      toneMapped: false,
    });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const rockGeo = new THREE.CylinderGeometry(16, 26, 16, 12);
    const seg1Geo = new THREE.CylinderGeometry(5.6, 6.8, 16, 18);
    const seg2Geo = new THREE.CylinderGeometry(4.8, 5.6, 14, 18);
    const seg3Geo = new THREE.CylinderGeometry(4.1, 4.8, 14, 18);
    const seg4Geo = new THREE.CylinderGeometry(3.6, 4.1, 12, 18);
    const galleryGeo = new THREE.CylinderGeometry(5.4, 5.0, 1.4, 18);
    const lanternGlassGeo = new THREE.CylinderGeometry(3.1, 3.1, 5.8, 16);
    const roofGeo = new THREE.ConeGeometry(4.2, 6.2, 16);
    const beamGeo = new THREE.ConeGeometry(18, 220, 18, 1, true);
    beamGeo.translate(0, -110, 0);
    beamGeo.rotateX(Math.PI / 2);

    disposables.push(
      rockMat, whiteMat, redMat, glassLampMat, beamMat,
      rockGeo, seg1Geo, seg2Geo, seg3Geo, seg4Geo, galleryGeo, lanternGlassGeo, roofGeo, beamGeo
    );

    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.y = 8;
    const s1 = new THREE.Mesh(seg1Geo, whiteMat);
    s1.position.y = 22;
    const s2 = new THREE.Mesh(seg2Geo, redMat);
    s2.position.y = 37;
    const s3 = new THREE.Mesh(seg3Geo, whiteMat);
    s3.position.y = 51;
    const s4 = new THREE.Mesh(seg4Geo, redMat);
    s4.position.y = 64;
    const gallery = new THREE.Mesh(galleryGeo, blackEaveMat);
    gallery.position.y = 70.6;
    const lantern = new THREE.Mesh(lanternGlassGeo, glassLampMat);
    lantern.position.y = 74.2;
    const roof = new THREE.Mesh(roofGeo, redMat);
    roof.position.y = 80.2;

    // Rotating dual volumetric coastal searchlight beams
    const beaconPivot = new THREE.Group();
    beaconPivot.position.y = 74.2;
    const beamA = new THREE.Mesh(beamGeo, beamMat);
    const beamB = new THREE.Mesh(beamGeo, beamMat);
    beamB.rotation.y = Math.PI;
    beaconPivot.add(beamA, beamB);
    animatedBeacons.push(beaconPivot);

    lhGroup.add(rock, s1, s2, s3, s4, gallery, lantern, roof, beaconPivot);
    group.add(lhGroup);
  }
}

/**
 * Authentic Isle of Man TT Snaefell Mountain Course World (17.25km / 37.73-mile tribute):
 * - 3D sculpted emerald rolling Manx pastures, windswept golden-gorse & purple-heather moorland + 350m Snaefell peak
 * - Iconic Douglas TT Grandstand, pit-lane garages & Manx crimson/white Timing Tower at Glencrutchery Road
 * - Historic Ballaugh Bridge weathered stone arch parapets flanking the flying humpback jump
 * - 240 instanced whitewashed Manx cottages with dark slate roofs & glowing windows + Creg-ny-Baa Pub landmark
 * - 720 rounded broadleaf British lowland valley trees (leaving the A18 Snaefell Mountain authentically tree-free!)
 * - Classic black-and-white Manx coastal lighthouse overlooking Ramsey Bay
 */
function buildIsleOfManWorld(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number,
  animatedBeacons: THREE.Object3D[]
): void {
  // 1. Dual-Layer 60.7km Isle of Man 3D Terrain:
  //    Layer A: Curvature-safe 12m-resolution Roadside Rolling Hills Ribbon along ALL 60.7km (0% clipping by construction!)
  //    Layer B: Macro 240x240 Whole-Island Massif + 621m Snaefell Peak carved generously >=14.5m below road corridors!
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }
  const spanX = Math.max(maxX - minX, 1000);
  const spanZ = Math.max(maxZ - minZ, 1000);
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const rx = spanX * 0.54;
  const rz = spanZ * 0.54;
  // Snaefell summit sits in the eastern-central uplands beside A18 Mountain Road!
  const snaefellX = centerX + spanX * 0.25;
  const snaefellZ = centerZ + spanZ * 0.04;
  const westHillsX = centerX - spanX * 0.30;
  const westHillsZ = centerZ - spanZ * 0.12;
  const scaleFactor = spanX / 7500;

  const fbm = (x: number, z: number): number => {
    const f = 1 / Math.max(scaleFactor, 0.75);
    const n1 = Math.sin(x * 0.0012 * f + 0.7) * Math.cos(z * 0.0011 * f - 0.5);
    const n2 = Math.sin(x * 0.0031 * f - z * 0.0027 * f + 1.8) * 0.5;
    const n3 = Math.cos(x * 0.0074 * f + z * 0.0068 * f) * 0.22;
    return (n1 + n2 + n3) * 0.5 + 0.5;
  };

  const computeRawManxY = (vx: number, vz: number): number => {
    const coastNoise = (fbm(vx * 0.55, vz * 0.55) - 0.5) * 0.22;
    const u = (vx - centerX) / rx;
    const v = (vz - centerZ) / rz;
    const rad = Math.sqrt(u * u + v * v) + coastNoise;
    const landMask = smoothstep(1.08, 0.74, rad);

    const sDist = Math.hypot((vx - snaefellX) / (spanX * 0.25), (vz - snaefellZ) / (spanZ * 0.26));
    const snaefellMassif = Math.pow(smoothstep(1.25, 0.0, sDist), 1.55) * 485;
    const wDist = Math.hypot((vx - westHillsX) / (spanX * 0.22), (vz - westHillsZ) / (spanZ * 0.24));
    const westHills = Math.pow(smoothstep(1.2, 0.0, wDist), 1.6) * 145;
    const ridgeNoise = fbm(vx, vz);

    return waterY - 18 + landMask * (28 + ridgeNoise * 92 + snaefellMassif + westHills);
  };

  const col = new THREE.Color();
  const shadeManx = (vx: number, vz: number, finalY: number, outArr: Float32Array | number[], baseIdx: number) => {
    const elev = finalY - waterY;
    const grain = ((Math.sin(vx * 0.055) * Math.cos(vz * 0.055)) * 0.5 + 0.5) * 0.028;
    const hedgerowPatch = ((Math.sin(vx * 0.011) * Math.sin(vz * 0.011)) * 0.5 + 0.5) * 0.032;
    if (elev < 2.0) {
      col.setRGB(0.035 + grain * 0.4, 0.068 + grain * 0.5, 0.082 + grain * 0.6);
    } else if (elev < 68) {
      col.setRGB(0.042 + grain * 0.6 + hedgerowPatch * 0.4, 0.138 + grain + hedgerowPatch, 0.052 + grain * 0.5);
    } else if (elev < 185) {
      const m = clamp((elev - 68) / 117, 0, 1);
      col.setRGB(
        0.075 + m * 0.058 + grain,
        0.118 - m * 0.028 + grain * 0.8,
        0.058 + m * 0.045 + grain * 0.8
      );
    } else {
      col.setRGB(0.092 + grain, 0.096 + grain, 0.108 + grain);
    }
    outArr[baseIdx] = col.r;
    outArr[baseIdx + 1] = col.g;
    outArr[baseIdx + 2] = col.b;
  };

  const manxGroundTex = createConcreteTexture();
  manxGroundTex.repeat.set(160, 160);
  const manxTerrainMat = new THREE.MeshStandardMaterial({
    map: manxGroundTex,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.02,
    envMapIntensity: 0.18,
  });
  disposables.push(manxGroundTex, manxTerrainMat);

  // Layer A: Curvature-safe High-Detail Roadside Rolling Hills Ribbon along ALL 60.7km!
  const ribStep = spline.sampleCount > 14000 ? 5 : 4;
  const ribIndices: number[] = [];
  for (let i = 0; i < spline.sampleCount; i += ribStep) ribIndices.push(i);
  const ribRows = ribIndices.length;
  const latProfile = [-135, -82, -46, -26, 0, 26, 46, 82, 135];
  const cols = latProfile.length;

  const ribVertCount = (ribRows + 1) * cols;
  const ribPos = new Float32Array(ribVertCount * 3);
  const ribCol = new Float32Array(ribVertCount * 3);
  const ribUv = new Float32Array(ribVertCount * 2);
  const ribIdx: number[] = [];

  for (let r = 0; r <= ribRows; r++) {
    const s = spline.samples[ribIndices[r % ribRows]];
    const bankDrop = spline.halfWidth * Math.sin(Math.abs(s.bank));
    const bedY = s.pos.y - bankDrop - 10.5;
    const absK = Math.abs(s.curvature);
    const turnSign = Math.sign(s.curvature); // >0 turning right => +lat is inside of curve
    const maxInsideSpan = absK > 0.002 ? Math.max(30, 0.72 / absK) : 135;
    const vUv = (r === ribRows ? spline.totalLength : s.s) / 90;

    for (let c = 0; c < cols; c++) {
      let lat = latProfile[c];
      // Prevent inner-wing self-folding on tight 180° hairpins!
      if (turnSign !== 0 && lat * turnSign > 0 && Math.abs(lat) > maxInsideSpan) {
        lat = Math.sign(lat) * maxInsideSpan;
      }
      const wx = s.pos.x + s.flatRight.x * lat;
      const wz = s.pos.z + s.flatRight.z * lat;

      const absLat = Math.abs(lat);
      let fy: number;
      if (absLat <= 28) {
        fy = Math.min(bedY, computeRawManxY(wx, wz));
      } else {
        const rawY = computeRawManxY(wx, wz);
        const wingBlend = smoothstep(28, 125, absLat);
        // Sculpt gentle rolling Manx hedgerow banks rising naturally from road shoulder
        const bankRise = Math.min(rawY, s.pos.y + (absLat - 28) * 0.28);
        fy = bedY * (1 - wingBlend) + bankRise * wingBlend;
        // Strict O(1) cross-road safety clamp: never poke near ANY adjacent road leg!
        const near = spline.getNearestRoadInfo(wx, wz, 130);
        if (near) {
          const safeCap = near.y - near.bankDrop - 10.5;
          const clrBlend = smoothstep(spline.halfWidth + 20, spline.halfWidth + 75, near.dist);
          fy = Math.min(fy, safeCap) * (1 - clrBlend) + fy * clrBlend;
        }
      }

      const vi = r * cols + c;
      ribPos[vi * 3] = wx;
      ribPos[vi * 3 + 1] = fy;
      ribPos[vi * 3 + 2] = wz;
      ribUv[vi * 2] = c / (cols - 1);
      ribUv[vi * 2 + 1] = vUv;
      shadeManx(wx, wz, fy, ribCol, vi * 3);
    }

    if (r < ribRows) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + cols;
        ribIdx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
  ribGeo.setAttribute('color', new THREE.BufferAttribute(ribCol, 3));
  ribGeo.setAttribute('uv', new THREE.BufferAttribute(ribUv, 2));
  ribGeo.setIndex(ribIdx);
  ribGeo.computeVertexNormals();
  group.add(new THREE.Mesh(ribGeo, manxTerrainMat));
  disposables.push(ribGeo);

  // Layer B: Macro 240x240 Whole-Island Massif + 621m Snaefell Summit (carved strictly >=14.5m below road!)
  const margin = 650;
  const widthX = spanX + margin * 2;
  const depthZ = spanZ + margin * 2;
  const segX = 240;
  const segZ = 240;
  const terrainGeo = new THREE.PlaneGeometry(widthX, depthZ, segX, segZ);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const macroClearance = Math.max(spline.halfWidth + 95, (widthX / segX) * 1.65);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i) + centerX;
    const vz = posAttr.getZ(i) + centerZ;
    const rawManxY = computeRawManxY(vx, vz);

    let finalY = rawManxY;
    const near = spline.getNearestRoadInfo(vx, vz, macroClearance + 145);
    if (near) {
      const blend = smoothstep(macroClearance, macroClearance + 140, near.dist);
      const carvedY = Math.min(rawManxY, near.y - near.bankDrop - 15.0);
      finalY = carvedY * (1 - blend) + rawManxY * blend;
    }

    posAttr.setXYZ(i, vx, finalY, vz);
    shadeManx(vx, vz, finalY, colors, i * 3);
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  group.add(new THREE.Mesh(terrainGeo, manxTerrainMat));
  disposables.push(terrainGeo);

  // Shared Manx Architectural Materials
  const whitewashMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.78, metalness: 0.04 });
  const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 0.68, metalness: 0.15 });
  const manxCrimsonMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.48, metalness: 0.14 });
  const darkIronMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52, metalness: 0.6 });
  const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0x625d55, roughness: 0.92, metalness: 0.05 });
  const warmWindowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffdfa0).multiplyScalar(1.35),
    toneMapped: false,
  });
  const racingGoldMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfacc15).multiplyScalar(1.35),
    toneMapped: false,
  });
  disposables.push(
    whitewashMat, slateRoofMat, manxCrimsonMat, darkIronMat, stoneWallMat, warmWindowMat, racingGoldMat
  );

  const basis = new THREE.Matrix4();

  // 2. Iconic Douglas TT Grandstand, Pit Garages & Manx Crimson-White Timing Tower (Glencrutchery Road, t=0.000!)
  const startF = spline.getFrameAtDistance(12);
  const gsGroup = new THREE.Group();
  gsGroup.position.copy(startF.pos);
  basis.makeBasis(startF.right, startF.up, startF.tangent.clone().negate());
  gsGroup.quaternion.setFromRotationMatrix(basis);

  const gsOffset = spline.halfWidth + 13.5;
  const gsBaseGeo = new THREE.BoxGeometry(11, 8.5, 68);
  const gsRoofGeo = new THREE.BoxGeometry(15.5, 1.2, 70);
  const gsFasciaGeo = new THREE.BoxGeometry(0.6, 1.8, 70.2);
  const gsLightGeo = new THREE.BoxGeometry(0.45, 0.45, 64);
  const gsPitGeo = new THREE.BoxGeometry(7.5, 4.8, 62);
  const towerBodyGeo = new THREE.BoxGeometry(7.2, 22, 7.2);
  const towerBandGeo = new THREE.BoxGeometry(7.6, 2.2, 7.6);
  const towerGlassGeo = new THREE.BoxGeometry(7.5, 3.6, 7.5);
  const towerRoofGeo = new THREE.BoxGeometry(8.6, 0.9, 8.6);
  disposables.push(
    gsBaseGeo, gsRoofGeo, gsFasciaGeo, gsLightGeo, gsPitGeo,
    towerBodyGeo, towerBandGeo, towerGlassGeo, towerRoofGeo
  );

  // Main covered spectator grandstand on right shoulder
  const gsBase = new THREE.Mesh(gsBaseGeo, slateRoofMat);
  gsBase.position.set(gsOffset + 3.5, 4.25, -8);
  const gsRoof = new THREE.Mesh(gsRoofGeo, darkIronMat);
  gsRoof.position.set(gsOffset + 1.5, 11.4, -8);
  const gsFascia = new THREE.Mesh(gsFasciaGeo, manxCrimsonMat);
  gsFascia.position.set(gsOffset - 6.1, 11.1, -8);
  const gsGlow = new THREE.Mesh(gsLightGeo, warmWindowMat);
  gsGlow.position.set(gsOffset - 5.2, 10.2, -8);
  const gsAccent = new THREE.Mesh(gsLightGeo, racingGoldMat);
  gsAccent.position.set(gsOffset - 6.3, 12.1, -8);

  // Opposite pit-lane garages & historic Douglas TT Timing Tower on left shoulder!
  const pitBlock = new THREE.Mesh(gsPitGeo, whitewashMat);
  pitBlock.position.set(-(gsOffset + 1.5), 2.4, -6);
  const pitRoof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.7, 63), slateRoofMat);
  pitRoof.position.set(-(gsOffset + 1.5), 5.1, -6);
  const pitStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 62.4), manxCrimsonMat);
  pitStripe.position.set(-(gsOffset - 2.3), 4.6, -6);
  disposables.push(pitRoof.geometry, pitStripe.geometry);

  const towerBody = new THREE.Mesh(towerBodyGeo, whitewashMat);
  towerBody.position.set(-(gsOffset + 2.5), 11, -36);
  const towerBand = new THREE.Mesh(towerBandGeo, manxCrimsonMat);
  towerBand.position.set(-(gsOffset + 2.5), 15.6, -36);
  const towerGlass = new THREE.Mesh(towerGlassGeo, warmWindowMat);
  towerGlass.position.set(-(gsOffset + 2.5), 19.2, -36);
  const towerRoof = new THREE.Mesh(towerRoofGeo, slateRoofMat);
  towerRoof.position.set(-(gsOffset + 2.5), 22.3, -36);

  gsGroup.add(
    gsBase, gsRoof, gsFascia, gsGlow, gsAccent,
    pitBlock, pitRoof, pitStripe,
    towerBody, towerBand, towerGlass, towerRoof
  );
  group.add(gsGroup);

  // 3. Historic Ballaugh Bridge Weathered Stone Parapets framing Jump Ramp #2 (t = 0.391..0.3926)
  const bbFrame = spline.getFrameAtDistance(0.3918 * spline.totalLength);
  const bbGroup = new THREE.Group();
  bbGroup.position.copy(bbFrame.pos);
  basis.makeBasis(bbFrame.right, bbFrame.up, bbFrame.tangent.clone().negate());
  bbGroup.quaternion.setFromRotationMatrix(basis);

  const parapetGeo = new THREE.BoxGeometry(1.1, 3.6, 94);
  const copingGeo = new THREE.BoxGeometry(1.4, 0.38, 95);
  const pierButtGeo = new THREE.BoxGeometry(3.2, 18, 4.2);
  disposables.push(parapetGeo, copingGeo, pierButtGeo);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(parapetGeo, stoneWallMat);
    wall.position.set(side * (spline.halfWidth + 1.55), 1.6, 0);
    const coping = new THREE.Mesh(copingGeo, whitewashMat);
    coping.position.set(side * (spline.halfWidth + 1.55), 3.55, 0);
    const butt = new THREE.Mesh(pierButtGeo, stoneWallMat);
    butt.position.set(side * (spline.halfWidth + 2.2), -8.5, 0);
    bbGroup.add(wall, coping, butt);
  }
  group.add(bbGroup);

  // 4. 560 Traditional Whitewashed Manx Cottages & Village Streetscapes + Iconic Creg-ny-Baa Pub!
  const cotWallGeo = new THREE.BoxGeometry(1, 1, 1);
  const cotRoofGeo = new THREE.ConeGeometry(0.76, 0.58, 4);
  cotRoofGeo.rotateY(Math.PI / 4);
  const cotWinGeo = new THREE.BoxGeometry(1.03, 0.16, 1.03);
  const cotChimGeo = new THREE.BoxGeometry(0.14, 0.38, 0.14);
  disposables.push(cotWallGeo, cotRoofGeo, cotWinGeo, cotChimGeo);

  // Town & village t-windows faithful to the 60.7km Isle of Man course
  const villageZones: [number, number][] = [
    [0.003, 0.055], // Douglas, Bray Hill & Quarterbridge
    [0.065, 0.168], // Braddan, Union Mills, Crosby & Ballacraine
    [0.328, 0.402], // Kirk Michael, Bishopscourt & Ballaugh Village
    [0.485, 0.588], // Sulby, Ginger Hall, Parliament Square & Ramsey Town
    [0.958, 0.996], // Signpost Corner, Governor's Bridge & Douglas
  ];

  const cottages: { x: number; y: number; z: number; w: number; h: number; d: number; rotY: number }[] = [];
  let cotAttempts = 0;
  while (cottages.length < 560 && cotAttempts < 6400) {
    cotAttempts++;
    const zone = villageZones[Math.floor(rand() * villageZones.length)];
    const t = zone[0] + rand() * (zone[1] - zone[0]);
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const w = 9 + rand() * 8;
    const d = 7.5 + rand() * 6.5;
    const h = 6.2 + rand() * 4.5;
    const offset = spline.halfWidth + 14 + Math.max(w, d) * 0.55 + rand() * 54;
    const cx = f.pos.x + f.flatRight.x * side * offset + (rand() - 0.5) * 18;
    const cz = f.pos.z + f.flatRight.z * side * offset + (rand() - 0.5) * 18;
    if (spline.minHorizontalDistanceToTrack(cx, cz) < spline.halfWidth + Math.max(w, d) * 0.72 + 10) continue;
    const cy = Math.max(waterY + 2, f.pos.y - 3.5 + (rand() - 0.5) * 3.0);
    const rotY = Math.atan2(f.tangent.x, f.tangent.z) + (rand() - 0.5) * 0.25;
    cottages.push({ x: cx, y: cy, z: cz, w, h, d, rotY });
  }

  const cotWallInst = new THREE.InstancedMesh(cotWallGeo, whitewashMat, cottages.length);
  const cotRoofInst = new THREE.InstancedMesh(cotRoofGeo, slateRoofMat, cottages.length);
  const cotWinInst = new THREE.InstancedMesh(cotWinGeo, warmWindowMat, cottages.length);
  const cotChimInst = new THREE.InstancedMesh(cotChimGeo, stoneWallMat, cottages.length);
  const dummy = new THREE.Object3D();

  cottages.forEach((c, idx) => {
    dummy.rotation.set(0, c.rotY, 0);

    dummy.position.set(c.x, c.y + c.h * 0.5, c.z);
    dummy.scale.set(c.w, c.h, c.d);
    dummy.updateMatrix();
    cotWallInst.setMatrixAt(idx, dummy.matrix);

    const roofH = c.h * 0.58;
    dummy.position.set(c.x, c.y + c.h + roofH * 0.5, c.z);
    dummy.scale.set(c.w * 1.12, roofH, c.d * 1.12);
    dummy.updateMatrix();
    cotRoofInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(c.x, c.y + c.h * 0.58, c.z);
    dummy.scale.set(c.w, c.h, c.d);
    dummy.updateMatrix();
    cotWinInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(c.x, c.y + c.h + roofH * 0.85, c.z);
    dummy.scale.set(c.w * 0.8, c.h, c.d * 0.8);
    dummy.updateMatrix();
    cotChimInst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(cotWallInst, cotRoofInst, cotWinInst, cotChimInst);

  // Iconic Creg-ny-Baa Pub Landmark perched overlooking the sweeping Creg-ny-Baa corner (t = 0.900)!
  const cnbFrame = spline.getFrameAtDistance(0.900 * spline.totalLength);
  const cnbPos = cnbFrame.pos.clone().addScaledVector(cnbFrame.flatRight, -38);
  if (spline.minHorizontalDistanceToTrack(cnbPos.x, cnbPos.z) >= spline.halfWidth + 16) {
    const pubGroup = new THREE.Group();
    pubGroup.position.set(cnbPos.x, cnbFrame.pos.y - 2.5, cnbPos.z);
    pubGroup.rotation.y = Math.atan2(cnbFrame.tangent.x, cnbFrame.tangent.z);

    const pBody = new THREE.Mesh(new THREE.BoxGeometry(24, 11.5, 13), whitewashMat);
    pBody.position.y = 5.75;
    const pRoof = new THREE.Mesh(new THREE.ConeGeometry(16, 6.5, 4), slateRoofMat);
    pRoof.rotation.y = Math.PI / 4;
    pRoof.scale.set(1.22, 1, 0.72);
    pRoof.position.y = 14.75;
    const pFascia = new THREE.Mesh(new THREE.BoxGeometry(24.4, 1.5, 13.4), manxCrimsonMat);
    pFascia.position.y = 9.8;
    const pWin1 = new THREE.Mesh(new THREE.BoxGeometry(24.3, 1.5, 13.3), warmWindowMat);
    pWin1.position.y = 6.8;
    const pWin2 = new THREE.Mesh(new THREE.BoxGeometry(24.3, 1.5, 13.3), warmWindowMat);
    pWin2.position.y = 3.2;
    disposables.push(pBody.geometry, pRoof.geometry, pFascia.geometry, pWin1.geometry, pWin2.geometry);
    pubGroup.add(pBody, pRoof, pFascia, pWin1, pWin2);
    group.add(pubGroup);
  }

  // 5. 1,600 Lush Rounded Broadleaf British Valley Trees (Lowlands ONLY — 18km A18 Snaefell Mountain stays wild & tree-free!)
  const trunkGeo = new THREE.CylinderGeometry(0.36, 0.58, 5.0, 7);
  const crownMainGeo = new THREE.DodecahedronGeometry(3.8, 1);
  const crownTopGeo = new THREE.DodecahedronGeometry(2.8, 1);

  const oakTrunkMat = new THREE.MeshStandardMaterial({ color: 0x332419, roughness: 0.95, envMapIntensity: 0.18 });
  const oakDeepMat = new THREE.MeshStandardMaterial({ color: 0x13381f, roughness: 0.9, envMapIntensity: 0.22 });
  const oakBrightMat = new THREE.MeshStandardMaterial({ color: 0x1d4d28, roughness: 0.88, envMapIntensity: 0.24 });
  disposables.push(trunkGeo, crownMainGeo, crownTopGeo, oakTrunkMat, oakDeepMat, oakBrightMat);

  const valleyTrees: { x: number; y: number; z: number; s: number }[] = [];
  const valleyStartIdx = Math.floor(spline.sampleCount * 0.045);
  const valleyEndIdx = Math.floor(spline.sampleCount * 0.582);
  for (let i = 0; i < 7800 && valleyTrees.length < 1600; i++) {
    const sampleIdx = valleyStartIdx + Math.floor(rand() * (valleyEndIdx - valleyStartIdx));
    const sample = spline.samples[sampleIdx];
    if (sample.pos.y > 90) continue; // Strictly lowland valleys (Braddan, Glen Helen, Kirk Michael, Sulby, Ramsey)
    const side = rand() > 0.5 ? 1 : -1;
    const offset = spline.halfWidth + 10.5 + rand() * 88;
    const tx = sample.pos.x + sample.flatRight.x * side * offset + (rand() - 0.5) * 18;
    const tz = sample.pos.z + sample.flatRight.z * side * offset + (rand() - 0.5) * 18;
    if (spline.minHorizontalDistanceToTrack(tx, tz) < spline.halfWidth + 11.0) continue;
    const ty = sample.pos.y - 4.8 + (rand() - 0.35) * 6;
    if (ty < waterY + 4) continue;
    valleyTrees.push({ x: tx, y: ty, z: tz, s: 0.85 + rand() * 1.15 });
  }

  const vTrunkInst = new THREE.InstancedMesh(trunkGeo, oakTrunkMat, valleyTrees.length);
  const vCrown1Inst = new THREE.InstancedMesh(crownMainGeo, oakDeepMat, valleyTrees.length);
  const vCrown2Inst = new THREE.InstancedMesh(crownTopGeo, oakBrightMat, valleyTrees.length);

  valleyTrees.forEach((tr, idx) => {
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(tr.s);

    dummy.position.set(tr.x, tr.y + 2.4 * tr.s, tr.z);
    dummy.updateMatrix();
    vTrunkInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tr.x, tr.y + 6.6 * tr.s, tr.z);
    dummy.scale.set(tr.s * 1.15, tr.s * 0.92, tr.s * 1.15);
    dummy.updateMatrix();
    vCrown1Inst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(tr.x + 1.1 * tr.s, tr.y + 9.4 * tr.s, tr.z - 0.8 * tr.s);
    dummy.scale.set(tr.s * 0.95, tr.s * 0.85, tr.s * 0.95);
    dummy.updateMatrix();
    vCrown2Inst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(vTrunkInst, vCrown1Inst, vCrown2Inst);

  // 6. Classic Black-and-White Manx Coastal Lighthouses (Peel West Coast, Ramsey Bay & Douglas Head!)
  const glassLampMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xfff4c2).multiplyScalar(2.4),
    toneMapped: false,
  });
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe49e,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rockGeo = new THREE.CylinderGeometry(15, 24, 15, 12);
  const towerGeo = new THREE.CylinderGeometry(3.8, 6.2, 54, 18);
  const blackBandGeo = new THREE.CylinderGeometry(4.6, 5.2, 13, 18);
  const lanternGeo = new THREE.CylinderGeometry(3.0, 3.0, 5.4, 16);
  const roofGeo = new THREE.ConeGeometry(4.0, 5.6, 16);
  const beamGeo = new THREE.ConeGeometry(18, 260, 18, 1, true);
  beamGeo.translate(0, -130, 0);
  beamGeo.rotateX(Math.PI / 2);
  disposables.push(glassLampMat, beamMat, rockGeo, towerGeo, blackBandGeo, lanternGeo, roofGeo, beamGeo);

  for (const [lhT, lhOffset] of [
    [0.335, -140],
    [0.580, -135],
    [0.975, -165],
  ] as const) {
    const f = spline.getFrameAtDistance(lhT * spline.totalLength);
    const lhPos = f.pos.clone().addScaledVector(f.flatRight, lhOffset);
    if (spline.minHorizontalDistanceToTrack(lhPos.x, lhPos.z) < spline.halfWidth + 45) continue;

    const lhGroup = new THREE.Group();
    lhGroup.position.set(lhPos.x, waterY, lhPos.z);

    const rock = new THREE.Mesh(rockGeo, stoneWallMat);
    rock.position.y = 7.5;
    const tower = new THREE.Mesh(towerGeo, whitewashMat);
    tower.position.y = 40;
    const band = new THREE.Mesh(blackBandGeo, darkIronMat);
    band.position.y = 43;
    const lantern = new THREE.Mesh(lanternGeo, glassLampMat);
    lantern.position.y = 69.5;
    const roof = new THREE.Mesh(roofGeo, darkIronMat);
    roof.position.y = 75.0;

    const beaconPivot = new THREE.Group();
    beaconPivot.position.y = 69.5;
    const bA = new THREE.Mesh(beamGeo, beamMat);
    const bB = new THREE.Mesh(beamGeo, beamMat);
    bB.rotation.y = Math.PI;
    beaconPivot.add(bA, bB);
    animatedBeacons.push(beaconPivot);

    lhGroup.add(rock, tower, band, lantern, roof, beaconPivot);
    group.add(lhGroup);
  }
}
