"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Apple,
  ArrowRight,
  Carrot,
  CircleHelp,
  Heart,
  Leaf,
  MousePointer2,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Sprout,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import styles from "./HarvestSlash.module.css";

type Phase = "intro" | "guide" | "playing" | "levelComplete" | "gameOver" | "victory";
type Category = "root" | "fruit" | "hazard";
type Shape = "carrot" | "potato" | "onion" | "apple" | "banana" | "melon" | "rock" | "weed" | "log";
type Callout = { key: number; text: string; kind: "good" | "bad" } | null;

type Level = {
  number: number;
  name: string;
  instruction: string;
  target: "all" | "root" | "fruit";
  accent: string;
  spawnEvery: number;
};

type ItemSpec = {
  name: string;
  category: Category;
  shape: Shape;
  color: string;
  accent: string;
};

type GameItem = ItemSpec & {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  gravity: number;
  rotation: number;
  rotationSpeed: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

type FloatText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
};

type TrailPoint = { x: number; y: number; life: number };
type Point = { x: number; y: number };

type Hud = {
  level: number;
  score: number;
  combo: number;
  lives: number;
  bestCombo: number;
};

const TARGET_SCORE = 20;
const LEVELS: Level[] = [
  {
    number: 1,
    name: "Open harvest",
    instruction: "Slice every crop. Leave hazards untouched.",
    target: "all",
    accent: "#d9ff68",
    spawnEvery: 900,
  },
  {
    number: 2,
    name: "Root signal",
    instruction: "Roots only. Let every fruit pass.",
    target: "root",
    accent: "#ffb65b",
    spawnEvery: 780,
  },
  {
    number: 3,
    name: "Ripe run",
    instruction: "Ripe fruit only. Protect the roots.",
    target: "fruit",
    accent: "#ff7167",
    spawnEvery: 680,
  },
];

const ROOTS: ItemSpec[] = [
  { name: "Carrot", category: "root", shape: "carrot", color: "#ff842b", accent: "#b8ef62" },
  { name: "Potato", category: "root", shape: "potato", color: "#c99552", accent: "#f1c982" },
  { name: "Onion", category: "root", shape: "onion", color: "#b875d2", accent: "#e9c4f4" },
];

const FRUITS: ItemSpec[] = [
  { name: "Apple", category: "fruit", shape: "apple", color: "#ff4d4d", accent: "#ffaca0" },
  { name: "Banana", category: "fruit", shape: "banana", color: "#ffd54f", accent: "#fff1a3" },
  { name: "Melon", category: "fruit", shape: "melon", color: "#50b96b", accent: "#b7ef6e" },
];

