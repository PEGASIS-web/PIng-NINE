import { CENTRAL_ROUTER_POS, SPIRITS, ZONES } from './worldData.ts';
import type { GameSnapshot, RadioMessage, ZoneId } from './types.ts';

export class SoloAIGuide {
  private lastPingAt = 0;
  private lastWarnAt = 0;
  private lastHintAt = 0;
  private lastRouteAt = 0;
  private routerSyncTimer = 0;

  public reset(): void {
    this.lastPingAt = 0;
    this.lastWarnAt = 0;
    this.lastHintAt = 0;
    this.lastRouteAt = 0;
    this.routerSyncTimer = 0;
  }

  public tick(
    snap: GameSnapshot,
    now: number,
    dt: number,
    pushRadio: (sender: 'Tariq' | 'System', text: string, tone: RadioMessage['tone']) => void
  ): void {
    // 1. Warn Mina when The Buffer closes in
    const distBuffer = Math.hypot(snap.mina.x - snap.buffer.x, snap.mina.z - snap.buffer.z);
    if (distBuffer < 11.5 && now - this.lastWarnAt > 8500) {
      this.lastWarnAt = now;
      const msg = snap.mina.onConnectionLine
        ? 'Buffer is nearby — stay on the Connection Line, it cannot cross!'
        : 'Watch out! The Buffer is closing in! Sprint toward an active Connection Line!';
      pushRadio('Tariq', msg, 'warning');
    }

    // 2. Periodically interpret a clue & drop a helpful Signal Ping toward next spirit or router
    if (snap.phase === 'playing' && now - this.lastPingAt > 15000) {
      this.lastPingAt = now;

      if (snap.routerUnlocked) {
        snap.pings.push({
          id: `ai-ping-${now}`,
          x: CENTRAL_ROUTER_POS.x,
          z: CENTRAL_ROUTER_POS.z,
          label: 'Return to Router',
          createdAt: now,
          expiresAt: now + 12000,
        });
        pushRadio('Tariq', 'Pinged the Central Router! Come synchronize the uplink!', 'success');
      } else {
        // Find closest inactive spirit (prefer discovered, or reveal a clue if >= 2 main done)
        const activeCount = snap.spirits.filter((s) => s.activated).length;
        let candidates = SPIRITS.filter((def) => {
          const st = snap.spirits.find((s) => s.id === def.id);
          return st && !st.activated && (st.discovered || activeCount >= 2);
        });
        if (candidates.length === 0) {
          candidates = SPIRITS.filter((def) => !snap.spirits.find((s) => s.id === def.id)?.activated);
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const da = Math.hypot(a.position.x - snap.mina.x, a.position.z - snap.mina.z);
            const db = Math.hypot(b.position.x - snap.mina.x, b.position.z - snap.mina.z);
            return da - db;
          });
          const target = candidates[0];
          const st = snap.spirits.find((s) => s.id === target.id);
          if (st && !st.discovered && !snap.scannedZones.includes(target.zoneId)) {
            snap.scannedZones.push(target.zoneId);
            st.discovered = true;
            pushRadio('Tariq', `Decoded hidden clue: ${target.clueText}`, 'info');
          } else {
            const pingTarget =
              target.type === 'relay' && !snap.mina.carryingPacketFor && target.packetStation
                ? { x: target.packetStation.x, z: target.packetStation.z, label: `Packet for ${target.name}` }
                : { x: target.position.x, z: target.position.z, label: target.name };

            snap.pings.push({
              id: `ai-ping-${now}`,
              x: pingTarget.x,
              z: pingTarget.z,
              label: pingTarget.label,
              createdAt: now,
              expiresAt: now + 12000,
            });
            if (now - this.lastHintAt > 20000) {
              this.lastHintAt = now;
              pushRadio('Tariq', `Signal Ping dropped at ${pingTarget.label}. ${target.discoveryHint}`, 'info');
            }
          }
        }
      }
    }

    // 3. Highlight safe route when carrying a Warm Packet
    if (snap.mina.carryingPacketFor && now - this.lastRouteAt > 11000) {
      this.lastRouteAt = now;
      const targetSpirit = SPIRITS.find((s) => s.id === snap.mina.carryingPacketFor);
      if (targetSpirit) {
        const zDef = ZONES.find((z) => z.id === targetSpirit.zoneId);
        if (zDef) {
          snap.safeRoutes.push({
            id: `ai-route-${now}`,
            fromZone: snap.mina.zoneId,
            toZone: targetSpirit.zoneId,
            points: [
              { x: snap.mina.x, z: snap.mina.z },
              { x: CENTRAL_ROUTER_POS.x, z: CENTRAL_ROUTER_POS.z },
              { x: targetSpirit.position.x, z: targetSpirit.position.z },
            ],
            expiresAt: now + 9500,
          });
          pushRadio('Tariq', `Safe packet route highlighted to ${zDef.shortName}!`, 'info');
        }
      }
    }

    // 4. Assist with Router Synchronization during Stage 3
    if (snap.phase === 'restoring' && snap.routerSync.active) {
      if (snap.routerSync.guideStep < snap.routerSync.minaStep) {
        this.routerSyncTimer += dt;
        if (this.routerSyncTimer >= 1.1) {
          this.routerSyncTimer = 0;
          snap.routerSync.guideStep = snap.routerSync.minaStep;
          pushRadio('Tariq', `Tariq synced conduit channel ${snap.routerSync.guideStep}/3!`, 'success');
        }
      } else {
        this.routerSyncTimer = 0;
      }
    }
  }
}
