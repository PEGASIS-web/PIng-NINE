import type {
  BoxCollider,
  ConnectionRating,
  RepelStationDefinition,
  SpiritDefinition,
  SpiritState,
  Vec2,
  ZoneDefinition,
  ZoneId,
} from './types.ts';

export const GAME_DURATION_SECONDS = 120; // 8:58:00 -> 9:00:00 (2 minutes)
export const BLACKOUT_GRACE_SECONDS = 15; // Short final-chance window at 9:00 AM
export const CAMPUS_BOUNDARY = 52;

export const CENTRAL_ROUTER_POS = { x: 0, y: 0.35, z: 0 };
export const MINA_SPAWN_POS = { x: 0, y: 0.35, z: 9.5 };

export const ZONES: ZoneDefinition[] = [
  {
    id: 'router',
    name: 'Central Router Plaza',
    shortName: 'Router Core',
    center: { x: 0, z: 0 },
    radius: 11,
    indoor: false,
    hidden: false,
    color: '#38bdf8',
    description: 'The campus network heart. Connect the 6 spirit conduits here.',
  },
  {
    id: 'quad',
    name: 'Main Quad Fountain',
    shortName: 'Main Quad',
    center: { x: 0, z: 26 },
    radius: 12,
    indoor: false,
    hidden: false,
    color: '#fbbf24',
    description: 'Warm dusk plaza around the glowing stone fountain.',
  },
  {
    id: 'library',
    name: 'Quiet Stacks — Library',
    shortName: 'Quiet Stacks',
    center: { x: -32, z: -8 },
    radius: 13,
    indoor: true,
    hidden: false,
    color: '#a78bfa',
    description: 'Brick reading hall filled with silent bookshelves and flickering lamps.',
  },
  {
    id: 'robotics',
    name: 'Robotics Lab B',
    shortName: 'Robotics Lab',
    center: { x: 32, z: -8 },
    radius: 13,
    indoor: true,
    hidden: false,
    color: '#34d399',
    description: 'High-tech assembly bay tangled with damaged cables and servo rigs.',
  },
  {
    id: 'canteen',
    name: 'Canteen Terrace',
    shortName: 'Canteen',
    center: { x: 0, z: -34 },
    radius: 13,
    indoor: false,
    hidden: false,
    color: '#fb7185',
    description: 'Elevated brick café patio with string lights and a kiosk alcove.',
  },
  {
    id: 'cloister',
    name: 'Sunken Cloister Vault',
    shortName: 'Cloister Vault',
    center: { x: -30, z: 28 },
    radius: 10,
    indoor: true,
    hidden: true,
    color: '#f59e0b',
    description: 'Hidden underpass beneath the ivy brick wall, sealed behind an old breaker.',
  },
  {
    id: 'observatory',
    name: 'Observatory Roof Deck',
    shortName: 'Observatory',
    center: { x: 30, z: 28 },
    radius: 10,
    indoor: false,
    hidden: true,
    color: '#22d3ee',
    description: 'Elevated annex deck overlooking the southeast quad.',
  },
];

