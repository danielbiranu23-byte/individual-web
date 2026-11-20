import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface WaterfallScene3DProps {
  darkMode: boolean;
}

interface BirdInstance {
  root: THREE.Group;
  leftInnerPivot: THREE.Group;
  leftOuterPivot: THREE.Group;
  rightInnerPivot: THREE.Group;
  rightOuterPivot: THREE.Group;
  baseCenter: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  amplitudeY: number;
  speed: number;
  phase: number;
  flapSpeed: number;
  figureEight: boolean;
}

function createRockTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 512, 512);

    // Stratified basalt / canyon stone bands
    for (let y = 0; y < 512; y += 14) {
      const shade = 52 + Math.floor(Math.sin(y * 0.08) * 14 + ((y * 19) % 18));
      ctx.fillStyle = `rgb(${shade}, ${shade + 8}, ${shade + 18})`;
      ctx.fillRect(0, y, 512, 10 + (y % 6));
    }

    // Crags and moss patches
    for (let i = 0; i < 420; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      const w = 12 + (i % 28);
      const h = 4 + (i % 10);
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(34, 94, 72, 0.28)'
          : i % 2 === 0
            ? 'rgba(15, 23, 42, 0.25)'
            : 'rgba(148, 163, 184, 0.16)';
      ctx.fillRect(x, y, w, h);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.38, 'rgba(224, 247, 255, 0.55)');
    grad.addColorStop(0.75, 'rgba(186, 230, 253, 0.16)');
    grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDropletTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.42, 'rgba(224, 247, 255, 0.96)');
    grad.addColorStop(0.74, 'rgba(56, 189, 248, 0.55)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCompositeTree(
  trunkMat: THREE.Material,
  foliageMatA: THREE.Material,
  foliageMatB: THREE.Material,
  scale: number
): THREE.Group {
  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.19, 1.35, 7);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.65;
  group.add(trunk);

  const tier1 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.45, 7), foliageMatA);
  tier1.position.y = 1.55;
  group.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.ConeGeometry(0.74, 1.25, 7), foliageMatB);
  tier2.position.y = 2.25;
  group.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.95, 7), foliageMatA);
  tier3.position.y = 2.9;
  group.add(tier3);

  group.scale.setScalar(scale);
  return group;
}

function buildCompositeBird(
  bodyMat: THREE.Material,
  wingTipMat: THREE.Material,
  beakMat: THREE.Material,
  scale: number
): Omit<
  BirdInstance,
  'baseCenter' | 'radiusX' | 'radiusZ' | 'amplitudeY' | 'speed' | 'phase' | 'flapSpeed' | 'figureEight'
> {
  const root = new THREE.Group();

  // Aerodynamic sculpted fuselage
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
  body.scale.set(0.72, 0.65, 1.85);
  root.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
  head.position.set(0, 0.08, 0.42);
  root.add(head);

  // Pointed beak facing +Z
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 6), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.06, 0.58);
  root.add(beak);

  // Tail fan
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), wingTipMat);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(1.35, 1, 0.22);
  tail.position.set(0, 0.03, -0.52);
  root.add(tail);

  // Left Wing (Inner + Outer articulated segments)
  const leftInnerPivot = new THREE.Group();
  leftInnerPivot.position.set(-0.14, 0.06, 0.04);
  const leftInner = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.3), bodyMat);
  leftInner.position.set(-0.28, 0, -0.02);
  leftInnerPivot.add(leftInner);

  const leftOuterPivot = new THREE.Group();
  leftOuterPivot.position.set(-0.56, 0, 0);
  const leftOuter = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 4), wingTipMat);
  leftOuter.rotation.z = Math.PI / 2;
  leftOuter.scale.set(0.25, 1, 0.9);
  leftOuter.position.set(-0.3, 0, -0.06);
  leftOuterPivot.add(leftOuter);
  leftInnerPivot.add(leftOuterPivot);
  root.add(leftInnerPivot);

  // Right Wing (Inner + Outer articulated segments)
  const rightInnerPivot = new THREE.Group();
  rightInnerPivot.position.set(0.14, 0.06, 0.04);
  const rightInner = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 0.3), bodyMat);
  rightInner.position.set(0.28, 0, -0.02);
  rightInnerPivot.add(rightInner);

  const rightOuterPivot = new THREE.Group();
  rightOuterPivot.position.set(0.56, 0, 0);
  const rightOuter = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 4), wingTipMat);
  rightOuter.rotation.z = -Math.PI / 2;
  rightOuter.scale.set(0.25, 1, 0.9);
  rightOuter.position.set(0.3, 0, -0.06);
  rightOuterPivot.add(rightOuter);
  rightInnerPivot.add(rightOuterPivot);
  root.add(rightInnerPivot);

  root.scale.setScalar(scale);

  return {
    root,
    leftInnerPivot,
    leftOuterPivot,
    rightInnerPivot,
    rightOuterPivot,
  };
}

