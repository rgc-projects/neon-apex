import { InputState, RacerHUDTelemetry } from '../types';
import { clamp } from '../utils/math';

interface DeviceOrientationEventIOS extends DeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Mobile-First Multi-Touch Dynamic Floating Joystick + Thumb-Arc Arcade Controller:
 * - Native TouchEvent (`passive: false`) multi-touch engine for rock-solid iOS Safari / Android Chrome / WeChat support,
 *   plus mouse PointerEvent fallback so desktop users can also test touch controls.
 * - True Dynamic Floating Virtual Joystick across the ENTIRE lower-left half of the screen:
 *   touching down ANYWHERE ALWAYS spawns the joystick origin at the EXACT touchdown coordinates (0.00 steering bias!),
 *   so slightly off-center presses NEVER jerk the car or cause loss of control.
 *   Includes smooth anti-slip origin follow when dragged past 1.35× max radius for instant counter-steer reversals.
 * - Ergonomic Right-Thumb Arc Layout (DRIFT, NITRO, BRAKE, contextual REV/GAS).
 * - Full Mobile Fullscreen support (Android/Chrome native Fullscreen API + orientation hint + iOS Safari PWA tip).
 */
export class TouchControls {
  private readonly container = document.getElementById('touch-controls')!;
  private readonly joystickZone = document.getElementById('touch-joystick-zone')!;
  private readonly joystickBase = document.getElementById('touch-joystick-base')!;
  private readonly joystickStick = document.getElementById('joystick-stick')!;
  private readonly steerLeftVis = document.getElementById('steer-left-vis')!;
  private readonly steerRightVis = document.getElementById('steer-right-vis')!;
  private readonly driftBtn = document.getElementById('touch-drift')!;
  private readonly nitroBtn = document.getElementById('touch-nitro')!;
  private readonly brakeBtn = document.getElementById('touch-brake')!;
  private readonly gasBtn = document.getElementById('touch-gas')!;
  private readonly autoGasBtn = document.getElementById('btn-hud-autogas')!;
  private readonly tiltBtn = document.getElementById('btn-hud-tilt')!;
  private readonly fullscreenBtn = document.getElementById('btn-hud-fullscreen')!;

  public enabled = false;
  public autoThrottle = true;
  public tiltEnabled = false;

  // Dynamic floating analog joystick state
  private steerTouchId: number | null = null;
  private steerMouseActive = false;
  private joyHomeX = 0;
  private joyHomeY = 0;
  private joyOriginX = 0;
  private joyOriginY = 0;
  private joyMaxRadius = 48;
  private touchSteerAxis = 0; // -1..+1
  private tiltSteerAxis = 0;  // -1..+1

  // Multi-touch active button trackers (keys are 't:<touchId>' or 'p:<pointerId>')
  private readonly activeHold = {
    drift: new Set<string>(),
    nitro: new Set<string>(),
    brake: new Set<string>(),
    gas: new Set<string>(),
  };

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

    // Auto-detect phones / tablets
    const isTouchDevice =
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    this.setEnabled(isTouchDevice);

    // Auto-enable & unlock audio on first physical touch anywhere
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

    // iOS Safari requires AudioContext unlock inside touchend too
    window.addEventListener(
      'touchend',
      () => {
        this.onAnyInteract?.();
      },
      { passive: true }
    );

    // Prevent pinch-zoom / multi-finger browser gestures during active racing
    this.container.addEventListener(
      'gesturestart',
      (e) => e.preventDefault(),
      { passive: false }
    );

    this.bindVirtualJoystick();
    this.bindHoldButton(this.driftBtn, 'drift', 14);
    this.bindHoldButton(this.nitroBtn, 'nitro', 18);
    this.bindHoldButton(this.brakeBtn, 'brake', 10);
    this.bindHoldButton(this.gasBtn, 'gas', 10);

