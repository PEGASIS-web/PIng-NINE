import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio.ts';
import { buildCampusWorld, type CampusWorldRefs } from './models.ts';
import {
  BLACKOUT_GRACE_SECONDS,
  BUFFER_SCARE_DURATION_MS,
  CAMPUS_BOUNDARY,
  CENTRAL_ROUTER_POS,
  CORRUPTION_ZONES,
  GAME_DURATION_SECONDS,
  MINA_SPAWN_POS,
  REPEL_STATIONS,
  SECRET_SWITCHES,
  SPIRITS,
  STATION_COOLDOWN_MS,
  WORLD_COLLIDERS,
  calculateConnectionRating,
  distanceToActiveConnectionLines,
  getGroundHeightAt,
  getZoneAt,
  isApproachingBuilding,
  isBlockedByActiveLines,
  isInsideBuilding,
} from './worldData.ts';
import type {
  GameMode,
  GameSnapshot,
  PlayerRole,
  RadioMessage,
  SpiritDefinition,
} from './types.ts';

export interface InteractPrompt {
  label: string;
  key: string;
  action: () => void;
}

export interface EngineUIState {
  prompt: InteractPrompt | null;
  activeBeaconId: string | null;
  activeEchoSpirit: SpiritDefinition | null;
  bufferProximity: number; // 0..1
  inCorruption: boolean;
}

export interface EngineCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onUIUpdate: (ui: EngineUIState) => void;
  onRadio: (msg: RadioMessage) => void;
  onOpenEchoPuzzle: (spirit: SpiritDefinition) => void;
  onOpenRouterPuzzle: () => void;
  onOpenMapToggle: () => void;
  onPauseToggle: () => void;
  onSendAction: (payload: Record<string, unknown>) => void;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _skyDusk = new THREE.Color(0x4b3b63);
const _skyBlackout = new THREE.Color(0x0b0712);
const _skyRestored = new THREE.Color(0x6bb7d8);
const _hemiOutdoor = new THREE.Color(0xc4b5fd);
const _hemiIndoor = new THREE.Color(0x475589);
const _hemiRestored = new THREE.Color(0xdbeafe);

const BUFFER_PATROL = [
  { x: -16, z: -18 },
  { x: 18, z: -18 },
  { x: 20, z: 16 },
  { x: -18, z: 18 },
  { x: 0, z: -24 },
];

