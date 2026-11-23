import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import {
  createBuildingTexture,
  createCyberGridTexture,
  createSkyTexture,
} from '../utils/textures';
import { createSeededRandom } from '../utils/math';

export interface SceneryBuildResult {
  group: THREE.Group;
  update: (dt: number, elapsed: number, camPos: THREE.Vector3) => void;
  dispose: () => void;
}

export function buildScenery(spline: TrackSpline): SceneryBuildResult {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const cfg = spline.config;
  const rand = createSeededRandom(cfg.id.length * 9137 + 42);

  // 1. Procedural Synthwave Sky Dome (follows camera XZ so horizon stays infinitely epic)
  const skyTex = createSkyTexture(cfg.skyTopHex, cfg.skyMidHex, cfg.skyHorizonHex, cfg.sunColorHex);
  const skyGeo = new THREE.SphereGeometry(2200, 40, 24);
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

  // 2. Vast Cyber Horizon Grid / Shimmering Neon Ocean Plane
  const gridColor =
    cfg.theme === 'bridge' ? '#00e5ff' : cfg.theme === 'tunnel' ? '#9333ea' : '#ff2a9d';
  const gridBg =
    cfg.theme === 'bridge' ? '#03122a' : cfg.theme === 'tunnel' ? '#070312' : '#090418';
  const groundTex = createCyberGridTexture(gridColor, gridBg);
  const groundGeo = new THREE.PlaneGeometry(5200, 5200);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshBasicMaterial({
    map: groundTex,
    transparent: true,
    opacity: cfg.theme === 'bridge' ? 0.92 : 0.72,
  });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.position.y = cfg.theme === 'bridge' ? -1.5 : cfg.theme === 'tunnel' ? -44 : -18;
  group.add(groundPlane);
  disposables.push(groundTex, groundGeo, groundMat);

  // 3. Track Tunnel Hexagonal Neon Ribs (for all tracks that have tunnelZones!)
  if (cfg.tunnelZones.length > 0) {
    buildTunnelRibs(spline, group, disposables);
  }

  // 4. Support Pillars under elevated track sections (city & bridge)
  if (cfg.theme === 'city' || cfg.theme === 'bridge') {
    const pillarPositions: { x: number; yTop: number; z: number; h: number }[] = [];
    const floorY = groundPlane.position.y;
    for (let i = 0; i < spline.sampleCount; i += 24) {
      const f = spline.samples[i];
      const h = f.pos.y - floorY - 2.2;
      if (h > 4) {
        pillarPositions.push({ x: f.pos.x, yTop: f.pos.y - 2.2, z: f.pos.z, h });
      }
    }
    if (pillarPositions.length > 0) {
      const pGeo = new THREE.BoxGeometry(3.2, 1, 3.2);
      const pMat = new THREE.MeshStandardMaterial({
        color: 0x0d1428,
        metalness: 0.8,
        roughness: 0.35,
      });
      const pInst = new THREE.InstancedMesh(pGeo, pMat, pillarPositions.length);
      const dummy = new THREE.Object3D();
      pillarPositions.forEach((p, idx) => {
        dummy.position.set(p.x, p.yTop - p.h * 0.5, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, p.h, 1);
        dummy.updateMatrix();
        pInst.setMatrixAt(idx, dummy.matrix);
      });
      group.add(pInst);
      disposables.push(pGeo, pMat);
    }
  }

  // 5. Theme-Specific World Architecture
  const animatedRings: THREE.Mesh[] = [];

  if (cfg.theme === 'city') {
    buildCyberCity(spline, group, disposables, rand, groundPlane.position.y, animatedRings);
  } else if (cfg.theme === 'bridge') {
    buildSuspensionBridgeScenery(spline, group, disposables, rand, groundPlane.position.y);
  } else {
    buildUndergroundCavernScenery(spline, group, disposables, rand, animatedRings);
  }

  return {
    group,
    update: (dt: number, elapsed: number, camPos: THREE.Vector3) => {
      skyDome.position.set(camPos.x, 0, camPos.z);
      if (cfg.theme === 'bridge') {
        groundTex.offset.y += dt * 0.14;
        groundTex.offset.x = Math.sin(elapsed * 0.4) * 0.12;
      }
      for (let i = 0; i < animatedRings.length; i++) {
        animatedRings[i].rotation.z = elapsed * (i % 2 === 0 ? 0.5 : -0.4);
      }
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

function buildTunnelRibs(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[]
): void {
  const cfg = spline.config;
  const ribFrames: number[] = [];
  const step = 4; // every ~8-10 meters
  for (let i = 0; i < spline.sampleCount; i += step) {
    const t = i / spline.sampleCount;
    if (spline.isInTunnel(t)) {
      ribFrames.push(i);
    }
  }
  if (ribFrames.length === 0) return;

  // Hexagonal arch rib geometry spanning across roadWidth
  const radius = spline.halfWidth + 2.8;
  const shape = new THREE.Shape();
  const outerR = radius + 1.6;
  const innerR = radius;
  const angles = [-0.08, Math.PI * 0.22, Math.PI * 0.5, Math.PI * 0.78, Math.PI + 0.08];

  shape.moveTo(Math.cos(angles[0]) * outerR, Math.sin(angles[0]) * outerR);
  for (let i = 1; i < angles.length; i++) {
    shape.lineTo(Math.cos(angles[i]) * outerR, Math.sin(angles[i]) * outerR);
  }
  for (let i = angles.length - 1; i >= 0; i--) {
    shape.lineTo(Math.cos(angles[i]) * innerR, Math.sin(angles[i]) * innerR);
  }
  shape.closePath();

  const ribGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
  ribGeo.translate(0, 0, -0.75);

  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x0b0a1f,
    metalness: 0.85,
    roughness: 0.3,
  });

  // Inner glowing neon hex ring
  const glowShape = new THREE.Shape();
  const gOut = innerR + 0.1;
  const gIn = innerR - 0.38;
  glowShape.moveTo(Math.cos(angles[0]) * gOut, Math.sin(angles[0]) * gOut);
  for (let i = 1; i < angles.length; i++) {
    glowShape.lineTo(Math.cos(angles[i]) * gOut, Math.sin(angles[i]) * gOut);
  }
  for (let i = angles.length - 1; i >= 0; i--) {
    glowShape.lineTo(Math.cos(angles[i]) * gIn, Math.sin(angles[i]) * gIn);
  }
  glowShape.closePath();

  const glowGeo = new THREE.ExtrudeGeometry(glowShape, { depth: 0.45, bevelEnabled: false });
  glowGeo.translate(0, 0, -0.225);

  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(cfg.railLeftColor).multiplyScalar(1.25),
    toneMapped: false,
  });

  const ribInst = new THREE.InstancedMesh(ribGeo, ribMat, ribFrames.length);
  const glowInst = new THREE.InstancedMesh(glowGeo, glowMat, ribFrames.length);

  const dummy = new THREE.Object3D();
  const basisMat = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  ribFrames.forEach((sampleIdx, idx) => {
    const f = spline.samples[sampleIdx];
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    q.setFromRotationMatrix(basisMat);
    dummy.position.copy(f.pos);
    dummy.quaternion.copy(q);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ribInst.setMatrixAt(idx, dummy.matrix);
    glowInst.setMatrixAt(idx, dummy.matrix);
  });

  group.add(ribInst, glowInst);
  disposables.push(ribGeo, ribMat, glowGeo, glowMat);
}

