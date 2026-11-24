import { useCallback, useEffect, useRef, useState } from 'react';
import { EndingScreen } from './components/EndingScreen.tsx';
import { EchoPuzzleModal } from './components/EchoPuzzleModal.tsx';
import { GameHUD } from './components/GameHUD.tsx';
import { GuideMapModal } from './components/GuideMapModal.tsx';
import { PauseModal } from './components/PauseModal.tsx';
import { RouterRestoreModal } from './components/RouterRestoreModal.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { SoloAIGuide } from './game/aiGuide.ts';
import { audioEngine } from './game/audio.ts';
import { PingNineNetwork } from './game/network.ts';
import { PingNineEngine, type EngineUIState } from './game/PingNineEngine.ts';
import {
  BLACKOUT_GRACE_SECONDS,
  CENTRAL_ROUTER_POS,
  GAME_DURATION_SECONDS,
  MINA_SPAWN_POS,
  SPIRITS,
  ZONES,
  createInitialSpirits,
} from './game/worldData.ts';
import type {
  GameSnapshot,
  PlayerRole,
  RadioMessage,
  SpiritDefinition,
  ZoneId,
} from './game/types.ts';

function buildFreshSoloSnapshot(): GameSnapshot {
  return {
    mode: 'solo',
    phase: 'playing',
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
    connectedRoles: { runner: true, guide: true },
  };
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PingNineEngine | null>(null);
  const netRef = useRef<PingNineNetwork | null>(null);
  const aiGuideRef = useRef<SoloAIGuide>(new SoloAIGuide());

  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [role, setRole] = useState<PlayerRole>('runner');
  const [muted, setMuted] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [activeEcho, setActiveEcho] = useState<SpiritDefinition | null>(null);
  const [routerModalOpen, setRouterModalOpen] = useState(false);
  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([]);
  const [uiState, setUiState] = useState<EngineUIState>({
    prompt: null,
    activeBeaconId: null,
    activeEchoSpirit: null,
    bufferProximity: 0,
    inCorruption: false,
  });

  const pushRadio = useCallback(
    (sender: 'Tariq' | 'System', text: string, tone: RadioMessage['tone']) => {
      setRadioMessages((prev) => [
        ...prev.slice(-4),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender,
          text,
          tone,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  // Initialize WebSocket network listener for Online Co-op
  useEffect(() => {
    const net = new PingNineNetwork();
    netRef.current = net;
    net.connect({
      onConnectionChange: setWsConnected,
      onError: (msg) => setErrorText(msg),
      onRoleUpdated: (nextRole) => setRole(nextRole),
      onRadio: (msg) => {
        setRadioMessages((prev) => [...prev.slice(-4), msg]);
      },
      onJoined: ({ role: assignedRole, snapshot: snap }) => {
        setErrorText(null);
        setRole(assignedRole);
        setSnapshot(snap);
      },
      onStateSync: (nextSnap) => {
        setSnapshot(nextSnap);
        engineRef.current?.applyServerSnapshot(nextSnap);
        if (nextSnap.phase === 'cinematic' || nextSnap.phase === 'ended') {
          setRouterModalOpen(false);
          setActiveEcho(null);
          setMapOpen(false);
        }
      },
    });
    return () => net.disconnect();
  }, []);

  // Mount / Teardown Three.js 3D Engine when playing as Runner
  const shouldRun3D =
    snapshot !== null &&
    role === 'runner' &&
    (snapshot.phase === 'playing' ||
      snapshot.phase === 'restoring' ||
      snapshot.phase === 'cinematic' ||
      snapshot.phase === 'ended');

  useEffect(() => {
    if (!shouldRun3D || !mountRef.current || !snapshot) {
      return;
    }
    if (engineRef.current) return;

    const engine = new PingNineEngine(mountRef.current, snapshot, role, {
      onSnapshot: (nextSnap) => setSnapshot(nextSnap),
      onUIUpdate: (ui) => setUiState(ui),
      onRadio: (msg) => setRadioMessages((prev) => [...prev.slice(-4), msg]),
      onOpenEchoPuzzle: (spirit) => {
        setActiveEcho(spirit);
        engineRef.current?.setPaused(true);
      },
      onOpenRouterPuzzle: () => {
        setRouterModalOpen(true);
        engineRef.current?.setPaused(true);
      },
      onOpenMapToggle: () => {
        setMapOpen((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
      },
      onPauseToggle: () => {
        if (activeEcho) {
          setActiveEcho(null);
          engineRef.current?.setPaused(false);
          return;
        }
        setPaused((prev) => {
          const next = !prev;
          engineRef.current?.setPaused(next);
          return next;
        });
      },
      onSendAction: (payload) => {
        netRef.current?.send(payload);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRun3D, role]);

  // Solo Mode AI Guide loop (runs cleanly at 4Hz alongside engine)
  useEffect(() => {
    if (!snapshot || snapshot.mode !== 'solo') return;
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'restoring') return;
    if (paused) return;

    const id = window.setInterval(() => {
      const eng = engineRef.current;
      if (!eng) return;
      const snap = eng.getSnapshot();
      aiGuideRef.current.tick(snap, Date.now(), 0.25, pushRadio);
    }, 250);

    return () => clearInterval(id);
  }, [snapshot?.mode, snapshot?.phase, paused, pushRadio]);

  const handleToggleMute = () => {
    audioEngine.init();
    const next = !muted;
    setMuted(next);
    audioEngine.setMuted(next);
  };

  const handleStartSolo = () => {
    audioEngine.init();
    audioEngine.stopVictoryMusic();
    aiGuideRef.current.reset();
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    const fresh = buildFreshSoloSnapshot();
    setRole('runner');
    setPaused(false);
    setMapOpen(false);
    setActiveEcho(null);
    setRouterModalOpen(false);
    setRadioMessages([]);
    setSnapshot(fresh);
    pushRadio('Tariq', '8:58 AM — Campus network failing! Awaken 6 spirits before 9:00 AM!', 'info');
  };

  const handleRestart = () => {
    if (!snapshot) return;
    audioEngine.init();
    audioEngine.stopVictoryMusic();
    if (snapshot.mode === 'solo') {
      handleStartSolo();
    } else {
      setPaused(false);
      setMapOpen(false);
      setActiveEcho(null);
      setRouterModalOpen(false);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      netRef.current?.restartGame();
    }
  };

  const handleReturnTitle = () => {
    audioEngine.stopVictoryMusic();
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    if (snapshot?.mode === 'coop') {
      netRef.current?.disconnect();
      netRef.current?.connect({
        onConnectionChange: setWsConnected,
        onError: (msg) => setErrorText(msg),
        onRoleUpdated: (nextRole) => setRole(nextRole),
        onRadio: (msg) => setRadioMessages((prev) => [...prev.slice(-4), msg]),
        onJoined: ({ role: assignedRole, snapshot: snap }) => {
          setErrorText(null);
          setRole(assignedRole);
          setSnapshot(snap);
        },
        onStateSync: (nextSnap) => {
          setSnapshot(nextSnap);
          engineRef.current?.applyServerSnapshot(nextSnap);
        },
      });
    }
    setSnapshot(null);
    setPaused(false);
    setMapOpen(false);
    setActiveEcho(null);
    setRouterModalOpen(false);
    setRadioMessages([]);
  };

  // Guide interactive actions (both Co-op over WS & Solo local state)
  const handleScanZone = (zoneId: ZoneId) => {
    if (!snapshot) return;
    if (snapshot.mode === 'coop') {
      netRef.current?.sendZoneScan(zoneId);
      return;
    }
    const now = Date.now();
    if (now < snapshot.guideCooldowns.scanReadyAt) return;
    const eng = engineRef.current;
    if (!eng) return;
    const live = eng.getSnapshot();
    live.guideCooldowns.scanReadyAt = now + 4000;
    if (!live.scannedZones.includes(zoneId)) live.scannedZones.push(zoneId);
    const sp = SPIRITS.find((s) => s.zoneId === zoneId);
    const st = sp ? live.spirits.find((s) => s.id === sp.id) : null;
    if (sp && st) {
      st.discovered = true;
      pushRadio('Tariq', `Scan clue (${sp.zoneLabel}): ${sp.clueText}`, 'info');
    }
    setSnapshot(structuredClone(live));
  };

  const handleDropPing = (x: number, z: number, label: string) => {
    if (!snapshot) return;
    audioEngine.playPing();
    if (snapshot.mode === 'coop') {
      netRef.current?.sendPing(x, z, label);
      return;
    }
    const now = Date.now();
    const eng = engineRef.current;
    if (!eng || now < snapshot.guideCooldowns.pingReadyAt) return;
    const live = eng.getSnapshot();
    live.guideCooldowns.pingReadyAt = now + 2500;
    live.pings.push({ id: `ping-${now}`, x, z, label, createdAt: now, expiresAt: now + 14000 });
    setSnapshot(structuredClone(live));
  };

  const handleHighlightRoute = (toZone: ZoneId) => {
    if (!snapshot) return;
    if (snapshot.mode === 'coop') {
      netRef.current?.sendSafeRoute(toZone);
      return;
    }
    const now = Date.now();
    const eng = engineRef.current;
    const zDef = ZONES.find((z) => z.id === toZone);
    if (!eng || !zDef || now < snapshot.guideCooldowns.routeReadyAt) return;
    const live = eng.getSnapshot();
    live.guideCooldowns.routeReadyAt = now + 5000;
    live.safeRoutes.push({
      id: `route-${now}`,
      fromZone: live.mina.zoneId,
      toZone,
      points: [
        { x: live.mina.x, z: live.mina.z },
        { x: CENTRAL_ROUTER_POS.x, z: CENTRAL_ROUTER_POS.z },
        { x: zDef.center.x, z: zDef.center.z },
      ],
      expiresAt: now + 10000,
    });
    setSnapshot(structuredClone(live));
  };

  // Title / Lobby screen
  if (!snapshot || snapshot.phase === 'lobby') {
    return (
      <TitleScreen
        muted={muted}
        onToggleMute={handleToggleMute}
        onStartSolo={handleStartSolo}
        onCreateRoom={(r) => {
          audioEngine.init();
          netRef.current?.createRoom(r);
        }}
        onJoinRoom={(code, r) => {
          audioEngine.init();
          netRef.current?.joinRoom(code, r);
        }}
        onSelectRole={(r) => netRef.current?.selectRole(r)}
        onStartCoop={() => {
          audioEngine.init();
          netRef.current?.startGame();
        }}
        onLeaveLobby={handleReturnTitle}
        lobbySnapshot={snapshot}
        myRole={role}
        wsConnected={wsConnected}
        errorText={errorText}
      />
    );
  }

  // Player 2 (Online Co-op Guide) Full-Screen Network Map Interface
  if (role === 'guide' && snapshot.mode === 'coop') {
    return (
      <div className="w-full h-full relative">
        <GuideMapModal
          snapshot={snapshot}
          role="guide"
          fullScreen
          onScanZone={handleScanZone}
          onDropPing={handleDropPing}
          onHighlightRoute={handleHighlightRoute}
          onGuideRouterStep={(step) => {
            audioEngine.playRouterPhase(step);
            netRef.current?.send({ type: 'router_step', step });
          }}
        />
        {snapshot.phase === 'ended' && (
          <EndingScreen
            snapshot={snapshot}
            onRestart={handleRestart}
            onReturnTitle={handleReturnTitle}
          />
        )}
      </div>
    );
  }

  // Runner (Mina) 3D Viewport + Semantic HUD Overlays
  const activatedCount = snapshot.spirits.filter((s) => s.activated).length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0e0b16]">
      {/* Isolated WebGL Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Game HUD */}
      {snapshot.phase !== 'ended' && (
        <GameHUD
          snapshot={snapshot}
          uiState={uiState}
          radioMessages={radioMessages}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenMap={() => {
            setMapOpen(true);
            engineRef.current?.setPaused(true);
          }}
          onPause={() => {
            setPaused(true);
            engineRef.current?.setPaused(true);
          }}
          onTriggerInteract={() => engineRef.current?.triggerInteract()}
        />
      )}

      {/* Echo 3-Beat Rhythm Modal */}
      {activeEcho && (
        <EchoPuzzleModal
          spirit={activeEcho}
          onFlashPylon={(id, idx) => engineRef.current?.setEchoFlash(id, idx)}
          onSuccess={(id) => {
            engineRef.current?.completeEchoPuzzle(id);
            setActiveEcho(null);
            engineRef.current?.setPaused(false);
          }}
          onClose={() => {
            setActiveEcho(null);
            engineRef.current?.setPaused(false);
          }}
        />
      )}

      {/* Stage 3 Dedicated Router Restoration Sequence */}
      {routerModalOpen && snapshot.phase === 'restoring' && (
        <RouterRestoreModal
          mode={snapshot.mode}
          routerSync={snapshot.routerSync}
          activatedCount={activatedCount}
          onMinaStep={(step) => {
            engineRef.current?.completeSoloRouterStep(step);
            if (step >= 3 && snapshot.mode === 'solo') {
              setRouterModalOpen(false);
              engineRef.current?.setPaused(false);
            }
          }}
        />
      )}

      {/* Tactical Guide Map Tablet Overlay ([M]) */}
      {mapOpen && snapshot.phase === 'playing' && (
        <GuideMapModal
          snapshot={snapshot}
          role={role}
          fullScreen={false}
          onClose={() => {
            setMapOpen(false);
            engineRef.current?.setPaused(false);
          }}
          onScanZone={handleScanZone}
          onDropPing={handleDropPing}
          onHighlightRoute={handleHighlightRoute}
          onGuideRouterStep={() => {}}
        />
      )}

      {/* Pause Menu */}
      {paused && snapshot.phase === 'playing' && (
        <PauseModal
          mode={snapshot.mode}
          muted={muted}
          onResume={() => {
            setPaused(false);
            engineRef.current?.setPaused(false);
          }}
          onRestart={handleRestart}
          onToggleMute={handleToggleMute}
          onQuitToTitle={handleReturnTitle}
        />
      )}

      {/* Ending Screen */}
      {snapshot.phase === 'ended' && (
        <EndingScreen
          snapshot={snapshot}
          onRestart={handleRestart}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </div>
  );
}