export function WaterfallScene3D({ darkMode }: WaterfallScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const darkModeRef = useRef(darkMode);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    darkModeRef.current = darkMode;
  }, [darkMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Detect software WebGL rasterizers safely before configuring renderer
    let isSoftwareGl = false;
    try {
      const probeCanvas = document.createElement('canvas');
      const glProbe = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!glProbe) {
        setWebglFailed(true);
        return;
      }
      const debugInfo = glProbe.getExtension('WEBGL_debug_renderer_info');
      const rendererName = debugInfo
        ? String(glProbe.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
        : String(glProbe.getParameter(glProbe.RENDERER) || '');
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
    } catch {
      setWebglFailed(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0xd9f0ff, 0.022);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160);
    camera.position.set(0.6, 2.2, 19.5);
    camera.lookAt(0, 1.4, -2);

    // Procedural PMREM environment for wet rock and bird plumage reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Sky Dome Shader (smoothly blends Day & Moonlit Night themes)
    const skyUniforms = {
      uTopColor: { value: new THREE.Color('#6fbef7') },
      uHorizonColor: { value: new THREE.Color('#e2f4ff') },
      uSunGlowColor: { value: new THREE.Color('#fff4d6') },
      uDarkFactor: { value: darkModeRef.current ? 1 : 0 },
    };
    const skyGeo = new THREE.SphereGeometry(85, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunGlowColor;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(normalize(vWorldPos).y * 1.15 + 0.15, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.72));
          float sunHalo = pow(max(dot(normalize(vWorldPos), normalize(vec3(0.32, 0.45, -0.82))), 0.0), 10.0);
          col += uSunGlowColor * sunHalo * 0.45;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xcbeaff, 0x1e3a2f, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff3db, 2.1);
    sunLight.position.set(11, 16, 12);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 55;
    }
    scene.add(sunLight);

    const bounceLight = new THREE.PointLight(0x38bdf8, 2.8, 22, 1.4);
    bounceLight.position.set(0, -1.6, 2.2);
    scene.add(bounceLight);

    // Textures & Shared Materials
    const rockTex = createRockTexture();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    rockTex.anisotropy = isSoftwareGl ? 1 : Math.min(maxAniso, 8);
    const mistTex = createMistTexture();
    const dropletTex = createDropletTexture();

    const cliffRockMat = new THREE.MeshStandardMaterial({
      map: rockTex,
      color: 0x64748b,
      roughness: 0.78,
      metalness: 0.08,
    });
    const wetRockMat = new THREE.MeshStandardMaterial({
      map: rockTex,
      color: 0x3b495e,
      roughness: 0.28,
      metalness: 0.16,
    });
    const mossCapMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.85,
      metalness: 0.03,
    });
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
    });
    const foliageMatA = new THREE.MeshStandardMaterial({
      color: 0x1b5e3c,
      roughness: 0.78,
    });
    const foliageMatB = new THREE.MeshStandardMaterial({
      color: 0x2a7b52,
      roughness: 0.74,
    });

    const disposableGeos: THREE.BufferGeometry[] = [skyGeo];
    const disposableMats: THREE.Material[] = [
      skyMat,
      cliffRockMat,
      wetRockMat,
      mossCapMat,
      trunkMat,
      foliageMatA,
      foliageMatB,
    ];
    const disposableTexs: THREE.Texture[] = [rockTex, mistTex, dropletTex];

    // 1. Composite Terraced Canyon & Cliff Formations
    const canyonGroup = new THREE.Group();

    const blockSpecs: Array<{
      pos: [number, number, number];
      scale: [number, number, number];
      rotY: number;
      wet?: boolean;
      moss?: boolean;
    }> = [
      // Central back waterfall cliff wall
      { pos: [0, 3.8, -6.4], scale: [12.5, 11.2, 4.4], rotY: 0, wet: true },
      { pos: [0, 8.6, -6.1], scale: [10.4, 2.4, 3.8], rotY: 0.02, moss: true },
      // Left stepped canyon walls
      { pos: [-7.2, 3.2, -4.4], scale: [6.4, 12.6, 5.2], rotY: 0.34, moss: true },
      { pos: [-11.5, 4.4, -1.6], scale: [6.8, 13.8, 6.2], rotY: 0.55, moss: true },
      { pos: [-5.6, -1.6, -2.4], scale: [4.2, 4.4, 3.6], rotY: 0.25, wet: true },
      { pos: [-8.6, -2.4, 1.8], scale: [4.8, 3.4, 4.4], rotY: 0.42, moss: true },
      // Right stepped canyon walls
      { pos: [7.4, 3.4, -4.3], scale: [6.6, 12.8, 5.2], rotY: -0.32, moss: true },
      { pos: [11.8, 4.6, -1.4], scale: [6.8, 14.2, 6.4], rotY: -0.52, moss: true },
      { pos: [5.5, -1.5, -2.3], scale: [4.2, 4.5, 3.5], rotY: -0.28, wet: true },
      { pos: [8.8, -2.3, 2.1], scale: [5.0, 3.5, 4.4], rotY: -0.45, moss: true },
      // Mid-tier shelf where upper stream hits and splits
      { pos: [-0.2, 1.45, -4.2], scale: [6.6, 2.2, 2.8], rotY: 0.04, wet: true },
      // Shoreline boulders
      { pos: [-3.9, -3.5, 1.6], scale: [2.1, 1.4, 1.9], rotY: 0.6, wet: true },
      { pos: [4.1, -3.4, 1.9], scale: [2.3, 1.5, 1.8], rotY: -0.4, wet: true },
      { pos: [-1.8, -3.85, 3.4], scale: [1.4, 0.85, 1.2], rotY: 0.9, wet: true },
      { pos: [2.4, -3.8, 3.8], scale: [1.5, 0.9, 1.3], rotY: -0.7, wet: true },
    ];

    const boxGeo = new THREE.DodecahedronGeometry(0.66, 1);
    disposableGeos.push(boxGeo);

    blockSpecs.forEach((spec) => {
      const mesh = new THREE.Mesh(boxGeo, spec.wet ? wetRockMat : cliffRockMat);
      mesh.position.set(...spec.pos);
      mesh.scale.set(...spec.scale);
      mesh.rotation.y = spec.rotY;
      if (!isSoftwareGl) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      canyonGroup.add(mesh);

      if (spec.moss) {
        const cap = new THREE.Mesh(boxGeo, mossCapMat);
        cap.position.set(spec.pos[0], spec.pos[1] + spec.scale[1] * 0.43, spec.pos[2]);
        cap.scale.set(spec.scale[0] * 0.88, spec.scale[1] * 0.14, spec.scale[2] * 0.86);
        cap.rotation.y = spec.rotY;
        canyonGroup.add(cap);
      }
    });

    // Cliffside trees along canyon rim & upper shelves
    const treePlacements: Array<{ pos: [number, number, number]; scale: number }> = [
      { pos: [-6.6, 8.1, -4.1], scale: 1.05 },
      { pos: [-8.8, 8.7, -2.5], scale: 1.25 },
      { pos: [-11.2, 9.6, -1.2], scale: 1.35 },
      { pos: [-4.2, 8.4, -5.6], scale: 0.9 },
      { pos: [4.5, 8.5, -5.5], scale: 0.95 },
      { pos: [7.0, 8.2, -3.9], scale: 1.1 },
      { pos: [9.4, 9.0, -2.2], scale: 1.3 },
      { pos: [11.6, 9.8, -1.0], scale: 1.2 },
      { pos: [-7.5, -0.7, 1.4], scale: 0.88 },
      { pos: [7.9, -0.6, 1.7], scale: 0.92 },
    ];
    treePlacements.forEach((tp) => {
      const tree = buildCompositeTree(trunkMat, foliageMatA, foliageMatB, tp.scale);
      tree.position.set(...tp.pos);
      tree.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (!disposableGeos.includes(m.geometry)) {
            disposableGeos.push(m.geometry);
          }
        }
      });
      canyonGroup.add(tree);
    });

    scene.add(canyonGroup);

    // 2. Animated Shader Waterfalls (Upper Cascade + Main Lower Cascade + Side Veil)
    const waterfallUniforms = {
      uTime: { value: 0 },
      uWaterDeep: { value: new THREE.Color('#0284c7') },
      uWaterBright: { value: new THREE.Color('#67e8f9') },
      uFoamColor: { value: new THREE.Color('#f0f9ff') },
    };

    const waterfallShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: waterfallUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // Subtle forward cascade arc + fluid undulation
          float topCurve = sin((1.0 - uv.y) * 1.45) * 0.55;
          float ripple = sin(uv.x * 16.0 + uTime * 3.8) * 0.08
                       + sin(uv.y * 12.0 + uTime * 7.5) * 0.07;
          pos.z += topCurve + ripple * (1.0 - uv.y * 0.45);
          vWave = ripple;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uWaterDeep;
        uniform vec3 uWaterBright;
        uniform vec3 uFoamColor;
        varying vec2 vUv;
        varying float vWave;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          // Scroll fast downward along UV.y
          vec2 flow1 = vec2(vUv.x * 7.5, vUv.y * 4.5 + uTime * 2.35);
          vec2 flow2 = vec2(vUv.x * 15.0 + 1.7, vUv.y * 8.0 + uTime * 3.65);

          float streamA = noise(flow1);
          float streamB = noise(flow2);
          float streaks = smoothstep(0.32, 0.85, streamA * 0.62 + streamB * 0.48);

          // Soft side edge taper + intense frothy top crest & bottom plunge foam
          float edgeFade = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
          float crestFoam = smoothstep(0.82, 0.99, vUv.y) * 0.85;
          float plungeFoam = (1.0 - smoothstep(0.0, 0.24, vUv.y)) * 0.92;
          float foamAmount = clamp(streaks * 0.72 + crestFoam + plungeFoam + vWave * 1.4, 0.0, 1.0);

          vec3 waterCol = mix(uWaterDeep, uWaterBright, streamA * 0.75 + 0.25);
          vec3 finalCol = mix(waterCol, uFoamColor, pow(foamAmount, 1.35));

          float alpha = edgeFade * (0.76 + foamAmount * 0.24);
          gl_FragColor = vec4(finalCol, alpha);
        }
      `,
    });
    disposableMats.push(waterfallShaderMat);

    // Upper waterfall tier
    const upperFallGeo = new THREE.PlaneGeometry(4.4, 6.2, 24, 32);
    disposableGeos.push(upperFallGeo);
    const upperFall = new THREE.Mesh(upperFallGeo, waterfallShaderMat);
    upperFall.position.set(0, 5.1, -3.7);
    upperFall.rotation.x = -0.11;
    scene.add(upperFall);

    // Main lower plunge cascade
    const lowerFallGeo = new THREE.PlaneGeometry(5.6, 6.3, 28, 36);
    disposableGeos.push(lowerFallGeo);
    const lowerFall = new THREE.Mesh(lowerFallGeo, waterfallShaderMat);
    lowerFall.position.set(0.05, -0.8, -2.5);
    lowerFall.rotation.x = -0.14;
    scene.add(lowerFall);

    // Side silver cascade ribbon
    const sideFallGeo = new THREE.PlaneGeometry(1.45, 5.8, 12, 24);
    disposableGeos.push(sideFallGeo);
    const sideFall = new THREE.Mesh(sideFallGeo, waterfallShaderMat);
    sideFall.position.set(-3.1, -0.95, -2.3);
    sideFall.rotation.x = -0.15;
    sideFall.rotation.z = -0.05;
    scene.add(sideFall);

    // Upper river feeding the crest
    const riverGeo = new THREE.PlaneGeometry(5.2, 6.0, 14, 14);
    disposableGeos.push(riverGeo);
    const upperRiver = new THREE.Mesh(riverGeo, waterfallShaderMat);
    upperRiver.rotation.x = -Math.PI / 2;
    upperRiver.position.set(0, 8.15, -6.9);
    scene.add(upperRiver);

    // 3. Plunge Pool Water Plane with Concentric Ripples + Interactive Cursor Splash Waves
    const rippleRingData = [
      new THREE.Vector4(0, 0, -99, 0),
      new THREE.Vector4(0, 0, -99, 0),
      new THREE.Vector4(0, 0, -99, 0),
      new THREE.Vector4(0, 0, -99, 0),
      new THREE.Vector4(0, 0, -99, 0),
      new THREE.Vector4(0, 0, -99, 0),
    ];
    const poolUniforms = {
      uTime: { value: 0 },
      uPoolDeep: { value: new THREE.Color('#0c4a6e') },
      uPoolShallow: { value: new THREE.Color('#0ea5e9') },
      uFoamColor: { value: new THREE.Color('#e0f2fe') },
      uRipples: { value: rippleRingData },
    };
    const poolGeo = new THREE.PlaneGeometry(38, 28, 64, 64);
    disposableGeos.push(poolGeo);
    const poolMat = new THREE.ShaderMaterial({
      uniforms: poolUniforms,
      vertexShader: `
        uniform float uTime;
        uniform vec4 uRipples[6];
        varying vec2 vUv;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        varying float vCursorFoam;
        void main() {
          vUv = uv;
          vec3 pos = position;
          vec4 worldBase = modelMatrix * vec4(pos, 1.0);

          float dist = length(pos.xy - vec2(0.0, 3.2));
          float ripple = sin(dist * 3.4 - uTime * 3.8) * 0.08 * exp(-dist * 0.12);
          float swell = sin(pos.x * 0.9 + uTime * 1.4) * 0.05;

          float cursorWave = 0.0;
          float cursorFoam = 0.0;
          for (int i = 0; i < 6; i++) {
            vec4 rp = uRipples[i];
            float age = uTime - rp.z;
            if (age >= 0.0 && age < 2.8 && rp.w > 0.01) {
              float d = length(worldBase.xz - rp.xy);
              float radius = age * 4.6;
              float band = exp(-abs(d - radius) * 1.15);
              float fade = exp(-age * 1.35) * rp.w;
              float wave = sin((d - radius) * 5.6) * band * fade;
              cursorWave += wave * 0.34;
              cursorFoam += band * fade * (0.65 + 0.35 * sin((d - radius) * 5.6));
            }
          }

          pos.z += ripple + swell + cursorWave;
          vPos = pos;
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          vCursorFoam = clamp(cursorFoam, 0.0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uPoolDeep;
        uniform vec3 uPoolShallow;
        uniform vec3 uFoamColor;
        uniform vec4 uRipples[6];
        varying vec2 vUv;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        varying float vCursorFoam;
        void main() {
          float impactDist = length(vPos.xy - vec2(0.0, 3.2));
          float ring = sin(impactDist * 4.2 - uTime * 4.2) * 0.5 + 0.5;
          float splashZone = exp(-impactDist * 0.28);
          float shimmer = pow(max(sin(vPos.x * 2.4 + uTime * 2.1) * cos(vPos.y * 2.2 - uTime * 1.6), 0.0), 4.0);

          float rippleHighlight = vCursorFoam;
          for (int i = 0; i < 6; i++) {
            vec4 rp = uRipples[i];
            float age = uTime - rp.z;
            if (age >= 0.0 && age < 2.4 && rp.w > 0.01) {
              float d = length(vWorldPos.xz - rp.xy);
              float radius = age * 4.6;
              float ringLine = exp(-pow((d - radius) * 2.2, 2.0));
              rippleHighlight += ringLine * exp(-age * 1.35) * rp.w;
            }
          }

          vec3 baseCol = mix(uPoolDeep, uPoolShallow, clamp(splashZone * 0.85 + 0.25 + rippleHighlight * 0.35, 0.0, 1.0));
          float foamMask = clamp(splashZone * (0.45 + ring * 0.55) + shimmer * 0.22 + rippleHighlight * 0.92, 0.0, 1.0);
          vec3 finalCol = mix(baseCol, uFoamColor, foamMask * 0.78);
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `,
    });
    disposableMats.push(poolMat);

    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.position.set(0, -3.95, 2.2);
    scene.add(poolMesh);

    // 4. Rising Mist / Waterfall Spray Particles (pre-allocated arrays)
    const mistCount = 340;
    const mistPositions = new Float32Array(mistCount * 3);
    const mistVelocities = new Float32Array(mistCount * 3);
    const mistLives = new Float32Array(mistCount);

    function resetMistParticle(i: number, initial: boolean) {
      const spreadX = (Math.random() - 0.5) * 6.8;
      const isUpper = i % 4 === 0;
      mistPositions[i * 3] = spreadX * (isUpper ? 0.75 : 1.0);
      mistPositions[i * 3 + 1] = isUpper
        ? 1.2 + Math.random() * 1.1
        : -3.7 + Math.random() * 1.2;
      mistPositions[i * 3 + 2] = (isUpper ? -3.4 : -1.5) + (Math.random() - 0.5) * 3.4;

      mistVelocities[i * 3] = spreadX * 0.11 + (Math.random() - 0.5) * 0.25;
      mistVelocities[i * 3 + 1] = 0.75 + Math.random() * 1.35;
      mistVelocities[i * 3 + 2] = 0.35 + Math.random() * 0.9;
      mistLives[i] = initial ? Math.random() : 0;
    }

    for (let i = 0; i < mistCount; i++) {
      resetMistParticle(i, true);
    }

    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPositions, 3));
    disposableGeos.push(mistGeo);

    const mistMat = new THREE.PointsMaterial({
      map: mistTex,
      color: 0xeaf8ff,
      size: 1.75,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposableMats.push(mistMat);

    const mistPoints = new THREE.Points(mistGeo, mistMat);
    scene.add(mistPoints);

    // 4b. Cursor-Triggered 3D Water Splash Droplets (pre-allocated circular pool)
    const splashCount = 280;
    const splashPositions = new Float32Array(splashCount * 3);
    const splashVelocities = new Float32Array(splashCount * 3);
    const splashAges = new Float32Array(splashCount);
    const splashMaxLives = new Float32Array(splashCount);
    const splashActive = new Uint8Array(splashCount);

    for (let i = 0; i < splashCount; i++) {
      splashPositions[i * 3 + 1] = -999;
      splashActive[i] = 0;
    }

    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    disposableGeos.push(splashGeo);

    const splashMat = new THREE.PointsMaterial({
      map: dropletTex,
      color: 0xffffff,
      size: 0.62,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    disposableMats.push(splashMat);

    const splashPoints = new THREE.Points(splashGeo, splashMat);
    splashPoints.frustumCulled = false;
    scene.add(splashPoints);

    let nextSplashIdx = 0;
    let nextRippleSlot = 0;
    let lastHoverSplashAt = 0;

    // 5. Articulated 3D Flying Birds Soaring Across & Above the Waterfall
    const birdWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
      metalness: 0.05,
    });
    const birdSlateTipMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.55,
    });
    const birdAzureMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.42,
      metalness: 0.12,
    });
    const birdBeakMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.38,
    });
    disposableMats.push(birdWhiteMat, birdSlateTipMat, birdAzureMat, birdBeakMat);

    const birdConfigs = [
      {
        center: new THREE.Vector3(-0.6, 5.2, 2.5),
        rx: 7.4,
        rz: 4.8,
        ay: 1.15,
        speed: 0.48,
        phase: 0.0,
        flapSpeed: 6.4,
        scale: 0.92,
        figureEight: true,
        azure: false,
      },
      {
        center: new THREE.Vector3(1.2, 6.5, 1.2),
        rx: 8.6,
        rz: 5.2,
        ay: 1.35,
        speed: 0.42,
        phase: 1.3,
        flapSpeed: 5.8,
        scale: 0.85,
        figureEight: false,
        azure: true,
      },
      {
        center: new THREE.Vector3(-1.4, 3.6, 4.2),
        rx: 6.2,
        rz: 4.0,
        ay: 0.95,
        speed: 0.54,
        phase: 2.6,
        flapSpeed: 7.1,
        scale: 0.78,
        figureEight: true,
        azure: false,
      },
      {
        center: new THREE.Vector3(0.4, 7.6, -0.8),
        rx: 9.2,
        rz: 5.5,
        ay: 1.2,
        speed: 0.37,
        phase: 3.9,
        flapSpeed: 5.5,
        scale: 0.88,
        figureEight: false,
        azure: false,
      },
      {
        center: new THREE.Vector3(2.1, 4.5, 5.0),
        rx: 6.8,
        rz: 3.6,
        ay: 0.85,
        speed: 0.52,
        phase: 4.8,
        flapSpeed: 6.8,
        scale: 0.72,
        figureEight: true,
        azure: true,
      },
      {
        center: new THREE.Vector3(-2.6, 6.2, 3.4),
        rx: 7.8,
        rz: 4.4,
        ay: 1.05,
        speed: 0.44,
        phase: 5.7,
        flapSpeed: 6.1,
        scale: 0.8,
        figureEight: false,
        azure: false,
      },
      {
        center: new THREE.Vector3(0.0, 2.2, 6.6),
        rx: 5.8,
        rz: 3.2,
        ay: 0.75,
        speed: 0.58,
        phase: 2.1,
        flapSpeed: 7.4,
        scale: 0.68,
        figureEight: true,
        azure: false,
      },
      {
        center: new THREE.Vector3(1.5, 8.2, 2.0),
        rx: 10.2,
        rz: 5.4,
        ay: 1.3,
        speed: 0.35,
        phase: 0.7,
        flapSpeed: 5.3,
        scale: 0.84,
        figureEight: false,
        azure: true,
      },
    ];

    const birds: BirdInstance[] = birdConfigs.map((cfg) => {
      const built = buildCompositeBird(
        cfg.azure ? birdAzureMat : birdWhiteMat,
        birdSlateTipMat,
        birdBeakMat,
        cfg.scale
      );
      built.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (!disposableGeos.includes(m.geometry)) {
            disposableGeos.push(m.geometry);
          }
        }
      });
      scene.add(built.root);
      return {
        ...built,
        baseCenter: cfg.center,
        radiusX: cfg.rx,
        radiusZ: cfg.rz,
        amplitudeY: cfg.ay,
        speed: cfg.speed,
        phase: cfg.phase,
        flapSpeed: cfg.flapSpeed,
        figureEight: cfg.figureEight,
      };
    });

    // Subtle pointer & scroll parallax state + Water Raycaster
    let targetMouseX = 0;
    let targetMouseY = 0;
    let scrollFactor = 0;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3.95);
    const rayHitPoint = new THREE.Vector3();
    const waterTargets: THREE.Object3D[] = [poolMesh, lowerFall, sideFall, upperFall];

    let themeBlend = darkModeRef.current ? 1 : 0;
    let disposed = false;
    let rafId = 0;
    let syncTimerId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    function triggerWaterSplash(wx: number, wy: number, wz: number, burstCount: number, power: number) {
      // Spawn expanding shader ripple ring on the water pool surface
      rippleRingData[nextRippleSlot].set(wx, wz, elapsed, Math.min(1.5, power));
      nextRippleSlot = (nextRippleSlot + 1) % rippleRingData.length;

      // Spawn scattering 3D water droplets with radial outward + upward burst velocities
      for (let i = 0; i < burstCount; i++) {
        const idx = nextSplashIdx;
        nextSplashIdx = (nextSplashIdx + 1) % splashCount;

        const angle = Math.random() * Math.PI * 2;
        const radialSpeed = (1.1 + Math.random() * 3.1) * power;
        const upSpeed = (2.8 + Math.random() * 4.2) * power;

        splashPositions[idx * 3] = wx + (Math.random() - 0.5) * 0.45;
        splashPositions[idx * 3 + 1] = Math.max(wy, -3.9) + 0.08;
        splashPositions[idx * 3 + 2] = wz + (Math.random() - 0.5) * 0.45;

        splashVelocities[idx * 3] = Math.cos(angle) * radialSpeed;
        splashVelocities[idx * 3 + 1] = upSpeed;
        splashVelocities[idx * 3 + 2] = Math.sin(angle) * radialSpeed;

        splashAges[idx] = 0;
        splashMaxLives[idx] = 0.65 + Math.random() * 0.55;
        splashActive[idx] = 1;
      }
    }

    function interactWithWaterAtClientPos(clientX: number, clientY: number, isClick: boolean) {
      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      pointerNdc.set((clientX / vw) * 2 - 1, -(clientY / vh) * 2 + 1);
      raycaster.setFromCamera(pointerNdc, camera);

      const hits = raycaster.intersectObjects(waterTargets, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        triggerWaterSplash(pt.x, pt.y, pt.z, isClick ? 54 : 20, isClick ? 1.42 : 0.95);
        return;
      }

      // Fallback to lower plunge pool plane if pointer is over lower water horizon
      if (pointerNdc.y < -0.05 && raycaster.ray.intersectPlane(waterPlane, rayHitPoint)) {
        const clampedX = THREE.MathUtils.clamp(rayHitPoint.x, -16, 16);
        const clampedZ = THREE.MathUtils.clamp(rayHitPoint.z, -10, 14);
        triggerWaterSplash(clampedX, -3.95, clampedZ, isClick ? 48 : 18, isClick ? 1.35 : 0.9);
      }
    }

    function handlePointerMove(e: PointerEvent) {
      targetMouseX = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      targetMouseY = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;

      const now = performance.now();
      if (now - lastHoverSplashAt >= 28) {
        lastHoverSplashAt = now;
        interactWithWaterAtClientPos(e.clientX, e.clientY, false);
      }
    }

    function handlePointerDown(e: PointerEvent) {
      interactWithWaterAtClientPos(e.clientX, e.clientY, true);
    }

    function handleScroll() {
      const docHeight = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      scrollFactor = Math.min(Math.max(window.scrollY / docHeight, 0), 1);
    }

    function handleResize() {
      if (!container) return;
      const nextW = container.clientWidth || window.innerWidth;
      const nextH = container.clientHeight || window.innerHeight;
      camera.aspect = nextW / Math.max(nextH, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // WebGL context loss guard
    function handleContextLost(e: Event) {
      e.preventDefault();
    }
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Reusable pre-allocated math objects (zero allocations in animation loop)
    const nextPosVec = new THREE.Vector3();
    const curPosVec = new THREE.Vector3();
    const tangentVec = new THREE.Vector3();
    const lookTargetVec = new THREE.Vector3();
    const daySkyTop = new THREE.Color('#6fbef7');
    const nightSkyTop = new THREE.Color('#071329');
    const daySkyHoriz = new THREE.Color('#e2f4ff');
    const nightSkyHoriz = new THREE.Color('#132d54');
    const daySunGlow = new THREE.Color('#fff4d6');
    const nightMoonGlow = new THREE.Color('#38bdf8');
    const dayFogCol = new THREE.Color('#d9f0ff');
    const nightFogCol = new THREE.Color('#0a1930');
    const dayWaterDeep = new THREE.Color('#0284c7');
    const nightWaterDeep = new THREE.Color('#073059');
    const dayWaterBright = new THREE.Color('#67e8f9');
    const nightWaterBright = new THREE.Color('#38bdf8');
    const dayFoam = new THREE.Color('#f4fbff');
    const nightFoam = new THREE.Color('#bae6fd');

    function sampleBirdPos(bird: BirdInstance, t: number, out: THREE.Vector3) {
      const ang = t * bird.speed + bird.phase;
      if (bird.figureEight) {
        out.x = bird.baseCenter.x + Math.sin(ang) * bird.radiusX;
        out.z = bird.baseCenter.z + Math.sin(ang * 2) * (bird.radiusZ * 0.55);
      } else {
        out.x = bird.baseCenter.x + Math.cos(ang) * bird.radiusX;
        out.z = bird.baseCenter.z + Math.sin(ang) * bird.radiusZ;
      }
      out.y = bird.baseCenter.y + Math.sin(ang * 1.6 + bird.phase) * bird.amplitudeY;
    }

    function stepFrame(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += dt;

      // Smooth Day / Night atmosphere interpolation
      const targetBlend = darkModeRef.current ? 1 : 0;
      themeBlend += (targetBlend - themeBlend) * Math.min(dt * 4.5, 1);

      skyUniforms.uTopColor.value.copy(daySkyTop).lerp(nightSkyTop, themeBlend);
      skyUniforms.uHorizonColor.value.copy(daySkyHoriz).lerp(nightSkyHoriz, themeBlend);
      skyUniforms.uSunGlowColor.value.copy(daySunGlow).lerp(nightMoonGlow, themeBlend);
      fog.color.copy(dayFogCol).lerp(nightFogCol, themeBlend);

      waterfallUniforms.uTime.value = elapsed;
      waterfallUniforms.uWaterDeep.value.copy(dayWaterDeep).lerp(nightWaterDeep, themeBlend);
      waterfallUniforms.uWaterBright.value.copy(dayWaterBright).lerp(nightWaterBright, themeBlend);
      waterfallUniforms.uFoamColor.value.copy(dayFoam).lerp(nightFoam, themeBlend);

      poolUniforms.uTime.value = elapsed;
      poolUniforms.uPoolDeep.value.copy(dayWaterDeep).lerp(nightWaterDeep, themeBlend);
      poolUniforms.uPoolShallow.value.copy(dayWaterBright).lerp(nightWaterBright, themeBlend);
      poolUniforms.uFoamColor.value.copy(dayFoam).lerp(nightFoam, themeBlend);

      sunLight.intensity = 2.15 - themeBlend * 1.15;
      hemiLight.intensity = 1.18 - themeBlend * 0.52;
      bounceLight.intensity = 2.6 + themeBlend * 1.6 + Math.sin(elapsed * 3.0) * 0.25;
      mistMat.opacity = 0.42 - themeBlend * 0.14;

      // Update mist droplets with zero allocations
      const posAttr = mistGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < mistCount; i++) {
        mistLives[i] += dt * (0.28 + (i % 5) * 0.05);
        if (mistLives[i] >= 1) {
          resetMistParticle(i, false);
        } else {
          mistPositions[i * 3] += mistVelocities[i * 3] * dt + Math.sin(elapsed + i) * 0.004;
          mistPositions[i * 3 + 1] += mistVelocities[i * 3 + 1] * dt;
          mistPositions[i * 3 + 2] += mistVelocities[i * 3 + 2] * dt;
        }
      }
      posAttr.needsUpdate = true;

      // Update cursor-triggered 3D water splash droplets with gravity & bounce
      const splashPosAttr = splashGeo.getAttribute('position') as THREE.BufferAttribute;
      let anySplashChanged = false;
      for (let i = 0; i < splashCount; i++) {
        if (!splashActive[i]) continue;
        anySplashChanged = true;
        splashAges[i] += dt;
        if (splashAges[i] >= splashMaxLives[i]) {
          splashActive[i] = 0;
          splashPositions[i * 3 + 1] = -999;
          continue;
        }
        splashVelocities[i * 3 + 1] -= 13.5 * dt; // Gravity
        splashPositions[i * 3] += splashVelocities[i * 3] * dt;
        splashPositions[i * 3 + 1] += splashVelocities[i * 3 + 1] * dt;
        splashPositions[i * 3 + 2] += splashVelocities[i * 3 + 2] * dt;

        // Micro rebound when droplet hits water surface
        if (splashPositions[i * 3 + 1] < -3.93 && splashVelocities[i * 3 + 1] < 0) {
          splashPositions[i * 3 + 1] = -3.93;
          splashVelocities[i * 3 + 1] *= -0.32;
          splashVelocities[i * 3] *= 0.72;
          splashVelocities[i * 3 + 2] *= 0.72;
        }
      }
      if (anySplashChanged) {
        splashPosAttr.needsUpdate = true;
      }

      // Update articulated flying birds along smooth canyon flight arcs
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        sampleBirdPos(b, elapsed, curPosVec);
        sampleBirdPos(b, elapsed + 0.06, nextPosVec);
        b.root.position.copy(curPosVec);

        tangentVec.subVectors(nextPosVec, curPosVec);
        if (tangentVec.lengthSq() > 0.00001) {
          b.root.lookAt(nextPosVec);
          // Bank smoothly into curves
          const bankAngle = Math.sin(elapsed * b.speed * 1.5 + b.phase) * 0.34;
          b.root.rotateZ(bankAngle);
        }

        // Occasional natural glide interspersed with crisp wingbeats
        const glideCycle = Math.sin(elapsed * 0.75 + b.phase * 2.1);
        const flapAmp = glideCycle > 0.45 ? 0.16 : 0.72;
        const flap = Math.sin(elapsed * b.flapSpeed + b.phase * 3.0) * flapAmp;
        const outerDelay = Math.sin(elapsed * b.flapSpeed + b.phase * 3.0 - 0.55) * (flapAmp * 0.65);

        b.leftInnerPivot.rotation.z = -flap;
        b.leftOuterPivot.rotation.z = -outerDelay;
        b.rightInnerPivot.rotation.z = flap;
        b.rightOuterPivot.rotation.z = outerDelay;
      }

      // Gentle camera parallax driven by pointer and vertical scroll
      const desiredCamX = 0.6 + targetMouseX * 1.15;
      const desiredCamY = 2.4 - targetMouseY * 0.55 - scrollFactor * 1.45;
      const desiredCamZ = 19.5 - scrollFactor * 1.6;
      camera.position.x += (desiredCamX - camera.position.x) * Math.min(dt * 3.2, 1);
      camera.position.y += (desiredCamY - camera.position.y) * Math.min(dt * 3.2, 1);
      camera.position.z += (desiredCamZ - camera.position.z) * Math.min(dt * 3.2, 1);
      lookTargetVec.set(0, 1.35 - scrollFactor * 0.7, -2.0);
      camera.lookAt(lookTargetVec);

      renderer.render(scene, camera);
    }

    function scheduleNext() {
      if (disposed) return;
      if (prefersReducedMotion) return;

      if (isSoftwareGl) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          let checks = 0;
          const waitFence = () => {
            if (disposed) {
              if (sync) gl.deleteSync(sync);
              return;
            }
            const status = sync
              ? gl.clientWaitSync(sync, 0, 0)
              : gl.ALREADY_SIGNALED;
            if (
              status === gl.ALREADY_SIGNALED ||
              status === gl.CONDITION_SATISFIED ||
              checks > 4
            ) {
              if (sync) gl.deleteSync(sync);
              rafId = requestAnimationFrame((now) => {
                if (disposed) return;
                stepFrame(now);
                scheduleNext();
              });
            } else {
              checks += 1;
              syncTimerId = window.setTimeout(waitFence, 16);
            }
          };
          syncTimerId = window.setTimeout(waitFence, 16);
          return;
        }
      }

      rafId = requestAnimationFrame((now) => {
        if (disposed) return;
        stepFrame(now);
        scheduleNext();
      });
    }

    // Draw initial crisp frame immediately
    stepFrame(performance.now());
    if (!prefersReducedMotion) {
      scheduleNext();
    }

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (syncTimerId) clearTimeout(syncTimerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      envTarget.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTexs.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglFailed) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-sky-200 via-cyan-100 to-blue-200 dark:from-[#040a18] dark:via-[#081c38] dark:to-[#041022]"
      />
    );
  }

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    />
  );
}