function buildCyberCity(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  floorY: number,
  animatedRings: THREE.Mesh[]
): void {
  const bldgTex = createBuildingTexture('#00f2ff', '#ff2a9d');
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgTex,
    emissive: 0x3b1f66,
    emissiveMap: bldgTex,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    metalness: 0.7,
  });

  const crownGeo = new THREE.BoxGeometry(1.04, 1.4, 1.04);
  const crownMatA = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00f2ff).multiplyScalar(1.9),
    toneMapped: false,
  });
  const crownMatB = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff2a9d).multiplyScalar(1.9),
    toneMapped: false,
  });
  disposables.push(bldgTex, bldgGeo, bldgMat, crownGeo, crownMatA, crownMatB);

  const placements: { x: number; z: number; w: number; d: number; h: number; alt: boolean }[] = [];

  // Scatter dense skyline all around and inside the track loop while maintaining safe road clearance
  let attempts = 0;
  while (placements.length < 185 && attempts < 1400) {
    attempts++;
    const x = -280 + rand() * 1160;
    const z = -740 + rand() * 1420;
    const dist = spline.minHorizontalDistanceToTrack(x, z);
    const w = 18 + rand() * 34;
    const d = 18 + rand() * 34;
    const clearance = spline.halfWidth + Math.max(w, d) * 0.72 + 12;
    if (dist < clearance) continue;

    // Taller mega-towers further away, mid-rise closer for framing
    const h = dist > 110 ? 75 + rand() * 175 : 42 + rand() * 105;
    placements.push({ x, z, w, d, h, alt: rand() > 0.5 });
  }

  const bldgInst = new THREE.InstancedMesh(bldgGeo, bldgMat, placements.length);
  const crownA = new THREE.InstancedMesh(crownGeo, crownMatA, placements.length);
  const crownB = new THREE.InstancedMesh(crownGeo, crownMatB, placements.length);

  const dummy = new THREE.Object3D();
  let cA = 0, cB = 0;

  placements.forEach((b, i) => {
    dummy.position.set(b.x, floorY + b.h * 0.5, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.updateMatrix();
    bldgInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(b.x, floorY + b.h + 0.7, b.z);
    dummy.scale.set(b.w, 1, b.d);
    dummy.updateMatrix();
    if (b.alt) {
      crownA.setMatrixAt(cA++, dummy.matrix);
    } else {
      crownB.setMatrixAt(cB++, dummy.matrix);
    }
  });
  crownA.count = cA;
  crownB.count = cB;
  group.add(bldgInst, crownA, crownB);

  // Giant Floating Cyber Halo Rings over iconic curves
  const ringGeo = new THREE.TorusGeometry(28, 0.7, 10, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff2a9d).multiplyScalar(1.7),
    toneMapped: false,
  });
  disposables.push(ringGeo, ringMat);

  for (const t of [0.22, 0.52, 0.76]) {
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(f.pos).addScaledVector(f.up, 16);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate());
    ring.quaternion.setFromRotationMatrix(basis);
    group.add(ring);
    animatedRings.push(ring);
  }
}

