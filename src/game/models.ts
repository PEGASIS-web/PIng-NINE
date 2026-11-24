import * as THREE from 'three';
import { createCampusTextures } from './textures.ts';
import {
  CAMPUS_BOUNDARY,
  CENTRAL_ROUTER_POS,
  CORRUPTION_ZONES,
  REPEL_STATIONS,
  SECRET_SWITCHES,
  SPIRITS,
} from './worldData.ts';
import type { SpiritDefinition } from './types.ts';

export interface MinaRig {
  group: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  lanternLight: THREE.PointLight;
  lanternCore: THREE.Mesh;
  packetOrb: THREE.Mesh;
}

export interface RouterRig {
  group: THREE.Group;
  conduitPillars: THREE.Mesh[];
  conduitMatList: THREE.MeshStandardMaterial[];
  coreCrystal: THREE.Mesh;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  unlockBeam: THREE.Mesh;
  coreLight: THREE.PointLight;
}

export interface BufferRig {
  group: THREE.Group;
  blocks: THREE.Mesh[];
  eyeRing: THREE.Mesh;
  cables: THREE.Mesh[];
  auraRing: THREE.Mesh;
  light: THREE.PointLight;
}

export interface SpiritVisual {
  def: SpiritDefinition;
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  echoPylons?: THREE.Mesh[];
  echoPylonMats?: THREE.MeshStandardMaterial[];
  trailNodes?: THREE.Mesh[];
}

export interface RepelStationVisual {
  group: THREE.Group;
  crystal: THREE.Mesh;
  crystalMat: THREE.MeshStandardMaterial;
  shockwave: THREE.Mesh;
  shockwaveMat: THREE.MeshBasicMaterial;
  light: THREE.PointLight;
  pulseTimer: number;
}

export interface CampusWorldRefs {
  skyUniforms: {
    uCorruption: { value: number };
    uRestored: { value: number };
    uTime: { value: number };
  };
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  streetLights: THREE.PointLight[];
  interiorLights: THREE.PointLight[];
  corruptedScreens: THREE.MeshStandardMaterial[];
  router: RouterRig;
  spirits: Map<string, SpiritVisual>;
  connectionMeshes: Map<string, { tube: THREE.Mesh; mat: THREE.MeshStandardMaterial; pulse: THREE.Mesh }>;
  packetStations: Map<string, THREE.Group>;
  secretSwitches: Map<string, { group: THREE.Group; ledMat: THREE.MeshStandardMaterial }>;
  repelStations: Map<string, RepelStationVisual>;
  corruptionMeshes: THREE.Mesh[];
  buffer: BufferRig;
  mina: MinaRig;
  tariq: THREE.Group;
}

export function createMinaCharacter(): MinaRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf4c9a8, roughness: 0.65 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x241a21, roughness: 0.55 });
  const mustardMat = new THREE.MeshStandardMaterial({ color: 0xe3a027, roughness: 0.78 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.75 });
  const denimMat = new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.82 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x3b2a26, roughness: 0.7 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x6f5b4b, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a24c, metalness: 0.7, roughness: 0.3 });

  // Contact shadow disc
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.42, depthWrite: false })
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  group.add(shadowDisc);

  // Legs (pivot at hip y=0.72)
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.72, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.36, 4, 8), denimMat);
    thigh.position.y = -0.24;
    thigh.castShadow = true;
    legPivot.add(thigh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.28), bootMat);
    boot.position.set(0, -0.61, 0.04);
    boot.castShadow = true;
    legPivot.add(boot);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  group.add(leftLeg, rightLeg);

  // Torso (inner shirt + mustard cardigan)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.56, 10), shirtMat);
  torso.position.y = 1.02;
  torso.castShadow = true;
  group.add(torso);

  const cardigan = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.27, 0.58, 10, 1, false, 0.3, Math.PI * 1.72), mustardMat);
  cardigan.position.y = 1.01;
  cardigan.rotation.y = Math.PI * 0.14;
  cardigan.castShadow = true;
  group.add(cardigan);

  // Backpack
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.22), packMat);
  backpack.position.set(0, 1.04, -0.22);
  backpack.castShadow = true;
  group.add(backpack);

  const packFlap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.12, 0.24), mustardMat);
  packFlap.position.set(0, 1.22, -0.22);
  group.add(packFlap);

  // Warm Packet floating carrier orb (hidden unless carrying Warm Packet)
  const packetOrb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 1),
    new THREE.MeshStandardMaterial({
      color: 0xff8a65,
      emissive: 0xff6d3a,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    })
  );
  packetOrb.position.set(0, 1.56, -0.25);
  packetOrb.visible = false;
  group.add(packetOrb);

  // Head + short bob haircut
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), skinMat);
  head.position.y = 1.5;
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1520 });
  const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
  lEye.position.set(-0.075, 1.51, 0.185);
  const rEye = lEye.clone();
  rEye.position.x = 0.075;
  group.add(lEye, rEye);

  // Short bob hair (crown + flared sides + back bob)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.228, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hairCrown.position.set(0, 1.53, -0.01);
  hairCrown.rotation.x = -0.15;
  group.add(hairCrown);

  const bobBack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.245, 0.24, 12, 1, false, Math.PI * 0.45, Math.PI * 1.1), hairMat);
  bobBack.position.set(0, 1.41, -0.02);
  group.add(bobBack);

  const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.08), hairMat);
  bangs.position.set(0, 1.61, 0.16);
  bangs.rotation.z = 0.06;
  group.add(bangs);

  // Left arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.27, 1.24, 0);
  const lSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 4, 8), mustardMat);
  lSleeve.position.y = -0.2;
  lSleeve.castShadow = true;
  leftArm.add(lSleeve);
  group.add(leftArm);

  // Right arm holding glowing lantern
  const rightArm = new THREE.Group();
  rightArm.position.set(0.27, 1.24, 0);
  const rSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 4, 8), mustardMat);
  rSleeve.position.set(0, -0.18, 0.08);
  rSleeve.rotation.x = -0.45;
  rSleeve.castShadow = true;
  rightArm.add(rSleeve);

  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(0.02, -0.35, 0.22);
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 8), brassMat);
  lanternCap.position.y = 0.11;
  const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.05, 8), brassMat);
  lanternBase.position.y = -0.1;
  const lanternCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.16, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffe4a1,
      emissive: 0xffb347,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  const lanternLight = new THREE.PointLight(0xffbe5c, 2.2, 13, 1.6);
  lanternGroup.add(lanternCap, lanternBase, lanternCore, lanternLight);
  rightArm.add(lanternGroup);
  group.add(rightArm);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    lanternLight,
    lanternCore,
    packetOrb,
  };
}

