const AudioContextClass = window.AudioContext || window.webkitAudioContext;

export class CrystalAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  async unlock() {
    if (!this.enabled || !AudioContextClass) return;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  tone({ frequency, duration = 0.13, gain = 0.16, type = "sine", delay = 0, detune = 0 }) {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime(detune, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3_600, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.014);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  ui() {
    this.tone({ frequency: 640, duration: 0.07, gain: 0.1, type: "triangle" });
  }

  select() {
    this.tone({ frequency: 510, duration: 0.1, gain: 0.12, type: "sine" });
    this.tone({ frequency: 760, duration: 0.11, gain: 0.07, type: "triangle", delay: 0.025 });
  }

  place(cellCount = 1) {
    const root = 320 + Math.min(cellCount, 6) * 22;
    this.tone({ frequency: root, duration: 0.11, gain: 0.16, type: "triangle" });
    this.tone({ frequency: root * 1.5, duration: 0.12, gain: 0.08, type: "sine", delay: 0.025 });
  }

  clear(lineCount = 1, combo = 1) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteCount = Math.min(notes.length, 2 + lineCount + Math.min(combo - 1, 1));
    notes.slice(0, noteCount).forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.28,
        gain: 0.12 - index * 0.012,
        type: index % 2 ? "triangle" : "sine",
        delay: index * 0.065,
        detune: combo > 2 ? 4 : 0
      });
    });
  }

  invalid() {
    this.tone({ frequency: 180, duration: 0.12, gain: 0.08, type: "triangle" });
  }

  gameOver() {
    [392, 329.63, 261.63].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.34, gain: 0.1, type: "sine", delay: index * 0.14 });
    });
  }
}