export class PingNineEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: CampusWorldRefs;
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private paused = false;

  // Game State
  private snapshot: GameSnapshot;
  private role: PlayerRole = 'runner';
  private activeBeaconId: string | null = null;
  private activeEchoId: string | null = null;
  private echoFlashIndex = -1;
  private linePulseProgress = new Map<string, number>();

  // Dynamic 3D markers for Guide Pings & Safe Routes
  private pingGroup = new THREE.Group();
  private routeGroup = new THREE.Group();
  private lastPingSig = '';
  private lastRouteSig = '';

  // Input & Physics
  private keys: Record<string, boolean> = {};
  private camYaw = 0;
  private camPitch = 0.28;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private velY = 0;
  private grounded = true;
  private walkCycle = 0;
  private stepTimer = 0;
  private currentSpeed = 0;
  private bufferTargetIdx = 0;
  private lastClockMs = performance.now();
  private lastNetSyncMs = 0;
  private lastUiSyncMs = 0;
  private cinematicTimer = 0;
  private currentPrompt: InteractPrompt | null = null;

  constructor(
    container: HTMLElement,
    initialSnapshot: GameSnapshot,
    role: PlayerRole,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.snapshot = structuredClone(initialSnapshot);
    this.role = role;
    this.callbacks = callbacks;

    this.initRenderer();
    this.initScene();
    this.bindInputs();
    this.startLoop();
  }

  private initRenderer(): void {
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x3a2e52, 0.014);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.15, 260);
    this.camera.position.set(0, 3.2, 15);

    this.world = buildCampusWorld(this.scene, this.renderer);
    this.scene.add(this.pingGroup, this.routeGroup);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.callbacks.onPauseToggle();
      return;
    }
    if (e.code === 'KeyM' || e.code === 'Tab') {
      e.preventDefault();
      this.callbacks.onOpenMapToggle();
      return;
    }
    this.keys[e.code] = true;

    if (e.code === 'KeyE' && !e.repeat && !this.paused && this.role === 'runner') {
      this.triggerInteract();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    audioEngine.init();
    if (this.paused || this.role !== 'runner' || this.snapshot.phase !== 'playing') return;
    if (e.target === this.renderer.domElement) {
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      try {
        if (document.pointerLockElement !== this.renderer.domElement && e.button === 0) {
          this.renderer.domElement.requestPointerLock?.();
        }
      } catch {
        // Fallback drag look remains active
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.paused || this.role !== 'runner') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.camYaw -= e.movementX * 0.0028;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.0022, -0.25, 0.85);
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.camYaw -= dx * 0.0055;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, -0.25, 0.85);
    }
  };

  private onPointerUp = () => {
    this.isDraggingLook = false;
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindInputs(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    this.keys = {};
    this.isDraggingLook = false;
  }

  public applyServerSnapshot(next: GameSnapshot): void {
    const prevPhase = this.snapshot.phase;
    // Preserve local Mina kinematics if we are the authoritative Runner during playing
    if (this.role === 'runner' && next.phase === 'playing') {
      const localMina = this.snapshot.mina;
      this.snapshot = structuredClone(next);
      this.snapshot.mina = localMina;
    } else {
      this.snapshot = structuredClone(next);
    }

    if (prevPhase !== 'cinematic' && next.phase === 'cinematic') {
      this.cinematicTimer = 0;
      audioEngine.playVictoryMusic();
    } else if (prevPhase !== 'ended' && next.phase === 'ended' && !next.restored) {
      audioEngine.playFailureBlackout();
    }
  }

  public getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  public setEchoFlash(spiritId: string | null, pylonIdx: number): void {
    this.activeEchoId = spiritId;
    this.echoFlashIndex = pylonIdx;
  }

  public completeEchoPuzzle(spiritId: string): void {
    this.activateSpirit(spiritId);
  }

  public completeSoloRouterStep(step: number): void {
    this.snapshot.routerSync.minaStep = step;
    if (this.snapshot.mode === 'coop') {
      this.callbacks.onSendAction({ type: 'router_step', step });
    } else {
      // Solo AI Tariq assists smoothly
      this.snapshot.routerSync.guideStep = Math.max(this.snapshot.routerSync.guideStep, step - 1);
      if (step >= 3) {
        this.snapshot.routerSync.guideStep = 3;
        this.snapshot.routerSync.completed = true;
        this.snapshot.phase = 'cinematic';
        this.snapshot.restored = true;
        const count = this.snapshot.spirits.filter((s) => s.activated).length;
        this.snapshot.rating = calculateConnectionRating(count, this.snapshot.blackoutElapsed, true);
        this.cinematicTimer = 0;
        audioEngine.playVictoryMusic();
        this.callbacks.onRadio({
          id: `sys-${Date.now()}`,
          sender: 'System',
          text: 'CAMPUS CONNECTION RESTORED!',
          tone: 'success',
          timestamp: Date.now(),
        });
        this.callbacks.onSnapshot(structuredClone(this.snapshot));
      }
    }
  }

  public triggerInteract(): void {
    if (this.currentPrompt) {
      this.currentPrompt.action();
    }
  }

  private activateSpirit(spiritId: string): void {
    const st = this.snapshot.spirits.find((s) => s.id === spiritId);
    const def = SPIRITS.find((s) => s.id === spiritId);
    if (!st || !def || st.activated) return;

    st.activated = true;
    st.discovered = true;
    st.beaconProgress = 5;
    this.activeBeaconId = null;
    if (this.snapshot.mina.carryingPacketFor === spiritId) {
      this.snapshot.mina.carryingPacketFor = null;
      this.snapshot.mina.packetIntegrity = 100;
    }
    this.linePulseProgress.set(spiritId, 0);
    audioEngine.playSpiritActivated(def.type);

    if (this.snapshot.mode === 'coop') {
      this.callbacks.onSendAction({ type: 'spirit_action', spiritId, activate: true, beaconProgress: 5 });
    } else {
      const count = this.snapshot.spirits.filter((s) => s.activated).length;
      this.callbacks.onRadio({
        id: `sp-${Date.now()}`,
        sender: 'Tariq',
        text: `${def.name} connected (${count}/6)! Connection Line online!`,
        tone: 'success',
        timestamp: Date.now(),
      });
      if (count >= 6 && !this.snapshot.allSixNotified) {
        this.snapshot.allSixNotified = true;
        this.snapshot.routerUnlocked = true;
        this.callbacks.onRadio({
          id: `six-${Date.now()}`,
          sender: 'System',
          text: 'ALL SIX CONNECTIONS ESTABLISHED. RETURN TO THE CENTRAL ROUTER.',
          tone: 'success',
          timestamp: Date.now(),
        });
      }
    }
    this.callbacks.onSnapshot(structuredClone(this.snapshot));
  }

  private resolveCollisions(x: number, z: number, y: number): { x: number; z: number } {
    const r = 0.42;
    let cx = THREE.MathUtils.clamp(x, -CAMPUS_BOUNDARY, CAMPUS_BOUNDARY);
    let cz = THREE.MathUtils.clamp(z, -CAMPUS_BOUNDARY, CAMPUS_BOUNDARY);

    for (const box of WORLD_COLLIDERS) {
      if (y >= box.maxY - 0.15) continue;
      const closestX = THREE.MathUtils.clamp(cx, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(cz, box.minZ, box.maxZ);
      const dx = cx - closestX;
      const dz = cz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = r - dist;
          cx += (dx / dist) * push;
          cz += (dz / dist) * push;
        } else {
          // Inside box: push out nearest edge
          const dLeft = Math.abs(cx - box.minX);
          const dRight = Math.abs(box.maxX - cx);
          const dTop = Math.abs(cz - box.minZ);
          const dBot = Math.abs(box.maxZ - cz);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) cx = box.minX - r;
          else if (m === dRight) cx = box.maxX + r;
          else if (m === dTop) cz = box.minZ - r;
          else cz = box.maxZ + r;
        }
      }
    }
    return { x: cx, z: cz };
  }

  private updateRunnerMovement(dt: number): boolean {
    const m = this.snapshot.mina;
    if (this.paused || this.snapshot.phase !== 'playing' || this.role !== 'runner') {
      this.currentSpeed = 0;
      return false;
    }

    // Keyboard camera turn fallback (Q/E-free: ArrowLeft/ArrowRight or Q/R)
    if (this.keys['ArrowLeft'] || this.keys['KeyQ']) this.camYaw += 2.1 * dt;
    if (this.keys['ArrowRight']) this.camYaw -= 2.1 * dt;

    let moveForward = 0;
    let moveRight = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyD']) moveRight += 1;
    if (this.keys['KeyA']) moveRight -= 1;

    const lineDist = distanceToActiveConnectionLines(m.x, m.z, this.snapshot.spirits);
    m.onConnectionLine = lineDist < 2.25;

    const bufferDist = Math.hypot(m.x - this.snapshot.buffer.x, m.z - this.snapshot.buffer.z);
    const slowedByBuffer = bufferDist < 5.8 && !m.onConnectionLine;

    let inCorruption = false;
    for (const cz of CORRUPTION_ZONES) {
      if (Math.hypot(m.x - cz.x, m.z - cz.z) < cz.radius) {
        inCorruption = true;
        break;
      }
    }

    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    let maxSpeed = sprinting ? 9.6 : 6.1;
    if (m.onConnectionLine) maxSpeed *= 1.38;
    if (slowedByBuffer || (inCorruption && !m.onConnectionLine)) maxSpeed *= 0.66;

    const hasInput = moveForward !== 0 || moveRight !== 0;
    const targetSpeed = hasInput ? maxSpeed : 0;
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, hasInput ? 12 : 10, dt);

    if (hasInput) {
      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      // Forward along -sinY, -cosY; Right along cosY, -sinY
      const dirX = -sinY * moveForward + cosY * moveRight;
      const dirZ = -cosY * moveForward - sinY * moveRight;
      const len = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / len;
      const nz = dirZ / len;

      const resolved = this.resolveCollisions(
        m.x + nx * this.currentSpeed * dt,
        m.z + nz * this.currentSpeed * dt,
        m.y
      );
      m.x = resolved.x;
      m.z = resolved.z;

      const targetYaw = Math.atan2(nx, nz);
      let diff = targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, 12 * dt);
    }

    // Jump & Gravity
    const groundY = getGroundHeightAt(m.x, m.z);
    if (this.keys['Space'] && this.grounded) {
      this.velY = 6.8;
      this.grounded = false;
    }
    this.velY -= 19.5 * dt;
    m.y += this.velY * dt;
    if (m.y <= groundY) {
      m.y = groundY;
      this.velY = 0;
      this.grounded = true;
    } else if (m.y > groundY + 0.08) {
      this.grounded = false;
    }

    m.speed = this.currentSpeed;
    m.inBuilding = isInsideBuilding(m.x, m.z);
    m.zoneId = getZoneAt(m.x, m.z);

    // Warm Packet corruption drain
    if (m.carryingPacketFor) {
      if (inCorruption || (bufferDist < 3.6 && !m.onConnectionLine)) {
        m.packetIntegrity = Math.max(0, m.packetIntegrity - 28 * dt);
        if (m.packetIntegrity <= 0) {
          m.carryingPacketFor = null;
          m.packetIntegrity = 100;
          audioEngine.playError();
          this.callbacks.onRadio({
            id: `pkt-${Date.now()}`,
            sender: 'Tariq',
            text: 'Warm Packet destabilized by corruption! Pick up a fresh one at the station!',
            tone: 'warning',
            timestamp: Date.now(),
          });
        }
      } else {
        m.packetIntegrity = Math.min(100, m.packetIntegrity + 4 * dt);
      }
    }

    // Footstep sound cadence
    if (this.grounded && this.currentSpeed > 1.2) {
      this.stepTimer += dt * (this.currentSpeed / 5.5);
      if (this.stepTimer >= 0.38) {
        this.stepTimer = 0;
        audioEngine.playFootstep(sprinting, m.inBuilding);
      }
    }

    // Beacon trail progression
    if (this.activeBeaconId) {
      const def = SPIRITS.find((s) => s.id === this.activeBeaconId);
      const st = this.snapshot.spirits.find((s) => s.id === this.activeBeaconId);
      if (def?.beaconTrail && st && !st.activated) {
        const node = def.beaconTrail[st.beaconProgress];
        if (node && Math.hypot(m.x - node.x, m.z - node.z) < 2.3) {
          audioEngine.playBeaconNode(st.beaconProgress);
          st.beaconProgress++;
          if (this.snapshot.mode === 'coop') {
            this.callbacks.onSendAction({
              type: 'spirit_action',
              spiritId: def.id,
              beaconProgress: st.beaconProgress,
            });
          }
          if (st.beaconProgress >= def.beaconTrail.length) {
            this.activateSpirit(def.id);
          }
        }
      }
    }

    return inCorruption;
  }

  private updateSoloSimulation(dt: number): void {
    if (this.snapshot.mode !== 'solo' || this.paused) return;
    const snap = this.snapshot;

    if (snap.phase === 'playing' || snap.phase === 'restoring') {
      if (snap.remainingSeconds > 0) {
        const prev = snap.remainingSeconds;
        snap.remainingSeconds = Math.max(0, snap.remainingSeconds - dt);
        if (prev > 0 && snap.remainingSeconds === 0) {
          this.callbacks.onRadio({
            id: `blk-${Date.now()}`,
            sender: 'System',
            text: '9:00 AM BLACKOUT! Final 15 seconds — reach the Central Router!',
            tone: 'warning',
            timestamp: Date.now(),
          });
        }
      } else {
        snap.blackoutElapsed += dt;
        if (snap.blackoutElapsed >= BLACKOUT_GRACE_SECONDS) {
          snap.phase = 'ended';
          snap.restored = false;
          snap.rating = 'Request Timed Out';
          audioEngine.playFailureBlackout();
          this.callbacks.onSnapshot(structuredClone(snap));
          return;
        }
      }

      const activeCount = snap.spirits.filter((s) => s.activated).length;
      if (snap.remainingSeconds <= 0 && activeCount >= 4 && !snap.routerUnlocked) {
        snap.routerUnlocked = true;
        this.callbacks.onRadio({
          id: `ov-${Date.now()}`,
          sender: 'Tariq',
          text: 'Emergency Bypass active at Central Router! Run back now!',
          tone: 'warning',
          timestamp: Date.now(),
        });
      }

      const now = Date.now();
      snap.pings = snap.pings.filter((p) => p.expiresAt > now);
      snap.safeRoutes = snap.safeRoutes.filter((r) => r.expiresAt > now);

      // Solo Buffer AI
      const progress = 1 - snap.remainingSeconds / GAME_DURATION_SECONDS;
      const isScared = snap.buffer.scaredUntil > now;
      const baseSpeed = 2.6 + progress * 2.4 + (snap.remainingSeconds <= 0 ? 1.4 : 0);
      const speed = isScared ? baseSpeed * 1.95 : baseSpeed;
      const aggroRange = 12 + progress * 14 + (snap.remainingSeconds <= 0 ? 8 : 0);
      const dMina = Math.hypot(snap.mina.x - snap.buffer.x, snap.mina.z - snap.buffer.z);
      snap.buffer.aggro = !isScared && dMina < aggroRange && !snap.mina.onConnectionLine;

      // Progressive Glitch Intensity: 10% when approaching (<=20m) up to 60% max when right on Mina (<=2.5m)
      if (isScared || snap.restored || dMina > 20) {
        snap.buffer.intensity = 0;
      } else {
        const closeness = THREE.MathUtils.clamp((20 - dMina) / 17.5, 0, 1);
        snap.buffer.intensity = 0.1 + 0.5 * closeness;
      }

      let tx = BUFFER_PATROL[this.bufferTargetIdx].x;
      let tz = BUFFER_PATROL[this.bufferTargetIdx].z;
      if (isScared) {
        // Flee away from Mina toward outer campus perimeter
        const fx = snap.buffer.x - snap.mina.x;
        const fz = snap.buffer.z - snap.mina.z;
        const flen = Math.hypot(fx, fz) || 1;
        tx = THREE.MathUtils.clamp(snap.buffer.x + (fx / flen) * 24, -44, 44);
        tz = THREE.MathUtils.clamp(snap.buffer.z + (fz / flen) * 24, -44, 44);
      } else if (snap.buffer.aggro) {
        tx = snap.mina.x;
        tz = snap.mina.z;
      } else if (Math.hypot(tx - snap.buffer.x, tz - snap.buffer.z) < 2.2) {
        this.bufferTargetIdx = (this.bufferTargetIdx + 1) % BUFFER_PATROL.length;
        tx = BUFFER_PATROL[this.bufferTargetIdx].x;
        tz = BUFFER_PATROL[this.bufferTargetIdx].z;
      }

      const dx = tx - snap.buffer.x;
      const dz = tz - snap.buffer.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = snap.buffer.x + (dx / len) * speed * dt;
      const nz = snap.buffer.z + (dz / len) * speed * dt;

      if (!isBlockedByActiveLines(nx, nz, snap.spirits, 1.75)) {
        snap.buffer.x = nx;
        snap.buffer.z = nz;
      } else if (!isBlockedByActiveLines(nx, snap.buffer.z, snap.spirits, 1.75)) {
        snap.buffer.x = nx;
      } else if (!isBlockedByActiveLines(snap.buffer.x, nz, snap.spirits, 1.75)) {
        snap.buffer.z = nz;
      } else {
        this.bufferTargetIdx = (this.bufferTargetIdx + 1) % BUFFER_PATROL.length;
      }
      snap.buffer.yaw = Math.atan2(dx, dz);
    }
  }

  private evaluateNearbyInteractable(): InteractPrompt | null {
    if (this.role !== 'runner' || this.snapshot.phase !== 'playing') return null;
    const m = this.snapshot.mina;

    // 1. Central Router
    const distRouter = Math.hypot(m.x - CENTRAL_ROUTER_POS.x, m.z - CENTRAL_ROUTER_POS.z);
    if (distRouter < 4.4) {
      if (this.snapshot.routerUnlocked) {
        return {
          key: 'E',
          label: 'Restore Central Router',
          action: () => {
            if (this.snapshot.mode === 'coop') {
              this.callbacks.onSendAction({ type: 'router_begin' });
            } else {
              this.snapshot.phase = 'restoring';
              this.snapshot.routerSync = { active: true, minaStep: 0, guideStep: 0, completed: false };
              this.callbacks.onSnapshot(structuredClone(this.snapshot));
            }
            this.callbacks.onOpenRouterPuzzle();
          },
        };
      } else {
        const count = this.snapshot.spirits.filter((s) => s.activated).length;
        return {
          key: 'E',
          label: `Router Needs Spirits (${count}/6 Connected)`,
          action: () => {
            audioEngine.playError();
          },
        };
      }
    }

    // 2. Hidden Secret Switches
    for (const sw of SECRET_SWITCHES) {
      if (this.snapshot.unlockedSecrets.includes(sw.id)) continue;
      if (Math.hypot(m.x - sw.position.x, m.z - sw.position.z) < 2.6) {
        return {
          key: 'E',
          label: `Activate ${sw.label}`,
          action: () => {
            this.snapshot.unlockedSecrets.push(sw.id);
            const st = this.snapshot.spirits.find((s) => s.id === sw.targetSpiritId);
            if (st) st.discovered = true;
            audioEngine.playPing();
            if (this.snapshot.mode === 'coop') {
              this.callbacks.onSendAction({
                type: 'unlock_secret',
                switchId: sw.id,
                targetSpiritId: sw.targetSpiritId,
              });
            } else {
              this.callbacks.onRadio({
                id: `sw-${Date.now()}`,
                sender: 'Tariq',
                text: `${sw.label} tripped! Hidden spirit revealed nearby!`,
                tone: 'info',
                timestamp: Date.now(),
              });
            }
          },
        };
      }
    }

    // 2.5 Signal Surge Repel Stations (scare The Buffer away!)
    const now = Date.now();
    for (const rs of REPEL_STATIONS) {
      if (Math.hypot(m.x - rs.position.x, m.z - rs.position.z) < 2.9) {
        const readyAt = this.snapshot.stationCooldowns[rs.id] ?? 0;
        const cdLeft = Math.max(0, Math.ceil((readyAt - now) / 1000));
        return {
          key: 'E',
          label:
            cdLeft > 0
              ? `${rs.label} Recharging (${cdLeft}s)`
              : `Pulse ${rs.label} (Scare Buffer Away)`,
          action: () => {
            const clickNow = Date.now();
            if ((this.snapshot.stationCooldowns[rs.id] ?? 0) > clickNow) {
              audioEngine.playError();
              return;
            }
            this.snapshot.stationCooldowns[rs.id] = clickNow + STATION_COOLDOWN_MS;
            this.snapshot.buffer.scaredUntil = clickNow + BUFFER_SCARE_DURATION_MS;
            this.snapshot.buffer.aggro = false;
            this.snapshot.buffer.intensity = 0;
            const vis = this.world.repelStations.get(rs.id);
            if (vis) vis.pulseTimer = 1.0;
            audioEngine.playStationSurge();
            if (this.snapshot.mode === 'coop') {
              this.callbacks.onSendAction({ type: 'trigger_station', stationId: rs.id });
            } else {
              this.callbacks.onRadio({
                id: `repel-${clickNow}`,
                sender: 'Tariq',
                text: `Signal surge fired at ${rs.label}! The Buffer is retreating!`,
                tone: 'success',
                timestamp: clickNow,
              });
            }
          },
        };
      }
    }

    // 3. Warm Packet Stations
    for (const def of SPIRITS) {
      if (def.type !== 'relay' || !def.packetStation) continue;
      const st = this.snapshot.spirits.find((s) => s.id === def.id);
      if (!st || st.activated) continue;
      if (Math.hypot(m.x - def.packetStation.x, m.z - def.packetStation.z) < 2.6) {
        return {
          key: 'E',
          label: `Pick Up Warm Packet (${def.name})`,
          action: () => {
            m.carryingPacketFor = def.id;
            m.packetIntegrity = 100;
            audioEngine.playPacketPickup();
          },
        };
      }
    }

    // 4. Spirits
    for (const def of SPIRITS) {
      const st = this.snapshot.spirits.find((s) => s.id === def.id);
      if (!st || st.activated) continue;
      const d = Math.hypot(m.x - def.position.x, m.z - def.position.z);
      if (d < 3.0) {
        if (def.type === 'beacon') {
          return {
            key: 'E',
            label:
              this.activeBeaconId === def.id
                ? `Following ${def.name} Trail (${st.beaconProgress}/5)`
                : `Start ${def.name} Trail`,
            action: () => {
              this.activeBeaconId = def.id;
              st.discovered = true;
              audioEngine.playBeaconNode(0);
            },
          };
        }
        if (def.type === 'echo') {
          return {
            key: 'E',
            label: `Listen & Repeat ${def.name}`,
            action: () => {
              st.discovered = true;
              this.callbacks.onOpenEchoPuzzle(def);
            },
          };
        }
        if (def.type === 'relay') {
          if (m.carryingPacketFor === def.id) {
            return {
              key: 'E',
              label: `Deliver Warm Packet to ${def.name}`,
              action: () => this.activateSpirit(def.id),
            };
          }
          return {
            key: 'E',
            label: `Needs Warm Packet (${def.zoneLabel})`,
            action: () => {
              audioEngine.playError();
              this.callbacks.onRadio({
                id: `need-${Date.now()}`,
                sender: 'Tariq',
                text: def.discoveryHint,
                tone: 'info',
                timestamp: Date.now(),
              });
            },
          };
        }
      }
    }

    return null;
  }

  private syncDynamicMarkers(elapsed: number): void {
    // Signal Pings 3D Sky Beams
    const pingSig = this.snapshot.pings.map((p) => p.id).join(',');
    if (pingSig !== this.lastPingSig) {
      this.lastPingSig = pingSig;
      while (this.pingGroup.children.length > 0) {
        this.pingGroup.remove(this.pingGroup.children[0]);
      }
      for (const p of this.snapshot.pings) {
        const y = getGroundHeightAt(p.x, p.z);
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.45, 22, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.42,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        beam.position.set(p.x, y + 11, p.z);
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
        );
        diamond.position.set(p.x, y + 2.4, p.z);
        this.pingGroup.add(beam, diamond);
      }
    }
    this.pingGroup.children.forEach((child, idx) => {
      if (idx % 2 === 1) child.rotation.y = elapsed * 2.5;
    });

    // Safe Route floor ribbons
    const routeSig = this.snapshot.safeRoutes.map((r) => r.id).join(',');
    if (routeSig !== this.lastRouteSig) {
      this.lastRouteSig = routeSig;
      while (this.routeGroup.children.length > 0) {
        this.routeGroup.remove(this.routeGroup.children[0]);
      }
      for (const r of this.snapshot.safeRoutes) {
        if (r.points.length < 2) continue;
        const pts = r.points.map((pt) => new THREE.Vector3(pt.x, getGroundHeightAt(pt.x, pt.z) + 0.35, pt.z));
        const curve = new THREE.CatmullRomCurve3(pts);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.16, 6, false),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.72 })
        );
        this.routeGroup.add(mesh);
      }
    }
  }

  private updateVisuals(dt: number, elapsed: number, inCorruption: boolean): void {
    const snap = this.snapshot;
    const m = snap.mina;

    // 1. Sky, Fog & Dynamic Lighting (Outside vs Approaching vs Inside vs 9:00 vs Restored)
    const timeProgress = 1 - snap.remainingSeconds / GAME_DURATION_SECONDS;
    const corruptionLevel = snap.restored ? 0 : Math.min(1, timeProgress * 0.85 + (snap.remainingSeconds <= 0 ? 0.35 : 0));
    this.world.skyUniforms.uCorruption.value = corruptionLevel;
    this.world.skyUniforms.uRestored.value = snap.restored ? 1 : 0;
    this.world.skyUniforms.uTime.value = elapsed;

    const approaching = isApproachingBuilding(m.x, m.z);
    if (snap.restored) {
      this.world.hemiLight.color.lerp(_hemiRestored, 0.08);
      this.world.hemiLight.intensity = THREE.MathUtils.damp(this.world.hemiLight.intensity, 1.35, 3, dt);
      this.world.keyLight.intensity = THREE.MathUtils.damp(this.world.keyLight.intensity, 1.75, 3, dt);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerp(_skyRestored, 0.05);
        this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, 0.006, 3, dt);
      }
    } else {
      const targetHemi = m.inBuilding || approaching ? _hemiIndoor : _hemiOutdoor;
      this.world.hemiLight.color.lerp(targetHemi, 0.08);
      const targetKey = m.inBuilding ? 0.32 : approaching ? 0.75 : 1.45 - corruptionLevel * 0.85;
      this.world.keyLight.intensity = THREE.MathUtils.damp(this.world.keyLight.intensity, targetKey, 4, dt);
      this.world.hemiLight.intensity = THREE.MathUtils.damp(
        this.world.hemiLight.intensity,
        m.inBuilding ? 0.45 : 0.9 - corruptionLevel * 0.45,
        4,
        dt
      );
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.copy(_skyDusk).lerp(_skyBlackout, corruptionLevel);
        this.scene.fog.density = THREE.MathUtils.damp(
          this.scene.fog.density,
          m.inBuilding ? 0.032 : 0.013 + corruptionLevel * 0.015,
          4,
          dt
        );
      }
    }

    // Streetlamps & Interior flicker
    for (let i = 0; i < this.world.streetLights.length; i++) {
      const pl = this.world.streetLights[i];
      if (snap.restored) {
        pl.intensity = 2.6;
      } else if (snap.remainingSeconds <= 0) {
        pl.intensity = Math.sin(elapsed * 23 + i) > 0.3 ? 0.9 : 0.15;
      } else {
        pl.intensity = 1.8 - corruptionLevel * 0.6;
      }
    }
    for (let i = 0; i < this.world.interiorLights.length; i++) {
      const il = this.world.interiorLights[i];
      il.intensity = snap.restored ? 2.2 : 1.4 + Math.sin(elapsed * 19 + i * 3) * 0.45;
    }
    for (let i = 0; i < this.world.corruptedScreens.length; i++) {
      this.world.corruptedScreens[i].emissive.setHex(snap.restored ? 0x38bdf8 : 0xff2d55);
      this.world.corruptedScreens[i].emissiveIntensity = snap.restored ? 1.2 : 0.8 + Math.random() * 0.9;
    }

    // 2. Mina Rig & Procedural Walk/Jog/Sprint Animation
    const mina = this.world.mina;
    mina.group.position.set(m.x, m.y, m.z);
    mina.group.rotation.y = m.yaw;
    mina.packetOrb.visible = Boolean(m.carryingPacketFor);
    if (mina.packetOrb.visible) {
      mina.packetOrb.rotation.y = elapsed * 3.2;
      mina.packetOrb.position.y = 1.56 + Math.sin(elapsed * 5) * 0.06;
    }

    if (m.speed > 0.35 && this.grounded) {
      this.walkCycle += dt * m.speed * 1.9;
      const swing = Math.sin(this.walkCycle) * Math.min(0.65, m.speed * 0.075);
      mina.leftLeg.rotation.x = swing;
      mina.rightLeg.rotation.x = -swing;
      mina.leftArm.rotation.x = -swing * 0.8;
      mina.rightArm.rotation.x = swing * 0.35;
    } else {
      mina.leftLeg.rotation.x = THREE.MathUtils.damp(mina.leftLeg.rotation.x, 0, 10, dt);
      mina.rightLeg.rotation.x = THREE.MathUtils.damp(mina.rightLeg.rotation.x, 0, 10, dt);
      mina.leftArm.rotation.x = THREE.MathUtils.damp(mina.leftArm.rotation.x, 0, 10, dt);
      mina.rightArm.rotation.x = THREE.MathUtils.damp(mina.rightArm.rotation.x, 0, 10, dt);
    }

    // 3. Central Router Stage 1–4 visuals
    const router = this.world.router;
    const activeCount = snap.spirits.filter((s) => s.activated).length;
    for (let i = 0; i < 6; i++) {
      const spActive = snap.spirits[i]?.activated;
      router.conduitMatList[i].emissiveIntensity = snap.restored ? 2.6 : spActive ? 1.7 : 0.12;
      router.conduitMatList[i].color.setHex(spActive || snap.restored ? 0x38bdf8 : 0x334155);
    }
    router.coreCrystal.rotation.y = elapsed * (1.2 + activeCount * 0.35);
    router.outerRing.rotation.x = elapsed * (0.7 + activeCount * 0.2);
    router.outerRing.rotation.y = elapsed * 0.5;
    router.innerRing.rotation.z = -elapsed * (0.9 + activeCount * 0.25);
    router.coreLight.intensity = snap.restored ? 6.0 : 1.5 + activeCount * 0.55;
    const beamMat = router.unlockBeam.material as THREE.MeshBasicMaterial;
    beamMat.opacity = snap.restored ? 0.55 : snap.routerUnlocked ? 0.26 + Math.sin(elapsed * 4) * 0.08 : 0;

    // 4. Spirits, Connection Lines & Trail Nodes
    for (let i = 0; i < SPIRITS.length; i++) {
      const def = SPIRITS[i];
      const st = snap.spirits[i];
      const vis = this.world.spirits.get(def.id);
      if (!vis || !st) continue;

      vis.core.rotation.y = elapsed * (st.activated ? 2.2 : 0.9);
      vis.core.position.y = 1.5 + Math.sin(elapsed * 2.4 + i) * 0.16;
      vis.ring.rotation.z = elapsed * 1.4;
      vis.light.intensity = st.activated ? 3.2 : 1.5;

      // Echo pylons flash during Echo clue playback
      if (vis.echoPylonMats) {
        for (let p = 0; p < 3; p++) {
          const isLit = this.activeEchoId === def.id && this.echoFlashIndex === p;
          vis.echoPylonMats[p].emissiveIntensity = st.activated ? 1.4 : isLit ? 3.0 : 0.25;
        }
      }

      // Beacon trail nodes visibility
      if (vis.trailNodes && def.beaconTrail) {
        const showTrail = this.activeBeaconId === def.id && !st.activated;
        for (let n = 0; n < vis.trailNodes.length; n++) {
          const node = vis.trailNodes[n];
          node.visible = showTrail && n >= st.beaconProgress;
          if (node.visible) {
            node.rotation.y = elapsed * 3.0;
            const isCurrent = n === st.beaconProgress;
            node.scale.setScalar(isCurrent ? 1.35 + Math.sin(elapsed * 6) * 0.15 : 0.65);
          }
        }
      }

      // Connection Line Tube + travelling pulse
      const conn = this.world.connectionMeshes.get(def.id);
      if (conn) {
        if (st.activated) {
          conn.mat.color.setHex(0x67e8f9);
          conn.mat.emissive.setHex(snap.restored ? 0xfde047 : 0x22d3ee);
          conn.mat.emissiveIntensity = snap.restored ? 2.5 : 1.4 + Math.sin(elapsed * 4 + i) * 0.25;
          conn.mat.opacity = 0.92;

          let t = this.linePulseProgress.get(def.id) ?? 0;
          t = (t + dt * (snap.restored ? 0.9 : 0.45)) % 1;
          this.linePulseProgress.set(def.id, t);
          const pts = def.linePath;
          const segF = t * (pts.length - 1);
          const idx = Math.min(pts.length - 2, Math.floor(segF));
          const frac = segF - idx;
          conn.pulse.visible = true;
          conn.pulse.position.set(
            THREE.MathUtils.lerp(pts[idx].x, pts[idx + 1].x, frac),
            0.38,
            THREE.MathUtils.lerp(pts[idx].z, pts[idx + 1].z, frac)
          );
        } else {
          conn.mat.color.setHex(0x334155);
          conn.mat.emissiveIntensity = 0.05;
          conn.mat.opacity = 0.35;
          conn.pulse.visible = false;
        }
      }
    }

    // Secret Switch LEDs
    for (const sw of SECRET_SWITCHES) {
      const ref = this.world.secretSwitches.get(sw.id);
      if (ref) {
        const unlocked = snap.unlockedSecrets.includes(sw.id);
        ref.ledMat.color.setHex(unlocked ? 0x34d399 : 0xf59e0b);
        ref.ledMat.emissive.setHex(unlocked ? 0x34d399 : 0xf59e0b);
      }
    }

    // Corruption Floor Patches
    for (let i = 0; i < this.world.corruptionMeshes.length; i++) {
      const cm = this.world.corruptionMeshes[i];
      if (snap.restored) {
        cm.scale.setScalar(Math.max(0.001, cm.scale.x - dt * 1.4));
        cm.visible = cm.scale.x > 0.02;
      } else {
        const sc = 1 + corruptionLevel * 0.45 + Math.sin(elapsed * 3 + i) * 0.05;
        cm.scale.setScalar(sc);
        cm.visible = true;
      }
    }

    // Repel Signal Stations (spin + cooldown color + expanding shockwave ring)
    const nowMs = Date.now();
    for (const [id, vis] of this.world.repelStations.entries()) {
      const readyAt = snap.stationCooldowns[id] ?? 0;
      const onCd = readyAt > nowMs;
      vis.crystal.rotation.y = elapsed * (onCd ? 0.6 : 2.2);
      vis.crystal.position.y = 1.75 + Math.sin(elapsed * 3) * 0.08;
      vis.crystalMat.color.setHex(onCd ? 0x64748b : 0x38bdf8);
      vis.crystalMat.emissive.setHex(onCd ? 0x334155 : 0x0ea5e9);
      vis.crystalMat.emissiveIntensity = onCd ? 0.4 : 1.8;
      vis.light.intensity = onCd ? 0.4 : 1.8;

      if (vis.pulseTimer > 0) {
        vis.pulseTimer = Math.max(0, vis.pulseTimer - dt * 1.4);
        const p = 1 - vis.pulseTimer;
        vis.shockwave.visible = true;
        vis.shockwave.scale.setScalar(1 + p * 12);
        vis.shockwaveMat.opacity = (1 - p) * 0.85;
      } else {
        vis.shockwave.visible = false;
      }
    }

    // 5. The Buffer Visuals (glitch blocks, rotating loading-ring eye, swaying cables)
    const buf = this.world.buffer;
    const bufScared = snap.buffer.scaredUntil > nowMs;
    if (snap.restored) {
      // Trap Buffer far outside perimeter on restoration!
      const angle = Math.atan2(snap.buffer.z, snap.buffer.x);
      buf.group.position.set(Math.cos(angle) * 48, 0, Math.sin(angle) * 48);
      buf.light.intensity = 0.8;
    } else {
      buf.group.position.set(snap.buffer.x, 0, snap.buffer.z);
      buf.group.rotation.y = snap.buffer.yaw;
      buf.light.color.setHex(bufScared ? 0x67e8f9 : 0xff2d55);
      buf.light.intensity = bufScared ? 1.8 : 2.6 + Math.sin(elapsed * 12) * 0.8;
    }
    buf.eyeRing.rotation.z = -elapsed * (bufScared ? 11.0 : 5.2);
    for (let i = 0; i < buf.blocks.length; i++) {
      const blk = buf.blocks[i];
      const base = blk.userData.basePos as THREE.Vector3;
      const jitter = bufScared ? 0.14 : 0.06;
      blk.position.set(
        base.x + Math.sin(elapsed * 16 + i * 2) * jitter,
        base.y + Math.cos(elapsed * 14 + i) * jitter,
        base.z + Math.sin(elapsed * 12 + i * 3) * jitter
      );
    }
    for (let i = 0; i < buf.cables.length; i++) {
      buf.cables[i].rotation.x = Math.sin(elapsed * 4 + i) * 0.25;
    }

    // 6. Camera Update (Third-Person Over-the-Shoulder OR Stage 4 Cinematic Orbit)
    if (snap.phase === 'cinematic') {
      this.cinematicTimer += dt;
      const orbitAngle = this.cinematicTimer * 0.55;
      _camDesired.set(Math.cos(orbitAngle) * 14, 7.5 + Math.sin(this.cinematicTimer * 0.7) * 1.5, Math.sin(orbitAngle) * 14);
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-3.5 * dt));
      this.camera.lookAt(0, 4.2, 0);
      if (this.cinematicTimer >= 4.2) {
        snap.phase = 'ended';
        this.callbacks.onSnapshot(structuredClone(snap));
      }
    } else if (this.role === 'runner') {
      const distBack = 4.9;
      const shoulderOffset = 0.72;
      const sinY = Math.sin(this.camYaw);
      const cosY = Math.cos(this.camYaw);
      const horiz = Math.cos(this.camPitch) * distBack;
      const vert = Math.sin(this.camPitch) * distBack + 1.95;

      _v1.set(
        m.x + sinY * horiz + cosY * shoulderOffset,
        m.y + vert,
        m.z + cosY * horiz - sinY * shoulderOffset
      );
      // Prevent camera from dipping underground
      _v1.y = Math.max(getGroundHeightAt(_v1.x, _v1.z) + 0.55, _v1.y);

      const dampK = 14;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _v1.x, dampK, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _v1.y, dampK, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _v1.z, dampK, dt);

      // Subtle tension FOV shift when sprinting or near Buffer
      const bufferProx = snap.buffer.intensity;
      const targetFov = 60 + (m.onConnectionLine ? 4 : 0) - bufferProx * 4.5;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();

      _camLook.set(m.x + cosY * 0.45, m.y + 1.45, m.z - sinY * 0.45);
      this.camera.lookAt(_camLook);
    }

    // Audio ambience update
    audioEngine.updateAmbience({
      inBuilding: m.inBuilding,
      approachingBuilding: approaching,
      bufferProximity: snap.buffer.intensity,
      corruptionLevel,
      restored: snap.restored,
    });

    this.syncDynamicMarkers(elapsed);

    // Emit UI & Network sync
    const now = performance.now();
    this.currentPrompt = this.evaluateNearbyInteractable();
    if (now - this.lastUiSyncMs > 85) {
      this.lastUiSyncMs = now;
      this.callbacks.onUIUpdate({
        prompt: this.currentPrompt,
        activeBeaconId: this.activeBeaconId,
        activeEchoSpirit: null,
        bufferProximity: snap.restored ? 0 : snap.buffer.intensity,
        inCorruption,
      });
      if (this.snapshot.mode === 'solo') {
        this.callbacks.onSnapshot(structuredClone(this.snapshot));
      }
    }

    if (this.snapshot.mode === 'coop' && this.role === 'runner' && now - this.lastNetSyncMs > 75) {
      this.lastNetSyncMs = now;
      this.callbacks.onSendAction({ type: 'mina_update', mina: m });
    }
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.06, Math.max(0.001, (now - this.lastClockMs) / 1000));
      this.lastClockMs = now;
      const elapsed = now / 1000;

      const inCorruption = this.updateRunnerMovement(dt);
      this.updateSoloSimulation(dt);
      this.updateVisuals(dt, elapsed, inCorruption);

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
