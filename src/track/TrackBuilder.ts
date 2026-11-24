import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import {
  createBoostPadTexture,
  createChevronBannerTexture,
  createConcreteTexture,
  createCurbTexture,
  createDistanceBoardTexture,
  createHighwaySignTexture,
  createRampTexture,
  createRoadPBRTextures,
  createStartFinishTexture,
} from '../utils/textures';

export interface TrackBuildResult {
  group: THREE.Group;
  boostTexture: THREE.CanvasTexture;
  countdownLights: THREE.MeshStandardMaterial[];
  update: (dt: number, elapsed: number) => void;
  setCountdownState: (stage: number) => void;
  dispose: () => void;
}

export function buildTrackMesh(spline: TrackSpline): TrackBuildResult {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  const cfg = spline.config;
  const halfW = spline.halfWidth;
  const N = spline.sampleCount;

  // 1. Photorealistic PBR Wet-Asphalt Road Ribbon + Concrete Viaduct Deck + Jersey Barriers + Steel W-Beam Guardrails
  const roadPBR = createRoadPBRTextures(cfg.asphaltTint);
  const concreteTex = createConcreteTexture();
  concreteTex.repeat.set(80, 1);
  const curbTex = createCurbTexture();
  disposables.push(roadPBR.map, roadPBR.normalMap, roadPBR.roughnessMap, concreteTex, curbTex);

  const roadPositions: number[] = [];
  const roadNormals: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const deckPositions: number[] = [];
  const deckNormals: number[] = [];
  const deckIndices: number[] = [];

  const wallPos: number[] = [];
  const wallNormals: number[] = [];
  const wallUvs: number[] = [];
  const wallIndices: number[] = [];

  const steelRailPos: number[] = [];
  const steelRailNormals: number[] = [];
  const steelRailIndices: number[] = [];

  const accentLeftPos: number[] = [];
  const accentRightPos: number[] = [];
  const accentIndices: number[] = [];

  // Raised FIA Red-and-White Apex Curbs on sharp corners
  const curbPos: number[] = [];
  const curbNormals: number[] = [];
  const curbUvs: number[] = [];
  const curbIndices: number[] = [];

  const tileLen = 28;
  const vTmp = new THREE.Vector3();

  for (let i = 0; i <= N; i++) {
    const sample = spline.samples[i % N];
    const sDist = i === N ? spline.totalLength : sample.s;
    const vCoord = sDist / tileLen;

    const leftEdge = vTmp.copy(sample.pos).addScaledVector(sample.right, -halfW).clone();
    const rightEdge = vTmp.copy(sample.pos).addScaledVector(sample.right, halfW).clone();

    roadPositions.push(leftEdge.x, leftEdge.y, leftEdge.z);
    roadPositions.push(rightEdge.x, rightEdge.y, rightEdge.z);
    roadNormals.push(sample.up.x, sample.up.y, sample.up.z);
    roadNormals.push(sample.up.x, sample.up.y, sample.up.z);
    roadUvs.push(0, vCoord, 1, vCoord);

    // Solid concrete box-girder viaduct under-deck
    const deckDepth = 3.2;
    const deckInset = 2.0;
    const botL = leftEdge.clone().addScaledVector(sample.right, deckInset).addScaledVector(sample.up, -deckDepth);
    const botR = rightEdge.clone().addScaledVector(sample.right, -deckInset).addScaledVector(sample.up, -deckDepth);

    deckPositions.push(
      leftEdge.x, leftEdge.y - 0.04, leftEdge.z,
      rightEdge.x, rightEdge.y - 0.04, rightEdge.z,
      botR.x, botR.y, botR.z,
      botL.x, botL.y, botL.z
    );
    deckNormals.push(
      -sample.right.x, -sample.right.y, -sample.right.z,
      sample.right.x, sample.right.y, sample.right.z,
      -sample.up.x, -sample.up.y, -sample.up.z,
      -sample.up.x, -sample.up.y, -sample.up.z
    );

    // Realistic concrete Jersey barrier walls (1.18m high, tapered slightly outward at top)
    const wallH = 1.18;
    const lTop = leftEdge.clone().addScaledVector(sample.right, -0.22).addScaledVector(sample.up, wallH);
    const rTop = rightEdge.clone().addScaledVector(sample.right, 0.22).addScaledVector(sample.up, wallH);
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
    wallUvs.push(vCoord * 0.5, 0, vCoord * 0.5, 1, vCoord * 0.5, 0, vCoord * 0.5, 1);

    // Galvanized steel W-beam highway guardrail mounted at mid-height (0.58m..0.88m)
    const gB = 0.54;
    const gT = 0.88;
    const lGB = leftEdge.clone().addScaledVector(sample.right, 0.08).addScaledVector(sample.up, gB);
    const lGT = leftEdge.clone().addScaledVector(sample.right, 0.08).addScaledVector(sample.up, gT);
    const rGB = rightEdge.clone().addScaledVector(sample.right, -0.08).addScaledVector(sample.up, gB);
    const rGT = rightEdge.clone().addScaledVector(sample.right, -0.08).addScaledVector(sample.up, gT);
    steelRailPos.push(
      lGB.x, lGB.y, lGB.z, lGT.x, lGT.y, lGT.z,
      rGB.x, rGB.y, rGB.z, rGT.x, rGT.y, rGT.z
    );
    steelRailNormals.push(
      sample.right.x, sample.right.y, sample.right.z,
      sample.right.x, sample.right.y, sample.right.z,
      -sample.right.x, -sample.right.y, -sample.right.z,
      -sample.right.x, -sample.right.y, -sample.right.z
    );

    // Thin tasteful architectural highway reflector strip tucked cleanly under top lip (0.09m thin!)
    const sB = 1.06;
    const sT = 1.15;
    const lSB = leftEdge.clone().addScaledVector(sample.right, -0.14).addScaledVector(sample.up, sB);
    const lST = leftEdge.clone().addScaledVector(sample.right, -0.14).addScaledVector(sample.up, sT);
    const rSB = rightEdge.clone().addScaledVector(sample.right, 0.14).addScaledVector(sample.up, sB);
    const rST = rightEdge.clone().addScaledVector(sample.right, 0.14).addScaledVector(sample.up, sT);
    accentLeftPos.push(lSB.x, lSB.y, lSB.z, lST.x, lST.y, lST.z);
    accentRightPos.push(rSB.x, rSB.y, rSB.z, rST.x, rST.y, rST.z);

    if (i < N) {
      const a = i * 2;
      roadIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      accentIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);

      const da = i * 4;
      const db = da + 4;
      deckIndices.push(da + 0, db + 0, da + 3, db + 0, db + 3, da + 3);
      deckIndices.push(da + 1, da + 2, db + 1, db + 1, da + 2, db + 2);
      deckIndices.push(da + 3, db + 3, da + 2, db + 3, db + 2, da + 2);

      wallIndices.push(da + 0, da + 1, db + 0, da + 1, db + 1, db + 0);
      wallIndices.push(da + 2, db + 2, da + 3, da + 3, db + 2, db + 3);

      steelRailIndices.push(da + 0, da + 1, db + 0, da + 1, db + 1, db + 0);
      steelRailIndices.push(da + 2, db + 2, da + 3, da + 3, db + 2, db + 3);
    }
  }

  // Build FIA Red/White Raised Curbs along curved corner zones
  let curbVertCount = 0;
  for (let i = 0; i < N; i++) {
    const f0 = spline.samples[i];
    const f1 = spline.samples[(i + 1) % N];
    if (Math.abs(f0.curvature) < 0.005) continue;

    // Place apex curb on BOTH inside & outside edges of sharp corners
    for (const side of [-1, 1] as const) {
      const innerD = side * (halfW - 1.35);
      const outerD = side * (halfW - 0.15);
      const p0In = f0.pos.clone().addScaledVector(f0.right, innerD).addScaledVector(f0.up, 0.04);
      const p0Out = f0.pos.clone().addScaledVector(f0.right, outerD).addScaledVector(f0.up, 0.15);
      const p1In = f1.pos.clone().addScaledVector(f1.right, innerD).addScaledVector(f1.up, 0.04);
      const p1Out = f1.pos.clone().addScaledVector(f1.right, outerD).addScaledVector(f1.up, 0.15);

      const v0 = f0.s / 14;
      const v1 = (f0.s + spline.totalLength / N) / 14;

      curbPos.push(
        p0In.x, p0In.y, p0In.z,
        p0Out.x, p0Out.y, p0Out.z,
        p1In.x, p1In.y, p1In.z,
        p1Out.x, p1Out.y, p1Out.z
      );
      for (let k = 0; k < 4; k++) curbNormals.push(f0.up.x, f0.up.y, f0.up.z);
      curbUvs.push(0, v0, 1, v0, 0, v1, 1, v1);

      const b = curbVertCount;
      if (side > 0) curbIndices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      else curbIndices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      curbVertCount += 4;
    }
  }

  // Road PBR Material (damp tire tracks reflect dusk sky, streetlights & brake lights!)
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadPBR.map,
    normalMap: roadPBR.normalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: roadPBR.roughnessMap,
    roughness: 1.0,
    metalness: 0.02,
    envMapIntensity: 0.42,
  });
  group.add(new THREE.Mesh(roadGeo, roadMat));
  disposables.push(roadGeo, roadMat);

  if (curbVertCount > 0) {
    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
    curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
    curbGeo.setIndex(curbIndices);
    const curbMat = new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.55,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    group.add(new THREE.Mesh(curbGeo, curbMat));
    disposables.push(curbGeo, curbMat);
  }

  // Concrete Viaduct Box-Girder Under-Deck
  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPositions, 3));
  deckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(deckNormals, 3));
  deckGeo.setIndex(deckIndices);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x262c36,
    roughness: 0.78,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(deckGeo, deckMat));
  disposables.push(deckGeo, deckMat);

  // Concrete Jersey Barriers (tinted weathered Manx dry-stone walls on Isle of Man TT!)
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wallNormals, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
  wallGeo.setIndex(wallIndices);
  const wallMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: cfg.theme === 'manx' ? 0x8a8175 : 0xffffff,
    roughness: cfg.theme === 'manx' ? 0.92 : 0.82,
    metalness: cfg.theme === 'manx' ? 0.04 : 0.1,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));
  disposables.push(wallGeo, wallMat);

  // Galvanized Brushed Steel W-Beam Guardrails (dark rural iron trim on Manx dry-stone walls)
  const steelGeo = new THREE.BufferGeometry();
  steelGeo.setAttribute('position', new THREE.Float32BufferAttribute(steelRailPos, 3));
  steelGeo.setAttribute('normal', new THREE.Float32BufferAttribute(steelRailNormals, 3));
  steelGeo.setIndex(steelRailIndices);
  const steelMat = new THREE.MeshStandardMaterial({
    color: cfg.theme === 'manx' ? 0x525860 : 0x9aa5b4,
    roughness: cfg.theme === 'manx' ? 0.56 : 0.34,
    metalness: cfg.theme === 'manx' ? 0.45 : 0.82,
    envMapIntensity: cfg.theme === 'manx' ? 0.7 : 1.4,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(steelGeo, steelMat));
  disposables.push(steelGeo, steelMat);

  // Subtle architectural LED reflector strip along barrier crown (tasteful modern realism)
  const makeAccent = (positions: number[], hexColor: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(accentIndices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hexColor).multiplyScalar(1.05),
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geo, mat));
    disposables.push(geo, mat);
  };
  makeAccent(accentLeftPos, cfg.railLeftColor);
  makeAccent(accentRightPos, cfg.railRightColor);

  // 2. Embedded Optical Road Boost Pads
  const boostTexture = createBoostPadTexture();
  disposables.push(boostTexture);
  const boostMat = new THREE.MeshBasicMaterial({
    map: boostTexture,
    transparent: true,
    opacity: 0.66,
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
      const lift = 0.06;
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

  // 3. Realistic Steel-Deck Jump Ramps
  const rampTex = createRampTexture();
  disposables.push(rampTex);
  const rampTopMat = new THREE.MeshStandardMaterial({
    map: rampTex,
    emissive: 0xffffff,
    emissiveMap: rampTex,
    emissiveIntensity: 0.35,
    roughness: 0.42,
    metalness: 0.45,
    side: THREE.DoubleSide,
  });
  const rampSideMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.4,
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
      sidePos.push(bl.x, bl.y, bl.z, tl.x, tl.y, tl.z, br.x, br.y, br.z, tr.x, tr.y, tr.z);

      if (i < segs) {
        const a = i * 2;
        topIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        const sa = i * 4;
        const sb = sa + 4;
        sideIdx.push(sa + 0, sa + 1, sb + 0, sa + 1, sb + 1, sb + 0);
        sideIdx.push(sa + 2, sb + 2, sa + 3, sa + 3, sb + 2, sb + 3);
      }
    }
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

  // 4. Realistic F1 / GT Circuit Start-Finish Line & Steel Truss Gantry
  const startFrame = spline.getFrameAtDistance(0);
  const startTex = createStartFinishTexture();
  disposables.push(startTex);

  const finishLineGeo = new THREE.PlaneGeometry(cfg.roadWidth - 1.2, 5.8);
  const finishLineMat = new THREE.MeshStandardMaterial({
    map: startTex,
    roughness: 0.45,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
  const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
  const startQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(startFrame.right, startFrame.up, startFrame.tangent.clone().negate())
  );
  finishLine.position.copy(startFrame.pos).addScaledVector(startFrame.up, 0.05);
  finishLine.quaternion.copy(startQuat);
  finishLine.rotateX(-Math.PI / 2);
  group.add(finishLine);
  disposables.push(finishLineGeo, finishLineMat);

  const gantry = new THREE.Group();
  gantry.position.copy(startFrame.pos);
  gantry.quaternion.copy(startQuat);

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.78,
    roughness: 0.34,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.5,
    roughness: 0.45,
  });
  disposables.push(trussMat, housingMat);

  const gantryH = 12.8;
  const pillarGeo = new THREE.BoxGeometry(1.5, gantryH, 1.8);
  const leftPillar = new THREE.Mesh(pillarGeo, trussMat);
  leftPillar.position.set(-(halfW + 1.2), gantryH * 0.5, 0);
  const rightPillar = new THREE.Mesh(pillarGeo, trussMat);
  rightPillar.position.set(halfW + 1.2, gantryH * 0.5, 0);
  gantry.add(leftPillar, rightPillar);

  const bridgeGeo = new THREE.BoxGeometry(cfg.roadWidth + 4.4, 2.2, 2.2);
  const bridge = new THREE.Mesh(bridgeGeo, trussMat);
  bridge.position.set(0, gantryH - 0.6, 0);
  gantry.add(bridge);

  // Dark matte F1 start-light pod housing box
  const podBoxGeo = new THREE.BoxGeometry(14.5, 1.85, 0.7);
  const podBox = new THREE.Mesh(podBoxGeo, housingMat);
  podBox.position.set(0, gantryH - 0.6, 1.2);
  gantry.add(podBox);
  disposables.push(pillarGeo, bridgeGeo, podBoxGeo);

  const countdownLights: THREE.MeshStandardMaterial[] = [];
  const podGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.35, 18);
  podGeo.rotateX(Math.PI / 2);
  disposables.push(podGeo);
  for (let i = 0; i < 4; i++) {
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a22,
      emissive: 0x000000,
      emissiveIntensity: 0,
      toneMapped: false,
    });
    countdownLights.push(podMat);
    disposables.push(podMat);
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set((i - 1.5) * 3.1, gantryH - 0.6, 1.48);
    gantry.add(pod);
  }
  group.add(gantry);

  // 5. Realistic Curved Highway Cobra-Head LED Streetlamps (InstancedMesh!)
  const dummy = new THREE.Object3D();
  const basisMat = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  const lampInterval = 26; // every ~65m along highway
  const lampSamples: number[] = [];
  for (let i = 18; i < N - 18; i += lampInterval) {
    const t = i / N;
    if (spline.isInTunnel(t)) continue;
    // Authentic Isle of Man TT: streetlamps only in Douglas, Kirk Michael/Ballaugh & Ramsey towns; A18 Snaefell Mountain is wild & open!
    if (cfg.theme === 'manx') {
      const inTown =
        t < 0.052 || (t > 0.328 && t < 0.402) || (t > 0.558 && t < 0.590) || t > 0.962;
      if (!inTown) continue;
    }
    lampSamples.push(i);
  }

  const poleGeo = new THREE.CylinderGeometry(0.16, 0.24, 11.2, 8);
  const armGeo = new THREE.BoxGeometry(4.6, 0.2, 0.22);
  const headGeo = new THREE.BoxGeometry(1.5, 0.22, 0.58);
  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.78,
    roughness: 0.34,
  });
  const isWarmLamp =
    cfg.theme === 'mountain' || cfg.theme === 'bridge' || cfg.theme === 'island' || cfg.theme === 'manx';
  const lampLensMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(isWarmLamp ? 0xffd28a : 0xe0f2fe).multiplyScalar(1.6),
    toneMapped: false,
  });
  disposables.push(poleGeo, armGeo, headGeo, lampPoleMat, lampLensMat);

  const totalLamps = lampSamples.length * 2;
  const poleInst = new THREE.InstancedMesh(poleGeo, lampPoleMat, totalLamps);
  const armInst = new THREE.InstancedMesh(armGeo, lampPoleMat, totalLamps);
  const headInst = new THREE.InstancedMesh(headGeo, lampLensMat, totalLamps);

  let lIdx = 0;
  for (const sIdx of lampSamples) {
    const f = spline.samples[sIdx];
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    q.setFromRotationMatrix(basisMat);

    for (const side of [-1, 1] as const) {
      // Pole sitting outside barrier
      dummy.position.copy(f.pos).addScaledVector(f.right, side * (halfW + 0.9)).addScaledVector(f.up, 5.6);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(lIdx, dummy.matrix);

      // Cantilevered arm leaning inward over the road
      dummy.position.copy(f.pos).addScaledVector(f.right, side * (halfW - 1.2)).addScaledVector(f.up, 11.0);
      dummy.updateMatrix();
      armInst.setMatrixAt(lIdx, dummy.matrix);

      // Illuminated luminaire head
      dummy.position.copy(f.pos).addScaledVector(f.right, side * (halfW - 3.2)).addScaledVector(f.up, 10.85);
      dummy.updateMatrix();
      headInst.setMatrixAt(lIdx, dummy.matrix);

      lIdx++;
    }
  }
  group.add(poleInst, armInst, headInst);

  // 6. Authentic Overhead Expressway Sign Gantries (Japanese/English Green/Blue Highway Signs!)
  const signMeta: Record<string, [string, string, string]> = {
    city: ['湾岸線  BAYSHORE', 'SHIBUYA / HANEDA AIRPORT', '#046a38'],
    'monaco-harbor': ['摩纳哥海滨  MONACO GP', 'PORT HERCULES · LOW-BANK HAIRPINS', '#035388'],
    bridge: ['海湾大橋  BAY BRIDGE', 'HYPERION COASTAL EXPWY', '#035388'],
    tunnel: ['地下幹線  SUB-ZERO', 'REACTOR EXPRESS TUNNEL', '#046a38'],
    mountain: ['秋名峠  AKINA PASS', 'DOWNHILL HAIRPINS AHEAD', '#046a38'],
    island: ['极境环岛  APEX ISLAND', '11.9KM GRAND COASTAL LOOP', '#035388'],
    manx: ['ISLE OF MAN TT', 'SNAEFELL MOUNTAIN COURSE · 37.73 MI', '#991b1b'],
  };

  const gantrySpecs: { t: number; l1: string; l2: string; bg: string }[] =
    cfg.theme === 'island'
      ? [
          { t: 0.025, l1: '海港大道  HARBOR BAY', l2: 'WEST MARINA · GRAND ISLAND LOOP', bg: '#035388' },
          { t: 0.086, l1: '跨海悬索桥  APEX BRIDGE', l2: 'NORTH STRAIT · 34° OCEAN BOWL', bg: '#035388' },
          { t: 0.275, l1: '环岛火山峠  VOLCANIC PASS', l2: '76M SUMMIT · SWITCHBACKS AHEAD', bg: '#046a38' },
          { t: 0.502, l1: '穿山隧道  EAST CAPE TUNNEL', l2: '1.3KM VAULT · 33° KARUSSELL', bg: '#046a38' },
          { t: 0.648, l1: '灯塔发卡弯  LIGHTHOUSE POINT', l2: 'LOW-BANK HAIRPINS · SUZUKA S-CURVES', bg: '#035388' },
          { t: 0.908, l1: '环岛冲刺  APEX FINALE', l2: 'MARINA INLET JUMP · FINISH STRAIGHT', bg: '#035388' },
        ]
      : cfg.theme === 'manx'
        ? [
            { t: 0.012, l1: 'DOUGLAS · BRAY HILL', l2: 'ISLE OF MAN TT · 60.7 KM (37.73 MI)', bg: '#991b1b' },
            { t: 0.090, l1: 'CROSBY STRAIGHT', l2: 'A1 OVERDRIVE · GREEBA CASTLE AHEAD', bg: '#065f46' },
            { t: 0.160, l1: 'BALLACRAINE  A1 → A3', l2: 'GLEN HELEN · WOODED VALLEY S-BENDS', bg: '#065f46' },
            { t: 0.252, l1: 'CRONK-Y-VODDY', l2: 'RIDGE OVERDRIVE · CREST JUMP AHEAD', bg: '#991b1b' },
            { t: 0.328, l1: 'KIRK MICHAEL VILLAGE', l2: 'STONE WALL CHICANE → BISHOPSCOURT', bg: '#065f46' },
            { t: 0.384, l1: 'BALLAUGH BRIDGE', l2: 'FAMOUS HUMPBACK FLYING JUMP!', bg: '#991b1b' },
            { t: 0.438, l1: 'SULBY STRAIGHT', l2: '3.5KM FLAT-OUT · HYPER OVERDRIVE II', bg: '#065f46' },
            { t: 0.515, l1: 'KERROWMOAR · RAMSEY', l2: 'COUNTRY S-BENDS → PARLIAMENT SQ', bg: '#065f46' },
            { t: 0.570, l1: 'RAMSEY HAIRPIN  24MI', l2: '180° TURN · GATEWAY TO SNAEFELL', bg: '#991b1b' },
            { t: 0.618, l1: 'A18 MOUNTAIN ROAD', l2: 'THE GOOSENECK → GUTHRIE MEMORIAL', bg: '#065f46' },
            { t: 0.674, l1: 'MOUNTAIN MILE  28MI', l2: 'HIGH-ALTITUDE OVERDRIVE → VERANDAH', bg: '#065f46' },
            { t: 0.774, l1: 'HAILWOOD HEIGHT', l2: '422M SUMMIT · CREST JUMP → BRANDYWELL', bg: '#991b1b' },
            { t: 0.822, l1: 'WINDY CORNER  32MI', l2: '28° MOORLAND PLUNGE → KEPPEL GATE', bg: '#065f46' },
            { t: 0.892, l1: 'CREG-NY-BAA  34TH MS', l2: 'HISTORIC PUB CORNER → GOB-NY-GEAY', bg: '#991b1b' },
            { t: 0.962, l1: 'SIGNPOST · GOVERNOR', l2: 'FINAL HAIRPIN → DOUGLAS GRANDSTAND', bg: '#065f46' },
          ]
        : [0.16, 0.48, 0.78].map((t) => {
          const [sL1, sL2, sBg] = signMeta[cfg.id] ?? signMeta[cfg.theme] ?? signMeta.city;
          return { t, l1: sL1, l2: sL2, bg: sBg };
        });

  const signBoardGeo = new THREE.BoxGeometry(14.5, 4.1, 0.3);
  const gLegGeo = new THREE.BoxGeometry(0.95, 13.5, 0.95);
  const gBeamGeo = new THREE.BoxGeometry(cfg.roadWidth + 3.8, 0.9, 0.9);
  disposables.push(signBoardGeo, gLegGeo, gBeamGeo);

  const signMatCache = new Map<string, THREE.MeshStandardMaterial>();
  for (const spec of gantrySpecs) {
    if (spline.isInTunnel(spec.t)) continue;
    const key = `${spec.l1}|${spec.l2}|${spec.bg}`;
    let signMat = signMatCache.get(key);
    if (!signMat) {
      const signTex = createHighwaySignTexture(spec.l1, spec.l2, spec.bg);
      signMat = new THREE.MeshStandardMaterial({
        map: signTex,
        emissive: 0xffffff,
        emissiveMap: signTex,
        emissiveIntensity: 0.35,
        roughness: 0.32,
      });
      signMatCache.set(key, signMat);
      disposables.push(signTex, signMat);
    }

    const f = spline.getFrameAtDistance(spec.t * spline.totalLength);
    const sg = new THREE.Group();
    sg.position.copy(f.pos);
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    sg.quaternion.setFromRotationMatrix(basisMat);

    const legL = new THREE.Mesh(gLegGeo, trussMat);
    legL.position.set(-(halfW + 1.3), 6.75, 0);
    const legR = new THREE.Mesh(gLegGeo, trussMat);
    legR.position.set(halfW + 1.3, 6.75, 0);
    const beam = new THREE.Mesh(gBeamGeo, trussMat);
    beam.position.set(0, 12.8, 0);
    const board = new THREE.Mesh(signBoardGeo, signMat);
    board.position.set(0, 11.4, 0.5);

    sg.add(legL, legR, beam, board);
    group.add(sg);
  }

  // 7. Reflective Yellow/Black Steel Corner Chevron Posts + 150m / 100m / 50m Braking/Drift Distance Boards!
  const chevronTex = createChevronBannerTexture();
  const chevronMat = new THREE.MeshStandardMaterial({
    map: chevronTex,
    emissive: 0xfacc15,
    emissiveMap: chevronTex,
    emissiveIntensity: 0.32,
    roughness: 0.3,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const chevronGeo = new THREE.PlaneGeometry(5.6, 2.2);
  const stakeGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 6);
  disposables.push(chevronTex, chevronMat, chevronGeo, stakeGeo);

  const chevronBoards: { pos: THREE.Vector3; quat: THREE.Quaternion; polePos: THREE.Vector3 }[] = [];
  const cornerEntryIndices: { idx: number; turnSign: number }[] = [];
  let inCornerZone = false;

  for (let i = 0; i < N; i += 6) {
    const f = spline.samples[i];
    const absK = Math.abs(f.curvature);
    if (absK > 0.006) {
      if (!inCornerZone) {
        inCornerZone = true;
        cornerEntryIndices.push({ idx: i, turnSign: Math.sign(f.curvature) });
      }
      const outSign = f.curvature > 0 ? -1 : 1;
      const pos = f.pos
        .clone()
        .addScaledVector(f.right, outSign * (halfW + 0.65))
        .addScaledVector(f.up, 2.35);
      const polePos = f.pos
        .clone()
        .addScaledVector(f.right, outSign * (halfW + 0.72))
        .addScaledVector(f.up, 1.5);
      const normalIn = f.right.clone().multiplyScalar(-outSign);
      const planeX = f.tangent.clone().multiplyScalar(outSign > 0 ? 1 : -1);
      basisMat.makeBasis(planeX, f.up, normalIn);
      const boardQ = new THREE.Quaternion().setFromRotationMatrix(basisMat);
      chevronBoards.push({ pos, quat: boardQ, polePos });
    } else if (absK < 0.0045) {
      inCornerZone = false;
    }
  }

  if (chevronBoards.length > 0) {
    const chevronInst = new THREE.InstancedMesh(chevronGeo, chevronMat, chevronBoards.length);
    const stakeInst = new THREE.InstancedMesh(stakeGeo, lampPoleMat, chevronBoards.length);
    chevronBoards.forEach((b, idx) => {
      dummy.position.copy(b.pos);
      dummy.quaternion.copy(b.quat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      chevronInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.copy(b.polePos);
      dummy.quaternion.identity();
      dummy.updateMatrix();
      stakeInst.setMatrixAt(idx, dummy.matrix);
    });
    group.add(chevronInst, stakeInst);
  }

  // Place crisp 150m / 100m / 50m Braking/Drift Distance Markers (InstancedMesh: only 3 draw calls even on 30km!)
  const distMats: Record<number, THREE.MeshStandardMaterial> = {};
  const distMatrices: Record<number, THREE.Matrix4[]> = { 150: [], 100: [], 50: [] };
  for (const m of [150, 100, 50]) {
    const dtTex = createDistanceBoardTexture(m);
    const dtMat = new THREE.MeshStandardMaterial({
      map: dtTex,
      emissive: 0xffffff,
      emissiveMap: dtTex,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    distMats[m] = dtMat;
    disposables.push(dtTex, dtMat);
  }
  const distBoardGeo = new THREE.BoxGeometry(2.8, 1.75, 0.14);
  disposables.push(distBoardGeo);

  for (const ce of cornerEntryIndices) {
    const entryS = spline.samples[ce.idx].s;
    const outSign = ce.turnSign > 0 ? -1 : 1; // place on outer braking side for optimal sightline!
    for (const distBack of [150, 100, 50]) {
      const f = spline.getFrameAtDistance(entryS - distBack);
      if (Math.abs(f.curvature) > 0.008) continue; // skip if inside another corner
      dummy.position
        .copy(f.pos)
        .addScaledVector(f.right, outSign * (halfW + 1.5))
        .addScaledVector(f.up, 2.4);
      basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
      dummy.quaternion.setFromRotationMatrix(basisMat);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      distMatrices[distBack].push(dummy.matrix.clone());
    }
  }
  for (const m of [150, 100, 50]) {
    const mats = distMatrices[m];
    if (mats.length === 0) continue;
    const inst = new THREE.InstancedMesh(distBoardGeo, distMats[m], mats.length);
    mats.forEach((mat, idx) => inst.setMatrixAt(idx, mat));
    group.add(inst);
  }

  // 8. Reflective Cat's-Eye Highway Shoulder Studs (InstancedMesh)
  const studGeo = new THREE.BoxGeometry(0.28, 0.07, 0.42);
  const studMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  disposables.push(studGeo, studMat);
  const studStep = 8;
  const studCount = Math.floor(N / studStep) * 2;
  const studInst = new THREE.InstancedMesh(studGeo, studMat, studCount);
  let stIdx = 0;
  for (let i = 0; i < N && stIdx + 1 < studCount; i += studStep) {
    const f = spline.samples[i];
    basisMat.makeBasis(f.right, f.up, f.tangent.clone().negate());
    q.setFromRotationMatrix(basisMat);
    for (const side of [-1, 1] as const) {
      dummy.position.copy(f.pos).addScaledVector(f.right, side * (halfW - 1.15)).addScaledVector(f.up, 0.04);
      dummy.quaternion.copy(q);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      studInst.setMatrixAt(stIdx++, dummy.matrix);
    }
  }
  studInst.count = stIdx;
  group.add(studInst);

  const setCountdownState = (stage: number) => {
    for (let i = 0; i < 4; i++) {
      const mat = countdownLights[i];
      if (stage === 0) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (stage >= 4) {
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 2.8;
      } else if (i < stage) {
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 2.8;
      } else {
        mat.emissive.setHex(0x220808);
        mat.emissiveIntensity = 0.2;
      }
    }
  };

  return {
    group,
    boostTexture,
    countdownLights,
    update: (dt: number) => {
      boostTexture.offset.y -= dt * 2.0;
    },
    setCountdownState,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
