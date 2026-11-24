import { CAR_SPECS } from '../config/cars';
import { TRACK_CONFIGS } from '../config/tracks';
import { TrackConfig } from '../types';
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
  onToggleOverdrive: () => boolean;
  onToggleHyperNitro: () => boolean;
}

type TrackCategory = 'all' | 'classic' | 'drift' | 'mega' | 'fav';
type TrackSort = 'default' | 'len-asc' | 'len-desc' | 'bank-desc';

interface TrackMeta {
  index: number;
  config: TrackConfig;
  lengthMeters: number;
  elevSpan: number;
  hyperZoneCount: number;
  svgPath: string;
  isClassic: boolean;
  isDrift: boolean;
  isMega: boolean;
}

const FAV_STORAGE_KEY = 'neon_apex_favorite_tracks';

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
  private readonly overdriveBtn = document.getElementById('btn-menu-overdrive')!;
  private readonly overdriveStateEl = document.getElementById('overdrive-state')!;
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

  // Compact Active Circuit Hub & Scalable Catalog Modal elements
  private readonly openCatalogBtn = document.getElementById('btn-open-catalog')!;
  private readonly trackTotalCountEl = document.getElementById('track-total-count')!;
  private readonly prevTrackBtn = document.getElementById('btn-prev-track')!;
  private readonly nextTrackBtn = document.getElementById('btn-next-track')!;
  private readonly heroFavBtn = document.getElementById('btn-hero-fav')!;
  private readonly heroNameEl = document.getElementById('hero-track-name')!;
  private readonly heroBadgeEl = document.getElementById('hero-track-badge')!;
  private readonly heroSubEl = document.getElementById('hero-track-sub')!;
  private readonly heroBlueprintBox = document.getElementById('hero-blueprint-box')!;
  private readonly heroSvgEl = document.getElementById('hero-track-svg')!;
  private readonly heroQuickChipsEl = document.getElementById('hero-quick-chips')!;
  private readonly sidebarCatTabsEl = document.getElementById('sidebar-cat-tabs')!;

  private readonly catalogModal = document.getElementById('circuit-catalog-modal')!;
  private readonly closeCatalogBtn = document.getElementById('btn-close-catalog')!;
  private readonly catalogMatchBadgeEl = document.getElementById('catalog-match-badge')!;
  private readonly catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement;
  private readonly catalogSortSelect = document.getElementById('catalog-sort-select') as HTMLSelectElement;
  private readonly catalogCatTabsEl = document.getElementById('catalog-cat-tabs')!;
  private readonly catalogGridEl = document.getElementById('catalog-grid')!;

  private selectedCar = 0;
  private selectedTrack = 0;
  private selectedLaps = TRACK_CONFIGS[0].laps;
  private sidebarCategory: TrackCategory = 'all';
  private catalogCategory: TrackCategory = 'all';
  private catalogSort: TrackSort = 'default';
  private catalogQuery = '';
  private readonly favorites = new Set<string>();
  private readonly trackMetas: TrackMeta[] = [];

  constructor(private readonly callbacks: MenuCallbacks) {
    this.loadFavorites();

    // Precompute crisp SVG silhouettes, exact lengths, elevation spans & auto-categories from real 3D splines
    TRACK_CONFIGS.forEach((cfg, index) => {
      const spline = new TrackSpline(cfg);
      const lengthMeters = Math.round(spline.totalLength);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < spline.sampleCount; i += 4) {
        const y = spline.samples[i].pos.y;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const { points } = spline.getMinimapOutline(10);
      const svgPath =
        points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(8 + p.x * 84).toFixed(1)} ${(8 + p.y * 64).toFixed(1)}`)
          .join(' ') + ' Z';

      this.trackMetas.push({
        index,
        config: cfg,
        lengthMeters,
        elevSpan: Math.max(0, Math.round(maxY - minY)),
        hyperZoneCount: spline.hyperZones.length,
        svgPath,
        isClassic: lengthMeters < 6000,
        isDrift:
          cfg.theme === 'mountain' ||
          cfg.theme === 'nujiang' ||
          cfg.theme === 'fjord' ||
          cfg.theme === 'akina' ||
          cfg.id === 'monaco-harbor',
        isMega: lengthMeters >= 10000,
      });
    });

    this.trackTotalCountEl.textContent = String(this.trackMetas.length);

    this.renderCars();
    this.renderTrackHub();
    this.syncLapButtons();
    this.updateSelectionReadout();

    // Lap selection
    this.lapButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const laps = Number(btn.dataset.laps) || 1;
        this.selectedLaps = laps;
        this.syncLapButtons();
        this.renderHeroAndDetail();
        this.updateSelectionReadout();
        this.callbacks.onSelectLaps(laps);
      });
    });

    // Quick Prev/Next & Favorite on Active Hero Card
    this.prevTrackBtn.addEventListener('click', () => this.stepSelectedTrack(-1));
    this.nextTrackBtn.addEventListener('click', () => this.stepSelectedTrack(1));
    this.heroFavBtn.addEventListener('click', () => {
      this.toggleFavorite(TRACK_CONFIGS[this.selectedTrack].id);
    });

    // Full-Catalog Circuit Browser triggers & controls
    this.openCatalogBtn.addEventListener('click', () => this.openCatalog());
    this.heroBlueprintBox.addEventListener('click', () => this.openCatalog());
    this.closeCatalogBtn.addEventListener('click', () => this.closeCatalog());
    this.catalogModal.addEventListener('click', (e) => {
      if (e.target === this.catalogModal) this.closeCatalog();
    });
    this.catalogSearchInput.addEventListener('input', () => {
      this.catalogQuery = this.catalogSearchInput.value.trim().toLowerCase();
      this.renderCatalogGrid();
    });
    this.catalogSortSelect.addEventListener('change', () => {
      this.catalogSort = (this.catalogSortSelect.value as TrackSort) || 'default';
      this.renderCatalogGrid();
    });

    // Global Escape closes Circuit Catalog or Controls modal when open on menu
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.root.classList.contains('active')) {
        if (!this.catalogModal.classList.contains('hidden')) {
          this.closeCatalog();
        } else if (!this.controlsModal.classList.contains('hidden')) {
          this.controlsModal.classList.add('hidden');
        }
      }
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
    this.overdriveBtn.addEventListener('click', () => {
      const on = this.callbacks.onToggleOverdrive();
      this.setOverdriveEnabled(on);
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

  private loadFavorites(): void {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string') this.favorites.add(id);
        }
      }
    } catch {
      // Ignore malformed/blocked storage
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(this.favorites)));
    } catch {
      // Ignore blocked storage
    }
  }

  private toggleFavorite(trackId: string): void {
    if (this.favorites.has(trackId)) {
      this.favorites.delete(trackId);
    } else {
      this.favorites.add(trackId);
    }
    this.saveFavorites();
    this.renderTrackHub();
    if (!this.catalogModal.classList.contains('hidden')) {
      this.renderCatalogTabs();
      this.renderCatalogGrid();
    }
  }

  private matchesCategory(meta: TrackMeta, cat: TrackCategory): boolean {
    if (cat === 'all') return true;
    if (cat === 'classic') return meta.isClassic;
    if (cat === 'drift') return meta.isDrift;
    if (cat === 'mega') return meta.isMega;
    if (cat === 'fav') return this.favorites.has(meta.config.id);
    return true;
  }

  private formatLen(meters: number): string {
    return meters >= 10000 ? `${(meters / 1000).toFixed(1)} km` : `${(meters / 1000).toFixed(2)} km`;
  }

  private diffClassFor(diff: TrackConfig['difficulty']): string {
    return diff === 'GRAND' ? 'grand' : diff === 'EXTREME' ? 'extreme' : diff === 'HARD' ? 'hard' : '';
  }

  private selectTrackByIndex(idx: number, scrollIntoView = false): void {
    if (idx < 0 || idx >= TRACK_CONFIGS.length) return;
    this.selectedTrack = idx;
    this.selectedLaps = TRACK_CONFIGS[idx].laps;
    this.syncLapButtons();
    this.renderTrackHub(scrollIntoView);
    this.updateSelectionReadout();
    this.callbacks.onSelectTrack(idx);
    this.callbacks.onSelectLaps(this.selectedLaps);
  }

  private stepSelectedTrack(delta: -1 | 1): void {
    const pool = this.trackMetas.filter((m) => this.matchesCategory(m, this.sidebarCategory));
    const list = pool.length > 0 ? pool : this.trackMetas;
    const curPos = list.findIndex((m) => m.index === this.selectedTrack);
    const nextPos = curPos < 0 ? 0 : (curPos + delta + list.length) % list.length;
    this.selectTrackByIndex(list[nextPos].index, true);
  }

  private openCatalog(): void {
    this.catalogCategory = this.sidebarCategory;
    this.renderCatalogTabs();
    this.renderCatalogGrid();
    this.catalogModal.classList.remove('hidden');
  }

  private closeCatalog(): void {
    this.catalogModal.classList.add('hidden');
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('active', visible);
    if (!visible) {
      this.controlsModal.classList.add('hidden');
      this.catalogModal.classList.add('hidden');
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
    this.driftNitroStateEl.textContent = enabled ? '开' : '关';
  }

  public setOverdriveEnabled(enabled: boolean): void {
    this.overdriveBtn.classList.toggle('active', enabled);
    this.overdriveBtn.setAttribute('aria-checked', String(enabled));
    this.overdriveStateEl.textContent = enabled ? '开' : '关';
  }

  public setHyperNitroEnabled(enabled: boolean): void {
    this.hyperNitroBtn.classList.toggle('active', enabled);
    this.hyperNitroBtn.setAttribute('aria-checked', String(enabled));
    this.hyperNitroStateEl.textContent = enabled ? '开' : '关';
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

  private renderTrackHub(scrollSelected = false): void {
    this.renderHeroAndDetail();
    this.renderSidebarCategoryTabs();
    this.renderSidebarList(scrollSelected);
  }

  private renderHeroAndDetail(): void {
    const meta = this.trackMetas[this.selectedTrack];
    const tr = meta.config;
    const isFav = this.favorites.has(tr.id);
    const diffClass = this.diffClassFor(tr.difficulty);

    this.heroNameEl.textContent = tr.nameZh;
    this.heroBadgeEl.textContent = tr.difficulty;
    this.heroBadgeEl.className = `card-badge ${diffClass}`;
    this.heroSubEl.textContent = tr.name;
    this.heroFavBtn.textContent = isFav ? '★' : '☆';
    this.heroFavBtn.classList.toggle('active', isFav);

    this.heroSvgEl.innerHTML = `<path d="${meta.svgPath}" fill="none" stroke="${tr.accentColorHex}" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round" />`;
    this.heroSvgEl.style.filter = `drop-shadow(0 0 8px ${tr.accentColorHex}88)`;

    const lenLabel = this.formatLen(meta.lengthMeters);
    const lapWord = this.selectedLaps === 1 ? '1 LAP' : `${this.selectedLaps} LAPS`;
    const hyperChip =
      meta.hyperZoneCount > 0 ? `<span class="hero-chip hyper">⚡ ${meta.hyperZoneCount} 长直道</span>` : '';
    const elevChip = meta.elevSpan >= 35 ? `<span class="hero-chip">⛰ ${meta.elevSpan}m 落差</span>` : '';

    this.heroQuickChipsEl.innerHTML = `
      <span class="hero-chip accent">${lenLabel}</span>
      <span class="hero-chip">倾角 ${tr.maxBankDeg}°</span>
      ${elevChip}
      ${hyperChip}
    `;

    this.trackInfoEl.innerHTML = `
      <div class="track-desc-clamp">${tr.description}</div>
      <div class="track-meta-pills">
        <span class="meta-pill">单圈 ${lenLabel}</span>
        <span class="meta-pill">${lapWord}</span>
        <span class="meta-pill">${tr.boostPads.length} 加速带</span>
        <span class="meta-pill">${tr.jumpRamps.length} 飞跃跳台</span>
        <span class="meta-pill">最大倾角 ${tr.maxBankDeg}°</span>
      </div>
    `;
  }

  private renderSidebarCategoryTabs(): void {
    const defs: { id: TrackCategory; label: string }[] = [
      { id: 'all', label: '全部' },
      { id: 'classic', label: '经典' },
      { id: 'drift', label: '漂移' },
      { id: 'mega', label: '超长' },
      { id: 'fav', label: '★收藏' },
    ];
    this.sidebarCatTabsEl.innerHTML = '';
    for (const d of defs) {
      const count = this.trackMetas.filter((m) => this.matchesCategory(m, d.id)).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.className = `cat-chip ${this.sidebarCategory === d.id ? 'active' : ''}`;
      btn.setAttribute('aria-selected', String(this.sidebarCategory === d.id));
      btn.innerHTML = `${d.label}<span class="cat-num">${count}</span>`;
      btn.addEventListener('click', () => {
        this.sidebarCategory = d.id;
        this.renderSidebarCategoryTabs();
        this.renderSidebarList(false);
      });
      this.sidebarCatTabsEl.appendChild(btn);
    }
  }

  private renderSidebarList(scrollSelected: boolean): void {
    this.trackListEl.innerHTML = '';
    const filtered = this.trackMetas.filter((m) => this.matchesCategory(m, this.sidebarCategory));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'track-list-empty';
      empty.innerHTML = `
        <span>${this.sidebarCategory === 'fav' ? '还没有收藏赛道，点 ☆ 即可收藏' : '该分类暂无赛道'}</span>
        <button type="button" class="empty-reset-btn">查看全部</button>
      `;
      empty.querySelector('button')!.addEventListener('click', () => {
        this.sidebarCategory = 'all';
        this.renderSidebarCategoryTabs();
        this.renderSidebarList(false);
      });
      this.trackListEl.appendChild(empty);
      return;
    }

    let selectedBtn: HTMLButtonElement | null = null;

    for (const meta of filtered) {
      const t = meta.config;
      const isSelected = meta.index === this.selectedTrack;
      const isFav = this.favorites.has(t.id);
      const diffClass = this.diffClassFor(t.difficulty);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `select-card track-card compact-row ${isSelected ? 'selected' : ''}`;
      btn.dataset.trackId = t.id;
      btn.innerHTML = `
        <div class="track-row-inner">
          <svg class="track-svg compact-svg" viewBox="0 0 100 80">
            <path d="${meta.svgPath}" fill="none" stroke="${t.accentColorHex}" stroke-width="4.5" stroke-linejoin="round" />
          </svg>
          <div class="track-row-text">
            <div class="track-row-top">
              <span class="card-name">${t.nameZh}</span>
              <span class="card-badge ${diffClass}">${t.difficulty}</span>
            </div>
            <div class="track-row-meta">
              <span>${this.formatLen(meta.lengthMeters)}</span>
              <span>·</span>
              <span>倾角 ${t.maxBankDeg}°</span>
              ${meta.hyperZoneCount > 0 ? '<span>· ⚡长直道</span>' : ''}
            </div>
          </div>
          <span class="row-fav-star ${isFav ? 'active' : ''}" role="button" tabindex="-1" title="收藏/取消收藏">${isFav ? '★' : '☆'}</span>
        </div>
      `;

      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.row-fav-star')) {
          e.stopPropagation();
          this.toggleFavorite(t.id);
          return;
        }
        this.selectTrackByIndex(meta.index, false);
      });

      this.trackListEl.appendChild(btn);
      if (isSelected) selectedBtn = btn;
    }

    if (scrollSelected && selectedBtn) {
      selectedBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private renderCatalogTabs(): void {
    const defs: { id: TrackCategory; label: string }[] = [
      { id: 'all', label: '🌐 全部赛道' },
      { id: 'classic', label: '🏙️ 经典短程' },
      { id: 'drift', label: '🔥 漂移圣地' },
      { id: 'mega', label: '🏔️ 超长史诗' },
      { id: 'fav', label: '★ 我的收藏' },
    ];
    this.catalogCatTabsEl.innerHTML = '';
    for (const d of defs) {
      const count = this.trackMetas.filter((m) => this.matchesCategory(m, d.id)).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.className = `catalog-tab ${this.catalogCategory === d.id ? 'active' : ''}`;
      btn.setAttribute('aria-selected', String(this.catalogCategory === d.id));
      btn.innerHTML = `<span>${d.label}</span><span class="catalog-tab-count">${count}</span>`;
      btn.addEventListener('click', () => {
        this.catalogCategory = d.id;
        this.renderCatalogTabs();
        this.renderCatalogGrid();
      });
      this.catalogCatTabsEl.appendChild(btn);
    }
  }

  private renderCatalogGrid(): void {
    const q = this.catalogQuery;
    let list = this.trackMetas.filter((m) => {
      if (!this.matchesCategory(m, this.catalogCategory)) return false;
      if (!q) return true;
      const c = m.config;
      const hay = `${c.nameZh} ${c.name} ${c.description} ${c.difficulty} ${this.formatLen(m.lengthMeters)} ${c.maxBankDeg}`.toLowerCase();
      return hay.includes(q);
    });

    if (this.catalogSort === 'len-asc') {
      list = [...list].sort((a, b) => a.lengthMeters - b.lengthMeters);
    } else if (this.catalogSort === 'len-desc') {
      list = [...list].sort((a, b) => b.lengthMeters - a.lengthMeters);
    } else if (this.catalogSort === 'bank-desc') {
      list = [...list].sort((a, b) => b.config.maxBankDeg - a.config.maxBankDeg || b.lengthMeters - a.lengthMeters);
    }

    this.catalogMatchBadgeEl.textContent = `${list.length} / ${this.trackMetas.length}`;
    this.catalogGridEl.innerHTML = '';

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'catalog-empty';
      empty.innerHTML = `
        <div class="catalog-empty-title">未找到匹配的赛道</div>
        <div class="catalog-empty-sub">${this.catalogCategory === 'fav' ? '点击任意赛道卡片右上角的 ☆ 即可加入收藏' : '尝试更换搜索关键词或切换分类标签'}</div>
        <button type="button" class="cyber-btn">重置筛选条件</button>
      `;
      empty.querySelector('button')!.addEventListener('click', () => {
        this.catalogCategory = 'all';
        this.catalogQuery = '';
        this.catalogSort = 'default';
        this.catalogSearchInput.value = '';
        this.catalogSortSelect.value = 'default';
        this.renderCatalogTabs();
        this.renderCatalogGrid();
      });
      this.catalogGridEl.appendChild(empty);
      return;
    }

    for (const meta of list) {
      const t = meta.config;
      const isSelected = meta.index === this.selectedTrack;
      const isFav = this.favorites.has(t.id);
      const diffClass = this.diffClassFor(t.difficulty);

      const card = document.createElement('div');
      card.className = `catalog-card ${isSelected ? 'selected' : ''}`;
      card.dataset.trackId = t.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.style.setProperty('--track-accent', t.accentColorHex);
      card.innerHTML = `
        <div class="catalog-card-blueprint">
          <div class="catalog-bp-bar">
            <div class="catalog-card-top-badges">
              <span class="card-badge ${diffClass}">${t.difficulty}</span>
              ${isSelected ? '<span class="catalog-selected-tag">已选中</span>' : ''}
            </div>
            <button type="button" class="catalog-fav-btn ${isFav ? 'active' : ''}" aria-label="收藏赛道" title="收藏/取消收藏">${isFav ? '★' : '☆'}</button>
          </div>
          <div class="catalog-bp-stage">
            <svg class="catalog-card-svg" viewBox="0 0 100 80">
              <path d="${meta.svgPath}" fill="none" stroke="${t.accentColorHex}" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
          </div>
        </div>
        <div class="catalog-card-body">
          <div class="catalog-card-title">${t.nameZh}</div>
          <div class="catalog-card-sub">${t.name}</div>
          <div class="catalog-card-desc">${t.description}</div>
          <div class="catalog-card-chips">
            <span class="meta-pill">📏 ${this.formatLen(meta.lengthMeters)}</span>
            <span class="meta-pill">📐 ${t.maxBankDeg}°</span>
            ${meta.elevSpan >= 35 ? `<span class="meta-pill">⛰ ${meta.elevSpan}m</span>` : ''}
            ${t.jumpRamps.length > 0 ? `<span class="meta-pill">🛫 ${t.jumpRamps.length} 跳台</span>` : ''}
            ${meta.hyperZoneCount > 0 ? `<span class="meta-pill hyper">⚡ ${meta.hyperZoneCount} 长直道</span>` : ''}
          </div>
        </div>
      `;

      const favBtn = card.querySelector<HTMLButtonElement>('.catalog-fav-btn')!;
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(t.id);
      });

      const activate = () => {
        // Keep sidebar category synced so user can see their chosen track immediately
        if (!this.matchesCategory(meta, this.sidebarCategory)) {
          this.sidebarCategory = 'all';
        }
        this.selectTrackByIndex(meta.index, true);
        this.closeCatalog();
      };

      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          activate();
        }
      });

      this.catalogGridEl.appendChild(card);
    }
  }

  private syncLapButtons(): void {
    this.lapButtons.forEach((btn) => {
      const laps = Number(btn.dataset.laps);
      btn.classList.toggle('active', laps === this.selectedLaps);
    });
  }

  private updateSelectionReadout(): void {
    const car = CAR_SPECS[this.selectedCar];
    const meta = this.trackMetas[this.selectedTrack];
    const track = meta.config;
    const rawLen = meta.lengthMeters;
    const totalKm = ((rawLen * this.selectedLaps) / 1000).toFixed(1);
    const lapWord = this.selectedLaps === 1 ? '1 LAP' : `${this.selectedLaps} LAPS`;
    this.showcaseCarName.textContent = `${car.name} ${car.subtitle}`;
    this.showcaseTrackName.textContent = `${track.nameZh} // ${track.name}`;
    this.launchSubEl.textContent =
      track.id === 'isle-of-man'
        ? `${lapWord} · 总长 ${totalKm}KM · ISLE OF MAN TT`
        : track.id === 'super-akina'
          ? `${lapWord} · 总长 ${totalKm}KM · SUPER AKINA TOUGE`
          : track.id === 'aurora-fjord'
            ? `${lapWord} · 总长 ${totalKm}KM · AURORA FJORD`
            : track.id === 'nujiang-72'
              ? `${lapWord} · 总长 ${totalKm}KM · NUJIANG 72 BENDS`
              : rawLen >= 10000
                ? `${lapWord} · 总长 ${totalKm}KM · GRAND ISLAND`
                : `${lapWord} · 6 RACERS · DRIFT TO BOOST`;
  }
}
