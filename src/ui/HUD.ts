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
  private readonly overdrivePill = document.getElementById('overdrive-pill')!;

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
  private minimapHyperSegments: { x: number; y: number }[][] = [];
  private showHyperZones = false;
  private trackAccent = '#00f2ff';
  private lastCalloutText = '';
  private lastCalloutAt = 0;

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
  }

  public configureTrack(spline: TrackSpline): void {
    this.minimapOutline = spline.getMinimapOutline(6);
    this.trackAccent = spline.config.accentColorHex;
    this.trackLabelEl.textContent = spline.config.nameZh;

    // Pre-project auto-detected Hyper Straight Infinite-Nitro corridors for zero-overhead minimap rendering
    this.minimapHyperSegments = [];
    if (this.minimapOutline && spline.hyperZones.length > 0) {
      for (const z of spline.hyperZones) {
        const segPts: { x: number; y: number }[] = [];
        const steps = Math.max(8, Math.min(48, Math.ceil(z.length / 120)));
        for (let i = 0; i <= steps; i++) {
          const sCur = z.sStart + (i / steps) * z.length;
          const f = spline.getFrameAtDistance(sCur);
          segPts.push(spline.projectToMinimap(f.pos, this.minimapOutline));
        }
        this.minimapHyperSegments.push(segPts);
      }
    }
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

  public setHyperZonesVisible(visible: boolean): void {
    this.showHyperZones = visible;
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
    const now = performance.now();
    // Deduplicate rapid repeated triggers (e.g. tapping NITRO repeatedly won't stack 3 banners!)
    if (text === this.lastCalloutText && now - this.lastCalloutAt < 1400) {
      return;
    }
    this.lastCalloutText = text;
    this.lastCalloutAt = now;

    const isTouch = document.body.classList.contains('touch-mode');
    const displayText = isTouch ? text.replace('SUPER NITRO OVERDRIVE!', 'SUPER NITRO!') : text;

    const el = document.createElement('div');
    el.className = `callout-pill ${variant}`;
    el.textContent = displayText;
    this.calloutStack.appendChild(el);

    // On mobile touch mode, show AT MOST 1 sleek compact pill at a time so the road view stays wide open!
    const maxVisible = isTouch ? 1 : 2;
    while (this.calloutStack.children.length > maxVisible) {
      this.calloutStack.removeChild(this.calloutStack.firstChild!);
    }
    setTimeout(() => {
      el.remove();
    }, isTouch ? 1180 : 1580);
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

    const speedRatio = clamp(telemetry.speedKmh / 540, 0, 1);
    const speedDash = 355 * (1 - speedRatio);
    this.speedArc.setAttribute('stroke-dashoffset', speedDash.toFixed(1));

    const rpmDash = 280 * (1 - clamp(telemetry.rpmNorm, 0, 1));
    this.rpmArc.setAttribute('stroke-dashoffset', rpmDash.toFixed(1));

    // Hyper Straight Infinite-Nitro Zone / Straightaway Auto-Escalating Overdrive Pill
    if (telemetry.inHyperZone && !telemetry.nitroLockedByDrift) {
      const rem = telemetry.hyperZoneRemaining;
      const remTxt = rem >= 1000 ? `${(rem / 1000).toFixed(1)} KM` : `${rem}M`;
      this.overdrivePill.classList.remove('hidden', 'stage2');
      this.overdrivePill.classList.add('hyper-zone');
      this.overdrivePill.textContent = `⚡ ∞ 无限氮气直道 · ${remTxt}`;
    } else if (telemetry.overdriveStage >= 1 && !telemetry.isDrifting) {
      this.overdrivePill.classList.remove('hidden', 'hyper-zone');
      this.overdrivePill.classList.toggle('stage2', telemetry.overdriveStage === 2);
      this.overdrivePill.textContent =
        telemetry.overdriveStage === 2 ? '⚡⚡ HYPER OVERDRIVE II' : '⚡ DRS OVERDRIVE I';
    } else {
      this.overdrivePill.classList.add('hidden');
      this.overdrivePill.classList.remove('stage2', 'hyper-zone');
    }

    // Nitro Bar
    const nPct = clamp(telemetry.nitro, 0, 100);
    const isInfZone = telemetry.inHyperZone && !telemetry.nitroLockedByDrift;
    this.nitroFill.style.width = `${isInfZone ? 100 : nPct.toFixed(1)}%`;
    const isSuperState = telemetry.isSuperNitro || nPct >= 82;
    this.nitroFill.classList.toggle('super', isSuperState && !isInfZone);
    this.nitroFill.classList.toggle('infinite', isInfZone);

    this.nitroStatus.classList.remove('ready', 'super', 'locked', 'infinite');
    if (telemetry.nitroLockedByDrift) {
      this.nitroStatus.textContent = '漂移禁用氮气';
      this.nitroStatus.classList.add('locked');
    } else if (isInfZone && telemetry.isNitroActive) {
      this.nitroStatus.textContent = '★ ∞ 无限氮气爆发!';
      this.nitroStatus.classList.add('infinite');
    } else if (isInfZone) {
      this.nitroStatus.textContent = '∞ 无限 [SHIFT]';
      this.nitroStatus.classList.add('infinite');
    } else if (telemetry.isSuperNitro) {
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

    // Alerts (on mobile, suppress slipstream pill when a transient callout pill is active so they never collide)
    this.wrongWayEl.classList.toggle('hidden', !telemetry.isWrongWay);
    const suppressSlip =
      document.body.classList.contains('touch-mode') && this.calloutStack.children.length > 0;
    this.slipstreamEl.classList.toggle('hidden', !telemetry.isSlipstreaming || suppressSlip);

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

    // Highlight auto-detected Hyper Straight Infinite-Nitro corridors in electric cyan-gold when enabled!
    if (this.showHyperZones && this.minimapHyperSegments.length > 0) {
      ctx.lineCap = 'round';
      for (const seg of this.minimapHyperSegments) {
        if (seg.length < 2) continue;
        ctx.beginPath();
        seg.forEach((p, idx) => {
          const px = pad + p.x * drawW;
          const py = pad + p.y * drawH;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = 'rgba(0, 242, 255, 0.55)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }
    }

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
