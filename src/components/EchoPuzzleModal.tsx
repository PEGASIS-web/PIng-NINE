import React, { useEffect, useRef, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { audioEngine } from '../game/audio.ts';
import type { SpiritDefinition } from '../game/types.ts';

interface EchoPuzzleModalProps {
  spirit: SpiritDefinition;
  onFlashPylon: (spiritId: string | null, pylonIdx: number) => void;
  onSuccess: (spiritId: string) => void;
  onClose: () => void;
}

const CHIME_LABELS = [
  { id: 0, label: 'Low Chime', keyHint: '1', bg: 'bg-teal-400', border: 'border-teal-300', ring: 'ring-teal-300' },
  { id: 1, label: 'Mid Chime', keyHint: '2', bg: 'bg-violet-400', border: 'border-violet-300', ring: 'ring-violet-300' },
  { id: 2, label: 'High Chime', keyHint: '3', bg: 'bg-amber-400', border: 'border-amber-300', ring: 'ring-amber-300' },
];

export const EchoPuzzleModal: React.FC<EchoPuzzleModalProps> = ({
  spirit,
  onFlashPylon,
  onSuccess,
  onClose,
}) => {
  const pattern = spirit.echoPattern ?? [0, 2, 1];
  const [playingClue, setPlayingClue] = useState(true);
  const [litButton, setLitButton] = useState<number | null>(null);
  const [entered, setEntered] = useState<number[]>([]);
  const [statusMsg, setStatusMsg] = useState('Listen closely to the 3-beat Echo resonance...');
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  };

  const playSequence = () => {
    clearTimers();
    setPlayingClue(true);
    setEntered([]);
    setStatusMsg('Listening to the 3-beat Echo pattern...');

    pattern.forEach((noteIdx, idx) => {
      const startAt = 350 + idx * 650;
      timersRef.current.push(
        window.setTimeout(() => {
          audioEngine.playEchoNote(noteIdx);
          setLitButton(noteIdx);
          onFlashPylon(spirit.id, noteIdx);
        }, startAt)
      );
      timersRef.current.push(
        window.setTimeout(() => {
          setLitButton(null);
          onFlashPylon(spirit.id, -1);
        }, startAt + 420)
      );
    });

    timersRef.current.push(
      window.setTimeout(() => {
        setPlayingClue(false);
        setStatusMsg('Repeat the 3-beat pattern using keys [1] [2] [3] or clicking below.');
      }, 350 + pattern.length * 650 + 150)
    );
  };

  useEffect(() => {
    playSequence();
    return () => {
      clearTimers();
      onFlashPylon(null, -1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spirit.id]);

  const handlePress = (idx: number) => {
    if (playingClue) return;
    audioEngine.playEchoNote(idx);
    setLitButton(idx);
    onFlashPylon(spirit.id, idx);
    setTimeout(() => {
      setLitButton(null);
      onFlashPylon(spirit.id, -1);
    }, 220);

    const next = [...entered, idx];
    const step = next.length - 1;
    if (pattern[step] !== idx) {
      audioEngine.playError();
      setEntered([]);
      setStatusMsg('Mismatch! Listen again and match the 3 tones.');
      setTimeout(() => playSequence(), 600);
      return;
    }

    setEntered(next);
    if (next.length === pattern.length) {
      setStatusMsg('Harmony locked! Spirit awakening...');
      setTimeout(() => onSuccess(spirit.id), 320);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') handlePress(0);
      if (e.key === '2') handlePress(1);
      if (e.key === '3') handlePress(2);
      if (e.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#090612]/80 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[#161124] border border-violet-400/35 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs text-violet-300 font-medium">Echo Spirit Resonance</p>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">{spirit.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Echo puzzle"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-200 mt-4">{statusMsg}</p>

        {/* Beat Progress */}
        <div className="flex items-center gap-3 mt-4">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className={`h-2 flex-1 rounded-sm transition-colors ${
                slot < entered.length ? 'bg-cyan-400' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* 3 Resonator Pads */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {CHIME_LABELS.map((chime) => {
            const active = litButton === chime.id;
            return (
              <button
                key={chime.id}
                type="button"
                disabled={playingClue}
                onClick={() => handlePress(chime.id)}
                className={`py-6 px-3 rounded-xl border transition-transform cursor-pointer flex flex-col items-center gap-2 ${
                  active
                    ? `${chime.bg} text-slate-950 scale-105 border-white`
                    : 'bg-white/5 hover:bg-white/10 text-white border-white/15'
                } disabled:cursor-not-allowed`}
              >
                <span className="font-mono-tabular text-xs opacity-80">[{chime.keyHint}]</span>
                <span className="font-display font-semibold text-sm">{chime.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={playSequence}
            disabled={playingClue}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 text-xs font-medium text-white flex items-center gap-2 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-violet-300" />
            <span>Replay 3-Beat Pattern</span>
          </button>
          <span className="text-xs text-slate-400 font-mono-tabular">{entered.length} / 3 Beats</span>
        </div>
      </div>
    </div>
  );
};
