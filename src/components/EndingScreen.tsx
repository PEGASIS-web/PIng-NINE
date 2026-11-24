import React from 'react';
import { RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatCampusClock } from '../game/worldData.ts';
import type { GameSnapshot } from '../game/types.ts';

interface EndingScreenProps {
  snapshot: GameSnapshot;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const EndingScreen: React.FC<EndingScreenProps> = ({
  snapshot,
  onRestart,
  onReturnTitle,
}) => {
  const activatedCount = snapshot.spirits.filter((s) => s.activated).length;
  const rating = snapshot.rating ?? 'Request Timed Out';
  const clockStr = formatCampusClock(snapshot.remainingSeconds, snapshot.blackoutElapsed);

  const isSuccess = snapshot.restored;
  const subtitle =
    rating === '99.9% Uptime'
      ? 'All six spirits harmonized and the Central Router was restored before the 9:00 AM blackout.'
      : rating === 'Last-Second Patch'
      ? 'You stabilized the Central Router right on the edge of total campus collapse.'
      : rating === 'High Ping Survivor'
      ? 'With partial spirit conduits bridged, the campus network survived on emergency bandwidth.'
      : 'The 9:00 AM blackout overwhelmed the Central Router. The Buffer consumed the remaining network.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0813]/95 p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl bg-[#161124] border border-white/15 p-8 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isSuccess ? (
              <ShieldCheck className="w-8 h-8 text-cyan-300" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-rose-400" />
            )}
            <div>
              <p className={`text-xs font-semibold ${isSuccess ? 'text-cyan-300' : 'text-rose-400'}`}>
                {isSuccess ? 'CAMPUS CONNECTION RESTORED' : 'CAMPUS BLACKOUT'}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-0.5">
                {rating}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Final Clock</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-300">{clockStr}</div>
          </div>
        </div>

        <p className="text-sm sm:text-base text-slate-200 mt-5 leading-relaxed">{subtitle}</p>

        {/* Performance Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-400">Spirits Activated</div>
            <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
              {activatedCount} / 6
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-400">Hidden Vaults Found</div>
            <div className="font-mono-tabular text-2xl font-bold text-amber-300 mt-1">
              {snapshot.spirits.filter((s, idx) => idx >= 4 && s.activated).length} / 2
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-slate-400">Session Mode</div>
            <div className="font-display text-xl font-bold text-cyan-300 mt-1 capitalize">
              {snapshot.mode === 'coop' ? 'Online Co-op' : 'Solo + AI Guide'}
            </div>
          </div>
        </div>

        {/* Character Epilogue Strip */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/mina_portrait_1795511104418.jpg"
              alt="Mina"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-amber-400/40"
            />
            <div>
              <div className="font-display font-semibold text-white text-sm">Mina</div>
              <div className="text-xs text-slate-400">
                {isSuccess ? 'Lantern held steady through the dusk.' : 'Retreated as the lights failed.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/tariq_portrait_1795511105037.jpg"
              alt="Tariq"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-cyan-400/40"
            />
            <div>
              <div className="font-display font-semibold text-white text-sm">Tariq</div>
              <div className="text-xs text-slate-400">
                {isSuccess ? 'Router telemetry back at optimal ping.' : 'Signal lost across all campus nodes.'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 mt-7">
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white cursor-pointer"
          >
            Return to Title
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="px-6 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
