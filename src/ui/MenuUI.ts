import { CAR_SPECS } from '../config/cars';
import { TRACK_CONFIGS } from '../config/tracks';
import { TrackSpline } from '../track/TrackSpline';

export interface MenuCallbacks {
  onSelectCar: (index: number) => void;
  onSelectTrack: (index: number) => void;
  onStartRace: () => void;
  onToggleAudio: () => boolean;
  onToggleTouch: () => boolean;
}

export class MenuUI {
  private readonly root = document.getElementById('menu-overlay')!;
  private readonly carListEl = document.getElementById('car-cards')!;
  private readonly carSpecsEl = document.getElementById('car-specs')!;
  private readonly trackListEl = document.getElementById('track-cards')!;
  private readonly trackInfoEl = document.getElementById('track-info')!;
  private readonly showcaseCarName = document.getElementById('showcase-car-name')!;
  private readonly showcaseTrackName = document.getElementById('showcase-track-name')!;
  private readonly audioBtn = document.getElementById('btn-menu-audio')!;
  private readonly touchBtn = document.getElementById('btn-menu-touch')!;
  private readonly controlsBtn = document.getElementById('btn-menu-controls')!;
  private readonly controlsModal = document.getElementById('controls-modal')!;
  private readonly closeControlsBtn = document.getElementById('btn-close-controls')!;
  private readonly startBtn = document.getElementById('btn-start-race')!;
  private readonly tabCarsBtn = document.getElementById('tab-cars')!;
  private readonly tabTracksBtn = document.getElementById('tab-tracks')!;
  private readonly panelCars = document.getElementById('menu-panel-cars')!;
  private readonly panelTracks = document.getElementById('menu-panel-tracks')!;

  private selectedCar = 0;
  private selectedTrack = 0;
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
    this.updateSelectionReadout();

    this.startBtn.addEventListener('click', () => this.callbacks.onStartRace());
    this.audioBtn.addEventListener('click', () => {
      const muted = this.callbacks.onToggleAudio();
      this.setMuted(muted);
    });
    this.touchBtn.addEventListener('click', () => {
      const on = this.callbacks.onToggleTouch();
      this.setTouchEnabled(on);
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
      const diffClass = t.difficulty === 'EXTREME' ? 'extreme' : t.difficulty === 'HARD' ? 'hard' : '';
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
        this.renderTracks();
        this.updateSelectionReadout();
        this.callbacks.onSelectTrack(idx);
      });
      this.trackListEl.appendChild(btn);
    });

    const tr = TRACK_CONFIGS[this.selectedTrack];
    this.trackInfoEl.innerHTML = `
      <div>${tr.description}</div>
      <div class="track-meta-pills">
        <span class="meta-pill">长度 ${this.trackLengths[this.selectedTrack]}m</span>
        <span class="meta-pill">${tr.laps} LAPS</span>
        <span class="meta-pill">${tr.boostPads.length} 加速带</span>
        <span class="meta-pill">${tr.jumpRamps.length} 飞跃跳台</span>
        <span class="meta-pill">最大倾角 ${tr.maxBankDeg}°</span>
      </div>
    `;
  }

  private updateSelectionReadout(): void {
    const car = CAR_SPECS[this.selectedCar];
    const track = TRACK_CONFIGS[this.selectedTrack];
    this.showcaseCarName.textContent = `${car.name} ${car.subtitle}`;
    this.showcaseTrackName.textContent = `${track.nameZh} // ${track.name}`;
  }
}
