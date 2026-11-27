import { CameraMode } from '../types';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
export type AntiAliasingMode = 'off' | 'smaa' | 'msaa2' | 'msaa4_smaa';
export type BloomMode = 'off' | 'soft' | 'cinematic';
export type ParticleQuality = 'low' | 'medium' | 'high';
export type DrawDistanceMode = 'near' | 'medium' | 'far';
export type FpsCap = 30 | 60 | 90 | 120 | 0;
export type SteerMode = 'joystick' | 'buttons' | 'tilt';
export type AIDifficulty = 'rookie' | 'pro' | 'apex';

export interface GraphicsSettings {
  qualityPreset: QualityPreset;
  resolutionScale: number; // 0.7 | 0.85 | 1.0 | 1.25 | 1.5
  fpsCap: FpsCap;
  antiAliasing: AntiAliasingMode;
  bloom: BloomMode;
  particles: ParticleQuality;
  drawDistance: DrawDistanceMode;
  brightness: number; // 0.8..1.4 (1.0 = calibrated default exposure)
  showFps: boolean;
}

export interface ControlSettings {
  steerMode: SteerMode;
  autoThrottle: boolean;
  steerSensitivity: number; // 0.7..1.4
  buttonScale: number;      // 0.8..1.25
  buttonOpacity: number;    // 0.45..1.0
  haptics: boolean;
  defaultCamera: CameraMode;
  aiDifficulty: AIDifficulty;
}

export interface AudioSettings {
  masterVolume: number; // 0..1
  sfxVolume: number;    // 0..1
  musicVolume: number;  // 0..1
}

export interface GameSettings {
  graphics: GraphicsSettings;
  controls: ControlSettings;
  audio: AudioSettings;
}

const STORAGE_KEY = 'neon_apex_settings_v2';

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaMob = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MicroMessenger/i.test(ua);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallEdge = Math.min(window.innerWidth || 1280, window.innerHeight || 800) <= 720;
  return uaMob || coarse || smallEdge;
}

export function detectRecommendedPreset(): Exclude<QualityPreset, 'custom'> {
  if (!isMobileDevice()) {
    // Preserve full desktop WebGL2 fidelity (4x MSAA + HDR Bloom + SMAA) by default!
    return 'ultra';
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  // Inspect WebGL GPU renderer string if available
  let gpuTier: 'low' | 'mid' | 'high' = 'mid';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      if (/Adreno\s*\(TM\)\s*(7[3-9]\d|8\d\d)|Apple\s+GPU|Immortalis|Xclipse|Mali-G7(1[0-9]|2\d)/i.test(renderer)) {
        gpuTier = 'high';
      } else if (/Adreno\s*\(TM\)\s*([3-5]\d\d|61\d)|Mali-G5[127]|PowerVR|SwiftShader|llvmpipe/i.test(renderer)) {
        gpuTier = 'low';
      }
    }
  } catch {
    // Fallback to cores/memory heuristics
  }

  if (gpuTier === 'low' || cores <= 4 || memGb <= 3) return 'low';
  if (gpuTier === 'high' && cores >= 6 && memGb >= 6) return 'high';
  return 'medium';
}

export function buildPresetGraphics(
  preset: Exclude<QualityPreset, 'custom'>,
  showFps = false,
  brightness = 1.0
): GraphicsSettings {
  const mobile = isMobileDevice();
  switch (preset) {
    case 'low':
      return {
        qualityPreset: 'low',
        resolutionScale: 0.75,
        fpsCap: 60,
        antiAliasing: 'off',
        bloom: 'off',
        particles: 'low',
        drawDistance: 'near',
        brightness,
        showFps,
      };
    case 'medium':
      return {
        qualityPreset: 'medium',
        resolutionScale: 1.0,
        fpsCap: 60,
        antiAliasing: 'smaa',
        bloom: 'soft',
        particles: 'medium',
        drawDistance: 'medium',
        brightness,
        showFps,
      };
    case 'high':
      return {
        qualityPreset: 'high',
        resolutionScale: mobile ? 1.25 : 1.25,
        fpsCap: mobile ? 60 : 0,
        antiAliasing: 'msaa2',
        bloom: 'soft',
        particles: 'high',
        drawDistance: 'far',
        brightness,
        showFps,
      };
    case 'ultra':
    default:
      return {
        qualityPreset: 'ultra',
        resolutionScale: 1.5,
        fpsCap: 0,
        antiAliasing: 'msaa4_smaa',
        bloom: 'cinematic',
        particles: 'high',
        drawDistance: 'far',
        brightness,
        showFps,
      };
  }
}

