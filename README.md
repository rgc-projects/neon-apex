# NEON APEX — 3D Arcade Racing (Web + Android)

A dual-platform 3D photorealistic arcade racing game fusing **Need for Speed**'s visceral speed, **OutRun**'s twilight-neon atmosphere, and **Mario Kart / Initial D**'s drift-to-boost flow — built with **Vite + TypeScript + Three.js (WebGL2) + Procedural Web Audio API**, deployed to **Cloudflare Workers Static Assets** and packaged as an offline-ready **Android APK** via **Capacitor 7**.

---

## Key Features

- **10 Distinct Handcrafted Circuits (3.4 km to 60.7 km 1:1 Endurance)**:
  | # | Circuit | Chinese Name | Length | Max Bank | Default Laps | Highlights |
  | :-: | :--- | :--- | :---: | :---: | :---: | :--- |
  | 1 | Tokyo Bayshore Expwy | 东京湾岸高速 | 3.85 km | 30° | 3 | Elevated urban night highway, 90° ramps & 30° skyline bowl |
  | 2 | Hyperion Bay Bridge | 海湾跨海大桥 | 4.16 km | 34° | 3 | Golden-hour suspension bridge, 34° ocean bowl & Suzuka S-curves |
  | 3 | Sub-Zero Express Tunnel | 地下高速隧道 | 3.40 km | 35° | 3 | Vaulted concrete tunnels, giant vents & 35° Karussell bowl |
  | 4 | Akina Mountain Pass | 秋名山盘山夜道 | 3.68 km | 34° | 3 | Moonlit alpine pass, pine fog & 4 varied-bank downhill hairpins |
  | 5 | Monaco Harbor GP | 摩纳哥海滨赛道 | 4.10 km | 11° | 3 | Precision 4°–11° low-bank technical street hairpins & harbor tunnel |
  | 6 | Apex Grand Island | 极境环岛大满贯 | 11.9 km | 34° | 2 | Multi-biome coastal tour: city, bridge, volcano, tunnel & lighthouse |
  | 7 | Isle of Man TT | 曼岛 TT 斯奈菲尔环岛 | 60.7 km | 32° | 1 | True 1:1 Snaefell Mountain Course, 160+ bends & Sulby hyper straight |
  | 8 | Nujiang 72 Bends | 怒江 72 拐盘山天路 | 7.32 km | 18° | 2 | G318 Tibetan plateau stacked Z-hairpins (154m drop, R=39m bends) |
  | 9 | Aurora Fjord Labyrinth | 极光星湾 24 弯迷宫 | 20.8 km | 20° | 1 | 11-arm radial basalt fjord labyrinth under animated northern lights |
  | 10 | Super Akina Touge | 超级秋名山 · 极限蛇形天道 | 26.1 km | 35° | 1 | 5 extreme-banked rollercoaster serpentine ribbons, 5 hairpins & 3 straights |

- **Scalable Two-Tier Circuit Browser**: Fixed-height sidebar hub (Hero blueprint preview, `◀/▶` quick stepping, category filters, `localStorage` favorites) + full-screen `1040px` Blueprint Grid Catalog modal with instant search, sorting, and category counters.
- **3 Playable GT Supercars**:
  - **APEX-V12** (*Balanced* / 均衡型) — All-round GT3 downforce and predictable drift control.
  - **PHANTOM-X** (*Top Speed* / 极速型) — Low-drag Le Mans speed weapon with quad super-nitro thrust.
  - **KATANA-RS** (*Drift Master* / 漂移型) — Lightweight touge drift GT with rapid snap rotation and boost charging.
