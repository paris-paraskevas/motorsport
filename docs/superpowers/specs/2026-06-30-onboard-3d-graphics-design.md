# Onboard 3D graphics overhaul — design spec

**Status:** approved direction (brainstormed 2026-06-30), not yet built.
**Owner:** operator + Claude.
**Extends:** `docs/research/onboard-3d-rebuild.md` (the parent spec — P2 real track, P4 car models). This doc supersedes that spec's *sequencing* per the decisions below; it does not replace its research.
**Touches:** `components/f1/GhostLap3D.tsx`, `components/f1/QualifyingDecoder.tsx`, `components/f1/GhostLapReplay.tsx` (removed), new `components/f1/onboard/*` + `lib/openf1/track-environment.ts` + `lib/onboard/useQualityTier.ts`.

## Goal

Make the F1 qualifying **onboard 3D** view look dramatically more realistic — a real car model and a dressed trackside environment (barriers, grandstands, trees, banners) — **carefully**, i.e. without dropping frames on a mid-range phone, and **for every track on the calendar**, not just Austria.

The motion is solid as of 0.130.2 (the de-jitter — confirmed on-lap, no ghost surging), so the 2D ghost-replay fallback is retired in favour of 3D-only.

## Reframe / priority (operator, 2026-06-30)

The headline is **coverage + the car model**, not bespoke per-circuit art: "have all of the rest of the tracks on the calendar made like Austria and the model of the car ready, then just load drivers' data and get the 3D result we have for Spielberg."

**Key enabling fact:** the onboard track is **not hardcoded** — `buildDecoderTraces` → `reconstructCircuit` (`lib/openf1/decoder.ts` + `track.ts`) rebuilds the circuit at runtime from *that session's* GPS. So the onboard already generalises to every quali automatically. "All tracks like Austria" is therefore **verify + dress procedurally**, not per-track hand-building.

## Locked decisions

