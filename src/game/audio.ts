// 100% Procedural Web Audio API Engine for PING NINE (Zero external audio files)

class PingNineAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;
  private bufferNoiseGain: GainNode | null = null;
  private bufferFilter: BiquadFilterNode | null = null;
  private muted = false;
  private initialized = false;
  private victoryTimer: number | null = null;

  public init(): void {
    if (this.initialized) {
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.65;
    this.masterGain.connect(this.ctx.destination);

    // Ambient campus dusk pad
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 680;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.08;
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'triangle';
    this.droneOsc1.frequency.value = 110; // A2 warm dusk drone
    this.droneOsc1.connect(this.ambientFilter);
    this.droneOsc1.start();

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 164.81; // E3 fifth
    this.droneOsc2.connect(this.ambientFilter);
    this.droneOsc2.start();

    // Increasing 9:00 tension sub-pulse
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionGain.connect(this.masterGain);
    this.tensionOsc = this.ctx.createOscillator();
    this.tensionOsc.type = 'sawtooth';
    this.tensionOsc.frequency.value = 55;
    const tensionLp = this.ctx.createBiquadFilter();
    tensionLp.type = 'lowpass';
    tensionLp.frequency.value = 180;
    this.tensionOsc.connect(tensionLp);
    tensionLp.connect(this.tensionGain);
    this.tensionOsc.start();

    // Buffer proximity static generator
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.bufferFilter = this.ctx.createBiquadFilter();
    this.bufferFilter.type = 'bandpass';
    this.bufferFilter.frequency.value = 950;
    this.bufferFilter.Q.value = 3.5;

    this.bufferNoiseGain = this.ctx.createGain();
    this.bufferNoiseGain.gain.value = 0;

    noiseSource.connect(this.bufferFilter);
    this.bufferFilter.connect(this.bufferNoiseGain);
    this.bufferNoiseGain.connect(this.masterGain);
    noiseSource.start();

    this.initialized = true;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateAmbience(opts: {
    inBuilding: boolean;
    approachingBuilding: boolean;
    bufferProximity: number; // 0..1
    corruptionLevel: number; // 0..1
    restored: boolean;
  }): void {
    if (!this.ctx || !this.ambientFilter || !this.ambientGain || !this.tensionGain || !this.bufferNoiseGain || !this.droneOsc2) {
      return;
    }
    const t = this.ctx.currentTime;

    if (opts.restored) {
      this.ambientFilter.frequency.setTargetAtTime(900, t, 0.4);
      this.ambientGain.gain.setTargetAtTime(0.05, t, 0.4);
      this.tensionGain.gain.setTargetAtTime(0, t, 0.2);
      this.bufferNoiseGain.gain.setTargetAtTime(0, t, 0.15);
      this.droneOsc2.frequency.setTargetAtTime(164.81, t, 0.4);
      return;
    }

    const cutoff = opts.inBuilding ? 290 : opts.approachingBuilding ? 440 : 700 - opts.corruptionLevel * 240;
    this.ambientFilter.frequency.setTargetAtTime(cutoff, t, 0.25);

    // Subtle dissonance inside buildings or high corruption
    const secondFreq = opts.inBuilding ? 155.56 : 164.81 - opts.corruptionLevel * 5;
    this.droneOsc2.frequency.setTargetAtTime(secondFreq, t, 0.35);

    this.tensionGain.gain.setTargetAtTime(opts.corruptionLevel * 0.08, t, 0.2);
    this.bufferNoiseGain.gain.setTargetAtTime(opts.bufferProximity * 0.14, t, 0.08);
    if (this.bufferFilter && opts.bufferProximity > 0.1) {
      this.bufferFilter.frequency.setTargetAtTime(600 + Math.sin(t * 17) * 450, t, 0.04);
    }
  }

  public playFootstep(sprinting: boolean, inBuilding: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = inBuilding ? 135 : 95;
    osc.frequency.setValueAtTime(sprinting ? baseFreq * 1.25 : baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.07);
    gain.gain.setValueAtTime(sprinting ? 0.11 : 0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playTone(freq: number, duration = 0.25, type: OscillatorType = 'sine', volume = 0.18): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  public playBeaconNode(stepIndex: number): void {
    const scale = [392.0, 440.0, 493.88, 587.33, 659.25];
    this.playTone(scale[stepIndex % scale.length], 0.28, 'triangle', 0.2);
  }

  public playEchoNote(noteIndex: number): void {
    const freqs = [261.63, 349.23, 493.88]; // C4, F4, B4
    this.playTone(freqs[noteIndex % 3], 0.34, 'sine', 0.24);
  }

  public playPacketPickup(): void {
    this.playTone(329.63, 0.18, 'triangle', 0.18);
    setTimeout(() => this.playTone(493.88, 0.26, 'triangle', 0.18), 90);
  }

  public playSpiritActivated(type: 'beacon' | 'echo' | 'relay'): void {
    const chords: Record<'beacon' | 'echo' | 'relay', number[]> = {
      beacon: [440, 554.37, 659.25, 880],
      echo: [261.63, 349.23, 493.88, 783.99],
      relay: [293.66, 440, 587.33, 739.99],
    };
    chords[type].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, 0.45, 'triangle', 0.16), idx * 75);
    });
  }

  public playPing(): void {
    this.playTone(740, 0.14, 'sine', 0.14);
    setTimeout(() => this.playTone(987.77, 0.22, 'sine', 0.12), 80);
  }

  public playStationSurge(): void {
    this.playTone(392.0, 0.18, 'triangle', 0.22);
    setTimeout(() => this.playTone(587.33, 0.24, 'sine', 0.22), 70);
    setTimeout(() => this.playTone(880.0, 0.38, 'triangle', 0.2), 140);
  }

  public playError(): void {
    this.playTone(155, 0.18, 'sawtooth', 0.14);
    setTimeout(() => this.playTone(130, 0.24, 'sawtooth', 0.12), 110);
  }

  public playRouterPhase(step: number): void {
    const freqs = [392, 523.25, 659.25, 783.99];
    this.playTone(freqs[Math.min(step, 3)], 0.35, 'triangle', 0.22);
  }

  public playVictoryMusic(): void {
    this.stopVictoryMusic();
    if (!this.ctx) return;
    // Peaceful uplifting synth-piano arpeggio loop
    const notes = [261.63, 329.63, 392.0, 493.88, 523.25, 493.88, 392.0, 329.63];
    let step = 0;
    const playNext = () => {
      this.playTone(notes[step % notes.length], 0.75, 'sine', 0.14);
      if (step % 4 === 0) {
        this.playTone(notes[step % notes.length] / 2, 1.4, 'triangle', 0.1);
      }
      step++;
    };
    playNext();
    this.victoryTimer = window.setInterval(playNext, 420);
  }

  public stopVictoryMusic(): void {
    if (this.victoryTimer !== null) {
      clearInterval(this.victoryTimer);
      this.victoryTimer = null;
    }
  }

  public playFailureBlackout(): void {
    this.stopVictoryMusic();
    this.playTone(110, 0.6, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(82.41, 0.9, 'sawtooth', 0.18), 260);
    setTimeout(() => this.playTone(55, 1.4, 'triangle', 0.2), 550);
  }
}

export const audioEngine = new PingNineAudio();
