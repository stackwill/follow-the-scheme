"use client";

import type { BufferGeometry, Material, Object3D } from "three";
import { useEffect, useRef } from "react";

type MarkingSpectacleProps = {
  awardedMarks: number;
  markedCount: number;
  onComplete: () => void;
  runId: number;
  totalMarks: number;
};

type DisposableObject = Object3D & {
  geometry?: BufferGeometry;
  material?: Material | Material[];
};

const SPECTACLE_DURATION_MS = 6400;
const REDUCED_MOTION_DURATION_MS = 1100;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeOutQuint(value: number) {
  return 1 - Math.pow(1 - clamp(value), 5);
}

function easeInOut(value: number) {
  const nextValue = clamp(value);

  return nextValue < 0.5 ? 4 * nextValue * nextValue * nextValue : 1 - Math.pow(-2 * nextValue + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp(value), 3);
}

export function MarkingSpectacle({
  awardedMarks,
  markedCount,
  onComplete,
  runId,
  totalMarks,
}: MarkingSpectacleProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      onComplete,
      reducedMotion ? REDUCED_MOTION_DURATION_MS : SPECTACLE_DURATION_MS,
    );

    if (reducedMotion) {
      return () => window.clearTimeout(timeout);
    }

    let animationFrame = 0;
    let cancelled = false;
    let resize: (() => void) | null = null;
    let dispose: (() => void) | null = null;

    async function mountScene() {
      const host = canvasHostRef.current;

      if (!host) {
        return;
      }

      const THREE = await import("three");

      if (cancelled || !canvasHostRef.current) {
        return;
      }

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x020408, 0.044);

      const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 95);
      camera.position.set(0, 0.36, 10.8);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x020408, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const examinerRig = new THREE.Group();
      scene.add(examinerRig);

      const pageTextureCanvas = document.createElement("canvas");
      pageTextureCanvas.width = 512;
      pageTextureCanvas.height = 720;
      const textureContext = pageTextureCanvas.getContext("2d");

      if (textureContext) {
        textureContext.fillStyle = "#fbfbf6";
        textureContext.fillRect(0, 0, pageTextureCanvas.width, pageTextureCanvas.height);
        textureContext.strokeStyle = "rgba(32, 48, 70, 0.12)";
        textureContext.lineWidth = 2;

        for (let y = 96; y < 620; y += 44) {
          textureContext.beginPath();
          textureContext.moveTo(58, y);
          textureContext.lineTo(454, y);
          textureContext.stroke();
        }

        textureContext.strokeStyle = "rgba(0, 113, 227, 0.24)";
        textureContext.lineWidth = 3;
        textureContext.strokeRect(44, 58, 424, 604);
        textureContext.fillStyle = "rgba(12, 20, 32, 0.26)";
        textureContext.fillRect(64, 82, 190, 10);
        textureContext.fillRect(64, 124, 340, 8);
        textureContext.fillRect(64, 168, 260, 8);
        textureContext.strokeStyle = "rgba(29, 127, 66, 0.56)";
        textureContext.lineWidth = 10;
        textureContext.lineCap = "round";
        textureContext.beginPath();
        textureContext.moveTo(326, 538);
        textureContext.lineTo(374, 588);
        textureContext.lineTo(462, 470);
        textureContext.stroke();
      }

      const pageTexture = new THREE.CanvasTexture(pageTextureCanvas);
      pageTexture.colorSpace = THREE.SRGBColorSpace;
      pageTexture.anisotropy = 4;

      const corridor = new THREE.Group();
      scene.add(corridor);

      const corridorFrames: Array<{
        frame: InstanceType<typeof THREE.LineSegments>;
        index: number;
      }> = [];
      const corridorGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.4, 5.1));

      for (let index = 0; index < 18; index += 1) {
        const frame = new THREE.LineSegments(
          corridorGeometry,
          new THREE.LineBasicMaterial({
            blending: THREE.AdditiveBlending,
            color: index % 3 === 0 ? 0x7ebdff : 0x416f9f,
            opacity: 0.13,
            transparent: true,
          }),
        );
        frame.position.z = -7 - index * 2.15;
        frame.rotation.z = index * 0.035;
        corridor.add(frame);
        corridorFrames.push({ frame, index });
      }

      const pages: Array<{
        edge: InstanceType<typeof THREE.LineSegments>;
        mesh: InstanceType<typeof THREE.Mesh>;
        offset: number;
      }> = [];
      const pageGeometry = new THREE.PlaneGeometry(3.4, 4.8, 10, 14);
      const edgeGeometry = new THREE.EdgesGeometry(pageGeometry);

      for (let index = 0; index < 8; index += 1) {
        const material = new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? 0xfffffb : 0xf3f7ff,
          emissive: 0x0b1a32,
          emissiveIntensity: 0.035,
          map: pageTexture,
          metalness: 0.08,
          opacity: 0.78,
          roughness: 0.72,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const mesh = new THREE.Mesh(pageGeometry, material);
        mesh.position.set((index - 3.5) * 0.52, (index % 2 === 0 ? 0.2 : -0.18) + index * 0.025, -22 - index * 1.25);
        mesh.rotation.set(-0.1 + index * 0.013, -0.55 + index * 0.14, 0.12 - index * 0.022);

        const edge = new THREE.LineSegments(
          edgeGeometry,
          new THREE.LineBasicMaterial({ color: 0xc6deff, opacity: 0.18, transparent: true }),
        );
        edge.position.copy(mesh.position);
        edge.rotation.copy(mesh.rotation);

        examinerRig.add(mesh, edge);
        pages.push({ edge, mesh, offset: index * 0.055 });
      }

      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(8.8, 0.07),
        new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: 0xa9e1ff,
          depthWrite: false,
          opacity: 0.7,
          transparent: true,
        }),
      );
      beam.position.set(0, -2.75, 1.15);
      examinerRig.add(beam);

      const beamGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(9.2, 0.74),
        new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: 0x6ec7ff,
          depthWrite: false,
          opacity: 0.13,
          transparent: true,
        }),
      );
      beamGlow.position.copy(beam.position);
      examinerRig.add(beamGlow);

      const rings = [0, 1, 2].map((index) => {
        const material = new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: index === 0 ? 0xcff5ff : index === 1 ? 0x7cbcff : 0x30d158,
          opacity: 0,
          transparent: true,
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16 + index * 0.34, 0.012 + index * 0.004, 16, 180), material);
        ring.position.set(0, 0, 2.2 - index * 0.05);
        ring.rotation.x = index * 0.38;
        examinerRig.add(ring);

        return { material, ring };
      });

      const resultCore = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5, 4),
        new THREE.MeshBasicMaterial({
          blending: THREE.AdditiveBlending,
          color: 0xdaf8ff,
          opacity: 0,
          transparent: true,
          wireframe: true,
        }),
      );
      resultCore.position.set(0, 0, 2.2);
      examinerRig.add(resultCore);

      const particleCount = 1250;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleSeeds = new Float32Array(particleCount * 4);

      for (let index = 0; index < particleCount; index += 1) {
        const radius = 3.5 + Math.random() * 10;
        const angle = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * 6.2;
        particleSeeds[index * 4] = Math.cos(angle) * radius;
        particleSeeds[index * 4 + 1] = height;
        particleSeeds[index * 4 + 2] = Math.sin(angle) * radius - 8;
        particleSeeds[index * 4 + 3] = Math.random() * Math.PI * 2;
        particlePositions[index * 3] = particleSeeds[index * 4];
        particlePositions[index * 3 + 1] = particleSeeds[index * 4 + 1];
        particlePositions[index * 3 + 2] = particleSeeds[index * 4 + 2];
      }

      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
      const particleMaterial = new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xb8e6ff,
        depthWrite: false,
        opacity: 0.68,
        size: 0.022,
        transparent: true,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      const ambientLight = new THREE.AmbientLight(0x446a8a, 0.78);
      scene.add(ambientLight);

      const frontLight = new THREE.PointLight(0x9fdcff, 11, 24);
      frontLight.position.set(-3.2, 2.4, 5.6);
      scene.add(frontLight);

      const markLight = new THREE.PointLight(0x30d158, 0, 10);
      markLight.position.set(2.2, -0.8, 3);
      scene.add(markLight);

      resize = () => {
        const { innerHeight, innerWidth } = window;
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / Math.max(innerHeight, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = clamp((now - startedAt) / SPECTACLE_DURATION_MS);
        const scanProgress = easeInOut(clamp(progress / 0.48));
        const resolveProgress = easeOutQuint(clamp((progress - 0.43) / 0.28));
        const holdProgress = easeOutCubic(clamp((progress - 0.64) / 0.18));
        const exitProgress = easeInOut(clamp((progress - 0.84) / 0.16));
        const fade = 1 - exitProgress;

        corridor.rotation.z = progress * 0.16;
        corridorFrames.forEach(({ frame, index }) => {
          const material = frame.material as InstanceType<typeof THREE.LineBasicMaterial>;
          const framePhase = (progress * 16 + index) % 18;
          frame.position.z = 8 - framePhase * 2.15;
          frame.rotation.z = progress * 0.22 + index * 0.035;
          frame.scale.setScalar(1 + scanProgress * 0.2 + holdProgress * 0.08);
          material.opacity = (0.045 + Math.pow(1 - Math.abs(framePhase - 4) / 14, 2) * 0.18) * fade;
        });

        examinerRig.rotation.y = Math.sin(progress * Math.PI * 1.45) * 0.1 + resolveProgress * 0.08;
        examinerRig.rotation.x = -0.1 + resolveProgress * 0.08;
        examinerRig.position.z = -1.25 + resolveProgress * 1.05 + holdProgress * 0.28 + exitProgress * 2.6;

        pages.forEach((page, index) => {
          const pageProgress = easeOutQuint(clamp((progress - page.offset) / 0.62));
          const resolveLift = easeOutQuint(clamp((progress - 0.58 - page.offset * 0.3) / 0.22));
          const orbit = Math.sin(progress * 5.8 + index) * 0.05;
          page.mesh.position.z = -22 - index * 1.25 + pageProgress * (22.2 + index * 0.88) + exitProgress * 4.6;
          page.mesh.position.x = (index - 3.5) * (0.52 + resolveLift * 0.12) + orbit;
          page.mesh.position.y = (index % 2 === 0 ? 0.2 : -0.18) + index * 0.025 + Math.cos(progress * 4 + index) * 0.035;
          page.mesh.rotation.y = -0.55 + index * 0.14 + pageProgress * 0.34 + resolveLift * 0.26;
          page.mesh.rotation.z = 0.12 - index * 0.022 + Math.sin(progress * 7.5 + index) * 0.016;
          page.mesh.scale.setScalar(1 + resolveLift * 0.13 + holdProgress * 0.03);
          page.edge.position.copy(page.mesh.position);
          page.edge.rotation.copy(page.mesh.rotation);
          page.edge.scale.copy(page.mesh.scale);

          const material = page.mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>;
          material.opacity = (0.08 + pageProgress * 0.72 - exitProgress * 0.16) * fade;
          material.emissiveIntensity = 0.035 + resolveLift * 0.045;
          const edgeMaterial = page.edge.material as InstanceType<typeof THREE.LineBasicMaterial>;
          edgeMaterial.opacity = (0.08 + pageProgress * 0.22 + resolveLift * 0.28) * fade;
        });

        beam.position.y = -2.7 + ((progress * 3.55) % 1) * 5.4;
        beam.rotation.z = Math.sin(progress * 4.2) * 0.04;
        beamGlow.position.y = beam.position.y;
        beamGlow.rotation.z = beam.rotation.z;
        beam.material.opacity = (0.7 - resolveProgress * 0.28) * fade;
        beamGlow.material.opacity = (0.14 + Math.sin(progress * 28) * 0.025) * fade;

        rings.forEach(({ material, ring }, index) => {
          const ringResolve = easeOutQuint(clamp((progress - 0.44 - index * 0.035) / 0.28));
          ring.scale.setScalar(0.16 + ringResolve * (2.2 + index * 0.42) + holdProgress * 0.18 + exitProgress * 0.36);
          ring.rotation.x = index * 0.38 + progress * (0.85 + index * 0.24);
          ring.rotation.y = progress * (1.1 - index * 0.16);
          ring.rotation.z = progress * Math.PI * (1.2 + index * 0.36);
          material.opacity = (ringResolve * (0.46 + index * 0.08) - exitProgress * 0.4) * fade;
        });

        resultCore.scale.setScalar(0.34 + resolveProgress * 1.74 + holdProgress * 0.22);
        resultCore.rotation.set(progress * 2.6, progress * 3.9, progress * 1.85);
        (resultCore.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = (resolveProgress * 0.34) * fade;
        markLight.intensity = (resolveProgress * 11 + holdProgress * 3) * fade;

        const attract = easeInOut(clamp((progress - 0.16) / 0.64));
        const release = easeInOut(clamp((progress - 0.79) / 0.12));
        const positions = particleGeometry.attributes.position.array as Float32Array;

        for (let index = 0; index < particleCount; index += 1) {
          const seedIndex = index * 4;
          const posIndex = index * 3;
          const seedAngle = particleSeeds[seedIndex + 3] + progress * (2.2 + (index % 7) * 0.075);
          const targetRadius = 1.28 + Math.sin(seedAngle * 2.1) * 0.12;
          const targetX = Math.cos(seedAngle) * targetRadius;
          const targetY = Math.sin(seedAngle) * targetRadius;
          const targetZ = 1.8 + Math.sin(seedAngle * 1.7) * 0.32;
          const releaseScale = 1 + release * 3.8;

          positions[posIndex] =
            particleSeeds[seedIndex] * (1 - attract) +
            targetX * attract * releaseScale +
            Math.sin(progress * 13 + index) * 0.018;
          positions[posIndex + 1] =
            particleSeeds[seedIndex + 1] * (1 - attract) +
            targetY * attract * releaseScale +
            Math.cos(progress * 11 + index) * 0.018;
          positions[posIndex + 2] =
            particleSeeds[seedIndex + 2] * (1 - attract) +
            targetZ * attract +
            release * (index % 5) * 0.55;
        }

        particleGeometry.attributes.position.needsUpdate = true;
        particleMaterial.opacity = (0.7 - exitProgress * 0.58) * fade;
        particleMaterial.size = 0.018 + resolveProgress * 0.014 + release * 0.014;

        camera.position.z = 10.8 - scanProgress * 2.05 + holdProgress * 0.18 + exitProgress * 2.9;
        camera.position.x = Math.sin(progress * Math.PI * 1.16) * 0.32;
        camera.position.y = 0.36 + Math.sin(progress * Math.PI * 1.8) * 0.1 + resolveProgress * 0.12;
        camera.lookAt(Math.sin(progress * 2.4) * 0.18, resolveProgress * 0.08, 0);

        renderer.render(scene, camera);

        if (progress < 1 && !cancelled) {
          animationFrame = window.requestAnimationFrame(animate);
        }
      };

      animationFrame = window.requestAnimationFrame(animate);

      dispose = () => {
        window.removeEventListener("resize", resize as () => void);
        window.cancelAnimationFrame(animationFrame);
        const disposedGeometries = new Set<BufferGeometry>();
        const disposedMaterials = new Set<Material>();

        const disposeGeometry = (geometry: BufferGeometry) => {
          if (!disposedGeometries.has(geometry)) {
            geometry.dispose();
            disposedGeometries.add(geometry);
          }
        };

        const disposeMaterial = (material: Material) => {
          if (!disposedMaterials.has(material)) {
            material.dispose();
            disposedMaterials.add(material);
          }
        };

        scene.traverse((object) => {
          const disposable = object as DisposableObject;

          if (disposable.geometry) {
            disposeGeometry(disposable.geometry);
          }

          if (disposable.material) {
            const materials = Array.isArray(disposable.material) ? disposable.material : [disposable.material];
            materials.forEach(disposeMaterial);
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    mountScene();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      dispose?.();
    };
  }, [onComplete, runId]);

  return (
    <div className="marking-spectacle" role="status" aria-live="polite">
      <div ref={canvasHostRef} className="marking-spectacle__canvas" aria-hidden="true" />
      <div className="marking-spectacle__vignette" aria-hidden="true" />
      <div className="marking-spectacle__hud">
        <p className="eyebrow">Examiner scan complete</p>
        <div className="marking-spectacle__score">
          {awardedMarks}
          <span>/ {totalMarks}</span>
        </div>
        <p>{markedCount} marked part{markedCount === 1 ? "" : "s"} resolved against the scheme.</p>
      </div>
      <div className="marking-spectacle__scan" aria-hidden="true" />
    </div>
  );
}
