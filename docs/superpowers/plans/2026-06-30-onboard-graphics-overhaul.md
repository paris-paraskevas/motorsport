# Onboard 3D Graphics Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the box-built onboard car with a CC-BY F1 glTF and dress every reconstructed track with a procedural environment (barriers, grandstands, trees, generic banners) at adaptive perf tiers, then retire the 2D ghost replay — proven on an Austria prototype before any calendar-wide rollout.

**Architecture:** The reconstructed-track pipeline (`buildDecoderTraces` → `reconstructCircuit`) is unchanged. Two new procedural *consumers* of the circuit centreline (a real car model + a procedural environment) plus a device-quality hook are wired into `GhostLap3D`. Everything new is GPU-instanced so it generalises to any track at near-constant draw-call cost. A prototype-on-Austria visual gate precedes rollout.

**Tech Stack:** Next.js 16 / React 19, three.js + `@react-three/fiber` v9 + `@react-three/drei` v10 (`useGLTF`, `<Instances>`, Draco), Vitest. Spec: `docs/superpowers/specs/2026-06-30-onboard-3d-graphics-design.md`.

---

## File structure

| File | Responsibility | New/Modify |
|---|---|---|
| `public/models/f1-2022/car.glb` | CC-BY car asset (Draco-compressed) + `ATTRIBUTION.md` | Create |
| `public/onboard/` | generic banner atlas + crowd texture (own/CC0) | Create |
| `lib/onboard/useQualityTier.ts` | device/GPU heuristic → `'high' \| 'low'` | Create |
| `lib/onboard/useQualityTier.test.ts` | hook-logic unit test (pure tier function) | Create |
| `lib/openf1/track-environment.ts` | **pure** geometry builder: barriers/stands/trees/banners from a centreline | Create |
| `lib/openf1/track-environment.test.ts` | unit tests against a centreline fixture | Create |
| `components/f1/onboard/CarModel.tsx` | glTF car: instanced, per-team colour, kinematic lean | Create |
| `components/f1/onboard/TrackEnvironment.tsx` | renders the builder output as instanced meshes | Create |
| `components/f1/GhostLap3D.tsx` | swap `F1Car`→`CarModel`, mount `<TrackEnvironment>`, read tier | Modify |
| `components/f1/QualifyingDecoder.tsx` | remove the `2D \| Onboard` toggle + `ghost3d` state | Modify |
| `components/f1/GhostLapReplay.tsx` | the 2D replay — deleted in Phase 3 | Delete |
| `components/f1/OpenF1Attribution.tsx` | add CC-BY car credit | Modify |

Phases: **1 = Austria prototype (gate)**, **2 = generalise**, **3 = drop 2D + ship**. Do not start Phase 3 until the operator signs off the Phase-1 prototype.

---

## Phase 1 — Austria prototype (visual gate)

### Task 1: Acquire + commit the CC-BY car asset

**Files:**
- Create: `public/models/f1-2022/car.glb`, `public/models/f1-2022/ATTRIBUTION.md`

- [ ] **Step 1: Download + license-verify**

Fetch the model from https://fetchcfd.com/view-project/4314-f1-3d-model. Confirm at download: (a) licence is CC-BY (or CC0), (b) it carries **no** team/sponsor trademarks or driver names. If the site blocks datacenter IPs or requires login, the operator supplies the file, OR fall back to a CC0 generic open-wheel model (Meshy CC0 / Khronos glTF-Sample-Assets per the parent spec). Record the source URL + author + licence in `ATTRIBUTION.md`.

- [ ] **Step 2: Compress to glTF-binary + Draco**

Run (requires `npx`):
```bash
npx @gltf-transform/cli optimize <downloaded>.glb public/models/f1-2022/car.glb --texture-compress webp --draco
```
Expected: a `car.glb` under ~1.5 MB. If the source is `.fbx`/`.obj`, convert via Blender export to glTF first.

- [ ] **Step 3: Inspect the node/mesh names**

