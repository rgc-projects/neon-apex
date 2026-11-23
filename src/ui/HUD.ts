import { CameraMode, RacerHUDTelemetry } from '../types';
import { TrackSpline } from '../track/TrackSpline';
import { clamp, formatTime, ordinalSuffix } from '../utils/math';
import { RacerPhysics } from '../vehicle/CarPhysics';

export class HUD {
  private readonly root = document.getElementById('hud-overlay')!;
  private readonly rankEl = document.getElementById('hud-rank')!;
  private readonly rankSuffixEl = document.getElementById('hud-rank-suffix')!;
  private readonly lapEl = document.getElementById('hud-lap')!;
  private readonly timeEl = document.getElementById('hud-time')!;
  private readonly bestLapEl = document.getElementById('hud-best-lap')!;
  private readonly scoreEl = document.getElementById('hud-score')!;

  private readonly speedEl = document.getElementById('hud-speed')!;
  private readonly gearEl = document.getElementById('hud-gear')!;
  private readonly speedArc = document.getElementById('speedo-arc')!;
  private readonly rpmArc = document.getElementById('rpm-arc')!;

  private readonly nitroFill = document.getElementById('nitro-bar-fill')!;
  private readonly nitroStatus = document.getElementById('nitro-status')!;

  private readonly driftHud = document.getElementById('drift-hud')!;
  private readonly driftLabel = document.getElementById('drift-tier-label')!;
  private readonly driftMeters = document.getElementById('drift-meters')!;
  private readonly driftFill = document.getElementById('drift-bar-fill')!;

  private readonly countdownBanner = document.getElementById('countdown-banner')!;
  private readonly countdownText = document.getElementById('countdown-text')!;
  private readonly startRpmMeter = document.getElementById('start-rpm-meter')!;
  private readonly startRpmFill = document.getElementById('start-rpm-fill')!;

  private readonly wrongWayEl = document.getElementById('wrong-way-alert')!;
  private readonly cornerCalloutEl = document.getElementById('corner-callout')!;
  private readonly cornerArrowEl = document.getElementById('corner-arrow')!;
  private readonly cornerTypeEl = document.getElementById('corner-type')!;
  private readonly cornerDistEl = document.getElementById('corner-dist')!;
  private readonly slipstreamEl = document.getElementById('slipstream-indicator')!;
  private readonly calloutStack = document.getElementById('callout-stack')!;

  private readonly trackLabelEl = document.getElementById('hud-track-label')!;
  private readonly minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  private readonly minimapCtx = this.minimapCanvas.getContext('2d')!;

  public readonly camBtn = document.getElementById('btn-hud-cam')!;
  public readonly audioBtn = document.getElementById('btn-hud-audio')!;
  public readonly pauseBtn = document.getElementById('btn-hud-pause')!;
  public readonly touchBtn = document.getElementById('btn-hud-touch')!;
  public readonly resetBtn = document.getElementById('btn-hud-reset')!;

  private minimapOutline: {
    points: { x: number; y: number }[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } | null = null;
  private trackAccent = '#00f2ff';

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
  }

  public configureTrack(spline: TrackSpline): void {
    this.minimapOutline = spline.getMinimapOutline(6);
    this.trackAccent = spline.config.accentColorHex;
    this.trackLabelEl.textContent = spline.config.nameZh;
  }

  public setCameraLabel(mode: CameraMode): void {
    this.camBtn.textContent = mode === 'CHASE' ? 'CHASE' : 'HOOD';
  }

  public setMutedLabel(muted: boolean): void {
    this.audioBtn.textContent = muted ? '🔇' : '🔊';
  }

  public setTouchLabel(enabled: boolean): void {
    this.touchBtn.classList.toggle('active-pill', enabled);
  }

  public showCountdown(text: string | null, isGo = false, startRpmNorm = 0, showRpm = false): void {
    if (!text) {
      this.countdownBanner.classList.add('hidden');
      return;
    }
    this.countdownBanner.classList.remove('hidden');
    if (this.countdownText.textContent !== text) {
      this.countdownText.textContent = text;
      this.countdownText.classList.toggle('go', isGo);
      // Restart pop animation cleanly
      this.countdownText.style.animation = 'none';
      void this.countdownText.offsetWidth;
      this.countdownText.style.animation = '';
    }
    this.startRpmMeter.classList.toggle('hidden', !showRpm);
    if (showRpm) {
      this.startRpmFill.style.width = `${Math.round(clamp(startRpmNorm, 0, 1) * 100)}%`;
    }
  }

  public pushCallout(text: string, variant: 'cyan' | 'gold' | 'magenta' | 'green' = 'cyan'): void {
    const el = document.createElement('div');
    el.className = `callout-pill ${variant}`;
    el.textContent = text;
    this.calloutStack.appendChild(el);
    while (this.calloutStack.children.length > 3) {
      this.calloutStack.removeChild(this.calloutStack.firstChild!);
    }
    setTimeout(() => {
      el.remove();
    }, 1580);
  }

