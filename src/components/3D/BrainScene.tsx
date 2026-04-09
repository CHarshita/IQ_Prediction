import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function BrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 1.5;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.2;
      meshRef.current.rotation.x = Math.sin(t * 0.1) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.15;
    }
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < 500; i++) {
        const x = particles[i * 3];
        const y = particles[i * 3 + 1];
        const z = particles[i * 3 + 2];
        pos.setXYZ(
          i,
          x + Math.sin(t + i * 0.01) * 0.1,
          y + Math.cos(t + i * 0.01) * 0.1,
          z + Math.sin(t * 0.5 + i * 0.02) * 0.05
        );
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[1, 0.3, 128, 32]} />
        <meshPhongMaterial
          color="#6366f1"
          emissive="#4f46e5"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.15} />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={particles}
            count={500}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#06b6d4" size={0.03} transparent opacity={0.6} sizeAttenuation />
      </points>
    </>
  );
}

export default function BrainScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      style={{ background: 'transparent' }}
      className="w-full h-full"
    >
      <ambientLight intensity={0.3} color="#a855f7" />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
      <spotLight position={[-5, 5, 5]} intensity={0.5} color="#6366f1" />
      <BrainMesh />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={1}
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
