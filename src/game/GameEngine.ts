import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

import { AI_PROFILES, CAR_SPECS } from '../config/cars';
import { TRACK_CONFIGS } from '../config/tracks';
import { GameState, InputState, RaceResults, RacerStanding } from '../types';
import { TrackSpline } from '../track/TrackSpline';
import { buildTrackMesh, TrackBuildResult } from '../track/TrackBuilder';
import { buildScenery, SceneryBuildResult } from '../track/SceneryBuilder';
import { DestructibleProps } from '../vfx/DestructibleProps';
import { ParticleSystem } from '../vfx/ParticleSystem';
import { SkidMarkSystem } from '../vfx/SkidMarkSystem';
import { SpeedLinesOverlay } from '../vfx/SpeedLinesOverlay';
import { CarModel } from '../vehicle/CarModel';
import { supercarAssets } from '../vehicle/SupercarLoader';
import { PhysicsEvents, RacerPhysics, resolveMultiCarInteractions } from '../vehicle/CarPhysics';
import { AIDriver } from '../ai/AIDriver';
import { CameraController } from '../camera/CameraController';
import { AudioEngine } from '../audio/AudioEngine';
import { HUD } from '../ui/HUD';
import { MenuUI } from '../ui/MenuUI';
import { ResultsUI } from '../ui/ResultsUI';
import { SettingsUI } from '../ui/SettingsUI';
import { TouchControls } from '../ui/TouchControls';
import { i18n, t } from '../i18n/i18n';
import { nativeBridge } from '../platform/NativeBridge';
import { recordsManager } from '../records/RecordsManager';
import {
  drawDistanceToFar,
  GraphicsSettings,
  isMobileDevice,
  settingsManager,
} from '../settings/SettingsManager';
import { clamp, damp } from '../utils/math';
import { createProceduralEnvMap } from '../utils/textures';