Run:
```bash
npx @gltf-transform/cli inspect public/models/f1-2022/car.glb
```
Record the mesh node name(s) for the bodywork (the part to recolour per team) and overall bounding-box length — Task 3 needs both. Expected: a meshes table + scene bounds.

- [ ] **Step 4: Commit**

```bash
git add public/models/f1-2022/
git commit -m "feat(onboard): add CC-BY F1 car model (Draco) + attribution"
```

---

### Task 2: Device quality tier hook

**Files:**
- Create: `lib/onboard/useQualityTier.ts`
- Test: `lib/onboard/useQualityTier.test.ts`

- [ ] **Step 1: Write the failing test (pure tier function)**

```ts
import { describe, it, expect } from 'vitest';
import { tierFor } from './useQualityTier';

describe('tierFor', () => {
  it('returns low for coarse-pointer + few cores (mobile)', () => {
    expect(tierFor({ coarsePointer: true, cores: 4, deviceMemory: 4 })).toBe('low');
  });
  it('returns high for fine-pointer desktop with many cores', () => {
    expect(tierFor({ coarsePointer: false, cores: 12, deviceMemory: 16 })).toBe('high');
  });
  it('returns low when memory is very constrained even on desktop', () => {
    expect(tierFor({ coarsePointer: false, cores: 8, deviceMemory: 2 })).toBe('low');
  });
  it('defaults to low when signals are unknown (safe)', () => {
    expect(tierFor({})).toBe('low');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/onboard/useQualityTier.test.ts`
Expected: FAIL — `tierFor` is not exported.

- [ ] **Step 3: Implement the hook + pure function**

```ts
'use client';
import { useSyncExternalStore } from 'react';

export type QualityTier = 'high' | 'low';
interface Signals { coarsePointer?: boolean; cores?: number; deviceMemory?: number }

/** Pure, testable tier decision. Conservative: unknown → low. */
export function tierFor(s: Signals): QualityTier {
  if ((s.deviceMemory ?? 0) > 0 && (s.deviceMemory as number) < 4) return 'low';
  if (s.coarsePointer) return 'low';
  if ((s.cores ?? 0) >= 8 && !s.coarsePointer) return 'high';
  return 'low';
}

function read(): QualityTier {
  if (typeof window === 'undefined' || !window.matchMedia) return 'low';
  return tierFor({
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    cores: navigator.hardwareConcurrency,
    // deviceMemory is non-standard; guard it.
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  });
}

// Static after mount (device class doesn't change); server snapshot = low (safe, matches mobile-first).
export function useQualityTier(): QualityTier {
  return useSyncExternalStore(() => () => {}, read, () => 'low');
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/onboard/useQualityTier.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/onboard/useQualityTier.ts lib/onboard/useQualityTier.test.ts
git commit -m "feat(onboard): device quality-tier hook"
```

---

### Task 3: Car model component

**Files:**
- Create: `components/f1/onboard/CarModel.tsx`
- Modify: `components/f1/GhostLap3D.tsx` (swap `F1Car` usage inside `CarRig`)

Reuses the existing `CarRig` (`GhostLap3D.tsx` ~L392) which already positions/orients a car each frame from `tRef` + applies the ghost depth-fade. Only the *mesh* changes (box → glTF).

- [ ] **Step 1: Implement CarModel**

