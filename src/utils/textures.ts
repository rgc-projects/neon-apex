import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export interface RoadPBRTextures {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Generates high-resolution 1024x1024 photorealistic damp-asphalt highway PBR maps:
 * - Albedo: realistic multi-tone charcoal tarmac, painted lane lines, worn tire tracks & tar seams
 * - Roughness: damp glossy tire ruts reflecting streetlights & taillights vs textured dry tarmac edges
 * - Normal: fine aggregate gravel micro-relief for authentic specular sparkle
 */
export function createRoadPBRTextures(asphaltTint: string): RoadPBRTextures {
  const S = 1024;
  const [albedoC, aCtx] = makeCanvas(S, S);
  const [roughC, rCtx] = makeCanvas(S, S);
  const [normC, nCtx] = makeCanvas(S, S);

  // 1. Base charcoal tarmac
  aCtx.fillStyle = asphaltTint;
  aCtx.fillRect(0, 0, S, S);

  // Base roughness: ~0.84 (214/255) authentic matte-satin asphalt, gently polished to ~0.62 (158/255) along tire lanes
  rCtx.fillStyle = 'rgb(214,214,214)';
  rCtx.fillRect(0, 0, S, S);

  // Subtle longitudinal traffic-polished tire paths (continuous & seamless — zero blotchy oval spots!)
  const rutCenters = [0.22, 0.36, 0.64, 0.78];
  for (const rc of rutCenters) {
    const cx = rc * S;
    const gA = aCtx.createLinearGradient(cx - 72, 0, cx + 72, 0);
    gA.addColorStop(0, 'rgba(0,0,0,0)');
    gA.addColorStop(0.5, 'rgba(8,10,14,0.28)');
    gA.addColorStop(1, 'rgba(0,0,0,0)');
    aCtx.fillStyle = gA;
    aCtx.fillRect(cx - 72, 0, 144, S);

    const gR = rCtx.createLinearGradient(cx - 78, 0, cx + 78, 0);
    gR.addColorStop(0, 'rgba(158,158,158,0)');
    gR.addColorStop(0.5, 'rgba(158,158,158,0.85)');
    gR.addColorStop(1, 'rgba(158,158,158,0)');
    rCtx.fillStyle = gR;
    rCtx.fillRect(cx - 78, 0, 156, S);
  }

  // Fine asphalt micro-grain in roughness map for even, natural tarmac sheen
  for (let i = 0; i < 12000; i++) {
    const x = Math.floor(Math.random() * S);
    const y = Math.floor(Math.random() * S);
    const rv = 178 + Math.floor(Math.random() * 52);
    rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.22)`;
    rCtx.fillRect(x, y, 2, 2);
  }

  // Asphalt micro-aggregate grain (albedo + tangent-space normal map!)
  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, S, S);
  const normImg = nCtx.getImageData(0, 0, S, S);
  const nData = normImg.data;

  // Fill fine tarmac grain across albedo & normal
  for (let i = 0; i < 26000; i++) {
    const x = Math.floor(Math.random() * S);
    const y = Math.floor(Math.random() * S);
    const bright = Math.random() > 0.45 ? 230 : 12;
    aCtx.fillStyle = `rgba(${bright},${bright},${bright},${0.025 + Math.random() * 0.055})`;
    aCtx.fillRect(x, y, 2, 2);

    const idx = (y * S + x) * 4;
    nData[idx] = 112 + Math.floor(Math.random() * 32);
    nData[idx + 1] = 112 + Math.floor(Math.random() * 32);
    nData[idx + 2] = 238;
  }
  nCtx.putImageData(normImg, 0, 0);

  // Subtle transverse expansion joints & tar-sealed asphalt seams
  aCtx.strokeStyle = 'rgba(6,8,12,0.55)';
  aCtx.lineWidth = 3;
  for (let y = 128; y < S; y += 256) {
    aCtx.beginPath();
    aCtx.moveTo(0, y);
    aCtx.lineTo(S, y);
    aCtx.stroke();
  }

  // Realistic shoulder rumble margins
  aCtx.fillStyle = 'rgba(14,17,22,0.65)';
  aCtx.fillRect(0, 0, 38, S);
  aCtx.fillRect(S - 38, 0, 38, S);

  // Crisp weathered white solid edge shoulder lines
  aCtx.fillStyle = 'rgba(226,232,240,0.88)';
  aCtx.fillRect(42, 0, 12, S);
  aCtx.fillRect(S - 54, 0, 12, S);

  // Authentic center double-yellow / warm-amber highway divider lines
  aCtx.fillStyle = 'rgba(234,179,8,0.82)';
  aCtx.fillRect(S * 0.5 - 12, 0, 8, S);
  aCtx.fillRect(S * 0.5 + 4, 0, 8, S);

  // Dashed white lane dividers on left & right carriageways
  aCtx.fillStyle = 'rgba(226,232,240,0.72)';
  for (let y = 36; y < S; y += 256) {
    aCtx.fillRect(S * 0.275, y, 8, 124);
    aCtx.fillRect(S * 0.725 - 8, y, 8, 124);
  }

  // Painted lane markings are slightly rougher than wet tire ruts
  rCtx.fillStyle = 'rgb(190,190,190)';
  rCtx.fillRect(42, 0, 12, S);
  rCtx.fillRect(S - 54, 0, 12, S);

  const setup = (c: HTMLCanvasElement, isColor: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  return {
    map: setup(albedoC, true),
    normalMap: setup(normC, false),
    roughnessMap: setup(roughC, false),
  };
}

/** Realistic weathered architectural concrete for Jersey barriers, viaduct piers & tunnel walls */
export function createConcreteTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#474f5c';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle weathered concrete mottling
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 50 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.16)`;
    ctx.fillRect(x, y, 3 + Math.random() * 6, 3 + Math.random() * 6);
  }

  // Vertical cast concrete panel seams & tie-rod dots
  ctx.strokeStyle = 'rgba(18,22,28,0.55)';
  ctx.lineWidth = 3;
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(20,24,30,0.45)';
  for (let x = 64; x < 512; x += 128) {
    for (let y = 64; y < 512; y += 128) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bottom road-grime darkening
  const grime = ctx.createLinearGradient(0, 0, 0, 512);
  grime.addColorStop(0, 'rgba(0,0,0,0.08)');
  grime.addColorStop(0.75, 'rgba(0,0,0,0)');
  grime.addColorStop(1, 'rgba(8,10,14,0.55)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Authentic FIA red-and-white painted apex rumble curb texture */
export function createCurbTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 512);
  for (let y = 0; y < 512; y += 64) {
    const isRed = (y / 64) % 2 === 0;
    ctx.fillStyle = isRed ? '#c81e2b' : '#dce3ec';
    ctx.fillRect(0, y, 128, 64);
    // Subtle rubber scuff marks
    ctx.fillStyle = 'rgba(10,12,16,0.22)';
    ctx.fillRect(0, y + 48, 128, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sleek embedded LED optical boost strip (recessed dark steel plate + crisp directional chevrons) */
export function createBoostPadTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = 'rgba(10, 16, 28, 0.88)';
  ctx.fillRect(0, 0, 256, 512);

  // Brushed steel recessed edge rails
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 14, 512);
  ctx.fillRect(242, 0, 14, 512);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(14, 0, 5, 512);
  ctx.fillRect(237, 0, 5, 512);

  // Recessed LED runway chevrons
  for (let i = 0; i < 4; i++) {
    const baseY = 512 - i * 128 - 22;
    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = i % 2 === 0 ? '#7dd3fc' : '#f0f9ff';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(46, baseY);
    ctx.lineTo(128, baseY - 64);
    ctx.lineTo(210, baseY);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Realistic steel-deck motorsport jump ramp texture */
export function createRampTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#242934';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle steel deck grating lines
  ctx.strokeStyle = 'rgba(148,163,184,0.16)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Yellow/black industrial caution edges
  for (let y = 0; y < 512; y += 48) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, y, 22, 24);
    ctx.fillRect(234, y, 22, 24);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, y + 24, 22, 24);
    ctx.fillRect(234, y + 24, 22, 24);
  }

  // Recessed amber runway launch arrows
  for (let i = 0; i < 4; i++) {
    const baseY = 476 - i * 114;
    ctx.strokeStyle = i === 3 ? '#fef08a' : '#f59e0b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(50, baseY);
    ctx.lineTo(128, baseY - 56);
    ctx.lineTo(206, baseY);
    ctx.stroke();
  }

  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, 0, 256, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStartFinishTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  const cols = 16;
  const rows = 4;
  const cw = 512 / cols;
  const ch = 128 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#e5eaf0' : '#161b24';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 512, 7);
  ctx.fillRect(0, 121, 512, 7);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Authentic motorsport black-and-yellow reflective metal corner chevron sign */
export function createChevronBannerTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 128);

  // Thick black directional chevrons (classic highway / GT circuit sign!)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 24;
  ctx.lineCap = 'square';
  for (let x = 28; x < 280; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x - 22, 12);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x - 22, 116);
    ctx.stroke();
  }
  // Thin metallic frame border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 120);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Authentic motorsport corner braking/drift distance board (150m / 100m / 50m) */
