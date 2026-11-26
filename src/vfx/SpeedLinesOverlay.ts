import { clamp } from '../utils/math';

interface SpeedStreak {
  angle: number;
  dist: number;
  speed: number;
  len: number;
  width: number;
}

/** 2D Canvas radial Speed Lines + Nitro energy vignette overlay for pure arcade sensation */
export class SpeedLinesOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly streaks: SpeedStreak[] = [];
  private w = 1;
  private h = 1;
  private quality: 'low' | 'medium' | 'high' = 'high';
  private densityScale = 1.0;
  private wasClear = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    for (let i = 0; i < 64; i++) {
      this.streaks.push({
        angle: Math.random() * Math.PI * 2,
        dist: 0.35 + Math.random() * 0.65,
        speed: 1.4 + Math.random() * 1.8,
        len: 0.14 + Math.random() * 0.24,
        width: 1.0 + Math.random() * 2.2,
      });
    }
    this.resize(window.innerWidth, window.innerHeight);
  }

  public setQuality(level: 'low' | 'medium' | 'high'): void {
    this.quality = level;
    this.densityScale = level === 'low' ? 0 : level === 'medium' ? 0.55 : 1.0;
    this.canvas.style.display = level === 'low' ? 'none' : 'block';
    if (level === 'low') {
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.wasClear = true;
    } else {
      this.resize(this.w, this.h);
    }
  }

  public resize(width: number, height: number): void {
    const maxDpr = this.quality === 'high' ? 1.5 : 0.75;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.w = Math.max(1, width);
    this.h = Math.max(1, height);
    this.canvas.width = Math.max(1, Math.floor(this.w * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.wasClear = true;
  }

  public update(
    dt: number,
    speedKmh: number,
    isNitro: boolean,
    isSuperNitro: boolean,
    isSlipstream: boolean,
    visible: boolean
  ): void {
    // Skip all full-screen 2D canvas GPU compositing on Low quality!
    if (this.quality === 'low') return;

    const ctx = this.ctx;
    if (!visible) {
      if (!this.wasClear) {
        ctx.clearRect(0, 0, this.w, this.h);
        this.wasClear = true;
      }
      return;
    }

    const baseIntensity = clamp((speedKmh - 215) / 185, 0, 1);
    const intensity = clamp(
      baseIntensity + (isNitro ? (isSuperNitro ? 0.65 : 0.42) : 0) + (isSlipstream ? 0.25 : 0),
      0,
      1.25
    );
    if (intensity <= 0.02) {
      if (!this.wasClear) {
        ctx.clearRect(0, 0, this.w, this.h);
        this.wasClear = true;
      }
      return;
    }

    ctx.clearRect(0, 0, this.w, this.h);
    this.wasClear = false;

    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const maxR = Math.hypot(cx, cy);

    // Subtle colored peripheral speed vignette on High quality (skip heavy full-screen radial gradient on Medium/mobile)
    if (this.quality === 'high' && (isNitro || isSlipstream)) {
      const vig = ctx.createRadialGradient(cx, cy, maxR * 0.42, cx, cy, maxR * 1.02);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      const edgeCol = isSuperNitro
        ? 'rgba(217, 70, 239, 0.28)'
        : isNitro
          ? 'rgba(0, 242, 255, 0.22)'
          : 'rgba(180, 245, 255, 0.14)';
      vig.addColorStop(1, edgeCol);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    const activeCount = Math.floor((12 + intensity * 28) * this.densityScale);
    ctx.lineCap = 'round';

    for (let i = 0; i < Math.min(activeCount, this.streaks.length); i++) {
      const s = this.streaks[i];
      s.dist += s.speed * (0.9 + intensity * 1.65) * dt;
      if (s.dist > 1.25) {
        s.dist = 0.52 + Math.random() * 0.24;
        s.angle = Math.random() * Math.PI * 2;
      }

      const r0 = s.dist * maxR;
      const r1 = (s.dist + s.len * (0.65 + intensity * 0.6)) * maxR;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);

      const alpha = clamp((s.dist - 0.45) * 0.72 * intensity, 0, 0.75);
      ctx.strokeStyle = isSuperNitro
        ? `rgba(255, 80, 220, ${alpha.toFixed(2)})`
        : isNitro
          ? `rgba(0, 242, 255, ${alpha.toFixed(2)})`
          : `rgba(205, 245, 255, ${(alpha * 0.72).toFixed(2)})`;
      ctx.lineWidth = s.width * (0.8 + intensity * 0.55);

      ctx.beginPath();
      ctx.moveTo(cx + cos * r0, cy + sin * r0);
      ctx.lineTo(cx + cos * r1, cy + sin * r1);
      ctx.stroke();
    }
  }
}
