# AGENTS.md — NEON APEX Engineering & AI Agent Guide

This document is the authoritative operating manual for AI coding agents and human engineers working on **NEON APEX** (`top.gcrdev.neonapex`). Read this file before modifying rendering, physics, tracks, UI, i18n, or Android packaging.

---

## 1. Project Identity & Architecture

- **Product**: **NEON APEX** — 3D Photorealistic Arcade Racing Game (`v2.0.1`, Android `versionCode 3`).
- **Single-Codebase, Dual-Platform Stack**:
  - **Web**: Vite 6 + TypeScript 5.6 + Three.js `^0.170.0` (WebGL2 + EffectComposer + MSAA/SMAA + UnrealBloom) + 100% Procedural Web Audio API, deployed to **Cloudflare Workers Static Assets** (`wrangler.jsonc` → `./dist`, live domain `neon-apex.gcrdev.top`).
  - **Android Native**: **Capacitor 7** (`capacitor.config.ts` + `android/`) wrapping `./dist` for 100% offline execution inside Android System WebView (bundled `supercar.glb` + local Draco WASM decoder + procedural audio), compiled via GitHub Actions (`.github/workflows/build-android.yml`).
- **GitHub Repository**: `https://github.com/rgc-projects/neon-apex` (production branch: `main`).

---

## 2. Repository Structure & Module Map