export function createDistanceBoardTexture(meters: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 160);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 256, 160);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 244, 148);

  // Top red motorsport header stripe
  ctx.fillStyle = meters <= 50 ? '#dc2626' : meters <= 100 ? '#d97706' : '#0f172a';
  ctx.fillRect(10, 10, 236, 30);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DRIFT ZONE', 128, 31);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 76px sans-serif';
  ctx.fillText(`${meters}m`, 128, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Authentic emerald-green / highway-blue overhead expressway destination signboard */
export function createHighwaySignTexture(
  line1: string,
  line2: string,
  bgColor = '#046a38'
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(768, 224);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 768, 224);

  // Crisp reflective white double border
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 744, 200);

  // Route shield badge on left
  ctx.fillStyle = '#eab308';
  ctx.fillRect(36, 46, 86, 132);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('E1', 79, 126);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = '900 54px sans-serif';
  ctx.fillText(line1, 148, 106);

  ctx.fillStyle = '#dbeafe';
  ctx.font = '700 32px sans-serif';
  ctx.fillText(line2, 148, 162);

  // Downward lane arrows on right
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 66px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('↓  ↓', 724, 134);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Photorealistic atmospheric twilight / dusk / night sky dome with natural clouds & horizon glow */
export function createRealisticSkyTexture(
  topHex: string,
  midHex: string,
  horizonHex: string,
  sunColorHex: string,
  isDusk: boolean
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);

  // Natural atmospheric vertical scattering gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.32, midHex);
  grad.addColorStop(0.495, horizonHex);
  grad.addColorStop(0.55, '#0b101b');
  grad.addColorStop(1.0, '#050810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Natural pinpoint starfield in upper sky dome
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 190;
    const size = Math.random() < 0.12 ? 1.8 : 1.0;
    const alpha = (1 - y / 200) * (0.2 + Math.random() * 0.7);
    ctx.fillStyle = `rgba(226,238,255,${alpha.toFixed(2)})`;
    ctx.fillRect(x, y, size, size);
  }

  // Warm sunset / city-horizon atmospheric glow bloom (natural soft scattering, NOT striped retro sun)
  const sunX = 512;
  const sunY = 248;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, isDusk ? 260 : 190);
  sunGlow.addColorStop(0, isDusk ? 'rgba(255,235,190,0.92)' : 'rgba(255,180,120,0.34)');
  sunGlow.addColorStop(0.18, isDusk ? 'rgba(255,175,95,0.55)' : 'rgba(100,150,220,0.22)');
  sunGlow.addColorStop(0.55, isDusk ? 'rgba(200,100,75,0.18)' : 'rgba(40,65,115,0.08)');
  sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(sunX - 280, sunY - 220, 560, 320);

  if (isDusk) {
    // Soft glowing setting sun disc right on horizon
    const disc = ctx.createRadialGradient(sunX, sunY - 8, 2, sunX, sunY - 8, 26);
    disc.addColorStop(0, '#fffbeb');
    disc.addColorStop(0.5, sunColorHex);
    disc.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sunX, sunY - 8, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Layered realistic high-altitude dusk/night cloud bands lit softly from below
  for (let c = 0; c < 42; c++) {
    const cx = Math.random() * 1024;
    const cy = 125 + Math.random() * 115;
    const cw = 85 + Math.random() * 175;
    const ch = 12 + Math.random() * 24;
    const warm = Math.abs(cx - sunX) < 280 && isDusk;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, cw * 0.5);
    cg.addColorStop(
      0,
      warm ? 'rgba(255,195,145,0.26)' : isDusk ? 'rgba(130,155,195,0.2)' : 'rgba(70,95,135,0.22)'
    );
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ch / (cw * 0.5));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, cw * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Realistic modern architectural glass skyscraper facade (Albedo + Lit Window EmissiveMap) */
export function createBuildingPBRTextures(): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const [albedoC, aCtx] = makeCanvas(256, 512);
  const [emissC, eCtx] = makeCanvas(256, 512);

  // Dark steel-blue architectural curtain wall glass
  aCtx.fillStyle = '#141c2b';
  aCtx.fillRect(0, 0, 256, 512);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  // Structural aluminum mullions & floor spandrel bands
  aCtx.fillStyle = '#232e42';
  for (let x = 0; x < 256; x += 32) {
    aCtx.fillRect(x, 0, 4, 512);
  }
  for (let y = 0; y < 512; y += 20) {
    aCtx.fillRect(0, y, 256, 5);
  }

  // Realistic office floor window lighting (warm tungsten, daylight cool white, amber accents)
  const palettes = ['#ffe7b8', '#fff4dc', '#dbeafe', '#fcd34d', '#bae6fd'];
  for (let y = 7; y < 504; y += 20) {
    const floorOcc = Math.random();
    if (floorOcc < 0.22) continue; // unlit floor
    const floorTint = palettes[Math.floor(Math.random() * palettes.length)];
    for (let x = 6; x < 248; x += 16) {
      if (Math.random() < 0.48) {
        const lum = 0.4 + Math.random() * 0.55;
        aCtx.fillStyle = floorTint;
        aCtx.globalAlpha = lum * 0.7;
        aCtx.fillRect(x, y, 11, 10);

        eCtx.fillStyle = floorTint;
        eCtx.globalAlpha = lum;
        eCtx.fillRect(x, y, 11, 10);
      }
    }
  }
  aCtx.globalAlpha = 1;
  eCtx.globalAlpha = 1;

  // Architectural mechanical penthouse louvre band
  aCtx.fillStyle = '#0f1623';
  aCtx.fillRect(0, 0, 256, 16);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 16);

  const map = new THREE.CanvasTexture(albedoC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const emissiveMap = new THREE.CanvasTexture(emissC);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

/** Layered wave normal map for photorealistic dusk ocean reflections under Hyperion Bay Bridge */
export function createOceanNormalTexture(): THREE.CanvasTexture {
  const S = 256;
  const [canvas, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const d = img.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * Math.PI * 2;
      const v = (y / S) * Math.PI * 2;
      const dx =
        Math.cos(u * 4 + v * 2) * 0.35 +
        Math.cos(u * 9 - v * 5) * 0.22 +
        Math.cos(u * 15 + v * 11) * 0.12;
      const dy =
        Math.sin(u * 3 + v * 5) * 0.35 +
        Math.sin(u * 7 - v * 8) * 0.22 +
        Math.sin(u * 13 + v * 14) * 0.12;

      const idx = (y * S + x) * 4;
      d[idx] = Math.floor(128 + dx * 55);
      d[idx + 1] = Math.floor(128 + dy * 55);
      d[idx + 2] = 240;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(95, 95);
  return tex;
}

export function createParticleGlowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Realistic dark ambient-occlusion contact shadow grounded beneath a supercar chassis */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.clearRect(0, 0, 256, 512);

  // Soft outer penumbra
  ctx.save();
  ctx.translate(128, 256);
  ctx.scale(1, 2.0);
  const outer = ctx.createRadialGradient(0, 0, 28, 0, 0, 122);
  outer.addColorStop(0, 'rgba(3, 5, 10, 0.92)');
  outer.addColorStop(0.56, 'rgba(3, 5, 10, 0.72)');
  outer.addColorStop(0.82, 'rgba(3, 5, 10, 0.24)');
  outer.addColorStop(1, 'rgba(3, 5, 10, 0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(0, 0, 122, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHeadlightBeamTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.clearRect(0, 0, 128, 256);

  const vGrad = ctx.createLinearGradient(0, 256, 0, 0);
  vGrad.addColorStop(0, 'rgba(235, 245, 255, 0.72)');
  vGrad.addColorStop(0.35, 'rgba(200, 228, 255, 0.3)');
  vGrad.addColorStop(0.8, 'rgba(160, 200, 255, 0.06)');
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = vGrad;
  ctx.beginPath();
  ctx.moveTo(46, 256);
  ctx.lineTo(82, 256);
  ctx.lineTo(124, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-in';
  const hGrad = ctx.createLinearGradient(0, 0, 128, 0);
  hGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.28, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.72, 'rgba(0,0,0,1)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Realistic neutral cool-twilight HDR reflection probe for automotive clearcoat (no orange/yellow road blotches!) */
export function createProceduralEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b1220);

  // Neutral twilight sky dome inside reflection probe (crisp steel-blue horizon, zero orange cast on roads)
  const skyGradGeo = new THREE.SphereGeometry(40, 24, 16);
  const skyTex = createRealisticSkyTexture('#070d1b', '#14233d', '#2d4568', '#93b4d8', false);
  const skyMesh = new THREE.Mesh(
    skyGradGeo,
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
  );
  envScene.add(skyMesh);

  // Clean soft studio/highway overhead cool-white reflection strips so supercar clearcoat gleams sharply
  const softLampA = new THREE.MeshBasicMaterial({ color: 0xcbdcf2 });
  const softLampB = new THREE.MeshBasicMaterial({ color: 0xa8c4e5 });

  for (let i = -2; i <= 2; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 0.55), i % 2 === 0 ? softLampA : softLampB);
    lamp.position.set(i * 8, 17, -11);
    envScene.add(lamp);

    const lampBack = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.55, 0.55), softLampB);
    lampBack.position.set(i * 8, 15, 13);
    envScene.add(lampBack);
  }

  const rt = pmrem.fromScene(envScene, 0.045);
  skyTex.dispose();
  skyGradGeo.dispose();
  pmrem.dispose();
  return rt.texture;
}
