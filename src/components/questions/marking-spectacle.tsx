"use client";

import robPickenImage from "../../../Rob_Picken-1896-optimized.webp";
import type { BufferGeometry, Material, Object3D } from "three";
import type { CSSProperties } from "react";
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

const SPECTACLE_DURATION_MS = 7200;
const REDUCED_MOTION_DURATION_MS = 1300;
const STAPLER_MODEL_PATH = "/models/stapler.glb";
const PICKEN_IMAGE_SRC = robPickenImage.src;

const CONFETTI_PIECES = Array.from({ length: 96 }, (_, index) => {
  const lane = (index * 37) % 101;
  const size = 7 + ((index * 11) % 10);
  const delay = (index * 83) % 2400;
  const duration = 3600 + ((index * 71) % 1200);
  const drift = -110 + ((index * 47) % 221);
  const spin = 180 + ((index * 131) % 620);
  const colors = ["#1d7f42", "#30d158", "#0071e3", "#ffd60a", "#ffffff", "#a1a1a6"];

  return {
    color: colors[index % colors.length],
    delay,
    drift,
    duration,
    lane,
    size,
    spin,
  };
});

function confettiStyle(piece: (typeof CONFETTI_PIECES)[number]) {
  return {
    "--confetti-color": piece.color,
    "--confetti-delay": `${piece.delay}ms`,
    "--confetti-drift": `${piece.drift}px`,
    "--confetti-duration": `${piece.duration}ms`,
    "--confetti-size": `${piece.size}px`,
    "--confetti-spin": `${piece.spin}deg`,
    "--confetti-x": `${piece.lane}%`,
  } as CSSProperties;
}

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

async function loadPaperImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;

  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

function scoreTone(awardedMarks: number, totalMarks: number) {
  if (totalMarks <= 0) {
    return "partial";
  }

  const ratio = awardedMarks / totalMarks;

  if (ratio >= 0.75) {
    return "good";
  }

  if (ratio >= 0.45) {
    return "partial";
  }

  return "low";
}

