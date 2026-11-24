// 100% Procedural Web Audio API Engine for PING NINE (Zero external audio files)
// Features: Atmospheric Thriller Background Score + Dynamic Intense Chase Music when The Buffer approaches

const THRILLER_BASS_STEPS = [
  55.0, 0, 55.0, 55.0, 58.27, 0, 55.0, 0,
  49.0, 0, 49.0, 55.0, 65.41, 0, 61.74, 58.27,
]; // A1 - Bb1 - G1 - C2 - B1/Bb1 dark thriller ostinato

const THRILLER_ARP_STEPS = [
  220.0, 261.63, 329.63, 0, 349.23, 329.63, 261.63, 246.94,
  220.0, 261.63, 311.13, 0, 440.0, 415.3, 329.63, 233.08,
]; // A minor + eerie Phrygian/tritone thriller tones

const INTENSE_CHASE_STEPS = [
  110.0, 116.54, 110.0, 155.56, 110.0, 116.54, 164.81, 155.56,
  110.0, 116.54, 146.83, 155.56, 116.54, 164.81, 174.61, 155.56,
]; // Fast minor-2nd / tritone driving chase riff

// Home Theme: Cinematic Twilight Campus Synthwave-Noir (Dm9 -> BbMaj7 -> FMaj9 -> C6/9)
const HOME_CHORDS: Array<{ bass: number; pad: number[] }> = [
  { bass: 73.42, pad: [146.83, 220.0, 261.63, 329.63] },  // Dm9
  { bass: 58.27, pad: [116.54, 174.61, 220.0, 293.66] }, // BbMaj7
  { bass: 87.31, pad: [130.81, 196.0, 220.0, 329.63] },  // FMaj9
  { bass: 65.41, pad: [130.81, 164.81, 196.0, 293.66] }, // C6/9
];

const HOME_LEAD_STEPS = [
  523.25, 0, 659.25, 0, 587.33, 440.0, 0, 523.25,
  587.33, 0, 698.46, 0, 659.25, 587.33, 440.0, 0,
  523.25, 0, 659.25, 783.99, 659.25, 0, 587.33, 523.25,
  440.0, 0, 523.25, 587.33, 659.25, 0, 587.33, 440.0,
];

class PingNineAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;

  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;

  private intenseGain: GainNode | null = null;
  private intenseFilter: BiquadFilterNode | null = null;
  private intenseOsc1: OscillatorNode | null = null;
  private intenseOsc2: OscillatorNode | null = null;

  private bufferNoiseGain: GainNode | null = null;
  private bufferFilter: BiquadFilterNode | null = null;

  private muted = false;
  private musicPaused = false;
  private initialized = false;

  private victoryTimer: number | null = null;
  private thrillerTimer: number | null = null;
  private thrillerRunning = false;
  private stepIndex = 0;

  private homeTimer: number | null = null;
  private homeRunning = false;
  private homeStepIndex = 0;
  private homeNoiseBuffer: AudioBuffer | null = null;

  // Live reactive mix parameters updated every frame
  private currentInBuilding = false;
  private currentApproachingBuilding = false;
  private currentBufferThreat = 0; // 0..1 normalized from bufferProximity
  private currentCorruption = 0; // 0..1
  private currentRestored = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.72;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicPaused ? 0.25 : 0.85;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.masterGain);

    // 1. Dark Thriller Bed Drone (detuned minor pad)
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 540;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.085;
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.musicGain);

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 55; // A1 deep dark bed
    this.droneOsc1.connect(this.ambientFilter);
    this.droneOsc1.start();

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.value = 130.81; // C3 minor third
    this.droneOsc2.connect(this.ambientFilter);
    this.droneOsc2.start();

    // 2. Increasing 9:00 AM Countdown Tension Sub-Saw
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.value = 0;
    this.tensionGain.connect(this.musicGain);

    this.tensionOsc = this.ctx.createOscillator();
    this.tensionOsc.type = 'sawtooth';
    this.tensionOsc.frequency.value = 55;
    const tensionLp = this.ctx.createBiquadFilter();
    tensionLp.type = 'lowpass';
    tensionLp.frequency.value = 210;
    this.tensionOsc.connect(tensionLp);
    tensionLp.connect(this.tensionGain);
    this.tensionOsc.start();

    // 3. Intense Buffer-Approaching Dissonant Thriller Swell
    this.intenseFilter = this.ctx.createBiquadFilter();
    this.intenseFilter.type = 'bandpass';
    this.intenseFilter.frequency.value = 520;
    this.intenseFilter.Q.value = 2.4;

    this.intenseGain = this.ctx.createGain();
    this.intenseGain.gain.value = 0;
    this.intenseFilter.connect(this.intenseGain);
    this.intenseGain.connect(this.musicGain);

    this.intenseOsc1 = this.ctx.createOscillator();
    this.intenseOsc1.type = 'sawtooth';
    this.intenseOsc1.frequency.value = 110; // A2
    this.intenseOsc1.connect(this.intenseFilter);
    this.intenseOsc1.start();

    this.intenseOsc2 = this.ctx.createOscillator();
    this.intenseOsc2.type = 'sawtooth';
    this.intenseOsc2.frequency.value = 155.56; // Eb3 tritone tension
    this.intenseOsc2.connect(this.intenseFilter);
    this.intenseOsc2.start();

    // 4. Buffer Proximity Glitch Static Noise
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
    this.bufferFilter.Q.value = 3.2;

    this.bufferNoiseGain = this.ctx.createGain();
    this.bufferNoiseGain.gain.value = 0;

    noiseSource.connect(this.bufferFilter);
    this.bufferFilter.connect(this.bufferNoiseGain);
    this.bufferNoiseGain.connect(this.musicGain);
    noiseSource.start();
    this.homeNoiseBuffer = noiseBuffer;

    this.initialized = true;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.72, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicPaused(paused: boolean): void {
    this.musicPaused = paused;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(paused ? 0.22 : 0.85, this.ctx.currentTime, 0.12);
    }
  }

  public startHomeMusic(): void {
    this.init();
    this.stopGameplayMusic();
    this.stopVictoryMusic();
    this.setMusicPaused(false);
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.homeRunning) return;
    this.homeRunning = true;
    this.homeStepIndex = 0;
    this.scheduleNextHomeStep();
  }

  public stopHomeMusic(): void {
    this.homeRunning = false;
    if (this.homeTimer !== null) {
      clearTimeout(this.homeTimer);
      this.homeTimer = null;
    }
  }

  private scheduleNextHomeStep(): void {
    if (!this.homeRunning) return;
    this.playHomeStep();
    this.homeTimer = window.setTimeout(() => this.scheduleNextHomeStep(), 310);
  }

  private playHomeChordPad(freqs: number[]): void {
    if (!this.ctx || !this.musicGain || this.muted || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(520, t);
    padFilter.frequency.linearRampToValueAtTime(1020, t + 1.1);
    padFilter.frequency.linearRampToValueAtTime(560, t + 2.45);

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.001, t);
    padGain.gain.linearRampToValueAtTime(0.095, t + 0.45);
    padGain.gain.setValueAtTime(0.085, t + 1.8);
    padGain.gain.exponentialRampToValueAtTime(0.001, t + 2.55);

    padFilter.connect(padGain);
    padGain.connect(this.musicGain);

    for (let i = 0; i < freqs.length; i++) {
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      oscA.type = 'triangle';
      oscB.type = 'sine';
      oscA.frequency.setValueAtTime(freqs[i], t);
      oscB.frequency.setValueAtTime(freqs[i] * 1.0035, t); // warm analog chorus detune
      oscA.connect(padFilter);
      oscB.connect(padFilter);
      oscA.start(t);
      oscB.start(t);
      oscA.stop(t + 2.6);
      oscB.stop(t + 2.6);
    }
  }

  private playHomeStep(): void {
    if (!this.ctx || !this.musicGain || this.muted || this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    const step = this.homeStepIndex % 32;
    const barIdx = Math.floor(step / 8);
    const barStep = step % 8;
    const chord = HOME_CHORDS[barIdx];

    // 1. Lush Analog Pad Swell at start of each bar
    if (barStep === 0) {
      this.playHomeChordPad(chord.pad);
    }

    // 2. Warm Rolling Sub-Bass Pulse
    if (barStep === 0 || barStep === 3 || barStep === 4 || barStep === 6) {
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(chord.bass, t);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(280, t);
      const dur = barStep === 0 ? 0.85 : 0.42;
      bassGain.gain.setValueAtTime(0.001, t);
      bassGain.gain.linearRampToValueAtTime(barStep === 0 ? 0.16 : 0.11, t + 0.025);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(t);
      bassOsc.stop(t + dur + 0.03);
    }

    // 3. Glass Rhodes / Bell Lead Melody + Soft Delay Echo
    const leadFreq = HOME_LEAD_STEPS[step];
    if (leadFreq > 0) {
      const triggerBell = (startAt: number, vol: number) => {
        if (!this.ctx || !this.musicGain) return;
        const fund = this.ctx.createOscillator();
        const chime = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        fund.type = 'sine';
        chime.type = 'triangle';
        fund.frequency.setValueAtTime(leadFreq, startAt);
        chime.frequency.setValueAtTime(leadFreq * 2, startAt);

        const chimeGain = this.ctx.createGain();
        chimeGain.gain.setValueAtTime(0.22, startAt);

        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.linearRampToValueAtTime(vol, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.82);

        fund.connect(gain);
        chime.connect(chimeGain);
        chimeGain.connect(gain);
        gain.connect(this.musicGain);

        fund.start(startAt);
        chime.start(startAt);
        fund.stop(startAt + 0.86);
        chime.stop(startAt + 0.86);
      };

      triggerBell(t, 0.115);
      triggerBell(t + 0.31, 0.042); // Warm rhythmic echo repeat
    }

    // 4. Gentle Soft Kick & Lo-Fi Air Brush Groove
    if (barStep === 0 || barStep === 4) {
      const kick = this.ctx.createOscillator();
      const kGain = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(92, t);
      kick.frequency.exponentialRampToValueAtTime(36, t + 0.14);
      kGain.gain.setValueAtTime(0.11, t);
      kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      kick.connect(kGain);
      kGain.connect(this.musicGain);
      kick.start(t);
      kick.stop(t + 0.2);
    } else if ((barStep === 2 || barStep === 6) && this.homeNoiseBuffer) {
      const brush = this.ctx.createBufferSource();
      brush.buffer = this.homeNoiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(4200, t);
      hp.Q.value = 1.6;
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.018, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      brush.connect(hp);
      hp.connect(bGain);
      bGain.connect(this.musicGain);
      brush.start(t);
      brush.stop(t + 0.09);
    }

    this.homeStepIndex++;
  }

  public startGameplayMusic(): void {
    this.init();
    this.stopHomeMusic();
    this.stopVictoryMusic();
    this.currentRestored = false;
    this.setMusicPaused(false);
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(0.075, this.ctx.currentTime, 0.2);
    }
    if (this.thrillerRunning) return;
    this.thrillerRunning = true;
    this.stepIndex = 0;
    this.scheduleNextThrillerStep();
  }

  public stopGameplayMusic(): void {
    this.thrillerRunning = false;
    if (this.thrillerTimer !== null) {
      clearTimeout(this.thrillerTimer);
      this.thrillerTimer = null;
    }
    if (this.ctx && this.intenseGain && this.bufferNoiseGain && this.tensionGain) {
      const t = this.ctx.currentTime;
      this.intenseGain.gain.setTargetAtTime(0, t, 0.15);
      this.bufferNoiseGain.gain.setTargetAtTime(0, t, 0.12);
      this.tensionGain.gain.setTargetAtTime(0, t, 0.15);
    }
  }

  private scheduleNextThrillerStep(): void {
    if (!this.thrillerRunning) return;
    this.playThrillerStep();
    // Tempo tightens smoothly from brooding thriller (235ms/step) to intense chase (122ms/step)
    const speedFactor = Math.min(1, this.currentBufferThreat * 0.85 + this.currentCorruption * 0.25);
    const stepMs = Math.round(235 - speedFactor * 113);
    this.thrillerTimer = window.setTimeout(() => this.scheduleNextThrillerStep(), stepMs);
  }

  private playThrillerStep(): void {
    if (!this.ctx || !this.musicGain || this.muted || this.currentRestored) return;
    if (this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    const step = this.stepIndex % 16;
    const threat = this.currentBufferThreat; // 0..1

    // A. Deep Thriller Bass Pulse
    const bassFreq = THRILLER_BASS_STEPS[step];
    if (bassFreq > 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();

      bassOsc.type = threat > 0.35 ? 'sawtooth' : 'triangle';
      bassOsc.frequency.setValueAtTime(bassFreq, t);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(240 + threat * 620, t);
      bassFilter.frequency.exponentialRampToValueAtTime(120 + threat * 180, t + 0.19);

      const bassVol = (this.musicPaused ? 0.04 : 0.14) * (1 + threat * 0.45);
      bassGain.gain.setValueAtTime(0.001, t);
      bassGain.gain.linearRampToValueAtTime(bassVol, t + 0.015);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(t);
      bassOsc.stop(t + 0.24);
    }

    // B. Eerie Suspense Arpeggio + Soft Echo (plays on alternating or urgent steps)
    const arpFreq = THRILLER_ARP_STEPS[step];
    if (arpFreq > 0 && (step % 2 === 0 || threat > 0.2 || this.currentCorruption > 0.5)) {
      const arpOsc = this.ctx.createOscillator();
      const arpFilter = this.ctx.createBiquadFilter();
      const arpGain = this.ctx.createGain();

      arpOsc.type = this.currentInBuilding ? 'triangle' : 'sine';
      // Slight chilling detune when Buffer is near
      const shift = threat > 0.5 ? 0.94387 : 1; // minor-2nd drop under extreme danger
      arpOsc.frequency.setValueAtTime(arpFreq * shift, t);

      arpFilter.type = 'lowpass';
      arpFilter.frequency.setValueAtTime(this.currentInBuilding ? 900 : 1900, t);

      const arpVol = this.musicPaused ? 0.025 : 0.075 - threat * 0.02;
      arpGain.gain.setValueAtTime(0.001, t);
      arpGain.gain.linearRampToValueAtTime(Math.max(0.015, arpVol), t + 0.012);
      arpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);

      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(this.musicGain);
      arpOsc.start(t);
      arpOsc.stop(t + 0.28);
    }

    // C. Ticking Thriller Clock Percussion (builds urgency)
    if (step % 2 === 0) {
      const tickOsc = this.ctx.createOscillator();
      const tickGain = this.ctx.createGain();
      tickOsc.type = 'square';
      tickOsc.frequency.setValueAtTime(step % 4 === 0 ? 1480 : 1040, t);
      tickOsc.frequency.exponentialRampToValueAtTime(280, t + 0.025);

      const tickVol = (this.musicPaused ? 0.006 : 0.022) + threat * 0.032;
      tickGain.gain.setValueAtTime(tickVol, t);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      tickOsc.connect(tickGain);
      tickGain.connect(this.musicGain);
      tickOsc.start(t);
      tickOsc.stop(t + 0.035);
    }

    // D. INTENSE LAYER WHEN BUFFER CLOUD IS APPROACHING (threat > 0.06)
    if (threat > 0.06) {
      // 1. Pounding Heartbeat / Thriller Chase Kick
      const kickAccent = step % 4 === 0 || (threat > 0.4 && step % 4 === 2) || (threat > 0.72 && step % 2 === 1);
      if (kickAccent) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(115 + threat * 35, t);
        kickOsc.frequency.exponentialRampToValueAtTime(34, t + 0.13);

        const kickVol = (this.musicPaused ? 0.06 : 0.16) + threat * 0.26;
        kickGain.gain.setValueAtTime(kickVol, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.16);
      }

      // 2. Jagged Intense Chase Synth Riff
      const chaseFreq = INTENSE_CHASE_STEPS[step];
      const chaseOsc = this.ctx.createOscillator();
      const chaseFilter = this.ctx.createBiquadFilter();
      const chaseGain = this.ctx.createGain();

      chaseOsc.type = 'sawtooth';
      chaseOsc.frequency.setValueAtTime(chaseFreq, t);

      chaseFilter.type = 'bandpass';
      chaseFilter.frequency.setValueAtTime(650 + threat * 1850, t);
      chaseFilter.Q.value = 3.0;

      const chaseVol = (this.musicPaused ? 0.03 : 0.05) + threat * 0.15;
      chaseGain.gain.setValueAtTime(0.001, t);
      chaseGain.gain.linearRampToValueAtTime(chaseVol, t + 0.008);
      chaseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      chaseOsc.connect(chaseFilter);
      chaseFilter.connect(chaseGain);
      chaseGain.connect(this.musicGain);
      chaseOsc.start(t);
      chaseOsc.stop(t + 0.12);
    }

    this.stepIndex++;
  }

  public updateAmbience(opts: {
    inBuilding: boolean;
    approachingBuilding: boolean;
    bufferProximity: number; // 0..0.6 (from engine buffer.intensity)
    corruptionLevel: number; // 0..1
    restored: boolean;
  }): void {
    this.currentInBuilding = opts.inBuilding;
    this.currentApproachingBuilding = opts.approachingBuilding;
    this.currentCorruption = opts.corruptionLevel;
    this.currentRestored = opts.restored;

    // Normalize 0.10..0.60 buffer.intensity into 0..1 threat intensity
    const threat = opts.restored || opts.bufferProximity <= 0.02
      ? 0
      : Math.min(1, Math.max(0.16, opts.bufferProximity / 0.6));
    this.currentBufferThreat = threat;

    if (!opts.restored && !this.thrillerRunning) {
      this.startGameplayMusic();
    }

    if (
      !this.ctx ||
      !this.ambientFilter ||
      !this.ambientGain ||
      !this.tensionGain ||
      !this.bufferNoiseGain ||
      !this.droneOsc2 ||
      !this.intenseGain ||
      !this.intenseFilter
    ) {
      return;
    }
    const t = this.ctx.currentTime;

    if (opts.restored) {
      this.stopGameplayMusic();
      this.ambientFilter.frequency.setTargetAtTime(900, t, 0.4);
      this.ambientGain.gain.setTargetAtTime(0.04, t, 0.4);
      this.tensionGain.gain.setTargetAtTime(0, t, 0.2);
      this.intenseGain.gain.setTargetAtTime(0, t, 0.12);
      this.bufferNoiseGain.gain.setTargetAtTime(0, t, 0.15);
      this.droneOsc2.frequency.setTargetAtTime(164.81, t, 0.4);
      return;
    }

    const cutoff = opts.inBuilding
      ? 260
      : opts.approachingBuilding
        ? 410
        : 620 - opts.corruptionLevel * 200 + threat * 340;
    this.ambientFilter.frequency.setTargetAtTime(cutoff, t, 0.2);
    this.ambientGain.gain.setTargetAtTime(0.075 + threat * 0.04, t, 0.2);

    // Dissonant drone shift indoors or under Buffer threat
    const secondFreq = threat > 0.25 ? 116.54 : opts.inBuilding ? 123.47 : 130.81 - opts.corruptionLevel * 4;
    this.droneOsc2.frequency.setTargetAtTime(secondFreq, t, 0.25);

    this.tensionGain.gain.setTargetAtTime(opts.corruptionLevel * 0.08 + threat * 0.05, t, 0.18);

    // Intense tremolo string/alarm pad scales dynamically when Buffer approaches
    this.intenseGain.gain.setTargetAtTime(threat * 0.13, t, 0.09);
    this.intenseFilter.frequency.setTargetAtTime(
      460 + threat * 1200 + Math.sin(t * (9 + threat * 14)) * 220,
      t,
      0.06
    );

    this.bufferNoiseGain.gain.setTargetAtTime(threat * 0.15, t, 0.08);
    if (this.bufferFilter && threat > 0.08) {
      this.bufferFilter.frequency.setTargetAtTime(650 + Math.sin(t * 19) * 480, t, 0.04);
    }
  }

  public playFootstep(sprinting: boolean, inBuilding: boolean): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
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
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playTone(freq: number, duration = 0.25, type: OscillatorType = 'sine', volume = 0.18): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
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
    this.stopGameplayMusic();
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
    this.stopGameplayMusic();
    this.stopVictoryMusic();
    this.playTone(110, 0.6, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(82.41, 0.9, 'sawtooth', 0.18), 260);
    setTimeout(() => this.playTone(55, 1.4, 'triangle', 0.2), 550);
  }
}

export const audioEngine = new PingNineAudio();