1. **Track geometry: reconstructed now, real later.** Ship full-calendar coverage on the current GPS-reconstructed track + the new dressing. Defer the parent spec's P2 (real 1:1 geometry via TUMFTM/OSM + Kabsch–Umeyama) to a later marquee-circuit upgrade.
2. **Environment: generic procedural, adaptive tiers.** One procedural system dresses every reconstructed track from its centreline; one scene that auto-scales desktop↔mobile. (Not asset-heavy bespoke; not minimal.)
3. **Ad/banner branding: generic / fictional.** Invented "Paddock" + fictional-sponsor board art. No real F1/team/sponsor trademarks (IP risk on a monetised public site; consistent with the parent spec's no-team-IP rule).
4. **Drop 2D = only the 2D ghost replay.** Remove the 2D/Onboard toggle + `GhostLapReplay`; the 3D onboard becomes the sole replay. **Keep** the "Speed & cumulative delta" (`DeltaTrace`) and "Dominance map" (`MinisectorMap`) analytical charts.
5. **Car model:** the CC-BY "Blender458 F1 2022" glTF (https://fetchcfd.com/view-project/4314-f1-3d-model), recoloured per team, no team liveries/logos.

## Architecture

The data + reconstruction pipeline is **unchanged**. `GhostLap3D` already receives, per session, a reconstructed `circuit` (centreline + per-point left/right width) and each driver's `track` line + telemetry. The overhaul adds procedural *consumers* of that centreline plus a device-quality hook. Everything new is GPU-instanced so it generalises to any track at near-constant draw-call cost.

### New units (each isolated, one responsibility)

- **`components/f1/onboard/CarModel.tsx`** — loads the CC-BY glTF via drei `useGLTF` (Draco-compressed), renders the two cars through `<Instances>` with a per-instance team colour, and applies cosmetic body-lean from telemetry-derived g (`a_lat = v²·κ` roll, `a_lon = dv/dt` pitch, damped). Replaces the box-built `F1Car` in `GhostLap3D`.
  - *Interface:* `<CarModel colour ghost tRef motion />` (same per-car contract the current `CarRig` uses).
  - *Depends on:* the GLB asset, `three`/drei, the motion sampler.
- **`lib/openf1/track-environment.ts`** — **pure** geometry builder. Input: `(centreline: Vec3[], halfLeft: number[], halfRight: number[], tier)`. Output: typed transform lists — `barriers` (edge ribbons + tyre-stack positions at apexes), `grandstands` (transforms at curvature maxima), `trees` (scatter transforms on the runoff), `banners` (board transforms along barriers). No three.js objects, no React → unit-testable from a centreline fixture.
- **`components/f1/onboard/TrackEnvironment.tsx`** — renders the builder's output as instanced meshes: barrier/Armco + concrete + tyre stacks, tiered grandstand meshes with a crowd texture, low-poly/billboard trees, and banner boards with the generic-sponsor texture atlas.
- **`lib/onboard/useQualityTier.ts`** — device/GPU heuristic → `'high' | 'low'`. Drives instance counts (stands/trees), material/shader complexity, shadow on/off, and Canvas `dpr`. This is the "carefully" knob.

### Changed / removed

- **`GhostLap3D.tsx`** — swap `F1Car`→`CarModel`; mount `<TrackEnvironment>`; read `useQualityTier`. Motion math (`buildMotion`/`samplePos`/`sampleHeading`), the chase/cockpit camera, the ghost depth-fade, and the throttle/brake strip are **unchanged**.
- **`QualifyingDecoder.tsx`** — remove the `2D | Onboard` toggle + the `ghost3d` state; render the onboard directly. `DeltaTrace` + `MinisectorMap` stay.
- **`GhostLapReplay.tsx`** + `LazyGhostLap3D`'s 2D sibling path — deleted.

## Asset pipeline

- **Car model:** download the CC-BY GLB, verify the exact licence + that it carries no team trademarks at integration time, Draco/meshopt-compress, commit under `public/models/f1-2022/` with a `LICENSE`/attribution note. Lazy-loaded (the existing `dynamic({ssr:false})` keeps three + the model off the critical path).
- **Textures:** crowd texture + generic-sponsor banner atlas authored or CC0-sourced, committed under `public/onboard/`. No real brands.
- **Attribution:** add the CC-BY car credit to the existing OpenF1 attribution footer (`OpenF1Attribution`).

## Performance budget

- Instance every repeated element (one draw call per type); frustum-cull; cap the scatter.
- **Adaptive tiers:** mobile (`'low'`) → fewer stands/trees, simpler materials, no shadows, `dpr` capped at 1; desktop (`'high'`) → full dressing, higher `dpr`.
- Keep the lazy route-split. Target: hold ~30–60 fps on a mid-range phone. **Verified by the prototype (below), not assumed.**

## Licensing

CC-BY car (attributed); generic/fictional banner + crowd art (own/CC0); no team liveries, logos, or real sponsor marks. Matches the parent spec's licensing rules.

## Rollout — prototype gate first

1. **Prototype (visual gate):** integrate `CarModel` + `TrackEnvironment` on **Austria (round 8) only**, deploy to a Vercel preview, capture desktop + mobile-viewport screenshots for operator sign-off on **look + smoothness**. No calendar-wide change yet.
2. **Generalise:** because the dressing is procedural off the centreline, it auto-applies to every track — spot-check 2–3 other circuits' previews (incl. a tight/street-ish one) for reconstruction + dressing quality.
3. **Ship:** remove the 2D replay; release (CHANGELOG + RELEASES + version bump on the feature PR).
4. **Deferred:** real-geometry upgrade for marquee circuits (parent spec P2).

## Testing

- **Unit:** `track-environment.ts` against a known centreline fixture — barrier vertex counts, stand placement at curvature maxima, deterministic scatter (seeded), tier scaling.
- **Visual/perf:** the step-1 preview gate (desktop + mobile screenshots, frame-rate check). The existing reduced-motion + NaN guards in `GhostLap3D` stay.

## Risks / open questions

- **Model fetch + licence (highest):** the fetchcfd asset may require a login or block datacenter IPs; the exact CC-BY terms + trademark-cleanliness must be confirmed at download. Fallback: a CC0 generic open-wheel model (parent spec lists Meshy CC0 / Khronos samples).
- **Mobile perf:** the real unknown — proven or adjusted at the prototype gate, not before.
- **Reconstruction quality varies per track:** some circuits' GPS may reconstruct messier than Austria; surfaced by the step-2 spot-check (this is also why P2/real-geometry stays on the roadmap).
- **Banner/crowd art sourcing:** must be own/CC0; authoring time is a small cost.

## Out of scope (won't touch)

Motion math (`buildMotion` — works, no reason to risk it); the decoder/data pipeline; real-geometry P2; pit-lane geometry (later); the non-onboard Decoder surfaces (SectorBars, DeltaTrace, MinisectorMap stay as-is beyond the toggle removal); the all-driver picker/overlay (parent spec P1 — separate track).
