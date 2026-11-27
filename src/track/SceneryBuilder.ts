import * as THREE from 'three';
import { isMobileDevice } from '../settings/SettingsManager';
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
  const isMegaSea = cfg.theme === 'island' || cfg.theme === 'manx' || cfg.theme === 'fjord';
  const isDusk = cfg.theme === 'bridge' || isMegaSea || cfg.theme === 'nujiang';
  const skyTex = createRealisticSkyTexture(
    cfg.skyTopHex,
    cfg.skyMidHex,
    cfg.skyHorizonHex,
    cfg.sunColorHex,
    isDusk
  );
  const skyRadius =
    cfg.theme === 'manx'
      ? 7200
      : cfg.theme === 'akina'
        ? 5600
        : cfg.theme === 'island' || cfg.theme === 'fjord'
          ? 4200
          : 3200;
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

  // 2. Base Ground / Realistic Shimmering Ocean or Glacial Gorge River Plane
  const oceanNormal = createOceanNormalTexture();
  if (cfg.theme === 'manx') {
    oceanNormal.repeat.set(280, 280);
  } else if (cfg.theme === 'island' || cfg.theme === 'fjord') {
    oceanNormal.repeat.set(110, 110);
  } else if (cfg.theme === 'nujiang') {
    oceanNormal.repeat.set(70, 70);
  } else if (cfg.theme === 'akina') {
    oceanNormal.repeat.set(28, 28);
  }
  disposables.push(oceanNormal);

  const groundSpan =
    cfg.theme === 'manx'
      ? 44000
      : cfg.theme === 'akina'
        ? 22000
        : cfg.theme === 'island' || cfg.theme === 'fjord'
          ? 16000
          : 7600;
  const groundGeo = new THREE.PlaneGeometry(groundSpan, groundSpan);
  groundGeo.rotateX(-Math.PI / 2);

  let groundMat: THREE.MeshStandardMaterial;
  if (cfg.theme === 'bridge' || cfg.theme === 'city' || isMegaSea || cfg.theme === 'nujiang') {
    const isOcean = cfg.theme === 'bridge' || isMegaSea || cfg.theme === 'nujiang';
    groundMat = new THREE.MeshStandardMaterial({
      color:
        cfg.theme === 'fjord'
          ? 0x061b30
          : cfg.theme === 'nujiang'
            ? 0x0e5e68
            : cfg.theme === 'manx'
              ? 0x0e2538
              : cfg.theme === 'island'
                ? 0x0b243c
                : cfg.theme === 'bridge'
                  ? 0x0d223a
                  : 0x070f1c,
      normalMap: oceanNormal,
      normalScale: new THREE.Vector2(
        cfg.theme === 'nujiang' ? 0.92 : cfg.theme === 'manx' ? 0.72 : isOcean ? 0.82 : 0.45,
        cfg.theme === 'nujiang' ? 0.92 : cfg.theme === 'manx' ? 0.72 : isOcean ? 0.82 : 0.45
      ),
      roughness: cfg.theme === 'fjord' ? 0.24 : cfg.theme === 'nujiang' ? 0.26 : cfg.theme === 'manx' ? 0.30 : isOcean ? 0.28 : 0.46,
      metalness: cfg.theme === 'fjord' ? 0.55 : cfg.theme === 'nujiang' ? 0.40 : cfg.theme === 'manx' ? 0.46 : isOcean ? 0.50 : 0.28,
      envMapIntensity: cfg.theme === 'fjord' ? 1.15 : cfg.theme === 'nujiang' ? 1.0 : cfg.theme === 'manx' ? 0.95 : isOcean ? 0.98 : 0.48,
    });
  } else {
    groundMat = new THREE.MeshStandardMaterial({
      color: cfg.theme === 'mountain' || cfg.theme === 'akina' ? 0x0f171e : 0x0f1520,
      roughness: 0.92,
      metalness: 0.05,
    });
  }
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.position.set(
    isMegaSea || cfg.theme === 'nujiang' || cfg.theme === 'akina' ? trackCenterX : 0,
    cfg.theme === 'nujiang'
      ? 4
      : cfg.theme === 'fjord'
        ? 0
        : cfg.theme === 'bridge' || isMegaSea
          ? -2
          : cfg.theme === 'tunnel'
            ? -56
            : cfg.theme === 'akina'
              ? -14
              : cfg.theme === 'mountain'
                ? -18
                : -22,
    isMegaSea || cfg.theme === 'nujiang' || cfg.theme === 'akina' ? trackCenterZ : 0
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
    cfg.theme === 'manx' ||
    cfg.theme === 'nujiang' ||
    cfg.theme === 'fjord' ||
    cfg.theme === 'akina'
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
  const animatedFlags: { mesh: THREE.Object3D; phase: number }[] = [];
  const animatedAuroras: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];

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
  } else if (cfg.theme === 'nujiang') {
    buildNujiangGorgeWorld(spline, group, disposables, rand, groundPlane.position.y, animatedFlags);
  } else if (cfg.theme === 'fjord') {
    buildAuroraFjordWorld(
      spline,
      group,
      disposables,
      rand,
      groundPlane.position.y,
      animatedBeacons,
      animatedAuroras
    );
  } else if (cfg.theme === 'akina') {
    buildSuperAkinaWorld(spline, group, disposables, rand, groundPlane.position.y, oceanNormal);
  } else {
    buildRealisticSubterraneanCavern(spline, group, disposables, rand, animatedFans);
  }

  // Smart spatial chunk frustum culling: ONLY split triangle-heavy map-wide InstancedMeshes
  // (>= 36K total triangles) into a coarse 3x3 quadrant grid so Three.js skips 60-75% of heavy
  // off-screen forests/rocks behind the camera without exploding Draw Calls on lightweight boxes!
  chunkLargeInstancedMeshes(group);

  // Off-track mobile optimization: downgrade background buildings/trees/mountains/concrete
  // from heavy per-pixel PBR+PMREM to fast MeshLambertMaterial while keeping Hero Cars & Road 100% full PBR!
  if (isMobileDevice()) {
    optimizeOffTrackSceneryForMobile(group, disposables);
  }

  return {
    group,
    update: (dt: number, elapsed: number, camPos: THREE.Vector3) => {
      skyDome.position.set(camPos.x, 0, camPos.z);
      if (cfg.theme === 'bridge' || cfg.theme === 'city' || isMegaSea || cfg.theme === 'nujiang' || cfg.theme === 'akina') {
        oceanNormal.offset.y += dt * (cfg.theme === 'nujiang' ? 0.18 : cfg.theme === 'akina' ? 0.045 : 0.08);
        oceanNormal.offset.x = Math.sin(elapsed * 0.25) * 0.08;
      }
      for (const fan of animatedFans) {
        fan.rotation.z += dt * 7.5;
      }
      for (const beacon of animatedBeacons) {
        beacon.rotation.y += dt * 0.85;
      }
      for (const flag of animatedFlags) {
        flag.mesh.rotation.x = Math.sin(elapsed * 4.2 + flag.phase) * 0.22;
      }
      for (const aur of animatedAuroras) {
        aur.mesh.position.y = aur.baseY + Math.sin(elapsed * 0.45 + aur.phase) * 18;
        const mat = aur.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.65 + 0.18 * Math.sin(elapsed * 0.85 + aur.phase);
      }
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/**
 * Splits triangle-heavy map-wide InstancedMeshes (>= 36,000 total triangles) into a coarse
 * 3x3 spatial quadrant grid with tight bounding spheres. Lightweight box-based arrays (e.g.
 * 220 skyscrapers = 2.6K tris) stay as 1 single draw call instead of multiplying draw calls!
 */
function chunkLargeInstancedMeshes(root: THREE.Group): void {
  const candidates: THREE.InstancedMesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.InstancedMesh && obj.count >= 64) {
      const geo = obj.geometry;
      const triCount = geo.index
        ? geo.index.count / 3
        : (geo.getAttribute('position')?.count ?? 0) / 3;
      if (triCount * obj.count >= 36000) {
        candidates.push(obj);
      } else {
        obj.computeBoundingSphere();
      }
    }
  });

  const mat4 = new THREE.Matrix4();
  const color = new THREE.Color();

  for (const inst of candidates) {
    const parent = inst.parent;
    if (!parent) continue;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, mat4);
      const x = mat4.elements[12];
      const z = mat4.elements[14];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const span = Math.max(maxX - minX, maxZ - minZ);
    if (span < 900) {
      inst.computeBoundingSphere();
      continue;
    }
    const cellSize = Math.max(850, span / 3);
    const hasColors = inst.instanceColor !== null;
    const buckets = new Map<string, number[]>();

    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, mat4);
      const x = mat4.elements[12];
      const z = mat4.elements[14];
      const key = `${Math.floor((x - minX) / cellSize)}_${Math.floor((z - minZ) / cellSize)}`;
      let list = buckets.get(key);
      if (!list) {
        list = [];
        buckets.set(key, list);
      }
      list.push(i);
    }

    if (buckets.size < 3) {
      inst.computeBoundingSphere();
      continue;
    }

    for (const indices of buckets.values()) {
      const chunk = new THREE.InstancedMesh(inst.geometry, inst.material, indices.length);
      chunk.position.copy(inst.position);
      chunk.quaternion.copy(inst.quaternion);
      chunk.scale.copy(inst.scale);
      chunk.renderOrder = inst.renderOrder;
      chunk.frustumCulled = true;

      for (let j = 0; j < indices.length; j++) {
        const srcIdx = indices[j];
        inst.getMatrixAt(srcIdx, mat4);
        chunk.setMatrixAt(j, mat4);
        if (hasColors) {
          inst.getColorAt(srcIdx, color);
          chunk.setColorAt(j, color);
        }
      }
      chunk.instanceMatrix.needsUpdate = true;
      if (chunk.instanceColor) chunk.instanceColor.needsUpdate = true;
      chunk.computeBoundingSphere();
      parent.add(chunk);
    }

    parent.remove(inst);
  }
}

