let ctx: AudioContext | null = null;
let muted = false;

function haptic(pattern: number | number[]) {
  if (muted || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
}

type ToneOptions = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
};

function tone({ freq, to, dur = 0.12, type = "sine", gain = 0.05, delay = 0 }: ToneOptions) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.3, gain = 0.12) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const frames = Math.floor(a.sampleRate * dur);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = a.createBufferSource();
  const g = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  click: () => {
    tone({ freq: 520, to: 700, dur: 0.07, type: "triangle", gain: 0.04 });
    haptic(8);
  },
  drawStart: () => tone({ freq: 290, to: 430, dur: 0.1, type: "sine", gain: 0.03 }),
  plant: () => {
    tone({ freq: 510, to: 320, dur: 0.13, type: "triangle", gain: 0.042 });
    tone({ freq: 730, to: 560, dur: 0.08, type: "sine", gain: 0.02, delay: 0.04 });
  },
  blocked: () => {
    tone({ freq: 180, to: 120, dur: 0.16, type: "square", gain: 0.035 });
    haptic([16, 30, 16]);
  },
  launch: () => {
    tone({ freq: 260, to: 560, dur: 0.18, type: "sawtooth", gain: 0.03 });
    tone({ freq: 520, to: 880, dur: 0.15, type: "sine", gain: 0.03, delay: 0.1 });
    haptic(20);
  },
  seed: () => {
    tone({ freq: 660, dur: 0.09, type: "sine", gain: 0.05 });
    tone({ freq: 990, dur: 0.12, type: "sine", gain: 0.045, delay: 0.07 });
    tone({ freq: 1320, dur: 0.09, type: "triangle", gain: 0.025, delay: 0.14 });
    haptic([12, 25, 12]);
  },
  storm: () => {
    noise(0.48, 0.14);
    tone({ freq: 135, to: 38, dur: 0.42, type: "sawtooth", gain: 0.055 });
    haptic([35, 25, 55]);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.2, type: "triangle", gain: 0.05, delay: i * 0.1 }),
    );
    haptic([18, 35, 18, 35, 40]);
  },
  lose: () => {
    [400, 330, 262].forEach((f, i) =>
      tone({ freq: f, dur: 0.24, type: "sine", gain: 0.05, delay: i * 0.12 }),
    );
    haptic([45, 55, 70]);
  },
  star: (i: number) => tone({ freq: 700 + i * 220, dur: 0.18, type: "triangle", gain: 0.05 }),
};
