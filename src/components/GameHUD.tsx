import React from 'react';
import { Map, Pause, Radio, Shield, Volume2, VolumeX, Zap } from 'lucide-react';
import { BLACKOUT_GRACE_SECONDS, ZONES, formatCampusClock } from '../game/worldData.ts';
import type { EngineUIState } from '../game/PingNineEngine.ts';
import type { GameSnapshot, RadioMessage } from '../game/types.ts';

interface GameHUDProps {
  snapshot: GameSnapshot;
  uiState: EngineUIState;
  radioMessages: RadioMessage[];
  muted: boolean;
  onToggleMute: () => void;
  onOpenMap: () => void;
  onPause: () => void;
  onTriggerInteract: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  uiState,
  radioMessages,
  muted,
  onToggleMute,
  onOpenMap,
  onPause,
  onTriggerInteract,
}) => {
  const activatedCount = snapshot.spirits.filter((s) => s.activated).length;
  const isBlackout = snapshot.remainingSeconds <= 0 && !snapshot.restored;
  const clockStr = formatCampusClock(snapshot.remainingSeconds, snapshot.blackoutElapsed);

  const countdownSec = isBlackout
    ? Math.max(0, Math.ceil(BLACKOUT_GRACE_SECONDS - snapshot.blackoutElapsed))
    : Math.max(0, Math.ceil(snapshot.remainingSeconds));
  const minPart = String(Math.floor(countdownSec / 60)).padStart(2, '0');
  const secPart = String(countdownSec % 60).padStart(2, '0');

  const zoneName = ZONES.find((z) => z.id === snapshot.mina.zoneId)?.name ?? 'Campus Grounds';
  const latestRadio = radioMessages[radioMessages.length - 1];
  const glitchLevel = snapshot.restored ? 0 : Math.min(0.6, Math.max(0, uiState.bufferProximity));
  const glitchPercent = Math.round(glitchLevel * 100);
  const pixelBlur = snapshot.restored ? 0 : Math.min(1, Math.max(0, uiState.pixelBlurIntensity));
  const stuckSec = uiState.cloudStuckSeconds;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 select-none">
      {/* Progressive Buffer Glitch Overlay: 10% approaching -> 60% max close-up (keeps center readable) */}
      {(glitchLevel >= 0.08 || pixelBlur > 0.01) && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {/* Outer vignette + chromatic aberration keeping center 40%+ clear at max 60% glitch */}
          <div
            className="absolute inset-0 transition-opacity duration-100"
            style={{
              opacity: Math.max(glitchLevel, pixelBlur * 0.78),
              background:
                'radial-gradient(circle at 50% 50%, rgba(12,6,20,0.04) 24%, rgba(255,45,85,0.28) 68%, rgba(10,4,18,0.82) 100%)',
              boxShadow: `inset 0 0 ${Math.round(35 + Math.max(glitchLevel, pixelBlur) * 150)}px rgba(255, 45, 85, 0.72)`,
            }}
          />
          {/* Progressive pixel-mosaic grid once stuck > 5s */}
          {pixelBlur > 0.01 && (
            <div
              className="absolute inset-0"
              style={{
                opacity: Math.min(0.75, pixelBlur * 0.8),
                backgroundImage:
                  'linear-gradient(to right, rgba(16,12,28,0.45) 2px, transparent 2px), linear-gradient(to bottom, rgba(16,12,28,0.45) 2px, transparent 2px)',
                backgroundSize: `${Math.round(6 + pixelBlur * 18)}px ${Math.round(6 + pixelBlur * 18)}px`,
              }}
            />
          )}
          {/* Digital scanlines */}
          <div
            className="absolute inset-0 buffer-scanlines"
            style={{ opacity: Math.min(0.65, glitchLevel * 0.95) }}
          />
          {/* Horizontal glitch displacement slices (kept off exact center reticle) */}
          <div
            className="absolute inset-x-0 top-[14%] h-7 bg-gradient-to-r from-rose-500/35 via-cyan-400/20 to-fuchsia-500/35 buffer-tear-a"
            style={{ opacity: Math.max(0, (glitchLevel - 0.1) * 1.15) }}
          />
          <div
            className="absolute inset-x-0 bottom-[18%] h-8 bg-gradient-to-r from-cyan-400/30 via-transparent to-rose-500/40 buffer-tear-b"
            style={{ opacity: Math.max(0, (glitchLevel - 0.16) * 1.15) }}
          />
          {glitchLevel >= 0.32 && (
            <div
              className="absolute inset-x-0 top-[34%] h-3 bg-rose-400/25 buffer-tear-b"
              style={{ opacity: Math.min(0.6, (glitchLevel - 0.25) * 1.2) }}
            />
          )}
          {/* Interference & Cloud-Stuck Pixelation Readout */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-lg bg-rose-950/90 border border-rose-400/60 text-xs font-mono-tabular text-rose-200 whitespace-nowrap">
            {pixelBlur > 0.01
              ? `CLOUD OVERLOAD · PIXEL/BLUR ${Math.round(pixelBlur * 100)}% · ESCAPE OR HIT STATION [E]`
              : stuckSec >= 1.5
                ? `BUFFER GLITCH ${glitchPercent}% · EXPOSURE ${stuckSec.toFixed(1)}s / 5.0s · MOVE AWAY!`
                : `BUFFER GLITCH ${glitchPercent}% · REACH A SIGNAL STATION [E]`}
          </div>
        </div>
      )}

      {/* TOP ROW */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        {/* Top-Left: Spirit Progress & Router Status */}
        <div className="bg-[#120e1e]/90 border border-white/15 rounded-xl px-4 py-3 min-w-[240px] max-w-xs">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium text-white">Spirits Connected</span>
            <span className="font-mono-tabular text-cyan-300 font-semibold">{activatedCount} / 6</span>
          </div>

          <div className="grid grid-cols-6 gap-1.5 mt-2">
            {snapshot.spirits.map((sp, i) => (
              <div
                key={sp.id}
                title={`Spirit ${i + 1}`}
                className={`h-2 rounded-sm transition-colors ${
                  sp.activated ? 'bg-cyan-400' : sp.discovered ? 'bg-amber-400/50' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          <div className="mt-2.5 text-xs flex items-center justify-between text-slate-400">
            <span className="truncate">{zoneName}</span>
            <span className="font-mono-tabular text-amber-300 shrink-0 ml-2">
              {snapshot.routerUnlocked ? 'Router Ready' : 'Router Locked'}
            </span>
          </div>
        </div>

        {/* Top-Center: Prominent 8:58 -> 9:00 AM Timer */}
        <div
          className={`px-6 py-2.5 rounded-xl border text-center ${
            isBlackout
              ? 'bg-rose-950/95 border-rose-400 text-rose-100'
              : snapshot.remainingSeconds < 30
              ? 'bg-[#221024]/95 border-amber-400/70 text-white'
              : 'bg-[#120e1e]/90 border-white/15 text-white'
          }`}
        >
          <div className="font-mono-tabular text-2xl sm:text-3xl font-bold tracking-tight leading-none">
            {clockStr}
          </div>
          <div className="font-mono-tabular text-xs mt-1 text-slate-300">
            {isBlackout ? (
              <span className="text-rose-300 font-semibold">
                BLACKOUT FINAL CHANCE · {minPart}:{secPart}
              </span>
            ) : (
              <span>T-{minPart}:{secPart} to 9:00 AM</span>
            )}
          </div>
        </div>

        {/* Top-Right: Map, Audio, Pause Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="px-3.5 py-2.5 rounded-lg bg-[#120e1e]/90 hover:bg-[#1e1733] border border-white/15 text-xs font-medium text-white flex items-center gap-2 cursor-pointer"
          >
            <Map className="w-4 h-4 text-cyan-300" />
            <span className="hidden sm:inline">Guide Map [M]</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 rounded-lg bg-[#120e1e]/90 hover:bg-[#1e1733] border border-white/15 text-slate-200 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="p-2.5 rounded-lg bg-[#120e1e]/90 hover:bg-[#1e1733] border border-white/15 text-slate-200 cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Router Unlocked Banner */}
      {snapshot.allSixNotified && snapshot.phase === 'playing' && (
        <div className="mx-auto bg-cyan-950/95 border border-cyan-400 px-5 py-2.5 rounded-xl text-center max-w-xl">
          <p className="font-display text-sm font-bold text-cyan-200 tracking-wide">
            ALL SIX CONNECTIONS ESTABLISHED. RETURN TO THE CENTRAL ROUTER.
          </p>
        </div>
      )}

      {/* Stage 4 Restoration Banner */}
      {snapshot.phase === 'cinematic' && (
        <div className="mx-auto bg-[#120e1e]/95 border border-cyan-300 px-8 py-4 rounded-xl text-center">
          <p className="font-display text-2xl font-extrabold text-cyan-300">CAMPUS CONNECTION RESTORED</p>
          <p className="font-mono-tabular text-sm text-amber-300 mt-1">{snapshot.rating}</p>
        </div>
      )}

      {/* BOTTOM ROW */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* Tariq / System Radio Message */}
        {latestRadio && (
          <div
            className={`max-w-xl px-4 py-2.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 ${
              latestRadio.tone === 'warning'
                ? 'bg-rose-950/95 border-rose-400/60 text-rose-100'
                : latestRadio.tone === 'success'
                ? 'bg-cyan-950/95 border-cyan-400/60 text-cyan-100'
                : 'bg-[#120e1e]/92 border-white/15 text-slate-100'
            }`}
          >
            <Radio className="w-4 h-4 shrink-0 text-cyan-300" />
            <span>
              <strong className="font-semibold text-amber-300 mr-1.5">{latestRadio.sender}:</strong>
              {latestRadio.text}
            </span>
          </div>
        )}

        {/* Active Status Badges: Connection Line Boost / Warm Packet Integrity */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {snapshot.mina.onConnectionLine && (
            <div className="px-3.5 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-400/50 text-xs font-medium text-cyan-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-300" />
              <span>Connection Line Boost · Protected from Buffer</span>
            </div>
          )}

          {snapshot.mina.carryingPacketFor && (
            <div className="px-4 py-1.5 rounded-lg bg-[#24131c]/95 border border-amber-400/50 text-xs font-medium text-amber-200 flex items-center gap-2.5">
              <Shield className="w-3.5 h-3.5 text-amber-300" />
              <span>Warm Packet Integrity</span>
              <span className="font-mono-tabular font-bold text-white">
                {Math.round(snapshot.mina.packetIntegrity)}%
              </span>
            </div>
          )}
        </div>

        {/* Interaction Prompt */}
        {uiState.prompt && snapshot.phase === 'playing' && (
          <button
            type="button"
            onClick={onTriggerInteract}
            className="pointer-events-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm flex items-center gap-2.5 shadow-lg cursor-pointer"
          >
            <span className="font-mono-tabular px-2 py-0.5 rounded bg-slate-950 text-amber-300 text-xs">
              {uiState.prompt.key}
            </span>
            <span>{uiState.prompt.label}</span>
          </button>
        )}

        {/* Subtle Control Strip */}
        <div className="text-[11px] text-slate-400 bg-[#120e1e]/80 px-3.5 py-1 rounded-lg border border-white/10">
          WASD Move · Click/Drag Look · Shift Sprint · Space Jump · E Interact · M Map
        </div>
      </div>
    </div>
  );
};
