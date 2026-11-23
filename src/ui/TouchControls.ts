import { InputState, RacerHUDTelemetry } from '../types';
import { clamp } from '../utils/math';

interface DeviceOrientationEventIOS extends DeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Mobile-First Multi-Touch + Gyroscope Arcade Controller:
 * - Native TouchEvent (`passive: false`) multi-touch engine for rock-solid iOS Safari / Android Chrome / WeChat support,
 *   plus mouse PointerEvent support so desktop users can also test touch controls.
 * - Proportional slide-steering pad with glowing thumb indicator (tap left/right or glide smoothly).
 * - Optional Gyroscope Tilt Steering (`TILT`) supporting portrait & landscape orientations + iOS permission flow.
 * - Independent multi-touch DRIFT, NITRO, BRAKE, GAS/REV pedals + Auto-Throttle (`AUTO`) + Haptic vibration feedback.
 */
export class TouchControls {
  private readonly container = document.getElementById('touch-controls')!;
  private readonly steerPad = document.getElementById('touch-steer-pad')!;
  private readonly steerLeftZone = document.getElementById('steer-left-vis')!;
  private readonly steerRightZone = document.getElementById('steer-right-vis')!;
  private readonly steerKnob = document.getElementById('steer-knob')!;
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

  // Touch / mouse steering state
  private steerTouchId: number | null = null;
  private steerMouseActive = false;
  private touchSteerAxis = 0; // -1..+1
  private tiltSteerAxis = 0;  // -1..+1

  // Multi-touch active button trackers (keys are 't:<touchId>' or 'm:mouse')
  private readonly activeHold = {
    drift: new Set<string>(),
    nitro: new Set<string>(),
    brake: new Set<string>(),
    gas: new Set<string>(),
  };

  private onToggleChange?: (enabled: boolean) => void;
  private onAnyInteract?: () => void;
  private onStatusMessage?: (msg: string) => void;

