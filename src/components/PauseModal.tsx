import React from 'react';
import { LogOut, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { GameMode } from '../game/types.ts';

interface PauseModalProps {
  mode: GameMode;
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
  onQuitToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  mode,
  muted,
  onResume,
  onRestart,
  onToggleMute,
  onQuitToTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090612]/85 p-4">
      <div className="w-full max-w-md rounded-xl bg-[#161124] border border-white/15 p-7 shadow-2xl space-y-5">
        <div>
          <p className="text-xs text-cyan-300 font-medium">
            {mode === 'coop' ? 'Online Co-op (Timer stays synced)' : 'Game Paused'}
          </p>
          <h2 className="font-display text-2xl font-bold text-white mt-0.5">PING NINE</h2>
        </div>

        <div className="text-xs text-slate-300 bg-white/5 border border-white/10 rounded-lg p-3.5 space-y-1.5">
          <div className="flex justify-between">
            <span>Move / Sprint / Jump</span>
            <span className="font-mono-tabular text-white">WASD / Shift / Space</span>
          </div>
          <div className="flex justify-between">
            <span>Interact / Echo Chimes</span>
            <span className="font-mono-tabular text-white">E / 1-2-3</span>
          </div>
          <div className="flex justify-between">
            <span>Guide Map Tablet</span>
            <span className="font-mono-tabular text-white">M or Tab</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Resume</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{muted ? 'Unmute Audio' : 'Mute Audio'}</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Run</span>
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Title</span>
          </button>
        </div>
      </div>
    </div>
  );
};