export function createTariqNPC(): THREE.Group {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb08c, roughness: 0.65 });
  const curlMat = new THREE.MeshStandardMaterial({ color: 0x1e191d, roughness: 0.85 });
  const tealMat = new THREE.MeshStandardMaterial({ color: 0x1e8f8a, roughness: 0.78 });
  const hoodieMat = new THREE.MeshStandardMaterial({ color: 0xe7e1d5, roughness: 0.78 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x262d3d, roughness: 0.8 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x4b423c, roughness: 0.85 });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.74, 10), pantsMat);
  legs.position.y = 0.37;
  legs.castShadow = true;
  group.add(legs);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.6, 10), hoodieMat);
  torso.position.y = 1.04;
  torso.castShadow = true;
  group.add(torso);

  const cardigan = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.265, 0.61, 10, 1, false, 0.35, Math.PI * 1.68), tealMat);
  cardigan.position.y = 1.04;
  cardigan.rotation.y = Math.PI * 0.16;
  cardigan.castShadow = true;
  group.add(cardigan);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.22), packMat);
  backpack.position.set(0, 1.06, -0.23);
  group.add(backpack);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skinMat);
  head.position.y = 1.54;
  group.add(head);

  // Curly hair clusters
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), curlMat);
    curl.position.set(Math.cos(angle) * 0.14, 1.67 + (i % 2) * 0.04, Math.sin(angle) * 0.13 - 0.02);
    group.add(curl);
  }

  // Holographic Map Tablet in hands
  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.03, 0.28),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
    })
  );
  tablet.position.set(0, 1.08, 0.34);
  tablet.rotation.x = 0.45;
  group.add(tablet);

  return group;
}

export function createCentralRouter(): RouterRig {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x262938, metalness: 0.65, roughness: 0.32 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.22 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 0.6, 8), baseMat);
  plinth.position.y = 0.3;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 4.2, 8), baseMat);
  body.position.y = 2.6;
  body.castShadow = true;
  group.add(body);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.4, 3.6, 8), trimMat);
  spire.position.y = 6.3;
  spire.castShadow = true;
  group.add(spire);

  const conduitPillars: THREE.Mesh[] = [];
  const conduitMatList: THREE.MeshStandardMaterial[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.15,
      roughness: 0.3,
      metalness: 0.4,
    });
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.4, 0.24), mat);
    pillar.position.set(Math.cos(angle) * 1.42, 2.4, Math.sin(angle) * 1.42);
    pillar.rotation.y = -angle;
    group.add(pillar);
    conduitPillars.push(pillar);
    conduitMatList.push(mat);
  }

  const coreCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.75, 0),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.15,
      metalness: 0.2,
    })
  );
  coreCrystal.position.y = 5.1;
  group.add(coreCrystal);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.08, 10, 36),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      metalness: 0.7,
      roughness: 0.2,
    })
  );
  outerRing.position.y = 5.1;
  group.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.06, 8, 28),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.2,
    })
  );
  innerRing.position.y = 5.1;
  group.add(innerRing);

  // Skyward unlock beam (visible once unlocked or restored)
  const unlockBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.9, 46, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  unlockBeam.position.y = 26;
  group.add(unlockBeam);

  const coreLight = new THREE.PointLight(0x38bdf8, 2.0, 22, 1.4);
  coreLight.position.y = 5.2;
  group.add(coreLight);

  return {
    group,
    conduitPillars,
    conduitMatList,
    coreCrystal,
    outerRing,
    innerRing,
    unlockBeam,
    coreLight,
  };
}