```tsx
'use client';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Path served from /public. Draco decoder is drei's default CDN; if offline,
// set useGLTF.setDecoderPath to a self-hosted /draco/ — verify at the gate.
const MODEL_URL = '/models/f1-2022/car.glb';
useGLTF.preload(MODEL_URL);

// CAR_SCALE chosen so the model spans ~40% of the asphalt width, matching the
// old box car. Tune against the screenshot gate using the bounding-box length
// recorded in Task 1 Step 3.
const CAR_SCALE = 0.06;
const BODY_NODE = 'Body'; // <-- replace with the real bodywork node name from Task 1 Step 3

export function CarModel({ colour, ghost }: { colour: string; ghost: boolean }) {
  const { scene } = useGLTF(MODEL_URL);
  // Clone so the two cars (followed + ghost) don't share one material instance.
  const root = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const base = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (mesh.name.includes(BODY_NODE)) base.color = new THREE.Color(colour);
      base.transparent = ghost;
      base.opacity = ghost ? 0.42 : 1; // mirrors GHOST_OPACITY
      base.emissive = new THREE.Color(colour);
      base.emissiveIntensity = ghost ? 0.4 : 0.15;
      mesh.material = base;
    });
    return clone;
  }, [scene, colour, ghost]);
  return <primitive object={root} scale={CAR_SCALE} rotation={[0, Math.PI, 0]} />;
}
```

- [ ] **Step 2: Swap the mesh inside CarRig**

In `components/f1/GhostLap3D.tsx`, inside `CarRig`'s returned group (the inner `<group scale={CAR_SCALE}>...<F1Car/>` block, ~L433-441), replace `<F1Car colour={colour} ghost={ghost} />` with `<CarModel colour={colour} ghost={ghost} />` and remove the now-redundant inner `scale`/re-centre wrapper (CarModel owns its own scale). Add `import { CarModel } from '@/components/f1/onboard/CarModel';` at the top. Leave the depth-fade logic in `CarRig.useFrame` as-is (it traverses materials by `transparent`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (CarModel typed, import resolves).

- [ ] **Step 4: Commit**

```bash
git add components/f1/onboard/CarModel.tsx components/f1/GhostLap3D.tsx
git commit -m "feat(onboard): real glTF car model in CarRig"
```

> Visual correctness (scale, orientation, body colour landing on the right mesh) is verified at the Task 7 gate; `BODY_NODE`/`CAR_SCALE`/rotation are the knobs to tune there.

---

### Task 4: Procedural environment geometry builder (pure, TDD)

**Files:**
- Create: `lib/openf1/track-environment.ts`
- Test: `lib/openf1/track-environment.test.ts`

Pure functions over a closed centreline polyline in scene space (the same `THREE.Vector3[]` the ribbon uses) + per-point half-widths. No three.js objects beyond `Vector3` math, no React → fully unit-testable.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { buildEnvironment, cornerIndices } from './track-environment';

// A unit circle (closed loop) as a centreline fixture — curvature is uniform,
// width constant 0.1, 64 points.
const N = 64;
const loop = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  return new Vector3(Math.cos(a), 0, Math.sin(a));
});
const halfL = loop.map(() => 0.1);
const halfR = loop.map(() => 0.1);