export function MarkingSpectacle({
  awardedMarks,
  markedCount,
  onComplete,
  runId,
  totalMarks,
}: MarkingSpectacleProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const tone = scoreTone(awardedMarks, totalMarks);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timeout = window.setTimeout(
      onComplete,
      reducedMotion ? REDUCED_MOTION_DURATION_MS : SPECTACLE_DURATION_MS + 4200,
    );

    if (scoreRef.current) {
      scoreRef.current.textContent = reducedMotion ? String(awardedMarks) : "0";
    }

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
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      if (cancelled || !canvasHostRef.current) {
        return;
      }

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xf7f5ef, 8, 22);

      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      camera.position.set(0, 3.8, 8.8);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      });
      renderer.setClearColor(0xf7f5ef, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const root = new THREE.Group();
      scene.add(root);

      const deskMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2f0e8,
        roughness: 0.82,
      });
      const desk = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), deskMaterial);
      desk.receiveShadow = true;
      desk.rotation.x = -Math.PI / 2;
      desk.position.y = -1.08;
      root.add(desk);

      const paperTextureCanvas = document.createElement("canvas");
      paperTextureCanvas.width = 1024;
      paperTextureCanvas.height = 720;
      const paperContext = paperTextureCanvas.getContext("2d");
      const paperPhoto = await loadPaperImage(PICKEN_IMAGE_SRC);

      if (cancelled) {
        return;
      }

      if (paperContext) {
        paperContext.fillStyle = "#fffefa";
        paperContext.fillRect(0, 0, 1024, 720);
        paperContext.save();
        paperContext.shadowColor = "rgba(29, 29, 31, 0.16)";
        paperContext.shadowBlur = 18;
        paperContext.shadowOffsetY = 10;
        paperContext.fillStyle = "#ffffff";
        paperContext.roundRect(590, 84, 340, 420, 22);
        paperContext.fill();
        paperContext.restore();

        if (paperPhoto) {
          const frameX = 610;
          const frameY = 104;
          const frameWidth = 300;
          const frameHeight = 380;
          const sourceRatio = paperPhoto.width / paperPhoto.height;
          const targetRatio = frameWidth / frameHeight;
          const sourceWidth = sourceRatio > targetRatio ? paperPhoto.height * targetRatio : paperPhoto.width;
          const sourceHeight = sourceRatio > targetRatio ? paperPhoto.height : paperPhoto.width / targetRatio;
          const sourceX = (paperPhoto.width - sourceWidth) / 2;
          const sourceY = Math.max(0, (paperPhoto.height - sourceHeight) * 0.08);

          paperContext.save();
          paperContext.beginPath();
          paperContext.roundRect(frameX, frameY, frameWidth, frameHeight, 18);
          paperContext.clip();
          paperContext.drawImage(paperPhoto, sourceX, sourceY, sourceWidth, sourceHeight, frameX, frameY, frameWidth, frameHeight);
          paperContext.restore();
        }

        paperContext.strokeStyle = "rgba(29, 29, 31, 0.1)";
        paperContext.lineWidth = 3;
        paperContext.strokeRect(48, 48, 928, 624);
        paperContext.fillStyle = "rgba(29, 29, 31, 0.82)";
        paperContext.font = "700 34px Inter, system-ui, sans-serif";
        paperContext.fillText("Marked script", 82, 112);
        paperContext.fillStyle = "rgba(29, 29, 31, 0.7)";
        paperContext.font = "600 22px Inter, system-ui, sans-serif";
        paperContext.fillText(`${awardedMarks} / ${totalMarks} marks`, 82, 154);
        paperContext.fillStyle = "rgba(110, 110, 115, 0.24)";

        for (let y = 210; y < 584; y += 42) {
          paperContext.fillRect(82, y, y % 84 === 0 ? 430 : 340, 8);
        }

        paperContext.strokeStyle = "rgba(0, 113, 227, 0.28)";
        paperContext.lineWidth = 6;
        paperContext.beginPath();
        paperContext.moveTo(82, 626);
        paperContext.lineTo(560, 626);
        paperContext.stroke();
      }

      const paperTexture = new THREE.CanvasTexture(paperTextureCanvas);
      paperTexture.colorSpace = THREE.SRGBColorSpace;
      paperTexture.anisotropy = 4;

      const paperMaterial = new THREE.MeshStandardMaterial({
        color: 0xfffdf7,
        roughness: 0.68,
      });
      const paperTopMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: paperTexture,
        roughness: 0.68,
      });
      const paper = new THREE.Group();
      paper.position.set(-0.2, -0.82, 0.02);
      paper.rotation.y = -0.08;
      root.add(paper);

      const paperBody = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.045, 4.1), paperMaterial);
      paperBody.castShadow = true;
      paperBody.receiveShadow = true;
      paper.add(paperBody);

      const paperTop = new THREE.Mesh(new THREE.PlaneGeometry(5.72, 4.02), paperTopMaterial);
      paperTop.position.y = 0.026;
      paperTop.rotation.x = -Math.PI / 2;
      paperTop.receiveShadow = true;
      paper.add(paperTop);

      const scorePlate = new THREE.Group();
      scorePlate.position.set(2.08, 0.06, 0.92);
      scorePlate.rotation.set(0, 0, 0.08);
      paper.add(scorePlate);

      const sealColor = tone === "good" ? 0x1d7f42 : tone === "partial" ? 0x936100 : 0x8e8e93;
      const seal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.026, 72),
        new THREE.MeshStandardMaterial({
          color: sealColor,
          opacity: tone === "low" ? 0.22 : 0.34,
          roughness: 0.5,
          transparent: true,
        }),
      );
      seal.castShadow = true;
      seal.scale.setScalar(0.01);
      scorePlate.add(seal);

      const stapleMaterial = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.25, metalness: 0.72 });
      const stapleGroup = new THREE.Group();
      stapleGroup.position.set(-2.34, 0.07, -1.42);
      stapleGroup.visible = false;
      paper.add(stapleGroup);

      const stapleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.018, 0.04), stapleMaterial);
      const stapleLegLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.3), stapleMaterial);
      const stapleLegRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.3), stapleMaterial);
      stapleLegLeft.position.x = -0.21;
      stapleLegRight.position.x = 0.21;
      stapleGroup.add(stapleBridge, stapleLegLeft, stapleLegRight);

      const staplerGroup = new THREE.Group();
      staplerGroup.position.set(-3.7, 0.15, 1.1);
      staplerGroup.rotation.set(0.12, -0.8, -0.08);
      root.add(staplerGroup);

      const fallbackStapler = () => {
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.42, metalness: 0.16 });
        const topMaterial = new THREE.MeshStandardMaterial({ color: 0x6e6e73, roughness: 0.38, metalness: 0.2 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.68), baseMaterial);
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.28, 0.62), topMaterial);
        base.position.y = -0.14;
        top.position.set(0.04, 0.15, 0);
        top.rotation.z = -0.08;
        base.castShadow = true;
        top.castShadow = true;
        staplerGroup.add(base, top);
      };

      try {
        const gltf = await new GLTFLoader().loadAsync(STAPLER_MODEL_PATH);

        if (cancelled) {
          return;
        }

        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        model.position.sub(center);
        model.scale.setScalar(2.2 / Math.max(size.x, size.y, size.z, 0.01));
        model.rotation.set(0, Math.PI, 0);
        model.traverse((object) => {
          if ("castShadow" in object) {
            object.castShadow = true;
          }
          if ("receiveShadow" in object) {
            object.receiveShadow = true;
          }
        });
        staplerGroup.add(model);
      } catch {
        fallbackStapler();
      }

      const ambientLight = new THREE.HemisphereLight(0xffffff, 0xd7d0c2, 1.35);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
      keyLight.position.set(-3.2, 5.5, 4.4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);

      const rimLight = new THREE.PointLight(0x8bc8ff, 2.2, 14);
      rimLight.position.set(3.8, 2.2, 4.8);
      scene.add(rimLight);

      resize = () => {
        const { innerHeight, innerWidth } = window;
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / Math.max(innerHeight, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const startedAt = performance.now();
      window.clearTimeout(timeout);
      timeout = window.setTimeout(onComplete, SPECTACLE_DURATION_MS);

      const animate = (now: number) => {
        const progress = clamp((now - startedAt) / SPECTACLE_DURATION_MS);
        const enter = easeOutQuint(clamp(progress / 0.2));
        const travel = easeInOut(clamp((progress - 0.12) / 0.36));
        const press = easeInOut(clamp((progress - 0.48) / 0.12));
        const count = easeOutQuint(clamp((progress - 0.54) / 0.24));
        const burst = easeOutQuint(clamp((progress - 0.62) / 0.18));
        const settle = easeOutQuint(clamp((progress - 0.74) / 0.12));
        const exit = easeInOut(clamp((progress - 0.88) / 0.12));
        const pressed = Math.sin(press * Math.PI);

        root.position.y = -0.1 + enter * 0.3 - exit * 0.2 + Math.sin(progress * Math.PI * 5) * 0.018;
        root.rotation.y = -0.1 + Math.sin(progress * Math.PI * 1.45) * 0.07;

        staplerGroup.position.x = -3.85 + travel * 1.48 + settle * 0.18;
        staplerGroup.position.y = 0.18 + Math.sin(travel * Math.PI) * 1.28 - pressed * 0.62 + burst * 0.08;
        staplerGroup.position.z = 1.35 - travel * 2.78 + settle * 0.1;
        staplerGroup.rotation.y = -0.72 + travel * (Math.PI * 2.32) + settle * 0.18;
        staplerGroup.rotation.x = 0.16 + Math.sin(travel * Math.PI) * 0.72 - pressed * 0.62;
        staplerGroup.rotation.z = -0.12 + Math.sin(travel * Math.PI * 2.4) * 0.18 + pressed * 0.1;
        staplerGroup.scale.setScalar(0.82 + enter * 0.2 + burst * 0.035);

        paper.position.y = -0.82 + Math.sin(press * Math.PI) * -0.055;
        paper.rotation.z = -0.015 + settle * 0.035 + pressed * 0.018;
        paper.rotation.x = pressed * -0.018 + burst * 0.012;

        seal.scale.setScalar(0.01 + easeOutQuint(clamp((progress - 0.52) / 0.16)) * (0.82 + settle * 0.05));
        seal.rotation.z = -0.4 + easeOutQuint(clamp((progress - 0.52) / 0.22)) * 0.4;
        stapleGroup.visible = progress > 0.535;
        stapleGroup.scale.setScalar(0.01 + easeOutQuint(clamp((progress - 0.535) / 0.07)) * (1 + burst * 0.08));
        stapleGroup.rotation.y = Math.sin(burst * Math.PI) * 0.08;

        if (scoreRef.current) {
          scoreRef.current.textContent = String(Math.round(awardedMarks * count));
        }

        const cameraDrift = Math.sin(progress * Math.PI * 1.3);
        camera.position.x = -0.15 + cameraDrift * 0.28 + burst * 0.12;
        camera.position.y = 3.8 - enter * 0.5 + settle * 0.16 + exit * 0.3;
        camera.position.z = 8.8 - enter * 0.7 + Math.sin(progress * Math.PI * 2.2) * 0.18 + exit * 0.8;
        camera.lookAt(0.05, -0.48, -0.12);

        renderer.domElement.style.opacity = String(1 - exit);
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
        paperTexture.dispose();
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
  }, [awardedMarks, onComplete, runId, tone, totalMarks]);

  return (
    <div className="marking-spectacle" data-tone={tone} role="status" aria-live="polite">
      <div ref={canvasHostRef} className="marking-spectacle__canvas" aria-hidden="true" />
      <div className="marking-spectacle__paper-light" aria-hidden="true" />
      <div className="marking-spectacle__confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((piece, index) => (
          <span key={index} className="marking-spectacle__confetti-piece" style={confettiStyle(piece)} />
        ))}
      </div>
      <div className="marking-spectacle__hud">
        <p className="eyebrow">{tone === "good" ? "Marked and filed" : tone === "partial" ? "Marked carefully" : "Marked for review"}</p>
        <div className="marking-spectacle__score">
          <span ref={scoreRef}>0</span>
          <span>/ {totalMarks}</span>
        </div>
        <p>
          {tone === "good"
            ? "Strong answer. The scheme is happy."
            : tone === "partial"
              ? "Some good points landed. A few marks are still on the table."
              : "Not your best one. The next attempt gets a cleaner shot."}
        </p>
        <small>{markedCount} part{markedCount === 1 ? "" : "s"} checked</small>
      </div>
    </div>
  );
}