function buildSuspensionBridgeScenery(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  waterY: number
): void {
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x0e1d36,
    metalness: 0.85,
    roughness: 0.25,
  });
  const neonCyan = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00ffe5).multiplyScalar(1.25),
    toneMapped: false,
  });
  const neonPink = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xff4ecd).multiplyScalar(1.35),
    toneMapped: false,
  });
  disposables.push(towerMat, neonCyan, neonPink);

  // Two colossal cable-stayed suspension pylons on the main bridge straight
  const pylonTs = [0.055, 0.145];
  const legGeo = new THREE.BoxGeometry(3.2, 118, 4.2);
  const braceGeo = new THREE.BoxGeometry(spline.roadWidth + 10, 3.0, 3.0);
  const beaconGeo = new THREE.SphereGeometry(2.2, 12, 12);
  const cableGeo = new THREE.CylinderGeometry(0.18, 0.18, 1, 6);
  disposables.push(legGeo, braceGeo, beaconGeo, cableGeo);

  for (const pt of pylonTs) {
    const f = spline.getFrameAtDistance(pt * spline.totalLength);
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(f.pos.x, waterY, f.pos.z);
    const basis = new THREE.Matrix4().makeBasis(f.flatRight, new THREE.Vector3(0, 1, 0), f.tangent.clone().negate());
    pylonGroup.quaternion.setFromRotationMatrix(basis);

    const halfSpan = spline.halfWidth + 3.2;
    const leftLeg = new THREE.Mesh(legGeo, towerMat);
    leftLeg.position.set(-halfSpan, 59, 0);
    const rightLeg = new THREE.Mesh(legGeo, towerMat);
    rightLeg.position.set(halfSpan, 59, 0);

    const brace1 = new THREE.Mesh(braceGeo, towerMat);
    brace1.position.set(0, 46, 0);
    const brace2 = new THREE.Mesh(braceGeo, neonCyan);
    brace2.position.set(0, 88, 0);
    const brace3 = new THREE.Mesh(braceGeo, towerMat);
    brace3.position.set(0, 114, 0);

    const b1 = new THREE.Mesh(beaconGeo, neonPink);
    b1.position.set(-halfSpan, 120, 0);
    const b2 = new THREE.Mesh(beaconGeo, neonPink);
    b2.position.set(halfSpan, 120, 0);

    pylonGroup.add(leftLeg, rightLeg, brace1, brace2, brace3, b1, b2);

    // Diagonal illuminated stay cables fanning along bridge deck
    const deckY = f.pos.y - waterY + 1.2;
    for (const side of [-1, 1]) {
      for (let c = 1; c <= 6; c++) {
        for (const dir of [-1, 1]) {
          const topPt = new THREE.Vector3(side * halfSpan, 64 + c * 8, 0);
          const botPt = new THREE.Vector3(side * (spline.halfWidth + 0.8), deckY, dir * c * 18);
          const delta = botPt.clone().sub(topPt);
          const len = delta.length();
          const cable = new THREE.Mesh(cableGeo, neonCyan);
          cable.scale.set(1, len, 1);
          cable.position.copy(topPt).addScaledVector(delta, 0.5);
          cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
          pylonGroup.add(cable);
        }
      }
    }

    group.add(pylonGroup);
  }

  // Distant coastal cyber city skyline + glowing ocean beacons
  const bldgTex = createBuildingTexture('#00ffe5', '#5b7cff');
  const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
  const bldgMat = new THREE.MeshStandardMaterial({
    map: bldgTex,
    emissive: 0x0b2e5e,
    emissiveMap: bldgTex,
    emissiveIntensity: 0.95,
  });
  disposables.push(bldgTex, bldgGeo, bldgMat);

  const skylineCount = 95;
  const skylineInst = new THREE.InstancedMesh(bldgGeo, bldgMat, skylineCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < 600 && placed < skylineCount; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = 520 + rand() * 520;
    const x = 220 + Math.cos(angle) * rad;
    const z = -220 + Math.sin(angle) * rad;
    if (spline.minHorizontalDistanceToTrack(x, z) < 120) continue;
    const w = 24 + rand() * 44;
    const h = 45 + rand() * 195;
    dummy.position.set(x, waterY + h * 0.5, z);
    dummy.scale.set(w, h, w);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    skylineInst.setMatrixAt(placed++, dummy.matrix);
  }
  skylineInst.count = placed;
  group.add(skylineInst);

  // Floating ocean light buoys
  const buoyGeo = new THREE.OctahedronGeometry(2.6, 0);
  const buoyInst = new THREE.InstancedMesh(buoyGeo, neonCyan, 70);
  let bIdx = 0;
  for (let i = 0; i < 300 && bIdx < 70; i++) {
    const x = -220 + rand() * 980;
    const z = -900 + rand() * 1350;
    const d = spline.minHorizontalDistanceToTrack(x, z);
    if (d < 36 || d > 260) continue;
    dummy.position.set(x, waterY + 2.4, z);
    dummy.scale.set(1, 1.8, 1);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.updateMatrix();
    buoyInst.setMatrixAt(bIdx++, dummy.matrix);
  }
  buoyInst.count = bIdx;
  group.add(buoyInst);
  disposables.push(buoyGeo);
}