/**
 * Industry-standard mobile off-track shader tiering:
 * Converts opaque non-normal-mapped off-track PBR materials (skyscrapers, mountains, trees,
 * concrete piers, tunnel arches, bridge towers/cables) into fast MeshLambertMaterial,
 * cutting mobile fragment GPU load on ~75% of screen pixels while leaving Hero Cars & Road untouched.
 */
function optimizeOffTrackSceneryForMobile(
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[]
): void {
  const matCache = new Map<THREE.MeshStandardMaterial, THREE.MeshLambertMaterial>();

  const convertMat = (mat: THREE.Material): THREE.Material => {
    if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
    if (mat.normalMap) {
      // Keep animated ocean water normal-mapped, but disable costly HDR PMREM reflections on flat bay water
      mat.envMapIntensity = Math.min(mat.envMapIntensity, 0.45);
      return mat;
    }
    const existing = matCache.get(mat);
    if (existing) return existing;

    const lambert = new THREE.MeshLambertMaterial({
      color: mat.color.clone(),
      map: mat.map,
      emissive: mat.emissive.clone(),
      emissiveMap: mat.emissiveMap,
      emissiveIntensity: mat.emissiveIntensity,
      vertexColors: mat.vertexColors,
      transparent: mat.transparent,
      opacity: mat.opacity,
      side: mat.side,
      fog: mat.fog,
      flatShading: mat.flatShading,
    });
    matCache.set(mat, lambert);
    disposables.push(lambert);
    return lambert;
  };

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(convertMat);
      } else if (obj.material) {
        obj.material = convertMat(obj.material);
      }
    }
  });
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

    // Realistic steel stay cables batched into 1 InstancedMesh per pylon (cuts 32 draw calls -> 1!)
    const deckY = f.pos.y - waterY + 1.2;
    const cableInst = new THREE.InstancedMesh(cableGeo, cableMat, 32);
    const cableDummy = new THREE.Object3D();
    const upY = new THREE.Vector3(0, 1, 0);
    let cableIdx = 0;
    for (const side of [-1, 1]) {
      for (let c = 1; c <= 8; c++) {
        for (const dir of [-1, 1]) {
          const topPt = new THREE.Vector3(side * halfSpan, 78 + c * 8.2, 0);
          const botPt = new THREE.Vector3(side * (spline.halfWidth + 1.0), deckY, dir * c * 22);
          const delta = botPt.clone().sub(topPt);
          const len = delta.length();
          cableDummy.scale.set(1, len, 1);
          cableDummy.position.copy(topPt).addScaledVector(delta, 0.5);
          cableDummy.quaternion.setFromUnitVectors(upY, delta.normalize());
          cableDummy.updateMatrix();
          cableInst.setMatrixAt(cableIdx++, cableDummy.matrix);
        }
      }
    }
    pylonGroup.add(cableInst);
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

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x34251b, roughness: 0.94, envMapIntensity: 0.22 });
  const pineMatDark = new THREE.MeshStandardMaterial({ color: 0x122f23, roughness: 0.91, envMapIntensity: 0.24 });
  const pineMatMid = new THREE.MeshStandardMaterial({ color: 0x193e2e, roughness: 0.89, envMapIntensity: 0.24 });
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

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x34251b, roughness: 0.94, envMapIntensity: 0.22 });
  const pineDark = new THREE.MeshStandardMaterial({ color: 0x123225, roughness: 0.91, envMapIntensity: 0.24 });
  const pineMid = new THREE.MeshStandardMaterial({ color: 0x1a4231, roughness: 0.89, envMapIntensity: 0.24 });
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

/**
 * 怒江 72 拐 // G318 Yela Mountain & Nujiang Gorge Tibetan Highland World:
 * - Sculpted 200x200 ochre-terracotta Hengduan mountain canyon & snow-capped outer 360m peaks,
 *   with strict multi-tier roadbed carving (>= 9.5m below EVERY stacked switchback shelf -> 0% clipping!).
 * - Shimmering emerald-turquoise Nujiang River flowing through the central chasm beneath the red-steel Gorge Bridge.
 * - Fluttering 5-color Tibetan Prayer Flag spans strung high across Yela Pass & key switchback overlooks.
 * - Traditional Tibetan White Chorten (Stupa) with golden spire at Yela Mountain Pass & Tongni Overlook.
 * - Sparse weathered ochre boulders & high-altitude plateau scrub tufts (InstancedMesh).
 */
