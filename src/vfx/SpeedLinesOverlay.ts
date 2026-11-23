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

  public resize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = width;
    this.h = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  public update(
    dt: number,
    speedKmh: number,
    isNitro: boolean,
    isSuperNitro: boolean,
    isSlipstream: boolean,
    visible: boolean
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!visible) return;

    const baseIntensity = clamp((speedKmh - 215) / 185, 0, 1);
    const intensity = clamp(
      baseIntensity + (isNitro ? (isSuperNitro ? 0.65 : 0.42) : 0) + (isSlipstream ? 0.25 : 0),
      0,
      1.25
    );
    if (intensity <= 0.02) return;

    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const maxR = Math.hypot(cx, cy);

    // Subtle colored peripheral speed vignette when boosting
    if (isNitro || isSlipstream) {
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

    const activeCount = Math.floor(18 + intensity * 44);
    ctx.lineCap = 'round';

    for (let i = 0; i < Math.min(activeCount, this.streaks.length); i++) {
      const s = this.streaks[i];
      s.dist += s.speed * (0.9 + intensity * 1.8) * dt;
      if (s.dist > 1.25) {
        s.dist = 0.28 + Math.random() * 0.22;
        s.angle = Math.random() * Math.PI * 2;
      }

      const r0 = Math.max(0.32, s.dist - s.len * (0.65 + intensity * 0.6)) * maxR;
      const r1 = s.dist * maxR;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);

      const alpha = clamp(intensity * 0.55 * (1 - Math.abs(s.dist - 0.8) * 0.6), 0.04, 0.65);
      if (isSuperNitro && i % 2 === 0) {
        ctx.strokeStyle = `rgba(255, 70, 230, ${alpha})`;
      } else if (isNitro && i % 2 === 0) {
        ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
      } else {
        ctx.strokeStyle = `rgba(224, 248, 255, ${alpha * 0.85})`;
      }
      ctx.lineWidth = s.width * (0.7 + intensity * 0.55);

      ctx.beginPath();
      ctx.moveTo(cx + cos * r0, cy + sin * r0);
      ctx.lineTo(cx + cos * r1, cy + sin * r1);
      ctx.stroke();
    }
  }
}
