import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import {
  createBoostPadTexture,
  createChevronBannerTexture,
  createRampTexture,
  createRoadTexture,
  createStartFinishTexture,
} from '../utils/textures';

export interface TrackBuildResult {
  group: THREE.Group;
  boostTexture: THREE.CanvasTexture;
  countdownLights: THREE.MeshStandardMaterial[];
  update: (dt: number, elapsed: number) => void;
  setCountdownState: (stage: number) => void; // 0=off, 1=red1, 2=red2, 3=red3, 4=GREEN GO
  dispose: () => void;
}

export function buildTrackMesh(spline: TrackSpline): TrackBuildResult {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  const cfg = spline.config;
  const halfW = spline.halfWidth;
  const N = spline.sampleCount;

  // 1. Road Surface Ribbon Mesh
  const roadTex = createRoadTexture(cfg.asphaltTint, cfg.accentColorHex);
  disposables.push(roadTex);

  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const deckPositions: number[] = [];
  const deckNormals: number[] = [];
  const deckIndices: number[] = [];

  // Barrier walls + glowing neon rails along left and right edges
  const railLeftPos: number[] = [];
  const railRightPos: number[] = [];
  const railIndices: number[] = [];

  const wallPos: number[] = [];
  const wallNormals: number[] = [];
  const wallIndices: number[] = [];

  const tileLen = 22; // meters per UV repeat
  const vTmp = new THREE.Vector3();

  for (let i = 0; i <= N; i++) {
    const sample = spline.samples[i % N];
    const sDist = i === N ? spline.totalLength : sample.s;
    const vCoord = sDist / tileLen;

    // Road top left & right
    const leftEdge = vTmp.copy(sample.pos).addScaledVector(sample.right, -halfW).clone();
    const rightEdge = vTmp.copy(sample.pos).addScaledVector(sample.right, halfW).clone();

    roadPositions.push(leftEdge.x, leftEdge.y, leftEdge.z);
    roadPositions.push(rightEdge.x, rightEdge.y, rightEdge.z);
    roadNormals.push(sample.up.x, sample.up.y, sample.up.z);
    roadNormals.push(sample.up.x, sample.up.y, sample.up.z);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Solid under-deck cross section (4 vertices per slice: topL, topR, botR, botL)
    const deckDepth = 2.6;
    const deckInset = 1.4;
    const botL = leftEdge.clone().addScaledVector(sample.right, deckInset).addScaledVector(sample.up, -deckDepth);
    const botR = rightEdge.clone().addScaledVector(sample.right, -deckInset).addScaledVector(sample.up, -deckDepth);

    deckPositions.push(
      leftEdge.x, leftEdge.y - 0.05, leftEdge.z,
      rightEdge.x, rightEdge.y - 0.05, rightEdge.z,
      botR.x, botR.y, botR.z,
      botL.x, botL.y, botL.z
    );
    deckNormals.push(
      -sample.right.x, -sample.right.y, -sample.right.z,
      sample.right.x, sample.right.y, sample.right.z,
      -sample.up.x, -sample.up.y, -sample.up.z,
      -sample.up.x, -sample.up.y, -sample.up.z
    );

    // Outer low barrier wall (1.35m high) on both sides
    const wallH = 1.35;
    const lTop = leftEdge.clone().addScaledVector(sample.up, wallH);
    const rTop = rightEdge.clone().addScaledVector(sample.up, wallH);
    wallPos.push(
      leftEdge.x, leftEdge.y, leftEdge.z,
      lTop.x, lTop.y, lTop.z,
      rightEdge.x, rightEdge.y, rightEdge.z,
      rTop.x, rTop.y, rTop.z
    );
    wallNormals.push(
      sample.right.x, sample.right.y, sample.right.z,
      sample.right.x, sample.right.y, sample.right.z,
      -sample.right.x, -sample.right.y, -sample.right.z,
      -sample.right.x, -sample.right.y, -sample.right.z
    );

    // Glowing neon light strip tubes sitting on top of barriers (ribbon strip)
    const stripB = 0.92;
    const stripT = 1.38;
    const lStripB = leftEdge.clone().addScaledVector(sample.right, 0.12).addScaledVector(sample.up, stripB);
    const lStripT = leftEdge.clone().addScaledVector(sample.right, 0.12).addScaledVector(sample.up, stripT);
    const rStripB = rightEdge.clone().addScaledVector(sample.right, -0.12).addScaledVector(sample.up, stripB);
    const rStripT = rightEdge.clone().addScaledVector(sample.right, -0.12).addScaledVector(sample.up, stripT);

    railLeftPos.push(lStripB.x, lStripB.y, lStripB.z, lStripT.x, lStripT.y, lStripT.z);
    railRightPos.push(rStripB.x, rStripB.y, rStripB.z, rStripT.x, rStripT.y, rStripT.z);

    if (i < N) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      roadIndices.push(a, b, c, b, d, c);
      railIndices.push(a, b, c, b, d, c);

      // Under-deck faces (left skirt, right skirt, bottom)
      const da = i * 4;
      const db = da + 4;
      // left face: topL(0), botL(3)
      deckIndices.push(da + 0, db + 0, da + 3, db + 0, db + 3, da + 3);
      // right face: topR(1), botR(2)
      deckIndices.push(da + 1, da + 2, db + 1, db + 1, da + 2, db + 2);
      // bottom face: botL(3), botR(2)
      deckIndices.push(da + 3, db + 3, da + 2, db + 3, db + 2, da + 2);

      // Barrier walls (double-sided)
      const wa = i * 4;
      const wb = wa + 4;
      wallIndices.push(wa + 0, wa + 1, wb + 0, wa + 1, wb + 1, wb + 0);
      wallIndices.push(wa + 2, wb + 2, wa + 3, wa + 3, wb + 2, wb + 3);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.36,
    metalness: 0.28,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = false;
  group.add(roadMesh);
  disposables.push(roadGeo, roadMat);

  // Under-deck structural chassis
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3));
  deckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(deckNormals, 3));
  deckGeo.setIndex(deckIndices);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f1e,
    roughness: 0.5,
    metalness: 0.7,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(deckGeo, deckMat));
  disposables.push(deckGeo, deckMat);

  // Dark metallic side barriers
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wallNormals, 3));
  wallGeo.setIndex(wallIndices);
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x11172b,
    roughness: 0.35,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));
  disposables.push(wallGeo, wallMat);

  // Glowing Left & Right Neon Rail Strips (crisp jewel-like HDR neon rails)
  const makeRail = (positions: number[], hexColor: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(railIndices);
    geo.computeVertexNormals();
    const col = new THREE.Color(hexColor).multiplyScalar(1.28);
    const mat = new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    group.add(new THREE.Mesh(geo, mat));
    disposables.push(geo, mat);
  };
  makeRail(railLeftPos, cfg.railLeftColor);
  makeRail(railRightPos, cfg.railRightColor);

  // 2. Boost Pads (animated scrolling neon chevron decks)
  const boostTexture = createBoostPadTexture();
  disposables.push(boostTexture);
  const boostMat = new THREE.MeshBasicMaterial({
    map: boostTexture,
    transparent: true,
    opacity: 0.96,
    toneMapped: false,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  disposables.push(boostMat);

  for (const pad of cfg.boostPads) {
    const segs = 12;
    const sCenter = pad.t * spline.totalLength;
    const sStart = sCenter - pad.length * 0.5;
    const pPos: number[] = [];
    const pUvs: number[] = [];
    const pIdx: number[] = [];
    const hw = pad.width * 0.5;

    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const f = spline.getFrameAtDistance(sStart + u * pad.length);
      const lift = 0.08;
      const pl = f.pos.clone().addScaledVector(f.right, pad.d - hw).addScaledVector(f.up, lift);
      const pr = f.pos.clone().addScaledVector(f.right, pad.d + hw).addScaledVector(f.up, lift);
      pPos.push(pl.x, pl.y, pl.z, pr.x, pr.y, pr.z);
      pUvs.push(0, u * 1.4, 1, u * 1.4);
      if (i < segs) {
        const a = i * 2;
        pIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(pUvs, 2));
    geo.setIndex(pIdx);
    group.add(new THREE.Mesh(geo, boostMat));
    disposables.push(geo);
  }

  // 3. Physical 3D Jump Ramps contoured to the spline
  const rampTex = createRampTexture();
  disposables.push(rampTex);
  const rampTopMat = new THREE.MeshBasicMaterial({
    map: rampTex,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const rampSideMat = new THREE.MeshStandardMaterial({
    color: 0x1a1030,
    emissive: 0xff2a9d,
    emissiveIntensity: 0.45,
    metalness: 0.6,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
  disposables.push(rampTopMat, rampSideMat);

  for (const ramp of cfg.jumpRamps) {
    const segs = 20;
    const sStart = ramp.tStart * spline.totalLength;
    const sLen = (ramp.tEnd - ramp.tStart) * spline.totalLength;
    const hw = halfW * ramp.widthRatio;

    const topPos: number[] = [];
    const topUv: number[] = [];
    const topIdx: number[] = [];

    const sidePos: number[] = [];
    const sideIdx: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const f = spline.getFrameAtDistance(sStart + u * sLen);
      const h = ramp.height * Math.pow(u, 1.65) + 0.06;

      const tl = f.pos.clone().addScaledVector(f.right, -hw).addScaledVector(f.up, h);
      const tr = f.pos.clone().addScaledVector(f.right, hw).addScaledVector(f.up, h);
      const bl = f.pos.clone().addScaledVector(f.right, -hw);
      const br = f.pos.clone().addScaledVector(f.right, hw);

      topPos.push(tl.x, tl.y, tl.z, tr.x, tr.y, tr.z);
      topUv.push(0, u, 1, u);

      sidePos.push(
        bl.x, bl.y, bl.z, tl.x, tl.y, tl.z,
        br.x, br.y, br.z, tr.x, tr.y, tr.z
      );

      if (i < segs) {
        const a = i * 2;
        topIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        const sa = i * 4;
        const sb = sa + 4;
        sideIdx.push(sa + 0, sa + 1, sb + 0, sa + 1, sb + 1, sb + 0);
        sideIdx.push(sa + 2, sb + 2, sa + 3, sa + 3, sb + 2, sb + 3);
      }
    }

    // Back vertical face at the launch lip
    const lastIdx = segs * 4;
    sideIdx.push(lastIdx + 0, lastIdx + 2, lastIdx + 1, lastIdx + 1, lastIdx + 2, lastIdx + 3);

    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
    topGeo.setIndex(topIdx);
    topGeo.computeVertexNormals();
    group.add(new THREE.Mesh(topGeo, rampTopMat));
    disposables.push(topGeo);

    const sideGeo = new THREE.BufferGeometry();
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
    sideGeo.setIndex(sideIdx);
    sideGeo.computeVertexNormals();
    group.add(new THREE.Mesh(sideGeo, rampSideMat));
    disposables.push(sideGeo);
  }

  // 4. Start / Finish Line Strip & Monumental Cyber Gantry
  const startFrame = spline.getFrameAtDistance(0);
  const startTex = createStartFinishTexture();
  disposables.push(startTex);

  const finishLineGeo = new THREE.PlaneGeometry(cfg.roadWidth - 0.8, 5.2);
  const finishLineMat = new THREE.MeshBasicMaterial({
    map: startTex,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  const startQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(startFrame.right, startFrame.up, startFrame.tangent.clone().negate())
  );
  finishLine.position.copy(startFrame.pos).addScaledVector(startFrame.up, 0.06);
  finishLine.quaternion.copy(startQuat);
  finishLine.rotateX(-Math.PI / 2);
  group.add(finishLine);
  disposables.push(finishLineGeo, finishLineMat);

  // Gantry arch
  const gantry = new THREE.Group();
  gantry.position.copy(startFrame.pos);
  gantry.quaternion.copy(startQuat);

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x0e1529,
    metalness: 0.85,
    roughness: 0.25,
  });
  const neonTrimMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(cfg.railLeftColor).multiplyScalar(1.8),
    toneMapped: false,
  });
  disposables.push(pillarMat, neonTrimMat);

  const gantryH = 12.5;
  const pillarGeo = new THREE.BoxGeometry(1.8, gantryH, 2.2);
  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-(halfW + 1.1), gantryH * 0.5, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(halfW + 1.1, gantryH * 0.5, 0);
  gantry.add(leftPillar, rightPillar);

  const crossbarGeo = new THREE.BoxGeometry(cfg.roadWidth + 4.4, 2.4, 2.6);
  const crossbar = new THREE.Mesh(crossbarGeo, pillarMat);
  crossbar.position.set(0, gantryH - 0.6, 0);
  gantry.add(crossbar);

  const trimGeo = new THREE.BoxGeometry(cfg.roadWidth + 4.6, 0.28, 2.8);
  const trimTop = new THREE.Mesh(trimGeo, neonTrimMat);
  trimTop.position.set(0, gantryH + 0.65, 0);
  const trimBot = new THREE.Mesh(trimGeo, neonTrimMat);
  trimBot.position.set(0, gantryH - 1.85, 0);
  gantry.add(trimTop, trimBot);
  disposables.push(pillarGeo, crossbarGeo, trimGeo);

  // 4 Overhead Countdown Race Light Pods
  const countdownLights: THREE.MeshStandardMaterial[] = [];
  const podGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.4, 16);
  podGeo.rotateX(Math.PI / 2);
  disposables.push(podGeo);
  for (let i = 0; i < 4; i++) {
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a25,
      emissive: 0x000000,
      emissiveIntensity: 0,
      toneMapped: false,
    });
    countdownLights.push(podMat);
    disposables.push(podMat);
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set((i - 1.5) * 3.0, gantryH - 0.6, 1.38);
    gantry.add(pod);
  }
  group.add(gantry);

  // 5. Instanced Roadside Neon Light Arches & High-Curvature Corner Chevrons
  const archCount = 26;
  const archPillarGeo = new THREE.BoxGeometry(0.65, 9.5, 0.8);
  const archTopGeo = new THREE.BoxGeometry(cfg.roadWidth + 2.4, 0.55, 0.65);
  const archPillarMat = new THREE.MeshStandardMaterial({
    color: 0x121933,
    metalness: 0.8,
    roughness: 0.3,
  });
  const archGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(cfg.accentColorHex).multiplyScalar(1.25),
    toneMapped: false,
  });
  disposables.push(archPillarGeo, archTopGeo, archPillarMat, archGlowMat);

  const leftArchInst = new THREE.InstancedMesh(archPillarGeo, archPillarMat, archCount);
  const rightArchInst = new THREE.InstancedMesh(archPillarGeo, archPillarMat, archCount);
  const topArchInst = new THREE.InstancedMesh(archTopGeo, archGlowMat, archCount);

  const dummy = new THREE.Object3D();
  const basisMat = new THREE.Matrix4();
  const archQuat = new THREE.Quaternion();
  let archIdx = 0;

  for (let i = 1; i <= archCount; i++) {
    const t = i / (archCount + 1);
    if (spline.isInTunnel(t)) continue;
    const f = spline.getFrameAtDistance(t * spline.totalLength);
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    archQuat.setFromRotationMatrix(basisMat);

    // Left post
    dummy.position.copy(f.pos).addScaledVector(f.right, -(halfW + 0.9)).addScaledVector(f.up, 4.7);
    dummy.quaternion.copy(archQuat);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    leftArchInst.setMatrixAt(archIdx, dummy.matrix);

    // Right post
    dummy.position.copy(f.pos).addScaledVector(f.right, halfW + 0.9).addScaledVector(f.up, 4.7);
    dummy.updateMatrix();
    rightArchInst.setMatrixAt(archIdx, dummy.matrix);

    // Glowing overhead bar
    dummy.position.copy(f.pos).addScaledVector(f.up, 9.5);
    dummy.updateMatrix();
    topArchInst.setMatrixAt(archIdx, dummy.matrix);

    archIdx++;
  }
  leftArchInst.count = archIdx;
  rightArchInst.count = archIdx;
  topArchInst.count = archIdx;
  group.add(leftArchInst, rightArchInst, topArchInst);

  // Corner warning neon chevron boards on outside of sharp 90° bends & 180° hairpins
  const chevronTex = createChevronBannerTexture('#ffae00');
  const chevronMat = new THREE.MeshBasicMaterial({
    map: chevronTex,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const chevronGeo = new THREE.PlaneGeometry(5.8, 2.25);
  disposables.push(chevronTex, chevronMat, chevronGeo);

  const chevronBoards: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  for (let i = 0; i < N; i += 8) {
    const f = spline.samples[i];
    if (Math.abs(f.curvature) > 0.0068) {
      // Outside of turn: if turning right (curv > 0), outside is left (-right)
      const outSign = f.curvature > 0 ? -1 : 1;
      const pos = f.pos
        .clone()
        .addScaledVector(f.right, outSign * (halfW + 0.55))
        .addScaledVector(f.up, 2.4);
      // Orient plane facing inward toward road
      const normalIn = f.right.clone().multiplyScalar(-outSign);
      const planeX = f.tangent.clone().multiplyScalar(outSign > 0 ? 1 : -1);
      basisMat.makeBasis(planeX, f.up, normalIn);
      const q = new THREE.Quaternion().setFromRotationMatrix(basisMat);
      chevronBoards.push({ pos, quat: q });
    }
  }
  if (chevronBoards.length > 0) {
    const chevronInst = new THREE.InstancedMesh(chevronGeo, chevronMat, chevronBoards.length);
    chevronBoards.forEach((b, idx) => {
      dummy.position.copy(b.pos);
      dummy.quaternion.copy(b.quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      chevronInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(chevronInst);
  }

  const setCountdownState = (stage: number) => {
    for (let i = 0; i < 4; i++) {
      const mat = countdownLights[i];
      if (stage === 0) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (stage >= 4) {
        mat.emissive.setHex(0x00ff88);
        mat.emissiveIntensity = 3.2;
      } else if (i < stage) {
        mat.emissive.setHex(0xff1e56);
        mat.emissiveIntensity = 3.0;
      } else {
        mat.emissive.setHex(0x220810);
        mat.emissiveIntensity = 0.2;
      }
    }
  };

  return {
    group,
    boostTexture,
    countdownLights,
    update: (dt: number) => {
      boostTexture.offset.y -= dt * 2.1;
      chevronTex.offset.x -= dt * 1.4;
    },
    setCountdownState,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
