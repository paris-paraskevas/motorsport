# Onboard 3D rebuild — architecture spec

**Status:** approved direction, not yet built. **Owner:** operator + Claude. **Created:** 2026-06-30.

The reference doc for rebuilding the F1 qualifying onboard/comparison view (`components/f1/GhostLap3D.tsx`) from "a track reconstructed from one car's racing line" into a real, generalizable comparison tool.

## Goal (operator requirements, verbatim intent)

1. A **1:1 replica of the real track**, **distinct from the racing lines** (today the track is wrongly derived from the fastest lap's line).
2. **Every driver** laid on the track with their **own distinct racing line + pace**, **full lap** (lap start → lap end).
3. **Pick any two drivers** → compare their distinct lines + pace over one lap.
4. **Realistic F1 car models** where licensing allows (CC0/CC-BY, no team IP).
5. **Broadcast-style cameras** positioned per track ("advantageous / cinematic spots").
6. Must work for **every track and every qualifying** — generalizable + automatable.

## Library verdict

- **Keep:** three.js + `@react-three/fiber` v9 + `@react-three/drei` v10 (what we use). Correct for all of this.
- **Add:** drei `useGLTF` + `<Instances>` (load + GPU-instance real car models), Draco/meshopt compression, lazy-load. A **build-time geometry/alignment step** (Python+scipy or JS).
- **REJECT physics engines (cannon.js / cannon-es / rapier / ammo).** The cars **replay recorded GPS** — pure kinematic interpolation; the recorded path *is* ground truth. A physics body would simulate nothing (we'd overwrite its transform every frame) while adding a ~1 MB WASM dep + a fixed-tick-vs-framerate interpolation problem. (cannon-es is also dormant — last release 2022; rapier is the live engine but still the wrong tool here.) Cosmetic body lean is faked kinematically (see §Cars).

## Architecture: per-CIRCUIT (build once) vs per-SESSION (runtime)

This split is the entire "every track, every quali" answer. Per-circuit assets are computed offline + committed as static content (like our circuit SVGs); a new quali only fetches per-session driver data.

| Layer | Scope | Source | When | Stored as |
|---|---|---|---|---|
| Track geometry (centreline + width) | per circuit | TUMFTM DB / OSM | build-time | `content/circuits-3d/<slug>/track.json` |
| Elevation profile | per circuit | OpenF1 `z` (default) / DEM | build-time | same file |
| OpenF1→track alignment transform | per circuit | computed (Umeyama fit) | build-time | same file |
| Broadcast camera rig | per circuit | computed (curvature) + curated | build-time | same file |
| Driver lines + pace (all drivers) | per session | OpenF1 `location` + `car_data` | runtime | KV cache (immutable) |

## 1. Track geometry (real, distinct from the lines)

**Primary source — [TUMFTM/racetrack-database](https://github.com/TUMFTM/racetrack-database)**: real **centreline + measured left/right width in metres** for ~19 circuits, derived from OSM centrelines + satellite width-tracing. Covers (current F1): Spielberg/Austria, Monza, Silverstone, Spa, Suzuka, Zandvoort, Catalunya, Bahrain/Sakhir, Mexico, Montreal, São Paulo, Shanghai, Austin/COTA, Hungaroring/Budapest, Melbourne. Format: `[x_m, y_m, w_tr_right_m, w_tr_left_m]`. **No elevation (z).** **License: LGPL-3.0** — usable; must attribute TUMFTM + keep our *derived* track files open (does NOT infect our app code).

**Coverage gap (honest):** TUMFTM covers ~15 of the ~24 current calendar tracks. Missing: **Jeddah, Miami, Imola, Monaco, Las Vegas, Qatar/Lusail, Baku, Singapore** — fall back to **[OSM `highway=raceway`](https://wiki.openstreetmap.org/wiki/Tag:highway=raceway)** centreline via Overpass (ODbL) + a width estimate (constant ~12–15 m or satellite-traced). **Street circuits are the hardest** (public roads in OSM, messy geometry) → per-track effort, not free.

**Mesh build:** feed centreline + per-point width into the existing ribbon builder (`buildRibbon` in `GhostLap3D.tsx`) — it already turns a centreline + widths into an asphalt strip + red/white kerbs + white lines. Just fed by the REAL geometry instead of the reconstructed line. Handle the closed loop; pit lane optional (P5).

## 2. Elevation (two tiers)

- **Default (all tracks, free, ship now):** drape the track's elevation from **OpenF1's own `z`** — real surveyed elevation along where the cars drove; we already have it. Sufficient for the racing surface (all you see).
- **Optional upgrade (marquee tracks only):** a real DEM for surrounding terrain + cross-track detail. **Do NOT automate LIDAR across all 24** — it's a patchwork (per-country portals, differing CRS/datums, **Spain's 1 m data is behind a commercial paywall**, Italy/Austria publish only 10 m nationally, NL's AHN5 will hard-replace AHN4). Approach: uniform **Copernicus GLO-30** (free, one global dataset) baseline + hand-pulled **1 m LIDAR for clean-licensed marquees** — Silverstone (OGL), Zandvoort (CC0), Spa (Wallonia open), COTA/Miami/Vegas (USGS 3DEP, public domain). Build-time: resample the centreline to ~5 m in UTM → bilinear-sample the GeoTIFF → light Gaussian / Savitzky-Golay smooth. **P5 polish.**

## 3. Alignment (the crux)

OpenF1 positions are a **local metres frame with arbitrary origin, rotation, and handedness** (per session). The real track is a *different* metres frame. Fit a **2D similarity transform** (rotation + translation; scale ≈ 1 since both are metres) with the **[Kabsch–Umeyama algorithm](https://zpl.fi/aligning-point-patterns-with-kabsch-umeyama-algorithm/)** (SVD closed-form, with the determinant fix that prevents a mirror flip).

**Recipe, offline per circuit:**
1. Resample both closed loops (a reference OpenF1 lap + the track centreline) by arc-length to N equal points → correspondence without labels.
2. Umeyama fit; **try both handedness + both traversal directions**, keep the lowest residual (catches mirror/direction ambiguity).
3. RANSAC to reject outliers (pit lane, GPS spikes); verify residual < threshold; **flag bad fits for manual fix**.
4. Store the transform (tiny JSON). Runtime applies it to all drivers' lines.

**Risk:** poor fit on awkward/street tracks → lines sit off the tarmac. Mitigation: build-time + per-track verification; prove on 2–3 tracks before committing to all. Libraries: numpy/scipy (build-time Python) or a small JS impl.

## 4. Drivers (all, distinct lines, full lap)

Per quali session, for **every driver**: fetch their fastest valid lap's `location` (their distinct real line) + `car_data` (pace), run through the de-jittered motion pipeline (`buildMotion` — clean → spike-reject → **re-time for timestamp jitter**), apply the circuit transform. ~20 location fetches, rate-paced, cached hard (immutable). Pick any two → time-synced replay comparing line + pace. Quali nuance: "fastest lap" = best valid lap across Q1/Q2/Q3 (current behaviour); later, let users pick the specific lap (e.g. the Q3 pole lap).

## 5. Cars (realistic, open-licensed)

**Reality:** realistic + open-licensed + non-team-IP is a narrow intersection. Real team cars (Ferrari SF90, Verstappen Red Bull) exist as CC-*mesh* models but carry **team/driver trademark** risk on a public ad-supported site — **avoid**.

**Recommended:** a **CC-BY generic modern-F1 car**, recoloured per team, attributed. Concrete candidates (verify exact license + that it's non-branded at integration):
- **[Blender458 "F1 2022"](https://fetchcfd.com/view-project/4314-f1-3d-model)** — CC Attribution, GLB, generic modern-F1 shape. Top pick.
- **[Meshy F1 (CC0)](https://www.meshy.ai/tags/f1)** — no attribution, GLB, AI-generated (realism variable) — fallback.
- CC0 primitives: [Kenney](https://kenney.nl), [Poly Haven](https://polyhaven.com), [Khronos glTF sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets).

**Load + perf:** `useGLTF` + Draco/meshopt; **GPU-instance** via drei `<Instances>` (one mesh, per-instance team colour) so 2→20 cars stay cheap on mobile; lazy-load off the critical path (keep the `LazyGhostLap3D` pattern).

**Cosmetic body lean (no physics):** two-layer rig — a `carRoot` (world position + yaw from path tangent) and a `carBody` child that only tilts. Drive tilt from telemetry-derived g: `a_lat = v²·curvature` (roll), `a_lon = dv/dt` (pitch — nose-dive braking, squat on power), small gradients + tight clamps, critically damped (`THREE.MathUtils.damp`). Subtle vertical bump from the `z` residual over kerbs. All plain three.js in `useFrame`.

## 6. Broadcast cameras (per track)

No public dataset of real F1 camera positions exists. **Derive from the centreline** (generalizes to every track):
- Smooth the polyline (Douglas-Peucker) → discrete curvature (turning-angle) → **local curvature maxima = corners/apexes** (the method in this [2026 curvature-analysis paper on F1 lines](https://www.mdpi.com/2076-3417/16/3/1596)).
- Place a fixed camera per significant corner: **outside the corner (convex side), set back + elevated, aimed at the apex.**
- **Director:** cut to the camera nearest/best-angle to the followed car(s), sensible cut timing.
- **Framing:** each camera **pans (lookAt the car) + zooms (FOV/dolly by distance)** so small distant cars stay framed — fitting two cars when far apart zooms out / follows the leader.
- Ships as a third **View mode (Trackside)** alongside Chase/Cockpit.

**Curated "hero" cameras (marquee tracks):** layer hand-tuned cinematic angles on the auto-placement for the famous corners — Eau Rouge–Raidillon / Pouhon / Blanchimont (Spa), Maggotts–Becketts–Chapel / Copse (Silverstone), 130R / Esses / Spoon (Suzuka), Parabolica(Alboreto) / Ascari / Lesmo (Monza), Casino / Hairpin / Swimming Pool (Monaco), Wall of Champions (Montreal), Campsa (Catalunya), T1+T3 (Red Bull Ring), Tarzan + the banked final corner (Zandvoort). Sources: [Formula1.com](https://www.formula1.com/en/latest/article/130r-blanchimont-and-the-wall-of-champions-our-writers-on-the-trickiest.2FDbAXxaAHdkjkTkZQeIby), [EssentiallySports](https://www.essentiallysports.com/from-eau-rouge-to-130r-list-of-f1-most-iconic-and-challenging-corners/).

## 7. Phasing + parallelization

- **P1 — all-driver roster + picker** (no new track): fetch/cache every driver's line for the session, pick any two. Pure extension of today's tool. *Independent — can start immediately, parallel to everything.*
- **P2 — real track + alignment**: TUMFTM/OSM geometry, build-time Umeyama transform per circuit, elevation from `z`. Start with the ~15 TUMFTM tracks. *The build-time per-circuit work parallelizes ACROSS tracks.*
- **P3 — broadcast cameras**: curvature auto-placement + director + curated hero cameras. *Needs P2's geometry; the curated-corner curation can be researched in parallel.*
- **P4 — real car models + body lean**: generic CC-BY glTF, instancing, kinematic tilt. *Independent of P2/P3 — parallel.*
- **P5 — long-tail tracks** (street circuits via OSM) + DEM elevation upgrades + curated camera overrides. *Per-track, parallel.*

Parallel tracks: **{P1, P4}** can run alongside **P2**; **P3** follows P2; **P5** is ongoing per-track. The build-time pipeline (scripts) and the runtime component can be built concurrently.

## 8. Licensing summary

- Track geometry: TUMFTM **LGPL-3.0** (attribute + keep derived data open) or OSM **ODbL** (attribute). 
- Elevation: Copernicus (free), USGS 3DEP (public domain), UK OGL, NL CC0 — all fine; **Spain 1 m = commercial paywall (avoid/skip)**.
- Cars: CC-BY (attribute) generic, **no team trademarks/liveries/logos**. 
- Keep an attributions surface (we already render OpenF1 attribution).

## 9. Open questions / risks

- Alignment quality on street circuits (biggest risk) — prove early.
- TUMFTM frame vs OpenF1 frame handedness — resolve in the fit (try both).
- Data volume: ~20 location fetches/session — pace + cache; pre-warm cron later.
- Exact car asset license — verify per-asset before shipping.
- "Realistic team cars" is **not** legally available — generic recoloured is the ceiling.

## Sources

- [TUMFTM/racetrack-database](https://github.com/TUMFTM/racetrack-database) · [f1tenth_racetracks](https://github.com/f1tenth/f1tenth_racetracks) · [OSM highway=raceway](https://wiki.openstreetmap.org/wiki/Tag:highway=raceway)
- [Kabsch–Umeyama alignment](https://zpl.fi/aligning-point-patterns-with-kabsch-umeyama-algorithm/) · [Umeyama notes](https://hunterheidenreich.com/notes/interdisciplinary/computational-biology/umeyama-similarity-transformation/)
- [Curvature analysis of F1 racing lines (MDPI 2026)](https://www.mdpi.com/2076-3417/16/3/1596)
- Cars: [Blender458 F1 2022 (CC-BY)](https://fetchcfd.com/view-project/4314-f1-3d-model) · [Meshy F1 (CC0)](https://www.meshy.ai/tags/f1) · [Khronos glTF sample assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
- Physics: [react-three-rapier](https://github.com/pmndrs/react-three-rapier) (active) · [cannon-es](https://github.com/pmndrs/cannon-es) (dormant)
- Elevation: [Copernicus DEM](https://dataspace.copernicus.eu/) · [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) · [OpenTopography](https://opentopography.org/)
- Corners: [Formula1.com](https://www.formula1.com/en/latest/article/130r-blanchimont-and-the-wall-of-champions-our-writers-on-the-trickiest.2FDbAXxaAHdkjkTkZQeIby) · [EssentiallySports](https://www.essentiallysports.com/from-eau-rouge-to-130r-list-of-f1-most-iconic-and-challenging-corners/)
