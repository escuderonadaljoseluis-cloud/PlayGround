/* ============================================================
   Audio — everything synthesized with WebAudio, zero assets.
   ============================================================ */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicMode = 'none';
    this.musicTimer = null;
    this.nextTime = 0;
    this.step = 0;
    this.tempo = 128;
    this.lastHit = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.17;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);

      // 2 second noise buffer
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.startMusicLoop();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime + 0.12);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ freq = 440, endFreq = null, dur = 0.2, type = 'sine', gain = 0.2, attack = 0.005, when = 0, dest = null, detune = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    if (detune) osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise({ dur = 0.2, gain = 0.2, freq = 1200, q = 1, type = 'bandpass', when = 0, endFreq = null }) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  whoosh(power = 1) {
    this.noise({ dur: 0.14, gain: 0.12 * power, freq: 520, endFreq: 1900, q: 0.9 });
  }

  punch(power = 1) {
    this.noise({ dur: 0.09, gain: 0.22 * power, freq: 1600, endFreq: 300, q: 0.7 });
    this.tone({ freq: 150, endFreq: 52, dur: 0.16, type: 'sine', gain: 0.32 * power });
  }

  hit(power = 1, heavy = false) {
    const now = performance.now();
    if (now - this.lastHit < 25) return;
    this.lastHit = now;
    this.punch(power);
    this.noise({ dur: 0.05, gain: 0.13 * power, freq: 3600, q: 2, type: 'highpass' });
    if (heavy) {
      this.tone({ freq: 72, endFreq: 34, dur: 0.32, type: 'triangle', gain: 0.36 });
      this.noise({ dur: 0.24, gain: 0.16, freq: 280, endFreq: 90, q: 0.5 });
    }
  }

  block() {
    this.tone({ freq: 720, endFreq: 420, dur: 0.1, type: 'square', gain: 0.09 });
    this.noise({ dur: 0.08, gain: 0.1, freq: 2600, q: 2.6, type: 'bandpass' });
    this.tone({ freq: 240, endFreq: 180, dur: 0.09, type: 'sine', gain: 0.1 });
  }

  jump() {
    this.tone({ freq: 220, endFreq: 560, dur: 0.18, type: 'sine', gain: 0.13 });
    this.noise({ dur: 0.12, gain: 0.05, freq: 800, endFreq: 1600, q: 1 });
  }

  land() {
    this.tone({ freq: 110, endFreq: 55, dur: 0.14, type: 'sine', gain: 0.16 });
    this.noise({ dur: 0.1, gain: 0.07, freq: 500, endFreq: 160, q: 0.6 });
  }

  specialCharge() {
    this.tone({ freq: 180, endFreq: 720, dur: 0.42, type: 'sawtooth', gain: 0.1 });
    this.noise({ dur: 0.42, gain: 0.08, freq: 340, endFreq: 2400, q: 0.8 });
    this.tone({ freq: 360, endFreq: 1440, dur: 0.4, type: 'triangle', gain: 0.07, when: 0.05 });
  }

  specialBoom(color = 0) {
    const base = [180, 140, 110, 240][color % 4] || 140;
    this.tone({ freq: base, endFreq: 38, dur: 0.5, type: 'sawtooth', gain: 0.3 });
    this.noise({ dur: 0.5, gain: 0.3, freq: 900, endFreq: 90, q: 0.5 });
    this.noise({ dur: 0.18, gain: 0.16, freq: 4000, q: 1.4, type: 'highpass' });
  }

  ko() {
    this.tone({ freq: 90, endFreq: 28, dur: 0.9, type: 'triangle', gain: 0.45 });
    this.noise({ dur: 0.7, gain: 0.25, freq: 300, endFreq: 60, q: 0.4 });
    this.cheer(1.6, 0.18);
  }

  cheer(dur = 1.2, gain = 0.12) {
    this.noise({ dur, gain, freq: 900, endFreq: 1300, q: 0.7 });
    this.noise({ dur: dur * 0.9, gain: gain * 0.7, freq: 2200, endFreq: 1600, q: 0.8, when: 0.08, type: 'bandpass' });
    if (Math.random() > 0.4) {
      this.tone({ freq: 1400, endFreq: 2000, dur: 0.25, type: 'sine', gain: 0.03, when: 0.2 + Math.random() * 0.3 });
    }
    if (Math.random() > 0.5) {
      this.tone({ freq: 1800, endFreq: 1200, dur: 0.3, type: 'sine', gain: 0.025, when: 0.4 + Math.random() * 0.3 });
    }
  }

  count() {
    this.tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.09 });
  }

  fight() {
    this.tone({ freq: 880, dur: 0.09, type: 'square', gain: 0.1 });
    this.tone({ freq: 1320, dur: 0.16, type: 'square', gain: 0.1, when: 0.1 });
    this.cheer(0.6, 0.1);
  }

  meterFull() {
    this.tone({ freq: 1046, dur: 0.1, type: 'sine', gain: 0.11 });
    this.tone({ freq: 1568, dur: 0.18, type: 'sine', gain: 0.1, when: 0.09 });
  }

  click() {
    this.tone({ freq: 660, endFreq: 990, dur: 0.06, type: 'square', gain: 0.05 });
  }

  back() {
    this.tone({ freq: 500, endFreq: 330, dur: 0.09, type: 'square', gain: 0.05 });
  }

  win() {
    const seq = [523, 659, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'square', gain: 0.09, when: i * 0.1 }));
    this.cheer(1.8, 0.2);
  }

  lose() {
    const seq = [392, 349, 311, 233];
    seq.forEach((f, i) => this.tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.11, when: i * 0.16 }));
    this.noise({ dur: 1.1, gain: 0.04, freq: 500, q: 1 });
  }

  /* ---------- music ---------- */
  setMusic(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.step = 0;
    this.nextTime = 0;
    this.tempo = mode === 'fight' ? 138 : 104;
  }

  startMusicLoop() {
    if (this.musicTimer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  scheduleMusic() {
    if (!this.ctx || this.musicMode === 'none' || this.muted) {
      if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    const ahead = this.ctx.currentTime + 0.25;
    const spb = 60 / this.tempo;
    while (this.nextTime < ahead) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb / 2;
      this.step = (this.step + 1) % 16;
    }
  }

  playStep(step, time, spb) {
    const m = this.musicGain;
    const semi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const when = Math.max(0, time - this.ctx.currentTime);
    const isFight = this.musicMode === 'fight';
    const bassSeq = isFight ? [33, 33, 45, 33, 36, 36, 43, 36] : [33, 33, 33, 33, 29, 29, 31, 31];
    const arpSeq = isFight ? [69, 72, 76, 72, 69, 76, 79, 76] : [57, 64, 69, 64, 57, 64, 67, 64];

    // kick
    if (step % 4 === 0 || (isFight && step === 10)) {
      const t0 = time;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, t0);
      osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(g);
      g.connect(m);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
    // snare
    if (step === 4 || step === 12) {
      this.musicNoise(time, 0.12, 0.11, 1800, 1.4);
    }
    // hats
    if (step % 2 === 0) {
      this.musicNoise(time, 0.035, step % 4 === 0 ? 0.035 : 0.022, 7200, 0.8, 'highpass');
    }
    // bass
    if (step % 2 === 0) {
      const n = bassSeq[(step / 2) % bassSeq.length];
      this.musicTone(time, semi(n), spb * 0.42, isFight ? 'sawtooth' : 'triangle', isFight ? 0.075 : 0.06, 120);
    }
    // arp
    if (isFight ? step % 2 === 1 : step % 4 === 2) {
      const n = arpSeq[step % arpSeq.length];
      this.musicTone(time, semi(n), spb * 0.26, 'square', isFight ? 0.018 : 0.022);
    }
    // pad on menu
    if (!isFight && step === 0) {
      this.musicTone(time, semi(45), spb * 3.6, 'sine', 0.035, 120);
      this.musicTone(time, semi(52), spb * 3.6, 'triangle', 0.02, 130);
    }
  }

  musicTone(time, freq, dur, type, gain, detune = 0) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  musicNoise(time, dur, gain, freq, q, type = 'bandpass') {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}
