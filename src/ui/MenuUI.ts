import { CAR_SPECS } from '../config/cars';
import { TRACK_CONFIGS } from '../config/tracks';
import { i18n, t } from '../i18n/i18n';
import { recordsManager, trophyIcon } from '../records/RecordsManager';
import { AIDifficulty, settingsManager } from '../settings/SettingsManager';
import { TrackConfig } from '../types';
import { TrackSpline } from '../track/TrackSpline';
import { formatTime } from '../utils/math';

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
  onOpenSettings: () => void;
  onToggleLang: () => void;
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
  private readonly langBtn = document.getElementById('btn-menu-lang')!;
  private readonly settingsBtn = document.getElementById('btn-menu-settings')!;
  private readonly fullscreenBtn = document.getElementById('btn-menu-fullscreen')!;
  private readonly audioBtn = document.getElementById('btn-menu-audio')!;
  private readonly touchBtn = document.getElementById('btn-menu-touch')!;
  private readonly driftNitroBtn = document.getElementById('btn-menu-drift-nitro')!;
  private readonly driftNitroStateEl = document.getElementById('drift-nitro-state')!;
  private readonly overdriveBtn = document.getElementById('btn-menu-overdrive')!;
  private readonly overdriveStateEl = document.getElementById('overdrive-state')!;
  private readonly hyperNitroBtn = document.getElementById('btn-menu-hyper-nitro')!;
  private readonly hyperNitroStateEl = document.getElementById('hyper-nitro-state')!;
  private readonly modsTriggerBtn = document.getElementById('btn-menu-mods');
  private readonly modsPopover = document.getElementById('race-mods-popover');
  private readonly modsCloseBtn = document.getElementById('btn-close-mods');
  private readonly modsCountEl = document.getElementById('mods-active-count');
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
  private readonly aiButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#ai-diff-selector .ai-opt-btn')
  );

  // Compact Active Circuit Hub & Scalable Catalog Modal elements
  private readonly openCatalogBtn = document.getElementById('btn-open-catalog')!;
  private readonly trackTotalCountEl = document.getElementById('track-total-count')!;
  private readonly trackTrophyPillEl = document.getElementById('track-trophy-pill');
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
  private carCardButtons: HTMLButtonElement[] = [];
  private specDescEl: HTMLParagraphElement | null = null;
  private specStatFills: HTMLElement[] = [];
  private specStatVals: HTMLElement[] = [];
  private specStatLabels: HTMLElement[] = [];

  private currentMuted = false;
  private currentTouch = false;
  private currentFullscreen = false;
  private currentDriftNitro = false;
  private currentOverdrive = false;
  private currentHyperNitro = false;

  constructor(private readonly callbacks: MenuCallbacks) {
    this.loadFavorites();

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

    this.renderAllLocalized();

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

    // AI Difficulty quick selection (synced two-way with SettingsManager!)
    this.aiButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.ai as AIDifficulty;
        if (diff === 'rookie' || diff === 'pro' || diff === 'apex') {
          settingsManager.updateControls({ aiDifficulty: diff });
        }
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

    // Header actions & race switches
    this.langBtn.addEventListener('click', () => this.callbacks.onToggleLang());
    this.settingsBtn.addEventListener('click', () => this.callbacks.onOpenSettings());
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
    this.modsTriggerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleModsPopover();
    });
    this.modsCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setModsPopoverOpen(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.modsPopover || this.modsPopover.classList.contains('hidden')) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (this.modsPopover.contains(target) || this.modsTriggerBtn?.contains(target)) return;
      this.setModsPopoverOpen(false);
    });
    this.controlsBtn.addEventListener('click', () => {
      this.setModsPopoverOpen(false);
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

    // React seamlessly whenever language, records, or AI difficulty change!
    i18n.subscribe(() => {
      this.renderAllLocalized();
    });
    recordsManager.subscribe(() => {
      this.renderTrackHub();
      if (!this.catalogModal.classList.contains('hidden')) {
        this.renderCatalogGrid();
      }
    });
    settingsManager.subscribe((_, section) => {
      if (section === 'controls' || section === 'all') {
        this.syncAiButtons();
        this.updateSelectionReadout();
      }
    });
  }

  public selectTrackExternal(idx: number): void {
    if (idx < 0 || idx >= TRACK_CONFIGS.length) return;
    this.selectedTrack = idx;
    this.selectedLaps = TRACK_CONFIGS[idx].laps;
    this.syncLapButtons();
    this.renderTrackHub(true);
    this.updateSelectionReadout();
  }

  public closeOpenModal(): boolean {
    if (this.modsPopover && !this.modsPopover.classList.contains('hidden')) {
      this.setModsPopoverOpen(false);
      return true;
    }
    if (!this.catalogModal.classList.contains('hidden')) {
      this.closeCatalog();
      return true;
    }
    if (!this.controlsModal.classList.contains('hidden')) {
      this.controlsModal.classList.add('hidden');
      return true;
    }
    return false;
  }

  private setModsPopoverOpen(open: boolean): void {
    if (!this.modsPopover || !this.modsTriggerBtn) return;
    this.modsPopover.classList.toggle('hidden', !open);
    this.modsTriggerBtn.classList.toggle('open', open);
    this.modsTriggerBtn.setAttribute('aria-expanded', String(open));
  }

  private toggleModsPopover(): void {
    if (!this.modsPopover) return;
    const isHidden = this.modsPopover.classList.contains('hidden');
    this.setModsPopoverOpen(isHidden);
  }

  private syncModsTriggerBadge(): void {
    const activeCount =
      (this.currentDriftNitro ? 1 : 0) +
      (this.currentOverdrive ? 1 : 0) +
      (this.currentHyperNitro ? 1 : 0);
    if (this.modsTriggerBtn) {
      this.modsTriggerBtn.classList.toggle('has-active', activeCount > 0);
    }
    if (this.modsCountEl) {
      this.modsCountEl.textContent = String(activeCount);
      this.modsCountEl.classList.toggle('hidden', activeCount === 0);
    }
  }

  private renderAllLocalized(): void {
    this.renderCars();
    this.renderTrackHub();
    this.syncLapButtons();
    this.syncAiButtons();
    this.updateSelectionReadout();
    this.setMuted(this.currentMuted);
    this.setTouchEnabled(this.currentTouch);
    this.setFullscreen(this.currentFullscreen);
    this.setDriftNitroEnabled(this.currentDriftNitro);
    this.setOverdriveEnabled(this.currentOverdrive);
    this.setHyperNitroEnabled(this.currentHyperNitro);
    if (!this.catalogModal.classList.contains('hidden')) {
      this.renderCatalogTabs();
      this.renderCatalogGrid();
    }
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
      // Ignore storage errors
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(this.favorites)));
    } catch {
      // Ignore storage errors
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
      this.setModsPopoverOpen(false);
      this.controlsModal.classList.add('hidden');
      this.catalogModal.classList.add('hidden');
    }
  }

  public setMuted(muted: boolean): void {
    this.currentMuted = muted;
    const icon = this.audioBtn.querySelector('.icon')!;
    const label = this.audioBtn.querySelector('.label')!;
    icon.textContent = muted ? '🔇' : '🔊';
    label.textContent = muted ? t('btnAudioOff') : t('btnAudioOn');
  }

  public setTouchEnabled(enabled: boolean): void {
    this.currentTouch = enabled;
    const label = this.touchBtn.querySelector('.label')!;
    label.textContent = enabled ? t('btnTouchOn') : t('btnTouchOff');
    this.touchBtn.style.borderColor = enabled ? '#00ff9d' : '';
  }

  public setFullscreen(active: boolean): void {
    this.currentFullscreen = active;
    const icon = this.fullscreenBtn.querySelector('.icon')!;
    const label = this.fullscreenBtn.querySelector('.label')!;
    icon.innerHTML = active
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    label.textContent = active ? t('btnExitFullscreen') : t('btnFullscreen');
    this.fullscreenBtn.style.borderColor = active ? '#00f2ff' : '';
  }

  public setDriftNitroEnabled(enabled: boolean): void {
    this.currentDriftNitro = enabled;
    this.driftNitroBtn.classList.toggle('active', enabled);
    this.driftNitroBtn.setAttribute('aria-checked', String(enabled));
    this.driftNitroStateEl.textContent = enabled ? t('stateOn') : t('stateOff');
    this.syncModsTriggerBadge();
  }

  public setOverdriveEnabled(enabled: boolean): void {
    this.currentOverdrive = enabled;
    this.overdriveBtn.classList.toggle('active', enabled);
    this.overdriveBtn.setAttribute('aria-checked', String(enabled));
    this.overdriveStateEl.textContent = enabled ? t('stateOn') : t('stateOff');
    this.syncModsTriggerBadge();
  }

  public setHyperNitroEnabled(enabled: boolean): void {
    this.currentHyperNitro = enabled;
    this.hyperNitroBtn.classList.toggle('active', enabled);
    this.hyperNitroBtn.setAttribute('aria-checked', String(enabled));
    this.hyperNitroStateEl.textContent = enabled ? t('stateOn') : t('stateOff');
    this.syncModsTriggerBadge();
  }

  private selectCarByIndex(idx: number): void {
    if (idx < 0 || idx >= CAR_SPECS.length) return;
    if (this.selectedCar === idx) return;
    this.selectedCar = idx;
    this.syncCarSelectionUI();
    this.updateSelectionReadout();
    this.callbacks.onSelectCar(idx);
  }

  private renderCars(): void {
    // Build persistent DOM nodes once so tapping a car NEVER destroys the active button mid-gesture!
    if (this.carCardButtons.length !== CAR_SPECS.length) {
      this.carListEl.innerHTML = '';
      this.carCardButtons = [];

      CAR_SPECS.forEach((car, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'select-card car-select-card';
        btn.dataset.carIdx = String(idx);
        const paintHex = `#${car.primaryColor.toString(16).padStart(6, '0')}`;
        const isSClass = car.bodyStyle === 'valkyrie' || car.bodyStyle === 'eclipse';
        btn.style.setProperty('--car-accent', paintHex);
        btn.innerHTML = `
          <div class="card-top">
            <div class="card-title-row">
              <span class="color-swatch" style="background:${paintHex};color:${paintHex}"></span>
              <span class="card-name">${car.name}</span>
            </div>
            <span class="card-badge ${isSClass ? 's-class' : ''}"></span>
          </div>
          <div class="card-sub"></div>
        `;

        // Bulletproof touch/pointer tap handler: tolerates 18px mobile thumb jitter without scroll-cancel!
        let downX = 0;
        let downY = 0;
        let activePointerId = -1;
        let lastPointerSelectAt = 0;

        btn.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          activePointerId = e.pointerId;
          downX = e.clientX;
          downY = e.clientY;
        });

        btn.addEventListener('pointerup', (e) => {
          if (e.pointerId !== activePointerId) return;
          activePointerId = -1;
          const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
          if (dist <= 20) {
            lastPointerSelectAt = performance.now();
            this.selectCarByIndex(idx);
          }
        });

        btn.addEventListener('pointercancel', () => {
          activePointerId = -1;
        });

        btn.addEventListener('click', () => {
          if (performance.now() - lastPointerSelectAt < 380) return;
          this.selectCarByIndex(idx);
        });

        this.carListEl.appendChild(btn);
        this.carCardButtons.push(btn);
      });
    }

    // Update localized car labels in-place without recreating DOM nodes
    CAR_SPECS.forEach((car, idx) => {
      const btn = this.carCardButtons[idx];
      if (!btn) return;
      const badgeEl = btn.querySelector('.card-badge');
      const subEl = btn.querySelector('.card-sub');
      if (badgeEl) badgeEl.textContent = i18n.getCarArchetype(car);
      if (subEl) subEl.textContent = i18n.getCarSubtitle(car);
    });

    // Build persistent stat bar elements once so CSS width transitions animate smoothly!
    if (this.specStatFills.length !== 4) {
      this.carSpecsEl.innerHTML = `
        <p class="spec-desc"></p>
        ${this.statBarHtml(t('statSpeed'), 0)}
        ${this.statBarHtml(t('statAccel'), 0)}
        ${this.statBarHtml(t('statDrift'), 0)}
        ${this.statBarHtml(t('statNitro'), 0)}
      `;
      this.specDescEl = this.carSpecsEl.querySelector<HTMLParagraphElement>('.spec-desc');
      this.specStatLabels = Array.from(this.carSpecsEl.querySelectorAll<HTMLElement>('.stat-label'));
      this.specStatFills = Array.from(this.carSpecsEl.querySelectorAll<HTMLElement>('.stat-fill'));
      this.specStatVals = Array.from(this.carSpecsEl.querySelectorAll<HTMLElement>('.stat-val'));
    } else {
      const labels = [t('statSpeed'), t('statAccel'), t('statDrift'), t('statNitro')];
      this.specStatLabels.forEach((el, i) => {
        el.textContent = labels[i];
      });
    }

    this.syncCarSelectionUI();
  }

  private syncCarSelectionUI(): void {
    this.carCardButtons.forEach((btn, idx) => {
      const isSelected = idx === this.selectedCar;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });

    const c = CAR_SPECS[this.selectedCar];
    if (this.specDescEl) {
      this.specDescEl.textContent = i18n.getCarDesc(c);
    }
    const vals = [c.stats.speed, c.stats.accel, c.stats.drift, c.stats.nitro];
    vals.forEach((val, i) => {
      if (this.specStatFills[i]) this.specStatFills[i].style.width = `${val}%`;
      if (this.specStatVals[i]) this.specStatVals[i].textContent = String(val);
    });
  }

  private statBarHtml(label: string, val: number): string {
    return `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        <div class="stat-track"><div class="stat-fill" style="width:${val}%"></div></div>
        <span class="stat-val mono" style="color:#fff;text-align:right">${val}</span>
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

    this.heroNameEl.textContent = i18n.getTrackName(tr);
    this.heroBadgeEl.textContent = i18n.getDifficultyLabel(tr.difficulty);
    this.heroBadgeEl.className = `card-badge ${diffClass}`;
    this.heroSubEl.textContent = i18n.getTrackSub(tr);
    this.heroFavBtn.textContent = isFav ? '★' : '☆';
    this.heroFavBtn.classList.toggle('active', isFav);

    this.heroSvgEl.innerHTML = `<path d="${meta.svgPath}" fill="none" stroke="${tr.accentColorHex}" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round" />`;
    this.heroSvgEl.style.filter = `drop-shadow(0 0 8px ${tr.accentColorHex}88)`;

    const rec = recordsManager.getTrackRecord(tr.id);
    const medal = trophyIcon(recordsManager.getTrophy(tr.id));
    const stats = recordsManager.getTrophyStats(TRACK_CONFIGS.map((c) => c.id));
    if (this.trackTrophyPillEl) {
      this.trackTrophyPillEl.textContent = t('pbTrophyCount', { gold: stats.gold, total: stats.total });
      this.trackTrophyPillEl.classList.toggle('has-gold', stats.gold > 0);
    }

    const lenLabel = this.formatLen(meta.lengthMeters);
    const lapWord = i18n.formatLapPill(this.selectedLaps);
    const hyperChip =
      meta.hyperZoneCount > 0
        ? `<span class="hero-chip hyper">⚡ ${t('hyperShort', { n: meta.hyperZoneCount })}</span>`
        : '';
    const elevChip =
      meta.elevSpan >= 35 ? `<span class="hero-chip">⛰ ${t('elevShort', { m: meta.elevSpan })}</span>` : '';
    const pbChip =
      rec && rec.bestLapTime !== null
        ? `<span class="hero-chip pb">${medal ? `${medal} ` : '⏱ '}${t('pbBestLap', { time: formatTime(rec.bestLapTime) })}</span>`
        : medal
          ? `<span class="hero-chip pb">${medal} #${rec?.bestRank}</span>`
          : '';

    this.heroQuickChipsEl.innerHTML = `
      <span class="hero-chip accent">${lenLabel}</span>
      <span class="hero-chip">${t('bankShort', { deg: tr.maxBankDeg })}</span>
      ${pbChip}
      ${elevChip}
      ${hyperChip}
    `;

    this.trackInfoEl.innerHTML = `
      <div class="track-desc-clamp">${i18n.getTrackDesc(tr)}</div>
      <div class="track-meta-pills">
        <span class="meta-pill">${t('singleLapLen', { len: lenLabel })}</span>
        <span class="meta-pill">${lapWord}</span>
        <span class="meta-pill">${t('boostPadsCount', { n: tr.boostPads.length })}</span>
        <span class="meta-pill">${t('jumpRampsCount', { n: tr.jumpRamps.length })}</span>
        <span class="meta-pill">${t('maxBankLabel', { deg: tr.maxBankDeg })}</span>
      </div>
    `;
  }

  private renderSidebarCategoryTabs(): void {
    const defs: { id: TrackCategory; label: string }[] = [
      { id: 'all', label: t('catAll') },
      { id: 'classic', label: t('catClassic') },
      { id: 'drift', label: t('catDrift') },
      { id: 'mega', label: t('catMega') },
      { id: 'fav', label: t('catFav') },
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
        <span>${this.sidebarCategory === 'fav' ? t('listEmptyFav') : t('listEmptyOther')}</span>
        <button type="button" class="empty-reset-btn">${t('btnViewAll')}</button>
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
      const tCfg = meta.config;
      const isSelected = meta.index === this.selectedTrack;
      const isFav = this.favorites.has(tCfg.id);
      const diffClass = this.diffClassFor(tCfg.difficulty);
      const rowMedal = trophyIcon(recordsManager.getTrophy(tCfg.id));
      const rowRec = recordsManager.getTrackRecord(tCfg.id);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `select-card track-card compact-row ${isSelected ? 'selected' : ''}`;
      btn.dataset.trackId = tCfg.id;
      btn.innerHTML = `
        <div class="track-row-inner">
          <svg class="track-svg compact-svg" viewBox="0 0 100 80">
            <path d="${meta.svgPath}" fill="none" stroke="${tCfg.accentColorHex}" stroke-width="4.5" stroke-linejoin="round" />
          </svg>
          <div class="track-row-text">
            <div class="track-row-top">
              <span class="card-name">${rowMedal ? `${rowMedal} ` : ''}${i18n.getTrackName(tCfg)}</span>
              <span class="card-badge ${diffClass}">${i18n.getDifficultyLabel(tCfg.difficulty)}</span>
            </div>
            <div class="track-row-meta">
              <span class="meta-dist">${this.formatLen(meta.lengthMeters)}</span>
              <span class="meta-sep">·</span>
              <span class="meta-bank">${tCfg.maxBankDeg}°</span>
              ${rowRec?.bestLapTime ? `<span class="track-row-pb mono">⏱ ${formatTime(rowRec.bestLapTime)}</span>` : meta.hyperZoneCount > 0 ? `<span class="meta-hyper">${t('hyperRowTag')}</span>` : ''}
            </div>
          </div>
          <span class="row-fav-star ${isFav ? 'active' : ''}" role="button" tabindex="-1" title="${t('btnFavTrack')}">${isFav ? '★' : '☆'}</span>
        </div>
      `;

      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.row-fav-star')) {
          e.stopPropagation();
          this.toggleFavorite(tCfg.id);
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
      { id: 'all', label: t('catAllFull') },
      { id: 'classic', label: t('catClassicFull') },
      { id: 'drift', label: t('catDriftFull') },
      { id: 'mega', label: t('catMegaFull') },
      { id: 'fav', label: t('catFavFull') },
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
      const hay = `${c.nameZh} ${c.name} ${c.description} ${i18n.getTrackName(c)} ${i18n.getTrackDesc(c)} ${c.difficulty} ${i18n.getDifficultyLabel(c.difficulty)} ${this.formatLen(m.lengthMeters)} ${c.maxBankDeg}`.toLowerCase();
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
        <div class="catalog-empty-title">${t('catalogEmptyTitle')}</div>
        <div class="catalog-empty-sub">${this.catalogCategory === 'fav' ? t('catalogEmptyFavSub') : t('catalogEmptySearchSub')}</div>
        <button type="button" class="cyber-btn">${t('catalogResetBtn')}</button>
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
      const tr = meta.config;
      const isSelected = meta.index === this.selectedTrack;
      const isFav = this.favorites.has(tr.id);
      const diffClass = this.diffClassFor(tr.difficulty);
      const cardMedal = trophyIcon(recordsManager.getTrophy(tr.id));
      const cardRec = recordsManager.getTrackRecord(tr.id);

      const card = document.createElement('div');
      card.className = `catalog-card ${isSelected ? 'selected' : ''}`;
      card.dataset.trackId = tr.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.style.setProperty('--track-accent', tr.accentColorHex);
      card.innerHTML = `
        <div class="catalog-card-blueprint">
          <div class="catalog-bp-bar">
            <div class="catalog-card-top-badges">
              <span class="card-badge ${diffClass}">${i18n.getDifficultyLabel(tr.difficulty)}</span>
              ${cardMedal ? `<span class="catalog-trophy-tag">${cardMedal}</span>` : ''}
              ${isSelected ? `<span class="catalog-selected-tag">${t('catalogSelected')}</span>` : ''}
            </div>
            <button type="button" class="catalog-fav-btn ${isFav ? 'active' : ''}" aria-label="${t('btnFavTrack')}" title="${t('btnFavTrack')}">${isFav ? '★' : '☆'}</button>
          </div>
          <div class="catalog-bp-stage">
            <svg class="catalog-card-svg" viewBox="0 0 100 80">
              <path d="${meta.svgPath}" fill="none" stroke="${tr.accentColorHex}" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
          </div>
        </div>
        <div class="catalog-card-body">
          <div class="catalog-card-title">${i18n.getTrackName(tr)}</div>
          <div class="catalog-card-sub">${i18n.getTrackSub(tr)}</div>
          <div class="catalog-card-desc">${i18n.getTrackDesc(tr)}</div>
          <div class="catalog-card-chips">
            <span class="meta-pill">📏 ${this.formatLen(meta.lengthMeters)}</span>
            <span class="meta-pill">📐 ${tr.maxBankDeg}°</span>
            ${cardRec?.bestLapTime ? `<span class="meta-pill pb">⏱ ${formatTime(cardRec.bestLapTime)}</span>` : ''}
            ${meta.elevSpan >= 35 ? `<span class="meta-pill">⛰ ${meta.elevSpan}m</span>` : ''}
            ${tr.jumpRamps.length > 0 ? `<span class="meta-pill">🛫 ${t('catalogJumpChip', { n: tr.jumpRamps.length })}</span>` : ''}
            ${meta.hyperZoneCount > 0 ? `<span class="meta-pill hyper">⚡ ${t('catalogHyperChip', { n: meta.hyperZoneCount })}</span>` : ''}
          </div>
        </div>
      `;

      const favBtn = card.querySelector<HTMLButtonElement>('.catalog-fav-btn')!;
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(tr.id);
      });

      const activate = () => {
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
      btn.textContent = i18n.formatLapShort(laps);
      btn.classList.toggle('active', laps === this.selectedLaps);
    });
  }

  private syncAiButtons(): void {
    const cur = settingsManager.settings.controls.aiDifficulty ?? 'pro';
    this.aiButtons.forEach((btn) => {
      const val = btn.dataset.ai as AIDifficulty;
      btn.textContent = val === 'rookie' ? t('aiRookie') : val === 'apex' ? t('aiApex') : t('aiPro');
      btn.classList.toggle('active', val === cur);
    });
  }

  private updateSelectionReadout(): void {
    const car = CAR_SPECS[this.selectedCar];
    const meta = this.trackMetas[this.selectedTrack];
    const track = meta.config;
    const rawLen = meta.lengthMeters;
    const totalKm = ((rawLen * this.selectedLaps) / 1000).toFixed(1);
    const trackTitle = i18n.getTrackName(track);

    const aiDiff = settingsManager.settings.controls.aiDifficulty ?? 'pro';
    const aiLabel = aiDiff === 'rookie' ? t('aiRookie') : aiDiff === 'apex' ? t('aiApex') : t('aiPro');

    this.showcaseCarName.textContent = `${car.name} · ${i18n.getCarArchetype(car)}`;
    this.showcaseTrackName.textContent = trackTitle;

    if (rawLen >= 7000) {
      this.launchSubEl.textContent = `${t('launchSubMega', {
        laps: this.selectedLaps,
        km: totalKm,
        tag: trackTitle,
      })} · AI ${aiLabel}`;
    } else {
      this.launchSubEl.textContent = `${t('launchSubStandard', {
        laps: this.selectedLaps,
      })} · AI ${aiLabel}`;
    }
  }
}