export function createDefaultSettings(): GameSettings {
  const preset = detectRecommendedPreset();
  return {
    graphics: buildPresetGraphics(preset, false),
    controls: {
      steerMode: 'joystick',
      autoThrottle: true,
      steerSensitivity: 1.0,
      buttonScale: 1.0,
      buttonOpacity: 0.92,
      haptics: true,
      defaultCamera: 'CHASE',
      aiDifficulty: 'pro',
    },
    audio: {
      masterVolume: 0.75,
      sfxVolume: 0.85,
      musicVolume: 0.48,
    },
  };
}

export function drawDistanceToFar(mode: DrawDistanceMode): number {
  if (mode === 'near') return 1800;
  if (mode === 'medium') return 4200;
  return 9800;
}

type SettingsChangeSection = 'graphics' | 'controls' | 'audio' | 'all';
type SettingsListener = (settings: GameSettings, section: SettingsChangeSection) => void;

export class SettingsManager {
  private data: GameSettings;
  private readonly listeners = new Set<SettingsListener>();

  constructor() {
    this.data = this.load();
  }

  public get settings(): GameSettings {
    return this.data;
  }

  private load(): GameSettings {
    const def = createDefaultSettings();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      const mergedGraphics = { ...def.graphics, ...(parsed.graphics ?? {}) };
      const rawBrightness = Number(mergedGraphics.brightness);
      mergedGraphics.brightness = Number.isFinite(rawBrightness)
        ? Math.min(1.4, Math.max(0.8, rawBrightness))
        : 1.0;
      return {
        graphics: mergedGraphics,
        controls: { ...def.controls, ...(parsed.controls ?? {}) },
        audio: { ...def.audio, ...(parsed.audio ?? {}) },
      };
    } catch {
      return def;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage failures
    }
  }

  private emit(section: SettingsChangeSection): void {
    this.save();
    for (const cb of this.listeners) {
      cb(this.data, section);
    }
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public applyQualityPreset(preset: Exclude<QualityPreset, 'custom'>): void {
    const keepFps = this.data.graphics.showFps;
    const keepBrightness = this.data.graphics.brightness;
    this.data.graphics = buildPresetGraphics(preset, keepFps, keepBrightness);
    this.emit('graphics');
  }

  public autoDetectGraphics(): Exclude<QualityPreset, 'custom'> {
    const rec = detectRecommendedPreset();
    this.applyQualityPreset(rec);
    return rec;
  }

  public updateGraphics(patch: Partial<GraphicsSettings>): void {
    const keys = Object.keys(patch);
    const isMetaOnly =
      keys.length > 0 && keys.every((k) => k === 'showFps' || k === 'brightness');
    this.data.graphics = {
      ...this.data.graphics,
      ...patch,
      qualityPreset: isMetaOnly ? this.data.graphics.qualityPreset : (patch.qualityPreset ?? 'custom'),
    };
    this.emit('graphics');
  }

  public updateControls(patch: Partial<ControlSettings>): void {
    this.data.controls = { ...this.data.controls, ...patch };
    this.emit('controls');
  }

  public updateAudio(patch: Partial<AudioSettings>): void {
    this.data.audio = { ...this.data.audio, ...patch };
    this.emit('audio');
  }

  public resetAll(): void {
    this.data = createDefaultSettings();
    this.emit('all');
  }
}

export const settingsManager = new SettingsManager();
