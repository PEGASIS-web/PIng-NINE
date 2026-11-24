import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCampusTextures } from '../game/textures.ts';

interface WifiWavePulse {
  ring: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  baseY: number;
  phaseOffset: number;
  maxScale: number;
}

interface CloudMonsterRig {
  group: THREE.Group;
  blocks: THREE.Mesh[];
  eyeRing: THREE.Mesh;
  cables: THREE.Mesh[];
  orbitCenter: THREE.Vector3;
  radiusX: number;
  radiusZ: number;
  baseY: number;
  speed: number;
  phase: number;
}

const _tmpVec = new THREE.Vector3();

function createClockFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Hour ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
    ctx.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106);
    ctx.stroke();
  }

  // 8:58 hands!
  // Hour hand near 9
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 - 64, 128 - 6);
  ctx.stroke();

  // Minute hand at 58
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 128);
  ctx.lineTo(128 - 18, 128 - 88);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCloudMonster(scale = 1, seed = 0): CloudMonsterRig {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x333949,
    roughness: 0.85,
    metalness: 0.15,
    emissive: 0x160a24,
    emissiveIntensity: 0.7,
  });
  const glitchMat = new THREE.MeshStandardMaterial({
    color: 0x1e2230,
    roughness: 0.65,
    metalness: 0.3,
    emissive: 0xff2d55,
    emissiveIntensity: 0.25,
  });

  const blocks: THREE.Mesh[] = [];
  const offsets: Array<[number, number, number, number, number, number]> = [
    [0, 0, 0, 2.2, 1.45, 1.6],
    [-0.95, 0.2, 0.15, 1.3, 1.05, 1.25],
    [0.95, 0.15, -0.1, 1.35, 1.1, 1.2],
    [0.1, 0.72, 0.05, 1.5, 0.9, 1.15],
    [-0.55, -0.45, 0.25, 0.95, 0.72, 0.9],
    [0.62, -0.42, -0.2, 1.0, 0.75, 0.9],
    [0, 0.1, -0.65, 1.4, 1.0, 0.9],
  ];

  offsets.forEach(([x, y, z, w, h, d], idx) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      (idx + seed) % 3 === 0 ? glitchMat : bodyMat
    );
    m.position.set(x, y, z);
    m.userData.basePos = new THREE.Vector3(x, y, z);
    m.castShadow = true;
    group.add(m);
    blocks.push(m);
  });

  // Grumpy brow & glowing crimson eyes + spinning loading-ring eye
  const browMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const brow = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 0.16), browMat);
  brow.position.set(0, 0.42, 0.84);
  brow.rotation.z = -0.09;
  group.add(brow);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2d55 });
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.12), eyeMat);
  leftEye.position.set(-0.42, 0.18, 0.85);
  group.add(leftEye);

  const eyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 8, 18, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e })
  );
  eyeRing.position.set(0.42, 0.18, 0.87);
  group.add(eyeRing);

  const frown = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.1), eyeMat);
  frown.position.set(0, -0.22, 0.85);
  frown.rotation.z = 0.08;
  group.add(frown);

  // Dangling broken cables underneath
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x181b26,
    emissive: 0xff2d55,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const cables: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 1.05, 6), cableMat);
    cab.position.set(-0.6 + i * 0.4, -1.05, (i % 2 === 0 ? 1 : -1) * 0.25);
    group.add(cab);
    cables.push(cab);
  }

  const aura = new THREE.PointLight(0xff2d55, 2.2 * scale, 10);
  aura.position.set(0, -0.2, 0.9);
  group.add(aura);

  group.scale.setScalar(scale);

  return {
    group,
    blocks,
    eyeRing,
    cables,
    orbitCenter: new THREE.Vector3(),
    radiusX: 8,
    radiusZ: 6,
    baseY: 5,
    speed: 0.4,
    phase: seed * 1.7,
  };
}

