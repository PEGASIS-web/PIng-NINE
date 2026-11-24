import React, { useState } from 'react';
import { Compass, MapPin, Navigation, Radar, Radio, ShieldCheck, X, Zap } from 'lucide-react';
import { REPEL_STATIONS, SPIRITS, ZONES, formatCampusClock } from '../game/worldData.ts';
import type { GameSnapshot, PlayerRole, ZoneId } from '../game/types.ts';

interface GuideMapModalProps {
  snapshot: GameSnapshot;
  role: PlayerRole;
  fullScreen: boolean;
  onClose?: () => void;
  onScanZone: (zoneId: ZoneId) => void;
  onDropPing: (x: number, z: number, label: string) => void;
  onHighlightRoute: (toZone: ZoneId) => void;
  onGuideRouterStep: (step: number) => void;
}

// Map world coords [-48..48] into SVG [0..500]
const MAP_SIZE = 500;
const WORLD_SPAN = 96;
const toMapX = (wx: number) => ((wx + WORLD_SPAN / 2) / WORLD_SPAN) * MAP_SIZE;
const toMapY = (wz: number) => ((wz + WORLD_SPAN / 2) / WORLD_SPAN) * MAP_SIZE;

export const GuideMapModal: React.FC<GuideMapModalProps> = ({
  snapshot,
  role,
  fullScreen,
  onClose,
  onScanZone,
  onDropPing,
  onHighlightRoute,
  onGuideRouterStep,
}) => {
  const [selectedZone, setSelectedZone] = useState<ZoneId>('quad');
  const [nowMs, setNowMs] = useState(Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const canGuideControl = role === 'guide' || snapshot.mode === 'solo';
  const scanCd = Math.max(0, Math.ceil((snapshot.guideCooldowns.scanReadyAt - nowMs) / 1000));
  const pingCd = Math.max(0, Math.ceil((snapshot.guideCooldowns.pingReadyAt - nowMs) / 1000));
  const routeCd = Math.max(0, Math.ceil((snapshot.guideCooldowns.routeReadyAt - nowMs) / 1000));

  const activatedCount = snapshot.spirits.filter((s) => s.activated).length;
  const clockStr = formatCampusClock(snapshot.remainingSeconds, snapshot.blackoutElapsed);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canGuideControl || pingCd > 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * WORLD_SPAN - WORLD_SPAN / 2;
    const nz = ((e.clientY - rect.top) / rect.height) * WORLD_SPAN - WORLD_SPAN / 2;
    const zoneDef = ZONES.find((z) => z.id === selectedZone);
    onDropPing(Math.round(nx), Math.round(nz), zoneDef ? `Check ${zoneDef.shortName}` : 'Guide Ping');
  };

  const zoneObj = ZONES.find((z) => z.id === selectedZone) ?? ZONES[0];
  const zoneSpiritDef = SPIRITS.find((s) => s.zoneId === selectedZone);
  const zoneSpiritState = zoneSpiritDef
    ? snapshot.spirits.find((s) => s.id === zoneSpiritDef.id)
    : undefined;
  const isZoneScanned =
    !zoneObj.hidden ||
    snapshot.scannedZones.includes(selectedZone) ||
    Boolean(zoneSpiritState?.discovered);

  // Fuzzy Buffer position so Guide sees approximate interference zone, not exact laser pinpoint
  const bufferBlipX = toMapX(snapshot.buffer.x + Math.sin(Math.floor(nowMs / 1500)) * 2.2);
  const bufferBlipY = toMapY(snapshot.buffer.z + Math.cos(Math.floor(nowMs / 1500)) * 2.2);

  return (
    <div
      className={
        fullScreen
          ? 'w-full h-full bg-[#0f0c1a] text-slate-100 flex flex-col overflow-hidden'
          : 'fixed inset-0 z-40 flex items-center justify-center bg-[#090612]/85 p-4'
      }
    >
      <div
        className={
          fullScreen
            ? 'w-full h-full flex flex-col p-5 max-w-7xl mx-auto'
            : 'w-full max-w-5xl max-h-[92vh] rounded-xl bg-[#151123] border border-cyan-400/35 p-5 flex flex-col shadow-2xl overflow-hidden'
        }
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/tariq_portrait_1795511105037.jpg"
              alt="Tariq"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-cover border border-cyan-400/40"
            />
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <span>Tariq’s Campus Network Map</span>
                {snapshot.roomCode && (
                  <span className="text-xs font-mono-tabular text-cyan-300">· Room {snapshot.roomCode}</span>
                )}
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>{role === 'guide' ? 'Online Guide Interface' : 'Tactical Tablet Overlay'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-amber-300">{clockStr}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular text-cyan-300">{activatedCount} / 6 Spirits</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {snapshot.phase === 'restoring' && role === 'guide' && (
              <button
                type="button"
                disabled={snapshot.routerSync.guideStep >= 3}
                onClick={() => onGuideRouterStep(snapshot.routerSync.guideStep + 1)}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {snapshot.routerSync.guideStep >= 3
                    ? 'Guide Sync Complete (3/3)'
                    : `Synchronize Router Network (${snapshot.routerSync.guideStep}/3)`}
                </span>
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close [M]</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Map + Clue Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 flex-1 min-h-0 overflow-y-auto">
          {/* Interactive SVG Map */}
          <div className="lg:col-span-7 bg-[#0b0815] border border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
              <span>Click anywhere on the map to drop a 3D Signal Ping for Mina</span>
              <span className="font-mono-tabular text-cyan-300">
                {pingCd > 0 ? `Ping Cooldown ${pingCd}s` : 'Ping Ready'}
              </span>
            </div>

            <div className="relative flex-1 flex items-center justify-center min-h-[300px]">
              <svg
                viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
                onClick={handleSvgClick}
                className="w-full h-full max-h-[460px] aspect-square rounded-lg bg-[#120e21] border border-white/10 cursor-crosshair"
              >
                {/* Grid lines */}
                {[100, 200, 300, 400].map((pos) => (
                  <g key={pos} opacity="0.12">
                    <line x1={pos} y1={0} x2={pos} y2={MAP_SIZE} stroke="#94a3b8" strokeWidth="1" />
                    <line x1={0} y1={pos} x2={MAP_SIZE} y2={pos} stroke="#94a3b8" strokeWidth="1" />
                  </g>
                ))}

                {/* Connection Lines */}
                {SPIRITS.map((sp, i) => {
                  const active = snapshot.spirits[i]?.activated;
                  const pts = sp.linePath.map((p) => `${toMapX(p.x)},${toMapY(p.z)}`).join(' ');
                  return (
                    <polyline
                      key={sp.id}
                      points={pts}
                      fill="none"
                      stroke={active ? '#22d3ee' : '#334155'}
                      strokeWidth={active ? 4 : 2}
                      strokeDasharray={active ? undefined : '5 5'}
                    />
                  );
                })}

                {/* Safe Route Highlights */}
                {snapshot.safeRoutes.map((route) => (
                  <polyline
                    key={route.id}
                    points={route.points.map((p) => `${toMapX(p.x)},${toMapY(p.z)}`).join(' ')}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth={4}
                    strokeDasharray="8 4"
                  />
                ))}

                {/* Campus Zones */}
                {ZONES.map((z) => {
                  const cx = toMapX(z.center.x);
                  const cy = toMapY(z.center.z);
                  const isSel = z.id === selectedZone;
                  const hiddenLocked = z.hidden && !snapshot.scannedZones.includes(z.id);
                  return (
                    <g
                      key={z.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZone(z.id);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={z.id === 'router' ? 26 : 36}
                        fill={z.color}
                        fillOpacity={isSel ? 0.22 : 0.08}
                        stroke={isSel ? '#ffffff' : z.color}
                        strokeOpacity={isSel ? 0.9 : 0.45}
                        strokeWidth={isSel ? 2 : 1}
                        strokeDasharray={hiddenLocked ? '4 4' : undefined}
                      />
                      <text
                        x={cx}
                        y={cy + (z.id === 'router' ? 38 : 48)}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {hiddenLocked ? '??? Signal Anomaly' : z.shortName}
                      </text>
                    </g>
                  );
                })}

                {/* Spirits */}
                {SPIRITS.map((sp, i) => {
                  const st = snapshot.spirits[i];
                  if (!st) return null;
                  const sx = toMapX(sp.position.x);
                  const sy = toMapY(sp.position.z);
                  if (sp.hidden && !st.discovered && !snapshot.scannedZones.includes(sp.zoneId)) {
                    return (
                      <circle
                        key={sp.id}
                        cx={sx}
                        cy={sy}
                        r={6}
                        fill="#f59e0b"
                        fillOpacity={0.35}
                        stroke="#f59e0b"
                        strokeDasharray="2 2"
                      />
                    );
                  }
                  return (
                    <g key={sp.id}>
                      <circle
                        cx={sx}
                        cy={sy}
                        r={8}
                        fill={st.activated ? '#22d3ee' : '#fbbf24'}
                        stroke="#090612"
                        strokeWidth={2}
                      />
                      <text x={sx} y={sy - 12} textAnchor="middle" fill="#cbd5e1" fontSize="9">
                        {st.activated ? 'Online' : sp.type.toUpperCase()}
                      </text>
                    </g>
                  );
                })}

                {/* Repel Signal Stations */}
                {REPEL_STATIONS.map((st) => {
                  const sx = toMapX(st.position.x);
                  const sy = toMapY(st.position.z);
                  const cdReadyAt = snapshot.stationCooldowns?.[st.id] ?? 0;
                  const ready = cdReadyAt <= nowMs;
                  return (
                    <g key={st.id}>
                      <polygon
                        points={`${sx},${sy - 7} ${sx + 7},${sy} ${sx},${sy + 7} ${sx - 7},${sy}`}
                        fill={ready ? '#34d399' : '#475569'}
                        stroke="#090612"
                        strokeWidth={1.5}
                      />
                      <text x={sx} y={sy + 16} textAnchor="middle" fill={ready ? '#6ee7b7' : '#94a3b8'} fontSize="8">
                        {ready ? 'REPEL' : 'CHARGING'}
                      </text>
                    </g>
                  );
                })}

                {/* Approximate Buffer Interference Zone */}
                {!snapshot.restored && (
                  <g>
                    <circle
                      cx={bufferBlipX}
                      cy={bufferBlipY}
                      r={32}
                      fill="#ff2d55"
                      fillOpacity={0.16}
                      stroke="#ff2d55"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={bufferBlipX}
                      y={bufferBlipY + 4}
                      textAnchor="middle"
                      fill="#fda4af"
                      fontSize="10"
                      fontWeight="700"
                    >
                      BUFFER ~
                    </text>
                  </g>
                )}

                {/* Active Signal Pings */}
                {snapshot.pings.map((p) => (
                  <g key={p.id}>
                    <circle cx={toMapX(p.x)} cy={toMapY(p.z)} r={11} fill="none" stroke="#22d3ee" strokeWidth={2} />
                    <circle cx={toMapX(p.x)} cy={toMapY(p.z)} r={4} fill="#67e8f9" />
                  </g>
                ))}

                {/* Mina (Runner) Live Position */}
                <g>
                  <circle
                    cx={toMapX(snapshot.mina.x)}
                    cy={toMapY(snapshot.mina.z)}
                    r={9}
                    fill="#fbbf24"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                  <text
                    x={toMapX(snapshot.mina.x)}
                    y={toMapY(snapshot.mina.z) - 13}
                    textAnchor="middle"
                    fill="#fef08a"
                    fontSize="10"
                    fontWeight="700"
                  >
                    MINA
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Zone Inspector, Clue Decoder & Guide Actions */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-300 font-medium">Selected Campus Sector</span>
                <span className="text-xs text-slate-400">
                  {zoneObj.indoor ? 'Indoor' : 'Outdoor'} · {zoneObj.hidden ? 'Hidden Sector' : 'Main Zone'}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-white">{zoneObj.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{zoneObj.description}</p>

              {zoneSpiritDef && (
                <div className="p-3 rounded-lg bg-[#0b0815] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300">
                      {isZoneScanned ? zoneSpiritDef.name : 'Encrypted Signal'}
                    </span>
                    <span className="font-mono-tabular text-cyan-300">
                      {zoneSpiritState?.activated ? 'CONNECTED' : isZoneScanned ? 'SIGNAL DECODED' : 'UNSCANNED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {isZoneScanned
                      ? zoneSpiritDef.discoveryHint
                      : 'Use Scan Zone Clues to triangulate this hidden spirit.'}
                  </p>
                </div>
              )}

              {canGuideControl && (
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={scanCd > 0}
                    onClick={() => onScanZone(selectedZone)}
                    className="py-2.5 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Radar className="w-3.5 h-3.5" />
                    <span>{scanCd > 0 ? `Scan (${scanCd}s)` : 'Scan Zone Clues'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={routeCd > 0}
                    onClick={() => onHighlightRoute(selectedZone)}
                    className="py-2.5 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{routeCd > 0 ? `Route (${routeCd}s)` : 'Highlight Safe Route'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 6 Spirit Roster */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex-1 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-sm font-semibold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-300" />
                  <span>Six Spirit Network Status</span>
                </h4>
                <span className="text-xs font-mono-tabular text-slate-400">{activatedCount}/6</span>
              </div>
              <div className="space-y-1.5">
                {SPIRITS.map((sp, i) => {
                  const st = snapshot.spirits[i];
                  const known = !sp.hidden || st?.discovered || snapshot.scannedZones.includes(sp.zoneId);
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSelectedZone(sp.zoneId)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-[#0b0815]/80 hover:bg-white/10 border border-white/5 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {st?.activated ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        )}
                        <span className="text-slate-200 truncate">
                          {known ? sp.name : 'Hidden Anomaly'}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-slate-400 shrink-0">
                        {st?.activated ? 'Online' : sp.type.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {role === 'guide' && snapshot.phase === 'restoring' && (
              <div className="p-4 rounded-xl bg-amber-400/15 border border-amber-400/50 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <Radio className="w-4 h-4" />
                  <span>Final Router Sync Required!</span>
                </div>
                <p className="text-xs text-slate-200">
                  Mina is at the Central Router ({snapshot.routerSync.minaStep}/3). Click Synchronize Router Network above to complete your side of the handshake!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
