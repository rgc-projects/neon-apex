import { InputState, RacerHUDTelemetry } from '../types';

/**
 * Multi-touch mobile arcade racing controller:
 * - Continuous slide left/right steering pad (left thumb can glide left <-> right smoothly)
 * - Independent multi-touch DRIFT, NITRO, BRAKE, and GAS/REV pedals
 * - Smart Auto-Throttle toggle (ON by default on mobile so steering + drift + nitro feels effortless)
 */
export class TouchControls {
  private readonly container = document.getElementById('touch-controls')!;
  private readonly steerPad = document.getElementById('touch-steer-pad')!;
  private readonly steerLeftZone = document.getElementById('steer-left-vis')!;
  private readonly steerRightZone = document.getElementById('steer-right-vis')!;
  private readonly driftBtn = document.getElementById('touch-drift')!;
  private readonly nitroBtn = document.getElementById('touch-nitro')!;
  private readonly brakeBtn = document.getElementById('touch-brake')!;
  private readonly gasBtn = document.getElementById('touch-gas')!;
  private readonly autoGasBtn = document.getElementById('btn-hud-autogas')!;

  public enabled = false;
  public autoThrottle = true;

  private steerPointerId: number | null = null;
  private steerDir: -1 | 0 | 1 = 0;

  private readonly activePointers = {
    drift: new Set<number>(),
    nitro: new Set<number>(),
    brake: new Set<number>(),
    gas: new Set<number>(),
  };

  private onToggleChange?: (enabled: boolean) => void;
  private onAnyInteract?: () => void;

  constructor(opts?: {
    onToggleChange?: (enabled: boolean) => void;
    onAnyInteract?: () => void;
  }) {
    this.onToggleChange = opts?.onToggleChange;
    this.onAnyInteract = opts?.onAnyInteract;

    // Auto-detect touch-first devices (smartphones / tablets)
    const isCoarse =
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    this.setEnabled(isCoarse);

    // Also auto-enable on first touchstart if a hybrid device receives touch input
    window.addEventListener(
      'touchstart',
      () => {
        if (!this.enabled) {
          this.setEnabled(true);
        }
      },
      { passive: true, once: true }
    );

    this.bindSteeringPad();
    this.bindHoldButton(this.driftBtn, 'drift');
    this.bindHoldButton(this.nitroBtn, 'nitro');
    this.bindHoldButton(this.brakeBtn, 'brake');
    this.bindHoldButton(this.gasBtn, 'gas');

    this.autoGasBtn.addEventListener('click', () => {
      this.onAnyInteract?.();
      this.autoThrottle = !this.autoThrottle;
      this.syncAutoGasUI();
    });

    this.syncAutoGasUI();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    document.body.classList.toggle('touch-mode', enabled);
    this.container.classList.toggle('hidden', !enabled);
    if (!enabled) {
      this.resetAllInputs();
    }
    this.syncAutoGasUI();
    this.onToggleChange?.(enabled);
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public resetAllInputs(): void {
    this.steerPointerId = null;
    this.steerDir = 0;
    this.steerLeftZone.classList.remove('active');
    this.steerRightZone.classList.remove('active');
    this.activePointers.drift.clear();
    this.activePointers.nitro.clear();
    this.activePointers.brake.clear();
    this.activePointers.gas.clear();
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

  private bindSteeringPad(): void {
    const updateSteerFromClientX = (clientX: number) => {
      const rect = this.steerPad.getBoundingClientRect();
      const rel = (clientX - rect.left) / Math.max(rect.width, 1); // 0..1
      // Generous left/right halves with tiny deadband right in the middle
      if (rel < 0.46) {
        this.steerDir = -1;
      } else if (rel > 0.54) {
        this.steerDir = 1;
      } else {
        this.steerDir = 0;
      }
      this.steerLeftZone.classList.toggle('active', this.steerDir === -1);
      this.steerRightZone.classList.toggle('active', this.steerDir === 1);
    };

    this.steerPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyInteract?.();
      this.steerPointerId = e.pointerId;
      try {
        this.steerPad.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture errors on synthetic events
      }
      updateSteerFromClientX(e.clientX);
    });

    this.steerPad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.steerPointerId) return;
      e.preventDefault();
      updateSteerFromClientX(e.clientX);
    });

    const releaseSteer = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointerId) return;
      this.steerPointerId = null;
      this.steerDir = 0;
      this.steerLeftZone.classList.remove('active');
      this.steerRightZone.classList.remove('active');
    };

    this.steerPad.addEventListener('pointerup', releaseSteer);
    this.steerPad.addEventListener('pointercancel', releaseSteer);
    this.steerPad.addEventListener('lostpointercapture', releaseSteer);
  }

  private bindHoldButton(
    el: HTMLElement,
    key: 'drift' | 'nitro' | 'brake' | 'gas'
  ): void {
    const set = this.activePointers[key];

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyInteract?.();
      set.add(e.pointerId);
      el.classList.add('pressed');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events
      }
    });

    const release = (e: PointerEvent) => {
      set.delete(e.pointerId);
      if (set.size === 0) {
        el.classList.remove('pressed');
      }
    };

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
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
      };
    }

    const brake = this.activePointers.brake.size > 0;
    const manualGas = this.activePointers.gas.size > 0;
    const nitro = this.activePointers.nitro.size > 0;
    const drift = this.activePointers.drift.size > 0;

    // During countdown, pressing GAS/REV (or NITRO) revs engine for Perfect Start.
    // During racing, autoThrottle accelerates automatically unless braking!
    const throttle = isCountdown
      ? manualGas || nitro
      : this.autoThrottle
        ? !brake
        : manualGas;

    return {
      throttle,
      brake,
      left: this.steerDir === -1,
      right: this.steerDir === 1,
      drift,
      nitro: isCountdown ? false : nitro,
    };
  }

  public updateVisuals(telemetry: RacerHUDTelemetry | null, isCountdown: boolean): void {
    if (!this.enabled) return;

    // Show GAS/REV prominently during countdown (for Perfect Start!) or when Auto-Throttle is OFF
    const showGas = isCountdown || !this.autoThrottle;
    this.gasBtn.classList.toggle('hidden', !showGas);
    const gasLabel = this.gasBtn.querySelector('.tbtn-main');
    if (gasLabel) {
      gasLabel.textContent = isCountdown ? 'REV' : 'GAS';
    }
    this.gasBtn.classList.toggle('rev-pulse', isCountdown);

    if (!telemetry) return;

    // Dynamic Nitro button state glow
    const superReady = telemetry.isSuperNitro || telemetry.nitro >= 82;
    const ready = telemetry.nitro >= 14;
    this.nitroBtn.classList.toggle('ready', ready && !superReady);
    this.nitroBtn.classList.toggle('super', superReady);
    const nSub = this.nitroBtn.querySelector('.tbtn-sub');
    if (nSub) {
      nSub.textContent = superReady ? 'SUPER!' : `${Math.round(telemetry.nitro)}%`;
    }

    // Dynamic Drift button glow matching drift charge tier
    this.driftBtn.classList.remove('tier-1', 'tier-2', 'tier-3');
    if (telemetry.isDrifting && telemetry.driftTier > 0) {
      this.driftBtn.classList.add(`tier-${telemetry.driftTier}`);
    }
  }
}