export function createSpiritVisual(def: SpiritDefinition): SpiritVisual {
  const group = new THREE.Group();
  group.position.set(def.position.x, def.position.y, def.position.z);

  const colorMap = {
    beacon: 0xfbbf24,
    echo: 0xa78bfa,
    relay: 0xfb7185,
  };
  const baseColor = colorMap[def.type];

  // Pedestal base
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.85, 0.32, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2738, metalness: 0.5, roughness: 0.4 })
  );
  ped.position.y = 0.16;
  ped.receiveShadow = true;
  group.add(ped);

  let coreGeo: THREE.BufferGeometry;
  if (def.type === 'beacon') {
    coreGeo = new THREE.OctahedronGeometry(0.55, 0);
  } else if (def.type === 'echo') {
    coreGeo = new THREE.DodecahedronGeometry(0.5, 0);
  } else {
    coreGeo = new THREE.TorusKnotGeometry(0.36, 0.11, 48, 8);
  }

  const core = new THREE.Mesh(
    coreGeo,
    new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.3,
    })
  );
  core.position.y = 1.5;
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.045, 8, 28),
    new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    })
  );
  ring.position.y = 1.5;
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const light = new THREE.PointLight(baseColor, 2.2, 11, 1.5);
  light.position.y = 1.7;
  group.add(light);

  const visual: SpiritVisual = { def, group, core, ring, light };

  // Echo 3 chime pylons around the spirit
  if (def.type === 'echo') {
    const pylonColors = [0x2dd4bf, 0xc084fc, 0xfbbf24];
    const echoPylons: THREE.Mesh[] = [];
    const echoPylonMats: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const a = ((i - 1) * Math.PI) / 3.2;
      const mat = new THREE.MeshStandardMaterial({
        color: pylonColors[i],
        emissive: pylonColors[i],
        emissiveIntensity: 0.35,
        roughness: 0.3,
      });
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.4, 6), mat);
      pylon.position.set(Math.sin(a) * 1.65, 0.7, Math.cos(a) * 1.65);
      group.add(pylon);
      echoPylons.push(pylon);
      echoPylonMats.push(mat);
    }
    visual.echoPylons = echoPylons;
    visual.echoPylonMats = echoPylonMats;
  }

  return visual;
}

export function createBufferEntity(): BufferRig {
  const group = new THREE.Group();
  const blocks: THREE.Mesh[] = [];
  const greyMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    emissive: 0x1f2937,
    emissiveIntensity: 0.6,
    roughness: 0.6,
    metalness: 0.2,
  });

  // Pixel cloud body (12 voxel blocks)
  const offsets = [
    [0, 1.8, 0, 1.4, 1.3, 1.2],
    [-0.7, 2.1, 0.2, 0.7, 0.8, 0.8],
    [0.75, 2.0, -0.15, 0.75, 0.85, 0.8],
    [0, 2.6, 0.1, 1.0, 0.6, 0.8],
    [-0.45, 1.2, 0.35, 0.6, 0.6, 0.6],
    [0.5, 1.25, -0.3, 0.65, 0.55, 0.6],
    [-0.9, 1.5, -0.2, 0.45, 0.5, 0.45],
    [0.95, 1.55, 0.25, 0.45, 0.55, 0.45],
    [0.2, 2.85, -0.25, 0.5, 0.45, 0.45],
    [-0.25, 2.9, 0.25, 0.45, 0.4, 0.45],
    [0, 0.85, 0, 0.85, 0.5, 0.8],
    [0.35, 1.9, 0.6, 0.35, 0.35, 0.3],
  ];

  for (const [x, y, z, sx, sy, sz] of offsets) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), greyMat.clone());
    block.position.set(x, y, z);
    block.userData.basePos = new THREE.Vector3(x, y, z);
    block.castShadow = true;
    group.add(block);
    blocks.push(block);
  }

  // Grumpy pixel eyebrows
  const browMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.15), browMat);
  browL.position.set(-0.28, 2.25, 0.68);
  browL.rotation.z = -0.28;
  const browR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.15), browMat);
  browR.position.set(0.28, 2.25, 0.68);
  browR.rotation.z = 0.28;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), browMat);
  mouth.position.set(0, 1.52, 0.68);
  group.add(browL, browR, mouth);

  // Loading-ring eye (glowing broken crimson torus)
  const eyeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.055, 8, 20, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({ color: 0xff2d55 })
  );
  eyeRing.position.set(0.26, 1.92, 0.72);
  group.add(eyeRing);

  const otherEye = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xfef2f2 })
  );
  otherEye.position.set(-0.28, 1.92, 0.71);
  group.add(otherEye);

  // Dangling broken cables
  const cables: THREE.Mesh[] = [];
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
  for (let i = 0; i < 5; i++) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 1.2, 6), cableMat);
    const a = (i / 5) * Math.PI * 2;
    cable.position.set(Math.cos(a) * 0.55, 0.65, Math.sin(a) * 0.55);
    group.add(cable);
    cables.push(cable);
  }

  // Static ground aura
  const auraRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.2, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff2d55,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.05;
  group.add(auraRing);

  const light = new THREE.PointLight(0xff2d55, 3.2, 16, 1.5);
  light.position.set(0, 2.2, 0.8);
  group.add(light);

  return { group, blocks, eyeRing, cables, auraRing, light };
}