  public update(telemetry: RacerHUDTelemetry, racers: RacerPhysics[], spline: TrackSpline): void {
    this.rankEl.textContent = String(telemetry.rank);
    this.rankSuffixEl.textContent = ordinalSuffix(telemetry.rank);
    this.lapEl.innerHTML = `${telemetry.lap} <span>/ ${telemetry.totalLaps}</span>`;
    this.timeEl.textContent = formatTime(telemetry.raceTime);
    this.bestLapEl.textContent =
      telemetry.bestLapTime !== null ? formatTime(telemetry.bestLapTime) : '--:--.--';
    this.scoreEl.textContent = telemetry.styleScore.toLocaleString();

    // Speedometer & RPM Arcs
    this.speedEl.textContent = String(telemetry.speedKmh);
    this.gearEl.textContent = String(telemetry.gear);

    const speedRatio = clamp(telemetry.speedKmh / 460, 0, 1);
    const speedDash = 355 * (1 - speedRatio);
    this.speedArc.setAttribute('stroke-dashoffset', speedDash.toFixed(1));

    const rpmDash = 280 * (1 - clamp(telemetry.rpmNorm, 0, 1));
    this.rpmArc.setAttribute('stroke-dashoffset', rpmDash.toFixed(1));

    // Nitro Bar
    const nPct = clamp(telemetry.nitro, 0, 100);
    this.nitroFill.style.width = `${nPct.toFixed(1)}%`;
    const isSuperState = telemetry.isSuperNitro || nPct >= 82;
    this.nitroFill.classList.toggle('super', isSuperState);

    this.nitroStatus.classList.remove('ready', 'super');
    if (telemetry.isSuperNitro) {
      this.nitroStatus.textContent = '★ SUPER NITRO!';
      this.nitroStatus.classList.add('super');
    } else if (telemetry.isNitroActive) {
      this.nitroStatus.textContent = 'BOOSTING!';
      this.nitroStatus.classList.add('ready');
    } else if (nPct >= 82) {
      this.nitroStatus.textContent = 'SUPER READY [SHIFT]';
      this.nitroStatus.classList.add('super');
    } else if (nPct >= 14) {
      this.nitroStatus.textContent = 'READY [SHIFT]';
      this.nitroStatus.classList.add('ready');
    } else {
      this.nitroStatus.textContent = 'DRIFT TO CHARGE';
    }

    // Live Drift Charge HUD (shows live slip angle + road banking angle!)
    if (telemetry.isDrifting) {
      this.driftHud.classList.remove('hidden');
      const bankTag = telemetry.bankAngleDeg >= 12 ? ` · BANK ${telemetry.bankAngleDeg}°` : '';
      const angleTag = telemetry.driftAngleDeg >= 10 ? ` ${telemetry.driftAngleDeg}°` : '';
      this.driftMeters.textContent = `${telemetry.driftDistance}m${bankTag}`;
      this.driftFill.style.width = `${Math.round(telemetry.driftChargeNorm * 100)}%`;

      const labels = ['DRIFTING', 'MINI BOOST', 'SUPER DRIFT!', '★ ULTRA DRIFT ★'];
      const cols = ['#7dd3fc', '#00f2ff', '#ffb800', '#ff2aff'];
      this.driftLabel.textContent = `${labels[telemetry.driftTier]}${angleTag}`;
      this.driftLabel.style.color = cols[telemetry.driftTier];
      this.driftFill.style.background = cols[telemetry.driftTier];
      this.driftFill.style.boxShadow = `0 0 14px ${cols[telemetry.driftTier]}`;
    } else {
      this.driftHud.classList.add('hidden');
    }

    // Upcoming Sharp Corner Telegraph Callout (like Forza / DiRT / GT)
    const uc = telemetry.upcomingCorner;
    if (uc && !telemetry.isWrongWay && telemetry.speedKmh > 90) {
      this.cornerCalloutEl.classList.remove('hidden');
      this.cornerCalloutEl.classList.toggle('hairpin', uc.isHairpin);
      this.cornerCalloutEl.classList.toggle('urgent', uc.distanceMeters <= 75);
      this.cornerArrowEl.textContent = uc.isHairpin
        ? uc.direction > 0
          ? '↷'
          : '↶'
        : uc.direction > 0
          ? '↱'
          : '↰';
      const dirTxt = uc.direction > 0 ? '右弯' : '左弯';
      const bankTxt = uc.bankDeg >= 18 ? ` · 倾角 ${uc.bankDeg}°` : '';
      this.cornerTypeEl.textContent = uc.isHairpin ? `U型发卡${dirTxt}${bankTxt}` : `90° ${dirTxt}${bankTxt}`;
      this.cornerDistEl.textContent = `${uc.distanceMeters}m · DRIFT`;
    } else {
      this.cornerCalloutEl.classList.add('hidden');
    }

    // Alerts
    this.wrongWayEl.classList.toggle('hidden', !telemetry.isWrongWay);
    this.slipstreamEl.classList.toggle('hidden', !telemetry.isSlipstreaming);

    // Live 2D Minimap
    this.drawMinimap(racers, spline);
  }

  private drawMinimap(racers: RacerPhysics[], spline: TrackSpline): void {
    if (!this.minimapOutline) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const pad = 16;
    const drawW = w - pad * 2;
    const drawH = h - pad * 2;

    ctx.clearRect(0, 0, w, h);

    const pts = this.minimapOutline.points;
    if (pts.length < 3) return;

    // Outer neon track glow
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const px = pad + p.x * drawW;
      const py = pad + p.y * drawH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    ctx.strokeStyle = 'rgba(0, 242, 255, 0.25)';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = this.trackAccent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Start/Finish marker dot
    const sp = pts[0];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pad + sp.x * drawW, pad + sp.y * drawH, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw AI racers first, then Player arrow on top
    for (const r of racers) {
      if (r.isPlayer) continue;
      const m = spline.projectToMinimap(r.worldPos, this.minimapOutline);
      const x = pad + m.x * drawW;
      const y = pad + m.y * drawH;
      ctx.fillStyle = r.colorHex;
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#040712';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const player = racers.find((r) => r.isPlayer);
    if (player) {
      const m = spline.projectToMinimap(player.worldPos, this.minimapOutline);
      const x = pad + m.x * drawW;
      const y = pad + m.y * drawH;
      const heading = Math.atan2(player.worldForward.z, player.worldForward.x);

      ctx.translate(x, y);
      ctx.rotate(heading);
      ctx.shadowColor = '#00f2ff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5.5, -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5.5, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