export const SPIRITS: SpiritDefinition[] = [
  {
    id: 'spirit-quad-beacon',
    name: 'Quad Beacon',
    type: 'beacon',
    zoneId: 'quad',
    zoneLabel: 'Main Quad Fountain',
    hidden: false,
    position: { x: 0, y: 0.35, z: 20.5 },
    clueText: 'A golden signal pulses beside the Main Quad Fountain.',
    discoveryHint: 'Circle the stone fountain following the glowing trail.',
    linePath: [
      { x: 0, z: 20.5 },
      { x: 0, z: 12 },
      { x: 0, z: 0 },
    ],
    beaconTrail: [
      { x: 5.5, y: 0.2, z: 23.5 },
      { x: 6.2, y: 0.2, z: 29.0 },
      { x: 0.0, y: 0.2, z: 32.8 },
      { x: -6.2, y: 0.2, z: 29.0 },
      { x: -5.2, y: 0.2, z: 23.2 },
    ],
  },
  {
    id: 'spirit-library-echo',
    name: 'Stacks Echo',
    type: 'echo',
    zoneId: 'library',
    zoneLabel: 'Quiet Stacks — Library',
    hidden: false,
    position: { x: -33.5, y: 0.25, z: -8 },
    clueText: 'Faint three-note chimes resonate deep inside Quiet Stacks.',
    discoveryHint: 'Enter the brick Library on the west side and match the 3-beat chime.',
    linePath: [
      { x: -33.5, z: -8 },
      { x: -21, z: -8 },
      { x: -12, z: -4 },
      { x: 0, z: 0 },
    ],
    echoPattern: [0, 2, 1],
  },
  {
    id: 'spirit-robotics-relay',
    name: 'Lab B Relay',
    type: 'relay',
    zoneId: 'robotics',
    zoneLabel: 'Robotics Lab B',
    hidden: false,
    position: { x: 33.5, y: 0.25, z: -8 },
    clueText: 'Robotics Lab B needs an intact Warm Packet from the East Quad Dock.',
    discoveryHint: 'Grab a Warm Packet at the East Charging Dock (x:15, z:5) and avoid corrupted floor patches.',
    linePath: [
      { x: 33.5, z: -8 },
      { x: 21, z: -8 },
      { x: 12, z: -4 },
      { x: 0, z: 0 },
    ],
    packetStation: { x: 15, y: 0.15, z: 5 },
  },
  {
    id: 'spirit-canteen-relay',
    name: 'Terrace Relay',
    type: 'relay',
    zoneId: 'canteen',
    zoneLabel: 'Canteen Terrace',
    hidden: false,
    position: { x: 0, y: 0.85, z: -34.5 },
    clueText: 'A hungry Relay node waits atop the Canteen Terrace.',
    discoveryHint: 'Collect a Warm Packet at the West Quad Kiosk (x:-15, z:5) and carry it north past the corruption.',
    linePath: [
      { x: 0, z: -34.5 },
      { x: 0, z: -22 },
      { x: 0, z: -11 },
      { x: 0, z: 0 },
    ],
    packetStation: { x: -15, y: 0.15, z: 5 },
  },
  {
    id: 'spirit-cloister-beacon',
    name: 'Vault Beacon',
    type: 'beacon',
    zoneId: 'cloister',
    zoneLabel: 'Sunken Cloister Vault (Hidden)',
    hidden: true,
    position: { x: -30.5, y: -0.6, z: 28.5 },
    clueText: 'Hidden signal detected behind the southwest ivy archway — look for a Breaker Switch.',
    discoveryHint: 'Flip the Cloister Maintenance Breaker at (-19, 20) to unseal the sunken vault path.',
    linePath: [
      { x: -30.5, z: 28.5 },
      { x: -20, z: 20 },
      { x: -10, z: 10 },
      { x: 0, z: 0 },
    ],
    beaconTrail: [
      { x: -26.5, y: -0.6, z: 25.0 },
      { x: -26.0, y: -0.6, z: 32.0 },
      { x: -31.5, y: -0.6, z: 33.5 },
      { x: -34.5, y: -0.6, z: 28.0 },
      { x: -31.5, y: -0.6, z: 24.0 },
    ],
  },
  {
    id: 'spirit-observatory-echo',
    name: 'Spire Echo',
    type: 'echo',
    zoneId: 'observatory',
    zoneLabel: 'Observatory Roof Deck (Hidden)',
    hidden: true,
    position: { x: 30.5, y: 2.6, z: 29.0 },
    clueText: 'An upper-tier harmonic echo radiates from the southeast Transformer Annex ramp.',
    discoveryHint: 'Unlock the Annex Relay Console at (18.5, 20) and climb the stone ramp to the roof deck.',
    linePath: [
      { x: 30.5, z: 29.0 },
      { x: 20, z: 20 },
      { x: 10, z: 10 },
      { x: 0, z: 0 },
    ],
    echoPattern: [2, 0, 2],
  },
];

export const SECRET_SWITCHES = [
  {
    id: 'cloister-breaker',
    label: 'Cloister Breaker Switch',
    targetSpiritId: 'spirit-cloister-beacon',
    position: { x: -19, y: 0.15, z: 20 },
  },
  {
    id: 'observatory-console',
    label: 'Annex Uplift Console',
    targetSpiritId: 'spirit-observatory-echo',
    position: { x: 18.5, y: 0.15, z: 20 },
  },
];

export const REPEL_STATIONS: RepelStationDefinition[] = [
  { id: 'station-quad-w', label: 'West Quad Signal Station', position: { x: -11.5, y: 0, z: 20 } },
  { id: 'station-quad-e', label: 'East Quad Signal Station', position: { x: 11.5, y: 0, z: 20 } },
  { id: 'station-lib', label: 'Library Steps Signal Station', position: { x: -20.5, y: 0, z: -2 } },
  { id: 'station-lab', label: 'Robotics Plaza Signal Station', position: { x: 20.5, y: 0, z: -2 } },
  { id: 'station-north', label: 'Canteen Approach Signal Station', position: { x: 0, y: 0, z: -20.5 } },
];