export function buildCampusWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): CampusWorldRefs {
  const tex = createCampusTextures(renderer);

  // 1. Pastel Dusk Sky Dome (ShaderMaterial interpolating dusk -> 9:00 blackout -> restored dawn)
  const skyUniforms = {
    uCorruption: { value: 0 },
    uRestored: { value: 0 },
    uTime: { value: 0 },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(170, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform float uCorruption;
        uniform float uRestored;
        uniform float uTime;
        void main() {
          float h = clamp((vWorldPos.y + 10.0) / 140.0, 0.0, 1.0);
          vec3 duskHorizon = vec3(0.95, 0.64, 0.58);
          vec3 duskMid = vec3(0.47, 0.34, 0.58);
          vec3 duskTop = vec3(0.11, 0.12, 0.26);
          vec3 dusk = mix(duskHorizon, duskMid, smoothstep(0.0, 0.38, h));
          dusk = mix(dusk, duskTop, smoothstep(0.32, 0.9, h));

          vec3 darkHorizon = vec3(0.22, 0.05, 0.14);
          vec3 darkTop = vec3(0.02, 0.02, 0.05);
          vec3 darkSky = mix(darkHorizon, darkTop, smoothstep(0.0, 0.75, h));

          vec3 dawnHorizon = vec3(0.68, 0.93, 0.96);
          vec3 dawnTop = vec3(0.24, 0.45, 0.78);
          vec3 dawn = mix(dawnHorizon, dawnTop, smoothstep(0.0, 0.85, h));

          vec3 col = mix(dusk, darkSky, clamp(uCorruption, 0.0, 1.0));
          col = mix(col, dawn, clamp(uRestored, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  scene.add(skyDome);

  // 2. Lighting Rig (warm dusk key + cool twilight hemisphere + rim)
  const hemiLight = new THREE.HemisphereLight(0xb8a2e6, 0x2d283e, 0.9);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffb58a, 1.45);
  keyLight.position.set(28, 38, 32);
  keyLight.castShadow = renderer.shadowMap.enabled;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -52;
  keyLight.shadow.camera.right = 52;
  keyLight.shadow.camera.top = 52;
  keyLight.shadow.camera.bottom = -52;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 130;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.03;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x67e8f9, 0.55);
  rimLight.position.set(-34, 22, -32);
  scene.add(rimLight);

  // 3. Ground Plane extending past perimeter
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.92, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const stoneMat = new THREE.MeshStandardMaterial({ map: tex.cobble, roughness: 0.8, metalness: 0.05 });
  const brickMat = new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.85, metalness: 0.05 });
  const trimStoneMat = new THREE.MeshStandardMaterial({ color: 0x6f6c7d, roughness: 0.72 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, metalness: 0.75, roughness: 0.28 });

  // Central Router Plaza
  const routerPlazaOuter = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.8, 0.18, 8), stoneMat);
  routerPlazaOuter.position.y = 0.09;
  routerPlazaOuter.receiveShadow = true;
  const routerPlazaInner = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.7, 0.17, 8), trimStoneMat);
  routerPlazaInner.position.y = 0.265;
  routerPlazaInner.receiveShadow = true;
  scene.add(routerPlazaOuter, routerPlazaInner);

  // Connecting Cobble Pathways
  const makePath = (x: number, z: number, w: number, d: number, rotY = 0) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), stoneMat);
    p.position.set(x, 0.04, z);
    p.rotation.y = rotY;
    p.receiveShadow = true;
    scene.add(p);
  };
  makePath(0, 14, 5.2, 22); // Router -> Quad
  makePath(0, -15, 5.2, 24); // Router -> Canteen
  makePath(-17, -8, 18, 4.8); // Towards Library
  makePath(-9, -4, 12, 4.2, -0.4);
  makePath(17, -8, 18, 4.8); // Towards Robotics Lab
  makePath(9, -4, 12, 4.2, 0.4);
  makePath(-13, 13, 18, 3.6, -Math.PI / 4); // Cloister trail
  makePath(13, 13, 18, 3.6, Math.PI / 4); // Observatory trail

  // --- ZONE 1: MAIN QUAD FOUNTAIN (0, 26.5) ---
  const quadPlaza = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.8, 0.15, 24), stoneMat);
  quadPlaza.position.set(0, 0.075, 26.5);
  quadPlaza.receiveShadow = true;
  scene.add(quadPlaza);

  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(0, 0.15, 26.5);
  const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.75, 16), trimStoneMat);
  basinWall.position.y = 0.375;
  basinWall.castShadow = true;
  basinWall.receiveShadow = true;
  const waterDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 2.75, 0.1, 16),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.65,
      roughness: 0.1,
      metalness: 0.2,
    })
  );
  waterDisc.position.y = 0.62;
  const fountainSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 2.2, 12), trimStoneMat);
  fountainSpire.position.y = 1.1;
  const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.5, 0.45, 12), trimStoneMat);
  upperBowl.position.y = 1.85;
  fountainGroup.add(basinWall, waterDisc, fountainSpire, upperBowl);
  scene.add(fountainGroup);

  // Quad benches
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.75), new THREE.MeshStandardMaterial({ color: 0x6b4c38, roughness: 0.8 }));
    bench.position.set(Math.cos(a) * 6.5, 0.35, 26.5 + Math.sin(a) * 6.5);
    bench.rotation.y = -a + Math.PI / 2;
    bench.castShadow = true;
    scene.add(bench);
  }

  // --- ZONE 2: QUIET STACKS LIBRARY (-41..-24, z: -17..1) ---
  const libFloor = new THREE.Mesh(
    new THREE.BoxGeometry(17.5, 0.25, 18.5),
    new THREE.MeshStandardMaterial({ map: tex.woodFloor, roughness: 0.72 })
  );
  libFloor.position.set(-32.5, 0.125, -8);
  libFloor.receiveShadow = true;
  scene.add(libFloor);

  const addWall = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  };
  // Library walls (doorway gap z: -10.5..-5.5 on East side)
  addWall(-40.8, 3.6, -8, 1.2, 7.2, 18.6, brickMat);
  addWall(-32.5, 3.6, -16.8, 17.5, 7.2, 1.2, brickMat);
  addWall(-32.5, 3.6, 0.8, 17.5, 7.2, 1.2, brickMat);
  addWall(-24.6, 3.6, -13.9, 1.2, 7.2, 6.6, brickMat);
  addWall(-24.6, 3.6, -2.1, 1.2, 7.2, 6.6, brickMat);
  addWall(-24.6, 5.7, -8, 1.2, 3.0, 5.4, brickMat); // Header over doorway
  addWall(-32.5, 7.35, -8, 18.2, 0.45, 19.2, darkMetalMat); // Roof

  // Library interior shelves & reading lamp
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5c3c28, roughness: 0.8 });
  addWall(-36, 1.75, -13.4, 3.0, 3.0, 1.3, shelfMat);
  addWall(-36, 1.75, -2.6, 3.0, 3.0, 1.3, shelfMat);
  addWall(-29.5, 0.7, -13, 2.8, 0.8, 1.6, shelfMat);

  // --- ZONE 3: ROBOTICS LAB B (24..41, z: -17..1) ---
  const labFloor = new THREE.Mesh(
    new THREE.BoxGeometry(17.5, 0.25, 18.5),
    new THREE.MeshStandardMaterial({ map: tex.labFloor, roughness: 0.45, metalness: 0.25 })
  );
  labFloor.position.set(32.5, 0.125, -8);
  labFloor.receiveShadow = true;
  scene.add(labFloor);

  const labWallMat = new THREE.MeshStandardMaterial({ color: 0x2a3342, roughness: 0.5, metalness: 0.35 });
  addWall(40.8, 3.6, -8, 1.2, 7.2, 18.6, brickMat);
  addWall(32.5, 3.6, -16.8, 17.5, 7.2, 1.2, labWallMat);
  addWall(32.5, 3.6, 0.8, 17.5, 7.2, 1.2, labWallMat);
  addWall(24.6, 3.6, -13.9, 1.2, 7.2, 6.6, labWallMat);
  addWall(24.6, 3.6, -2.1, 1.2, 7.2, 6.6, labWallMat);
  addWall(24.6, 5.7, -8, 1.2, 3.0, 5.4, darkMetalMat);
  addWall(32.5, 7.35, -8, 18.2, 0.45, 19.2, darkMetalMat);

  // Robotics workbenches & robotic arm
  addWall(30.5, 0.8, -13.5, 3.0, 1.1, 1.6, darkMetalMat);
  addWall(37.0, 0.8, -3.0, 3.0, 1.1, 1.6, darkMetalMat);
  const robotArm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 }));
  robotArm.position.set(30.5, 2.0, -13.5);
  robotArm.rotation.z = 0.35;
  scene.add(robotArm);

  // Corrupted flickering CRT screens inside Library & Lab
  const corruptedScreens: THREE.MeshStandardMaterial[] = [];
  const screenPositions = [
    [-29.5, 1.5, -13.0],
    [30.5, 1.75, -13.5],
    [37.0, 1.75, -3.0],
  ];
  for (const [sx, sy, sz] of screenPositions) {
    const sMat = new THREE.MeshStandardMaterial({
      color: 0xff2d55,
      emissive: 0xff2d55,
      emissiveIntensity: 1.3,
    });
    corruptedScreens.push(sMat);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.1), sMat);
    mon.position.set(sx, sy, sz);
    scene.add(mon);
  }

  // --- ZONE 4: CANTEEN TERRACE (0, -34) ---
  const terraceDeck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.85, 13), stoneMat);
  terraceDeck.position.set(0, 0.425, -34.5);
  terraceDeck.receiveShadow = true;
  scene.add(terraceDeck);
  // Terrace steps
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.22, 0.7), trimStoneMat);
    step.position.set(0, 0.11 + i * 0.21, -25.8 - i * 0.65);
    step.receiveShadow = true;
    scene.add(step);
  }
  addWall(0, 2.8, -41.0, 15, 4.2, 2.8, brickMat); // Kiosk
  addWall(-8.9, 2.6, -29.9, 0.9, 3.8, 0.9, brickMat);
  addWall(8.9, 2.6, -29.9, 0.9, 3.8, 0.9, brickMat);
  addWall(0, 4.7, -34.5, 19.4, 0.25, 12.2, new THREE.MeshStandardMaterial({ color: 0x3b2f4a, roughness: 0.7 }));

  // Café tables
  for (const tx of [-5.2, 5.2]) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xf4a261, roughness: 0.5 }));
    table.position.set(tx, 1.55, -33.5);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.7, 8), darkMetalMat);
    leg.position.set(tx, 1.2, -33.5);
    scene.add(table, leg);
  }

  // --- HIDDEN AREA 1: SUNKEN CLOISTER VAULT (-30, 28) ---
  const cloisterFloor = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.3, 14.5), stoneMat);
  cloisterFloor.position.set(-30, -0.75, 28.5);
  cloisterFloor.receiveShadow = true;
  scene.add(cloisterFloor);
  addWall(-36.8, 1.6, 28.5, 1.2, 5.2, 15.2, brickMat);
  addWall(-30, 1.6, 35.8, 14.8, 5.2, 1.2, brickMat);
  addWall(-32.2, 1.6, 21.6, 10.4, 5.2, 1.2, brickMat);
  addWall(-23.2, 1.6, 31.2, 1.2, 5.2, 10.0, brickMat);
  const cloisterRamp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 4.2), stoneMat);
  cloisterRamp.position.set(-23.8, -0.32, 23.5);
  cloisterRamp.rotation.z = 0.13;
  scene.add(cloisterRamp);

  // --- HIDDEN AREA 2: OBSERVATORY ROOF DECK (30, 28) ---
  const obsDeck = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.6, 13.0), trimStoneMat);
  obsDeck.position.set(31.2, 1.3, 28.8);
  obsDeck.castShadow = true;
  obsDeck.receiveShadow = true;
  scene.add(obsDeck);
  const obsRamp = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 4.8), stoneMat);
  obsRamp.position.set(22.8, 1.28, 27.0);
  obsRamp.rotation.z = 0.38;
  obsRamp.receiveShadow = true;
  scene.add(obsRamp);
  // Observatory telescope dish
  const dishPed = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.6, 8), darkMetalMat);
  dishPed.position.set(33.5, 3.4, 31.5);
  const dish = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.55, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide }));
  dish.position.set(33.5, 4.3, 31.5);
  dish.rotation.x = Math.PI * 0.72;
  scene.add(dishPed, dish);

  // --- ADDITIONAL CAMPUS BUILDING SETS FILLING EMPTY QUADRANTS ---
  const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x262536, roughness: 0.75, metalness: 0.15 });
  const warmWinMat = new THREE.MeshStandardMaterial({ color: 0xffd89c, emissive: 0xffa94d, emissiveIntensity: 0.85, roughness: 0.25 });
  const cyanWinMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0284c7, emissiveIntensity: 0.75, roughness: 0.2 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x284b3e, roughness: 0.9 });

  // 1. North-West Alder Lecture Hall (-29, -33)
  addWall(-29, 4.2, -33, 14.5, 8.4, 11.5, brickMat);
  const alderRoof = new THREE.Mesh(new THREE.ConeGeometry(10.8, 3.6, 4), slateRoofMat);
  alderRoof.position.set(-29, 10.2, -33);
  alderRoof.rotation.y = Math.PI / 4;
  alderRoof.castShadow = true;
  scene.add(alderRoof);
  // Illuminated arched windows & front portico
  for (const wx of [-33.5, -29, -24.5]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.2), warmWinMat);
    win.position.set(wx, 4.6, -27.2);
    scene.add(win);
  }
  addWall(-29, 2.2, -26.4, 5.4, 0.4, 2.0, trimStoneMat);
  addWall(-31.1, 1.1, -25.8, 0.45, 2.2, 0.45, trimStoneMat);
  addWall(-26.9, 1.1, -25.8, 0.45, 2.2, 0.45, trimStoneMat);

  // 2. North-East Turing Engineering Annex (29, -33)
  addWall(29, 4.5, -33, 14.5, 9.0, 11.5, labWallMat);
  addWall(29, 9.2, -33, 15.1, 0.45, 12.1, darkMetalMat);
  // Rooftop HVAC units & vertical neon conduit strips
  addWall(26.5, 10.1, -33, 3.2, 1.4, 2.6, trimStoneMat);
  addWall(31.8, 10.0, -34, 2.4, 1.2, 2.2, trimStoneMat);
  for (const cx of [24.2, 29.0, 33.8]) {
    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.2, 0.2), cyanWinMat);
    winStrip.position.set(cx, 4.8, -27.2);
    scene.add(winStrip);
  }

  // 3. West & East Quad Brick Colonnades (-16.1, 22) & (16.1, 22)
  for (const sideX of [-16.1, 16.1]) {
    addWall(sideX, 2.1, 17.9, 1.2, 4.2, 1.2, brickMat);
    addWall(sideX, 2.1, 26.1, 1.2, 4.2, 1.2, brickMat);
    addWall(sideX, 4.35, 22.0, 2.6, 0.5, 11.2, slateRoofMat);
    const colBench = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.48, 3.6), new THREE.MeshStandardMaterial({ color: 0x6b4c38, roughness: 0.8 }));
    colBench.position.set(sideX, 0.3, 22.0);
    scene.add(colBench);
  }

  // 4. South Campus Gatehouse Twin Brick Towers (0, 43.2)
  addWall(-5.8, 3.8, 43.2, 3.0, 7.6, 3.0, brickMat);
  addWall(5.8, 3.8, 43.2, 3.0, 7.6, 3.0, brickMat);
  const capL = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.2, 4), slateRoofMat);
  capL.position.set(-5.8, 8.7, 43.2);
  capL.rotation.y = Math.PI / 4;
  const capR = capL.clone();
  capR.position.x = 5.8;
  addWall(0, 6.4, 43.2, 9.6, 0.7, 0.9, darkMetalMat); // Gatehouse Arch Beam
  scene.add(capL, capR);

  // 5. Mid-Campus Courtyard Planters, Hedges & Directory Kiosks
  for (const [px, pz] of [[-14.5, -18.1], [14.5, -18.1]]) {
    addWall(px, 0.45, pz, 3.2, 0.9, 3.2, brickMat);
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.6), hedgeMat);
    hedge.position.set(px, 1.1, pz);
    hedge.castShadow = true;
    scene.add(hedge);
  }
  for (const [kx, kz] of [[-13.1, 8.2], [13.1, 8.2]]) {
    addWall(kx, 1.25, kz, 1.9, 2.5, 0.7, darkMetalMat);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.12), cyanWinMat);
    screen.position.set(kx, 1.45, kz + 0.36);
    scene.add(screen);
  }

  // Courtyard decorative trees filling inner grass lawns
  const innerTreeCoords: Array<[number, number, number]> = [
    [-19, -24, 1.1],
    [19, -24, 1.05],
    [-22, 11, 1.15],
    [22, 11, 1.1],
    [-14, 34, 1.2],
    [14, 34, 1.15],
    [-38, -22, 1.0],
    [38, -22, 1.05],
  ];
  for (const [tx, tz, sc] of innerTreeCoords) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc, 0.34 * sc, 2.6 * sc, 7), new THREE.MeshStandardMaterial({ color: 0x3b2a26, roughness: 0.9 }));
    trunk.position.set(tx, 1.3 * sc, tz);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.65 * sc, 3.8 * sc, 7), hedgeMat);
    crown.position.set(tx, 3.4 * sc, tz);
    crown.castShadow = true;
    scene.add(trunk, crown);
  }

  // --- STREETLAMPS & BUILDING INTERIOR LIGHTS ---
  const streetLights: THREE.PointLight[] = [];
  const interiorLights: THREE.PointLight[] = [];
  const lampCoords: Array<[number, number]> = [
    [-4.5, 12],
    [4.5, 12],
    [-4.5, -14],
    [4.5, -14],
    [-16, -4],
    [16, -4],
    [-8.5, 23],
    [8.5, 23],
  ];
  for (const [lx, lz] of lampCoords) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.8, 8), darkMetalMat);
    pole.position.set(lx, 1.9, lz);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd584, emissive: 0xffb347, emissiveIntensity: 1.5 })
    );
    bulb.position.set(lx, 3.9, lz);
    const pl = new THREE.PointLight(0xffbe66, 1.8, 15, 1.5);
    pl.position.set(lx, 3.7, lz);
    scene.add(pole, bulb, pl);
    streetLights.push(pl);
  }

  // Interior moody cold lights
  const libLight = new THREE.PointLight(0x7c8cff, 1.9, 20, 1.4);
  libLight.position.set(-32.5, 4.8, -8);
  const labLight = new THREE.PointLight(0x34d399, 1.9, 20, 1.4);
  labLight.position.set(32.5, 4.8, -8);
  const cloisterLight = new THREE.PointLight(0xf59e0b, 1.5, 14, 1.4);
  cloisterLight.position.set(-30, 2.5, 28);
  scene.add(libLight, labLight, cloisterLight);
  interiorLights.push(libLight, labLight, cloisterLight);

  // --- NATURAL PERIMETER: INSTANCED TREES & IRON FENCE ---
  const treeCount = 64;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.24, 0.36, 2.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x3b2a26, roughness: 0.9 }),
    treeCount
  );
  const crownInst = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.75, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x2b4942, roughness: 0.85 }),
    treeCount
  );
  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.03;
    const rad = CAMPUS_BOUNDARY + 3.5 + (i % 4) * 3.8;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    const sc = 0.85 + (i % 5) * 0.14;
    dummy.position.set(tx, 1.4 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = i * 0.7;
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 3.6 * sc, tz);
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);

    cColor.setHSL(0.42 + (i % 4) * 0.03, 0.3, 0.22 + (i % 3) * 0.04);
    crownInst.setColorAt(i, cColor);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst, crownInst);

  // --- CENTRAL ROUTER, SPIRITS, CONNECTION LINES, PACKET STATIONS, SWITCHES, CORRUPTION ---
  const router = createCentralRouter();
  router.group.position.set(CENTRAL_ROUTER_POS.x, CENTRAL_ROUTER_POS.y, CENTRAL_ROUTER_POS.z);
  scene.add(router.group);

  const spirits = new Map<string, SpiritVisual>();
  const connectionMeshes = new Map<string, { tube: THREE.Mesh; mat: THREE.MeshStandardMaterial; pulse: THREE.Mesh }>();
  const packetStations = new Map<string, THREE.Group>();

  for (const sDef of SPIRITS) {
    const vis = createSpiritVisual(sDef);
    scene.add(vis.group);
    spirits.set(sDef.id, vis);

    // Beacon trail waypoints
    if (sDef.type === 'beacon' && sDef.beaconTrail) {
      const nodes: THREE.Mesh[] = [];
      for (const wp of sDef.beaconTrail) {
        const node = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.38, 0),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.4,
            transparent: true,
            opacity: 0.85,
          })
        );
        node.position.set(wp.x, wp.y + 0.95, wp.z);
        node.visible = false;
        scene.add(node);
        nodes.push(node);
      }
      vis.trailNodes = nodes;
    }

    // Connection Line along campus walkways
    const curvePts = sDef.linePath.map((p) => new THREE.Vector3(p.x, 0.28, p.z));
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.14, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.4,
      roughness: 0.25,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    );
    pulse.visible = false;
    scene.add(pulse);
    connectionMeshes.set(sDef.id, { tube, mat: tubeMat, pulse });

    // Relay Warm Packet Station
    if (sDef.type === 'relay' && sDef.packetStation) {
      const st = new THREE.Group();
      st.position.set(sDef.packetStation.x, sDef.packetStation.y, sDef.packetStation.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.0, 8), darkMetalMat);
      base.position.y = 0.5;
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 1),
        new THREE.MeshStandardMaterial({ color: 0xff8a65, emissive: 0xff5722, emissiveIntensity: 1.8 })
      );
      orb.position.y = 1.45;
      const pLight = new THREE.PointLight(0xff7043, 1.5, 8);
      pLight.position.y = 1.6;
      st.add(base, orb, pLight);
      scene.add(st);
      packetStations.set(sDef.id, st);
    }
  }

  // Hidden Secret Switches
  const secretSwitches = new Map<string, { group: THREE.Group; ledMat: THREE.MeshStandardMaterial }>();
  for (const sw of SECRET_SWITCHES) {
    const sg = new THREE.Group();
    sg.position.set(sw.position.x, sw.position.y, sw.position.z);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.35, 0.45), darkMetalMat);
    box.position.y = 0.68;
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
    });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), ledMat);
    led.position.set(0, 1.08, 0.24);
    sg.add(box, led);
    scene.add(sg);
    secretSwitches.set(sw.id, { group: sg, ledMat });
  }

  // Buffer-Repel Signal Stations (scare The Buffer away with [E])
  const repelStations = new Map<string, RepelStationVisual>();
  for (const rs of REPEL_STATIONS) {
    const rg = new THREE.Group();
    rg.position.set(rs.position.x, rs.position.y, rs.position.z);

    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.0, 8), darkMetalMat);
    ped.position.y = 0.5;
    ped.castShadow = true;

    const ringBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9 })
    );
    ringBase.rotation.x = Math.PI / 2;
    ringBase.position.y = 1.02;

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), crystalMat);
    crystal.position.y = 1.75;

    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shockwave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.35, 32), shockwaveMat);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.14;
    shockwave.visible = false;

    const light = new THREE.PointLight(0x38bdf8, 1.8, 10, 1.4);
    light.position.y = 1.85;

    rg.add(ped, ringBase, crystal, shockwave, light);
    scene.add(rg);
    repelStations.set(rs.id, {
      group: rg,
      crystal,
      crystalMat,
      shockwave,
      shockwaveMat,
      light,
      pulseTimer: 0,
    });
  }

  // Corrupted Floor Zones
  const corruptionMeshes: THREE.Mesh[] = [];
  for (const cz of CORRUPTION_ZONES) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(cz.radius, 24),
      new THREE.MeshBasicMaterial({
        color: 0xd91b5c,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(cz.x, 0.08, cz.z);
    scene.add(disc);
    corruptionMeshes.push(disc);
  }

  // Characters & The Buffer
  const mina = createMinaCharacter();
  mina.group.position.set(0, 0.35, 9.5);
  scene.add(mina.group);

  const tariq = createTariqNPC();
  tariq.position.set(-3.2, 0.35, 3.2);
  tariq.rotation.y = 0.65;
  scene.add(tariq);

  const buffer = createBufferEntity();
  buffer.group.position.set(-22, 0, -24);
  scene.add(buffer.group);

  return {
    skyUniforms,
    hemiLight,
    keyLight,
    rimLight,
    streetLights,
    interiorLights,
    corruptedScreens,
    router,
    spirits,
    connectionMeshes,
    packetStations,
    secretSwitches,
    repelStations,
    corruptionMeshes,
    buffer,
    mina,
    tariq,
  };
}
