import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Radio, Zap } from 'lucide-react';
import { audioEngine } from '../game/audio.ts';
import type { GameMode, RouterSyncState } from '../game/types.ts';

interface RouterRestoreModalProps {
  mode: GameMode;
  routerSync: RouterSyncState;
  activatedCount: number;
  onMinaStep: (nextStep: number) => void;
}

export const RouterRestoreModal: React.FC<RouterRestoreModalProps> = ({
  mode,
  routerSync,
  activatedCount,
  onMinaStep,
}) => {
  const [cursor, setCursor] = useState(15); // 0..100 oscillating timing cursor
  const [feedback, setFeedback] = useState('Align the router frequency inside the cyan target band to lock each conduit pair.');
  const dirRef = useRef(1);
  const stepRef = useRef(routerSync.minaStep);
  stepRef.current = routerSync.minaStep;

  // Target lock zone narrows slightly across the 3 phases (~8-12s total sequence)
  const targetStart = routerSync.minaStep === 0 ? 34 : routerSync.minaStep === 1 ? 38 : 40;
  const targetEnd = routerSync.minaStep === 0 ? 66 : routerSync.minaStep === 1 ? 62 : 60;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = 72 + stepRef.current * 14;
      setCursor((prev) => {
        let next = prev + dirRef.current * speed * dt;
        if (next >= 96) {
          next = 96;
          dirRef.current = -1;
        } else if (next <= 4) {
          next = 4;
          dirRef.current = 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const attemptLock = () => {
    if (routerSync.minaStep >= 3) return;
    if (cursor >= targetStart && cursor <= targetEnd) {
      const nextStep = routerSync.minaStep + 1;
      audioEngine.playRouterPhase(nextStep);
      onMinaStep(nextStep);
      if (nextStep < 3) {
        setFeedback(`Channel ${nextStep}/3 locked! Lock the next harmonic conduit!`);
      } else {
        setFeedback(
          mode === 'coop'
            ? 'All 3 Runner channels locked! Waiting for Tariq (Guide) to confirm synchronization on the Map...'
            : 'Tariq confirmed final uplink! Restoring campus network...'
        );
      }
    } else {
      audioEngine.playError();
      setFeedback('Out of phase! Wait until the signal indicator enters the cyan lock zone.');
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        attemptLock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const waitingForGuide = mode === 'coop' && routerSync.minaStep >= 3 && routerSync.guideStep < 3;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090612]/85 p-4">
      <div className="w-full max-w-xl rounded-xl bg-[#151123] border border-cyan-400/40 p-7 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <p className="text-xs text-cyan-300 font-medium">Central Router Restoration Sequence</p>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">
              Stabilize {activatedCount} Connected Spirits
            </h2>
          </div>
          <div className="text-right font-mono-tabular text-xs text-amber-300">
            Phase {Math.min(3, routerSync.minaStep + 1)} of 3
          </div>
        </div>

        <p className="text-sm text-slate-200 mt-4">{feedback}</p>

        {/* Dual Role Sync Status */}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-xs text-amber-300 font-medium">Mina — Runner Uplink</div>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-2.5 flex-1 rounded-sm ${
                    routerSync.minaStep >= idx ? 'bg-amber-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-xs text-cyan-300 font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>Tariq — Guide Network Sync</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-2.5 flex-1 rounded-sm ${
                    routerSync.guideStep >= idx ? 'bg-cyan-400' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Frequency Lock Bar */}
        {!waitingForGuide && routerSync.minaStep < 3 ? (
          <div className="mt-6 space-y-4">
            <div className="relative h-12 rounded-lg bg-[#0b0814] border border-white/15 overflow-hidden">
              {/* Target Cyan Zone */}
              <div
                className="absolute inset-y-0 bg-cyan-400/25 border-x-2 border-cyan-300"
                style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
              />
              {/* Oscillating Cursor */}
              <div
                className="absolute inset-y-1 w-2 rounded-sm bg-amber-300 shadow-lg"
                style={{ left: `calc(${cursor}% - 4px)` }}
              />
            </div>

            <button
              type="button"
              onClick={attemptLock}
              className="w-full py-3.5 px-6 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Lock Conduit Phase ({routerSync.minaStep + 1}/3) · [Space / E]</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 p-4 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center gap-3 text-cyan-200 text-sm">
            <CheckCircle2 className="w-5 h-5 text-cyan-300 shrink-0" />
            <span>
              {mode === 'coop'
                ? 'Runner conduits locked! Waiting for Player 2 (Guide) to finish Synchronize Network on their tablet...'
                : 'Synchronizing campus conduits...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
