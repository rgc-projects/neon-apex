import { i18n, t } from '../i18n/i18n';
import { nativeBridge } from '../platform/NativeBridge';
import { ControlSettings, settingsManager, SteerMode } from '../settings/SettingsManager';
import { InputState, RacerHUDTelemetry } from '../types';
import { clamp } from '../utils/math';

interface DeviceOrientationEventIOS extends DeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

type RightActionKey = 'drift' | 'nitro' | 'brake' | 'gas';
type SteerButtonKey = 'steerLeft' | 'steerRight';

interface RightPointerState {
  key: RightActionKey;
  downTime: number;
  slid: boolean;
  consumedLatchCancel: boolean;
}

/**
 * Mobile-First Multi-Touch Arcade Controller:
 * - Left-Hand 3 Steering Modes:
 *   1. Dynamic Floating Virtual Analog Joystick (zero-bias touchdown origin + anti-slip follow)
 *   2. Classic Left / Right Steering Buttons with Thumb Slide-Across Switching + Zero-Crossing Counter-Steer Snap
 *   3. DeviceOrientation Gyroscope Tilt Steering (left pad transforms into an Asphalt-style Left-Thumb Drift zone!)
 * - Right-Hand Ergonomic Thumb-Arc Pad:
 *   - Countdown Rev merged directly onto NITRO in Auto-Gas mode (zero thumb travel from Perfect Start into Launch Boost)
 *   - NITRO automatically engages full throttle in Manual Gas mode (never cuts gas when switching thumb)
 *   - Dual-mode NITRO: Quick Tap (<240ms) latches continuous boost (Tap/Brake/Drift cancels) + Long Hold releases cleanly
 *   - Thumb Slide-to-Engage across Drift / Nitro / Brake / Gas without lifting finger
 */
export class TouchControls {
  private readonly container = document.getElementById('touch-controls')!;
  private readonly joystickZone = document.getElementById('touch-joystick-zone')!;
  private readonly joystickBase = document.getElementById('touch-joystick-base')!;
  private readonly joystickStick = document.getElementById('joystick-stick')!;
  private readonly steerLeftVis = document.getElementById('steer-left-vis')!;
  private readonly steerRightVis = document.getElementById('steer-right-vis')!;
  private readonly tiltDriftHint = document.getElementById('touch-tilt-drift-hint')!;
  private readonly steerButtonsWrap = document.getElementById('touch-steer-buttons')!;
  private readonly steerLeftBtn = document.getElementById('touch-steer-left')!;
  private readonly steerRightBtn = document.getElementById('touch-steer-right')!;
  private readonly actionArc = document.getElementById('touch-action-arc')!;
  private readonly driftBtn = document.getElementById('touch-drift')!;
  private readonly nitroBtn = document.getElementById('touch-nitro')!;
  private readonly brakeBtn = document.getElementById('touch-brake')!;
  private readonly gasBtn = document.getElementById('touch-gas')!;
  private readonly autoGasBtn = document.getElementById('btn-hud-autogas')!;
  private readonly tiltBtn = document.getElementById('btn-hud-tilt')!;
  private readonly fullscreenBtn = document.getElementById('btn-hud-fullscreen')!;

  public enabled = false;
  public steerMode: SteerMode = 'joystick';
  public autoThrottle = true;
  public tiltEnabled = false;
  public steerSensitivity = 1.0;
  public hapticsEnabled = true;

  // Dynamic floating analog joystick state
  private steerTouchId: number | null = null;
  private steerMouseActive = false;
  private joyHomeX = 0;
  private joyHomeY = 0;
  private joyOriginX = 0;
  private joyOriginY = 0;
  private joyMaxRadius = 48;
  private touchSteerAxis = 0;
  private tiltSteerAxis = 0;
  private buttonSteerAxis = 0;

  // Smart right-hand Nitro tap-to-boost latch & state tracking
  private nitroTapLatched = false;
  private lastIsCountdown = false;
  private lastNitroLocked = false;

  // Pointer slide maps for zero-lift thumb transitions (left steer pad & right action arc)
  private readonly steerPointerMap = new Map<string, SteerButtonKey>();
  private readonly rightPointerMap = new Map<string, RightPointerState>();

  private readonly activeHold = {
    drift: new Set<string>(),
    tiltDrift: new Set<string>(),
    nitro: new Set<string>(),
    brake: new Set<string>(),
    gas: new Set<string>(),
    steerLeft: new Set<string>(),
    steerRight: new Set<string>(),
  };