```text
neon-apex/
├── index.html                        # App shell: Menu, Circuit Catalog, Settings Modal, HUD, Touch Controls, Pause, Results
├── vite.config.ts                    # base: './', es2022 target, manualChunks: { three }, ignores android/ watch
├── wrangler.jsonc                    # Cloudflare Workers Static Assets (directory: ./dist, SPA fallback)
├── capacitor.config.ts               # Capacitor 7 config (appId: top.gcrdev.neonapex, webDir: dist, https scheme)
├── .github/workflows/
│   └── build-android.yml             # CI: Node 22 + JDK 21 + Gradle 8.11.1 -> NEON-APEX-v2.0.0-android.apk artifact
├── public/
│   ├── models/supercar.glb           # Bundled Ferrari 458 Italia mesh (CC BY 4.0)
│   ├── draco/                        # Offline Draco WASM decoder (zero runtime CDN requests)
│   ├── manifest.json                 # PWA fullscreen manifest (start_url: "./")
│   └── _headers                      # Cloudflare immutable asset caching headers
├── android/                          # Capacitor 7 Android native project (source tracked; build/ & assets/public/ gitignored)
│   └── app/src/main/
│       ├── AndroidManifest.xml       # sensorLandscape, hardwareAccelerated=true, VIBRATE permission
│       ├── java/top/gcrdev/neonapex/MainActivity.java  # Keep screen on, cutout shortEdges, immersive fullscreen, WebView audio
│       └── res/                      # Dark #040714 theme, splash_neon.xml, adaptive vector icon ic_neon_apex_fg.xml
├── docs/
│   ├── TRACK_AND_DRIFT_DESIGN.md     # Track geometry, banking, zero-clipping & drift physics specification
│   ├── TESTING.md                    # Multi-platform QA & Android emulator verification playbook
│   └── HANDOFF.md                    # Project handover, changelog, tooling inventory & backlog
└── src/
    ├── main.ts                       # DOMContentLoaded -> new GameEngine()
    ├── types.ts                      # Shared interfaces (CarSpec, TrackConfig, InputState, RacerHUDTelemetry, etc.)
    ├── style.css                     # Full responsive theme (Desktop, 20:9 Android Landscape, Portrait, Safe Areas, Modals)
    ├── i18n/
    │   └── i18n.ts                   # Reactive zh-CN / en-US dictionary, DOM binder, localized car/track getters
    ├── settings/
    │   └── SettingsManager.ts        # Persisted Graphics / Controls / Audio settings + GPU/device auto-tiering
    ├── platform/
    │   └── NativeBridge.ts           # Capacitor.isNativePlatform()-guarded StatusBar, Haptics, Orientation, Back Button
    ├── game/
    │   └── GameEngine.ts             # Main loop, dynamic WebGL2/Direct render pipeline, FPS cap/meter, race state machine
    ├── config/
    │   ├── cars.ts                   # 3 playable supercars (APEX-V12, PHANTOM-X, KATANA-RS) + 5 AI profiles
    │   ├── tracks.ts                 # Master TRACK_CONFIGS registry (10 circuits total) + first 6 circuits
    │   ├── isleOfManTrack.ts         # 60.7 km 1:1 Isle of Man TT Snaefell Mountain Course
    │   ├── nujiangTrack.ts           # 7.32 km G318 Nujiang 72 Bends tight hairpin touge
    │   ├── auroraFjordTrack.ts       # 20.8 km 11-arm radial starfish 24-bend labyrinth
    │   └── superAkinaTrack.ts        # 26.1 km Super Akina v2 (35° banking, ±12.6% slopes, 5 serpentine ribbons)
    ├── track/
    │   ├── TrackSpline.ts            # Centripetal Catmull-Rom, inward banking, O(1) spatial hash, Hyper Straight detector
    │   ├── TrackBuilder.ts           # Asphalt mesh, FIA curbs, tunnels, boost pads, ramps, InstancedMesh corner boards
    │   └── SceneryBuilder.ts         # 9 biome worlds, dual-layer zero-clipping 60km terrain, buildings, flora, sky
    ├── vehicle/
    │   ├── CarPhysics.ts             # Decoupled slip-angle drift, brake-to-drift, S-bend switchback, overdrive & AI physics
    │   ├── CarModel.ts               # Ferrari 458 GLB + procedural GT3 aero, lights, brake glow, dynamic aero wing
    │   └── SupercarLoader.ts         # Local Draco + GLTFLoader using import.meta.env.BASE_URL
    ├── ai/AIDriver.ts                # Curvature-aware apex hunting, overtaking, boost/ramp alignment & rubber-banding
    ├── camera/CameraController.ts    # Chase/Hood modes, ultrawide mobile FOV compensation, drift lookahead, draw distance
    ├── audio/AudioEngine.ts          # Zero-asset Web Audio 6-gear engine synth, screech, nitro, SFX & synthwave BGM
    ├── vfx/
    │   ├── ParticleSystem.ts         # Pooled sparks/smoke + nitro ribbon trails (quality-scaled)
    │   ├── SkidMarkSystem.ts         # Dynamic banked road skid ribbons
    │   ├── SpeedLinesOverlay.ts      # 2D radial speed lines (disabled on Low quality for mobile FPS)
    │   └── DestructibleProps.ts      # Smashable neon traffic cones
    ├── ui/
    │   ├── MenuUI.ts                 # Compact Active Circuit Hub + Full-Catalog Blueprint Grid Modal + localStorage favorites
    │   ├── SettingsUI.ts             # 4-tab unified settings modal (Graphics / Controls / Audio / Language)
    │   ├── HUD.ts                    # Diff-guarded race telemetry, cached 20Hz minimap, FPS badge, rotate hint
    │   ├── TouchControls.ts          # Floating joystick / Left-Right buttons / Tilt gyro + scale/opacity/haptics
    │   └── ResultsUI.ts              # Localized finish telemetry & standings screen
    └── utils/
        ├── math.ts                   # Clamp, damp, lerp, smoothstep, wrapDistance, formatting helpers
        └── textures.ts               # Procedural PBR canvas textures & HDR studio reflection envMap
```

---

## 3. Hard Engineering Invariants (Do Not Break)

### A. Single-Codebase Web + Android Parity
1. **Desktop WebGL2 Fidelity Must Stay Untouched**: On desktop browsers (`!isMobileDevice()`), `SettingsManager.detectRecommendedPreset()` MUST default to `'ultra'` (DPR cap `2.0`, 4× WebGL2 MSAA + HDR `UnrealBloomPass` + `SMAAPass`, `9800m` far plane).
2. **Offline-Safe Asset Loading**: Always resolve static files in `public/` using `import.meta.env.BASE_URL` (with `vite.config.ts` `base: './'`). Never introduce runtime CDN URLs for meshes, decoders, fonts, or audio.
3. **Web-Safe Native Guarding**: All Capacitor plugin imports stay isolated inside `src/platform/NativeBridge.ts` and MUST check `Capacitor.isNativePlatform()` before calling native methods. Never break `npm run deploy:dry` (Cloudflare Workers).
4. **Capacitor Git Hygiene**: Keep `android/` native source tracked in Git, and keep `android/app/src/main/assets/public/`, `android/app/build/`, `dist/`, and `releases/` gitignored.

