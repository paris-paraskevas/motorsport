'use client';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/f1-2022/car.glb';
useGLTF.preload(MODEL_URL);

// Model bbox ≈ 1.78(w)×1.08(h)×4.46(l) m, origin off-centre. We recentre to the
// bbox centre and scale so its longest axis ≈ TARGET_LENGTH world units (the old
// proxy spanned ~0.2 on the ~0.2-wide asphalt). Tune at the prototype gate.
const TARGET_LENGTH = 0.2;
// Tyres/dark trim stay dark; lighter "bodywork" materials take the team tint.
const TINT_LUMA_MIN = 0.18;
const relum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export function CarModel({ colour, ghost }: { colour: string; ghost: boolean }) {
  const { scene } = useGLTF(MODEL_URL);
  const node = useMemo(() => {
    const root = scene.clone(true);
    const team = new THREE.Color(colour);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (relum(m.color) >= TINT_LUMA_MIN) m.color = team.clone();
      m.transparent = ghost;
      m.opacity = ghost ? 0.42 : 1;
      m.emissive = team.clone();
      m.emissiveIntensity = ghost ? 0.4 : 0.12;
      mesh.material = m;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);
    root.position.sub(centre);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const wrap = new THREE.Group();
    wrap.add(root);
    wrap.scale.setScalar(TARGET_LENGTH / longest);
    return wrap;
  }, [scene, colour, ghost]);
  // rotation aligns the model's forward axis to local +Z (travel); flip at the gate if reversed.
  return <primitive object={node} rotation={[0, Math.PI, 0]} />;
}