  private readonly rightButtons: Record<RightActionKey, { el: HTMLElement; vibeMs: number }>;

  private onToggleChange?: (enabled: boolean) => void;
  private onFullscreenChange?: (isFullscreen: boolean) => void;
  private onAnyInteract?: () => void;
  private onStatusMessage?: (msg: string) => void;

  constructor(opts?: {
    onToggleChange?: (enabled: boolean) => void;
    onFullscreenChange?: (isFullscreen: boolean) => void;
    onAnyInteract?: () => void;
    onStatusMessage?: (msg: string) => void;
  }) {
    this.onToggleChange = opts?.onToggleChange;
    this.onFullscreenChange = opts?.onFullscreenChange;
    this.onAnyInteract = opts?.onAnyInteract;
    this.onStatusMessage = opts?.onStatusMessage;

    this.rightButtons = {
      drift: { el: this.driftBtn, vibeMs: 14 },
      nitro: { el: this.nitroBtn, vibeMs: 18 },
      brake: { el: this.brakeBtn, vibeMs: 10 },
      gas: { el: this.gasBtn, vibeMs: 10 },
    };

    const isTouchDevice =
      nativeBridge.isNative ||
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    this.setEnabled(isTouchDevice);

    window.addEventListener(
      'touchstart',
      () => {
        this.onAnyInteract?.();
        if (!this.enabled) {
          this.setEnabled(true);
        }
      },
      { passive: true, once: true }
    );

    window.addEventListener(
      'touchend',
      () => {
        this.onAnyInteract?.();
      },
      { passive: true }
    );

    this.container.addEventListener(
      'gesturestart',
      (e) => e.preventDefault(),
      { passive: false }
    );

    // Block mobile browser / WebView long-press context menus & text-selection translation popups
    // everywhere outside text inputs (e.g. circuit catalog search bar)
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };
    window.addEventListener(
      'contextmenu',
      (e) => {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
    document.addEventListener(
      'selectstart',
      (e) => {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    this.bindVirtualJoystick();
    this.bindSlideSteerButtons();
    this.bindSlideRightActionArc();

    this.autoGasBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      this.vibrate(10);
      const next = !this.autoThrottle;
      settingsManager.updateControls({ autoThrottle: next });
      this.onStatusMessage?.(next ? t('msgAutoGasOn') : t('msgAutoGasOff'));
    });

    this.tiltBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      void this.toggleTiltQuickButton();
    });