export const STATION_COOLDOWN_MS = 14000;
export const BUFFER_SCARE_DURATION_MS = 5500;

/** Static corrupted floor zones that drain Warm Packets and slow Mina */
export const CORRUPTION_ZONES: Array<{ x: number; z: number; radius: number }> = [
  { x: 21, z: -3.5, radius: 3.1 },
  { x: 24, z: -12, radius: 2.8 },
  { x: -6, z: -21, radius: 3.0 },
  { x: 6, z: -24, radius: 3.0 },
  { x: -19, z: -12, radius: 2.7 },
  { x: 12, z: 14, radius: 2.5 },
];

/** Wall & obstacle colliders (world-space AABBs) */
export const WORLD_COLLIDERS: BoxCollider[] = [
  // Central Router Pedestal core
  { id: 'router-core', minX: -2.0, maxX: 2.0, minZ: -2.0, maxZ: 2.0, maxY: 12 },

  // Main Quad Fountain basin
  { id: 'fountain-basin', minX: -3.1, maxX: 3.1, minZ: 23.4, maxZ: 29.6, maxY: 4 },

  // Quiet Stacks Library (x: -41..-24, z: -17..1) — doorway facing East (x = -24, z: -10.5..-5.5 open!)
  { id: 'lib-west', minX: -41.5, maxX: -40.2, minZ: -17.5, maxZ: 1.5, maxY: 9 },
  { id: 'lib-north', minX: -41.5, maxX: -24.0, minZ: -17.5, maxZ: -16.2, maxY: 9 },
  { id: 'lib-south', minX: -41.5, maxX: -24.0, minZ: 0.2, maxZ: 1.5, maxY: 9 },
  { id: 'lib-east-n', minX: -25.2, maxX: -24.0, minZ: -17.5, maxZ: -10.6, maxY: 9 },
  { id: 'lib-east-s', minX: -25.2, maxX: -24.0, minZ: -5.4, maxZ: 1.5, maxY: 9 },
  // Library interior bookshelves
  { id: 'lib-shelf-1', minX: -37.5, maxX: -34.5, minZ: -14.2, maxZ: -12.6, maxY: 3.5 },
  { id: 'lib-shelf-2', minX: -37.5, maxX: -34.5, minZ: -3.4, maxZ: -1.8, maxY: 3.5 },
  { id: 'lib-desk-1', minX: -31.0, maxX: -28.0, minZ: -14.0, maxZ: -12.0, maxY: 1.5 },

  // Robotics Lab B (x: 24..41.5, z: -17.5..1.5) — doorway facing West (x = 24, z: -10.5..-5.5 open!)
  { id: 'lab-east', minX: 40.2, maxX: 41.5, minZ: -17.5, maxZ: 1.5, maxY: 9 },
  { id: 'lab-north', minX: 24.0, maxX: 41.5, minZ: -17.5, maxZ: -16.2, maxY: 9 },
  { id: 'lab-south', minX: 24.0, maxX: 41.5, minZ: 0.2, maxZ: 1.5, maxY: 9 },
  { id: 'lab-west-n', minX: 24.0, maxX: 25.2, minZ: -17.5, maxZ: -10.6, maxY: 9 },
  { id: 'lab-west-s', minX: 24.0, maxX: 25.2, minZ: -5.4, maxZ: 1.5, maxY: 9 },
  // Lab interior benches
  { id: 'lab-bench-1', minX: 29.0, maxX: 32.0, minZ: -14.5, maxZ: -12.5, maxY: 2.0 },
  { id: 'lab-bench-2', minX: 35.5, maxX: 38.5, minZ: -4.0, maxZ: -2.0, maxY: 2.0 },

  // Canteen Terrace back kiosk wall & counters
  { id: 'canteen-kiosk', minX: -7.5, maxX: 7.5, minZ: -42.5, maxZ: -39.5, maxY: 5 },
  { id: 'canteen-pillar-w', minX: -9.5, maxX: -8.3, minZ: -30.5, maxZ: -29.3, maxY: 5 },
  { id: 'canteen-pillar-e', minX: 8.3, maxX: 9.5, minZ: -30.5, maxZ: -29.3, maxY: 5 },

  // Cloister Vault exterior walls (opening at NE corner x: -26..-22, z: 22..25)
  { id: 'cloister-w', minX: -37.5, maxX: -36.2, minZ: 21.0, maxZ: 36.5, maxY: 6 },
  { id: 'cloister-s', minX: -37.5, maxX: -22.5, minZ: 35.2, maxZ: 36.5, maxY: 6 },
  { id: 'cloister-n', minX: -37.5, maxX: -27.0, minZ: 21.0, maxZ: 22.3, maxY: 6 },
  { id: 'cloister-e', minX: -23.8, maxX: -22.5, minZ: 26.5, maxZ: 36.5, maxY: 6 },

  // Observatory Annex lower wall (south/east perimeter, ramp is on West side x: 20..26, z: 24..28)
  { id: 'obs-east', minX: 36.2, maxX: 37.5, minZ: 21.5, maxZ: 36.0, maxY: 8 },
  { id: 'obs-south', minX: 25.0, maxX: 37.5, minZ: 34.8, maxZ: 36.0, maxY: 8 },
  { id: 'obs-north', minX: 25.0, maxX: 37.5, minZ: 21.5, maxZ: 22.8, maxY: 8 },

  // --- NEW BUILDING SETS FILLING EMPTY QUADRANTS ---
  // North-West Alder Lecture Hall (x: -36..-21, z: -39..-26)
  { id: 'alder-hall', minX: -36.5, maxX: -21.5, minZ: -39.0, maxZ: -27.0, maxY: 11 },
  // North-East Turing Engineering Annex (x: 21..36, z: -39..-27)
  { id: 'turing-annex', minX: 21.5, maxX: 36.5, minZ: -39.0, maxZ: -27.0, maxY: 11 },
  // West & East Quad Brick Colonnade Pillars
  { id: 'quad-col-w1', minX: -16.8, maxX: -15.4, minZ: 17.2, maxZ: 18.6, maxY: 5 },
  { id: 'quad-col-w2', minX: -16.8, maxX: -15.4, minZ: 25.4, maxZ: 26.8, maxY: 5 },
  { id: 'quad-col-e1', minX: 15.4, maxX: 16.8, minZ: 17.2, maxZ: 18.6, maxY: 5 },
  { id: 'quad-col-e2', minX: 15.4, maxX: 16.8, minZ: 25.4, maxZ: 26.8, maxY: 5 },
  // South Campus Gatehouse Twin Brick Towers
  { id: 'gate-west', minX: -7.5, maxX: -4.2, minZ: 41.5, maxZ: 45.0, maxY: 9 },
  { id: 'gate-east', minX: 4.2, maxX: 7.5, minZ: 41.5, maxZ: 45.0, maxY: 9 },
  // Mid-Campus Courtyard Planters & Directory Kiosks
  { id: 'planter-nw', minX: -16.2, maxX: -12.8, minZ: -19.8, maxZ: -16.4, maxY: 2 },
  { id: 'planter-ne', minX: 12.8, maxX: 16.2, minZ: -19.8, maxZ: -16.4, maxY: 2 },
  { id: 'kiosk-sw', minX: -14.2, maxX: -12.0, minZ: 7.2, maxZ: 9.2, maxY: 3 },
  { id: 'kiosk-se', minX: 12.0, maxX: 14.2, minZ: 7.2, maxZ: 9.2, maxY: 3 },
];

