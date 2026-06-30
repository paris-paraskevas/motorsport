'use client';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/f1-2022/car.glb';
useGLTF.preload(MODEL_URL);

// Model bbox ≈ 1.78(w) × 1.08(h) × 4.46(l) m with an off-centre origin. We recentre
// X/Z to the bbox centre but drop the BOTTOM (min-Y) onto y=0 so the wheels rest on
// the track instead of the car being half-buried, then scale so the longest axis ≈
// TARGET_LENGTH world units (the old proxy spanned ~0.2 on the ~0.2-wide asphalt).
const TARGET_LENGTH = 0.15;
// The model is untextured flat materials in arbitrary colours (its own body is a
// dark red), so luminance thresholding can't separate body from tyres — it left the
// car red/patchwork. Tint EVERY material to the flat team colour for a clean, correct
// single-colour car. (Darkening the tyres is a later polish.)

export function CarModel({ colour, ghost }: { colour: string; ghost: boolean }) {
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
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(TARGET_LENGTH / longest);
    return wrap;
  }, [scene, colour, ghost]);
  // The model's long axis is Z and CarRig already orients local +Z to the travel
  // direction, so no extra yaw — the previous Math.PI flip faced it at the camera.
  return <primitive object={node} />;
}
