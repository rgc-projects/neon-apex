import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createRoadTexture(asphaltTint: string, accentHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);

  // Dark base asphalt
  ctx.fillStyle = asphaltTint;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle wet reflective sheen toward center
  const sheen = ctx.createLinearGradient(0, 0, 512, 0);
  sheen.addColorStop(0, 'rgba(0,0,0,0.45)');
  sheen.addColorStop(0.18, 'rgba(30,40,70,0.22)');
  sheen.addColorStop(0.5, 'rgba(60,90,140,0.16)');
  sheen.addColorStop(0.82, 'rgba(30,40,70,0.22)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 512);

  // Procedural asphalt micro-speckle for speed sensation
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random() > 0.5 ? 255 : 0;
    const a = 0.025 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
    ctx.fillRect(x, y, 2, 3);
  }

  // Subtle transverse cyber grid seams
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Outer rumble curbs (alternating neon & dark tech blocks)
  for (let y = 0; y < 512; y += 64) {
    const isBright = (y / 64) % 2 === 0;
    ctx.fillStyle = isBright ? accentHex : '#1b1d30';
    ctx.fillRect(8, y, 16, 60);
    ctx.fillRect(488, y, 16, 60);
  }

  // Crisp glowing shoulder lines
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 0, 5, 512);
  ctx.fillRect(477, 0, 5, 512);

  // Center futuristic dashed double line
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.85;
  for (let y = 16; y < 512; y += 128) {
    ctx.fillRect(250, y, 4, 72);
    ctx.fillRect(258, y, 4, 72);
  }

  // Faint side lane dividers
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = 40; y < 512; y += 128) {
    ctx.fillRect(142, y, 3, 52);
    ctx.fillRect(367, y, 3, 52);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createBoostPadTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#031224';
  ctx.fillRect(0, 0, 256, 512);

  // Glowing outer frame borders
  const borderGrad = ctx.createLinearGradient(0, 0, 256, 0);
  borderGrad.addColorStop(0, '#00f2ff');
  borderGrad.addColorStop(0.12, 'rgba(0,242,255,0.12)');
  borderGrad.addColorStop(0.88, 'rgba(0,242,255,0.12)');
  borderGrad.addColorStop(1, '#00f2ff');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, 0, 256, 512);

  // Stacked glowing forward chevrons (pointing upward in UV +V)
  for (let i = 0; i < 4; i++) {
    const baseY = 512 - i * 128 - 22;
    ctx.save();
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = i % 2 === 0 ? '#67f9ff' : '#ffffff';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(42, baseY);
    ctx.lineTo(128, baseY - 68);
    ctx.lineTo(214, baseY);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRampTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#180c29';
  ctx.fillRect(0, 0, 256, 512);

  // Diagonal tech bars on side
  ctx.fillStyle = '#ff2a9d';
  for (let y = 0; y < 512; y += 48) {
    ctx.fillRect(0, y, 22, 24);
    ctx.fillRect(234, y, 22, 24);
  }

  // Launch chevrons in bright amber/magenta
  for (let i = 0; i < 4; i++) {
    const baseY = 480 - i * 116;
    ctx.save();
    ctx.shadowColor = '#ffae00';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = i === 3 ? '#ffffff' : '#ffb800';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(44, baseY);
    ctx.lineTo(128, baseY - 62);
    ctx.lineTo(212, baseY);
    ctx.stroke();
    ctx.restore();
  }

  // Bright launch lip bar at top
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 20);

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
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#090d1a';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
  ctx.fillStyle = '#00f2ff';
  ctx.fillRect(0, 0, 512, 8);
  ctx.fillRect(0, 120, 512, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createChevronBannerTexture(colorHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#090714';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = colorHex;
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 14;
  for (let x = 32; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x - 16, 24);
    ctx.lineTo(x + 18, 64);
    ctx.lineTo(x - 16, 104);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSkyTexture(
  topHex: string,
  midHex: string,
  horizonHex: string,
  sunColorHex: string
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);

  // Sky vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, topHex);
  grad.addColorStop(0.32, midHex);
  grad.addColorStop(0.495, horizonHex);
  grad.addColorStop(0.54, '#0c0820');
  grad.addColorStop(1.0, '#04030c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Subtle cyber nebula glow streaks
  for (let i = 0; i < 6; i++) {
    const cx = 120 + i * 170;
    const cy = 120 + (i % 2) * 55;
    const neb = ctx.createRadialGradient(cx, cy, 10, cx, cy, 180);
    neb.addColorStop(0, i % 2 === 0 ? 'rgba(0,242,255,0.12)' : 'rgba(255,42,157,0.12)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(cx - 180, cy - 180, 360, 360);
  }

  // Stars in upper sky
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 235;
    const size = Math.random() < 0.14 ? 2.1 : 1.1;
    const alpha = 0.25 + Math.random() * 0.75;
    ctx.fillStyle = `rgba(230,245,255,${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  // Iconic OutRun sliced Synthwave Sun on the horizon
  const sunX = 512;
  const sunY = 236;
  const sunR = 72;

  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 2.5);
  halo.addColorStop(0, sunColorHex);
  halo.addColorStop(0.35, 'rgba(255,42,157,0.38)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 2.6, sunY - sunR * 2.6, sunR * 5.2, sunR * 5.2);

  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();

  const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunGrad.addColorStop(0, '#fff7ad');
  sunGrad.addColorStop(0.42, sunColorHex);
  sunGrad.addColorStop(1, '#ff1f7a');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

  // Horizontal retro scanline slices on lower half of sun
  ctx.fillStyle = midHex;
  for (let i = 0; i < 7; i++) {
    const sliceY = sunY + 6 + i * 10;
    const sliceH = 1.6 + i * 0.9;
    ctx.fillRect(sunX - sunR, sliceY, sunR * 2, sliceH);
  }
  ctx.restore();

  // Horizon bright seam
  const hGlow = ctx.createLinearGradient(0, 240, 0, 272);
  hGlow.addColorStop(0, 'rgba(255,255,255,0)');
  hGlow.addColorStop(0.5, 'rgba(255,180,240,0.4)');
  hGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGlow;
  ctx.fillRect(0, 240, 1024, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBuildingTexture(accentA: string, accentB: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#090d1c';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle architectural vertical mullions
  ctx.fillStyle = '#121933';
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 4, 512);
  }

  // Lit futuristic window rows
  for (let y = 12; y < 504; y += 16) {
    const rowBright = Math.random() > 0.28;
    if (!rowBright) continue;
    const rowColor = Math.random() > 0.5 ? accentA : accentB;
    for (let x = 8; x < 248; x += 16) {
      if (Math.random() > 0.32) {
        ctx.fillStyle = Math.random() > 0.8 ? '#ffffff' : rowColor;
        ctx.globalAlpha = 0.35 + Math.random() * 0.65;
        ctx.fillRect(x, y, 10, 7);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Bright horizontal cyber trim bands
  ctx.fillStyle = accentA;
  ctx.fillRect(0, 8, 256, 5);
  ctx.fillStyle = accentB;
  ctx.fillRect(0, 252, 256, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCyberGridTexture(lineColor: string, bgHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 512);

  // Major glowing grid lines
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 4;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 12;
  ctx.strokeRect(2, 2, 508, 508);

  // Minor grid subdivisions
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.45;
  for (let i = 128; i < 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createParticleGlowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHeadlightBeamTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.clearRect(0, 0, 128, 256);

  // Soft tapered conical road headlight beam (origin at bottom center y=256 fading upward)
  const vGrad = ctx.createLinearGradient(0, 256, 0, 0);
  vGrad.addColorStop(0, 'rgba(210, 250, 255, 0.72)');
  vGrad.addColorStop(0.35, 'rgba(140, 235, 255, 0.34)');
  vGrad.addColorStop(0.8, 'rgba(80, 210, 255, 0.08)');
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = vGrad;
  ctx.beginPath();
  ctx.moveTo(46, 256);
  ctx.lineTo(82, 256);
  ctx.lineTo(124, 0);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();

  // Horizontal feathering mask
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

export function createProceduralEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0b0820);

  // Neon light strips inside reflection probe so metallic cars gleam dramatically
  const stripMat1 = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
  const stripMat2 = new THREE.MeshBasicMaterial({ color: 0xff2a9d });
  const stripMat3 = new THREE.MeshBasicMaterial({ color: 0xffb800 });
  const stripMat4 = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const s1 = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 1.5), stripMat1);
  s1.position.set(0, 10, -14);
  envScene.add(s1);

  const s2 = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 1.5), stripMat2);
  s2.position.set(0, 8, 14);
  envScene.add(s2);

  const s3 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 30), stripMat3);
  s3.position.set(14, 9, 0);
  envScene.add(s3);

  const s4 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 30), stripMat4);
  s4.position.set(-14, 12, 0);
  envScene.add(s4);

  const overhead = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({
    color: 0x4b6cff,
    side: THREE.DoubleSide,
  }));
  overhead.position.set(0, 18, 0);
  overhead.rotation.x = Math.PI / 2;
  envScene.add(overhead);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}