describe('buildEnvironment', () => {
  it('emits two barrier lines flanking the track (one per side)', () => {
    const env = buildEnvironment(loop, halfL, halfR, 'high');
    expect(env.barriersLeft.length).toBe(N);
    expect(env.barriersRight.length).toBe(N);
    // left barrier sits outside the left edge → further from origin than the centreline
    expect(env.barriersLeft[0].length()).toBeGreaterThan(1);
  });

  it('places fewer grandstands + trees on the low tier than high', () => {
    const hi = buildEnvironment(loop, halfL, halfR, 'high');
    const lo = buildEnvironment(loop, halfL, halfR, 'low');
    expect(lo.grandstands.length).toBeLessThan(hi.grandstands.length);
    expect(lo.trees.length).toBeLessThan(hi.trees.length);
  });

  it('is deterministic — same input yields identical tree scatter', () => {
    const a = buildEnvironment(loop, halfL, halfR, 'high');
    const b = buildEnvironment(loop, halfL, halfR, 'high');
    expect(a.trees.map((t) => t.position.toArray())).toEqual(b.trees.map((t) => t.position.toArray()));
  });

  it('cornerIndices finds high-curvature points (none on a uniform circle above a sharp threshold)', () => {
    // uniform circle has no *local* maxima sharper than neighbours → empty at a strict threshold
    expect(cornerIndices(loop, 0.5).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run lib/openf1/track-environment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

```ts
import { Vector3 } from 'three';
import type { QualityTier } from '@/lib/onboard/useQualityTier';

export interface Placement { position: Vector3; rotationY: number; scale: number }
export interface TrackEnvironment {
  barriersLeft: Vector3[];
  barriersRight: Vector3[];
  grandstands: Placement[];
  trees: Placement[];
  banners: Placement[];
}

const UP = new Vector3(0, 1, 0);

/** Per-point outward normal (tangent × up), left/right side of travel. */
function sideNormals(pts: Vector3[]): Vector3[] {
  const n = pts.length;
  const out: Vector3[] = [];
  const tan = new Vector3();
  for (let i = 0; i < n; i++) {
    tan.subVectors(pts[(i + 1) % n], pts[(i - 1 + n) % n]);
    tan.y = 0;
    if (tan.lengthSq() < 1e-9) tan.set(0, 0, 1); else tan.normalize();
    out.push(new Vector3().crossVectors(tan, UP).normalize());
  }
  return out;
}

/** Turning angle (rad) at each point — discrete curvature proxy. */
function turnAngles(pts: Vector3[]): number[] {
  const n = pts.length;
  const a = new Vector3(), b = new Vector3();
  return pts.map((_, i) => {
    a.subVectors(pts[i], pts[(i - 1 + n) % n]); a.y = 0;
    b.subVectors(pts[(i + 1) % n], pts[i]); b.y = 0;
    if (a.lengthSq() < 1e-9 || b.lengthSq() < 1e-9) return 0;
    return Math.abs(a.angleTo(b));
  });
}

/** Indices that are LOCAL maxima of turning angle above `threshold` (corners). */
export function cornerIndices(pts: Vector3[], threshold: number): number[] {
  const ang = turnAngles(pts);
  const n = pts.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (ang[i] >= threshold && ang[i] >= ang[(i - 1 + n) % n] && ang[i] > ang[(i + 1) % n]) out.push(i);
  }
  return out;
}

/** Seeded PRNG (mulberry32) — deterministic scatter, no Math.random. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BARRIER_GAP = 0.04;   // beyond the track edge
const STAND_SET_BACK = 0.5;
const TREE_SET_BACK = 1.2;

export function buildEnvironment(
  pts: Vector3[], halfL: number[], halfR: number[], tier: QualityTier,
): TrackEnvironment {
  const n = pts.length;
  const side = sideNormals(pts);
  const barriersLeft = pts.map((p, i) => p.clone().addScaledVector(side[i], (halfL[i] ?? 0.1) + BARRIER_GAP));
  const barriersRight = pts.map((p, i) => p.clone().addScaledVector(side[i], -((halfR[i] ?? 0.1) + BARRIER_GAP)));

  // Grandstands at the sharpest corners (outside of the bend), capped per tier.
  const cap = tier === 'high' ? 8 : 3;
  const corners = cornerIndices(pts, 0.18).sort((a, b) => turnAngles(pts)[b] - turnAngles(pts)[a]).slice(0, cap);
  const grandstands: Placement[] = corners.map((i) => ({
    position: pts[i].clone().addScaledVector(side[i], (halfL[i] ?? 0.1) + STAND_SET_BACK),
    rotationY: Math.atan2(side[i].x, side[i].z),
    scale: 1,
  }));

  // Trees scattered along the right runoff at a tier-dependent stride.
  const stride = tier === 'high' ? 2 : 5;
  const rand = rng(n * 131 + 7);
  const trees: Placement[] = [];
  for (let i = 0; i < n; i += stride) {
    const jitter = (rand() - 0.5) * 0.6;
    trees.push({
      position: pts[i].clone().addScaledVector(side[i], -((halfR[i] ?? 0.1) + TREE_SET_BACK + jitter)),
      rotationY: rand() * Math.PI * 2,
      scale: 0.7 + rand() * 0.6,
    });
  }

  // Banners along the left barrier at a fixed stride (both tiers — they read well + are cheap).
  const banners: Placement[] = [];
  for (let i = 0; i < n; i += 6) {
    banners.push({ position: barriersLeft[i].clone(), rotationY: Math.atan2(side[i].x, side[i].z), scale: 1 });
  }
  return { barriersLeft, barriersRight, grandstands, trees, banners };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run lib/openf1/track-environment.test.ts`
Expected: PASS (4 tests). If the circle fixture trips `cornerIndices` (uniform curvature can tie neighbours), the `> ang[next]` strict check keeps it empty — confirm.

- [ ] **Step 5: Commit**

```bash
git add lib/openf1/track-environment.ts lib/openf1/track-environment.test.ts
git commit -m "feat(onboard): pure procedural track-environment geometry builder + tests"
```

---

### Task 5: TrackEnvironment renderer

**Files:**
- Create: `components/f1/onboard/TrackEnvironment.tsx`

Renders the builder output as instanced meshes. Uses drei `<Instances>`/`<Instance>` so each element type is one draw call.

- [ ] **Step 1: Implement the renderer**

```tsx
'use client';
import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { buildEnvironment } from '@/lib/openf1/track-environment';
import type { QualityTier } from '@/lib/onboard/useQualityTier';

// A simple tiered grandstand box + tree billboard + banner board. Geometry is
// stylised on purpose (perf); realism comes from instancing density + the crowd
// texture, tuned at the gate.
export function TrackEnvironment({
  centreline, halfL, halfR, tier,
}: { centreline: THREE.Vector3[]; halfL: number[]; halfR: number[]; tier: QualityTier }) {
  const env = useMemo(
    () => buildEnvironment(centreline, halfL, halfR, tier),
    [centreline, halfL, halfR, tier],
  );

  return (
    <group>
      {/* Barriers: thin white walls along each edge polyline. */}
      <BarrierWall pts={env.barriersLeft} />
      <BarrierWall pts={env.barriersRight} />

      {/* Grandstands */}
      <Instances limit={16}>
        <boxGeometry args={[0.6, 0.25, 0.3]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.9} />
        {env.grandstands.map((g, i) => (
          <Instance key={i} position={g.position} rotation={[0, g.rotationY, 0]} scale={g.scale} />
        ))}
      </Instances>

      {/* Trees (low-poly cones; billboard upgrade is a gate-time option) */}
      <Instances limit={256}>
        <coneGeometry args={[0.12, 0.4, 6]} />
        <meshStandardMaterial color="#2f5d34" roughness={1} />
        {env.trees.map((t, i) => (
          <Instance key={i} position={[t.position.x, t.position.y + 0.2, t.position.z]} rotation={[0, t.rotationY, 0]} scale={t.scale} />
        ))}
      </Instances>

      {/* Banners (generic sponsor boards) */}
      <Instances limit={128}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
        <meshStandardMaterial color="#1b3a6b" roughness={0.6} />
        {env.banners.map((b, i) => (
          <Instance key={i} position={[b.position.x, b.position.y + 0.05, b.position.z]} rotation={[0, b.rotationY, 0]} />
        ))}
      </Instances>
    </group>
  );
}

function BarrierWall({ pts }: { pts: THREE.Vector3[] }) {
  const geo = useMemo(() => {
    const positions: number[] = []; const idx: number[] = [];
    const H = 0.06;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      positions.push(p.x, p.y, p.z, p.x, p.y + H, p.z);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, [pts]);
  return <mesh geometry={geo}><meshStandardMaterial color="#e8eaee" roughness={0.7} side={THREE.DoubleSide} /></mesh>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/f1/onboard/TrackEnvironment.tsx
git commit -m "feat(onboard): instanced procedural environment renderer"
```

> The generic-banner texture + crowd texture on the stands are layered at the gate (Task 7) once the geometry reads right — start with the flat colours above so the geometry/perf is validated first.

---

### Task 6: Wire car + environment into the Austria scene

**Files:**
- Modify: `components/f1/GhostLap3D.tsx`

- [ ] **Step 1: Mount TrackEnvironment + tier in the Scene**

In `GhostLap3D.tsx`: import `useQualityTier` and `TrackEnvironment`. In the main component, call `const tier = useQualityTier();`. Pass `tier` + the mapped ribbon centreline into `Scene`. Inside `Scene` (after `<TrackRibbon .../>`, ~L782), add:
```tsx
<TrackEnvironment centreline={ribbon.pts} halfL={ribbon.halfL} halfR={ribbon.halfR} tier={cameraMode === 'cockpit' ? tier : tier} />
```
(`ribbon.pts/halfL/halfR` already exist in `Scene`'s props.) Pass `dpr` from tier on the `<Canvas>` (~L1147): `dpr={tier === 'high' ? [1, 2] : 1}`.

- [ ] **Step 2: Typecheck + run the existing decoder test**

Run: `npx tsc --noEmit && npx vitest run lib/openf1/decoder.test.ts`
Expected: clean + decoder tests pass (no data-path change).

- [ ] **Step 3: Commit**

```bash
git add components/f1/GhostLap3D.tsx
git commit -m "feat(onboard): mount procedural environment + quality tier in the scene"
```

---

### Task 7: Deploy + screenshot gate (OPERATOR SIGN-OFF — blocks Phase 3)

**Files:** none (verification task).

- [ ] **Step 1: Push the branch + open a draft PR**

```bash
git push -u origin feat/onboard-graphics-overhaul
gh pr create --draft --base main --head feat/onboard-graphics-overhaul --title "feat(onboard): 3D graphics overhaul (prototype)" --body "Prototype for visual sign-off — car model + procedural environment on Austria. Not for merge until approved."
```

- [ ] **Step 2: Capture the prototype on the Vercel preview**

Once the preview builds, drive `<preview-url>/series/f1/weekend/8/qualifying` → Decoder → Onboard with Playwright; capture the canvas at a desktop viewport AND a mobile viewport (e.g. 390×844), at t≈0, mid-lap, and a corner. Save under `.playwright-mcp/`.

- [ ] **Step 3: Verify perf + render**

Confirm: 0 console errors; the car model renders at the right scale/orientation with the team colour on the bodywork; barriers/stands/trees/banners read correctly; on the mobile viewport the tier drops detail and the scene stays responsive. Tune `CAR_SCALE`/`BODY_NODE`/rotation (Task 3) + env constants (Task 4) + add the banner/crowd textures (Task 5) here, re-deploying as needed.

- [ ] **Step 4: GATE — operator approval**

Present the screenshots. **Do not proceed to Phase 3 without explicit sign-off on look + smoothness.** If rejected, iterate Tasks 3–6.

---

## Phase 2 — Generalise across the calendar

### Task 8: Spot-check other circuits

**Files:** none (verification) + targeted fixes if needed.

- [ ] **Step 1: Verify 2–3 other tracks**

On the preview, open the Onboard for 2–3 other rounds with quali data (include a tight/twisty one). Confirm the procedural dressing applies sensibly (it's centreline-driven, so it should) and reconstruction quality is acceptable.

- [ ] **Step 2: Fix any generalisation issues**

If a track reveals a problem (e.g. stands clipping a hairpin, tree scatter on-track), adjust the *thresholds/constants* in `lib/openf1/track-environment.ts` (corner threshold, set-backs) — never per-track special-casing. Re-run `npx vitest run lib/openf1/track-environment.test.ts`. Commit.

```bash
git commit -am "fix(onboard): tune procedural env thresholds for tighter circuits"
```

---

## Phase 3 — Drop the 2D replay + ship

### Task 9: Remove the 2D ghost replay

**Files:**
- Modify: `components/f1/QualifyingDecoder.tsx`
- Delete: `components/f1/GhostLapReplay.tsx`

- [ ] **Step 1: Remove the toggle in QualifyingDecoder**

In `QualifyingDecoder.tsx`: delete the `ghost3d` state + the `['2D','Onboard']` toggle button row (~L171-193), and render `<LazyGhostLap3D .../>` directly in place of the `ghost3d ? ... : <GhostLapReplay/>` conditional (~L194-198). Remove the `GhostLapReplay` import. Keep `DeltaTrace` + `MinisectorMap` untouched.

- [ ] **Step 2: Delete the dead component**

```bash
git rm components/f1/GhostLapReplay.tsx
```
Then grep to confirm no other importer:
Run: `grep -rn "GhostLapReplay" --include=*.tsx --include=*.ts . | grep -v node_modules`
Expected: no matches (besides the deletion).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (no new findings).

- [ ] **Step 4: Commit**

```bash
git add components/f1/QualifyingDecoder.tsx
git commit -m "feat(onboard): 3D is the only ghost replay — drop the 2D view"
```

---

### Task 10: Attribution, release notes, ship

**Files:**
- Modify: `components/f1/OpenF1Attribution.tsx`, `CHANGELOG.md`, `RELEASES.md`, `package.json`

- [ ] **Step 1: Add the CC-BY car credit**

In `OpenF1Attribution.tsx`, append a line crediting the car model author + CC-BY licence (text from `public/models/f1-2022/ATTRIBUTION.md`).

- [ ] **Step 2: Release notes + version bump**

Bump `package.json` (minor — new feature, e.g. `0.131.0`). Add a `CHANGELOG.md` section (engineering detail: new `onboard/*` units, model, env builder, drop-2D) and a `RELEASES.md` section (user prose: "The onboard replay is now a realistic 3D scene — real car model, trackside barriers, grandstands and greenery — on every circuit; the old 2D replay has been retired.").

- [ ] **Step 3: Verify the production build**

Run: `npm run build`
Expected: compiles clean (catches the kind of CSS/asset-resolution error a preview build surfaces).

- [ ] **Step 4: Commit + mark PR ready**

```bash
git add -A && git commit -m "feat(onboard): attribution + release notes for the 3D graphics overhaul (0.131.0)"
git push
gh pr ready
```

- [ ] **Step 5: Merge gate**

Operator squash-merges after the preview is re-confirmed green. Production auto-deploys; verify `/series/f1/weekend/8/qualifying` Onboard on prod (200, 0 console errors, model + env render).

---

## Self-review

- **Spec coverage:** car model (T1,T3) · procedural env barriers/stands/trees/banners (T4,T5) · adaptive tiers (T2,T6) · generic banners (T5/T7 textures) · CC-BY attribution (T10) · drop-2D-replay-only, keep delta+dominance (T9) · reconstructed-track-unchanged (no task touches the pipeline — correct) · prototype-gate-before-rollout (T7 blocks Phase 3) · generalise + spot-check (T8) · all-driver picker / real-geometry P2 explicitly absent (out of scope). ✓ All spec sections map to a task.
- **Placeholder scan:** the visual-tuning steps (T3 `BODY_NODE`, T7 texture layering) name exact knobs + a screenshot acceptance criterion rather than "make it look good" — concrete, not placeholders. The one genuine unknown (the model's bodywork node name) is captured by an explicit inspect step (T1 S3) feeding T3. No "TBD/TODO" remain.
- **Type consistency:** `QualityTier` (`'high'|'low'`) defined in T2, consumed in T4/T5/T6. `buildEnvironment(pts, halfL, halfR, tier)` + `Placement`/`TrackEnvironment` shapes defined in T4, consumed identically in T5. `cornerIndices` signature matches its test + its use. `CarModel` props (`colour`,`ghost`) match the `F1Car` contract they replace. ✓

---

## Risks (carried from the spec)
- Model fetch/licence (T1) — fallback CC0 path documented.
- Mobile perf — the T7 gate is the proof point; tier constants (T2/T4) are the levers.
- Per-track reconstruction quality — T8 spot-check; real-geometry P2 remains the roadmap answer for the worst circuits.