export function getGroundHeightAt(x: number, z: number): number {
  // Central Router octagonal plaza (radius 7.5)
  const rDist = Math.hypot(x, z);
  if (rDist < 7.5) {
    return rDist < 5.5 ? 0.35 : 0.18;
  }

  // Main Quad Plaza (around 0, 26.5)
  const qDist = Math.hypot(x, z - 26.5);
  if (qDist < 9.5) {
    return 0.15;
  }

  // Library interior floor
  if (x >= -41 && x <= -24 && z >= -17 && z <= 1) {
    return 0.25;
  }

  // Robotics Lab interior floor
  if (x >= 24 && x <= 41 && z >= -17 && z <= 1) {
    return 0.25;
  }

  // Canteen Terrace raised deck (x: -10..10, z: -41..-28) with south steps (-28..-26)
  if (x >= -10 && x <= 10 && z >= -41 && z <= -28) {
    return 0.85;
  }
  if (x >= -4.5 && x <= 4.5 && z > -28 && z <= -25.5) {
    const t = (-25.5 - z) / 2.5;
    return Math.max(0, Math.min(0.85, t * 0.85));
  }

  // Sunken Cloister Vault (x: -37..-23, z: 21.5..36)
  if (x >= -37 && x <= -23 && z >= 21.5 && z <= 36) {
    return -0.6;
  }
  // Cloister ramp entrance
  if (x >= -26 && x <= -21.5 && z >= 21 && z <= 25.5) {
    const t = Math.max(0, Math.min(1, (-21.5 - x) / 4.5));
    return -0.6 * t;
  }

  // Observatory Roof Deck (x: 26..36.5, z: 22.5..35) -> y = 2.6
  if (x >= 26 && x <= 36.5 && z >= 22.5 && z <= 35) {
    return 2.6;
  }
  // Observatory ramp (x: 19.5..26, z: 24.5..29.5)
  if (x >= 19.5 && x < 26 && z >= 24.5 && z <= 29.5) {
    const t = Math.max(0, Math.min(1, (x - 19.5) / 6.5));
    return t * 2.6;
  }

  return 0;
}

