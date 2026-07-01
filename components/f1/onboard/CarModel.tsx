'use client';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/f1-2022/car.glb';
useGLTF.preload(MODEL_URL);

// Fallback car width (world units) if no measured track width is supplied.
const DEFAULT_CAR_WIDTH = 0.03;

// The model is untextured flat materials in arbitrary colours (its own body is a dark
// red), so luminance thresholding can't separate body from tyres — tint EVERY material
// to the flat team colour for a clean single-colour car. (Darkening the tyres is later
// polish.) Sizing is by WIDTH: a real 2026 F1 car is 1.9 m wide, and the caller passes
// the world-space width that is the right fraction of the reconstructed track — so the
// car is never too big for the road, on any circuit. Recentre X/Z to the bbox centre
// and drop the bottom onto y=0 so the wheels rest on the track.
export function CarModel({ colour, ghost, carW }: { colour: string; ghost: boolean; carW?: number }) {
  const { scene } = useGLTF(MODEL_URL);
  const node = useMemo(() => {
    const root = scene.clone(true);
    const team = new THREE.Color(colour);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      m.color = team.clone();
      m.transparent = ghost;
      m.opacity = ghost ? 0.5 : 1;
      m.emissiveIntensity = 0; // flat colour; the emissive glow looked toy-ish
      m.metalness = 0.1;
      m.roughness = 0.5;
      mesh.material = m;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);
    // X/Z centred on the GPS point; Y so the model's bottom sits on the track (y=0).
    root.position.set(-centre.x, -box.min.y, -centre.z);
    // Car width = the MIDDLE of the three bbox extents (length is largest, height is
    // smallest) — robust to the model's axis order. Scale so it equals the target width.
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const width = dims[1] || 1;
    const target = carW && carW > 0 ? carW : DEFAULT_CAR_WIDTH;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(target / width);
    return wrap;
  }, [scene, colour, ghost, carW]);
  // The model's long axis is Z and CarRig already orients local +Z to the travel
  // direction, so no extra yaw.
  return <primitive object={node} />;
}
