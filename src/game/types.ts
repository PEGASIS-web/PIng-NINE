export type GameMode = 'solo' | 'coop';
export type PlayerRole = 'runner' | 'guide';
export type GamePhase = 'title' | 'lobby' | 'playing' | 'restoring' | 'cinematic' | 'ended';
export type SpiritType = 'beacon' | 'echo' | 'relay';
export type ZoneId = 'router' | 'quad' | 'library' | 'robotics' | 'canteen' | 'cloister' | 'observatory';

export type ConnectionRating =
  | '99.9% Uptime'
  | 'Last-Second Patch'
  | 'High Ping Survivor'
  | 'Request Timed Out';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SpiritDefinition {
  id: string;
  name: string;
  type: SpiritType;
  zoneId: ZoneId;
  zoneLabel: string;
  hidden: boolean;
  position: Vec3;
  clueText: string;
  discoveryHint: string;
  /** Polyline from spirit back to Central Router (0,0) following campus walkways */
  linePath: Vec2[];
  /** Beacon trail waypoints (for beacon type) */
  beaconTrail?: Vec3[];
  /** Echo 3-beat chime indices 0|1|2 (for echo type) */
  echoPattern?: [number, number, number];
  /** Relay packet pickup station position (for relay type) */
  packetStation?: Vec3;
}

export interface SpiritState {
  id: string;
  discovered: boolean;
  activated: boolean;
  /** Beacon trail progress index (0..5) */
  beaconProgress: number;
}

export interface SignalPing {
  id: string;
  x: number;
  z: number;
  label: string;
  createdAt: number;
  expiresAt: number;
}

export interface SafeRouteHighlight {
  id: string;
  fromZone: ZoneId;
  toZone: ZoneId;
  points: Vec2[];
  expiresAt: number;
}

export interface RadioMessage {
  id: string;
  sender: 'Tariq' | 'System';
  text: string;
  tone: 'info' | 'warning' | 'success';
  timestamp: number;
}

export interface MinaNetState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  carryingPacketFor: string | null;
  packetIntegrity: number;
  onConnectionLine: boolean;
  inBuilding: boolean;
  zoneId: ZoneId;
}

export interface BufferNetState {
  x: number;
  z: number;
  yaw: number;
  aggro: boolean;
  intensity: number;
  scaredUntil: number;
}

export interface RepelStationDefinition {
  id: string;
  label: string;
  position: Vec3;
}

export interface RouterSyncState {
  active: boolean;
  /** 0..3 phases completed by Mina */
  minaStep: number;
  /** 0..3 phases synchronized by Guide */
  guideStep: number;
  /** True when both completed all 3 phases */
  completed: boolean;
}

export interface CooldownState {
  scanReadyAt: number;
  pingReadyAt: number;
  routeReadyAt: number;
}

export interface GameSnapshot {
  roomCode?: string;
  mode: GameMode;
  phase: GamePhase;
  /** Remaining seconds until 9:00 AM (starts at 120, hits 0 at 9:00 AM) */
  remainingSeconds: number;
  /** Seconds elapsed past 9:00 AM during final-chance blackout phase (0..15) */
  blackoutElapsed: number;
  /** 15s final-chance grace duration */
  blackoutGraceDuration: number;
  /** True when >= 6 spirits OR (>= 4 spirits during 9:00 blackout override) */
  routerUnlocked: boolean;
  /** True once 6/6 notification fired */
  allSixNotified: boolean;
  restored: boolean;
  rating: ConnectionRating | null;
  spirits: SpiritState[];
  /** Hidden or clue-discovered flags from Guide scanning */
  scannedZones: ZoneId[];
  /** Breaker / environmental clues solved in hidden areas */
  unlockedSecrets: string[];
  /** Per-station cooldown timestamps (ms) for Buffer-repel Signal Stations */
  stationCooldowns: Record<string, number>;
  mina: MinaNetState;
  buffer: BufferNetState;
  pings: SignalPing[];
  safeRoutes: SafeRouteHighlight[];
  routerSync: RouterSyncState;
  guideCooldowns: CooldownState;
  connectedRoles: { runner: boolean; guide: boolean };
}

export interface BoxCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  label?: string;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  shortName: string;
  center: Vec2;
  radius: number;
  indoor: boolean;
  hidden: boolean;
  color: string;
  description: string;
}