export function getZoneAt(x: number, z: number): ZoneId {
  for (const zone of ZONES) {
    if (zone.id === 'router') continue;
    const d = Math.hypot(x - zone.center.x, z - zone.center.z);
    if (d <= zone.radius) {
      return zone.id;
    }
  }
  return 'router';
}

export function isInsideBuilding(x: number, z: number): boolean {
  const inLib = x >= -41 && x <= -24.2 && z >= -17 && z <= 1;
  const inLab = x >= 24.2 && x <= 41 && z >= -17 && z <= 1;
  const inCloister = x >= -37 && x <= -23.2 && z >= 21.5 && z <= 35.8;
  return inLib || inLab || inCloister;
}

export function isApproachingBuilding(x: number, z: number): boolean {
  if (isInsideBuilding(x, z)) return false;
  const dLib = Math.hypot(x - -24, z - -8);
  const dLab = Math.hypot(x - 24, z - -8);
  const dCloister = Math.hypot(x - -24, z - 24);
  return dLib < 8 || dLab < 8 || dCloister < 7;
}

export function distToSegment2D(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const projX = ax + t * dx;
  const projZ = az + t * dz;
  return Math.hypot(px - projX, pz - projZ);
}

export function distanceToActiveConnectionLines(
  x: number,
  z: number,
  spirits: SpiritState[]
): number {
  let minDist = Infinity;
  for (let i = 0; i < SPIRITS.length; i++) {
    if (!spirits[i]?.activated) continue;
    const pts = SPIRITS[i].linePath;
    for (let j = 0; j < pts.length - 1; j++) {
      const d = distToSegment2D(x, z, pts[j].x, pts[j].z, pts[j + 1].x, pts[j + 1].z);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

/** Check if moving from (x1,z1) to (x2,z2) crosses or gets too close to any active Connection Line */
export function isBlockedByActiveLines(
  x: number,
  z: number,
  spirits: SpiritState[],
  clearance = 1.65
): boolean {
  // Never trap Buffer inside the tiny router center; allow pushing outward from (0,0)
  return distanceToActiveConnectionLines(x, z, spirits) < clearance;
}

export function calculateConnectionRating(
  activatedCount: number,
  blackoutElapsed: number,
  restored: boolean
): ConnectionRating {
  if (!restored) return 'Request Timed Out';
  if (activatedCount >= 6 && blackoutElapsed <= 0) return '99.9% Uptime';
  if (activatedCount >= 5 || (activatedCount === 6 && blackoutElapsed > 0)) return 'Last-Second Patch';
  return 'High Ping Survivor';
}

export function createInitialSpirits(): SpiritState[] {
  return SPIRITS.map((s) => ({
    id: s.id,
    discovered: !s.hidden,
    activated: false,
    beaconProgress: 0,
  }));
}

export function formatCampusClock(remainingSeconds: number, blackoutElapsed: number): string {
  if (remainingSeconds > 0) {
    const elapsed = Math.max(0, GAME_DURATION_SECONDS - remainingSeconds);
    const totalSec = Math.floor(elapsed);
    const mins = 58 + Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hour = mins >= 60 ? '09' : '08';
    const displayMin = String(mins % 60).padStart(2, '0');
    const displaySec = String(secs).padStart(2, '0');
    return `${hour}:${displayMin}:${displaySec} AM`;
  }
  const extra = Math.min(BLACKOUT_GRACE_SECONDS, Math.floor(blackoutElapsed));
  return `09:00:${String(extra).padStart(2, '0')} AM`;
}