    this.fullscreenBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      void this.toggleFullscreen();
    });

    const syncFs = () => this.syncFullscreenUI();
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAllInputs();
    });
    window.addEventListener('blur', () => this.resetAllInputs());

    // Apply initial saved control settings
    this.applySettings(settingsManager.settings.controls, true);
    this.syncFullscreenUI();

    i18n.subscribe(() => {
      this.syncAutoGasUI();
      this.syncTiltUI();
    });
  }

  public applySettings(ctrl: ControlSettings, silent = false): void {
    this.autoThrottle = ctrl.autoThrottle;
    this.steerSensitivity = clamp(ctrl.steerSensitivity, 0.7, 1.4);
    this.hapticsEnabled = ctrl.haptics;

    // Visual scale & opacity applied smoothly via CSS custom properties
    this.container.style.setProperty('--touch-scale', ctrl.buttonScale.toFixed(2));
    this.container.style.setProperty('--touch-opacity', ctrl.buttonOpacity.toFixed(2));

    if (ctrl.steerMode !== this.steerMode) {
      this.steerMode = ctrl.steerMode;
      if (ctrl.steerMode === 'tilt') {
        void this.enableTiltMode(silent);
      } else {
        this.disableTiltListener();
        if (!silent) {
          this.onStatusMessage?.(
            ctrl.steerMode === 'buttons' ? t('msgSteerButtons') : t('msgSteerJoystick')
          );
        }
      }
    } else if (ctrl.steerMode === 'tilt' && !this.tiltEnabled) {
      void this.enableTiltMode(silent);
    }

    this.syncSteerModeUI();
    this.syncAutoGasUI();
    this.syncTiltUI();
  }

  private syncSteerModeUI(): void {
    const showButtons = this.steerMode === 'buttons';
    this.joystickZone.classList.toggle('hidden', showButtons);
    this.steerButtonsWrap.classList.toggle('hidden', !showButtons);
    this.joystickBase.classList.toggle('tilt-active', this.tiltEnabled);
    this.tiltDriftHint.classList.toggle('hidden', !this.tiltEnabled);
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.enabled || !this.hapticsEnabled) return;
    nativeBridge.haptic(pattern);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    document.body.classList.toggle('touch-mode', enabled);
    this.container.classList.toggle('hidden', !enabled);
    if (!enabled) {
      this.resetAllInputs();
    }
    this.syncSteerModeUI();
    this.syncAutoGasUI();
    this.syncTiltUI();
    this.onToggleChange?.(enabled);
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public isFullscreen(): boolean {
    if (nativeBridge.isNative) return true;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msExitFullscreen?: () => Promise<void>;
      msFullscreenElement?: Element;
    };
    const standalone =
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    return Boolean(
      doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement ||
        standalone
    );
  }

  private syncFullscreenUI(): void {
    const fs = this.isFullscreen();
    this.fullscreenBtn.classList.toggle('active-pill', fs);
    this.fullscreenBtn.innerHTML = fs
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    this.onFullscreenChange?.(fs);
  }

  public async toggleFullscreen(): Promise<void> {
    if (nativeBridge.isNative) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    const isNativeFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

    try {
      if (!isNativeFs) {
        if (root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: 'hide' }).catch(() => root.requestFullscreen());
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        } else if (root.mozRequestFullScreen) {
          await root.mozRequestFullScreen();
        } else if (root.msRequestFullscreen) {
          await root.msRequestFullscreen();
        } else {
          window.scrollTo(0, 1);
          this.onStatusMessage?.(t('msgIosFsTip'));
          return;
        }
        this.vibrate(14);
        const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (this.enabled && typeof orient?.lock === 'function') {
          orient.lock('landscape').catch(() => {});
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch {
      window.scrollTo(0, 1);
      this.onStatusMessage?.(t('msgBrowserFsTip'));
    } finally {
      this.syncFullscreenUI();
    }
  }

  public resetAllInputs(): void {
    this.steerTouchId = null;
    this.steerMouseActive = false;
    this.touchSteerAxis = 0;
    this.buttonSteerAxis = 0;
    this.nitroTapLatched = false;
    this.steerPointerMap.clear();
    this.rightPointerMap.clear();

    this.joystickBase.classList.remove('dragging', 'tilt-drifting');
    this.joystickBase.style.transform = 'translate3d(0px, 0px, 0px)';
    this.updateJoystickStickVisual(0, 0, 0);

    this.activeHold.drift.clear();
    this.activeHold.tiltDrift.clear();
    this.activeHold.nitro.clear();
    this.activeHold.brake.clear();
    this.activeHold.gas.clear();
    this.activeHold.steerLeft.clear();
    this.activeHold.steerRight.clear();

    this.driftBtn.classList.remove('pressed');
    this.nitroBtn.classList.remove('pressed', 'latched', 'rev-pulse');
    this.brakeBtn.classList.remove('pressed');
    this.gasBtn.classList.remove('pressed');
    this.steerLeftBtn.classList.remove('pressed');
    this.steerRightBtn.classList.remove('pressed');
  }

  private syncAutoGasUI(): void {
    this.autoGasBtn.textContent = this.autoThrottle ? t('hudAutoGas') : t('hudManualGas');
    this.autoGasBtn.classList.toggle('active-pill', this.autoThrottle);
    this.gasBtn.classList.toggle('manual-gas', !this.autoThrottle);
  }

  private syncTiltUI(): void {
    this.tiltBtn.textContent = this.tiltEnabled ? t('hudTiltOn') : t('hudTiltOff');
    this.tiltBtn.classList.toggle('active-pill', this.tiltEnabled);
    this.joystickBase.classList.toggle('tilt-active', this.tiltEnabled);
    this.tiltDriftHint.classList.toggle('hidden', !this.tiltEnabled);
  }

  private disableTiltListener(): void {
    this.tiltEnabled = false;
    this.tiltSteerAxis = 0;
    this.activeHold.tiltDrift.clear();
    this.joystickBase.classList.remove('tilt-drifting');
    window.removeEventListener('deviceorientation', this.onDeviceOrientation, true);
    this.updateJoystickStickVisual(0, 0, 0);
  }

  private async toggleTiltQuickButton(): Promise<void> {
    if (this.tiltEnabled) {
      settingsManager.updateControls({ steerMode: 'joystick' });
      return;
    }
    const ok = await this.enableTiltMode(false);
    if (ok) {
      this.steerMode = 'tilt';
      settingsManager.updateControls({ steerMode: 'tilt' });
    }
  }

  private async enableTiltMode(silent: boolean): Promise<boolean> {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      if (!silent) this.onStatusMessage?.(t('msgTiltUnsupported'));
      return false;
    }

    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventIOS;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          if (!silent) this.onStatusMessage?.(t('msgTiltDenied'));
          return false;
        }
      } catch {
        if (!silent) this.onStatusMessage?.(t('msgTiltUnavailable'));
        return false;
      }
    }

    this.tiltEnabled = true;
    window.addEventListener('deviceorientation', this.onDeviceOrientation, true);
    if (!silent) {
      this.vibrate(16);
      this.onStatusMessage?.(t('msgTiltOn'));
    }
    this.syncTiltUI();
    return true;
  }

  private onDeviceOrientation = (e: DeviceOrientationEvent): void => {
    if (!this.tiltEnabled) return;
    const angle =
      (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) % 360;

    let tiltDeg = 0;
    if (angle === 90) {
      tiltDeg = e.beta ?? 0;
    } else if (angle === 270 || angle === -90) {
      tiltDeg = -(e.beta ?? 0);
    } else {
      tiltDeg = e.gamma ?? 0;
    }

    const deadzone = 3.5;
    if (Math.abs(tiltDeg) < deadzone) {
      this.tiltSteerAxis = 0;
    } else {
      const sign = Math.sign(tiltDeg);
      const norm = clamp(((Math.abs(tiltDeg) - deadzone) / 22.5) * this.steerSensitivity, 0, 1);
      this.tiltSteerAxis = sign * Math.pow(norm, 1.15);
    }

    if (this.steerTouchId === null && !this.steerMouseActive) {
      const r = Math.max(this.joystickBase.offsetWidth * 0.36, 40);
      this.updateJoystickStickVisual(this.tiltSteerAxis * r, 0, this.tiltSteerAxis);
    }
  };

  private beginJoystickAt(clientX: number, clientY: number): void {
    this.joystickBase.classList.remove('dragging');
    this.joystickBase.style.transform = 'translate3d(0px, 0px, 0px)';
    const baseRect = this.joystickBase.getBoundingClientRect();

    this.joyHomeX = baseRect.left + baseRect.width * 0.5;
    this.joyHomeY = baseRect.top + baseRect.height * 0.5;
    this.joyMaxRadius = Math.max(baseRect.width * 0.38, 44);

    this.joyOriginX = clientX;
    this.joyOriginY = clientY;
    this.touchSteerAxis = 0;

    const shiftX = this.joyOriginX - this.joyHomeX;
    const shiftY = this.joyOriginY - this.joyHomeY;
    this.joystickBase.classList.add('dragging');
    this.joystickBase.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 0px)`;
    this.updateJoystickStickVisual(0, 0, 0);
  }

  private updateJoystickMove(clientX: number, clientY: number): void {
    let dx = clientX - this.joyOriginX;
    let dy = clientY - this.joyOriginY;
    let dist = Math.hypot(dx, dy);
    const maxR = this.joyMaxRadius;

    const followLimit = maxR * 1.35;
    if (dist > followLimit && dist > 0.001) {
      const pull = dist - followLimit;
      const ux = dx / dist;
      const uy = dy / dist;
      const zoneRect = this.joystickZone.getBoundingClientRect();
      const pad = 26;
      this.joyOriginX = clamp(this.joyOriginX + ux * pull, zoneRect.left + pad, zoneRect.right - pad);
      this.joyOriginY = clamp(this.joyOriginY + uy * pull, zoneRect.top + pad, zoneRect.bottom - pad);

      const shiftX = this.joyOriginX - this.joyHomeX;
      const shiftY = this.joyOriginY - this.joyHomeY;
      this.joystickBase.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 0px)`;

      dx = clientX - this.joyOriginX;
      dy = clientY - this.joyOriginY;
      dist = Math.hypot(dx, dy);
    }

    let visX = dx;
    let visY = dy;
    if (dist > maxR && dist > 0.001) {
      const scale = maxR / dist;
      visX = dx * scale;
      visY = dy * scale;
    }

    const normX = clamp((dx / maxR) * this.steerSensitivity, -1, 1);
    const absX = Math.abs(normX);
    const deadzone = 0.07;

    if (absX <= deadzone) {
      this.touchSteerAxis = 0;
    } else {
      const sign = Math.sign(normX);
      const tNorm = clamp((absX - deadzone) / (0.9 - deadzone), 0, 1);
      this.touchSteerAxis = sign * Math.pow(tNorm, 1.18);
    }

    this.updateJoystickStickVisual(visX, visY, this.touchSteerAxis);
  }

  private endJoystick(): void {
    this.touchSteerAxis = 0;
    this.joystickBase.classList.remove('dragging');
    this.joystickBase.style.transform = 'translate3d(0px, 0px, 0px)';

    if (this.tiltEnabled) {
      const r = Math.max(this.joystickBase.offsetWidth * 0.36, 40);
      this.updateJoystickStickVisual(this.tiltSteerAxis * r, 0, this.tiltSteerAxis);
    } else {
      this.updateJoystickStickVisual(0, 0, 0);
    }
  }

  private updateJoystickStickVisual(visX: number, visY: number, axis: number): void {
    this.joystickStick.style.transform = `translate3d(${visX.toFixed(1)}px, ${visY.toFixed(1)}px, 0px)`;
    this.joystickStick.classList.toggle('engaged', Math.abs(axis) > 0.07 || Math.hypot(visX, visY) > 6);
    this.steerLeftVis.classList.toggle('active', axis < -0.1);
    this.steerRightVis.classList.toggle('active', axis > 0.1);
  }

  private bindVirtualJoystick(): void {
    const pressTiltDrift = (id: string) => {
      const wasEmpty = this.activeHold.tiltDrift.size === 0;
      this.activeHold.tiltDrift.add(id);
      this.joystickBase.classList.add('tilt-drifting');
      if (wasEmpty) this.vibrate(14);
      if (this.lastNitroLocked) this.nitroTapLatched = false;
    };
    const releaseTiltDrift = (id: string) => {
      this.activeHold.tiltDrift.delete(id);
      if (this.activeHold.tiltDrift.size === 0) {
        this.joystickBase.classList.remove('tilt-drifting');
      }
    };

    this.joystickZone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.onAnyInteract?.();
        if (this.tiltEnabled) {
          // Asphalt-style two-thumb ergonomics: in Tilt mode, left thumb pad becomes a huge DRIFT button!
          for (let i = 0; i < e.changedTouches.length; i++) {
            pressTiltDrift(`td:${e.changedTouches[i].identifier}`);
          }
          return;
        }
        if (this.steerTouchId === null && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          this.steerTouchId = touch.identifier;
          this.vibrate(8);
          this.beginJoystickAt(touch.clientX, touch.clientY);
        }
      },
      { passive: false }
    );

    this.joystickZone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (this.tiltEnabled || this.steerTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.steerTouchId) {
            this.updateJoystickMove(touch.clientX, touch.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    const endTouchSteer = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const tid = e.changedTouches[i].identifier;
        releaseTiltDrift(`td:${tid}`);
        if (this.steerTouchId === tid) {
          this.steerTouchId = null;
          this.endJoystick();
        }
      }
    };
    this.joystickZone.addEventListener('touchend', endTouchSteer, { passive: false });
    this.joystickZone.addEventListener('touchcancel', endTouchSteer, { passive: false });

    this.joystickZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.onAnyInteract?.();
      try {
        this.joystickZone.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }
      if (this.tiltEnabled) {
        pressTiltDrift(`pd:${e.pointerId}`);
        return;
      }
      this.steerMouseActive = true;
      this.beginJoystickAt(e.clientX, e.clientY);
    });

    this.joystickZone.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || this.tiltEnabled || !this.steerMouseActive) return;
      e.preventDefault();
      this.updateJoystickMove(e.clientX, e.clientY);
    });

    const endMouseSteer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      releaseTiltDrift(`pd:${e.pointerId}`);
      if (!this.steerMouseActive) return;
      this.steerMouseActive = false;
      this.endJoystick();
    };
    this.joystickZone.addEventListener('pointerup', endMouseSteer);
    this.joystickZone.addEventListener('pointercancel', endMouseSteer);
    this.joystickZone.addEventListener('lostpointercapture', endMouseSteer);
  }

  /**
   * Classic Left/Right Steering Buttons with ZERO-LIFT Thumb Slide-Across Switching:
   * Players can smoothly slide their left thumb horizontally from ◀ to ▶ (or ▶ to ◀)
   * across S-curves and drift counter-steers without lifting their finger.
   */
  private bindSlideSteerButtons(): void {
    const setSteerKey = (id: string, key: SteerButtonKey) => {
      const prev = this.steerPointerMap.get(id);
      if (prev === key) return;
      if (prev) {
        this.activeHold[prev].delete(id);
        const prevEl = prev === 'steerLeft' ? this.steerLeftBtn : this.steerRightBtn;
        if (this.activeHold[prev].size === 0) prevEl.classList.remove('pressed');
      }
      this.steerPointerMap.set(id, key);
      const wasEmpty = this.activeHold[key].size === 0;
      this.activeHold[key].add(id);
      const nextEl = key === 'steerLeft' ? this.steerLeftBtn : this.steerRightBtn;
      nextEl.classList.add('pressed');
      if (wasEmpty) this.vibrate(8);
    };

    const releaseSteerKey = (id: string) => {
      const prev = this.steerPointerMap.get(id);
      if (!prev) return;
      this.steerPointerMap.delete(id);
      this.activeHold[prev].delete(id);
      const prevEl = prev === 'steerLeft' ? this.steerLeftBtn : this.steerRightBtn;
      if (this.activeHold[prev].size === 0) prevEl.classList.remove('pressed');
    };

    const resolveSteerKeyAtX = (clientX: number): SteerButtonKey => {
      const lRect = this.steerLeftBtn.getBoundingClientRect();
      const rRect = this.steerRightBtn.getBoundingClientRect();
      const splitX = (lRect.right + rRect.left) * 0.5;
      return clientX < splitX ? 'steerLeft' : 'steerRight';
    };

    const bindBtn = (el: HTMLElement, initialKey: SteerButtonKey) => {
      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.onAnyInteract?.();
          for (let i = 0; i < e.changedTouches.length; i++) {
            setSteerKey(`t:${e.changedTouches[i].identifier}`, initialKey);
          }
        },
        { passive: false }
      );

      el.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const id = `t:${touch.identifier}`;
            if (this.steerPointerMap.has(id)) {
              setSteerKey(id, resolveSteerKeyAtX(touch.clientX));
            }
          }
        },
        { passive: false }
      );

      const onEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          releaseSteerKey(`t:${e.changedTouches[i].identifier}`);
        }
      };
      el.addEventListener('touchend', onEnd, { passive: false });
      el.addEventListener('touchcancel', onEnd, { passive: false });

      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        this.onAnyInteract?.();
        setSteerKey(`p:${e.pointerId}`, initialKey);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events
        }
      });

      el.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const id = `p:${e.pointerId}`;
        if (this.steerPointerMap.has(id)) {
          setSteerKey(id, resolveSteerKeyAtX(e.clientX));
        }
      });

      const onPtrUp = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        releaseSteerKey(`p:${e.pointerId}`);
      };
      el.addEventListener('pointerup', onPtrUp);
      el.addEventListener('pointercancel', onPtrUp);
      el.addEventListener('lostpointercapture', onPtrUp);
    };

    bindBtn(this.steerLeftBtn, 'steerLeft');
    bindBtn(this.steerRightBtn, 'steerRight');
  }

  /**
   * Right-Hand Ergonomic Thumb-Arc Action Pad with:
   * - Zero-lift Thumb Slide-to-Engage across DRIFT / NITRO / BRAKE / GAS
   * - Dual-mode NITRO: Quick Tap (<240ms) latches continuous boost; Long Hold releases cleanly
   */
  private bindSlideRightActionArc(): void {
    const resolveActionAt = (clientX: number, clientY: number): RightActionKey | null => {
      const hit = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('.arc-btn');
      if (!hit || hit.classList.contains('hidden')) return null;
      if (hit === this.driftBtn) return 'drift';
      if (hit === this.nitroBtn) return 'nitro';
      if (hit === this.brakeBtn) return 'brake';
      if (hit === this.gasBtn) return 'gas';
      return null;
    };

    const activateKey = (id: string, key: RightActionKey, isSlide: boolean) => {
      const btn = this.rightButtons[key];
      const wasEmpty = this.activeHold[key].size === 0;
      let consumedLatchCancel = false;

      if (key === 'brake') {
        this.nitroTapLatched = false;
      } else if (key === 'drift' && this.lastNitroLocked) {
        this.nitroTapLatched = false;
      } else if (key === 'nitro' && !isSlide && !this.lastIsCountdown && this.nitroTapLatched) {
        // Second tap on Nitro cancels latched continuous boost cleanly
        this.nitroTapLatched = false;
        consumedLatchCancel = true;
      }

      this.activeHold[key].add(id);
      btn.el.classList.add('pressed');
      if (wasEmpty) this.vibrate(btn.vibeMs);

      this.rightPointerMap.set(id, {
        key,
        downTime: performance.now(),
        slid: isSlide,
        consumedLatchCancel,
      });
    };

    const releaseKey = (id: string, isSlideTransition: boolean) => {
      const st = this.rightPointerMap.get(id);
      if (!st) return;
      this.rightPointerMap.delete(id);

      const { key, downTime, slid, consumedLatchCancel } = st;
      this.activeHold[key].delete(id);
      if (this.activeHold[key].size === 0) {
        this.rightButtons[key].el.classList.remove('pressed');
      }

      // Quick Tap (<240ms) on NITRO during active racing latches continuous boost (Asphalt / QQ Speed style!)
      if (
        key === 'nitro' &&
        !isSlideTransition &&
        !slid &&
        !consumedLatchCancel &&
        !this.lastIsCountdown &&
        !this.lastNitroLocked
      ) {
        const holdMs = performance.now() - downTime;
        if (holdMs < 240) {
          this.nitroTapLatched = true;
        }
      }
    };

    const handleSlideMove = (id: string, clientX: number, clientY: number) => {
      const st = this.rightPointerMap.get(id);
      if (!st) return;
      const hitKey = resolveActionAt(clientX, clientY);
      if (hitKey && hitKey !== st.key) {
        st.slid = true;
        releaseKey(id, true);
        activateKey(id, hitKey, true);
      }
    };

    const bindRightBtn = (key: RightActionKey) => {
      const { el } = this.rightButtons[key];

      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          this.onAnyInteract?.();
          for (let i = 0; i < e.changedTouches.length; i++) {
            activateKey(`t:${e.changedTouches[i].identifier}`, key, false);
          }
        },
        { passive: false }
      );

      el.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            handleSlideMove(`t:${touch.identifier}`, touch.clientX, touch.clientY);
          }
        },
        { passive: false }
      );

      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          releaseKey(`t:${e.changedTouches[i].identifier}`, false);
        }
      };
      el.addEventListener('touchend', onTouchEnd, { passive: false });
      el.addEventListener('touchcancel', onTouchEnd, { passive: false });

      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        this.onAnyInteract?.();
        activateKey(`p:${e.pointerId}`, key, false);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic events
        }
      });

      el.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        handleSlideMove(`p:${e.pointerId}`, e.clientX, e.clientY);
      });

      const onPtrUp = (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        releaseKey(`p:${e.pointerId}`, false);
      };
      el.addEventListener('pointerup', onPtrUp);
      el.addEventListener('pointercancel', onPtrUp);
      el.addEventListener('lostpointercapture', onPtrUp);
    };

    // Keep container touch-action guarded so rapid thumb slides never scroll or zoom WebView
    this.actionArc.addEventListener(
      'touchmove',
      (e) => {
        if (this.rightPointerMap.size > 0) e.preventDefault();
      },
      { passive: false }
    );

    bindRightBtn('drift');
    bindRightBtn('nitro');
    bindRightBtn('brake');
    bindRightBtn('gas');
  }

  public getInput(isCountdown: boolean): InputState {
    this.lastIsCountdown = isCountdown;
    if (isCountdown) {
      this.nitroTapLatched = false;
    }

    if (!this.enabled) {
      return {
        throttle: false,
        brake: false,
        left: false,
        right: false,
        drift: false,
        nitro: false,
        steerAxis: 0,
      };
    }

    const brake = this.activeHold.brake.size > 0;
    const manualGas = this.activeHold.gas.size > 0;
    const nitroHeld = this.activeHold.nitro.size > 0;
    const drift = this.activeHold.drift.size > 0 || this.activeHold.tiltDrift.size > 0;

    if (brake || (drift && this.lastNitroLocked)) {
      this.nitroTapLatched = false;
    }

    const nitroActive = isCountdown ? false : nitroHeld || this.nitroTapLatched;

    let steerAxis = 0;
    if (this.steerMode === 'buttons') {
      const leftPressed = this.activeHold.steerLeft.size > 0;
      const rightPressed = this.activeHold.steerRight.size > 0;
      const target = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
      const step = 0.26 * this.steerSensitivity;
      if (target === 0) {
        this.buttonSteerAxis *= 0.52;
        if (Math.abs(this.buttonSteerAxis) < 0.04) this.buttonSteerAxis = 0;
      } else {
        // Instant zero-crossing snap when counter-steering / switching direction across S-bends!
        if (this.buttonSteerAxis !== 0 && Math.sign(this.buttonSteerAxis) !== target) {
          this.buttonSteerAxis = target * Math.min(0.32, step);
        } else {
          this.buttonSteerAxis = clamp(this.buttonSteerAxis + target * step, -1, 1);
        }
      }
      steerAxis = this.buttonSteerAxis;
    } else if (this.tiltEnabled) {
      steerAxis = this.tiltSteerAxis;
    } else {
      const hasTouchSteer = this.steerTouchId !== null || this.steerMouseActive;
      steerAxis = hasTouchSteer ? this.touchSteerAxis : 0;
    }

    // Countdown: both GAS and NITRO rev engine (so holding NITRO flows straight into launch boost!)
    // Racing: Auto-Gas stays on unless braking; Manual Gas stays engaged whenever NITRO is firing!
    const throttle = isCountdown
      ? manualGas || nitroHeld
      : this.autoThrottle
        ? !brake
        : manualGas || nitroActive;

    return {
      throttle,
      brake,
      left: false,
      right: false,
      drift,
      nitro: nitroActive,
      steerAxis,
    };
  }

  public updateVisuals(telemetry: RacerHUDTelemetry | null, isCountdown: boolean): void {
    if (!this.enabled) return;
    this.lastIsCountdown = isCountdown;

    // In Auto-Gas mode, countdown revving is merged directly onto the NITRO button (zero thumb travel on GO!).
    // Separate GAS pedal only appears when Manual Gas mode is active.
    const showGas = !this.autoThrottle;
    this.gasBtn.classList.toggle('hidden', !showGas);
    const gasLabel = this.gasBtn.querySelector('.tbtn-main');
    if (gasLabel) {
      gasLabel.textContent = isCountdown ? t('touchRevMain') : t('touchGasMain');
    }
    this.gasBtn.classList.toggle('rev-pulse', isCountdown && showGas);

    const nMain = this.nitroBtn.querySelector('.tbtn-main');
    const nSub = this.nitroBtn.querySelector('.tbtn-sub');

    if (isCountdown) {
      this.nitroTapLatched = false;
      this.nitroBtn.classList.remove('locked', 'ready', 'super', 'latched');
      this.nitroBtn.classList.add('rev-pulse');
      if (nMain) nMain.textContent = t('touchRevMain');
      if (nSub) nSub.textContent = t('touchNitroRevSub');
      return;
    }

    this.nitroBtn.classList.remove('rev-pulse');
    if (nMain) nMain.textContent = t('touchNitroMain');

    if (!telemetry) return;

    const locked = telemetry.nitroLockedByDrift;
    this.lastNitroLocked = locked;
    if (locked || telemetry.nitro <= 1) {
      this.nitroTapLatched = false;
    }

    const isInfZone = !locked && telemetry.inHyperZone;
    const superReady = !locked && (isInfZone || telemetry.isSuperNitro || telemetry.nitro >= 82);
    const ready = !locked && telemetry.nitro >= 14;
    this.nitroBtn.classList.toggle('locked', locked);
    this.nitroBtn.classList.toggle('latched', this.nitroTapLatched && !locked);
    this.nitroBtn.classList.toggle('ready', ready && !superReady && !this.nitroTapLatched);
    this.nitroBtn.classList.toggle('super', superReady);
    if (nSub) {
      nSub.textContent = locked
        ? t('touchNitroLocked')
        : this.nitroTapLatched
          ? t('touchNitroLatched')
          : isInfZone
            ? t('touchNitroInf')
            : superReady
              ? t('touchNitroSuper')
              : `${Math.round(telemetry.nitro)}%`;
    }

    this.driftBtn.classList.remove('tier-1', 'tier-2', 'tier-3');
    if (telemetry.isDrifting && telemetry.driftTier > 0) {
      this.driftBtn.classList.add(`tier-${telemetry.driftTier}`);
    }
  }
}