### B. Mobile & Android WebView Performance Rules
1. **No Per-Frame `backdrop-filter: blur()` During Mobile Racing**: Keep `backdrop-filter: none !important` on `body.touch-mode` and `body.native-app` in-race HUD and touch buttons (`.glass-hud`, `.touch-btn`, `.hud-mini-btn`, `.drift-hud`, `.corner-callout`) — live Android 16 testing proved per-frame blur causes heavy WebView compositor stalls.
2. **No Expensive 2D Canvas Effects at 60 Hz**:
   - `#minimap-canvas` MUST keep its static track outline cached on an offscreen canvas (`minimapBgCanvas`), throttle dot redraws to ~20 Hz (`48ms`), and NEVER use `ctx.shadowBlur` (use a flat translucent halo circle instead).
   - `SpeedLinesOverlay` MUST stay disabled (`display: none`) on `particles === 'low'` and avoid per-frame `createRadialGradient` on `'medium'`.
3. **Dispose GPU Resources on Pipeline Switch**: Whenever `GameEngine.applyGraphicsSettings()` rebuilds `EffectComposer` or `WebGLRenderTarget`, explicitly `.dispose()` the previous instances to prevent Android WebView OOM crashes.
4. **Zero Per-Frame GC Allocations**: Reuse scratch `THREE.Vector3` instances inside `GameEngine` and physics loops.

### C. Pure i18n Discipline (`zh` / `en`)
1. **No Mixed Bilingual Slashes**: Never hardcode mixed `"ENGLISH / 中文"` labels in HTML or TS. Every visible UI string must come from `src/i18n/i18n.ts` (`data-i18n`, `data-i18n-html`, `t(...)`, or `i18n.getTrackName/Desc`).
2. **Keep Dictionaries Symmetric**: Adding any key to `ZH` requires adding the matching key to `EN` (TypeScript enforces `Record<I18nKey, string>`). Adding a new track to `TRACK_CONFIGS` requires adding its English title/subtitle/description to `TRACK_EN_DESC` in `src/i18n/i18n.ts`.

### D. Gameplay Opt-In Defaults & Track Geometry Safety
1. **All 3 Assist Switches Default to `false`**:
   - `neon_apex_allow_drift_nitro` (`🔥 漂移同喷`) = `false`
   - `neon_apex_enable_straight_overdrive` (`🚀 长道超频`) = `false`
   - `neon_apex_enable_hyper_nitro` (`⚡ 长道满氮`) = `false`
   Hyper Straight & Overdrive apply strictly to mega circuits (`island`, `manx`, `akina`).
2. **Track Geometry & Drift Standards**: Every new or modified circuit MUST follow `docs/TRACK_AND_DRIFT_DESIGN.md` (`minSep3D >= 100m`, zero bridge/terrain clipping, smooth centripetal spline, automated clearance & 4-mode drift validation).

### E. Lighting, Tone Mapping & PBR Readability Invariants
1. **Keep `THREE.ACESFilmicToneMapping` & Restrained Charcoal Asphalt**: Do NOT switch uncalibrated scenes to `AgXToneMapping` or push `asphaltTint` into pale grey (`#353b47+`), which desaturates cyber-arcade night tones and makes roads look like flat concrete. Keep track `asphaltTint` in the dark charcoal range (`#212835`–`#282c36`) with per-theme `baseExposure` (`1.19–1.27`).
2. **Prevent Grazing-Angle Specular Glare**: Keep `dirRimLight` at steep elevation (`y >= 155`, restrained intensity `0.68–0.82`) and keep `createProceduralEnvMap()` restrained (`scene.environmentIntensity = 1.0`) so grazing Fresnel reflections never blow out Tokyo Bay water or the leftmost lane into pale white bands.
3. **Preset-Independent Scene Brightness**: `graphics.brightness` (`0.8–1.4`, default `1.0`) MUST stay decoupled from `qualityPreset` (like `showFps`), scaling `renderer.toneMappingExposure = this.baseExposure * brightness` in O(1) without rebuilding `EffectComposer`. In `SettingsUI.ts`, guard range-slider `input` handlers with `suppressRender` so dragging on mobile touchscreens never destroys the active `<input>` element.