    this.autoGasBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      this.vibrate(10);
      this.autoThrottle = !this.autoThrottle;
      this.syncAutoGasUI();
      this.onStatusMessage?.(this.autoThrottle ? 'AUTO GAS: ON' : 'MANUAL GAS PEDAL');
    });

    this.tiltBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      void this.toggleTiltSteering();
    });

    this.fullscreenBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      void this.toggleFullscreen();
    });

    // Keep HUD + Menu fullscreen buttons synced whenever user exits fullscreen via gesture/ESC
    const syncFs = () => this.syncFullscreenUI();
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);

    // Clear stuck touches if app goes to background or loses focus
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAllInputs();
    });
    window.addEventListener('blur', () => this.resetAllInputs());

    this.syncAutoGasUI();
    this.syncTiltUI();
    this.syncFullscreenUI();
  }

  public vibrate(pattern: number | number[]): void {
    if (!this.enabled) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore on browsers without Vibration API (e.g. iOS Safari)
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    document.body.classList.toggle('touch-mode', enabled);
    this.container.classList.toggle('hidden', !enabled);
    if (!enabled) {
      this.resetAllInputs();
    }
    this.syncAutoGasUI();
    this.syncTiltUI();
    this.onToggleChange?.(enabled);
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public isFullscreen(): boolean {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
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
    this.fullscreenBtn.textContent = fs ? '🗗' : '⛶';
    this.onFullscreenChange?.(fs);
  }

  public async toggleFullscreen(): Promise<void> {
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
          // iOS Safari browser tabs restrict Fullscreen API: minimize bar & guide user to PWA Fullscreen
          window.scrollTo(0, 1);
          this.onStatusMessage?.('iOS 请点底部分享 →「添加到主屏幕」享无边框真全屏');
          return;
        }
        this.vibrate(14);
        // Optional gentle landscape lock hint on phones (silent fallback if unsupported)
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
      this.onStatusMessage?.('当前浏览器限制全屏，可「添加到主屏幕」全屏畅玩');
    } finally {
      this.syncFullscreenUI();
    }
  }

  public resetAllInputs(): void {
    this.steerTouchId = null;
    this.steerMouseActive = false;
    this.touchSteerAxis = 0;
    this.joystickBase.classList.remove('dragging');
    this.joystickBase.style.transform = 'translate3d(0px, 0px, 0px)';
    this.updateJoystickStickVisual(0, 0, 0);

    this.activeHold.drift.clear();
    this.activeHold.nitro.clear();
    this.activeHold.brake.clear();
    this.activeHold.gas.clear();

    this.driftBtn.classList.remove('pressed');
    this.nitroBtn.classList.remove('pressed');
    this.brakeBtn.classList.remove('pressed');
    this.gasBtn.classList.remove('pressed');
  }

  private syncAutoGasUI(): void {
    this.autoGasBtn.textContent = this.autoThrottle ? 'AUTO' : 'MANUAL';
    this.autoGasBtn.classList.toggle('active-pill', this.autoThrottle);
    this.gasBtn.classList.toggle('manual-gas', !this.autoThrottle);
  }

  private syncTiltUI(): void {
    this.tiltBtn.textContent = this.tiltEnabled ? 'TILT: ON' : 'TILT';
    this.tiltBtn.classList.toggle('active-pill', this.tiltEnabled);
    this.joystickBase.classList.toggle('tilt-active', this.tiltEnabled);
  }

  private async toggleTiltSteering(): Promise<void> {
    if (this.tiltEnabled) {
      this.tiltEnabled = false;
      this.tiltSteerAxis = 0;
      window.removeEventListener('deviceorientation', this.onDeviceOrientation);
      this.syncTiltUI();
      this.updateJoystickStickVisual(0, 0, 0);
      this.onStatusMessage?.('JOYSTICK STEERING');
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.onStatusMessage?.('TILT NOT SUPPORTED');
      return;
    }

    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventIOS;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          this.onStatusMessage?.('TILT PERMISSION DENIED');
          return;
        }
      } catch {
        this.onStatusMessage?.('TILT UNAVAILABLE');
        return;
      }
    }

    this.tiltEnabled = true;
    window.addEventListener('deviceorientation', this.onDeviceOrientation, true);
    this.vibrate(16);
    this.syncTiltUI();
    this.onStatusMessage?.('🧭 TILT STEERING ON');
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
      const norm = clamp((Math.abs(tiltDeg) - deadzone) / 22.5, 0, 1);
      this.tiltSteerAxis = sign * Math.pow(norm, 1.15);
    }

    if (this.steerTouchId === null && !this.steerMouseActive) {
      const r = Math.max(this.joystickBase.offsetWidth * 0.36, 40);
      this.updateJoystickStickVisual(this.tiltSteerAxis * r, 0, this.tiltSteerAxis);
    }
  };

  /**
   * True AAA Dynamic Floating Joystick Initialization:
   * ALWAYS places the neutral center (0, 0) at the EXACT touchdown point (clientX, clientY)!
   * Result: ZERO accidental steering jerk on landing, no matter where your left thumb lands!
   */
  private beginJoystickAt(clientX: number, clientY: number): void {
    // Clear active transform temporarily to read exact resting home center in viewport coordinates
    this.joystickBase.classList.remove('dragging');
    this.joystickBase.style.transform = 'translate3d(0px, 0px, 0px)';
    const baseRect = this.joystickBase.getBoundingClientRect();

    this.joyHomeX = baseRect.left + baseRect.width * 0.5;
    this.joyHomeY = baseRect.top + baseRect.height * 0.5;
    this.joyMaxRadius = Math.max(baseRect.width * 0.38, 44);

    // Exact touchdown point IS ALWAYS the neutral 0.00 center!
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

    // Anti-slip dynamic follow ("跟手防脱"): if thumb drags far beyond rim (>1.35× radius),
    // gently pull the origin along so quick counter-steer reversals remain instant & crisp!
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

    // Tactile 360° circular puck clamp
    let visX = dx;
    let visY = dy;
    if (dist > maxR && dist > 0.001) {
      const scale = maxR / dist;
      visX = dx * scale;
      visY = dy * scale;
    }

    // Precision progressive analog steering curve from horizontal throw (-1..+1)
    const normX = clamp(dx / maxR, -1, 1);
    const absX = Math.abs(normX);
    const deadzone = 0.07;

    if (absX <= deadzone) {
      this.touchSteerAxis = 0;
    } else {
      const sign = Math.sign(normX);
      const t = clamp((absX - deadzone) / (0.90 - deadzone), 0, 1);
      this.touchSteerAxis = sign * Math.pow(t, 1.18);
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
    // 1. Native multi-touch TouchEvents across entire lower-left half
    this.joystickZone.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.onAnyInteract?.();
        if (this.steerTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          this.steerTouchId = t.identifier;
          this.vibrate(8);
          this.beginJoystickAt(t.clientX, t.clientY);
        }
      },
      { passive: false }
    );

    this.joystickZone.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (this.steerTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.steerTouchId) {
            this.updateJoystickMove(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    const endTouchSteer = (e: TouchEvent) => {
      if (this.steerTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.steerTouchId) {
          this.steerTouchId = null;
          this.endJoystick();
          break;
        }
      }
    };
    this.joystickZone.addEventListener('touchend', endTouchSteer, { passive: false });
    this.joystickZone.addEventListener('touchcancel', endTouchSteer, { passive: false });

    // 2. Mouse / stylus fallback via PointerEvent (ignored for touch to prevent double-firing)
    this.joystickZone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.onAnyInteract?.();
      this.steerMouseActive = true;
      try {
        this.joystickZone.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }
      this.beginJoystickAt(e.clientX, e.clientY);
    });

    this.joystickZone.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !this.steerMouseActive) return;
      e.preventDefault();
      this.updateJoystickMove(e.clientX, e.clientY);
    });

    const endMouseSteer = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !this.steerMouseActive) return;
      this.steerMouseActive = false;
      this.endJoystick();
    };
    this.joystickZone.addEventListener('pointerup', endMouseSteer);
    this.joystickZone.addEventListener('pointercancel', endMouseSteer);
    this.joystickZone.addEventListener('lostpointercapture', endMouseSteer);
  }

  private bindHoldButton(
    el: HTMLElement,
    key: 'drift' | 'nitro' | 'brake' | 'gas',
    vibeMs: number
  ): void {
    const set = this.activeHold[key];

    const press = (id: string) => {
      const wasEmpty = set.size === 0;
      set.add(id);
      el.classList.add('pressed');
      if (wasEmpty) this.vibrate(vibeMs);
    };

    const release = (id: string) => {
      set.delete(id);
      if (set.size === 0) {
        el.classList.remove('pressed');
      }
    };

    el.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.onAnyInteract?.();
        for (let i = 0; i < e.changedTouches.length; i++) {
          press(`t:${e.changedTouches[i].identifier}`);
        }
      },
      { passive: false }
    );

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        release(`t:${e.changedTouches[i].identifier}`);
      }
    };
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.onAnyInteract?.();
      press(`p:${e.pointerId}`);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    });

    const onPtrUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      release(`p:${e.pointerId}`);
    };
    el.addEventListener('pointerup', onPtrUp);
    el.addEventListener('pointercancel', onPtrUp);
    el.addEventListener('lostpointercapture', onPtrUp);
  }

  public getInput(isCountdown: boolean): InputState {
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
    const nitro = this.activeHold.nitro.size > 0;
    const drift = this.activeHold.drift.size > 0;

    const hasTouchSteer = this.steerTouchId !== null || this.steerMouseActive;
    const steerAxis = hasTouchSteer
      ? this.touchSteerAxis
      : this.tiltEnabled
        ? this.tiltSteerAxis
        : 0;

    const throttle = isCountdown
      ? manualGas || nitro
      : this.autoThrottle
        ? !brake
        : manualGas;

    return {
      throttle,
      brake,
      left: false,
      right: false,
      drift,
      nitro: isCountdown ? false : nitro,
      steerAxis,
    };
  }

  public updateVisuals(telemetry: RacerHUDTelemetry | null, isCountdown: boolean): void {
    if (!this.enabled) return;

    const showGas = isCountdown || !this.autoThrottle;
    this.gasBtn.classList.toggle('hidden', !showGas);
    const gasLabel = this.gasBtn.querySelector('.tbtn-main');
    if (gasLabel) {
      gasLabel.textContent = isCountdown ? 'REV' : 'GAS';
    }
    this.gasBtn.classList.toggle('rev-pulse', isCountdown);

    if (!telemetry) return;

    const superReady = telemetry.isSuperNitro || telemetry.nitro >= 82;
    const ready = telemetry.nitro >= 14;
    this.nitroBtn.classList.toggle('ready', ready && !superReady);
    this.nitroBtn.classList.toggle('super', superReady);
    const nSub = this.nitroBtn.querySelector('.tbtn-sub');
    if (nSub) {
      nSub.textContent = superReady ? 'SUPER!' : `${Math.round(telemetry.nitro)}%`;
    }

    this.driftBtn.classList.remove('tier-1', 'tier-2', 'tier-3');
    if (telemetry.isDrifting && telemetry.driftTier > 0) {
      this.driftBtn.classList.add(`tier-${telemetry.driftTier}`);
    }
  }
}
