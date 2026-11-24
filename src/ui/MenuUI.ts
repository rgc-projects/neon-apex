import { CAR_SPECS } from '../config/cars';
import { TRACK_CONFIGS } from '../config/tracks';
import { TrackSpline } from '../track/TrackSpline';

export interface MenuCallbacks {
  onSelectCar: (index: number) => void;
  onSelectTrack: (index: number) => void;
  onSelectLaps: (laps: number) => void;
  onStartRace: () => void;
  onToggleAudio: () => boolean;
  onToggleTouch: () => boolean;
  onToggleFullscreen: () => void;
  onToggleDriftNitro: () => boolean;
  onToggleHyperNitro: () => boolean;
}

export class MenuUI {
  private readonly root = document.getElementById('menu-overlay')!;
  private readonly carListEl = document.getElementById('car-cards')!;
  private readonly carSpecsEl = document.getElementById('car-specs')!;
  private readonly trackListEl = document.getElementById('track-cards')!;
  private readonly trackInfoEl = document.getElementById('track-info')!;
  private readonly showcaseCarName = document.getElementById('showcase-car-name')!;
  private readonly showcaseTrackName = document.getElementById('showcase-track-name')!;
  private readonly launchSubEl = document.getElementById('launch-sub')!;
  private readonly fullscreenBtn = document.getElementById('btn-menu-fullscreen')!;
  private readonly audioBtn = document.getElementById('btn-menu-audio')!;
  private readonly touchBtn = document.getElementById('btn-menu-touch')!;
  private readonly driftNitroBtn = document.getElementById('btn-menu-drift-nitro')!;
  private readonly driftNitroStateEl = document.getElementById('drift-nitro-state')!;
  private readonly hyperNitroBtn = document.getElementById('btn-menu-hyper-nitro')!;
  private readonly hyperNitroStateEl = document.getElementById('hyper-nitro-state')!;
  private readonly controlsBtn = document.getElementById('btn-menu-controls')!;
  private readonly controlsModal = document.getElementById('controls-modal')!;
  private readonly closeControlsBtn = document.getElementById('btn-close-controls')!;
  private readonly startBtn = document.getElementById('btn-start-race')!;
  private readonly tabCarsBtn = document.getElementById('tab-cars')!;
  private readonly tabTracksBtn = document.getElementById('tab-tracks')!;
  private readonly panelCars = document.getElementById('menu-panel-cars')!;
  private readonly panelTracks = document.getElementById('menu-panel-tracks')!;
  private readonly lapButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#lap-selector .lap-opt-btn')
  );

  private selectedCar = 0;
  private selectedTrack = 0;
  private selectedLaps = TRACK_CONFIGS[0].laps;
  private readonly trackSvgPaths: string[] = [];
  private readonly trackLengths: number[] = [];

  constructor(private readonly callbacks: MenuCallbacks) {
    // Precompute crisp SVG silhouettes for every track from actual 3D spline geometry
    for (const cfg of TRACK_CONFIGS) {
      const spline = new TrackSpline(cfg);
      this.trackLengths.push(Math.round(spline.totalLength));
      const { points } = spline.getMinimapOutline(10);
      const path =
        points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(8 + p.x * 84).toFixed(1)} ${(8 + p.y * 64).toFixed(1)}`)
          .join(' ') + ' Z';
      this.trackSvgPaths.push(path);
    }

    this.renderCars();
    this.renderTracks();
    this.syncLapButtons();
    this.updateSelectionReadout();

    this.lapButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const laps = Number(btn.dataset.laps) || 1;
        this.selectedLaps = laps;
        this.syncLapButtons();
        this.renderTracks();
        this.updateSelectionReadout();
        this.callbacks.onSelectLaps(laps);
      });
    });

    this.startBtn.addEventListener('click', () => this.callbacks.onStartRace());
    this.fullscreenBtn.addEventListener('click', () => this.callbacks.onToggleFullscreen());
    this.audioBtn.addEventListener('click', () => {
      const muted = this.callbacks.onToggleAudio();
      this.setMuted(muted);
    });
    this.touchBtn.addEventListener('click', () => {
      const on = this.callbacks.onToggleTouch();
      this.setTouchEnabled(on);
    });
    this.driftNitroBtn.addEventListener('click', () => {
      const on = this.callbacks.onToggleDriftNitro();
      this.setDriftNitroEnabled(on);
    });
    this.hyperNitroBtn.addEventListener('click', () => {
      const on = this.callbacks.onToggleHyperNitro();
      this.setHyperNitroEnabled(on);
    });
    this.controlsBtn.addEventListener('click', () => {
      this.controlsModal.classList.remove('hidden');
    });
    this.closeControlsBtn.addEventListener('click', () => {
      this.controlsModal.classList.add('hidden');
    });
    this.controlsModal.addEventListener('click', (e) => {
      if (e.target === this.controlsModal) this.controlsModal.classList.add('hidden');
    });

    // Mobile portrait tab switch (Car Selection <-> Track Selection)
    const setMobileTab = (tab: 'cars' | 'tracks') => {
      this.tabCarsBtn.classList.toggle('active', tab === 'cars');
      this.tabTracksBtn.classList.toggle('active', tab === 'tracks');
      this.panelCars.classList.toggle('mob-tab-active', tab === 'cars');
      this.panelTracks.classList.toggle('mob-tab-active', tab === 'tracks');
    };
    this.tabCarsBtn.addEventListener('click', () => setMobileTab('cars'));
    this.tabTracksBtn.addEventListener('click', () => setMobileTab('tracks'));
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
    if (!visible) {
      this.controlsModal.classList.add('hidden');
    }
  }

  public setMuted(muted: boolean): void {
    const icon = this.audioBtn.querySelector('.icon')!;
    const label = this.audioBtn.querySelector('.label')!;
    icon.textContent = muted ? '🔇' : '🔊';
    label.textContent = muted ? 'AUDIO OFF' : 'AUDIO ON';
  }

  public setTouchEnabled(enabled: boolean): void {
    const label = this.touchBtn.querySelector('.label')!;
    label.textContent = enabled ? '触屏: 开' : '触屏: 关';
    this.touchBtn.style.borderColor = enabled ? '#00ff9d' : '';
  }

  public setFullscreen(active: boolean): void {
    const icon = this.fullscreenBtn.querySelector('.icon')!;
    const label = this.fullscreenBtn.querySelector('.label')!;
    icon.innerHTML = active
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    label.textContent = active ? '退出全屏' : '全屏';
    this.fullscreenBtn.style.borderColor = active ? '#00f2ff' : '';
  }

  public setDriftNitroEnabled(enabled: boolean): void {
    this.driftNitroBtn.classList.toggle('active', enabled);
    this.driftNitroBtn.setAttribute('aria-checked', String(enabled));
    this.driftNitroStateEl.textContent = enabled ? '开 · 允许同喷' : '关 · 漂移禁氮';
  }

  public setHyperNitroEnabled(enabled: boolean): void {
    this.hyperNitroBtn.classList.toggle('active', enabled);
    this.hyperNitroBtn.setAttribute('aria-checked', String(enabled));
    this.hyperNitroStateEl.textContent = enabled ? '开 · 长直道满氮' : '关 · 常规氮气';
  }

  private renderCars(): void {
    this.carListEl.innerHTML = '';
    CAR_SPECS.forEach((car, idx) => {
      const btn = document.createElement('button');
      btn.className = `select-card ${idx === this.selectedCar ? 'selected' : ''}`;
      const paintHex = `#${car.primaryColor.toString(16).padStart(6, '0')}`;
      btn.innerHTML = `
        <div class="card-top">
          <div class="card-title-row">
            <span class="color-swatch" style="background:${paintHex};color:${paintHex}"></span>
            <span class="card-name">${car.name}</span>
          </div>
          <span class="card-badge">${car.archetypeZh}</span>
        </div>
        <div class="card-sub">${car.subtitle} · ${car.archetype}</div>
      `;
      btn.addEventListener('click', () => {
        this.selectedCar = idx;
        this.renderCars();
        this.updateSelectionReadout();
        this.callbacks.onSelectCar(idx);
      });
      this.carListEl.appendChild(btn);
    });

    const c = CAR_SPECS[this.selectedCar];
    this.carSpecsEl.innerHTML = `
      <p class="spec-desc">${c.description}</p>
      ${this.statBarHtml('TOP SPEED', c.stats.speed)}
      ${this.statBarHtml('ACCEL', c.stats.accel)}
      ${this.statBarHtml('DRIFT', c.stats.drift)}
      ${this.statBarHtml('NITRO', c.stats.nitro)}
    `;
  }

  private statBarHtml(label: string, val: number): string {
    return `
      <div class="stat-row">
        <span>${label}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${val}%"></div></div>
        <span class="mono" style="color:#fff;text-align:right">${val}</span>
      </div>
    `;
  }

  private renderTracks(): void {
    this.trackListEl.innerHTML = '';
    TRACK_CONFIGS.forEach((t, idx) => {
      const btn = document.createElement('button');
      const diffClass =
        t.difficulty === 'GRAND'
          ? 'grand'
          : t.difficulty === 'EXTREME'
            ? 'extreme'
            : t.difficulty === 'HARD'
              ? 'hard'
              : '';
      btn.className = `select-card track-card ${idx === this.selectedTrack ? 'selected' : ''}`;
      btn.innerHTML = `
        <div class="track-card-inner">
          <div>
            <div class="card-top">
              <span class="card-name">${t.nameZh}</span>
              <span class="card-badge ${diffClass}">${t.difficulty}</span>
            </div>
            <div class="card-sub">${t.name}</div>
          </div>
          <svg class="track-svg" viewBox="0 0 100 80">
            <path d="${this.trackSvgPaths[idx]}" fill="none" stroke="${t.accentColorHex}" stroke-width="4" stroke-linejoin="round" />
          </svg>
        </div>
      `;
      btn.addEventListener('click', () => {
        this.selectedTrack = idx;
        this.selectedLaps = TRACK_CONFIGS[idx].laps;
        this.syncLapButtons();
        this.renderTracks();
        this.updateSelectionReadout();
        this.callbacks.onSelectTrack(idx);
        this.callbacks.onSelectLaps(this.selectedLaps);
      });
      this.trackListEl.appendChild(btn);
    });

    const tr = TRACK_CONFIGS[this.selectedTrack];
    const rawLen = this.trackLengths[this.selectedTrack];
    const lenLabel = rawLen >= 10000 ? `${(rawLen / 1000).toFixed(1)} km` : `${rawLen}m`;
    const lapWord = this.selectedLaps === 1 ? '1 LAP' : `${this.selectedLaps} LAPS`;
    this.trackInfoEl.innerHTML = `
      <div>${tr.description}</div>
      <div class="track-meta-pills">
        <span class="meta-pill">单圈 ${lenLabel}</span>
        <span class="meta-pill">${lapWord}</span>
        <span class="meta-pill">${tr.boostPads.length} 加速带</span>
        <span class="meta-pill">${tr.jumpRamps.length} 飞跃跳台</span>
        <span class="meta-pill">最大倾角 ${tr.maxBankDeg}°</span>
      </div>
    `;
  }

  private syncLapButtons(): void {
    this.lapButtons.forEach((btn) => {
      const laps = Number(btn.dataset.laps);
      btn.classList.toggle('active', laps === this.selectedLaps);
    });
  }

  private updateSelectionReadout(): void {
    const car = CAR_SPECS[this.selectedCar];
    const track = TRACK_CONFIGS[this.selectedTrack];
    const rawLen = this.trackLengths[this.selectedTrack];
    const totalKm = ((rawLen * this.selectedLaps) / 1000).toFixed(1);
    const lapWord = this.selectedLaps === 1 ? '1 LAP' : `${this.selectedLaps} LAPS`;
    this.showcaseCarName.textContent = `${car.name} ${car.subtitle}`;
    this.showcaseTrackName.textContent = `${track.nameZh} // ${track.name}`;
    this.launchSubEl.textContent =
      track.id === 'isle-of-man'
        ? `${lapWord} · 总长 ${totalKm}KM · ISLE OF MAN TT`
        : track.id === 'aurora-fjord'
          ? `${lapWord} · 总长 ${totalKm}KM · AURORA FJORD`
          : track.id === 'nujiang-72'
            ? `${lapWord} · 总长 ${totalKm}KM · NUJIANG 72 BENDS`
            : rawLen >= 10000
              ? `${lapWord} · 总长 ${totalKm}KM · GRAND ISLAND`
              : `${lapWord} · 6 RACERS · DRIFT TO BOOST`;
  }
}