- **Full Bilingual i18n (`简体中文` / `English`)**: Zero-reload language toggle in the header and Settings modal with automatic system locale detection and persistence across menus, all 10 tracks, HUD telemetry, pause, and results.
- **Commercial-Grade 4-Tab Settings Hub & Real-Time Graphics Engine**:
  - **Graphics**: 4 presets (*Low / Medium / High / Ultra*) + automatic hardware tiering (Desktop PC defaults to full *Ultra* DPR 2.0 + 4× WebGL2 MSAA + HDR Bloom + SMAA; mobile devices auto-scale), plus live Resolution Scale (`75%–150%`), FPS Cap (`30/60/90/120/Max`), Anti-Aliasing (`Off/SMAA/2×MSAA/4×MSAA+SMAA`), Lens Bloom (`Off/Soft/Cinematic`), Particle/Speedlines Density, Draw Distance (`Near/Medium/Far`), and Live FPS / frame-time monitor.
  - **Controls**: 3 mobile steering modes (*Dynamic Floating Joystick*, *Classic Left/Right Buttons*, *Gyroscope Tilt*), Auto-Throttle toggle, Steering Sensitivity, Touch Button Scale (`80%–125%`) & Opacity (`45%–100%`), Haptic Vibration, and Default Camera (*Chase / Hood*).
  - **Audio**: 100% procedural Web Audio engine (6-gear RPM synth, tire screech, nitro jet, SFX, synthwave BGM) with independent Master / SFX / BGM sliders and zero external audio files.
- **Opt-In Race Assists (All Default OFF)**: Toggle *Drift Nitro* (`🔥 漂移同喷`), *Straightaway Overdrive* (`🚀 长道超频`), *Hyper Straight Infinite Nitro* (`⚡ 长道满氮`), and *1 / 2 / 3 Laps* from the menu or pause screen.
- **Mainstream Smartphone & Android APK Ready**: Full `env(safe-area-inset-*)` notch/punch-hole support, dual-side landscape lock, edge-to-edge immersive fullscreen, keep-screen-on during races, native Haptics, auto-pause on app background, and smart Android Back button navigation.

---

## Controls

| Input | Action |
| :--- | :--- |
| `W / S` or `↑ / ↓` | Throttle / Brake & Tap-Brake Drift (hold in green zone during `3-2-1` for **Perfect Start**) |
| `A / D` or `← / →` | Steer (tighten apex or counter-steer wide slip angles during drift) |
| `Space` (Hold) | Handbrake Drift (release after charging for Tier 1–3 Drift Boost) |
| `Shift` / `E` / `N` | Nitro / Super Nitro (≥82% triggers Overdrive boost) |
| `C` / `R` / `M` / `Esc` | Camera (`CHASE`/`HOOD`) / Track Reset / Mute / Pause |
| **Mobile Touch** | Floating Analog Joystick, Classic Left/Right Buttons, or Tilt Gyro + right thumb-arc (`DRIFT` / `NITRO` / `BRAKE` / `GAS`) |

---

## Local Development & Web Deployment

```bash
# 1. Install dependencies & run local dev server
npm install
npm run dev

# 2. Type-check & build production web bundle -> ./dist
npm run build

# 3. Verify Cloudflare Workers Static Assets bundle
npm run deploy:dry

# 4. Deploy live to Cloudflare Workers
npm run deploy
```

---

## Android APK Packaging (Capacitor 7)

This project uses a **single codebase**: Cloudflare Workers deploys `./dist`, while Capacitor 7 wraps `./dist` into `android/` for 100% offline Android gameplay.

- **Automated Cloud Build (Recommended)**: Pushing to `main` or manually triggering **Actions → Build Android APK** compiles and uploads an installable signed APK (`NEON-APEX-v2.0.0-android.apk`).
- **Local Sync & Android Studio**:
  ```bash
  npm run android:sync     # Builds ./dist and syncs assets + 4 Capacitor plugins into android/
  npm run android:open     # Opens android/ in Android Studio (requires JDK 21 + Android SDK 35)
  ```

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [AGENTS.md](./AGENTS.md) | Engineering architecture, strict invariants, CSS/WebView pitfalls & AI agent instructions |
| [docs/HANDOFF.md](./docs/HANDOFF.md) | Project handover, milestone changelog, dev environment inventory & next-phase backlog |
| [docs/TESTING.md](./docs/TESTING.md) | Web multi-viewport QA matrix, Android 16 emulator verification playbook & FPS benchmarks |
| [docs/TRACK_AND_DRIFT_DESIGN.md](./docs/TRACK_AND_DRIFT_DESIGN.md) | Circuit geometry proportions, banking rules, zero-clipping terrain & drift physics spec |

---

## Credits & License

- Game source code & procedural assets: **MIT License**.
- Base 3D Supercar mesh (`public/models/supercar.glb`): *Ferrari 458 Italia* by `vicent091036`, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), customized with procedural metallic clearcoat PBR materials, GT3 carbon aero kits, and reactive lighting.