export const TitleCampus3D: React.FC<{ inspectMode?: boolean }> = ({ inspectMode = false }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const inspectRef = useRef(inspectMode);
  inspectRef.current = inspectMode;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161128);
    scene.fog = new THREE.FogExp2(0x18122b, 0.014);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(46, initW / initH, 0.2, 220);
    camera.position.set(16, 12.5, 33);
    camera.lookAt(0, 5.2, -2);

    // Dusk Gradient Sky Dome
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x130e27) },
        uMid: { value: new THREE.Color(0x3a244f) },
        uHorizon: { value: new THREE.Color(0x884c6b) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
          col = mix(col, uTop, smoothstep(0.28, 0.85, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(130, 24, 16), skyMat));

    // Warm/Cool Studio Twilight Lighting
    const hemiLight = new THREE.HemisphereLight(0xb8a4ff, 0x261d34, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffbe88, 1.85);
    keyLight.position.set(28, 34, 24);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-24, 18, -22);
    scene.add(rimLight);

    // Procedural Textures & Shared Materials
    const tex = createCampusTextures(renderer);
    const brickMat = new THREE.MeshStandardMaterial({
      map: tex.brick,
      color: 0xb96a65,
      roughness: 0.78,
      metalness: 0.06,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xd8cfc4,
      roughness: 0.62,
      metalness: 0.08,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x474258,
      roughness: 0.72,
      metalness: 0.12,
    });
    const slateRoofMat = new THREE.MeshStandardMaterial({
      color: 0x26293e,
      roughness: 0.48,
      metalness: 0.25,
    });
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      roughness: 0.35,
      metalness: 0.65,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.85,
    });
    const warmWindowMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.55,
      roughness: 0.25,
    });
    const cyanGlowMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.1,
      roughness: 0.2,
      metalness: 0.4,
    });
    const amberGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfcd34d,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    });

    // 1. Extended Ground & Campus Quad Courtyard
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(120, 48),
      new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.92 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const plazaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(24, 24.8, 0.26, 40),
      new THREE.MeshStandardMaterial({ map: tex.cobble, roughness: 0.82 })
    );
    plazaBase.position.set(0, 0.13, 2);
    plazaBase.receiveShadow = true;
    scene.add(plazaBase);

    // Front walkway axis
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.28, 22), darkStoneMat);
    walkway.position.set(0, 0.14, 15);
    walkway.receiveShadow = true;
    scene.add(walkway);

    // 2. GRAND BIG COLLEGE BUILDING (Multi-Wing Collegiate Hall + Clock Tower)
    const college = new THREE.Group();
    college.position.set(0, 0, -4.5);
    scene.add(college);

    // Raised stone plinth & grand front stairs
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(27.6, 1.0, 13.6), darkStoneMat);
    plinth.position.set(0, 0.5, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    college.add(plinth);

    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(8.6 - s * 0.4, 0.25, 0.7), stoneMat);
      step.position.set(0, 0.125 + s * 0.25, 8.2 - s * 0.55);
      step.receiveShadow = true;
      college.add(step);
    }

    // Central 3-story brick hall
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(11.6, 9.2, 10.6), brickMat);
    mainHall.position.set(0, 5.6, 0);
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    college.add(mainHall);

    // Stone cornice & main pitched roof
    const mainCornice = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.55, 11.2), stoneMat);
    mainCornice.position.set(0, 10.3, 0);
    college.add(mainCornice);

    const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(8.8, 3.6, 4), slateRoofMat);
    mainRoof.position.set(0, 12.2, 0);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(1.05, 1, 0.95);
    mainRoof.castShadow = true;
    college.add(mainRoof);

    // Front Classical Portico (columns + glowing entrance + triangular pediment)
    const porticoBase = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.45, 2.8), stoneMat);
    porticoBase.position.set(0, 1.2, 6.2);
    college.add(porticoBase);

    for (const cx of [-3.1, -1.85, 1.85, 3.1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 5.4, 12), stoneMat);
      col.position.set(cx, 3.9, 6.9);
      col.castShadow = true;
      college.add(col);
    }

    const porticoEntablature = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.7, 2.9), stoneMat);
    porticoEntablature.position.set(0, 6.85, 6.2);
    college.add(porticoEntablature);

    const pediment = new THREE.Mesh(new THREE.CylinderGeometry(0, 4.4, 1.7, 3), slateRoofMat);
    pediment.rotation.y = Math.PI / 6;
    pediment.rotation.x = Math.PI / 2;
    pediment.scale.set(1.0, 0.35, 1.0);
    pediment.position.set(0, 7.6, 6.3);
    college.add(pediment);

    // Glowing college archway entrance
    const doorGlow = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.8, 0.35), warmWindowMat);
    doorGlow.position.set(0, 3.1, 5.32);
    college.add(doorGlow);

    const entranceLight = new THREE.PointLight(0xfbbf24, 2.8, 12);
    entranceLight.position.set(0, 4.0, 6.6);
    college.add(entranceLight);

    // Left & Right 2.5-story Academic Wings
    for (const side of [-1, 1]) {
      const wx = side * 9.5;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(8.2, 7.4, 9.2), brickMat);
      wing.position.set(wx, 4.7, -0.3);
      wing.castShadow = true;
      wing.receiveShadow = true;
      college.add(wing);

      const wingTrim = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 9.6), stoneMat);
      wingTrim.position.set(wx, 8.5, -0.3);
      college.add(wingTrim);

      const wingRoof = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.6, 8.6), slateRoofMat);
      wingRoof.position.set(wx, 9.5, -0.3);
      wingRoof.castShadow = true;
      college.add(wingRoof);

      // Wing windows (2 floors x 3 bays, front & back)
      for (const floorY of [3.2, 6.1]) {
        for (const bx of [-2.4, 0, 2.4]) {
          const winF = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.65, 0.16), warmWindowMat);
          winF.position.set(wx + bx, floorY, 4.32);
          college.add(winF);

          const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 0.24), stoneMat);
          winFrame.position.set(wx + bx, floorY - 0.88, 4.35);
          college.add(winFrame);

          const winB = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.65, 0.16), warmWindowMat);
          winB.position.set(wx + bx, floorY, -4.92);
          college.add(winB);
        }
      }
    }

    // Main Hall Upper Windows
    for (const floorY of [4.2, 7.8]) {
      for (const bx of [-3.8, -1.6, 1.6, 3.8]) {
        if (floorY < 5 && Math.abs(bx) < 2) continue;
        const mw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.16), warmWindowMat);
        mw.position.set(bx, floorY, 5.32);
        college.add(mw);
      }
    }

    // Central Grand Clock Tower (rising up to y ~ 20!)
    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5.8, 4.4), brickMat);
    towerBase.position.set(0, 13.6, -0.2);
    towerBase.castShadow = true;
    college.add(towerBase);

    const towerCollar = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.55, 4.9), stoneMat);
    towerCollar.position.set(0, 16.5, -0.2);
    college.add(towerCollar);

    const clockTex = createClockFaceTexture();
    const clockMat = new THREE.MeshStandardMaterial({
      map: clockTex,
      emissive: 0xfef08a,
      emissiveMap: clockTex,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const clockOffsets: Array<[number, number, number, number]> = [
      [0, 15.1, 2.04, 0],
      [0, 15.1, -2.44, Math.PI],
      [2.24, 15.1, -0.2, Math.PI / 2],
      [-2.24, 15.1, -0.2, -Math.PI / 2],
    ];
    for (const [cx, cy, cz, ry] of clockOffsets) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), clockMat);
      face.position.set(cx, cy, cz);
      face.rotation.y = ry;
      college.add(face);
    }

    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.8, 4.5, 4), copperMat);
    spire.position.set(0, 19.0, -0.2);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    college.add(spire);

    // 3. DIFFERENT WI-FI TOWERS + ANIMATED SIGNAL WAVES
    const wifiWaves: WifiWavePulse[] = [];
    const spinningParts: Array<{ mesh: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }> = [];

    const addWifiWaveRing = (parent: THREE.Object3D, baseY: number, color: number, maxScale: number, phaseOffset: number) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 28), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = baseY;
      parent.add(ring);
      wifiWaves.push({ ring, mat, baseY, phaseOffset, maxScale });
    };

    // Wi-Fi Tower A: Central Rooftop Router Mast atop the Clock Tower Spire
    const centralMast = new THREE.Group();
    centralMast.position.set(0, 21.0, -0.2);
    college.add(centralMast);

    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 4.2, 8), steelMat);
    mastPole.position.y = 2.1;
    centralMast.add(mastPole);

    const centralOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), cyanGlowMat);
    centralOrb.position.y = 4.35;
    centralMast.add(centralOrb);
    spinningParts.push({ mesh: centralOrb, axis: 'y', speed: 1.8 });

    const centralHoloRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 8, 28), cyanGlowMat);
    centralHoloRing.position.y = 3.5;
    centralMast.add(centralHoloRing);
    spinningParts.push({ mesh: centralHoloRing, axis: 'x', speed: 1.2 });

    addWifiWaveRing(centralMast, 4.3, 0x22d3ee, 4.2, 0);
    addWifiWaveRing(centralMast, 4.3, 0x67e8f9, 4.2, 0.5);

    // Wi-Fi Tower B: West Parabolic Dish Lattice Tower
    const westTower = new THREE.Group();
    westTower.position.set(-16.2, 0, 2.5);
    scene.add(westTower);

    const wtPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 3.2), darkStoneMat);
    wtPlinth.position.y = 0.3;
    westTower.add(wtPlinth);

    const wtCore = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.85, 13.5, 4), steelMat);
    wtCore.position.y = 7.35;
    wtCore.rotation.y = Math.PI / 4;
    wtCore.castShadow = true;
    westTower.add(wtCore);

    // Crossbars & Twin Parabolic Dishes
    for (const y of [4.2, 7.6, 10.8]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(1.8 - y * 0.05, 0.22, 1.8 - y * 0.05), darkStoneMat);
      collar.position.y = y;
      westTower.add(collar);
    }

    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 12.6, 0);
    westTower.add(dishGroup);
    for (const dir of [-1, 1]) {
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
        stoneMat
      );
      dish.position.set(dir * 0.85, 0, 0.4);
      dish.rotation.x = Math.PI / 2;
      dish.rotation.z = -dir * 0.5;
      dishGroup.add(dish);
      const feed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), amberGlowMat);
      feed.position.set(dir * 0.98, 0, 0.88);
      dishGroup.add(feed);
    }
    spinningParts.push({ mesh: dishGroup, axis: 'y', speed: 0.65 });

    const wtBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 8), amberGlowMat);
    wtBeacon.position.y = 14.9;
    westTower.add(wtBeacon);
    addWifiWaveRing(westTower, 15.6, 0xfbbf24, 3.6, 0.2);
    addWifiWaveRing(westTower, 15.6, 0x22d3ee, 3.6, 0.7);

    // Wi-Fi Tower C: East Futuristic Holographic Broadcast Pylon
    const eastTower = new THREE.Group();
    eastTower.position.set(16.2, 0, 2.5);
    scene.add(eastTower);

    const etBase = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 1.0, 6), darkStoneMat);
    etBase.position.y = 0.5;
    eastTower.add(etBase);

    const etSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.72, 13.0, 6), steelMat);
    etSpire.position.y = 7.4;
    etSpire.castShadow = true;
    eastTower.add(etSpire);

    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.TorusGeometry(1.25 - i * 0.18, 0.08, 8, 6), cyanGlowMat);
      fin.rotation.x = Math.PI / 2;
      fin.position.y = 9.2 + i * 1.15;
      eastTower.add(fin);
      spinningParts.push({ mesh: fin, axis: 'z', speed: (i % 2 === 0 ? 1 : -1) * 1.1 });
    }

    const etTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 0), cyanGlowMat);
    etTip.position.y = 14.3;
    eastTower.add(etTip);
    spinningParts.push({ mesh: etTip, axis: 'y', speed: 2.2 });
    addWifiWaveRing(eastTower, 14.3, 0x38bdf8, 3.8, 0.35);
    addWifiWaveRing(eastTower, 14.3, 0xa855f7, 3.8, 0.85);

    // Wi-Fi Tower D: Front Courtyard Fiber Relay Node + Glowing Conduit Tubes
    const quadNode = new THREE.Group();
    quadNode.position.set(0, 0, 10.5);
    scene.add(quadNode);

    const qBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.6, 8), darkStoneMat);
    qBase.position.y = 0.3;
    quadNode.add(qBase);

    const qPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 8), steelMat);
    qPillar.position.y = 2.1;
    quadNode.add(qPillar);

    const qCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), cyanGlowMat);
    qCrystal.position.y = 4.1;
    quadNode.add(qCrystal);
    spinningParts.push({ mesh: qCrystal, axis: 'y', speed: 2.0 });
    addWifiWaveRing(quadNode, 4.1, 0x22d3ee, 2.5, 0.1);

    // Glowing Fiber Cables connecting Quad Node -> Towers & Main Hall
    const cableCurveTargets: Array<[number, number, number]> = [
      [-16.2, 0.45, 2.5],
      [16.2, 0.45, 2.5],
      [0, 1.2, 1.5],
    ];
    for (const [tx, ty, tz] of cableCurveTargets) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.45, 10.5),
        new THREE.Vector3(tx * 0.5, 0.35, (10.5 + tz) * 0.5 + 1.2),
        new THREE.Vector3(tx, ty, tz),
      ]);
      const cableMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.09, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.72 })
      );
      scene.add(cableMesh);
    }

    // Courtyard Trees & Streetlamps for lively campus framing
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b362b, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x294847, roughness: 0.85 });
    const treePositions: Array<[number, number]> = [
      [-19, 13], [-12, 17], [12, 17], [19, 13], [-22, -6], [22, -6],
    ];
    for (const [tx, tz] of treePositions) {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 2.4, 7), trunkMat);
      trunk.position.y = 1.2;
      const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), leafMat);
      crown1.position.y = 3.2;
      const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), leafMat);
      crown2.position.set(0.4, 4.1, -0.2);
      tree.add(trunk, crown1, crown2);
      scene.add(tree);
    }

    for (const lx of [-5.2, 5.2]) {
      for (const lz of [9, 18]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), darkStoneMat);
        post.position.set(lx, 1.8, lz);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), warmWindowMat);
        bulb.position.set(lx, 3.7, lz);
        scene.add(post, bulb);
      }
    }

    // 4. PROWLING CLOUD MONSTERS (4 Distinct Glitch Cloud Monsters)
    const cloudConfigs: Array<{
      scale: number;
      center: THREE.Vector3;
      rx: number;
      rz: number;
      y: number;
      speed: number;
      seed: number;
    }> = [
      // Alpha Cloud Monster circling the front Courtyard & Quad Node
      { scale: 1.25, center: new THREE.Vector3(0, 0, 10.5), rx: 11.5, rz: 6.5, y: 4.5, speed: 0.34, seed: 0 },
      // West Tower Cloud Monster stalking the dish tower
      { scale: 0.92, center: new THREE.Vector3(-15.5, 0, 1.5), rx: 5.5, rz: 5.5, y: 11.2, speed: -0.48, seed: 1 },
      // East Tower Cloud Monster circling the broadcast pylon
      { scale: 0.9, center: new THREE.Vector3(15.5, 0, 1.5), rx: 5.5, rz: 5.5, y: 10.6, speed: 0.44, seed: 2 },
      // Rooftop Cloud Monster lurking around the Clock Spire
      { scale: 0.85, center: new THREE.Vector3(0, 0, -4.5), rx: 9.0, rz: 5.2, y: 15.8, speed: -0.38, seed: 3 },
    ];

    const monsters: CloudMonsterRig[] = cloudConfigs.map((cfg) => {
      const m = buildCloudMonster(cfg.scale, cfg.seed);
      m.orbitCenter.copy(cfg.center);
      m.radiusX = cfg.rx;
      m.radiusZ = cfg.rz;
      m.baseY = cfg.y;
      m.speed = cfg.speed;
      scene.add(m.group);
      return m;
    });

    // Subtle pointer parallax + drag-to-orbit inspection
    let pointerX = 0;
    let pointerY = 0;
    let dragYaw = 0;
    let dragPitch = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      if (isDragging) {
        dragYaw -= (e.clientX - lastX) * 0.005;
        dragPitch = THREE.MathUtils.clamp(dragPitch + (e.clientY - lastY) * 0.004, -0.25, 0.35);
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target !== renderer.domElement) return;
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let frameId = 0;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;

      // Animate Wi-Fi Tower rotating beacons & expanding signal pulse waves
      for (let i = 0; i < spinningParts.length; i++) {
        const sp = spinningParts[i];
        sp.mesh.rotation[sp.axis] += sp.speed * dt;
      }
      for (let i = 0; i < wifiWaves.length; i++) {
        const w = wifiWaves[i];
        const cycle = (elapsed * 0.55 + w.phaseOffset) % 1;
        const sc = 0.6 + cycle * w.maxScale;
        w.ring.scale.setScalar(sc);
        w.ring.position.y = w.baseY + cycle * 1.4;
        w.mat.opacity = (1 - cycle) * 0.85;
      }

      // Animate Cloud Monsters orbiting & glitching
      for (let i = 0; i < monsters.length; i++) {
        const mon = monsters[i];
        const angle = elapsed * mon.speed + mon.phase;
        const nx = mon.orbitCenter.x + Math.cos(angle) * mon.radiusX;
        const nz = mon.orbitCenter.z + Math.sin(angle) * mon.radiusZ;
        const ny = mon.baseY + Math.sin(elapsed * 2.1 + i) * 0.65;
        mon.group.position.set(nx, ny, nz);

        // Face forward along orbit tangent or glance toward campus center
        const lookAngle = Math.atan2(
          -Math.sin(angle) * mon.radiusX * mon.speed,
          Math.cos(angle) * mon.radiusZ * mon.speed
        );
        mon.group.rotation.y = lookAngle;
        mon.eyeRing.rotation.z = -elapsed * 5.2;

        for (let b = 0; b < mon.blocks.length; b++) {
          const blk = mon.blocks[b];
          const base = blk.userData.basePos as THREE.Vector3;
          blk.position.set(
            base.x + Math.sin(elapsed * 11 + b * 2) * 0.06,
            base.y + Math.cos(elapsed * 9 + b) * 0.06,
            base.z + Math.sin(elapsed * 13 + b) * 0.05
          );
        }
        for (let c = 0; c < mon.cables.length; c++) {
          mon.cables[c].rotation.x = Math.sin(elapsed * 4.5 + c + i) * 0.28;
        }
      }

      // Smooth cinematic sweep framing the big college building on the right/center of start screen
      const baseAngle = 0.38 + Math.sin(elapsed * 0.14) * 0.18 + dragYaw + pointerX * 0.08;
      const dist = inspectRef.current ? 31 : 35;
      const height = 11.5 + dragPitch * 14 - pointerY * 1.2;
      _tmpVec.set(
        Math.sin(baseAngle) * dist,
        Math.max(4.5, height),
        Math.cos(baseAngle) * dist + 1.5
      );
      camera.position.lerp(_tmpVec, 1 - Math.exp(-3.5 * dt));

      // Offset lookAt slightly left when UI cards occupy left side, centering building attractively in open viewport
      const lookX = inspectRef.current ? 0 : -4.2;
      camera.lookAt(lookX, 6.2, -1.5);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
      clockTex.dispose();
      tex.grass.dispose();
      tex.cobble.dispose();
      tex.brick.dispose();
      tex.labFloor.dispose();
      tex.woodFloor.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
};