export class GameEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private useDirectRender = false;
  private lastPipelineKey = '';

  private readonly scene = new THREE.Scene();
  private readonly cameraController: CameraController;

  private readonly audio = new AudioEngine();
  private readonly speedLines: SpeedLinesOverlay;
  private readonly hud = new HUD();
  private readonly menuUI: MenuUI;
  private readonly settingsUI: SettingsUI;
  private readonly resultsUI: ResultsUI;
  private readonly touchControls: TouchControls;
  private readonly pauseOverlay = document.getElementById('pause-overlay')!;
  private readonly pauseSettingsBtn = document.getElementById('btn-pause-settings')!;
  private readonly pauseDriftNitroBtn = document.getElementById('btn-pause-drift-nitro')!;
  private readonly pauseOverdriveBtn = document.getElementById('btn-pause-overdrive')!;
  private readonly pauseHyperNitroBtn = document.getElementById('btn-pause-hyper-nitro')!;
  private readonly bootSplashEl = document.getElementById('boot-splash');
  private readonly webglLostEl = document.getElementById('webgl-lost-overlay');
  private readonly webglReloadBtn = document.getElementById('btn-webgl-reload');

  private contextLost = false;
  private gpPrevPause = false;
  private gpPrevCam = false;
  private gpNotified = false;

  // FPS cap & telemetry monitor
  private lastRenderAt = performance.now();
  private fpsFrames = 0;
  private fpsAccumMs = 0;
  private fpsWindowStart = performance.now();

  private state: GameState = 'MENU';
  private selectedCarIndex = 0;
  private selectedTrackIndex = 0;
  private selectedLaps = TRACK_CONFIGS[0].laps;
  private allowDriftNitro = false; // Default OFF: Nitro is disabled while actively drifting
  private enableStraightOverdrive = false; // Default OFF: opt-in straightaway 2-stage overdrive on mega islands
  private enableHyperNitro = false; // Default OFF: opt-in infinite nitro on mega island straightaways

  // Active Track World Objects
  private spline!: TrackSpline;
  private trackBuild: TrackBuildResult | null = null;
  private sceneryBuild: SceneryBuildResult | null = null;
  private destructibles: DestructibleProps | null = null;
  private readonly particles = new ParticleSystem();
  private readonly skidMarks = new SkidMarkSystem();

  // Menu Showroom Objects
  private readonly showcaseGroup = new THREE.Group();
  private showcaseCar: CarModel | null = null;
  private showcaseOrigin = new THREE.Vector3();
  private showcaseRingMesh: THREE.Mesh | null = null;

  // Dynamic Realistic World Lighting
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly dirKeyLight: THREE.DirectionalLight;
  private readonly dirRimLight: THREE.DirectionalLight;
  private baseExposure = 1.24;

  // Race Entities
  private racers: RacerPhysics[] = [];
  private aiDrivers: Map<string, AIDriver> = new Map();
  private playerRacer: RacerPhysics | null = null;

  // Timers & Countdown
  private countdownTimer = 0;
  private lastCountdownStage = -1;
  private startRevRpm = 0.18;
  private finishSlowMoTimer = 0;
  private elapsed = 0;
  private lastTime = performance.now();
  private animFrameId = 0;

  // Reusable scratch vectors (zero per-frame GC)
  private readonly _wheelL = new THREE.Vector3();
  private readonly _wheelR = new THREE.Vector3();
  private readonly _exL = new THREE.Vector3();
  private readonly _exR = new THREE.Vector3();

  // Keyboard Input
  private readonly keys = new Set<string>();
  private readonly input: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  };

  constructor() {
    nativeBridge.init();
    i18n.applyDomTranslations();

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const speedCanvas = document.getElementById('speedlines-canvas') as HTMLCanvasElement;

    const initW = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const initH = Math.round(window.visualViewport?.height ?? window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.debug.checkShaderErrors = !import.meta.env.PROD;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.baseExposure;

    // Production WebGL context loss & automatic GPU recovery
    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.contextLost = true;
        this.keys.clear();
        this.touchControls?.resetAllInputs();
        this.audio.suspend();
        if (this.state === 'RACING') {
          this.togglePause();
        }
        this.webglLostEl?.classList.remove('hidden');
      },
      false
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.contextLost = false;
        this.webglLostEl?.classList.add('hidden');
        this.scene.environment = createProceduralEnvMap(this.renderer);
        this.applyGraphicsSettings(settingsManager.settings.graphics, true);
        this.precompileScene();
        this.lastTime = performance.now();
        this.audio.resumeIfAllowed();
      },
      false
    );
    this.webglReloadBtn?.addEventListener('click', () => {
      window.location.reload();
    });

    this.cameraController = new CameraController(initW / Math.max(initH, 1));

    // Procedural Realistic Twilight + Streetlamp HDR Reflection Probe
    this.scene.environment = createProceduralEnvMap(this.renderer);
    this.scene.environmentIntensity = 1.0;

    // Three-Point Photorealistic Atmospheric Lighting (adapted per track theme in loadTrack)
    this.hemiLight = new THREE.HemisphereLight(0xa4c6ee, 0x2c3648, 1.48);
    this.dirKeyLight = new THREE.DirectionalLight(0xffe0bc, 2.05);
    this.dirKeyLight.position.set(140, 185, 120);
    this.dirRimLight = new THREE.DirectionalLight(0x98c9fd, 0.72);
    this.dirRimLight.position.set(-140, 175, -85);
    this.scene.add(this.hemiLight, this.dirKeyLight, this.dirRimLight);

    this.scene.add(this.particles.group, this.skidMarks.mesh, this.showcaseGroup);
    this.buildShowcasePedestal();

    // Begin decoding all locally bundled vehicle GLBs offline on startup
    supercarAssets.preloadAll(CAR_SPECS.map((c) => c.modelFile));

    this.speedLines = new SpeedLinesOverlay(speedCanvas);

    // Build initial dynamic graphics pipeline & apply saved settings
    this.applyGraphicsSettings(settingsManager.settings.graphics, true);
    this.applyAudioSettings();

    this.touchControls = new TouchControls({
      onAnyInteract: () => this.audio.unlock(),
      onToggleChange: (enabled) => {
        this.hud.setTouchLabel(enabled);
        this.menuUI?.setTouchEnabled(enabled);
        this.cameraController.setMobileMode(enabled);
      },
      onFullscreenChange: (isFs) => {
        this.menuUI?.setFullscreen(isFs);
      },
      onStatusMessage: (msg) => {
        this.hud.pushCallout(msg, 'cyan');
      },
    });
    this.cameraController.setMobileMode(this.touchControls.enabled);
    this.cameraController.setMode(settingsManager.settings.controls.defaultCamera);

    // Restore saved preferences (all 3 default to false!)
    try {
      this.allowDriftNitro = localStorage.getItem('neon_apex_allow_drift_nitro') === 'true';
      this.enableStraightOverdrive = localStorage.getItem('neon_apex_enable_straight_overdrive') === 'true';
      this.enableHyperNitro = localStorage.getItem('neon_apex_enable_hyper_nitro') === 'true';
    } catch {
      this.allowDriftNitro = false;
      this.enableStraightOverdrive = false;
      this.enableHyperNitro = false;
    }

    // Unified Settings Hub (Graphics / Controls / Audio / Language)
    this.settingsUI = new SettingsUI({
      onAnyInteract: () => this.audio.unlock(),
      onTouchEnabledChange: (enabled) => {
        this.touchControls.setEnabled(enabled);
      },
      getTouchEnabled: () => this.touchControls.enabled,
      onMuteToggle: (muted) => {
        this.audio.setMuted(muted);
        this.hud.setMutedLabel(muted);
        this.menuUI.setMuted(muted);
      },
      getMuted: () => this.audio.muted,
      onNotify: (msg) => this.hud.pushCallout(msg, 'cyan'),
    });

    // React live whenever any setting changes in SettingsUI or quick toggles
    settingsManager.subscribe((s, section) => {
      if (section === 'graphics' || section === 'all') {
        this.applyGraphicsSettings(s.graphics, false);
      }
      if (section === 'controls' || section === 'all') {
        this.touchControls.applySettings(s.controls, false);
        this.cameraController.setMode(s.controls.defaultCamera);
        this.hud.setCameraLabel(this.cameraController.mode);
      }
      if (section === 'audio' || section === 'all') {
        this.applyAudioSettings();
      }
    });

    // React live when language toggles
    i18n.subscribe(() => {
      this.syncPauseDriftNitroLabel();
      this.syncPauseOverdriveLabel();
      this.syncPauseHyperNitroLabel();
    });

    // Wire UI
    this.menuUI = new MenuUI({
      onSelectCar: (idx) => {
        this.audio.unlock();
        this.selectedCarIndex = idx;
        this.rebuildShowcaseCar();
      },
      onSelectTrack: (idx) => {
        this.audio.unlock();
        this.selectedTrackIndex = idx;
        this.selectedLaps = TRACK_CONFIGS[idx].laps;
        this.loadTrack(idx);
        this.positionShowcaseOnTrack();
      },
      onSelectLaps: (laps) => {
        this.audio.unlock();
        this.selectedLaps = clamp(Math.round(laps), 1, 3);
      },
      onStartRace: () => {
        this.audio.unlock();
        this.startRace();
      },
      onToggleAudio: () => {
        this.audio.unlock();
        const muted = this.audio.toggleMute();
        this.hud.setMutedLabel(muted);
        return muted;
      },
      onToggleTouch: () => {
        this.audio.unlock();
        return this.touchControls.toggle();
      },
      onToggleFullscreen: () => {
        this.audio.unlock();
        void this.touchControls.toggleFullscreen();
      },
      onToggleDriftNitro: () => {
        this.audio.unlock();
        return this.toggleDriftNitro();
      },
      onToggleOverdrive: () => {
        this.audio.unlock();
        return this.toggleStraightOverdrive();
      },
      onToggleHyperNitro: () => {
        this.audio.unlock();
        return this.toggleHyperNitro();
      },
      onOpenSettings: () => {
        this.audio.unlock();
        this.settingsUI.open('graphics');
      },
      onToggleLang: () => {
        this.audio.unlock();
        i18n.toggleLang();
      },
    });
    this.menuUI.setTouchEnabled(this.touchControls.enabled);
    this.menuUI.setFullscreen(this.touchControls.isFullscreen());
    this.menuUI.setDriftNitroEnabled(this.allowDriftNitro);
    this.menuUI.setOverdriveEnabled(this.enableStraightOverdrive);
    this.menuUI.setHyperNitroEnabled(this.enableHyperNitro);
    this.syncPauseDriftNitroLabel();
    this.syncPauseOverdriveLabel();
    this.syncPauseHyperNitroLabel();
    this.hud.setTouchLabel(this.touchControls.enabled);
    this.hud.setHyperZonesVisible(this.enableHyperNitro);

    this.resultsUI = new ResultsUI({
      onRaceAgain: () => {
        this.audio.unlock();
        this.startRace();
      },
      onNextTrack: () => {
        this.audio.unlock();
        const nextIdx = (this.selectedTrackIndex + 1) % TRACK_CONFIGS.length;
        this.selectedTrackIndex = nextIdx;
        this.selectedLaps = TRACK_CONFIGS[nextIdx].laps;
        this.loadTrack(nextIdx);
        this.menuUI.selectTrackExternal(nextIdx);
        this.enterMenu();
      },
      onBackToMenu: () => {
        this.audio.unlock();
        this.enterMenu();
      },
    });

    // HUD & Pause buttons
    this.hud.camBtn.addEventListener('click', () => {
      const m = this.cameraController.toggleMode();
      this.hud.setCameraLabel(m);
    });
    this.hud.audioBtn.addEventListener('click', () => {
      this.audio.unlock();
      const muted = this.audio.toggleMute();
      this.hud.setMutedLabel(muted);
      this.menuUI.setMuted(muted);
    });
    this.hud.pauseBtn.addEventListener('click', () => this.togglePause());
    this.hud.touchBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.touchControls.toggle();
    });
    this.hud.resetBtn.addEventListener('click', () => {
      this.audio.unlock();
      if (this.state === 'RACING' && this.playerRacer) {
        this.playerRacer.resetToTrack(this.spline);
        this.hud.pushCallout(t('msgTrackReset'), 'cyan');
      }
    });

    document.getElementById('btn-resume')!.addEventListener('click', () => this.togglePause());
    this.pauseSettingsBtn.addEventListener('click', () => {
      this.audio.unlock();
      this.settingsUI.open('graphics');
    });
    this.pauseDriftNitroBtn.addEventListener('click', () => {
      this.audio.unlock();
      const enabled = this.toggleDriftNitro();
      this.menuUI.setDriftNitroEnabled(enabled);
    });
    this.pauseOverdriveBtn.addEventListener('click', () => {
      this.audio.unlock();
      const enabled = this.toggleStraightOverdrive();
      this.menuUI.setOverdriveEnabled(enabled);
    });
    this.pauseHyperNitroBtn.addEventListener('click', () => {
      this.audio.unlock();
      const enabled = this.toggleHyperNitro();
      this.menuUI.setHyperNitroEnabled(enabled);
    });
    document.getElementById('btn-pause-restart')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.startRace();
    });
    document.getElementById('btn-pause-menu')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.enterMenu();
    });

    // Native Android Back button & Web/Native background auto-pause + audio suspend hooks
    nativeBridge.onBackButton(() => this.handleBackAction());
    nativeBridge.onAppBackground(() => {
      this.handleVisibilityPause();
    });
    nativeBridge.onAppForeground(() => {
      this.lastTime = performance.now();
      this.audio.resumeIfAllowed();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleVisibilityPause();
      } else {
        this.lastTime = performance.now();
        this.audio.resumeIfAllowed();
      }
    });

    this.bindInputs();
    this.bindMenuShowroomDrag(canvas);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    document.addEventListener('fullscreenchange', this.onResize);
    document.addEventListener('webkitfullscreenchange', this.onResize);

    // Initial load: Track 0 + Showcase Car 0
    this.loadTrack(0);
    this.rebuildShowcaseCar();
    this.enterMenu();
    this.precompileScene();

    // Smoothly dismiss initial boot splash curtain after first frame setup
    if (this.bootSplashEl) {
      requestAnimationFrame(() => {
        this.bootSplashEl?.classList.add('fade-out');
        setTimeout(() => this.bootSplashEl?.remove(), 420);
      });
    }

    this.lastTime = performance.now();
    this.lastRenderAt = this.lastTime;
    this.fpsWindowStart = this.lastTime;
    this.loop(this.lastTime);
  }

  private handleBackAction(): boolean {
    if (this.settingsUI.isOpen()) {
      this.settingsUI.close();
      return true;
    }
    if (this.state === 'MENU') {
      return this.menuUI.closeOpenModal();
    }
    if (this.state === 'RACING' || this.state === 'PAUSED') {
      this.togglePause();
      return true;
    }
    if (this.state === 'RESULTS') {
      this.enterMenu();
      return true;
    }
    return false;
  }

  private computeEffectiveDpr(resScale: number): number {
    const rawDpr = window.devicePixelRatio || 1;
    if (resScale <= 0.78) return Math.min(rawDpr, 1.0) * 0.75;
    if (resScale <= 0.9) return Math.min(rawDpr, 1.0) * 0.85;
    if (resScale <= 1.05) return Math.min(rawDpr, 1.25);
    if (resScale <= 1.3) return Math.min(rawDpr, 1.6);
    return Math.min(rawDpr, 2.0);
  }

  private applyAudioSettings(): void {
    const a = settingsManager.settings.audio;
    this.audio.setVolumes(a.masterVolume, a.sfxVolume, a.musicVolume);
  }

  private syncExposure(): void {
    const userBrightness = clamp(settingsManager.settings.graphics.brightness ?? 1.0, 0.8, 1.4);
    this.renderer.toneMappingExposure = this.baseExposure * userBrightness;
  }

  private applyGraphicsSettings(g: GraphicsSettings, forceRebuild: boolean): void {
    const w = Math.max(1, Math.round(window.visualViewport?.width ?? window.innerWidth));
    const h = Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight));
    const dpr = this.computeEffectiveDpr(g.resolutionScale);
    const mobile = isMobileDevice();

    this.syncExposure();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.cameraController.setAspect(w / Math.max(h, 1));
    this.cameraController.setDrawDistance(drawDistanceToFar(g.drawDistance));
    this.particles.setQuality(g.particles);
    this.speedLines.setQuality(g.particles);
    this.speedLines.resize(w, h);

    if (!g.showFps) {
      this.hud.updateFps(60, 16.6, false);
    }

    const useDirect = g.antiAliasing === 'off' && g.bloom === 'off';
    const pipelineKey = `${useDirect ? 'direct' : 'comp'}:${g.antiAliasing}:${g.bloom}`;

    if (forceRebuild || pipelineKey !== this.lastPipelineKey) {
      this.lastPipelineKey = pipelineKey;
      this.useDirectRender = useDirect;

      if (this.composer) {
        this.composer.dispose();
        this.composer = null;
      }
      if (this.renderTarget) {
        this.renderTarget.dispose();
        this.renderTarget = null;
      }
      this.bloomPass = null;
      this.smaaPass = null;

      if (!useDirect) {
        const maxSamples = this.renderer.capabilities.maxSamples || 0;
        const targetSamples =
          g.antiAliasing === 'msaa4_smaa' ? 4 : g.antiAliasing === 'msaa2' ? 2 : 0;
        const msaaSamples = this.renderer.capabilities.isWebGL2
          ? Math.min(maxSamples, targetSamples)
          : 0;

        this.renderTarget = new THREE.WebGLRenderTarget(
          Math.max(1, Math.floor(w * dpr)),
          Math.max(1, Math.floor(h * dpr)),
          {
            type: THREE.HalfFloatType,
            samples: msaaSamples,
          }
        );

        this.composer = new EffectComposer(this.renderer, this.renderTarget);
        this.composer.setPixelRatio(dpr);
        this.composer.setSize(w, h);
        this.composer.addPass(new RenderPass(this.scene, this.cameraController.camera));

        if (g.bloom !== 'off') {
          const bloomScale = g.bloom === 'soft' ? 0.5 : mobile ? 0.65 : 1.0;
          const strength = g.bloom === 'soft' ? 0.2 : 0.26;
          const radius = g.bloom === 'soft' ? 0.28 : 0.34;
          const threshold = g.bloom === 'soft' ? 0.92 : 0.9;
          this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(Math.max(1, Math.floor(w * bloomScale)), Math.max(1, Math.floor(h * bloomScale))),
            strength,
            radius,
            threshold
          );
          this.composer.addPass(this.bloomPass);
        }

        this.composer.addPass(new OutputPass());

        if (g.antiAliasing === 'smaa' || g.antiAliasing === 'msaa4_smaa') {
          this.smaaPass = new SMAAPass(Math.max(1, Math.floor(w * dpr)), Math.max(1, Math.floor(h * dpr)));
          this.composer.addPass(this.smaaPass);
        }
      }
    } else if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
      if (this.bloomPass) {
        const bloomScale = g.bloom === 'soft' ? 0.5 : mobile ? 0.65 : 1.0;
        this.bloomPass.setSize(
          Math.max(1, Math.floor(w * bloomScale)),
          Math.max(1, Math.floor(h * bloomScale))
        );
      }
    }
  }

  private handleVisibilityPause(): void {
    this.keys.clear();
    this.touchControls.resetAllInputs();
    this.audio.suspend();
    if (this.state === 'RACING') {
      this.togglePause();
    }
  }

  private precompileScene(): void {
    if (this.contextLost) return;
    try {
      this.renderer.compile(this.scene, this.cameraController.camera);
    } catch {
      // Ignore compile failures on restricted drivers
    }
  }

  private renderScene(): void {
    if (this.contextLost) return;
    if (this.useDirectRender || !this.composer) {
      this.renderer.render(this.scene, this.cameraController.camera);
    } else {
      this.composer.render();
    }
  }

  private buildShowcasePedestal(): void {
    // Modern GT automotive studio turntable: dark honed basalt platform + brushed aluminum chamfer
    const discGeo = new THREE.CylinderGeometry(3.48, 3.82, 0.24, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      metalness: 0.45,
      roughness: 0.36,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.12;

    const bevelGeo = new THREE.TorusGeometry(3.52, 0.055, 12, 56);
    bevelGeo.rotateX(Math.PI / 2);
    const bevelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.22,
    });
    const bevel = new THREE.Mesh(bevelGeo, bevelMat);
    bevel.position.y = 0.24;

    // Subtle thin warm-white recessed turntable rim LED (understated GT7 showroom style)
    const ringGeo = new THREE.TorusGeometry(3.42, 0.02, 8, 56);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xe2e8f0).multiplyScalar(1.1),
      toneMapped: false,
    });
    this.showcaseRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.showcaseRingMesh.position.y = 0.255;

    const studioKey = new THREE.PointLight(0xfff4e6, 4.2, 20, 1.4);
    studioKey.position.set(2.4, 5.2, 2.8);
    const studioRim = new THREE.PointLight(0xbfdbfe, 2.8, 18, 1.5);
    studioRim.position.set(-3.2, 3.4, -3.5);

    this.showcaseGroup.add(disc, bevel, this.showcaseRingMesh, studioKey, studioRim);
  }

  private rebuildShowcaseCar(): void {
    if (this.showcaseCar) {
      this.showcaseGroup.remove(this.showcaseCar.root);
      this.showcaseCar.dispose();
    }
    const spec = CAR_SPECS[this.selectedCarIndex];
    this.showcaseCar = new CarModel(spec, undefined, undefined, true);
    this.showcaseCar.root.position.set(0, 0.24, 0);
    this.showcaseGroup.add(this.showcaseCar.root);

    if (this.showcaseRingMesh) {
      const mat = this.showcaseRingMesh.material as THREE.MeshBasicMaterial;
      mat.color.setHex(spec.neonColor).lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(1.08);
    }
  }

  private positionShowcaseOnTrack(): void {
    const f = this.spline.getFrameAtDistance(16);
    this.showcaseOrigin.copy(f.pos).addScaledVector(f.up, 0.05);
    this.showcaseGroup.position.copy(this.showcaseOrigin);
    const basis = new THREE.Matrix4().makeBasis(f.right, f.up, f.tangent.clone().negate());
    this.showcaseGroup.quaternion.setFromRotationMatrix(basis);
  }

  private loadTrack(trackIndex: number): void {
    // Cleanup previous track
    if (this.trackBuild) {
      this.scene.remove(this.trackBuild.group);
      this.trackBuild.dispose();
    }
    if (this.sceneryBuild) {
      this.scene.remove(this.sceneryBuild.group);
      this.sceneryBuild.dispose();
    }
    if (this.destructibles) {
      this.scene.remove(this.destructibles.group);
      this.destructibles.dispose();
    }

    const cfg = TRACK_CONFIGS[trackIndex];
    this.spline = new TrackSpline(cfg);
    this.scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);

    // Tailor realistic atmospheric sunlight & ambient sky bounce to each circuit's time-of-day
    if (cfg.theme === 'bridge') {
      // Golden-hour ocean sunset
      this.hemiLight.color.setHex(0xffd6ad);
      this.hemiLight.groundColor.setHex(0x344359);
      this.hemiLight.intensity = 1.52;
      this.dirKeyLight.color.setHex(0xffbc78);
      this.dirKeyLight.intensity = 2.3;
      this.dirKeyLight.position.set(220, 125, 160);
      this.dirRimLight.color.setHex(0x98c9fd);
      this.dirRimLight.intensity = 0.68;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.21;
    } else if (cfg.theme === 'island') {
      // Pacific twilight-sunset grand coastal island lighting
      this.hemiLight.color.setHex(0xffd3aa);
      this.hemiLight.groundColor.setHex(0x2c4458);
      this.hemiLight.intensity = 1.54;
      this.dirKeyLight.color.setHex(0xffc280);
      this.dirKeyLight.intensity = 2.26;
      this.dirKeyLight.position.set(260, 140, 180);
      this.dirRimLight.color.setHex(0x82d8fc);
      this.dirRimLight.intensity = 0.72;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.21;
    } else if (cfg.theme === 'manx') {
      // Crisp late-afternoon Irish Sea golden Atlantic break over emerald Manx hills
      this.hemiLight.color.setHex(0xc0daf4);
      this.hemiLight.groundColor.setHex(0x304a33);
      this.hemiLight.intensity = 1.62;
      this.dirKeyLight.color.setHex(0xffe2aa);
      this.dirKeyLight.intensity = 2.24;
      this.dirKeyLight.position.set(-220, 165, 190);
      this.dirRimLight.color.setHex(0x98c9fd);
      this.dirRimLight.intensity = 0.7;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.21;
    } else if (cfg.theme === 'nujiang') {
      // Crisp high-altitude Tibetan Plateau cobalt-sky sunlight over warm ochre Hengduan cliffs
      this.hemiLight.color.setHex(0xc4e4ff);
      this.hemiLight.groundColor.setHex(0x583e2b);
      this.hemiLight.intensity = 1.62;
      this.dirKeyLight.color.setHex(0xffe8be);
      this.dirKeyLight.intensity = 2.38;
      this.dirKeyLight.position.set(-210, 260, 160);
      this.dirRimLight.color.setHex(0x98c9fd);
      this.dirRimLight.intensity = 0.75;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.19;
    } else if (cfg.theme === 'fjord') {
      // Nordic Arctic aurora twilight: cool emerald-cyan zenith + icy blue moonlight rim over dark basalt cliffs
      this.hemiLight.color.setHex(0x88ece4);
      this.hemiLight.groundColor.setHex(0x23364f);
      this.hemiLight.intensity = 1.58;
      this.dirKeyLight.color.setHex(0xd0ebff);
      this.dirKeyLight.intensity = 2.15;
      this.dirKeyLight.position.set(-180, 220, -240);
      this.dirRimLight.color.setHex(0x66eed9);
      this.dirRimLight.intensity = 0.82;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.25;
    } else if (cfg.theme === 'akina') {
      // Authentic Akina Mountain Pass nocturnal alpine lighting (deep dark gorge + readable tarmac & headlights)
      this.hemiLight.color.setHex(0xb0ccec);
      this.hemiLight.groundColor.setHex(0x293832);
      this.hemiLight.intensity = 1.52;
      this.dirKeyLight.color.setHex(0xffd8aa);
      this.dirKeyLight.intensity = 2.08;
      this.dirKeyLight.position.set(180, 160, 140);
      this.dirRimLight.color.setHex(0x9bc0ee);
      this.dirRimLight.intensity = 0.72;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.26;
    } else if (cfg.theme === 'tunnel') {
      // Modern illuminated sub-surface expressway tunnel
      this.hemiLight.color.setHex(0xd6e0ec);
      this.hemiLight.groundColor.setHex(0x353f50);
      this.hemiLight.intensity = 1.52;
      this.dirKeyLight.color.setHex(0xfff4cf);
      this.dirKeyLight.intensity = 1.82;
      this.dirKeyLight.position.set(80, 200, 90);
      this.dirRimLight.color.setHex(0xbfe8ff);
      this.dirRimLight.intensity = 0.78;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.27;
    } else if (cfg.theme === 'mountain') {
      // Crisp Japanese alpine dusk pass
      this.hemiLight.color.setHex(0xb0ccec);
      this.hemiLight.groundColor.setHex(0x2c3c35);
      this.hemiLight.intensity = 1.52;
      this.dirKeyLight.color.setHex(0xffd8aa);
      this.dirKeyLight.intensity = 2.06;
      this.dirKeyLight.position.set(160, 155, 130);
      this.dirRimLight.color.setHex(0x9bc0ee);
      this.dirRimLight.intensity = 0.7;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.25;
    } else {
      // Tokyo Bayshore twilight-to-night expressway
      this.hemiLight.color.setHex(0xa4c6ee);
      this.hemiLight.groundColor.setHex(0x2c3648);
      this.hemiLight.intensity = 1.48;
      this.dirKeyLight.color.setHex(0xffe0bc);
      this.dirKeyLight.intensity = 2.05;
      this.dirKeyLight.position.set(140, 185, 120);
      this.dirRimLight.color.setHex(0x98c9fd);
      this.dirRimLight.intensity = 0.72;
      this.scene.environmentIntensity = 1.0;
      this.baseExposure = 1.24;
    }
    this.syncExposure();

    this.trackBuild = buildTrackMesh(this.spline);
    this.trackBuild.setHyperZonesVisible(this.enableHyperNitro);
    this.sceneryBuild = buildScenery(this.spline);
    this.destructibles = new DestructibleProps(this.spline);

    this.scene.add(this.trackBuild.group, this.sceneryBuild.group, this.destructibles.group);
    this.hud.configureTrack(this.spline);
    this.hud.setHyperZonesVisible(this.enableHyperNitro);
    this.positionShowcaseOnTrack();
    this.precompileScene();
  }

  private clearRacers(): void {
    for (const r of this.racers) {
      this.scene.remove(r.model.root);
      r.model.dispose();
    }
    this.racers = [];
    this.aiDrivers.clear();
    this.playerRacer = null;
  }

  private enterMenu(): void {
    this.state = 'MENU';
    document.body.classList.remove('in-race');
    this.clearRacers();
    this.particles.clear();
    this.skidMarks.clear();
    this.trackBuild?.setCountdownState(0);
    this.showcaseGroup.visible = true;
    this.positionShowcaseOnTrack();
    this.menuUI.setVisible(true);
    this.hud.setVisible(false);
    this.hud.showCountdown(null);
    this.resultsUI.setVisible(false);
    this.pauseOverlay.classList.add('hidden');
    this.touchControls.resetAllInputs();
    this.audio.setEngineActive(false, false);
  }

  private startRace(): void {
    document.body.classList.add('in-race');
    this.clearRacers();
    this.particles.clear();
    this.skidMarks.clear();
    this.destructibles?.resetAll();
    this.showcaseGroup.visible = false;

    const raceLaps = this.selectedLaps || TRACK_CONFIGS[this.selectedTrackIndex].laps;
    const playerSpec = CAR_SPECS[this.selectedCarIndex];

    // Spawn 5 AI Racers + 1 Player = 6-car Grid (Player starts in P4 for instant action!)
    const gridOrder: { isPlayer: boolean; aiIndex?: number }[] = [
      { isPlayer: false, aiIndex: 0 },
      { isPlayer: false, aiIndex: 1 },
      { isPlayer: false, aiIndex: 2 },
      { isPlayer: true },
      { isPlayer: false, aiIndex: 3 },
      { isPlayer: false, aiIndex: 4 },
    ];

    gridOrder.forEach((slot, gridIdx) => {
      if (slot.isPlayer) {
        const model = new CarModel(playerSpec, undefined, undefined, true);
        this.scene.add(model.root);
        const racer = new RacerPhysics({
          id: 'player',
          name: 'PLAYER',
          spec: playerSpec,
          model,
          isPlayer: true,
          colorHex: playerSpec.neonHex,
          totalLaps: raceLaps,
        });
        racer.allowDriftNitro = this.allowDriftNitro;
        racer.enableStraightOverdrive = this.enableStraightOverdrive;
        racer.enableHyperNitro = this.enableHyperNitro;
        racer.placeOnGrid(this.spline, gridIdx);
        this.racers.push(racer);
        this.playerRacer = racer;
      } else {
        const prof = AI_PROFILES[slot.aiIndex!];
        const aiSpec = CAR_SPECS[prof.carSpecIndex];
        const model = new CarModel(aiSpec, prof.overridePrimary, prof.overrideNeon, false);
        this.scene.add(model.root);
        const racer = new RacerPhysics({
          id: `ai-${slot.aiIndex}`,
          name: prof.name,
          spec: aiSpec,
          model,
          isPlayer: false,
          colorHex: prof.overrideNeonHex,
          totalLaps: raceLaps,
        });
        racer.allowDriftNitro = this.allowDriftNitro;
        racer.enableStraightOverdrive = this.enableStraightOverdrive;
        racer.enableHyperNitro = this.enableHyperNitro;
        racer.placeOnGrid(this.spline, gridIdx);
        this.racers.push(racer);
        this.aiDrivers.set(racer.id, new AIDriver(prof));
      }
    });

    this.state = 'COUNTDOWN';
    this.countdownTimer = 3.2;
    this.lastCountdownStage = -1;
    this.startRevRpm = 0.16;
    this.finishSlowMoTimer = 0;

    this.menuUI.setVisible(false);
    this.resultsUI.setVisible(false);
    this.pauseOverlay.classList.add('hidden');
    this.hud.setVisible(true);
    this.hud.setCameraLabel(this.cameraController.mode);
    this.cameraController.resetSnap();
    this.audio.setEngineActive(true, true);
    this.precompileScene();
  }

  private syncPauseDriftNitroLabel(): void {
    this.pauseDriftNitroBtn.textContent = this.allowDriftNitro
      ? t('pauseDriftNitroOn')
      : t('pauseDriftNitroOff');
    this.pauseDriftNitroBtn.style.borderColor = this.allowDriftNitro ? '#00ff9d' : '';
  }

  private toggleDriftNitro(): boolean {
    this.allowDriftNitro = !this.allowDriftNitro;
    try {
      localStorage.setItem('neon_apex_allow_drift_nitro', String(this.allowDriftNitro));
    } catch {
      // Ignore storage failures
    }
    for (const r of this.racers) {
      r.allowDriftNitro = this.allowDriftNitro;
    }
    this.syncPauseDriftNitroLabel();
    if (this.state === 'RACING' || this.state === 'PAUSED') {
      this.hud.pushCallout(
        this.allowDriftNitro ? t('msgDriftNitroOn') : t('msgDriftNitroOff'),
        this.allowDriftNitro ? 'green' : 'cyan'
      );
    }
    return this.allowDriftNitro;
  }

  private syncPauseOverdriveLabel(): void {
    this.pauseOverdriveBtn.textContent = this.enableStraightOverdrive
      ? t('pauseOverdriveOn')
      : t('pauseOverdriveOff');
    this.pauseOverdriveBtn.style.borderColor = this.enableStraightOverdrive ? '#2dd4bf' : '';
  }

  private toggleStraightOverdrive(): boolean {
    this.enableStraightOverdrive = !this.enableStraightOverdrive;
    try {
      localStorage.setItem('neon_apex_enable_straight_overdrive', String(this.enableStraightOverdrive));
    } catch {
      // Ignore storage failures
    }
    for (const r of this.racers) {
      r.enableStraightOverdrive = this.enableStraightOverdrive;
      if (!this.enableStraightOverdrive) {
        r.straightOverdriveTimer = 0;
        r.overdriveStage = 0;
      }
    }
    this.syncPauseOverdriveLabel();
    if (this.state === 'RACING' || this.state === 'PAUSED') {
      this.hud.pushCallout(
        this.enableStraightOverdrive ? t('msgOverdriveOn') : t('msgOverdriveOff'),
        this.enableStraightOverdrive ? 'green' : 'cyan'
      );
    }
    return this.enableStraightOverdrive;
  }

  private syncPauseHyperNitroLabel(): void {
    this.pauseHyperNitroBtn.textContent = this.enableHyperNitro
      ? t('pauseHyperNitroOn')
      : t('pauseHyperNitroOff');
    this.pauseHyperNitroBtn.style.borderColor = this.enableHyperNitro ? '#fde047' : '';
  }

  private toggleHyperNitro(): boolean {
    this.enableHyperNitro = !this.enableHyperNitro;
    try {
      localStorage.setItem('neon_apex_enable_hyper_nitro', String(this.enableHyperNitro));
    } catch {
      // Ignore storage failures
    }
    for (const r of this.racers) {
      r.enableHyperNitro = this.enableHyperNitro;
      if (!this.enableHyperNitro) {
        r.inHyperZone = false;
        r.hyperZoneRemaining = 0;
        r.hyperZoneTotal = 0;
      }
    }
    this.trackBuild?.setHyperZonesVisible(this.enableHyperNitro);
    this.hud.setHyperZonesVisible(this.enableHyperNitro);
    this.syncPauseHyperNitroLabel();
    if (this.state === 'RACING' || this.state === 'PAUSED') {
      this.hud.pushCallout(
        this.enableHyperNitro ? t('msgHyperNitroOn') : t('msgHyperNitroOff'),
        this.enableHyperNitro ? 'gold' : 'cyan'
      );
    }
    return this.enableHyperNitro;
  }

  private togglePause(): void {
    if (this.state === 'RACING') {
      this.state = 'PAUSED';
      this.pauseOverlay.classList.remove('hidden');
      this.audio.setEngineActive(false, false);
    } else if (this.state === 'PAUSED') {
      this.state = 'RACING';
      this.pauseOverlay.classList.add('hidden');
      this.audio.setEngineActive(true, true);
    }
  }

  private bindInputs(): void {
    const gameCodes = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyN',
    ]);

    window.addEventListener('keydown', (e) => {
      this.audio.unlock();
      if (gameCodes.has(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);

      if (e.repeat) return;

      if (e.code === 'KeyC' && (this.state === 'RACING' || this.state === 'COUNTDOWN')) {
        const m = this.cameraController.toggleMode();
        this.hud.setCameraLabel(m);
        this.hud.pushCallout(m === 'HOOD' ? t('msgCamHood') : t('msgCamChase'), 'cyan');
      } else if (e.code === 'KeyR' && this.state === 'RACING' && this.playerRacer) {
        this.playerRacer.resetToTrack(this.spline);
        this.hud.pushCallout(t('msgTrackReset'), 'cyan');
      } else if (e.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.hud.setMutedLabel(muted);
        this.menuUI.setMuted(muted);
      } else if (e.code === 'Escape') {
        if (this.settingsUI.isOpen()) {
          this.settingsUI.close();
        } else if (this.state === 'MENU') {
          this.menuUI.closeOpenModal();
        } else if (this.state === 'RACING' || this.state === 'PAUSED') {
          this.togglePause();
        }
      } else if (e.code === 'KeyP') {
        if (this.state === 'RACING' || this.state === 'PAUSED') {
          this.togglePause();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  private bindMenuShowroomDrag(canvas: HTMLCanvasElement): void {
    let dragging = false;
    let lastX = 0;

    canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'MENU') return;
      dragging = true;
      lastX = e.clientX;
      this.cameraController.setMenuDragging(true);
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging || this.state !== 'MENU') return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      this.cameraController.orbitMenuBy(-dx * 0.0085);
    });

    const stop = () => {
      if (!dragging) return;
      dragging = false;
      this.cameraController.setMenuDragging(false);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  private pollPlayerInput(isCountdown = false): InputState {
    const touch = this.touchControls.getInput(isCountdown);
    let gpThrottle = false;
    let gpBrake = false;
    let gpLeft = false;
    let gpRight = false;
    let gpDrift = false;
    let gpNitro = false;
    let gpSteer = 0;

    // Standard HTML5 Gamepad API polling (Xbox / PlayStation / Bluetooth mobile controllers, zero GC)
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) {
        const gp = pads[i];
        if (!gp || !gp.connected) continue;
        if (!this.gpNotified) {
          this.gpNotified = true;
          this.hud.pushCallout(t('msgGamepadConnected'), 'cyan');
        }
        const ax = gp.axes[0] ?? 0;
        if (Math.abs(ax) > 0.14) {
          gpSteer = clamp((Math.abs(ax) - 0.14) / 0.86, 0, 1) * Math.sign(ax);
        }
        gpLeft = gpSteer < -0.18 || !!gp.buttons[14]?.pressed;
        gpRight = gpSteer > 0.18 || !!gp.buttons[15]?.pressed;
        gpThrottle = (gp.buttons[7]?.value ?? 0) > 0.18 || !!gp.buttons[0]?.pressed;
        gpBrake = (gp.buttons[6]?.value ?? 0) > 0.18 || !!gp.buttons[1]?.pressed;
        gpDrift = !!gp.buttons[2]?.pressed || !!gp.buttons[4]?.pressed;
        gpNitro = !!gp.buttons[5]?.pressed || !!gp.buttons[3]?.pressed;

        const pausePressed = !!gp.buttons[9]?.pressed;
        if (pausePressed && !this.gpPrevPause && (this.state === 'RACING' || this.state === 'PAUSED')) {
          this.togglePause();
        }
        this.gpPrevPause = pausePressed;

        const camPressed = !!gp.buttons[8]?.pressed;
        if (camPressed && !this.gpPrevCam && (this.state === 'RACING' || this.state === 'COUNTDOWN')) {
          const m = this.cameraController.toggleMode();
          this.hud.setCameraLabel(m);
          this.hud.pushCallout(m === 'HOOD' ? t('msgCamHood') : t('msgCamChase'), 'cyan');
        }
        this.gpPrevCam = camPressed;
        break;
      }
    }

    this.input.throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp') || touch.throttle || gpThrottle;
    this.input.brake = this.keys.has('KeyS') || this.keys.has('ArrowDown') || touch.brake || gpBrake;
    this.input.left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || touch.left || gpLeft;
    this.input.right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || touch.right || gpRight;
    this.input.drift = this.keys.has('Space') || touch.drift || gpDrift;
    this.input.nitro =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.keys.has('KeyE') ||
      this.keys.has('KeyN') ||
      touch.nitro ||
      gpNitro;
    const touchAxis = touch.steerAxis ?? 0;
    this.input.steerAxis = Math.abs(gpSteer) > Math.abs(touchAxis) ? gpSteer : touchAxis;
    return this.input;
  }

  private onResize = (): void => {
    this.applyGraphicsSettings(settingsManager.settings.graphics, false);
    this.hud.updateRotateHint();
  };

  private loop = (now: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop);

    const g = settingsManager.settings.graphics;
    if (g.fpsCap > 0) {
      const targetInterval = 1000 / g.fpsCap;
      const deltaMs = now - this.lastRenderAt;
      if (deltaMs < targetInterval - 2.0) {
        return;
      }
      // Phase-aligned pacing avoids 16.7ms/25ms beat judder on 90Hz/120Hz displays
      this.lastRenderAt =
        deltaMs > targetInterval * 2.5 ? now : now - (deltaMs % targetInterval);
    } else {
      this.lastRenderAt = now;
    }

    const frameStart = performance.now();
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === 'PAUSED') {
      this.renderScene();
      this.recordFpsTick(now, performance.now() - frameStart, g.showFps);
      return;
    }

    const simDt = this.state === 'FINISH_SLOWMO' ? rawDt * 0.28 : rawDt;
    this.elapsed += simDt;

    this.trackBuild?.update(simDt, this.elapsed);

    if (this.state === 'MENU') {
      this.updateMenuState(rawDt);
    } else if (this.state === 'COUNTDOWN') {
      this.updateCountdownState(rawDt);
    } else if (this.state === 'RACING' || this.state === 'FINISH_SLOWMO') {
      this.updateRacingState(simDt, rawDt);
    } else if (this.state === 'RESULTS') {
      // Gentle finish camera orbit in background of results screen
      if (this.playerRacer) {
        this.cameraController.updateRace(rawDt * 0.4, this.playerRacer, true);
      }
      this.particles.update(rawDt * 0.3);
      this.speedLines.update(rawDt, 0, false, false, false, false);
    }

    this.sceneryBuild?.update(simDt, this.elapsed, this.cameraController.camera.position);
    this.renderScene();
    this.recordFpsTick(now, performance.now() - frameStart, g.showFps);
  };

  private recordFpsTick(now: number, workMs: number, showFps: boolean): void {
    if (!showFps) return;
    this.fpsFrames += 1;
    this.fpsAccumMs += workMs;
    const span = now - this.fpsWindowStart;
    if (span >= 400) {
      const fps = (this.fpsFrames * 1000) / Math.max(span, 1);
      const avgFrameMs = span / Math.max(this.fpsFrames, 1);
      this.hud.updateFps(fps, avgFrameMs, true);
      this.fpsFrames = 0;
      this.fpsAccumMs = 0;
      this.fpsWindowStart = now;
    }
  }

  private updateMenuState(dt: number): void {
    if (this.showcaseCar) {
      this.showcaseCar.root.rotation.y += dt * 0.42;
      this.showcaseCar.updateVisuals({
        dt,
        speed: 14,
        steerVisual: Math.sin(this.elapsed * 0.8) * 0.35,
        visualSlipAngle: 0,
        bodyRoll: 0,
        bodyPitch: 0,
        suspensionY: Math.sin(this.elapsed * 2.2) * 0.015,
        isBraking: false,
        isDrifting: false,
        boostIntensity: 0,
        isSuperNitro: this.selectedCarIndex === 1,
      });
    }
    this.cameraController.updateMenuShowcase(dt, this.showcaseOrigin);
    this.speedLines.update(dt, 0, false, false, false, false);
  }

  private updateCountdownState(dt: number): void {
    const inp = this.pollPlayerInput(true);
    this.countdownTimer -= dt;

    // Interactive revving on the starting grid!
    const targetRev = inp.throttle ? 0.96 : 0.18;
    this.startRevRpm = damp(this.startRevRpm, targetRev, inp.throttle ? 3.2 : 4.2, dt);

    const stage = this.countdownTimer > 2.15 ? 1 : this.countdownTimer > 1.15 ? 2 : this.countdownTimer > 0.15 ? 3 : 4;
    if (stage !== this.lastCountdownStage) {
      this.lastCountdownStage = stage;
      this.trackBuild?.setCountdownState(stage);
      this.audio.playCountdownBeep(stage === 4);
    }

    const label = stage === 1 ? '3' : stage === 2 ? '2' : stage === 3 ? '1' : t('countdownGo');
    this.hud.showCountdown(label, stage === 4, this.startRevRpm, stage < 4);

    if (this.playerRacer) {
      // Engine vibration visual & live audio revving
      this.playerRacer.model.updateVisuals({
        dt,
        speed: 0,
        steerVisual: (inp.right ? 1 : 0) - (inp.left ? 1 : 0),
        visualSlipAngle: 0,
        bodyRoll: 0,
        bodyPitch: inp.throttle ? 0.025 : 0,
        suspensionY: (Math.random() - 0.5) * this.startRevRpm * 0.02,
        isBraking: inp.brake,
        isDrifting: false,
        boostIntensity: this.startRevRpm > 0.62 ? 0.45 : 0,
        isSuperNitro: false,
      });

      this.audio.updateTelemetry({
        speedKmh: 0,
        rpmNorm: this.startRevRpm,
        gear: 1,
        isDrifting: false,
        driftTier: 0,
        isNitro: false,
        isSuperNitro: false,
        isAirborne: false,
      });

      this.cameraController.updateRace(dt, this.playerRacer, false);
      const tel = this.playerRacer.getTelemetry(this.racers.length);
      this.hud.update(tel, this.racers, this.spline);
      this.touchControls.updateVisuals(tel, true);
    }

    if (this.countdownTimer <= 0) {
      this.state = 'RACING';
      // Check Perfect Start sweet spot (62% - 88% RPM)
      if (this.playerRacer && this.startRevRpm >= 0.60 && this.startRevRpm <= 0.90) {
        this.playerRacer.applyPerfectStart();
        this.audio.playPerfectStart();
        this.cameraController.addShake(0.45);
        this.hud.pushCallout(t('msgPerfectStart'), 'green');
        this.particles.emitImpactBurst(this.playerRacer.worldPos, 0x00ff9d, 28);
      }
      setTimeout(() => {
        if (this.state === 'RACING') this.hud.showCountdown(null);
      }, 650);
    }
  }

  private updateRacingState(simDt: number, rawDt: number): void {
    const player = this.playerRacer!;
    const playerInput = this.pollPlayerInput();

    const playerEvents: PhysicsEvents = {
      onDriftBoost: (tier, distMeters, points) => {
        const names = ['', t('msgDriftBoost1'), t('msgDriftBoost2'), t('msgDriftBoost3')];
        const colors: ('cyan' | 'gold' | 'magenta')[] = ['cyan', 'cyan', 'gold', 'magenta'];
        this.hud.pushCallout(`${names[tier]} ${Math.round(distMeters)}m +${points}`, colors[tier]);
        this.audio.playDriftBoost(tier);
        this.cameraController.addShake(0.2 + tier * 0.14);
        this.touchControls.vibrate(tier >= 2 ? [20, 15, 30] : 22);
      },
      onBoostPad: () => {
        this.hud.pushCallout(t('msgBoostPad'), 'cyan');
        this.audio.playBoostPad();
        this.cameraController.addShake(0.32);
        this.touchControls.vibrate(20);
      },
      onJumpLaunch: () => {
        this.audio.playJumpLaunch();
        this.cameraController.addShake(0.25);
      },
      onLanding: (airTime, points) => {
        this.hud.pushCallout(t('msgAirTime', { s: airTime.toFixed(1), pts: points }), 'gold');
        this.audio.playLanding();
        this.cameraController.addShake(clamp(airTime * 0.35, 0.25, 0.65));
        this.touchControls.vibrate(25);
        this.particles.emitImpactBurst(player.worldPos, 0x00f2ff, 20);
      },
      onWallHit: (worldPos, intensity) => {
        this.audio.playCollision(intensity * 0.85);
        this.cameraController.addShake(intensity * 0.55);
        this.touchControls.vibrate(32);
        this.particles.emitImpactBurst(worldPos, 0xffae00, 18);
      },
      onGearShift: () => {
        this.audio.playGearShift();
      },
      onNitroStart: (isSuper) => {
        this.audio.playNitroStart(isSuper);
        this.cameraController.addShake(isSuper ? 0.52 : 0.26);
        this.touchControls.vibrate(isSuper ? [28, 18, 46] : 24);
        if (isSuper) {
          this.hud.pushCallout(t('msgSuperNitro'), 'magenta');
        }
      },
      onOverdriveStage: (stage) => {
        this.audio.playNitroStart(stage === 2);
        this.cameraController.addShake(stage === 2 ? 0.36 : 0.16);
        this.touchControls.vibrate(stage === 2 ? [18, 14, 30] : 16);
        this.hud.pushCallout(
          stage === 2 ? t('msgOverdrive2') : t('msgOverdrive1'),
          stage === 2 ? 'gold' : 'green'
        );
      },
      onHyperZoneEnter: (lengthMeters) => {
        const lenLabel =
          lengthMeters >= 1000 ? `${(lengthMeters / 1000).toFixed(1)} KM` : `${Math.round(lengthMeters)}M`;
        this.audio.playBoostPad();
        this.cameraController.addShake(0.24);
        this.touchControls.vibrate([16, 12, 26]);
        this.hud.pushCallout(t('msgHyperEnter', { len: lenLabel }), 'gold');
      },
      onLapComplete: (newLap) => {
        const isFinal = newLap === player.totalLaps;
        this.audio.playLapChime(isFinal);
        this.hud.pushCallout(
          isFinal ? t('msgFinalLap') : t('msgLapProgress', { lap: newLap, total: player.totalLaps }),
          isFinal ? 'magenta' : 'cyan'
        );
      },
      onRaceFinish: () => {
        this.enterFinishSlowMo();
      },
    };

    // 1. Step every racer (Player + 5 AI)
    for (const r of this.racers) {
      if (r.isPlayer) {
        const effectiveInput =
          this.state === 'FINISH_SLOWMO'
            ? { throttle: true, brake: false, left: false, right: false, drift: false, nitro: false }
            : playerInput;
        r.step(simDt, effectiveInput, this.spline, 1.0, this.state === 'RACING' ? playerEvents : undefined);
      } else {
        const ai = this.aiDrivers.get(r.id)!;
        const aiDiff = settingsManager.settings.controls.aiDifficulty ?? 'pro';
        const { input, paceScale } = ai.computeInput(simDt, r, this.racers, player, this.spline, aiDiff);
        r.step(simDt, input, this.spline, paceScale);
      }

      // Check destructible neon cones!
      const smashed = this.destructibles?.checkHit(r.worldPos, r.worldForward, r.speed, (conePos) => {
        this.particles.emitImpactBurst(conePos, 0xff7b00, 14);
        if (r.isPlayer && this.state === 'RACING') {
          r.styleScore += 50;
          this.audio.playConeSmash();
          this.cameraController.addShake(0.14);
        }
      });
      void smashed;

      // Per-car Drift Sparks, Tire Smoke & Ground Skid Marks
      r.model.getRearWheelWorldPositions(this._wheelL, this._wheelR);
      const layingSkids = r.isDrifting && !r.isAirborne && r.speed > 20;
      this.skidMarks.recordWheelPair(r.id, this._wheelL, this._wheelR, r.frame.up, layingSkids, r.driftTier);

      if (layingSkids) {
        const sparkCount = r.isPlayer ? 3 + r.driftTier : 1;
        this.particles.emitDriftSparks(this._wheelL, r.worldForward, r.frame.up, r.driftTier, sparkCount);
        this.particles.emitDriftSparks(this._wheelR, r.worldForward, r.frame.up, r.driftTier, sparkCount);
        if (Math.random() < (r.isPlayer ? 0.72 : 0.35)) {
          this.particles.emitTireSmoke(this._wheelL, r.worldForward, r.frame.up);
          this.particles.emitTireSmoke(this._wheelR, r.worldForward, r.frame.up);
        }
      }

      // Exhaust Particles & Player Dynamic Nitro Light Ribbon Trails
      // When drift-nitro lock is active during drift, cleanly shut off ALL exhaust flames & orange trails!
      const boostLockedInDrift = r.isDrifting && !r.allowDriftNitro;
      const boosting =
        !boostLockedInDrift &&
        (r.isNitroActive || r.miniBoostTimer > 0 || r.boostPadTimer > 0 || r.overdriveStage >= 1);
      if (boosting) {
        r.model.getExhaustWorldPositions(this._exL, this._exR);
        if (Math.random() < (r.isPlayer ? 0.9 : 0.4)) {
          const blueFlame = r.isSuperNitro || (!r.isNitroActive && r.overdriveStage >= 1);
          this.particles.emitNitroExhaust(this._exL, r.worldForward, blueFlame);
          this.particles.emitNitroExhaust(this._exR, r.worldForward, blueFlame);
        }
      }
      if (r.isPlayer) {
        r.model.getExhaustWorldPositions(this._exL, this._exR);
        this.particles.updatePlayerTrails(
          this._exL,
          this._exR,
          r.worldUp,
          !boostLockedInDrift && (boosting || r.speed > 92),
          r.isSuperNitro || (!r.isNitroActive && r.overdriveStage === 2)
        );
        if (r.isSlipstreaming && Math.random() < 0.65) {
          const streakPos = r.worldPos
            .clone()
            .addScaledVector(r.worldForward, 5 + Math.random() * 5)
            .addScaledVector(r.worldRight, (Math.random() - 0.5) * 3.4)
            .addScaledVector(r.worldUp, 0.6 + Math.random() * 1.1);
          this.particles.emitSlipstreamStreak(streakPos, r.worldForward);
        }
      }
    }

    // 2. Multi-car Slipstream & Collision Resolution
    resolveMultiCarInteractions(this.racers, this.spline, simDt, (mid, intensity, involvesPlayer) => {
      this.particles.emitImpactBurst(mid, 0x00f2ff, involvesPlayer ? 22 : 10);
      if (involvesPlayer && this.state === 'RACING') {
        this.audio.playCollision(intensity);
        this.cameraController.addShake(intensity * 0.62);
      }
    });

    // 3. Live Race Ranking Calculation
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? 9999) - (b.finishTime ?? 9999);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });
    sorted.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    // 4. Update VFX, Props, Camera, Audio & HUD
    this.destructibles?.update(simDt);
    this.particles.update(simDt);

    const isSlowMo = this.state === 'FINISH_SLOWMO';
    this.cameraController.updateRace(rawDt, player, isSlowMo);

    const tel = player.getTelemetry(this.racers.length);
    this.hud.update(tel, this.racers, this.spline);
    this.touchControls.updateVisuals(tel, false);
    const anyBoost =
      tel.isNitroActive || player.miniBoostTimer > 0 || player.boostPadTimer > 0 || tel.overdriveStage >= 1;
    this.speedLines.update(
      rawDt,
      tel.speedKmh,
      anyBoost,
      tel.isSuperNitro || tel.overdriveStage === 2,
      tel.isSlipstreaming,
      !isSlowMo
    );

    this.audio.updateTelemetry({
      speedKmh: tel.speedKmh,
      rpmNorm: tel.rpmNorm,
      gear: tel.gear,
      isDrifting: tel.isDrifting,
      driftTier: tel.driftTier,
      isNitro: anyBoost,
      isSuperNitro: tel.isSuperNitro || tel.overdriveStage === 2,
      isAirborne: tel.isAirborne,
    });

    // 5. Advance Finish Slow-Mo into Results Screen
    if (isSlowMo) {
      this.finishSlowMoTimer -= rawDt;
      if (this.finishSlowMoTimer <= 0) {
        this.showResults(sorted);
      }
    }
  }

  private enterFinishSlowMo(): void {
    if (this.state === 'FINISH_SLOWMO' || this.state === 'RESULTS') return;
    this.state = 'FINISH_SLOWMO';
    this.finishSlowMoTimer = 2.75;
    const p = this.playerRacer!;
    this.audio.playFinishFanfare(p.rank === 1);
    this.hud.pushCallout(
      p.rank === 1 ? t('msgFinishWin') : t('msgFinishRank', { rank: p.rank }),
      p.rank === 1 ? 'gold' : 'cyan'
    );
    this.particles.emitImpactBurst(p.worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xffb800, 45);
    this.particles.emitImpactBurst(p.worldPos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x00f2ff, 45);
  }

  private showResults(sortedRacers: RacerPhysics[]): void {
    this.state = 'RESULTS';
    this.hud.setVisible(false);
    this.audio.setEngineActive(false, false);

    const p = this.playerRacer!;
    const playerFinish = p.finishTime ?? p.raceTime;

    // Estimate realistic finish times for any AI cars still slightly behind the line
    const standings: RacerStanding[] = sortedRacers.map((r, idx) => {
      let fTime = r.finishTime;
      if (fTime === null) {
        const remaining = Math.max(0, r.totalLaps * this.spline.totalLength - r.totalProgress);
        fTime = playerFinish + remaining / Math.max(r.speed, 65);
      }
      return {
        id: r.id,
        name: r.name,
        carName: r.spec.name,
        colorHex: r.colorHex,
        isPlayer: r.isPlayer,
        rank: idx + 1,
        finished: true,
        finishTime: fTime,
        totalProgress: r.totalProgress,
      };
    });

    const trackCfg = TRACK_CONFIGS[this.selectedTrackIndex];
    const bestLap = p.bestLapTime ?? playerFinish / p.totalLaps;
    const recordRes = recordsManager.submitResult(trackCfg.id, {
      rank: p.rank,
      totalTime: playerFinish,
      bestLapTime: bestLap,
      topSpeedKmh: p.topSpeedKmh,
      laps: p.totalLaps,
    });

    const results: RaceResults = {
      trackId: trackCfg.id,
      rank: p.rank,
      totalRacers: this.racers.length,
      totalTime: playerFinish,
      bestLapTime: bestLap,
      topSpeedKmh: p.topSpeedKmh,
      longestDriftMeters: p.longestDriftMeters,
      totalAirTime: p.totalAirTime,
      styleScore: p.styleScore,
      standings,
      isNewBestLap: recordRes.isNewBestLap,
      isNewBestRace: recordRes.isNewBestRace,
      previousBestLap: recordRes.previousBestLap,
    };

    this.resultsUI.show(results);
  }

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.clearRacers();
    this.trackBuild?.dispose();
    this.sceneryBuild?.dispose();
    this.destructibles?.dispose();
    this.particles.dispose();
    this.skidMarks.dispose();
    this.composer?.dispose();
    this.renderTarget?.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
