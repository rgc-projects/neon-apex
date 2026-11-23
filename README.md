# NEON APEX // 3D Cyber Arcade Racing

An original 3D futuristic arcade racing game fusing **Need for Speed**'s sense of speed, **OutRun**'s synthwave neon aesthetics, and **Mario Kart**'s exhilarating drift-to-boost mechanics — built with **Vite + TypeScript + Three.js + WebGL UnrealBloom + Web Audio API**, ready to deploy globally on **Cloudflare Workers Static Assets**.

## Features

- **High-Contrast Neon Cyber Visuals**: Three.js WebGL renderer with `UnrealBloomPass`, metallic clearcoat supercar paint (`MeshPhysicalMaterial`), dynamic headlights, reactive LED brake lights, soft radial underglow, and procedural Canvas textures.
- **3 Playable Cyber GT Supercars**:
  - `APEX-V12` (Balanced) — Carbon GT wing & electric cyan trim
  - `PHANTOM-X` (Top Speed) — LMP dorsal shark fin, dual-plane wing & quad super-nitro thrusters
  - `KATANA-RS` (Drift Master) — High-mount swan-neck drift wing, front canards & hyper drift charge
- **3 Distinct 3D Tracks** with auto-calculated banked corners (up to 28°), undulating elevation, jump ramps, boost pads, and smashable neon cones:
  1. **Neo Tokyo Overdrive** (Neon Cyber Highway)
  2. **Hyperion Bay Bridge** (Cyber Sea-Crossing Suspension Bridge)
  3. **Sub-Zero Tunnel** (Underground Hex-Ribbed Megatunnel)
- **Arcade Physics & Game Juice**: Drift-to-boost (3 charge tiers: Cyan → Gold → Magenta), Super Nitro Overdrive (≥82%), Slipstream drafting, ground skid marks, drift sparks & tire smoke, radial speed lines, Dynamic FOV, 5 intelligent AI rivals with rubber-banding, and finish-line slow-motion replay.
- **100% Procedural Web Audio Engine**: Dynamic 6-gear RPM engine synth, drift tire screech, turbo nitro whoosh, collision/cone SFX, and a 126 BPM Synthwave BGM sequencer with zero external audio dependencies.
- **Desktop + Mobile Multi-Touch Ready**: Responsive landscape & portrait mobile HUD with continuous slide steering pad, multi-touch Drift / Nitro / Brake / Rev buttons, and toggleable Auto-Throttle (`AUTO`).

## Controls

| Input | Action |
| :--- | :--- |
| `W / S` or `↑ / ↓` | Throttle / Brake & Reverse (Hold in green zone during `3-2-1` for **Perfect Start**) |
| `A / D` or `← / →` | Steer (tighten apex or widen arc while drifting) |
| `Space` (Hold) | Arcade Drift (release after charging for Drift Boost + Nitro) |
| `Shift` | Nitro / Super Nitro (≥82% triggers purple Overdrive flames) |
| `C` | Toggle Camera (3rd-Person Chase / 1st-Person Hood) |
| `R` | Reset to Track |
| `M` / `Esc` | Mute Audio / Pause |
| **Touchscreen** | Auto-enabled on phones (or tap `📱` anytime): left slide-steer pad + right `DRIFT` / `NITRO` / `BRAKE` + `AUTO` throttle toggle |

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Cloudflare Workers

This repository is pre-configured for **Cloudflare Workers Static Assets** via `wrangler.jsonc`.

### Option A: Automatic Git Deployment (Cloudflare Dashboard)
1. Open the Cloudflare Dashboard → **Workers & Pages** → **Create** → **Workers** → **Import a repository**.
2. Select this GitHub repository.
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
4. Click **Save and Deploy**.

### Option B: CLI Deployment
```bash
npm install
npx wrangler login
npm run deploy
```

Preview locally inside the Cloudflare Workers runtime:
```bash
npm run cf:dev
```

## Credits & License

- Game code & procedural assets: MIT License.
- Base 3D Supercar mesh (`public/models/supercar.glb`): *Ferrari 458 Italia* by `vicent091036` (via Three.js examples / Sketchfab), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), customized with procedural metallic clearcoat materials, Cyber GT aero kits, and neon lighting.