  constructor(opts?: {
    onToggleChange?: (enabled: boolean) => void;
    onAnyInteract?: () => void;
    onStatusMessage?: (msg: string) => void;
  }) {
    this.onToggleChange = opts?.onToggleChange;
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

    this.bindSteeringPad();
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
      this.toggleFullscreen();
    });

    // Clear stuck touches if app goes to background or loses focus
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetAllInputs();
    });
    window.addEventListener('blur', () => this.resetAllInputs());

    this.syncAutoGasUI();
    this.syncTiltUI();
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

  public resetAllInputs(): void {
    this.steerTouchId = null;
    this.steerMouseActive = false;
    this.touchSteerAxis = 0;
    this.updateSteerVisuals(0);

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
    this.steerPad.classList.toggle('tilt-active', this.tiltEnabled);
  }

  private async toggleTiltSteering(): Promise<void> {
    if (this.tiltEnabled) {
      this.tiltEnabled = false;
      this.tiltSteerAxis = 0;
      window.removeEventListener('deviceorientation', this.onDeviceOrientation);
      this.syncTiltUI();
      this.onStatusMessage?.('TOUCH STEERING');
      return;
    }

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.onStatusMessage?.('TILT NOT SUPPORTED');
      return;
    }

    // iOS 13+ requires explicit user-gesture permission prompt
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
      // Landscape-left (phone rotated counter-clockwise)
      tiltDeg = e.beta ?? 0;
    } else if (angle === 270 || angle === -90) {
      // Landscape-right (phone rotated clockwise)
      tiltDeg = -(e.beta ?? 0);
    } else {
      // Portrait
      tiltDeg = e.gamma ?? 0;
    }

    // Clean deadzone (±3.5°) + responsive full lock at ±26°
    const deadzone = 3.5;
    if (Math.abs(tiltDeg) < deadzone) {
      this.tiltSteerAxis = 0;
    } else {
      const sign = Math.sign(tiltDeg);
      const norm = clamp((Math.abs(tiltDeg) - deadzone) / 22.5, 0, 1);
      this.tiltSteerAxis = sign * Math.pow(norm, 1.15);
    }

    // Reflect live tilt on steering pad visual indicator if thumb isn't overriding
    if (this.steerTouchId === null && !this.steerMouseActive) {
      this.updateSteerVisuals(this.tiltSteerAxis);
    }
  };

  private toggleFullscreen(): void {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (!isFs) {
        if (root.requestFullscreen) {
          void root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          void root.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          void doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          void doc.webkitExitFullscreen();
        }
      }
    } catch {
      // Ignore if browser disallows fullscreen
    }
  }

  private updateSteerFromClientX(clientX: number): void {
    const rect = this.steerPad.getBoundingClientRect();
    const rel = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1); // 0..1
    const centered = (rel - 0.5) * 2; // -1..+1

    // Small deadzone in exact center, quick snap to strong cornering near edges!
    if (Math.abs(centered) < 0.08) {
      this.touchSteerAxis = 0;
    } else {
      const sign = Math.sign(centered);
      const mag = clamp((Math.abs(centered) - 0.08) / 0.62, 0.35, 1.0);
      this.touchSteerAxis = sign * mag;
    }
    this.updateSteerVisuals(this.touchSteerAxis);
  }

  private updateSteerVisuals(axis: number): void {
    this.steerLeftZone.classList.toggle('active', axis < -0.1);
    this.steerRightZone.classList.toggle('active', axis > 0.1);
    if (this.steerKnob) {
      const pct = 50 + clamp(axis, -1, 1) * 38;
      this.steerKnob.style.left = `${pct.toFixed(1)}%`;
      this.steerKnob.classList.toggle('engaged', Math.abs(axis) > 0.08);
    }
  }

  private bindSteeringPad(): void {
    // 1. Native multi-touch TouchEvents (rock-solid on iOS Safari, Android Chrome, WeChat)
    this.steerPad.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.onAnyInteract?.();
        if (this.steerTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          this.steerTouchId = t.identifier;
          this.updateSteerFromClientX(t.clientX);
        }
      },
      { passive: false }
    );

    this.steerPad.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        if (this.steerTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.steerTouchId) {
            this.updateSteerFromClientX(t.clientX);
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
          this.touchSteerAxis = 0;
          this.updateSteerVisuals(this.tiltEnabled ? this.tiltSteerAxis : 0);
          break;
        }
      }
    };
    this.steerPad.addEventListener('touchend', endTouchSteer, { passive: false });
    this.steerPad.addEventListener('touchcancel', endTouchSteer, { passive: false });

    // 2. Mouse / stylus fallback via PointerEvent (ignored for pointerType === 'touch' to prevent double-firing)
    this.steerPad.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      this.onAnyInteract?.();
      this.steerMouseActive = true;
      try {
        this.steerPad.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }
      this.updateSteerFromClientX(e.clientX);
    });

    this.steerPad.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !this.steerMouseActive) return;
      e.preventDefault();
      this.updateSteerFromClientX(e.clientX);
    });

    const endMouseSteer = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !this.steerMouseActive) return;
      this.steerMouseActive = false;
      this.touchSteerAxis = 0;
      this.updateSteerVisuals(0);
    };
    this.steerPad.addEventListener('pointerup', endMouseSteer);
    this.steerPad.addEventListener('pointercancel', endMouseSteer);
    this.steerPad.addEventListener('lostpointercapture', endMouseSteer);
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

    // Native multi-touch
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

    // Mouse / stylus fallback
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

    // Manual thumb steering overrides gyroscope tilt whenever finger is on the steer pad
    const hasTouchSteer = this.steerTouchId !== null || this.steerMouseActive;
    const steerAxis = hasTouchSteer
      ? this.touchSteerAxis
      : this.tiltEnabled
        ? this.tiltSteerAxis
        : 0;

    // During countdown, holding REV (or NITRO) revs the engine into the Perfect Start green zone.
    // During racing, Auto-Throttle drives forward automatically unless BRAKE is held!
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