function buildUndergroundCavernScenery(
  spline: TrackSpline,
  group: THREE.Group,
  disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[],
  rand: () => number,
  animatedRings: THREE.Mesh[]
): void {
  // Glowing reactor monoliths & energy conduits inside subterranean caverns
  const monoGeo = new THREE.BoxGeometry(1, 1, 1);
  const monoMat = new THREE.MeshStandardMaterial({
    color: 0x0e0a24,
    emissive: 0x260c4d,
    emissiveIntensity: 0.65,
    metalness: 0.85,
    roughness: 0.25,
  });
  const stripGeo = new THREE.BoxGeometry(1.06, 0.9, 1.06);
  const stripMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00ffaa).multiplyScalar(1.85),
    toneMapped: false,
  });
  disposables.push(monoGeo, monoMat, stripGeo, stripMat);

  const monos: { x: number; y: number; z: number; w: number; h: number }[] = [];
  for (let i = 0; i < 900 && monos.length < 130; i++) {
    const x = -720 + rand() * 920;
    const z = -620 + rand() * 1180;
    const d = spline.minHorizontalDistanceToTrack(x, z);
    if (d < spline.halfWidth + 22) continue;
    const w = 14 + rand() * 24;
    const h = 75 + rand() * 140;
    monos.push({ x, y: -44 + h * 0.5, z, w, h });
  }

  const monoInst = new THREE.InstancedMesh(monoGeo, monoMat, monos.length);
  const stripInst = new THREE.InstancedMesh(stripGeo, stripMat, monos.length);
  const dummy = new THREE.Object3D();

  monos.forEach((m, idx) => {
    dummy.position.set(m.x, m.y, m.z);
    dummy.rotation.set(0, rand() * Math.PI * 0.25, 0);
    dummy.scale.set(m.w, m.h, m.w);
    dummy.updateMatrix();
    monoInst.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(m.x, m.y + m.h * 0.18, m.z);
    dummy.scale.set(m.w, 1.8, m.w);
    dummy.updateMatrix();
    stripInst.setMatrixAt(idx, dummy.matrix);
  });
  group.add(monoInst, stripInst);

  // Rotating reactor energy rings around open cavern jump zones
  const ringGeo = new THREE.TorusGeometry(24, 0.8, 8, 6);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xc026d3).multiplyScalar(1.9),
    toneMapped: false,
  });
  disposables.push(ringGeo, ringMat);

  for (const t of [0.31, 0.735]) {
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(f.pos).addScaledVector(f.up, 10);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate());
    ring.quaternion.setFromRotationMatrix(basis);
    group.add(ring);
    animatedRings.push(ring);
  }
}
