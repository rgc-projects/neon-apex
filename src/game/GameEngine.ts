import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

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
import { TouchControls } from '../ui/TouchControls';
import { clamp, damp } from '../utils/math';
import { createProceduralEnvMap } from '../utils/textures';

export class GameEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly scene = new THREE.Scene();
  private readonly cameraController: CameraController;

  private readonly audio = new AudioEngine();
  private readonly speedLines: SpeedLinesOverlay;
  private readonly hud = new HUD();
  private readonly menuUI: MenuUI;
  private readonly resultsUI: ResultsUI;
  private readonly touchControls: TouchControls;
  private readonly pauseOverlay = document.getElementById('pause-overlay')!;

  private state: GameState = 'MENU';
  private selectedCarIndex = 0;
  private selectedTrackIndex = 0;

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
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const speedCanvas = document.getElementById('speedlines-canvas') as HTMLCanvasElement;

    const isMobile =
      window.matchMedia?.('(pointer: coarse)').matches ||
      Math.min(window.innerWidth, window.innerHeight) <= 720;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.cameraController = new CameraController(window.innerWidth / window.innerHeight);

    // Post-Processing: Render -> Optical Cinema UnrealBloomPass (subtle realistic highlights) -> OutputPass
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraController.camera));
    const bloomScale = isMobile ? 0.5 : 1.0;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * bloomScale, window.innerHeight * bloomScale),
      0.26, // strength - authentic camera lens bloom on headlights, taillights & streetlamps
      0.34, // radius
      0.90  // threshold - preserves crisp daylight/dusk speculars without neon haze
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // Procedural Realistic Twilight + Streetlamp HDR Reflection Probe
    this.scene.environment = createProceduralEnvMap(this.renderer);

    // Three-Point Photorealistic Atmospheric Lighting (adapted per track theme in loadTrack)
    this.hemiLight = new THREE.HemisphereLight(0x9bc0eb, 0x222938, 1.32);
    this.dirKeyLight = new THREE.DirectionalLight(0xffddb5, 1.9);
    this.dirKeyLight.position.set(140, 185, 120);
    this.dirRimLight = new THREE.DirectionalLight(0x93c5fd, 1.0);
    this.dirRimLight.position.set(-150, 95, -160);
    this.scene.add(this.hemiLight, this.dirKeyLight, this.dirRimLight);

    this.scene.add(this.particles.group, this.skidMarks.mesh, this.showcaseGroup);
    this.buildShowcasePedestal();

    // Begin decoding local supercar.glb immediately on startup
    void supercarAssets.loadTemplate();

    this.speedLines = new SpeedLinesOverlay(speedCanvas);

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
        this.loadTrack(idx);
        this.positionShowcaseOnTrack();
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
    });
    this.menuUI.setTouchEnabled(this.touchControls.enabled);
    this.menuUI.setFullscreen(this.touchControls.isFullscreen());
    this.hud.setTouchLabel(this.touchControls.enabled);

    this.resultsUI = new ResultsUI({
      onRaceAgain: () => {
        this.audio.unlock();
        this.startRace();
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
        this.hud.pushCallout('TRACK RESET', 'cyan');
      }
    });

    document.getElementById('btn-resume')!.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-pause-restart')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.startRace();
    });
    document.getElementById('btn-pause-menu')!.addEventListener('click', () => {
      this.pauseOverlay.classList.add('hidden');
      this.enterMenu();
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

    this.lastTime = performance.now();
    this.loop(this.lastTime);
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
      this.hemiLight.color.setHex(0xffd2a6);
      this.hemiLight.groundColor.setHex(0x283548);
      this.hemiLight.intensity = 1.42;
      this.dirKeyLight.color.setHex(0xffb870);
      this.dirKeyLight.intensity = 2.25;
      this.dirKeyLight.position.set(220, 115, 160);
      this.dirRimLight.color.setHex(0x93c5fd);
      this.dirRimLight.intensity = 0.95;
    } else if (cfg.theme === 'tunnel') {
      // Modern illuminated sub-surface expressway tunnel
      this.hemiLight.color.setHex(0xcbd5e1);
      this.hemiLight.groundColor.setHex(0x1f242e);
      this.hemiLight.intensity = 1.25;
      this.dirKeyLight.color.setHex(0xfef3c7);
      this.dirKeyLight.intensity = 1.5;
      this.dirKeyLight.position.set(80, 200, 90);
      this.dirRimLight.color.setHex(0xbae6fd);
      this.dirRimLight.intensity = 1.05;
    } else if (cfg.theme === 'mountain') {
      // Crisp Japanese alpine dusk pass
      this.hemiLight.color.setHex(0xa8c5e8);
      this.hemiLight.groundColor.setHex(0x202c26);
      this.hemiLight.intensity = 1.38;
      this.dirKeyLight.color.setHex(0xffd4a3);
      this.dirKeyLight.intensity = 1.95;
      this.dirKeyLight.position.set(160, 145, 130);
      this.dirRimLight.color.setHex(0x94b8e8);
      this.dirRimLight.intensity = 0.92;
    } else {
      // Tokyo Bayshore twilight-to-night expressway
      this.hemiLight.color.setHex(0x96b8e6);
      this.hemiLight.groundColor.setHex(0x1e2532);
      this.hemiLight.intensity = 1.32;
      this.dirKeyLight.color.setHex(0xffdfba);
      this.dirKeyLight.intensity = 1.88;
      this.dirKeyLight.position.set(140, 185, 120);
      this.dirRimLight.color.setHex(0x93c5fd);
      this.dirRimLight.intensity = 1.0;
    }

    this.trackBuild = buildTrackMesh(this.spline);
    this.sceneryBuild = buildScenery(this.spline);
    this.destructibles = new DestructibleProps(this.spline);

    this.scene.add(this.trackBuild.group, this.sceneryBuild.group, this.destructibles.group);
    this.hud.configureTrack(this.spline);
    this.positionShowcaseOnTrack();
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
    this.clearRacers();
    this.particles.clear();
    this.skidMarks.clear();
    this.destructibles?.resetAll();
    this.showcaseGroup.visible = false;

    const trackCfg = TRACK_CONFIGS[this.selectedTrackIndex];
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
          totalLaps: trackCfg.laps,
        });
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
          totalLaps: trackCfg.laps,
        });
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
        this.hud.pushCallout(m === 'HOOD' ? 'HOOD CAMERA' : 'CHASE CAMERA', 'cyan');
      } else if (e.code === 'KeyR' && this.state === 'RACING' && this.playerRacer) {
        this.playerRacer.resetToTrack(this.spline);
        this.hud.pushCallout('TRACK RESET', 'cyan');
      } else if (e.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.hud.setMutedLabel(muted);
        this.menuUI.setMuted(muted);
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
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
    this.input.throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp') || touch.throttle;
    this.input.brake = this.keys.has('KeyS') || this.keys.has('ArrowDown') || touch.brake;
    this.input.left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || touch.left;
    this.input.right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || touch.right;
    this.input.drift = this.keys.has('Space') || touch.drift;
    this.input.nitro =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.keys.has('KeyE') ||
      this.keys.has('KeyN') ||
      touch.nitro;
    this.input.steerAxis = touch.steerAxis ?? 0;
    return this.input;
  }

  private onResize = (): void => {
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    const isMobile =
      window.matchMedia?.('(pointer: coarse)').matches || Math.min(w, h) <= 720;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const bloomScale = isMobile ? 0.5 : 1.0;
    this.bloomPass.setSize(w * bloomScale, h * bloomScale);
    this.cameraController.setAspect(w / Math.max(h, 1));
    this.speedLines.resize(w, h);
  };

  private loop = (now: number): void => {
    this.animFrameId = requestAnimationFrame(this.loop);
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.state === 'PAUSED') {
      this.composer.render();
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
    this.composer.render();
  };

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

    const label = stage === 1 ? '3' : stage === 2 ? '2' : stage === 3 ? '1' : 'GO!';
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
        this.hud.pushCallout('⚡ PERFECT START! +300', 'green');
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
        const names = ['', 'DRIFT BOOST!', 'SUPER DRIFT!', '★ ULTRA DRIFT ★'];
        const colors: ('cyan' | 'gold' | 'magenta')[] = ['cyan', 'cyan', 'gold', 'magenta'];
        this.hud.pushCallout(`${names[tier]} ${Math.round(distMeters)}m +${points}`, colors[tier]);
        this.audio.playDriftBoost(tier);
        this.cameraController.addShake(0.2 + tier * 0.14);
        this.touchControls.vibrate(tier >= 2 ? [20, 15, 30] : 22);
      },
      onBoostPad: () => {
        this.hud.pushCallout('⚡ BOOST PAD +120', 'cyan');
        this.audio.playBoostPad();
        this.cameraController.addShake(0.32);
        this.touchControls.vibrate(20);
      },
      onJumpLaunch: () => {
        this.audio.playJumpLaunch();
        this.cameraController.addShake(0.25);
      },
      onLanding: (airTime, points) => {
        this.hud.pushCallout(`AIR TIME ${airTime.toFixed(1)}s! +${points}`, 'gold');
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
          this.hud.pushCallout('🔥 SUPER NITRO OVERDRIVE!', 'magenta');
        }
      },
      onLapComplete: (newLap) => {
        const isFinal = newLap === player.totalLaps;
        this.audio.playLapChime(isFinal);
        this.hud.pushCallout(
          isFinal ? '★ FINAL LAP! ★' : `LAP ${newLap} / ${player.totalLaps}`,
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
        const { input, paceScale } = ai.computeInput(simDt, r, this.racers, player, this.spline);
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
      const boosting = r.isNitroActive || r.miniBoostTimer > 0 || r.boostPadTimer > 0;
      if (boosting) {
        r.model.getExhaustWorldPositions(this._exL, this._exR);
        if (Math.random() < (r.isPlayer ? 0.9 : 0.4)) {
          this.particles.emitNitroExhaust(this._exL, r.worldForward, r.isSuperNitro);
          this.particles.emitNitroExhaust(this._exR, r.worldForward, r.isSuperNitro);
        }
      }
      if (r.isPlayer) {
        r.model.getExhaustWorldPositions(this._exL, this._exR);
        this.particles.updatePlayerTrails(
          this._exL,
          this._exR,
          r.worldUp,
          boosting || r.speed > 92,
          r.isSuperNitro
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
    this.speedLines.update(
      rawDt,
      tel.speedKmh,
      tel.isNitroActive || player.miniBoostTimer > 0 || player.boostPadTimer > 0,
      tel.isSuperNitro,
      tel.isSlipstreaming,
      !isSlowMo
    );

    this.audio.updateTelemetry({
      speedKmh: tel.speedKmh,
      rpmNorm: tel.rpmNorm,
      gear: tel.gear,
      isDrifting: tel.isDrifting,
      driftTier: tel.driftTier,
      isNitro: tel.isNitroActive || player.miniBoostTimer > 0 || player.boostPadTimer > 0,
      isSuperNitro: tel.isSuperNitro,
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
      p.rank === 1 ? '🏆 FINISH! 1ST PLACE!' : `🏁 FINISH! #${p.rank}`,
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

    const results: RaceResults = {
      rank: p.rank,
      totalRacers: this.racers.length,
      totalTime: playerFinish,
      bestLapTime: p.bestLapTime ?? playerFinish / p.totalLaps,
      topSpeedKmh: p.topSpeedKmh,
      longestDriftMeters: p.longestDriftMeters,
      totalAirTime: p.totalAirTime,
      styleScore: p.styleScore,
      standings,
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
    this.audio.dispose();
    this.renderer.dispose();
  }
}