const HAZARDS: ItemSpec[] = [
  { name: "Boulder", category: "hazard", shape: "rock", color: "#66706d", accent: "#a4aca7" },
  { name: "Weed", category: "hazard", shape: "weed", color: "#365b3b", accent: "#6b8d54" },
  { name: "Log", category: "hazard", shape: "log", color: "#83513a", accent: "#bc8052" },
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function createItem(level: Level, width: number, height: number, id: number): GameItem {
  const roll = Math.random();
  let spec: ItemSpec;
  if (roll < 0.18) {
    spec = pick(HAZARDS);
  } else if (level.target === "root") {
    spec = roll < 0.72 ? pick(ROOTS) : pick(FRUITS);
  } else if (level.target === "fruit") {
    spec = roll < 0.72 ? pick(FRUITS) : pick(ROOTS);
  } else {
    spec = Math.random() < 0.5 ? pick(ROOTS) : pick(FRUITS);
  }

  const radius = Math.max(31, Math.min(46, width * 0.038));
  return {
    ...spec,
    id,
    x: radius + Math.random() * Math.max(1, width - radius * 2),
    y: height + radius + 8,
    radius: spec.shape === "rock" ? radius * 1.08 : radius,
    vx: (Math.random() - 0.5) * (level.number + 4.8),
    vy: -(10.4 + Math.random() * 3.8 + Math.min(4, height / 300)),
    gravity: 0.19 + Math.random() * 0.035,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.11,
  };
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(5, -15, 22, -15, 27, -4);
  ctx.bezierCurveTo(18, 4, 7, 5, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawGameItem(ctx: CanvasRenderingContext2D, item: GameItem, now: number) {
  const r = item.radius;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);
  ctx.shadowColor = item.category === "hazard" ? "rgba(255, 71, 87, .72)" : "rgba(4, 14, 8, .42)";
  ctx.shadowBlur = item.category === "hazard" ? 18 : 14;
  ctx.shadowOffsetY = 8;

  if (item.category === "hazard") {
    ctx.save();
    ctx.rotate(-item.rotation);
    ctx.strokeStyle = `rgba(255, 100, 94, ${0.58 + Math.sin(now / 120) * 0.2})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  switch (item.shape) {
    case "carrot": {
      ctx.fillStyle = "#4f8f45";
      drawLeaf(ctx, -4, -r * 0.72, -1.15, r / 52);
      drawLeaf(ctx, 3, -r * 0.77, -0.2, r / 55);
      drawLeaf(ctx, 7, -r * 0.68, 0.72, r / 58);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.44, -r * 0.5);
      ctx.quadraticCurveTo(0, -r * 0.72, r * 0.44, -r * 0.5);
      ctx.lineTo(r * 0.08, r * 0.84);
      ctx.quadraticCurveTo(0, r, -r * 0.08, r * 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(114, 54, 17, .42)";
      ctx.lineWidth = 2;
      for (const y of [-0.2, 0.12, 0.42]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.24, r * y);
        ctx.lineTo(r * 0.12, r * (y + 0.08));
        ctx.stroke();
      }
      break;
    }
    case "potato": {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 0.78, r * 0.62, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(91, 55, 26, .38)";
      for (const [x, y] of [[-0.3, -0.18], [0.2, -0.3], [0.34, 0.16], [-0.22, 0.3]]) {
        ctx.beginPath();
        ctx.ellipse(r * x, r * y, 3.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "onion": {
      ctx.strokeStyle = "#5b8d48";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5, -r * 0.52);
      ctx.quadraticCurveTo(-12, -r * 0.95, -2, -r * 1.15);
      ctx.moveTo(3, -r * 0.55);
      ctx.quadraticCurveTo(16, -r * 0.92, 12, -r * 1.18);
      ctx.stroke();
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.62);
      ctx.bezierCurveTo(r * 0.75, -r * 0.42, r * 0.78, r * 0.48, 0, r * 0.73);
      ctx.bezierCurveTo(-r * 0.78, r * 0.48, -r * 0.75, -r * 0.42, 0, -r * 0.62);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, r * 0.42, -1.3, 1.3);
      ctx.stroke();
      break;
    }
    case "apple": {
      ctx.fillStyle = "#5a3927";
      ctx.fillRect(-2, -r * 0.86, 5, r * 0.34);
      ctx.fillStyle = "#5aa549";
      drawLeaf(ctx, 2, -r * 0.7, -0.42, r / 62);
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(-r * 0.25, 0, r * 0.58, 0, Math.PI * 2);
      ctx.arc(r * 0.25, 0, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.34)";
      ctx.beginPath();
      ctx.ellipse(-r * 0.28, -r * 0.2, r * 0.13, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "banana": {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, -r * 0.3);
      ctx.bezierCurveTo(-r * 0.2, r * 0.75, r * 0.68, r * 0.58, r * 0.76, -r * 0.2);
      ctx.bezierCurveTo(r * 0.28, r * 0.24, -r * 0.22, r * 0.18, -r * 0.55, -r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#9f7924";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#6d5421";
      ctx.beginPath();
      ctx.arc(-r * 0.63, -r * 0.39, 4, 0, Math.PI * 2);
      ctx.arc(r * 0.75, -r * 0.22, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "melon": {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = item.accent;
      ctx.lineWidth = 4;
      for (const x of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.ellipse(r * x, 0, r * 0.18, r * 0.68, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "rock": {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, r * 0.5);
      ctx.lineTo(-r * 0.82, -r * 0.15);
      ctx.lineTo(-r * 0.35, -r * 0.72);
      ctx.lineTo(r * 0.42, -r * 0.62);
      ctx.lineTo(r * 0.8, -r * 0.05);
      ctx.lineTo(r * 0.62, r * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = item.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.22, -r * 0.42);
      ctx.lineTo(r * 0.12, -r * 0.08);
      ctx.lineTo(-r * 0.04, r * 0.26);
      ctx.moveTo(r * 0.12, -r * 0.08);
      ctx.lineTo(r * 0.42, -r * 0.28);
      ctx.stroke();
      break;
    }
    case "weed": {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.accent;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, r * 0.7);
      ctx.quadraticCurveTo(-r * 0.05, 0, -r * 0.18, -r * 0.72);
      ctx.moveTo(0, r * 0.7);
      ctx.quadraticCurveTo(r * 0.08, 0, r * 0.32, -r * 0.62);
      ctx.stroke();
      drawLeaf(ctx, -r * 0.08, -r * 0.08, 2.65, r / 54);
      drawLeaf(ctx, r * 0.1, r * 0.12, -0.45, r / 57);
      drawLeaf(ctx, -r * 0.14, r * 0.28, 2.8, r / 62);
      break;
    }
    case "log": {
      ctx.rotate(0.35);
      ctx.fillStyle = item.color;
      roundedRect(ctx, -r * 0.78, -r * 0.38, r * 1.56, r * 0.76, r * 0.2);
      ctx.fill();
      ctx.fillStyle = item.accent;
      ctx.beginPath();
      ctx.ellipse(r * 0.66, 0, r * 0.24, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(86,49,29,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r * 0.66, 0, r * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.16)";
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.14);
      ctx.lineTo(r * 0.28, -r * 0.14);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: TrailPoint[]) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#c9ff56";
  ctx.shadowBlur = 18;
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const current = trail[index];
    ctx.strokeStyle = `rgba(221, 255, 123, ${Math.max(0, current.life)})`;
    ctx.lineWidth = 2 + current.life * 7;
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], texts: FloatText[]) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * Math.max(0.2, particle.life), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const text of texts) {
    ctx.globalAlpha = Math.max(0, text.life);
    ctx.fillStyle = text.color;
    ctx.font = "700 18px Outfit, sans-serif";
    ctx.shadowColor = "rgba(0,0,0,.7)";
    ctx.shadowBlur = 8;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

const overlayMotion = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

export function HarvestSlash() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const phaseRef = useRef<Phase>("intro");
  const previousPhaseRef = useRef<Phase>("intro");
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const levelRef = useRef(1);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const livesRef = useRef(3);
  const bestComboRef = useRef(0);
  const itemsRef = useRef<GameItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const textsRef = useRef<FloatText[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const spawnElapsedRef = useRef(0);
  const objectIdRef = useRef(0);
  const lastSliceAtRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const calloutTimerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [hud, setHud] = useState<Hud>({ level: 1, score: 0, combo: 0, lives: 3, bestCombo: 0 });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [callout, setCallout] = useState<Callout>(null);
  const [impact, setImpact] = useState<"good" | "bad" | null>(null);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const syncHud = useCallback(() => {
    setHud({
      level: levelRef.current,
      score: scoreRef.current,
      combo: comboRef.current,
      lives: livesRef.current,
      bestCombo: bestComboRef.current,
    });
  }, []);

  const playSound = useCallback((kind: "slice" | "hit" | "level" | "win") => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;
    const audio = audioRef.current ?? new AudioCtor();
    audioRef.current = audio;
    if (audio.state === "suspended") void audio.resume();

    const notes = kind === "slice" ? [520, 760] : kind === "hit" ? [145, 82] : kind === "level" ? [392, 523, 659] : [392, 523, 659, 784];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = kind === "hit" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime + index * 0.075);
      if (kind === "hit") oscillator.frequency.exponentialRampToValueAtTime(52, audio.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0001, audio.currentTime + index * 0.075);
      gain.gain.exponentialRampToValueAtTime(kind === "hit" ? 0.1 : 0.055, audio.currentTime + index * 0.075 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + index * 0.075 + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(audio.currentTime + index * 0.075);
      oscillator.stop(audio.currentTime + index * 0.075 + 0.2);
    });
  }, []);

  const showCallout = useCallback((text: string, kind: "good" | "bad") => {
    if (calloutTimerRef.current) window.clearTimeout(calloutTimerRef.current);
    setCallout({ key: Date.now(), text, kind });
    calloutTimerRef.current = window.setTimeout(() => setCallout(null), 950);
  }, []);

  const addBurst = useCallback((item: GameItem, color: string, label: string) => {
    for (let index = 0; index < 20; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 7;
      particlesRef.current.push({
        x: item.x,
        y: item.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: index % 3 === 0 ? item.accent : color,
        size: 3 + Math.random() * 5,
      });
    }
    textsRef.current.push({ x: item.x, y: item.y - item.radius, text: label, color, life: 1 });
  }, []);

  const finishLevel = useCallback(() => {
    itemsRef.current = [];
    pointerRef.current.active = false;
    if (levelRef.current === LEVELS.length) {
      playSound("win");
      changePhase("victory");
    } else {
      playSound("level");
      changePhase("levelComplete");
    }
  }, [changePhase, playSound]);

  const resolveSlice = useCallback((item: GameItem) => {
    if (phaseRef.current !== "playing") return;
    const level = LEVELS[levelRef.current - 1];
    const valid = item.category !== "hazard" && (level.target === "all" || level.target === item.category);

    if (!valid) {
      livesRef.current -= 1;
      comboRef.current = 0;
      addBurst(item, "#ff756b", "BLADE HIT");
      setImpact("bad");
      window.setTimeout(() => setImpact(null), 180);
      playSound("hit");
      navigator.vibrate?.([45, 30, 45]);
      showCallout(item.category === "hazard" ? `${item.name} damaged the blade` : `${level.target === "root" ? "Roots" : "Fruit"} only this round`, "bad");
      syncHud();
      if (livesRef.current <= 0) {
        changePhase("gameOver");
        pointerRef.current.active = false;
      }
      return;
    }

    const now = performance.now();
    comboRef.current = now - lastSliceAtRef.current < 850 ? comboRef.current + 1 : 1;
    lastSliceAtRef.current = now;
    bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
    const multiplier = Math.min(4, 1 + Math.floor((comboRef.current - 1) / 4));
    scoreRef.current = Math.min(TARGET_SCORE, scoreRef.current + multiplier);
    addBurst(item, level.accent, multiplier > 1 ? `+${multiplier}  x${multiplier}` : "+1");
    setImpact("good");
    window.setTimeout(() => setImpact(null), 100);
    playSound("slice");
    navigator.vibrate?.(12);
    if (comboRef.current === 4 || comboRef.current === 8 || comboRef.current === 12) {
      showCallout(`${comboRef.current} cut streak`, "good");
    }
    syncHud();
    if (scoreRef.current >= TARGET_SCORE) finishLevel();
  }, [addBurst, changePhase, finishLevel, playSound, showCallout, syncHud]);

  const sliceAlong = useCallback((start: Point, end: Point) => {
    for (let index = itemsRef.current.length - 1; index >= 0; index -= 1) {
      const item = itemsRef.current[index];
      if (distanceToSegment(item, start, end) <= item.radius + 7) {
        itemsRef.current.splice(index, 1);
        resolveSlice(item);
        if (phaseRef.current !== "playing") break;
      }
    }
  }, [resolveSlice]);

  const beginLevel = useCallback((levelNumber: number) => {
    levelRef.current = levelNumber;
    scoreRef.current = 0;
    comboRef.current = 0;
    livesRef.current = 3;
    itemsRef.current = [];
    particlesRef.current = [];
    textsRef.current = [];
    trailRef.current = [];
    spawnElapsedRef.current = 0;
    lastSliceAtRef.current = 0;
    syncHud();
    changePhase("playing");
    showCallout(LEVELS[levelNumber - 1].instruction, "good");
  }, [changePhase, showCallout, syncHud]);

  const startGame = useCallback(() => {
    bestComboRef.current = 0;
    if (soundEnabledRef.current && !audioRef.current) audioRef.current = new window.AudioContext();
    beginLevel(1);
  }, [beginLevel]);

  const openGuide = useCallback(() => {
    previousPhaseRef.current = phaseRef.current;
    pointerRef.current.active = false;
    changePhase("guide");
  }, [changePhase]);

  const closeGuide = useCallback(() => {
    changePhase(previousPhaseRef.current === "guide" ? "intro" : previousPhaseRef.current);
  }, [changePhase]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    if (!next) void audioRef.current?.suspend();
    else void audioRef.current?.resume();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const elapsedMs = Math.min(34, now - last);
      const frameScale = elapsedMs / 16.667;
      last = now;
      const { width, height, dpr } = sizeRef.current;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      if (phaseRef.current === "playing") {
        const level = LEVELS[levelRef.current - 1];
        spawnElapsedRef.current += elapsedMs;
        if (spawnElapsedRef.current >= level.spawnEvery) {
          spawnElapsedRef.current = 0;
          itemsRef.current.push(createItem(level, width, height, objectIdRef.current++));
        }
      }

      for (let index = itemsRef.current.length - 1; index >= 0; index -= 1) {
        const item = itemsRef.current[index];
        item.x += item.vx * frameScale;
        item.y += item.vy * frameScale;
        item.vy += item.gravity * frameScale;
        item.rotation += item.rotationSpeed * frameScale;
        drawGameItem(context, item, now);
        if (item.y > height + item.radius * 2 || item.x < -item.radius * 2 || item.x > width + item.radius * 2) {
          itemsRef.current.splice(index, 1);
        }
      }

      for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
        const particle = particlesRef.current[index];
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;
        particle.vy += 0.13 * frameScale;
        particle.life -= 0.032 * frameScale;
        if (particle.life <= 0) particlesRef.current.splice(index, 1);
      }
      for (let index = textsRef.current.length - 1; index >= 0; index -= 1) {
        const text = textsRef.current[index];
        text.y -= 0.8 * frameScale;
        text.life -= 0.022 * frameScale;
        if (text.life <= 0) textsRef.current.splice(index, 1);
      }
      for (let index = trailRef.current.length - 1; index >= 0; index -= 1) {
        trailRef.current[index].life -= 0.07 * frameScale;
        if (trailRef.current[index].life <= 0) trailRef.current.splice(index, 1);
      }
      drawParticles(context, particlesRef.current, textsRef.current);
      drawTrail(context, trailRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => () => {
    if (calloutTimerRef.current) window.clearTimeout(calloutTimerRef.current);
    void audioRef.current?.close();
  }, []);

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    pointerRef.current = { ...point, active: true };
    trailRef.current.push({ ...point, life: 1 });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerRef.current.active || phaseRef.current !== "playing") return;
    const previous = { x: pointerRef.current.x, y: pointerRef.current.y };
    const point = canvasPoint(event);
    pointerRef.current = { ...point, active: true };
    trailRef.current.push({ ...point, life: 1 });
    if (trailRef.current.length > 18) trailRef.current.shift();
    sliceAlong(previous, point);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointerRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const level = LEVELS[hud.level - 1];
  const multiplier = Math.min(4, 1 + Math.floor(Math.max(0, hud.combo - 1) / 4));

  return (
    <main className={`${styles.game} ${impact ? styles[`impact${impact === "good" ? "Good" : "Bad"}`] : ""}`}>
      <video className={styles.backgroundVideo} autoPlay muted loop playsInline poster="/udyaan-aerial-poster.jpg" aria-hidden="true">
        <source src="/udyaan-aerial.mp4" type="video/mp4" />
      </video>
      <div className={styles.atmosphere} aria-hidden="true" />

      <section className={styles.stage} ref={stageRef} aria-label="Harvest Slash game">
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Press and drag to slice crops"
        />

        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}><Sprout size={18} strokeWidth={2.1} /></span>
            <span><b>Udyaan</b><small>Field reflex lab</small></span>
          </div>
          <div className={styles.topActions}>
            <button type="button" className={styles.iconButton} onClick={openGuide} aria-label="Open game guide" title="Game guide">
              <CircleHelp size={19} />
            </button>
            <button type="button" className={styles.iconButton} onClick={toggleSound} aria-label={soundEnabled ? "Mute sound" : "Enable sound"} title={soundEnabled ? "Mute sound" : "Enable sound"}>
              {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>
        </header>

        {phase !== "intro" && phase !== "guide" && (
          <motion.div className={styles.hud} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.hudMetric}>
              <span>Round</span>
              <strong>0{hud.level}<i>/03</i></strong>
            </div>
            <div className={styles.hudMetric}>
              <span>Harvest</span>
              <strong>{String(hud.score).padStart(2, "0")}<i>/{TARGET_SCORE}</i></strong>
            </div>
            <div className={`${styles.hudMetric} ${hud.combo >= 4 ? styles.comboLive : ""}`}>
              <span>Streak</span>
              <strong>{hud.combo}<i> x{multiplier}</i></strong>
            </div>
            <div className={styles.integrity} aria-label={`${hud.lives} blade integrity remaining`}>
              <span>Blade</span>
              <div>{[0, 1, 2].map((heart) => <Heart key={heart} size={18} fill={heart < hud.lives ? "currentColor" : "none"} className={heart < hud.lives ? styles.heartActive : styles.heartEmpty} />)}</div>
            </div>
          </motion.div>
        )}

        {phase === "playing" && (
          <motion.div className={styles.mission} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} key={hud.level}>
            <span className={styles.missionIndex}>0{level.number}</span>
            <div>
              <small>Current rule</small>
              <strong>{level.name}</strong>
              <p>{level.instruction}</p>
            </div>
            <div className={styles.progress} aria-label={`${hud.score} of ${TARGET_SCORE} harvest points`}>
              <i style={{ width: `${hud.score / TARGET_SCORE * 100}%`, background: level.accent }} />
            </div>
          </motion.div>
        )}

        {phase === "playing" && (
          <div className={styles.targetLegend}>
            <Target size={15} />
            <span>{level.target === "all" ? "All crops" : level.target === "root" ? "Roots only" : "Fruit only"}</span>
            <i />
            <ShieldAlert size={15} />
            <span>Red ring = hazard</span>
          </div>
        )}

        <AnimatePresence>
          {callout && (
            <motion.div
              key={callout.key}
              className={`${styles.callout} ${callout.kind === "bad" ? styles.calloutBad : ""}`}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {callout.kind === "good" ? <Zap size={16} /> : <ShieldAlert size={16} />}
              {callout.text}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.section key="intro" className={styles.intro} {...overlayMotion}>
              <p className={styles.eyebrow}><span /> Field trial 01</p>
              <h1>Harvest<br /><em>Slash</em></h1>
              <p className={styles.introCopy}>Three harvest rules. One clean blade. Read the field before you move.</p>
              <div className={styles.introActions}>
                <button type="button" className={styles.primaryButton} onClick={startGame}>
                  <Play size={18} fill="currentColor" /> Enter the field
                </button>
                <button type="button" className={styles.textButton} onClick={openGuide}>
                  <CircleHelp size={17} /> View rules
                </button>
              </div>
              <div className={styles.introStats}>
                <span><b>03</b> rounds</span>
                <span><b>20</b> energy each</span>
                <span><b>03</b> blade hits</span>
              </div>
            </motion.section>
          )}

          {phase === "guide" && (
            <motion.section key="guide" className={styles.guide} {...overlayMotion}>
              <button type="button" className={styles.closeButton} onClick={closeGuide} aria-label="Close guide"><X size={20} /></button>
              <p className={styles.panelKicker}>Field protocol</p>
              <h2>Read. Aim. Cut.</h2>
              <div className={styles.guideGrid}>
                <div><MousePointer2 /><span><b>Press + drag</b><small>Your blade follows the pointer.</small></span></div>
                <div><Carrot /><span><b>Round 2: roots</b><small>Carrot, potato and onion.</small></span></div>
                <div><Apple /><span><b>Round 3: fruit</b><small>Apple, banana and melon.</small></span></div>
                <div><ShieldAlert /><span><b>Avoid red rings</b><small>Three hits break the blade.</small></span></div>
              </div>
              <button type="button" className={styles.primaryButton} onClick={closeGuide}>Understood <ArrowRight size={18} /></button>
            </motion.section>
          )}

          {phase === "levelComplete" && (
            <motion.section key="level" className={styles.resultPanel} {...overlayMotion}>
              <span className={styles.resultIcon}><Sparkles size={30} /></span>
              <p className={styles.panelKicker}>Round 0{hud.level} cleared</p>
              <h2>Pattern locked.</h2>
              <p>Best streak: {hud.bestCombo}. The field changes now.</p>
              <button type="button" className={styles.primaryButton} onClick={() => beginLevel(hud.level + 1)}>
                Enter round 0{hud.level + 1} <ArrowRight size={18} />
              </button>
            </motion.section>
          )}

          {phase === "gameOver" && (
            <motion.section key="gameover" className={styles.resultPanel} {...overlayMotion}>
              <span className={`${styles.resultIcon} ${styles.resultDanger}`}><ShieldAlert size={30} /></span>
              <p className={styles.panelKicker}>Blade integrity: zero</p>
              <h2>Reset your read.</h2>
              <p>Round 0{hud.level} stays unlocked. Slow down and separate signal from noise.</p>
              <button type="button" className={styles.primaryButton} onClick={() => beginLevel(hud.level)}>
                <RotateCcw size={18} /> Retry round
              </button>
            </motion.section>
          )}

          {phase === "victory" && (
            <motion.section key="victory" className={styles.victory} {...overlayMotion}>
              <span className={styles.trophy}><Trophy size={34} /></span>
              <p className={styles.panelKicker}>Field test cleared</p>
              <h2>Good eyes.<br />Clean decisions.</h2>
              <p>You held the rule through three changing fields. Your survey is ready.</p>
              <div className={styles.victoryStats}>
                <span><b>{hud.bestCombo}</b> best streak</span>
                <span><b>03</b> rounds cleared</span>
              </div>
              <Link href="/survey" className={styles.primaryButton}>Begin survey <ArrowRight size={18} /></Link>
              <button type="button" className={styles.textButton} onClick={startGame}><RotateCcw size={16} /> Run it again</button>
            </motion.section>
          )}
        </AnimatePresence>

        {phase === "playing" && (
          <div className={styles.dragCue}><MousePointer2 size={16} /><span>Press + drag to slice</span></div>
        )}
      </section>
    </main>
  );
}
