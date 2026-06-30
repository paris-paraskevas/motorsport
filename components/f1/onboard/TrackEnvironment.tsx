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
