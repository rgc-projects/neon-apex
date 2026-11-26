import { i18n, Language, t } from '../i18n/i18n';
import {
  AntiAliasingMode,
  BloomMode,
  DrawDistanceMode,
  FpsCap,
  ParticleQuality,
  QualityPreset,
  settingsManager,
  SteerMode,
} from '../settings/SettingsManager';
import { CameraMode } from '../types';

export type SettingsTab = 'graphics' | 'controls' | 'audio' | 'language';

export interface SettingsUICallbacks {
  onTouchEnabledChange: (enabled: boolean) => void;
  getTouchEnabled: () => boolean;
  onMuteToggle: (muted: boolean) => void;
  getMuted: () => boolean;
  onNotify?: (msg: string) => void;
  onAnyInteract?: () => void;
}

export class SettingsUI {
  private readonly modal = document.getElementById('settings-modal')!;
  private readonly closeBtn = document.getElementById('btn-close-settings')!;
  private readonly doneBtn = document.getElementById('btn-settings-done')!;
  private readonly resetBtn = document.getElementById('btn-settings-reset')!;
  private readonly tabButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#settings-tabs .settings-tab-btn')
  );
  private readonly bodyEl = document.getElementById('settings-body')!;
  private activeTab: SettingsTab = 'graphics';

  constructor(private readonly callbacks: SettingsUICallbacks) {
    this.closeBtn.addEventListener('click', () => this.close());
    this.doneBtn.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.resetBtn.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      settingsManager.resetAll();
      this.renderActiveTab();
      this.callbacks.onNotify?.(t('msgSettingsReset'));
    });

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onAnyInteract?.();
        const tab = (btn.dataset.tab as SettingsTab) || 'graphics';
        this.activeTab = tab;
        this.syncTabs();
        this.renderActiveTab();
      });
    });

    i18n.subscribe(() => {
      if (this.isOpen()) {
        this.renderActiveTab();
      }
    });

    settingsManager.subscribe(() => {
      if (this.isOpen()) {
        this.renderActiveTab();
      }
    });
  }

  public isOpen(): boolean {
    return !this.modal.classList.contains('hidden');
  }

  public open(tab?: SettingsTab): void {
    if (tab) this.activeTab = tab;
    this.syncTabs();
    this.renderActiveTab();
    this.modal.classList.remove('hidden');
  }

  public close(): void {
    this.modal.classList.add('hidden');
  }

  private syncTabs(): void {
    this.tabButtons.forEach((btn) => {
      const isCur = btn.dataset.tab === this.activeTab;
      btn.classList.toggle('active', isCur);
      btn.setAttribute('aria-selected', String(isCur));
    });
  }

  private renderActiveTab(): void {
    if (this.activeTab === 'graphics') {
      this.renderGraphicsTab();
    } else if (this.activeTab === 'controls') {
      this.renderControlsTab();
    } else if (this.activeTab === 'audio') {
      this.renderAudioTab();
    } else {
      this.renderLanguageTab();
    }
  }

  private segGroupHtml<T extends string | number>(
    id: string,
    options: { value: T; label: string }[],
    current: T
  ): string {
    return `<div class="seg-group" data-seg="${id}">
      ${options
        .map(
          (o) =>
            `<button type="button" class="seg-btn ${String(o.value) === String(current) ? 'active' : ''}" data-val="${o.value}">${o.label}</button>`
        )
        .join('')}
    </div>`;
  }

  private switchHtml(id: string, checked: boolean): string {
    return `<button type="button" class="set-switch ${checked ? 'on' : ''}" id="${id}" role="switch" aria-checked="${checked}">
      <span class="set-switch-track"><span class="set-switch-thumb"></span></span>
      <span class="set-switch-text">${checked ? t('stateOn') : t('stateOff')}</span>
    </button>`;
  }

  private bindSeg(id: string, onPick: (val: string) => void): void {
    const group = this.bodyEl.querySelector<HTMLElement>(`[data-seg="${id}"]`);
    if (!group) return;
    group.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onAnyInteract?.();
        onPick(btn.dataset.val ?? '');
      });
    });
  }

  private renderGraphicsTab(): void {
    const g = settingsManager.settings.graphics;
    const hintKey =
      g.qualityPreset === 'low'
        ? 'presetHintLow'
        : g.qualityPreset === 'medium'
          ? 'presetHintMedium'
          : g.qualityPreset === 'high'
            ? 'presetHintHigh'
            : g.qualityPreset === 'ultra'
              ? 'presetHintUltra'
              : 'presetHintCustom';

    this.bodyEl.innerHTML = `
      <div class="set-section">
        <div class="set-preset-head">
          <span class="set-label-strong">${t('secQualityPreset')}</span>
          <button type="button" id="btn-auto-quality" class="set-auto-btn">✨ ${t('presetAutoBtn')}</button>
        </div>
        ${this.segGroupHtml<QualityPreset>(
          'preset',
          [
            { value: 'low', label: t('presetLow') },
            { value: 'medium', label: t('presetMedium') },
            { value: 'high', label: t('presetHigh') },
            { value: 'ultra', label: t('presetUltra') },
          ],
          g.qualityPreset
        )}
        <div class="set-hint-box">${t(hintKey)}</div>
      </div>

      <div class="set-grid">
        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optResScale')}</span>
          </div>
          ${this.segGroupHtml<number>(
            'res',
            [
              { value: 0.75, label: '75%' },
              { value: 0.85, label: '85%' },
              { value: 1.0, label: '100%' },
              { value: 1.25, label: '125%' },
              { value: 1.5, label: '150%' },
            ],
            g.resolutionScale
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optFpsCap')}</span>
          </div>
          ${this.segGroupHtml<FpsCap>(
            'fps',
            [
              { value: 30, label: '30' },
              { value: 60, label: '60' },
              { value: 90, label: '90' },
              { value: 120, label: '120' },
              { value: 0, label: t('fpsUnlimited') },
            ],
            g.fpsCap
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optAA')}</span>
          </div>
          ${this.segGroupHtml<AntiAliasingMode>(
            'aa',
            [
              { value: 'off', label: t('aaOff') },
              { value: 'smaa', label: t('aaSmaa') },
              { value: 'msaa2', label: t('aaMsaa2') },
              { value: 'msaa4_smaa', label: t('aaMsaa4Smaa') },
            ],
            g.antiAliasing
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optBloom')}</span>
          </div>
          ${this.segGroupHtml<BloomMode>(
            'bloom',
            [
              { value: 'off', label: t('levelOff') },
              { value: 'soft', label: t('bloomSoft') },
              { value: 'cinematic', label: t('bloomCinematic') },
            ],
            g.bloom
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optParticles')}</span>
          </div>
          ${this.segGroupHtml<ParticleQuality>(
            'particles',
            [
              { value: 'low', label: t('levelLow') },
              { value: 'medium', label: t('levelMedium') },
              { value: 'high', label: t('levelHigh') },
            ],
            g.particles
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optDrawDist')}</span>
          </div>
          ${this.segGroupHtml<DrawDistanceMode>(
            'draw',
            [
              { value: 'near', label: t('distNear') },
              { value: 'medium', label: t('distMedium') },
              { value: 'far', label: t('distFar') },
            ],
            g.drawDistance
          )}
        </div>

        <div class="set-row set-row-inline">
          <div class="set-row-info">
            <span class="set-row-title">${t('optShowFps')}</span>
            <span class="set-row-desc">${t('optShowFpsDesc')}</span>
          </div>
          ${this.switchHtml('sw-show-fps', g.showFps)}
        </div>
      </div>
    `;

    this.bodyEl.querySelector('#btn-auto-quality')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      const rec = settingsManager.autoDetectGraphics();
      const labelKey =
        rec === 'low' ? 'presetLow' : rec === 'medium' ? 'presetMedium' : rec === 'high' ? 'presetHigh' : 'presetUltra';
      this.callbacks.onNotify?.(t('msgAutoQuality', { preset: t(labelKey) }));
    });

    this.bindSeg('preset', (v) => {
      if (v === 'low' || v === 'medium' || v === 'high' || v === 'ultra') {
        settingsManager.applyQualityPreset(v);
      }
    });
    this.bindSeg('res', (v) => settingsManager.updateGraphics({ resolutionScale: Number(v) }));
    this.bindSeg('fps', (v) => settingsManager.updateGraphics({ fpsCap: Number(v) as FpsCap }));
    this.bindSeg('aa', (v) => settingsManager.updateGraphics({ antiAliasing: v as AntiAliasingMode }));
    this.bindSeg('bloom', (v) => settingsManager.updateGraphics({ bloom: v as BloomMode }));
    this.bindSeg('particles', (v) => settingsManager.updateGraphics({ particles: v as ParticleQuality }));
    this.bindSeg('draw', (v) => settingsManager.updateGraphics({ drawDistance: v as DrawDistanceMode }));

    this.bodyEl.querySelector('#sw-show-fps')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      settingsManager.updateGraphics({ showFps: !settingsManager.settings.graphics.showFps });
    });
  }

  private renderControlsTab(): void {
    const c = settingsManager.settings.controls;
    const touchOn = this.callbacks.getTouchEnabled();

    this.bodyEl.innerHTML = `
      <div class="set-grid">
        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optSteerMode')}</span>
          </div>
          ${this.segGroupHtml<SteerMode>(
            'steerMode',
            [
              { value: 'joystick', label: t('steerJoystick') },
              { value: 'buttons', label: t('steerButtons') },
              { value: 'tilt', label: t('steerTilt') },
            ],
            c.steerMode
          )}
        </div>

        <div class="set-row">
          <div class="set-row-info">
            <span class="set-row-title">${t('optDefaultCam')}</span>
          </div>
          ${this.segGroupHtml<CameraMode>(
            'cam',
            [
              { value: 'CHASE', label: t('camChase') },
              { value: 'HOOD', label: t('camHood') },
            ],
            c.defaultCamera
          )}
        </div>

        <div class="set-row set-row-inline">
          <div class="set-row-info">
            <span class="set-row-title">${t('optAutoThrottle')}</span>
            <span class="set-row-desc">${t('optAutoThrottleDesc')}</span>
          </div>
          ${this.switchHtml('sw-auto-gas', c.autoThrottle)}
        </div>

        <div class="set-row set-row-inline">
          <div class="set-row-info">
            <span class="set-row-title">${t('optTouchForce')}</span>
            <span class="set-row-desc">${t('optTouchForceDesc')}</span>
          </div>
          ${this.switchHtml('sw-touch-force', touchOn)}
        </div>

        <div class="set-row set-row-inline">
          <div class="set-row-info">
            <span class="set-row-title">${t('optHaptics')}</span>
            <span class="set-row-desc">${t('optHapticsDesc')}</span>
          </div>
          ${this.switchHtml('sw-haptics', c.haptics)}
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optSteerSens')}</span>
            <span class="set-slider-val mono" id="val-sens">${Math.round(c.steerSensitivity * 100)}%</span>
          </div>
          <input id="sl-sens" class="set-range" type="range" min="70" max="140" step="5" value="${Math.round(c.steerSensitivity * 100)}" />
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optBtnScale')}</span>
            <span class="set-slider-val mono" id="val-scale">${Math.round(c.buttonScale * 100)}%</span>
          </div>
          <input id="sl-scale" class="set-range" type="range" min="80" max="125" step="5" value="${Math.round(c.buttonScale * 100)}" />
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optBtnOpacity')}</span>
            <span class="set-slider-val mono" id="val-opacity">${Math.round(c.buttonOpacity * 100)}%</span>
          </div>
          <input id="sl-opacity" class="set-range" type="range" min="45" max="100" step="5" value="${Math.round(c.buttonOpacity * 100)}" />
        </div>
      </div>
    `;

    this.bindSeg('steerMode', (v) => settingsManager.updateControls({ steerMode: v as SteerMode }));
    this.bindSeg('cam', (v) => settingsManager.updateControls({ defaultCamera: v as CameraMode }));

    this.bodyEl.querySelector('#sw-auto-gas')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      settingsManager.updateControls({ autoThrottle: !settingsManager.settings.controls.autoThrottle });
    });
    this.bodyEl.querySelector('#sw-touch-force')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      this.callbacks.onTouchEnabledChange(!this.callbacks.getTouchEnabled());
      this.renderControlsTab();
    });
    this.bodyEl.querySelector('#sw-haptics')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      settingsManager.updateControls({ haptics: !settingsManager.settings.controls.haptics });
    });

    const slSens = this.bodyEl.querySelector<HTMLInputElement>('#sl-sens')!;
    slSens.addEventListener('input', () => {
      const val = Number(slSens.value);
      const lbl = this.bodyEl.querySelector('#val-sens');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateControls({ steerSensitivity: val / 100 });
    });

    const slScale = this.bodyEl.querySelector<HTMLInputElement>('#sl-scale')!;
    slScale.addEventListener('input', () => {
      const val = Number(slScale.value);
      const lbl = this.bodyEl.querySelector('#val-scale');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateControls({ buttonScale: val / 100 });
    });

    const slOpacity = this.bodyEl.querySelector<HTMLInputElement>('#sl-opacity')!;
    slOpacity.addEventListener('input', () => {
      const val = Number(slOpacity.value);
      const lbl = this.bodyEl.querySelector('#val-opacity');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateControls({ buttonOpacity: val / 100 });
    });
  }

  private renderAudioTab(): void {
    const a = settingsManager.settings.audio;
    const muted = this.callbacks.getMuted();

    this.bodyEl.innerHTML = `
      <div class="set-grid">
        <div class="set-row set-row-inline">
          <div class="set-row-info">
            <span class="set-row-title">${t('optMuteAll')}</span>
          </div>
          ${this.switchHtml('sw-mute-all', muted)}
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optMasterVol')}</span>
            <span class="set-slider-val mono" id="val-master">${Math.round(a.masterVolume * 100)}%</span>
          </div>
          <input id="sl-master" class="set-range" type="range" min="0" max="100" step="5" value="${Math.round(a.masterVolume * 100)}" />
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optSfxVol')}</span>
            <span class="set-slider-val mono" id="val-sfx">${Math.round(a.sfxVolume * 100)}%</span>
          </div>
          <input id="sl-sfx" class="set-range" type="range" min="0" max="100" step="5" value="${Math.round(a.sfxVolume * 100)}" />
        </div>

        <div class="set-row set-slider-row">
          <div class="set-slider-head">
            <span class="set-row-title">${t('optMusicVol')}</span>
            <span class="set-slider-val mono" id="val-music">${Math.round(a.musicVolume * 100)}%</span>
          </div>
          <input id="sl-music" class="set-range" type="range" min="0" max="100" step="5" value="${Math.round(a.musicVolume * 100)}" />
        </div>
      </div>
    `;

    this.bodyEl.querySelector('#sw-mute-all')?.addEventListener('click', () => {
      this.callbacks.onAnyInteract?.();
      this.callbacks.onMuteToggle(!this.callbacks.getMuted());
      this.renderAudioTab();
    });

    const slMaster = this.bodyEl.querySelector<HTMLInputElement>('#sl-master')!;
    slMaster.addEventListener('input', () => {
      this.callbacks.onAnyInteract?.();
      const val = Number(slMaster.value);
      const lbl = this.bodyEl.querySelector('#val-master');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateAudio({ masterVolume: val / 100 });
    });

    const slSfx = this.bodyEl.querySelector<HTMLInputElement>('#sl-sfx')!;
    slSfx.addEventListener('input', () => {
      this.callbacks.onAnyInteract?.();
      const val = Number(slSfx.value);
      const lbl = this.bodyEl.querySelector('#val-sfx');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateAudio({ sfxVolume: val / 100 });
    });

    const slMusic = this.bodyEl.querySelector<HTMLInputElement>('#sl-music')!;
    slMusic.addEventListener('input', () => {
      this.callbacks.onAnyInteract?.();
      const val = Number(slMusic.value);
      const lbl = this.bodyEl.querySelector('#val-music');
      if (lbl) lbl.textContent = `${val}%`;
      settingsManager.updateAudio({ musicVolume: val / 100 });
    });
  }

  private renderLanguageTab(): void {
    const cur = i18n.lang;
    const langs: { code: Language; flag: string; name: string; sub: string }[] = [
      { code: 'zh', flag: '🇨🇳', name: t('langZhName'), sub: t('langZhSub') },
      { code: 'en', flag: '🌐', name: t('langEnName'), sub: t('langEnSub') },
    ];

    this.bodyEl.innerHTML = `
      <div class="set-section">
        <div class="set-label-strong">${t('langSectionTitle')}</div>
        <div class="set-hint-box">${t('langSectionDesc')}</div>
        <div class="lang-cards-grid">
          ${langs
            .map(
              (l) => `
            <button type="button" class="lang-choice-card ${cur === l.code ? 'active' : ''}" data-lang="${l.code}">
              <span class="lang-flag">${l.flag}</span>
              <span class="lang-meta">
                <strong class="lang-name">${l.name}</strong>
                <span class="lang-sub">${l.sub}</span>
              </span>
              <span class="lang-check">${cur === l.code ? '✓' : ''}</span>
            </button>`
            )
            .join('')}
        </div>
      </div>
    `;

    this.bodyEl.querySelectorAll<HTMLButtonElement>('.lang-choice-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onAnyInteract?.();
        const lang = btn.dataset.lang as Language;
        if (lang === 'zh' || lang === 'en') {
          i18n.setLang(lang);
        }
      });
    });
  }
}
