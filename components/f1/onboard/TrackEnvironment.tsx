'use client';
import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { buildEnvironment } from '@/lib/openf1/track-environment';
import type { QualityTier } from '@/lib/onboard/useQualityTier';

// Procedural trackside dressing, instanced (one draw call per element type). Every size
// is a multiple of the measured track half-width `w`, so it reads at the right scale on
// any reconstructed circuit. Cross-section from the asphalt outward: kerb → green
// run-off → a continuous low barrier (set back) → grandstands/trees BEHIND it, outfield
// only. The old build put white walls on both kerbs (no run-off) with mirrored trees on
// the racing surface — this fixes all three.
export function TrackEnvironment({
  centreline, halfL, halfR, tier,
}: { centreline: THREE.Vector3[]; halfL: number[]; halfR: number[]; tier: QualityTier }) {
  const env = useMemo(
    () => buildEnvironment(centreline, halfL, halfR, tier),
    [centreline, halfL, halfR, tier],
  );

  // Same representative half-width the builder measures — drives element sizing.
  const w = useMemo(() => {
    const hs = halfL
      .map((l, i) => ((l ?? 0) + (halfR[i] ?? 0)) / 2)
      .filter(h => h > 0)
      .sort((a, b) => a - b);
    return hs.length ? hs[hs.length >> 1] : 0.1;
  }, [halfL, halfR]);

  return (
    <group>
      {/* Barriers — a continuous low Armco-style wall down each edge, set back on the
          run-off (both sides). */}
      <BarrierWall pts={env.barrierLeft} height={w * 0.28} />
      <BarrierWall pts={env.barrierRight} height={w * 0.28} />

      {/* Grandstands — at corner outsides (outfield), behind the barrier. */}
      <Instances limit={16}>
        <boxGeometry args={[w * 4, w * 1.8, w * 1.4]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.9} metalness={0} />
        {env.grandstands.map((g, i) => (
          <Instance
            key={i}
            position={[g.position.x, g.position.y + w * 0.9, g.position.z]}
            rotation={[0, g.rotationY, 0]}
            scale={g.scale}
          />
        ))}
      </Instances>

      {/* Trees — low, small, sparse, outfield-only; cone base sits on the ground. */}
      <Instances limit={128}>
        <coneGeometry args={[w * 0.45, w * 1.4, 6]} />
        <meshStandardMaterial color="#33602f" roughness={1} metalness={0} />
        {env.trees.map((t, i) => (
          <Instance
            key={i}
            position={[t.position.x, t.position.y + w * 0.7 * t.scale, t.position.z]}
            rotation={[0, t.rotationY, 0]}
            scale={t.scale}
          />
        ))}
      </Instances>

      {/* Banners — low hoardings in front of the stands (generic, no real brands). */}
      <Instances limit={32}>
        <boxGeometry args={[w * 3, w * 0.5, w * 0.1]} />
        <meshStandardMaterial color="#1b3a6b" roughness={0.6} metalness={0} />
        {env.banners.map((b, i) => (
          <Instance
            key={i}
            position={[b.position.x, b.position.y + w * 0.25, b.position.z]}
            rotation={[0, b.rotationY, 0]}
            scale={b.scale}
          />
        ))}
      </Instances>

      {/* Pit lane + garages along the main straight (beyond the outfield barrier). */}
      {env.pit && <PitLane pit={env.pit} w={w} />}
    </group>
  );
}

// Pit lane: a tapered asphalt strip (the taper reads as the pit entry/exit) with a row
// of garage buildings behind it.
function PitLane({ pit, w }: { pit: NonNullable<ReturnType<typeof buildEnvironment>['pit']>; w: number }) {
  const geo = useMemo(() => {
    const { laneInner, laneOuter } = pit;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < laneInner.length; i++) {
      const a = laneInner[i], b = laneOuter[i];
      pos.push(a.x, a.y + 0.002, a.z, b.x, b.y + 0.002, b.z);
    }
    for (let i = 0; i < laneInner.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [pit]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#40444c" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <Instances limit={64}>
        <boxGeometry args={[w * 1.7, w * 1.2, w * 1.5]} />
        <meshStandardMaterial color="#6b7079" roughness={0.85} metalness={0} />
        {pit.garages.map((g, i) => (
          <Instance
            key={i}
            position={[g.position.x, g.position.y + w * 0.6, g.position.z]}
            rotation={[0, g.rotationY, 0]}
          />
        ))}
      </Instances>
    </group>
  );
}

// A continuous vertical wall strip following a polyline, sitting on the ground (base at
// each point's y), rising `height`. One buffer geometry, two-tone-free flat Armco grey.
function BarrierWall({ pts, height }: { pts: THREE.Vector3[]; height: number }) {
  const geo = useMemo(() => {
    const positions: number[] = [];
    const idx: number[] = [];
    // Deep per-point skirt: barriers keep their smooth track elevation (not draped), so a
    // generous skirt below each point guarantees the wall reaches the ground even where the
    // run-off falls away — without a global flat base (which spanned into giant panels).
    const skirt = height * 8;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      positions.push(p.x, p.y - skirt, p.z, p.x, p.y + height, p.z);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [pts, height]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#cfd3d9" roughness={0.75} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}
