import React, { useState } from 'react';
import { Compass, Gamepad2, Radio, Users, Volume2, VolumeX, Wifi } from 'lucide-react';
import type { GameSnapshot, PlayerRole } from '../game/types.ts';

interface TitleScreenProps {
  muted: boolean;
  onToggleMute: () => void;
  onStartSolo: () => void;
  onCreateRoom: (role: PlayerRole) => void;
  onJoinRoom: (code: string, role: PlayerRole) => void;
  onSelectRole: (role: PlayerRole) => void;
  onStartCoop: () => void;
  onLeaveLobby: () => void;
  lobbySnapshot: GameSnapshot | null;
  myRole: PlayerRole;
  wsConnected: boolean;
  errorText: string | null;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  muted,
  onToggleMute,
  onStartSolo,
  onCreateRoom,
  onJoinRoom,
  onSelectRole,
  onStartCoop,
  onLeaveLobby,
  lobbySnapshot,
  myRole,
  wsConnected,
  errorText,
}) => {
  const [view, setView] = useState<'main' | 'coop' | 'controls'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [preferredRole, setPreferredRole] = useState<PlayerRole>('runner');

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-y-auto bg-[#0e0b16] text-slate-100">
      {/* Generated Dusk Campus Backdrop with Scrim */}
      <div className="fixed inset-0 pointer-events-none">
        <img
          src="/src/assets/images/campus_dusk_bg_1795511105399.jpg"
          alt="Ping Nine university campus at dusk"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e0b16]/80 via-[#151024]/75 to-[#0e0b16]" />
      </div>

      {/* Top Navigation Contract (3 zones) */}
      <header className="relative z-10 flex items-center justify-between gap-8 px-8 py-5 border-b border-white/10">
        <div className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          PING NINE
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setView('main')}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setView('coop')}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Online Co-op
          </button>
          <button
            type="button"
            onClick={() => setView('controls')}
            className="hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Controls
          </button>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="px-3 py-2 text-xs font-medium text-slate-200 bg-white/5 border border-white/15 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{muted ? 'Muted' : 'Audio On'}</span>
          </button>
        </div>
      </header>

      {/* Main Hero / Lobby / Controls */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-8 flex-1 flex items-center">
        {lobbySnapshot ? (
          <section className="w-full max-w-3xl mx-auto bg-[#171226]/95 border border-white/15 rounded-xl p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <p className="text-xs text-cyan-300 font-medium tracking-wide">Online Co-op Session</p>
                <h2 className="font-display text-3xl font-bold text-white mt-1">
                  Room Code: <span className="font-mono-tabular text-amber-300">{lobbySnapshot.roomCode}</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={onLeaveLobby}
                className="px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 border border-white/15 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                Leave Room
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              {/* Role 1: Mina (Runner) */}
              <button
                type="button"
                onClick={() => onSelectRole('runner')}
                className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                  myRole === 'runner'
                    ? 'bg-amber-400/15 border-amber-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold">Mina — Runner</span>
                  <span className="text-xs font-mono-tabular text-amber-300">
                    {lobbySnapshot.connectedRoles.runner ? 'Connected' : 'Open'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-2">
                  Explore the 3D campus, solve Beacon, Echo, and Relay puzzles, evade The Buffer, and restore the Central Router.
                </p>
                {myRole === 'runner' && (
                  <p className="text-xs text-amber-300 font-semibold mt-3">Your Assigned Role</p>
                )}
              </button>

              {/* Role 2: Tariq (Guide) */}
              <button
                type="button"
                onClick={() => onSelectRole('guide')}
                className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                  myRole === 'guide'
                    ? 'bg-cyan-400/15 border-cyan-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold">Tariq — Guide</span>
                  <span className="text-xs font-mono-tabular text-cyan-300">
                    {lobbySnapshot.connectedRoles.guide ? 'Connected' : 'Open'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-2">
                  Operate the full Campus Network Tablet, scan clues for hidden spirits, track The Buffer, drop 3D Signal Pings, and sync the Router.
                </p>
                {myRole === 'guide' && (
                  <p className="text-xs text-cyan-300 font-semibold mt-3">Your Assigned Role</p>
                )}
              </button>
            </div>

            {errorText && (
              <p className="text-sm text-rose-300 mb-4">{errorText}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
              <div className="text-xs text-slate-400">
                Share room code <span className="font-mono-tabular text-slate-200">{lobbySnapshot.roomCode}</span> with a second player, or start anytime.
              </div>
              <button
                type="button"
                onClick={onStartCoop}
                className="px-6 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
              >
                Start Co-op Run
              </button>
            </div>
          </section>
        ) : view === 'controls' ? (
          <section className="w-full max-w-3xl mx-auto bg-[#171226]/95 border border-white/15 rounded-xl p-8">
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <h2 className="font-display text-2xl font-bold text-white">Controls & Mechanics</h2>
              <button
                type="button"
                onClick={() => setView('main')}
                className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 rounded-lg cursor-pointer"
              >
                Back
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 text-sm">
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-amber-300 text-base">Runner (Mina)</h3>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Move</span>
                  <span className="font-mono-tabular text-white">W A S D</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Camera Look</span>
                  <span className="font-mono-tabular text-white">Mouse / Drag / Q & Arrows</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Sprint</span>
                  <span className="font-mono-tabular text-white">Shift</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Jump</span>
                  <span className="font-mono-tabular text-white">Space</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Interact / Deliver</span>
                  <span className="font-mono-tabular text-white">E</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-slate-300">Echo Chimes</span>
                  <span className="font-mono-tabular text-white">1 / 2 / 3 or Click</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Guide Map / Pause</span>
                  <span className="font-mono-tabular text-white">M / Esc</span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-display font-semibold text-cyan-300 text-base">Spirit Types & Survival</h3>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-amber-300">Beacon:</strong> Activate and run through the 5 glowing trail nodes around the landmark.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-violet-300">Echo:</strong> Listen to the 3-beat audio & light pylon sequence and repeat it back.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-rose-300">Relay:</strong> Pick up a Warm Packet at a charging kiosk and deliver it without stepping on corruption.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-cyan-300">Connection Lines:</strong> Grant a speed boost and physically block The Buffer from crossing.
                </p>
              </div>
            </div>
          </section>
        ) : view === 'coop' ? (
          <section className="w-full max-w-2xl mx-auto bg-[#171226]/95 border border-white/15 rounded-xl p-8">
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Online Two-Player Co-op</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Server status: {wsConnected ? 'Connected to Multiplayer Relay' : 'Connecting...'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView('main')}
                className="px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 rounded-lg cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Choose Your Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPreferredRole('runner')}
                    className={`py-2.5 px-4 rounded-lg border text-sm font-medium cursor-pointer ${
                      preferredRole === 'runner'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    Mina (3D Runner)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredRole('guide')}
                    className={`py-2.5 px-4 rounded-lg border text-sm font-medium cursor-pointer ${
                      preferredRole === 'guide'
                        ? 'bg-cyan-400/20 border-cyan-400 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    Tariq (Map Guide)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-white">Host New Session</h3>
                    <p className="text-xs text-slate-400 mt-1">Generate a room code for your partner to join.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateRoom(preferredRole)}
                    disabled={!wsConnected}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-semibold text-sm cursor-pointer"
                  >
                    Create Room
                  </button>
                </div>

                <div className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-white">Join Existing Room</h3>
                    <input
                      type="text"
                      maxLength={4}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ROOM CODE (e.g. A7K2)"
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-[#0e0b16] border border-white/20 text-sm font-mono-tabular text-white uppercase tracking-widest focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoom(joinCode, preferredRole)}
                    disabled={!wsConnected || joinCode.trim().length < 4}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-semibold text-sm cursor-pointer"
                  >
                    Join Room
                  </button>
                </div>
              </div>

              {errorText && <p className="text-sm text-rose-300">{errorText}</p>}
            </div>
          </section>
        ) : (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Hero Copy & Actions */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="flex items-center gap-3 text-xs text-cyan-300 font-medium">
                <span>8:58 AM</span>
                <span aria-hidden="true">·</span>
                <span>Two Minutes to Blackout</span>
                <span aria-hidden="true">·</span>
                <span>Six Spirits</span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
                PING NINE
              </h1>

              <p className="text-base sm:text-lg text-slate-200/90 max-w-xl leading-relaxed">
                A creeping digital corruption has fractured the university network. Awaken the six campus spirits, weave protective Connection Lines against The Buffer, and restore the Central Router before 9:00 AM.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={onStartSolo}
                  className="px-7 py-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Start Solo Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('coop')}
                  className="px-6 py-3.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition-colors flex items-center gap-2.5 whitespace-nowrap cursor-pointer"
                >
                  <Users className="w-4 h-4 text-cyan-300" />
                  <span>Online Co-op</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('controls')}
                  className="px-5 py-3.5 rounded-lg bg-transparent hover:bg-white/5 border border-white/15 text-slate-200 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Controls</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span>4 Zones + 2 Hidden Vaults</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>AI Guide or Live Co-op</span>
                </div>
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-rose-300 shrink-0" />
                  <span>4 Connection Ratings</span>
                </div>
              </div>
            </div>

            {/* Right Character Artwork Cards */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 items-stretch">
              <div className="rounded-xl overflow-hidden bg-[#171226]/90 border border-white/15 flex flex-col">
                <div className="relative flex-1 min-h-[240px] bg-gradient-to-br from-amber-500/20 to-indigo-950">
                  <img
                    src="/src/assets/images/mina_portrait_1795511104418.jpg"
                    alt="Mina — Runner"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#171226] to-transparent" />
                </div>
                <div className="p-4">
                  <div className="font-display font-bold text-white">Mina</div>
                  <div className="text-xs text-amber-300 mt-0.5">Runner · Campus Explorer</div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden bg-[#171226]/90 border border-white/15 flex flex-col">
                <div className="relative flex-1 min-h-[240px] bg-gradient-to-br from-teal-500/20 to-indigo-950">
                  <img
                    src="/src/assets/images/tariq_portrait_1795511105037.jpg"
                    alt="Tariq — Guide"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#171226] to-transparent" />
                </div>
                <div className="p-4">
                  <div className="font-display font-bold text-white">Tariq</div>
                  <div className="text-xs text-cyan-300 mt-0.5">Guide · Network Map AI / P2</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="relative z-10 px-8 py-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
        <span>PING NINE · Campus Network Recovery</span>
        <span>Explore · Awaken · Connect · Restore</span>
      </footer>
    </div>
  );
};