### F. CSS & Modal Layout Pitfalls (Already Solved — Preserve!)
1. **Modal Specificity**: Scope catalog and settings modal dimensions with ID-prefixed selectors (`#circuit-catalog-modal .modal-card.catalog-modal-card`, `#settings-modal .modal-card.settings-modal-card`) so later `.modal-card` rules never cap their width.
2. **Chromium Short-Landscape WebGL Compositor Bug**: Inside `@media (max-height: 540px)`, modals (`#circuit-catalog-modal`, `#settings-modal`) MUST use opaque `#090f24` backgrounds with `backdrop-filter: none`, `isolation: isolate`, and `transform: translateZ(0)` so WebGL never paints over them.
3. **No CSS Nesting**: Keep all `@media` blocks top-level (never nest `@media` inside `@media`) for full compatibility down to Android WebView API 23.
4. **Safe Areas & Landscape Widths**: Always pad root overlays with `env(safe-area-inset-*)`; keep `.panel-heading h2 { white-space: nowrap; }`; keep `.seg-btn { flex: 1 1 auto; min-width: max-content; }` to avoid portrait clipping.

---

## 4. Essential Commands & Environment Notes

### Development & Build
```bash
npm install
npm run dev                  # Local Vite dev server (port 5173; use -- --port 5179 if needed)
npm run build                # tsc --noEmit && vite build -> ./dist
npm run deploy:dry           # Verify full Web build + Cloudflare Workers bundle dry-run
npm run deploy               # Deploy Web production build to Cloudflare Workers
npm run android:sync         # npm run build && npx cap sync android
```

### Windows + WSL GitHub Push Note
- PowerShell on Windows is **Windows PowerShell 5.1** (do not chain commands with `&&`; use `;` or `$ErrorActionPreference = 'Stop'` multi-line scripts).
- Native Windows `git push` may hang on Git Credential Manager in headless terminals. Use WSL `gh` (`repo` + `workflow` scopes configured) as credential helper when pushing to `origin`:
```powershell
@'
set -e
cd /mnt/e/AI/google/neon-apex
GH_BIN=$(command -v gh)
git -c safe.directory=/mnt/e/AI/google/neon-apex \
    -c credential.helper= \
    -c "credential.helper=!$GH_BIN auth git-credential" \
    push origin main
'@ | wsl -e bash -c "tr -d '\r' > /tmp/push.sh && zsh -lc 'bash /tmp/push.sh' && rm -f /tmp/push.sh" 2>&1
```

### Android APK Build & Testing
- Local Windows PC currently has JDK 8 only; **APK compilation runs via GitHub Actions** (`.github/workflows/build-android.yml`, Ubuntu + Node 22 + JDK 21 + Android SDK 35 + Gradle 8.11.1).
- Pushing to `main` (or running `workflow_dispatch`) builds `NEON-APEX-v2.0.0-android.apk` in ~1.5–2 min and uploads artifact `neon-apex-android-apk`. Download locally via WSL:
  ```bash
  gh run download <RUN_ID> -R rgc-projects/neon-apex -n neon-apex-android-apk -D /mnt/e/AI/google/neon-apex/releases
  ```
- Local Android testing uses official Google **`android` CLI** (`%USERPROFILE%\AppData\AndroidCLI\android.exe`) + `adb` (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`) + AVD `medium_phone` (Android 16, `2400×1080`). **Never touch the user's personal NetEase MuMu VMs (`127.0.0.1:16512`, etc.).**

---

## 5. Mandatory Pre-Commit Verification Gate

Before committing or merging changes to `main`:
1. `npm run deploy:dry` MUST exit `0` (`tsc --noEmit` + `vite build` + `wrangler deploy --dry-run`).
2. If touching UI, CSS, i18n, or rendering: run `npx cap sync android` and verify visually on Desktop (`1280×800`), Mobile Landscape (`915×412`), and Mobile Portrait (`390×844`) with `0` console/WebGL errors (see `docs/TESTING.md`).
3. If modifying `android/` or native bridges: verify GitHub Actions `Build Android APK` succeeds and smoke-test the resulting `.apk` on `emulator-5554` or a connected device (`0` `AndroidRuntime:E` / `Capacitor/Console:E`).
