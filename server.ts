import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  BLACKOUT_GRACE_SECONDS,
  BUFFER_SCARE_DURATION_MS,
  CENTRAL_ROUTER_POS,
  GAME_DURATION_SECONDS,
  MINA_SPAWN_POS,
  REPEL_STATIONS,
  SPIRITS,
  STATION_COOLDOWN_MS,
  ZONES,
  calculateConnectionRating,
  createInitialSpirits,
  getZoneAt,
  isBlockedByActiveLines,
} from './src/game/worldData.ts';
import type {
  GameSnapshot,
  PlayerRole,
  RadioMessage,
  ZoneId,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ClientSlot {
  ws: WebSocket | null;
  token: string;
  role: PlayerRole;
  lastSeen: number;
}

interface Room {
  code: string;
  snapshot: GameSnapshot;
  clients: Map<string, ClientSlot>;
  bufferTargetIdx: number;
  lastTickMs: number;
}

const BUFFER_PATROL: Array<{ x: number; z: number }> = [
  { x: -16, z: -18 },
  { x: 18, z: -18 },
  { x: 20, z: 16 },
  { x: -18, z: 18 },
  { x: 0, z: -24 },
];

const rooms = new Map<string, Room>();

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? makeRoomCode() : code;
}

function makeToken(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function createInitialSnapshot(roomCode: string): GameSnapshot {
  return {
    roomCode,
    mode: 'coop',
    phase: 'lobby',
    remainingSeconds: GAME_DURATION_SECONDS,
    blackoutElapsed: 0,
    blackoutGraceDuration: BLACKOUT_GRACE_SECONDS,
    routerUnlocked: false,
    allSixNotified: false,
    restored: false,
    rating: null,
    spirits: createInitialSpirits(),
    scannedZones: [],
    unlockedSecrets: [],
    stationCooldowns: {},
    mina: {
      x: MINA_SPAWN_POS.x,
      y: MINA_SPAWN_POS.y,
      z: MINA_SPAWN_POS.z,
      yaw: Math.PI,
      speed: 0,
      carryingPacketFor: null,
      packetIntegrity: 100,
      onConnectionLine: false,
      inBuilding: false,
      zoneId: 'router',
    },
    buffer: {
      x: -18,
      z: -20,
      yaw: 0,
      aggro: false,
      intensity: 0,
      scaredUntil: 0,
    },
    pings: [],
    safeRoutes: [],
    routerSync: {
      active: false,
      minaStep: 0,
      guideStep: 0,
      completed: false,
    },
    guideCooldowns: {
      scanReadyAt: 0,
      pingReadyAt: 0,
      routeReadyAt: 0,
    },
    connectedRoles: { runner: false, guide: false },
  };
}

function updateConnectedRoles(room: Room): void {
  let runner = false;
  let guide = false;
  for (const c of room.clients.values()) {
    if (c.ws && c.ws.readyState === WebSocket.OPEN) {
      if (c.role === 'runner') runner = true;
      if (c.role === 'guide') guide = true;
    }
  }
  room.snapshot.connectedRoles = { runner, guide };
}

function broadcast(room: Room, payload: unknown): void {
  const raw = JSON.stringify(payload);
  for (const c of room.clients.values()) {
    if (c.ws && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function emitRadio(room: Room, sender: 'Tariq' | 'System', text: string, tone: RadioMessage['tone']): void {
  broadcast(room, {
    type: 'radio',
    message: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender,
      text,
      tone,
      timestamp: Date.now(),
    },
  });
}

function stepRoomSimulation(room: Room, now: number): void {
  const snap = room.snapshot;
  const dt = Math.min(0.2, Math.max(0.01, (now - room.lastTickMs) / 1000));
  room.lastTickMs = now;

  if (snap.phase !== 'playing' && snap.phase !== 'restoring') {
    return;
  }

  // Countdown timer: 8:58 -> 9:00 AM (120s), then 15s final-chance blackout phase
  if (snap.remainingSeconds > 0) {
    const prev = snap.remainingSeconds;
    snap.remainingSeconds = Math.max(0, snap.remainingSeconds - dt);
    if (prev > 0 && snap.remainingSeconds === 0) {
      emitRadio(
        room,
        'System',
        '9:00 AM BLACKOUT INITIATED! Complete Router Override immediately!',
        'warning'
      );
    }
  } else {
    snap.blackoutElapsed += dt;
    if (snap.blackoutElapsed >= BLACKOUT_GRACE_SECONDS) {
      snap.phase = 'ended';
      snap.restored = false;
      snap.rating = 'Request Timed Out';
      emitRadio(room, 'System', 'Total campus blackout. Connection lost.', 'warning');
      broadcast(room, { type: 'state_sync', snapshot: snap });
      return;
    }
  }

  const activatedCount = snap.spirits.filter((s) => s.activated).length;
  if (!snap.allSixNotified && activatedCount >= 6) {
    snap.allSixNotified = true;
    snap.routerUnlocked = true;
    emitRadio(
      room,
      'System',
      'ALL SIX CONNECTIONS ESTABLISHED. RETURN TO THE CENTRAL ROUTER.',
      'success'
    );
  } else if (snap.remainingSeconds <= 0 && activatedCount >= 4) {
    if (!snap.routerUnlocked) {
      snap.routerUnlocked = true;
      emitRadio(
        room,
        'Tariq',
        'Emergency Bypass unlocked at the Central Router! Get back here now!',
        'warning'
      );
    }
  }

  // Clean expired pings & safe routes
  snap.pings = snap.pings.filter((p) => p.expiresAt > now);
  snap.safeRoutes = snap.safeRoutes.filter((r) => r.expiresAt > now);

  // Authoritative Buffer AI movement
  const progress = 1 - snap.remainingSeconds / GAME_DURATION_SECONDS;
  const isScared = snap.buffer.scaredUntil > now;
  const baseSpeed = 2.6 + progress * 2.5 + (snap.remainingSeconds <= 0 ? 1.4 : 0);
  const speed = isScared ? baseSpeed * 1.95 : baseSpeed;
  const aggroRange = 12 + progress * 14 + (snap.remainingSeconds <= 0 ? 8 : 0);

  const distToMina = Math.hypot(snap.mina.x - snap.buffer.x, snap.mina.z - snap.buffer.z);
  const minaProtected = snap.mina.onConnectionLine;
  snap.buffer.aggro = !isScared && distToMina < aggroRange && !minaProtected;

  if (isScared || snap.restored || distToMina > 20) {
    snap.buffer.intensity = 0;
  } else {
    const closeness = Math.max(0, Math.min(1, (20 - distToMina) / 17.5));
    snap.buffer.intensity = 0.1 + 0.5 * closeness;
  }

  let targetX = BUFFER_PATROL[room.bufferTargetIdx].x;
  let targetZ = BUFFER_PATROL[room.bufferTargetIdx].z;

  if (isScared) {
    const fx = snap.buffer.x - snap.mina.x;
    const fz = snap.buffer.z - snap.mina.z;
    const flen = Math.hypot(fx, fz) || 1;
    targetX = Math.max(-44, Math.min(44, snap.buffer.x + (fx / flen) * 24));
    targetZ = Math.max(-44, Math.min(44, snap.buffer.z + (fz / flen) * 24));
  } else if (snap.buffer.aggro) {
    targetX = snap.mina.x;
    targetZ = snap.mina.z;
  } else if (Math.hypot(targetX - snap.buffer.x, targetZ - snap.buffer.z) < 2.2) {
    room.bufferTargetIdx = (room.bufferTargetIdx + 1) % BUFFER_PATROL.length;
    targetX = BUFFER_PATROL[room.bufferTargetIdx].x;
    targetZ = BUFFER_PATROL[room.bufferTargetIdx].z;
  }

  const dx = targetX - snap.buffer.x;
  const dz = targetZ - snap.buffer.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = snap.buffer.x + (dx / len) * speed * dt;
  const nz = snap.buffer.z + (dz / len) * speed * dt;

  // Enforce Connection Line Barrier: Buffer cannot cross active Connection Lines!
  if (!isBlockedByActiveLines(nx, nz, snap.spirits, 1.75)) {
    snap.buffer.x = nx;
    snap.buffer.z = nz;
  } else {
    // Slide tangentially or advance patrol target
    if (!isBlockedByActiveLines(nx, snap.buffer.z, snap.spirits, 1.75)) {
      snap.buffer.x = nx;
    } else if (!isBlockedByActiveLines(snap.buffer.x, nz, snap.spirits, 1.75)) {
      snap.buffer.z = nz;
    } else {
      room.bufferTargetIdx = (room.bufferTargetIdx + 1) % BUFFER_PATROL.length;
    }
  }
  snap.buffer.yaw = Math.atan2(dx, dz);

  broadcast(room, { type: 'state_sync', snapshot: snap });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoom: Room | null = null;
    let clientToken: string | null = null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'create_room') {
        const code = makeRoomCode();
        const token = makeToken();
        const role: PlayerRole = msg.role === 'guide' ? 'guide' : 'runner';
        const room: Room = {
          code,
          snapshot: createInitialSnapshot(code),
          clients: new Map([[token, { ws, token, role, lastSeen: Date.now() }]]),
          bufferTargetIdx: 0,
          lastTickMs: Date.now(),
        };
        rooms.set(code, room);
        currentRoom = room;
        clientToken = token;
        updateConnectedRoles(room);
        ws.send(
          JSON.stringify({
            type: 'joined',
            roomCode: code,
            role,
            token,
            snapshot: room.snapshot,
          })
        );
        return;
      }

      if (type === 'join_room') {
        const code = String(msg.roomCode || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: `Room ${code} not found.` }));
          return;
        }
        updateConnectedRoles(room);
        // Assign free role or requested role
        let role: PlayerRole = msg.role === 'guide' ? 'guide' : 'runner';
        if (role === 'runner' && room.snapshot.connectedRoles.runner && !room.snapshot.connectedRoles.guide) {
          role = 'guide';
        } else if (role === 'guide' && room.snapshot.connectedRoles.guide && !room.snapshot.connectedRoles.runner) {
          role = 'runner';
        }
        const token = makeToken();
        room.clients.set(token, { ws, token, role, lastSeen: Date.now() });
        currentRoom = room;
        clientToken = token;
        updateConnectedRoles(room);
        ws.send(
          JSON.stringify({
            type: 'joined',
            roomCode: code,
            role,
            token,
            snapshot: room.snapshot,
          })
        );
        broadcast(room, { type: 'state_sync', snapshot: room.snapshot });
        return;
      }

      if (type === 'reconnect') {
        const code = String(msg.roomCode || '').trim().toUpperCase();
        const token = String(msg.token || '');
        const room = rooms.get(code);
        const slot = room?.clients.get(token);
        if (!room || !slot) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session expired.' }));
          return;
        }
        slot.ws = ws;
        slot.lastSeen = Date.now();
        currentRoom = room;
        clientToken = token;
        updateConnectedRoles(room);
        ws.send(
          JSON.stringify({
            type: 'joined',
            roomCode: code,
            role: slot.role,
            token,
            snapshot: room.snapshot,
          })
        );
        broadcast(room, { type: 'state_sync', snapshot: room.snapshot });
        return;
      }

      if (!currentRoom || !clientToken) return;
      const slot = currentRoom.clients.get(clientToken);
      if (!slot) return;
      const snap = currentRoom.snapshot;

      if (type === 'select_role') {
        const nextRole: PlayerRole = msg.role === 'guide' ? 'guide' : 'runner';
        slot.role = nextRole;
        updateConnectedRoles(currentRoom);
        ws.send(JSON.stringify({ type: 'role_updated', role: nextRole }));
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'start_game' || type === 'restart_game') {
        const fresh = createInitialSnapshot(currentRoom.code);
        fresh.phase = 'playing';
        currentRoom.snapshot = fresh;
        currentRoom.lastTickMs = Date.now();
        updateConnectedRoles(currentRoom);
        broadcast(currentRoom, { type: 'state_sync', snapshot: currentRoom.snapshot });
        emitRadio(currentRoom, 'Tariq', '8:58 AM — Network is collapsing! Awaken the spirits before 9:00!', 'info');
        return;
      }

      if (type === 'mina_update' && slot.role === 'runner') {
        const m = msg.mina as Record<string, unknown>;
        if (m) {
          snap.mina.x = Number(m.x) || 0;
          snap.mina.y = Number(m.y) || 0;
          snap.mina.z = Number(m.z) || 0;
          snap.mina.yaw = Number(m.yaw) || 0;
          snap.mina.speed = Number(m.speed) || 0;
          snap.mina.carryingPacketFor = typeof m.carryingPacketFor === 'string' ? m.carryingPacketFor : null;
          snap.mina.packetIntegrity = Number(m.packetIntegrity ?? 100);
          snap.mina.onConnectionLine = Boolean(m.onConnectionLine);
          snap.mina.inBuilding = Boolean(m.inBuilding);
          snap.mina.zoneId = getZoneAt(snap.mina.x, snap.mina.z);
        }
        return;
      }

      if (type === 'spirit_action') {
        const spiritId = String(msg.spiritId || '');
        const st = snap.spirits.find((s) => s.id === spiritId);
        const def = SPIRITS.find((s) => s.id === spiritId);
        if (!st || !def) return;

        if (typeof msg.beaconProgress === 'number') {
          st.beaconProgress = Math.max(st.beaconProgress, msg.beaconProgress);
        }
        if (msg.activate && !st.activated) {
          st.activated = true;
          st.discovered = true;
          st.beaconProgress = 5;
          const count = snap.spirits.filter((s) => s.activated).length;
          emitRadio(currentRoom, 'Tariq', `${def.name} online (${count}/6). Connection line active!`, 'success');
          if (count >= 6 && !snap.allSixNotified) {
            snap.allSixNotified = true;
            snap.routerUnlocked = true;
            emitRadio(currentRoom, 'System', 'ALL SIX CONNECTIONS ESTABLISHED. RETURN TO THE CENTRAL ROUTER.', 'success');
          }
          broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        }
        return;
      }

      if (type === 'unlock_secret') {
        const switchId = String(msg.switchId || '');
        const targetSpiritId = String(msg.targetSpiritId || '');
        if (!snap.unlockedSecrets.includes(switchId)) {
          snap.unlockedSecrets.push(switchId);
        }
        const st = snap.spirits.find((s) => s.id === targetSpiritId);
        if (st) st.discovered = true;
        emitRadio(currentRoom, 'Tariq', 'Hidden breaker tripped! A concealed spirit signal just appeared!', 'info');
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'trigger_station') {
        const stationId = String(msg.stationId || '');
        const stDef = REPEL_STATIONS.find((s) => s.id === stationId);
        const now = Date.now();
        if (!stDef || (snap.stationCooldowns[stationId] ?? 0) > now) return;
        snap.stationCooldowns[stationId] = now + STATION_COOLDOWN_MS;
        snap.buffer.scaredUntil = now + BUFFER_SCARE_DURATION_MS;
        snap.buffer.aggro = false;
        snap.buffer.intensity = 0;
        emitRadio(currentRoom, 'Tariq', `Signal surge fired at ${stDef.label}! The Buffer is retreating!`, 'success');
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'guide_scan') {
        const now = Date.now();
        if (now < snap.guideCooldowns.scanReadyAt) return;
        const zoneId = String(msg.zoneId || '') as ZoneId;
        snap.guideCooldowns.scanReadyAt = now + 4000;
        if (!snap.scannedZones.includes(zoneId)) {
          snap.scannedZones.push(zoneId);
        }
        const spDef = SPIRITS.find((s) => s.zoneId === zoneId);
        const spState = spDef ? snap.spirits.find((s) => s.id === spDef.id) : null;
        if (spState && spDef) {
          spState.discovered = true;
          emitRadio(currentRoom, 'Tariq', `Scan clue (${spDef.zoneLabel}): ${spDef.clueText}`, 'info');
        }
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'guide_ping') {
        const now = Date.now();
        if (now < snap.guideCooldowns.pingReadyAt) return;
        snap.guideCooldowns.pingReadyAt = now + 2500;
        const x = Number(msg.x) || 0;
        const z = Number(msg.z) || 0;
        const label = String(msg.label || 'Signal Ping').slice(0, 28);
        snap.pings.push({
          id: `ping-${now}`,
          x,
          z,
          label,
          createdAt: now,
          expiresAt: now + 14000,
        });
        emitRadio(currentRoom, 'Tariq', `Dropped Signal Ping: ${label}`, 'info');
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'guide_safe_route') {
        const now = Date.now();
        if (now < snap.guideCooldowns.routeReadyAt) return;
        const toZone = String(msg.toZone || 'router') as ZoneId;
        const zDef = ZONES.find((z) => z.id === toZone);
        if (!zDef) return;
        snap.guideCooldowns.routeReadyAt = now + 5000;
        snap.safeRoutes.push({
          id: `route-${now}`,
          fromZone: snap.mina.zoneId,
          toZone,
          points: [
            { x: snap.mina.x, z: snap.mina.z },
            { x: CENTRAL_ROUTER_POS.x, z: CENTRAL_ROUTER_POS.z },
            { x: zDef.center.x, z: zDef.center.z },
          ],
          expiresAt: now + 10000,
        });
        emitRadio(currentRoom, 'Tariq', `Safe route highlighted toward ${zDef.shortName} (10s).`, 'info');
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'router_begin') {
        if (!snap.routerUnlocked) return;
        snap.phase = 'restoring';
        snap.routerSync = { active: true, minaStep: 0, guideStep: 0, completed: false };
        emitRadio(currentRoom, 'System', 'ROUTER RESTORATION STARTED — Both Runner and Guide must synchronize!', 'info');
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
        return;
      }

      if (type === 'router_step') {
        if (snap.phase !== 'restoring') return;
        if (slot.role === 'runner') {
          snap.routerSync.minaStep = Math.min(3, Math.max(snap.routerSync.minaStep, Number(msg.step) || 0));
        } else if (slot.role === 'guide') {
          snap.routerSync.guideStep = Math.min(3, Math.max(snap.routerSync.guideStep, Number(msg.step) || 0));
        }
        if (snap.routerSync.minaStep >= 3 && snap.routerSync.guideStep >= 3) {
          snap.routerSync.completed = true;
          snap.phase = 'cinematic';
          snap.restored = true;
          const count = snap.spirits.filter((s) => s.activated).length;
          snap.rating = calculateConnectionRating(count, snap.blackoutElapsed, true);
          emitRadio(currentRoom, 'System', 'CAMPUS CONNECTION RESTORED!', 'success');
        }
        broadcast(currentRoom, { type: 'state_sync', snapshot: snap });
      }
    });

    ws.on('close', () => {
      if (currentRoom && clientToken) {
        const slot = currentRoom.clients.get(clientToken);
        if (slot) slot.ws = null;
        updateConnectedRoles(currentRoom);
        broadcast(currentRoom, { type: 'state_sync', snapshot: currentRoom.snapshot });
      }
    });
  });

  // Authoritative 10Hz server loop for active multiplayer rooms
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      stepRoomSimulation(room, now);
    }
  }, 100);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`PING NINE server running on http://0.0.0.0:${port}`);
  });
}

startServer();