function buildNujiangGorgeWorld(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number,
  animatedFlags: { mesh: THREE.Object3D; phase: number }[]
): void {
  // 1. Build fast 80m local spatial grid over all spline samples (stride 2) for multi-tier zero-clipping carving!
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }

  const cellSize = 80;
  const gridMap = new Map<number, number[]>();
  for (let i = 0; i < spline.sampleCount; i += 2) {
    const p = spline.samples[i].pos;
    const gx = Math.floor(p.x / cellSize);
    const gz = Math.floor(p.z / cellSize);
    const key = ((gx + 2048) << 12) | (gz + 2048);
    let bucket = gridMap.get(key);
    if (!bucket) {
      bucket = [];
      gridMap.set(key, bucket);
    }
    bucket.push(i);
  }

  const queryRoadEnvelope = (wx: number, wz: number): { minDist: number; strictSafeFloor: number; nearestY: number } => {
    const gx = Math.floor(wx / cellSize);
    const gz = Math.floor(wz / cellSize);
    let minDistSq = Infinity;
    let nearestY = 60;
    let strictSafeFloor = Infinity;
    const hardRadiusSq = (spline.halfWidth + 24) * (spline.halfWidth + 24);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const key = ((gx + ox + 2048) << 12) | (gz + oz + 2048);
        const bucket = gridMap.get(key);
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const s = spline.samples[bucket[k]];
          const dx = s.pos.x - wx;
          const dz = s.pos.z - wz;
          const dSq = dx * dx + dz * dz;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            nearestY = s.pos.y;
          }
          if (dSq < hardRadiusSq) {
            const bankDrop = spline.halfWidth * Math.sin(Math.abs(s.bank));
            const floor = s.pos.y - bankDrop - 9.5;
            if (floor < strictSafeFloor) strictSafeFloor = floor;
          }
        }
      }
    }
    return {
      minDist: minDistSq === Infinity ? 999 : Math.sqrt(minDistSq),
      strictSafeFloor,
      nearestY,
    };
  };

  // 2. Sculpted 200x200 Hengduan Ochre Canyon & Snow-Capped Outer Peaks
  const margin = 460;
  const widthX = maxX - minX + margin * 2;
  const depthZ = maxZ - minZ + margin * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const segs = 200;

  const terrGeo = new THREE.PlaneGeometry(widthX, depthZ, segs, segs);
  terrGeo.rotateX(-Math.PI / 2);
  const posAttr = terrGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);

  const cRiverBed = new THREE.Color(0x1f2d34);
  const cGorgeRock = new THREE.Color(0x5b4c3f);
  const cOchreEarth = new THREE.Color(0x966340);
  const cRustSlope = new THREE.Color(0x7c5338);
  const cAlpineSlate = new THREE.Color(0x636975);
  const cSnowPeak = new THREE.Color(0xeaf2fb);
  const tmpColor = new THREE.Color();

  const evalTerrainHeight = (wx: number, wz: number): number => {
    // Dramatic Tibetan canyon profile: deep river chasm along x ≈ -85, towering walls East (+X), West (-X) & Summit (+Z)
    const fbm =
      Math.sin(wx * 0.0048) * Math.cos(wz * 0.0044) * 44 +
      Math.sin(wx * 0.0115 + 1.3) * Math.sin(wz * 0.0108 + 0.7) * 20 +
      Math.cos((wx + wz) * 0.022) * 8;

    // Central Nujiang River Gorge carved deep below waterY=4 along x ≈ -85 (z < -180)
    const riverAxisX = -85 + Math.sin(wz * 0.0032) * 38;
    const distFromRiver = Math.abs(wx - riverAxisX);
    const northFactor = smoothstep(-80, -340, wz);
    const riverCarve = (1 - smoothstep(26, 145, distFromRiver)) * northFactor;

    // Mountain backdrop rises steeply toward Yela Pass (+Z) and outside East/West canyon rims
    const slopeNorthToSouth = clamp((wz + 1220) / 1380, 0, 1.25) * 185;
    const rimEast = smoothstep(320, 760, wx) * 195;
    const rimWest = smoothstep(-360, -820, wx) * 205;
    const rimSouth = smoothstep(60, 440, wz) * 180;
    const rimNorth = smoothstep(-1190, -1580, wz) * 210;

    let h = 14 + slopeNorthToSouth + rimEast + rimWest + rimSouth + rimNorth + fbm;
    // Deepen the central Nujiang River gorge channel so turquoise water flows visibly down the canyon floor!
    h = h * (1 - riverCarve) + (waterY - 6.5) * riverCarve;

    const env = queryRoadEnvelope(wx, wz);
    const clearInner = spline.halfWidth + 15;
    const clearOuter = spline.halfWidth + 56;
    if (env.minDist < clearOuter) {
      const targetFloor =
        env.strictSafeFloor < Infinity ? env.strictSafeFloor : env.nearestY - 12.5;
      const blend = smoothstep(clearInner, clearOuter, env.minDist);
      h = Math.min(h, targetFloor + (Math.max(h, targetFloor) - targetFloor) * blend);
    }
    if (env.strictSafeFloor < Infinity) {
      h = Math.min(h, env.strictSafeFloor);
    }
    return h;
  };

  const terrHeights = new Float32Array((segs + 1) * (segs + 1));
  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i);
    const lz = posAttr.getZ(i);
    const wx = lx + centerX;
    const wz = lz + centerZ;
    const h = evalTerrainHeight(wx, wz);
    posAttr.setY(i, h);
    terrHeights[i] = h;

    // Rich Tibetan Hengduan elevation-stratified vertex coloring
    const patch = 0.5 + 0.5 * Math.sin(wx * 0.017 + wz * 0.014);
    if (h < 12) {
      tmpColor.copy(cRiverBed).lerp(cGorgeRock, clamp((h + 4) / 16, 0, 1));
    } else if (h < 58) {
      tmpColor.copy(cGorgeRock).lerp(cRustSlope, clamp((h - 12) / 46, 0, 1));
    } else if (h < 178) {
      tmpColor.copy(cRustSlope).lerp(cOchreEarth, patch * 0.72 + clamp((h - 58) / 140, 0, 0.28));
    } else if (h < 248) {
      tmpColor.copy(cOchreEarth).lerp(cAlpineSlate, clamp((h - 178) / 70, 0, 1));
    } else {
      tmpColor.copy(cAlpineSlate).lerp(cSnowPeak, clamp((h - 248) / 52, 0, 1));
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  terrGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrGeo.computeVertexNormals();
  const terrMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.04,
  });
  const terrMesh = new THREE.Mesh(terrGeo, terrMat);
  terrMesh.position.set(centerX, 0, centerZ);
  group.add(terrMesh);
  disposables.push(terrGeo, terrMat);

  // 3. Nujiang River Red-Steel Canyon Bridge (spanning the turquoise river at t = 0.498..0.528!)
  const bridgeRedMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    metalness: 0.58,
    roughness: 0.36,
  });
  const cableSteelMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    metalness: 0.85,
    roughness: 0.25,
  });
  const pylonGeo = new THREE.BoxGeometry(2.8, 72, 3.2);
  const crossGeo = new THREE.BoxGeometry(spline.roadWidth + 7.4, 2.8, 2.8);
  const cableGeo = new THREE.CylinderGeometry(0.16, 0.16, 1, 6);
  disposables.push(bridgeRedMat, cableSteelMat, pylonGeo, crossGeo, cableGeo);

  const basis = new THREE.Matrix4();
  const hw = spline.halfWidth;
  for (const towerT of [0.502, 0.526]) {
    const f = spline.getFrameAtDistance(towerT * spline.totalLength);
    const tower = new THREE.Group();
    tower.position.set(f.pos.x, waterY, f.pos.z);
    basis.makeBasis(f.flatRight, new THREE.Vector3(0, 1, 0), f.tangent.clone().negate());
    tower.quaternion.setFromRotationMatrix(basis);

    const deckH = f.pos.y - waterY;
    for (const side of [-1, 1] as const) {
      const leg = new THREE.Mesh(pylonGeo, bridgeRedMat);
      leg.position.set(side * (hw + 2.6), 36, 0);
      tower.add(leg);
    }
    const lowCross = new THREE.Mesh(crossGeo, bridgeRedMat);
    lowCross.position.set(0, deckH + 17, 0);
    const topCross = new THREE.Mesh(crossGeo, bridgeRedMat);
    topCross.position.set(0, 68, 0);
    tower.add(lowCross, topCross);

    // Crisp fanned steel stay cables anchored cleanly outside road shoulders
    const upVec = new THREE.Vector3(0, 1, 0);
    for (const side of [-1, 1] as const) {
      for (const dir of [-1, 1] as const) {
        for (let c = 1; c <= 4; c++) {
          const topPt = new THREE.Vector3(side * (hw + 2.4), 66 - c * 4.8, 0);
          const botPt = new THREE.Vector3(side * (hw + 1.4), deckH + 0.8, dir * (c * 14));
          const span = botPt.clone().sub(topPt);
          const len = span.length();
          const cable = new THREE.Mesh(cableGeo, cableSteelMat);
          cable.position.copy(topPt).addScaledVector(span, 0.5);
          cable.scale.set(1, len, 1);
          cable.quaternion.setFromUnitVectors(upVec, span.normalize());
          tower.add(cable);
        }
      }
    }
    group.add(tower);
  }

  // 4. Fluttering 5-Color Tibetan Prayer Flag Spans across Yela Pass & Key Cliff Overlooks!
  const poleWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c4033,
    roughness: 0.9,
    metalness: 0.05,
  });
  const ropeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const flagColors = [0x1d4ed8, 0xf8fafc, 0xdc2626, 0x16a34a, 0xeab308]; // Traditional Tibetan Blue-White-Red-Green-Yellow
  const flagMats = flagColors.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.16,
        roughness: 0.72,
        side: THREE.DoubleSide,
      })
  );
  const flagPoleGeo = new THREE.CylinderGeometry(0.18, 0.24, 15.0, 7);
  const flagGeo = new THREE.PlaneGeometry(1.35, 1.65);
  flagGeo.translate(0, -0.82, 0); // Pivot at top edge so flags flutter downward naturally!
  const ropeGeo = new THREE.CylinderGeometry(0.04, 0.04, spline.roadWidth + 4.4, 6);
  ropeGeo.rotateZ(Math.PI / 2);
  disposables.push(poleWoodMat, ropeMat, flagPoleGeo, flagGeo, ropeGeo, ...flagMats);

  for (const [idx, flagT] of [0.010, 0.150, 0.308, 0.468, 0.725, 0.968].entries()) {
    const f = spline.getFrameAtDistance(flagT * spline.totalLength);
    const spanGroup = new THREE.Group();
    spanGroup.position.copy(f.pos);
    basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
    spanGroup.quaternion.setFromRotationMatrix(basis);

    for (const side of [-1, 1] as const) {
      const pole = new THREE.Mesh(flagPoleGeo, poleWoodMat);
      pole.position.set(side * (hw + 2.1), 7.5, 0);
      spanGroup.add(pole);
    }

    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(0, 14.2, 0);
    spanGroup.add(rope);

    const numFlags = 15;
    const totalW = spline.roadWidth + 1.6;
    for (let k = 0; k < numFlags; k++) {
      const u = (k + 0.5) / numFlags;
      const fx = (u - 0.5) * totalW;
      const sag = Math.sin(u * Math.PI) * 1.15;
      const fm = new THREE.Mesh(flagGeo, flagMats[(k + idx) % flagMats.length]);
      fm.position.set(fx, 14.2 - sag, 0);
      spanGroup.add(fm);
      animatedFlags.push({ mesh: fm, phase: idx * 1.7 + k * 0.55 });
    }
    group.add(spanGroup);
  }

  // 5. Traditional Tibetan White Chorten (Stupa) Landmarks at Yela Pass Summit & Tongni Overlook!
  const stupaWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.76, metalness: 0.05 });
  const stupaGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.25,
    metalness: 0.78,
    roughness: 0.28,
  });
  const stupaRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.68 });
  const sBaseGeo = new THREE.BoxGeometry(10.5, 4.2, 10.5);
  const sStepGeo = new THREE.BoxGeometry(7.8, 2.2, 7.8);
  const sDomeGeo = new THREE.CylinderGeometry(2.8, 3.6, 4.8, 14);
  const sTrimGeo = new THREE.BoxGeometry(3.2, 1.4, 3.2);
  const sSpireGeo = new THREE.ConeGeometry(1.4, 5.2, 12);
  disposables.push(
    stupaWhiteMat,
    stupaGoldMat,
    stupaRedMat,
    sBaseGeo,
    sStepGeo,
    sDomeGeo,
    sTrimGeo,
    sSpireGeo
  );

  for (const [stupaT, side] of [
    [0.006, 1],
    [0.304, 1],
    [0.985, -1],
  ] as const) {
    const f = spline.getFrameAtDistance(stupaT * spline.totalLength);
    const pos = f.pos.clone().addScaledVector(f.flatRight, side * (hw + 19));
    if (spline.minHorizontalDistanceToTrack(pos.x, pos.z) < hw + 13) continue;

    const stupa = new THREE.Group();
    stupa.position.set(pos.x, f.pos.y - 1.2, pos.z);
    const base = new THREE.Mesh(sBaseGeo, stupaWhiteMat);
    base.position.y = 2.1;
    const step = new THREE.Mesh(sStepGeo, stupaWhiteMat);
    step.position.y = 5.3;
    const dome = new THREE.Mesh(sDomeGeo, stupaWhiteMat);
    dome.position.y = 8.8;
    const trim = new THREE.Mesh(sTrimGeo, stupaRedMat);
    trim.position.y = 11.9;
    const spire = new THREE.Mesh(sSpireGeo, stupaGoldMat);
    spire.position.y = 15.2;
    stupa.add(base, step, dome, trim, spire);
    group.add(stupa);
  }

  // 6. Instanced Weathered Ochre Cliff Boulders & Sparse Tibetan Highland Scrub
  const boulderGeo = new THREE.DodecahedronGeometry(2.6, 0);
  const boulderMat = new THREE.MeshStandardMaterial({
    color: 0x7c5a43,
    roughness: 0.94,
    metalness: 0.04,
  });
  const scrubGeo = new THREE.ConeGeometry(1.9, 3.4, 6);
  const scrubMat = new THREE.MeshStandardMaterial({
    color: 0x4d5d36,
    roughness: 0.92,
  });
  disposables.push(boulderGeo, boulderMat, scrubGeo, scrubMat);

  const sampleMeshTerrainY = (wx: number, wz: number): number => {
    const fx = ((wx - (centerX - widthX * 0.5)) / widthX) * segs;
    const fz = ((wz - (centerZ - depthZ * 0.5)) / depthZ) * segs;
    const ix = clamp(Math.floor(fx), 0, segs - 1);
    const iz = clamp(Math.floor(fz), 0, segs - 1);
    const tx = clamp(fx - ix, 0, 1);
    const tz = clamp(fz - iz, 0, 1);
    const stride = segs + 1;
    const h00 = terrHeights[iz * stride + ix];
    const h10 = terrHeights[iz * stride + ix + 1];
    const h01 = terrHeights[(iz + 1) * stride + ix];
    const h11 = terrHeights[(iz + 1) * stride + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };

  const boulders: { x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = [];
  const scrubs: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 2400 && (boulders.length < 260 || scrubs.length < 180); i++) {
    const wx = minX - 240 + rand() * (maxX - minX + 480);
    const wz = minZ - 240 + rand() * (maxZ - minZ + 480);
    const env = queryRoadEnvelope(wx, wz);
    if (env.minDist < hw + 22) continue;
    const wy = sampleMeshTerrainY(wx, wz);
    if (wy < waterY + 6 || wy > 230) continue;
    if (boulders.length < 260 && rand() < 0.6) {
      boulders.push({
        x: wx,
        y: wy - 1.2,
        z: wz,
        sx: 0.8 + rand() * 2.2,
        sy: 0.6 + rand() * 1.4,
        sz: 0.8 + rand() * 2.0,
      });
    } else if (scrubs.length < 180 && wy < 170) {
      scrubs.push({ x: wx, y: wy + 0.2, z: wz, s: 0.7 + rand() * 1.0 });
    }
  }

  const dummy = new THREE.Object3D();
  if (boulders.length > 0) {
    const bInst = new THREE.InstancedMesh(boulderGeo, boulderMat, boulders.length);
    boulders.forEach((b, idx) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(rand() * 2, rand() * 6, rand() * 2);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      bInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(bInst);
  }
  if (scrubs.length > 0) {
    const sInst = new THREE.InstancedMesh(scrubGeo, scrubMat, scrubs.length);
    scrubs.forEach((sc, idx) => {
      dummy.position.set(sc.x, sc.y, sc.z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(sc.s);
      dummy.updateMatrix();
      sInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(sInst);
  }
}

/**
 * 极光星湾 24 弯迷宫 // AURORA FJORD ARCHIPELAGO (20.8 km Radial Starfish Drift Labyrinth):
 * - Sculpted 220x220 dark volcanic basalt sea-peninsulas rising out of shimmering sapphire Arctic fjords,
 *   with a towering 210m snow-crowned central caldera volcano and zero-clipping multi-sample roadbed carving (>= 9.5m).
 * - 3 animated emerald-cyan-violet Aurora Borealis curtains shimmering softly across the Nordic night sky!
 * - Instanced Nordic red-timber Rorbuer coastal cabins with warm glowing windows, snow-dusted spruce pines,
 *   dark basalt sea stacks jutting out of the fjord inlets, and a rotating headland lighthouse!
 */
function buildAuroraFjordWorld(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number,
  animatedBeacons: THREE.Object3D[],
  animatedAuroras: { mesh: THREE.Mesh; baseY: number; phase: number }[]
): void {
  // 1. Fast 90m local spatial grid over all spline samples (stride 2) for strict zero-clipping peninsula carving!
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }

  const cellSize = 90;
  const gridMap = new Map<number, number[]>();
  for (let i = 0; i < spline.sampleCount; i += 2) {
    const p = spline.samples[i].pos;
    const gx = Math.floor(p.x / cellSize);
    const gz = Math.floor(p.z / cellSize);
    const key = ((gx + 2048) << 12) | (gz + 2048);
    let b = gridMap.get(key);
    if (!b) {
      b = [];
      gridMap.set(key, b);
    }
    b.push(i);
  }

  const hw = spline.halfWidth;
  const queryRoadEnvelope = (wx: number, wz: number) => {
    const gx = Math.floor(wx / cellSize);
    const gz = Math.floor(wz / cellSize);
    let minDistSq = Infinity;
    let nearestY = 30;
    let strictSafeFloor = Infinity;
    const hardRadiusSq = (hw + 24) * (hw + 24);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const bucket = gridMap.get(((gx + ox + 2048) << 12) | (gz + oz + 2048));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const s = spline.samples[bucket[k]];
          const dx = s.pos.x - wx;
          const dz = s.pos.z - wz;
          const dSq = dx * dx + dz * dz;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            nearestY = s.pos.y;
          }
          if (dSq < hardRadiusSq) {
            const bankDrop = hw * Math.sin(Math.abs(s.bank));
            const floor = s.pos.y - bankDrop - 9.5;
            if (floor < strictSafeFloor) strictSafeFloor = floor;
          }
        }
      }
    }
    return {
      minDist: minDistSq === Infinity ? 999 : Math.sqrt(minDistSq),
      strictSafeFloor,
      nearestY,
    };
  };

  // 2. Sculpted 220x220 Basalt Fjord Archipelago + Central Snow-Crowned Caldera Volcano
  const margin = 520;
  const widthX = maxX - minX + margin * 2;
  const depthZ = maxZ - minZ + margin * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const segs = 220;

  const terrGeo = new THREE.PlaneGeometry(widthX, depthZ, segs, segs);
  terrGeo.rotateX(-Math.PI / 2);
  const posAttr = terrGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const terrHeights = new Float32Array((segs + 1) * (segs + 1));

  const cSeabed = new THREE.Color(0x0c1520);
  const cBasalt = new THREE.Color(0x1f2835);
  const cNordicMoss = new THREE.Color(0x26443a);
  const cGlacialSlate = new THREE.Color(0x475a72);
  const cSnow = new THREE.Color(0xe2eefc);
  const tmpColor = new THREE.Color();

  // Central snow-crowned caldera summit sits safely inside the ring of inner valleys around (-120, -240)
  const hubX = -120;
  const hubZ = -240;

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + centerX;
    const wz = posAttr.getZ(i) + centerZ;
    const env = queryRoadEnvelope(wx, wz);

    const fbm =
      Math.sin(wx * 0.0036) * Math.cos(wz * 0.0034) * 32 +
      Math.sin(wx * 0.0092 + 1.1) * Math.sin(wz * 0.0088 + 0.6) * 14 +
      Math.cos((wx - wz) * 0.017) * 6;

    // Central caldera volcanic massif rising majestically between the 11 starfish fingers!
    const distHub = Math.hypot(wx - hubX, wz - hubZ);
    const hubPeak = Math.exp(-(distHub * distHub) / (340 * 340)) * 225;

    // Distant fjord mountain ring framing the northern/eastern/western horizon across the water
    const distEdge = Math.hypot((wx - centerX) / (widthX * 0.44), (wz - centerZ) / (depthZ * 0.44));
    const outerFjordRim = smoothstep(0.92, 1.24, distEdge) * (155 + Math.max(0, fbm * 1.4));

    // Sea inlets naturally stay submerged (below waterY=0) between fingers unless near central caldera or fjord rim,
    // while gentle rocky shelves rise modestly beneath peninsula road corridors!
    const peninsulaShelf =
      env.minDist < 120 ? (1 - smoothstep(32, 120, env.minDist)) * Math.max(0, env.nearestY - 12) : 0;

    let h = waterY - 10 + hubPeak + outerFjordRim + peninsulaShelf + fbm * 0.42;

    // Strict multi-sample zero-clipping road corridor carve (>= 9.5m below every road deck!)
    const clearInner = hw + 15;
    const clearOuter = hw + 58;
    if (env.minDist < clearOuter) {
      const targetFloor = env.strictSafeFloor < Infinity ? env.strictSafeFloor : env.nearestY - 12.5;
      const blend = smoothstep(clearInner, clearOuter, env.minDist);
      h = Math.min(h, targetFloor + (Math.max(h, targetFloor) - targetFloor) * blend);
    }
    if (env.strictSafeFloor < Infinity) {
      h = Math.min(h, env.strictSafeFloor);
    }

    posAttr.setY(i, h);
    terrHeights[i] = h;

    const mossMix = 0.5 + 0.5 * Math.sin(wx * 0.014 + wz * 0.011);
    if (h < 4) {
      tmpColor.copy(cSeabed).lerp(cBasalt, clamp((h + 8) / 12, 0, 1));
    } else if (h < 56) {
      tmpColor.copy(cBasalt).lerp(cNordicMoss, mossMix * 0.65);
    } else if (h < 122) {
      tmpColor.copy(cNordicMoss).lerp(cGlacialSlate, clamp((h - 56) / 66, 0, 1));
    } else {
      tmpColor.copy(cGlacialSlate).lerp(cSnow, clamp((h - 122) / 48, 0, 1));
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  terrGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrGeo.computeVertexNormals();
  const terrMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.08,
  });
  const terrMesh = new THREE.Mesh(terrGeo, terrMat);
  terrMesh.position.set(centerX, 0, centerZ);
  group.add(terrMesh);
  disposables.push(terrGeo, terrMat);

  const sampleMeshY = (wx: number, wz: number): number => {
    const fx = ((wx - (centerX - widthX * 0.5)) / widthX) * segs;
    const fz = ((wz - (centerZ - depthZ * 0.5)) / depthZ) * segs;
    const ix = clamp(Math.floor(fx), 0, segs - 1);
    const iz = clamp(Math.floor(fz), 0, segs - 1);
    const tx = clamp(fx - ix, 0, 1);
    const tz = clamp(fz - iz, 0, 1);
    const stride = segs + 1;
    const h00 = terrHeights[iz * stride + ix];
    const h10 = terrHeights[iz * stride + ix + 1];
    const h01 = terrHeights[(iz + 1) * stride + ix];
    const h11 = terrHeights[(iz + 1) * stride + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };

  // 3. Animated Shimmering Aurora Borealis Sky Curtains (Soft Gaussian-feathered vertical rays -> ZERO hard plane edges!)
  const aurCanvas = document.createElement('canvas');
  aurCanvas.width = 512;
  aurCanvas.height = 256;
  const aurCtx = aurCanvas.getContext('2d')!;
  aurCtx.fillStyle = '#000000';
  aurCtx.fillRect(0, 0, 512, 256);
  // Draw soft vertical aurora ray curtains tapering cleanly to 0 at all 4 canvas edges
  for (let x = 24; x < 488; x += 5) {
    const u = x / 512;
    const hMask = Math.pow(Math.sin(u * Math.PI), 2.4);
    const rayNoise = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.13) * Math.cos(x * 0.047 + 1.2));
    const alpha = hMask * rayNoise * 0.52;
    if (alpha < 0.01) continue;
    const g = aurCtx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0.0, 'rgba(0,0,0,0)');
    g.addColorStop(0.18, `rgba(0, 255, 175, ${(alpha * 0.95).toFixed(3)})`);
    g.addColorStop(0.42, `rgba(0, 220, 255, ${(alpha * 0.72).toFixed(3)})`);
    g.addColorStop(0.72, `rgba(147, 51, 234, ${(alpha * 0.36).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    aurCtx.fillStyle = g;
    aurCtx.fillRect(x, 0, 6, 256);
  }
  const aurTex = new THREE.CanvasTexture(aurCanvas);
  aurTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(aurTex);

  const aurConfigs = [
    { x: centerX - 180, y: 460, z: centerZ - 1650, rotY: 0.12, span: 3400, height: 420, phase: 0.0 },
    { x: centerX + 780, y: 520, z: centerZ - 1150, rotY: -0.58, span: 3000, height: 380, phase: 2.1 },
    { x: centerX - 1020, y: 490, z: centerZ - 520, rotY: 0.78, span: 2900, height: 370, phase: 4.3 },
  ];

  for (const ac of aurConfigs) {
    const aSegs = 48;
    const aGeo = new THREE.PlaneGeometry(ac.span, ac.height, aSegs, 8);
    const aPos = aGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < aPos.count; i++) {
      const lx = aPos.getX(i);
      const u = lx / ac.span + 0.5;
      // Gentle, broad sky-curtain undulation (no sharp self-folding creases)
      const waveZ = Math.sin(u * Math.PI * 2.5 + ac.phase) * 110 + Math.cos(u * Math.PI * 4.5) * 35;
      aPos.setZ(i, waveZ);
    }
    const aMat = new THREE.MeshBasicMaterial({
      map: aurTex,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const aMesh = new THREE.Mesh(aGeo, aMat);
    aMesh.position.set(ac.x, ac.y, ac.z);
    aMesh.rotation.y = ac.rotY;
    group.add(aMesh);
    disposables.push(aGeo, aMat);
    animatedAuroras.push({ mesh: aMesh, baseY: ac.y, phase: ac.phase });
  }

  // 4. Instanced Basalt Sea Stacks, Frost-Dusted Nordic Spruce Trees & Red-Timber Rorbuer Cabins
  const stackGeo = new THREE.CylinderGeometry(3.2, 6.2, 26, 6);
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x1b232e, roughness: 0.88, metalness: 0.14 });
  const pineTrunkGeo = new THREE.CylinderGeometry(0.45, 0.72, 4.5, 6);
  const pineCrown1Geo = new THREE.ConeGeometry(3.4, 8.5, 7);
  const pineCrown2Geo = new THREE.ConeGeometry(2.5, 6.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 0.92 });
  const spruceMat = new THREE.MeshStandardMaterial({ color: 0x1e3f38, roughness: 0.86 });
  const frostTipMat = new THREE.MeshStandardMaterial({ color: 0xbcd4e6, roughness: 0.8 });

  const cabinWallGeo = new THREE.BoxGeometry(8.5, 5.2, 11.0);
  const cabinRoofGeo = new THREE.ConeGeometry(7.6, 3.8, 4);
  cabinRoofGeo.rotateY(Math.PI / 4);
  const cabinWinGeo = new THREE.BoxGeometry(8.7, 1.5, 6.2);
  const cabinRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.75 });
  const cabinRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
  const cabinWinMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffd27d).multiplyScalar(1.6),
    toneMapped: false,
  });

  disposables.push(
    stackGeo,
    stackMat,
    pineTrunkGeo,
    pineCrown1Geo,
    pineCrown2Geo,
    trunkMat,
    spruceMat,
    frostTipMat,
    cabinWallGeo,
    cabinRoofGeo,
    cabinWinGeo,
    cabinRedMat,
    cabinRoofMat,
    cabinWinMat
  );

  const stacks: { x: number; z: number; sx: number; sy: number; sz: number }[] = [];
  const pines: { x: number; y: number; z: number; s: number }[] = [];
  const cabins: { x: number; y: number; z: number; rotY: number }[] = [];

  for (let i = 0; i < 4200 && (stacks.length < 130 || pines.length < 400 || cabins.length < 75); i++) {
    const wx = minX - 320 + rand() * (maxX - minX + 640);
    const wz = minZ - 320 + rand() * (maxZ - minZ + 640);
    const env = queryRoadEnvelope(wx, wz);
    if (env.minDist < hw + 22) continue;
    const wy = sampleMeshY(wx, wz);

    if (wy < waterY + 1 && env.minDist > hw + 44 && stacks.length < 130) {
      stacks.push({
        x: wx,
        z: wz,
        sx: 0.9 + rand() * 2.4,
        sy: 0.65 + rand() * 2.1,
        sz: 0.9 + rand() * 2.4,
      });
    } else if (wy > waterY + 6 && wy < 118 && pines.length < 400 && rand() < 0.72) {
      pines.push({ x: wx, y: wy - 0.5, z: wz, s: 0.8 + rand() * 1.15 });
    } else if (wy > waterY + 4 && wy < 62 && env.minDist > hw + 28 && env.minDist < hw + 130 && cabins.length < 75) {
      cabins.push({ x: wx, y: wy - 0.4, z: wz, rotY: rand() * Math.PI * 2 });
    }
  }

  const dummy = new THREE.Object3D();
  if (stacks.length > 0) {
    const inst = new THREE.InstancedMesh(stackGeo, stackMat, stacks.length);
    stacks.forEach((st, idx) => {
      dummy.position.set(st.x, waterY + 6 * st.sy, st.z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(st.sx, st.sy, st.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(inst);
  }

  if (pines.length > 0) {
    const tInst = new THREE.InstancedMesh(pineTrunkGeo, trunkMat, pines.length);
    const c1Inst = new THREE.InstancedMesh(pineCrown1Geo, spruceMat, pines.length);
    const c2Inst = new THREE.InstancedMesh(pineCrown2Geo, frostTipMat, pines.length);
    pines.forEach((p, idx) => {
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(p.s);
      dummy.position.set(p.x, p.y + 2.2 * p.s, p.z);
      dummy.updateMatrix();
      tInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(p.x, p.y + 7.0 * p.s, p.z);
      dummy.updateMatrix();
      c1Inst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(p.x, p.y + 11.4 * p.s, p.z);
      dummy.updateMatrix();
      c2Inst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(tInst, c1Inst, c2Inst);
  }

  if (cabins.length > 0) {
    const wInst = new THREE.InstancedMesh(cabinWallGeo, cabinRedMat, cabins.length);
    const rInst = new THREE.InstancedMesh(cabinRoofGeo, cabinRoofMat, cabins.length);
    const gInst = new THREE.InstancedMesh(cabinWinGeo, cabinWinMat, cabins.length);
    cabins.forEach((c, idx) => {
      dummy.rotation.set(0, c.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(c.x, c.y + 2.6, c.z);
      dummy.updateMatrix();
      wInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(c.x, c.y + 7.0, c.z);
      dummy.updateMatrix();
      rInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(c.x, c.y + 2.8, c.z);
      dummy.updateMatrix();
      gInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(wInst, rInst, gInst);
  }

  // 5. Rotating Arctic Headland Lighthouse on the tall North-East Spire overlooking the entire fjord!
  const lhGlassMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x9be7ff).multiplyScalar(2.4),
    toneMapped: false,
  });
  const lhBeamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lhTowerGeo = new THREE.CylinderGeometry(3.4, 5.6, 52, 16);
  const lhLanternGeo = new THREE.CylinderGeometry(2.8, 2.8, 5.0, 14);
  const lhBeamGeo = new THREE.ConeGeometry(16, 260, 16, 1, true);
  lhBeamGeo.translate(0, -130, 0);
  lhBeamGeo.rotateX(Math.PI / 2);
  disposables.push(lhGlassMat, lhBeamMat, lhTowerGeo, lhLanternGeo, lhBeamGeo);

  const lhPos = new THREE.Vector3(hubX, sampleMeshY(hubX, hubZ) - 4, hubZ);
  if (queryRoadEnvelope(lhPos.x, lhPos.z).minDist > hw + 45) {
    const lhGroup = new THREE.Group();
    lhGroup.position.copy(lhPos);
    const tower = new THREE.Mesh(lhTowerGeo, cabinRedMat);
    tower.position.y = 26;
    const lantern = new THREE.Mesh(lhLanternGeo, lhGlassMat);
    lantern.position.y = 54.5;
    const pivot = new THREE.Group();
    pivot.position.y = 54.5;
    const b1 = new THREE.Mesh(lhBeamGeo, lhBeamMat);
    const b2 = new THREE.Mesh(lhBeamGeo, lhBeamMat);
    b2.rotation.y = Math.PI;
    pivot.add(b1, b2);
    animatedBeacons.push(pivot);
    lhGroup.add(tower, lantern, pivot);
    group.add(lhGroup);
  }
}

/**
 * 超级秋名山 · 蛇形天道 // SUPER AKINA MOUNT HARUNA GRAND TOUGE WORLD (27.25 km):
 * - Sculpted 240x240 Mount Haruna nocturnal volcanic massif + towering 455m Mt. Haruna Fuji central cone,
 *   moonlit alpine Lake Haruna crater lake (Y=196m) beside Sector 1, and strict multi-sample zero-clipping
 *   roadbed carving (>= 9.5m clearance below EVERY serpentine ribbon & hairpin deck!).
 * - Iconic Akina Summit Water Tower & warm-lit Timber Pass Pavilion framing the Start/Finish straight.
 * - 9 traditional vermilion Shinto Torii gates with glowing lanterns across key serpentine & summit gateways.
 * - 1,100 instanced Japanese cedar pines & autumn crimson-gold Momiji maple trees seated cleanly on mesh height.
 * - 160 glowing Ikaho Onsen foothill Japanese Ryokan inns lining Sector 4's 2.55km valley super-straight!
 */
function buildSuperAkinaWorld(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  floorY: number,
  lakeNormal: THREE.CanvasTexture
): void {
  // 1. Fast 90m local spatial grid over all spline samples (stride 2) for strict zero-clipping roadbed carving!
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of spline.samples) {
    if (s.pos.x < minX) minX = s.pos.x;
    if (s.pos.x > maxX) maxX = s.pos.x;
    if (s.pos.z < minZ) minZ = s.pos.z;
    if (s.pos.z > maxZ) maxZ = s.pos.z;
  }

  const cellSize = 90;
  const gridMap = new Map<number, number[]>();
  for (let i = 0; i < spline.sampleCount; i += 2) {
    const p = spline.samples[i].pos;
    const gx = Math.floor(p.x / cellSize);
    const gz = Math.floor(p.z / cellSize);
    const key = ((gx + 4096) << 13) | (gz + 4096);
    let b = gridMap.get(key);
    if (!b) {
      b = [];
      gridMap.set(key, b);
    }
    b.push(i);
  }

  const hw = spline.halfWidth;
  const queryRoadEnvelope = (wx: number, wz: number) => {
    const gx = Math.floor(wx / cellSize);
    const gz = Math.floor(wz / cellSize);
    let minDistSq = Infinity;
    let nearestY = 120;
    let strictSafeFloor = Infinity;
    const hardRadiusSq = (hw + 25) * (hw + 25);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const bucket = gridMap.get(((gx + ox + 4096) << 13) | (gz + oz + 4096));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const s = spline.samples[bucket[k]];
          const dx = s.pos.x - wx;
          const dz = s.pos.z - wz;
          const dSq = dx * dx + dz * dz;
          if (dSq < minDistSq) {
            minDistSq = dSq;
            nearestY = s.pos.y;
          }
          if (dSq < hardRadiusSq) {
            const bankDrop = hw * Math.sin(Math.abs(s.bank));
            // Extra 10.5m clearance margin guarantees zero terrain clipping even under 35° banked -12.6% plunges!
            const floor = s.pos.y - bankDrop - 10.5;
            if (floor < strictSafeFloor) strictSafeFloor = floor;
          }
        }
      }
    }
    return {
      minDist: minDistSq === Infinity ? 999 : Math.sqrt(minDistSq),
      strictSafeFloor,
      nearestY,
    };
  };

  // 2. Sculpted 240x240 Dramatic Nocturnal Akina Canyon Gorge + Mt. Haruna Fuji Peak + Lake Haruna Crater
  // Faithfully captures original Akina's intimate, towering V-shaped dark mountain walls rising steeply beside the road!
  const margin = 640;
  const widthX = maxX - minX + margin * 2;
  const depthZ = maxZ - minZ + margin * 2;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const segs = 240;

  const terrGeo = new THREE.PlaneGeometry(widthX, depthZ, segs, segs);
  terrGeo.rotateX(-Math.PI / 2);
  const posAttr = terrGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const terrHeights = new Float32Array((segs + 1) * (segs + 1));

  // Iconic Mount Haruna geography inside the vast central bowl
  const peakX = 1620;
  const peakZ = -940;
  const lakeX = 640;
  const lakeZ = -960;
  const lakeY = 204;
  const lakeRadius = 460;

  const cCedarValley = new THREE.Color(0x07120e);
  const cBasaltSlope = new THREE.Color(0x0c1916);
  const cDarkRidge = new THREE.Color(0x132028);
  const cAlpineGranite = new THREE.Color(0x1f2b3a);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + centerX;
    const wz = posAttr.getZ(i) + centerZ;
    const env = queryRoadEnvelope(wx, wz);

    // Multi-octave craggy Japanese alpine ridge noise (matches original Akina's sculpted mountain silhouettes!)
    const fbm01 =
      (Math.sin(wx * 0.0038 + 1.1) * Math.cos(wz * 0.0035 - 0.7) +
        Math.sin(wx * 0.0088 - wz * 0.0071 + 2.3) * 0.52 +
        Math.cos(wx * 0.017 + wz * 0.015) * 0.24) *
        0.5 +
      0.5; // ~0..1

    // Steep, looming dark mountain canyon walls rising sharply right outside BOTH sides of every serpentine pass!
    const canyonLift = smoothstep(hw + 20, hw + 115, env.minDist) * (135 + fbm01 * 155);

    // Towering Mount Haruna Fuji volcanic peak + dramatic outer mountain walls framing the dark indigo night sky!
    const distPeak = Math.hypot(wx - peakX, wz - peakZ);
    const harunaPeak = Math.exp(-(distPeak * distPeak) / (560 * 560)) * 270;
    const rimNorth = smoothstep(-2150, -2850, wz) * 180;
    const rimEast = smoothstep(3620, 4350, wx) * 190;
    const rimWest = smoothstep(-2380, -3050, wx) * 185;
    const rimSouth = smoothstep(2620, 3300, wz) * 165;

    // Anchor steep gorge walls directly relative to local road elevation so EVERY sector (high summit AND deep valley)
    // feels intimately enclosed by towering nocturnal Akina cliffs!
    const roadBase = env.minDist < 420 ? env.nearestY - 12 : 45 + smoothstep(2350, -1400, wz) * 175;
    let h = roadBase + canyonLift + harunaPeak + rimNorth + rimEast + rimWest + rimSouth;

    // Sculpt smooth volcanic crater depression for Lake Haruna beneath lakeY=204m!
    const distLake = Math.hypot(wx - lakeX, wz - lakeZ);
    if (distLake < lakeRadius + 150) {
      const basinMask = 1 - smoothstep(lakeRadius - 65, lakeRadius + 145, distLake);
      const lakeBed = lakeY - 22;
      h = h * (1 - basinMask) + Math.min(h, lakeBed) * basinMask;
    }

    // Strict multi-sample zero-clipping roadbed carve (>= 10.5m below lowest banked edge!)
    const clearInner = hw + 17;
    const clearOuter = hw + 62;
    if (env.minDist < clearOuter) {
      const targetFloor = env.strictSafeFloor < Infinity ? env.strictSafeFloor : env.nearestY - 13.5;
      const blend = smoothstep(clearInner, clearOuter, env.minDist);
      h = Math.min(h, targetFloor + (Math.max(h, targetFloor) - targetFloor) * blend);
    }
    if (env.strictSafeFloor < Infinity) {
      h = Math.min(h, env.strictSafeFloor);
    }

    posAttr.setY(i, h);
    terrHeights[i] = h;

    // Authentic moody nocturnal Japanese cedar & dark volcanic basalt shading (matches original Akina Pass!)
    const relElev = clamp((h - (roadBase - 15)) / 240, 0, 1);
    const grain = (Math.sin(wx * 0.13) * Math.cos(wz * 0.13) * 0.5 + 0.5) * 0.022;
    if (relElev < 0.36) {
      tmpColor.copy(cCedarValley).lerp(cBasaltSlope, relElev / 0.36);
    } else if (relElev < 0.74) {
      tmpColor.copy(cBasaltSlope).lerp(cDarkRidge, (relElev - 0.36) / 0.38);
    } else {
      tmpColor.copy(cDarkRidge).lerp(cAlpineGranite, (relElev - 0.74) / 0.26);
    }
    colors[i * 3] = tmpColor.r + grain * 0.6;
    colors[i * 3 + 1] = tmpColor.g + grain;
    colors[i * 3 + 2] = tmpColor.b + grain * 0.8;
  }

  terrGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrGeo.computeVertexNormals();

  const terrTex = createConcreteTexture();
  terrTex.repeat.set(84, 84);
  const terrMat = new THREE.MeshStandardMaterial({
    map: terrTex,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
    envMapIntensity: 0.15,
  });
  const terrMesh = new THREE.Mesh(terrGeo, terrMat);
  terrMesh.position.set(centerX, 0, centerZ);
  group.add(terrMesh);
  disposables.push(terrTex, terrGeo, terrMat);

  const sampleMeshY = (wx: number, wz: number): number => {
    const fx = ((wx - (centerX - widthX * 0.5)) / widthX) * segs;
    const fz = ((wz - (centerZ - depthZ * 0.5)) / depthZ) * segs;
    const ix = clamp(Math.floor(fx), 0, segs - 1);
    const iz = clamp(Math.floor(fz), 0, segs - 1);
    const tx = clamp(fx - ix, 0, 1);
    const tz = clamp(fz - iz, 0, 1);
    const stride = segs + 1;
    const h00 = terrHeights[iz * stride + ix];
    const h10 = terrHeights[iz * stride + ix + 1];
    const h01 = terrHeights[(iz + 1) * stride + ix];
    const h11 = terrHeights[(iz + 1) * stride + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };

  // 3. Shimmering Moonlit Alpine Lake Haruna Water Surface (nestled cleanly inside the summit crater!)
  const lakeGeo = new THREE.CircleGeometry(lakeRadius, 56);
  lakeGeo.rotateX(-Math.PI / 2);
  const lakeMat = new THREE.MeshStandardMaterial({
    color: 0x09203a,
    normalMap: lakeNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.18,
    metalness: 0.62,
    envMapIntensity: 1.35,
  });
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.position.set(lakeX, lakeY, lakeZ);
  group.add(lakeMesh);
  disposables.push(lakeGeo, lakeMat);

  // 4. Iconic Akina Summit Water Tower & Pass Overlook Tea Pavilion right beside Start/Finish!
  const steelTowerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.68 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5, metalness: 0.25 });
  const redBandMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.52, metalness: 0.14 });
  const darkTimberMat = new THREE.MeshStandardMaterial({ color: 0x2a1f19, roughness: 0.88 });
  const kawaraRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.62, metalness: 0.25 });
  const warmShojiMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffcc70).multiplyScalar(1.65),
    toneMapped: false,
  });
  const beaconAmberMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xf97316).multiplyScalar(2.2),
    toneMapped: false,
  });
  disposables.push(steelTowerMat, tankMat, redBandMat, darkTimberMat, kawaraRoofMat, warmShojiMat, beaconAmberMat);

  // Summit Water Tower on the West shoulder of Start Straight (s = 82m, d = -42m)
  const wtFrame = spline.getFrameAtDistance(82);
  const wtPos = wtFrame.pos.clone().addScaledVector(wtFrame.flatRight, -42);
  if (queryRoadEnvelope(wtPos.x, wtPos.z).minDist > hw + 18) {
    const wtGroup = new THREE.Group();
    const wtBaseY = Math.max(floorY, wtFrame.pos.y - 6);
    wtGroup.position.set(wtPos.x, wtBaseY, wtPos.z);

    const wtLegGeo = new THREE.CylinderGeometry(0.45, 0.65, 24, 8);
    const wtTankGeo = new THREE.CylinderGeometry(5.6, 5.6, 9.2, 20);
    const wtBandGeo = new THREE.CylinderGeometry(5.72, 5.72, 1.8, 20);
    const wtDomeGeo = new THREE.ConeGeometry(5.8, 3.4, 20);
    const wtLampGeo = new THREE.SphereGeometry(0.8, 8, 8);
    disposables.push(wtLegGeo, wtTankGeo, wtBandGeo, wtDomeGeo, wtLampGeo);

    for (const [lx, lz] of [
      [-3.4, -3.4],
      [3.4, -3.4],
      [-3.4, 3.4],
      [3.4, 3.4],
    ]) {
      const leg = new THREE.Mesh(wtLegGeo, steelTowerMat);
      leg.position.set(lx, 12, lz);
      wtGroup.add(leg);
    }
    const tank = new THREE.Mesh(wtTankGeo, tankMat);
    tank.position.y = 28.4;
    const band = new THREE.Mesh(wtBandGeo, redBandMat);
    band.position.y = 28.4;
    const dome = new THREE.Mesh(wtDomeGeo, steelTowerMat);
    dome.position.y = 34.7;
    const lamp = new THREE.Mesh(wtLampGeo, beaconAmberMat);
    lamp.position.y = 36.8;
    wtGroup.add(tank, band, dome, lamp);
    group.add(wtGroup);
  }

  // Warm-lit Akina Pass Timber Rest Pavilion on the East overlook facing Lake Haruna (s = 128m, d = +40m)
  const pavFrame = spline.getFrameAtDistance(128);
  const pavPos = pavFrame.pos.clone().addScaledVector(pavFrame.flatRight, 40);
  if (queryRoadEnvelope(pavPos.x, pavPos.z).minDist > hw + 18) {
    const pavGroup = new THREE.Group();
    pavGroup.position.set(pavPos.x, Math.max(floorY, pavFrame.pos.y - 4.5), pavPos.z);
    pavGroup.rotation.y = Math.atan2(pavFrame.tangent.x, pavFrame.tangent.z);

    const pBody = new THREE.Mesh(new THREE.BoxGeometry(16, 6.2, 10), darkTimberMat);
    pBody.position.y = 3.1;
    const pWin = new THREE.Mesh(new THREE.BoxGeometry(16.25, 2.2, 8.2), warmShojiMat);
    pWin.position.y = 3.4;
    const pRoof = new THREE.Mesh(new THREE.ConeGeometry(12.2, 4.6, 4), kawaraRoofMat);
    pRoof.rotation.y = Math.PI / 4;
    pRoof.scale.set(1.18, 1, 0.78);
    pRoof.position.y = 8.5;
    disposables.push(pBody.geometry, pWin.geometry, pRoof.geometry);
    pavGroup.add(pBody, pWin, pRoof);
    group.add(pavGroup);
  }

  // 5. 9 Traditional Vermilion Shinto Torii Gates (鳥居) straddling Key Serpentine & Summit Gateways!
  const blackEaveMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.2 });
  const tLegGeo = new THREE.CylinderGeometry(0.65, 0.82, 15.0, 10);
  const tKasagiGeo = new THREE.BoxGeometry(spline.roadWidth + 10.6, 1.15, 1.6);
  const tEaveGeo = new THREE.BoxGeometry(spline.roadWidth + 11.6, 0.45, 1.9);
  const tNukiGeo = new THREE.BoxGeometry(spline.roadWidth + 6.0, 0.74, 1.0);
  const tLanternGeo = new THREE.BoxGeometry(0.7, 1.25, 0.7);
  disposables.push(blackEaveMat, tLegGeo, tKasagiGeo, tEaveGeo, tNukiGeo, tLanternGeo);

  const basis = new THREE.Matrix4();
  const gateHalfW = hw + 2.2;
  for (const gt of [0.072, 0.155, 0.248, 0.352, 0.472, 0.682, 0.778, 0.875, 0.986]) {
    if (spline.isInTunnel(gt)) continue;
    const f = spline.getFrameAtDistance(gt * spline.totalLength);
    const gate = new THREE.Group();
    gate.position.copy(f.pos);
    basis.makeBasis(f.right, f.up, f.tangent.clone().negate());
    gate.quaternion.setFromRotationMatrix(basis);

    const lL = new THREE.Mesh(tLegGeo, redBandMat);
    lL.position.set(-gateHalfW, 7.5, 0);
    const lR = new THREE.Mesh(tLegGeo, redBandMat);
    lR.position.set(gateHalfW, 7.5, 0);
    const kasagi = new THREE.Mesh(tKasagiGeo, redBandMat);
    kasagi.position.set(0, 14.9, 0);
    const eave = new THREE.Mesh(tEaveGeo, blackEaveMat);
    eave.position.set(0, 15.6, 0);
    const nuki = new THREE.Mesh(tNukiGeo, redBandMat);
    nuki.position.set(0, 12.1, 0);
    const lanL = new THREE.Mesh(tLanternGeo, warmShojiMat);
    lanL.position.set(-gateHalfW + 1.3, 10.9, 0);
    const lanR = new THREE.Mesh(tLanternGeo, warmShojiMat);
    lanR.position.set(gateHalfW - 1.3, 10.9, 0);

    gate.add(lL, lR, kasagi, eave, nuki, lanL, lanR);
    group.add(gate);
  }

  // 6. 1,650 Dense 3-Tier Layered Japanese Cedar Pines + Subtle Nocturnal Autumn Maples framing the Gorge Walls!
  const trunkGeo = new THREE.CylinderGeometry(0.36, 0.58, 4.8, 7);
  const pine1Geo = new THREE.ConeGeometry(3.8, 8.8, 10);
  const pine2Geo = new THREE.ConeGeometry(2.9, 7.6, 10);
  const pine3Geo = new THREE.ConeGeometry(1.9, 6.0, 10);
  const mapleCrownGeo = new THREE.DodecahedronGeometry(3.6, 1);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x302118, roughness: 0.94, envMapIntensity: 0.2 });
  const pineDarkMat = new THREE.MeshStandardMaterial({ color: 0x122f23, roughness: 0.91, envMapIntensity: 0.24 });
  const pineMidMat = new THREE.MeshStandardMaterial({ color: 0x193e2e, roughness: 0.89, envMapIntensity: 0.24 });
  const mapleRedMat = new THREE.MeshStandardMaterial({ color: 0x7c2520, roughness: 0.87, envMapIntensity: 0.22 });
  disposables.push(
    trunkGeo,
    pine1Geo,
    pine2Geo,
    pine3Geo,
    mapleCrownGeo,
    trunkMat,
    pineDarkMat,
    pineMidMat,
    mapleRedMat
  );

  const cedars: { x: number; y: number; z: number; s: number }[] = [];
  const maplesRed: { x: number; y: number; z: number; s: number }[] = [];

  for (let i = 0; i < 9200 && cedars.length + maplesRed.length < 1650; i++) {
    const sample = spline.samples[Math.floor(rand() * spline.sampleCount)];
    const side = rand() > 0.5 ? 1 : -1;
    // Perched closely along the steep canyon slopes just like original Akina Pass!
    const offset = hw + 11.5 + rand() * 72;
    const wx = sample.pos.x + sample.flatRight.x * side * offset + (rand() - 0.5) * 16;
    const wz = sample.pos.z + sample.flatRight.z * side * offset + (rand() - 0.5) * 16;

    if (Math.hypot(wx - lakeX, wz - lakeZ) < lakeRadius + 28) continue;
    const env = queryRoadEnvelope(wx, wz);
    if (env.minDist < hw + 12.0) continue;

    const wy = sampleMeshY(wx, wz);
    if (wy < floorY + 2 || wy > 460) continue;

    const sc = 0.95 + rand() * 1.35;
    if (rand() < 0.86) {
      cedars.push({ x: wx, y: wy - 1.2, z: wz, s: sc });
    } else {
      maplesRed.push({ x: wx, y: wy - 1.0, z: wz, s: sc * 0.92 });
    }
  }

  const dummy = new THREE.Object3D();
  if (cedars.length > 0) {
    const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, cedars.length);
    const c1Inst = new THREE.InstancedMesh(pine1Geo, pineDarkMat, cedars.length);
    const c2Inst = new THREE.InstancedMesh(pine2Geo, pineMidMat, cedars.length);
    const c3Inst = new THREE.InstancedMesh(pine3Geo, pineDarkMat, cedars.length);
    cedars.forEach((tr, idx) => {
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(tr.s);
      dummy.position.set(tr.x, tr.y + 2.4 * tr.s, tr.z);
      dummy.updateMatrix();
      tInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(tr.x, tr.y + 7.2 * tr.s, tr.z);
      dummy.updateMatrix();
      c1Inst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(tr.x, tr.y + 11.4 * tr.s, tr.z);
      dummy.updateMatrix();
      c2Inst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(tr.x, tr.y + 15.0 * tr.s, tr.z);
      dummy.updateMatrix();
      c3Inst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(tInst, c1Inst, c2Inst, c3Inst);
  }

  if (maplesRed.length > 0) {
    const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, maplesRed.length);
    const mInst = new THREE.InstancedMesh(mapleCrownGeo, mapleRedMat, maplesRed.length);
    maplesRed.forEach((tr, idx) => {
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(tr.s);
      dummy.position.set(tr.x, tr.y + 2.3 * tr.s, tr.z);
      dummy.updateMatrix();
      tInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(tr.x, tr.y + 6.4 * tr.s, tr.z);
      dummy.scale.set(tr.s * 1.12, tr.s * 0.86, tr.s * 1.12);
      dummy.updateMatrix();
      mInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(tInst, mInst);
  }

  // 7. Glowing Ikaho Onsen Night Town (160 Japanese Timber Ryokan Inns lining Sector 4's 2.55km Super-Straight!)
  const innWallGeo = new THREE.BoxGeometry(1, 1, 1);
  const innRoofGeo = new THREE.ConeGeometry(0.78, 0.52, 4);
  innRoofGeo.rotateY(Math.PI / 4);
  const innWinGeo = new THREE.BoxGeometry(1.03, 0.18, 1.03);
  disposables.push(innWallGeo, innRoofGeo, innWinGeo);

  const inns: { x: number; y: number; z: number; w: number; h: number; d: number; rotY: number }[] = [];
  for (let i = 0; i < 1600 && inns.length < 160; i++) {
    const t = 0.604 + rand() * 0.066; // Right along Ikaho Valley Super-Straight #2 after Tunnel #1!
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const side = rand() > 0.5 ? 1 : -1;
    const w = 10 + rand() * 9;
    const d = 8.5 + rand() * 7;
    const h = 7.5 + rand() * 8.5;
    const offset = hw + 20 + Math.max(w, d) * 0.55 + rand() * 95;
    const ix = f.pos.x + f.flatRight.x * side * offset + (rand() - 0.5) * 18;
    const iz = f.pos.z + f.flatRight.z * side * offset + (rand() - 0.5) * 18;
    if (queryRoadEnvelope(ix, iz).minDist < hw + Math.max(w, d) * 0.72 + 12) continue;
    const iy = Math.max(floorY, sampleMeshY(ix, iz) - 0.6);
    inns.push({
      x: ix,
      y: iy,
      z: iz,
      w,
      h,
      d,
      rotY: Math.atan2(f.tangent.x, f.tangent.z) + (rand() - 0.5) * 0.18,
    });
  }

  if (inns.length > 0) {
    const wInst = new THREE.InstancedMesh(innWallGeo, darkTimberMat, inns.length);
    const rInst = new THREE.InstancedMesh(innRoofGeo, kawaraRoofMat, inns.length);
    const l1Inst = new THREE.InstancedMesh(innWinGeo, warmShojiMat, inns.length);
    const l2Inst = new THREE.InstancedMesh(innWinGeo, warmShojiMat, inns.length);
    inns.forEach((b, idx) => {
      dummy.rotation.set(0, b.rotY, 0);
      dummy.position.set(b.x, b.y + b.h * 0.5, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      wInst.setMatrixAt(idx, dummy.matrix);

      const roofH = b.h * 0.44;
      dummy.position.set(b.x, b.y + b.h + roofH * 0.5, b.z);
      dummy.scale.set(b.w * 1.15, roofH, b.d * 1.15);
      dummy.updateMatrix();
      rInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(b.x, b.y + b.h * 0.34, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      l1Inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(b.x, b.y + b.h * 0.72, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      l2Inst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(wInst, rInst, l1Inst, l2Inst);
  }
}
