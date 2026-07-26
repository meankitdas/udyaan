"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Droplets, Hand, Leaf, Sparkles, Sprout, Sun } from "lucide-react";
import styles from "./SeedJourney.module.css";

type Phase = "intro" | "water" | "sun" | "grow" | "bloom" | "reveal";

const PHASE_COPY: Record<Phase, { eyebrow: string; title: string; body: string }> = {
  intro: {
    eyebrow: "Field note 01",
    title: "Grow the secret.",
    body: "One seed. Five small acts. Something much bigger waiting underneath.",
  },
  water: {
    eyebrow: "Field note 02",
    title: "Wake the soil.",
    body: "Give the seed a steady drink and watch for the first signal of life.",
  },
  sun: {
    eyebrow: "Field note 03",
    title: "Call in the light.",
    body: "Every tap warms the field and pulls the young shoot higher.",
  },
  grow: {
    eyebrow: "Field note 04",
    title: "Tend what emerged.",
    body: "Help the plant find its shape. The secret is almost ready to speak.",
  },
  bloom: {
    eyebrow: "Final field note",
    title: "Bring it to bloom.",
    body: "Hold on a little longer. This is where the field reveals its name.",
  },
  reveal: {
    eyebrow: "Field revealed",
    title: "Udyaan",
    body: "A living field for the builders of tomorrow.",
  },
};

const STEPS = ["Seed", "Water", "Sun", "Tend", "Bloom"];

const WATER_TARGET = 30;
const SUN_TARGET = 58;
const GROW_TARGET = 82;
const MAX = 100;

const LEAVES = [
  { at: 0.16, side: -1, h: 0.32 },
  { at: 0.28, side: 1, h: 0.46 },
  { at: 0.42, side: -1, h: 0.6 },
  { at: 0.55, side: 1, h: 0.72 },
  { at: 0.68, side: -1, h: 0.83 },
];

const CW = 300;
const CH = 360;
const BASE_Y = 312;
const CX = 150;

function quadPoint(t: number, ctrlX: number, ctrlY: number, endX: number, endY: number) {
  const mt = 1 - t;
  const x = mt * mt * CX + 2 * mt * t * ctrlX + t * t * endX;
  const y = mt * mt * BASE_Y + 2 * mt * t * ctrlY + t * t * endY;
  return { x, y };
}

function Plant({ growth, bloomed }: { growth: number; bloomed: boolean }) {
  const gg = growth / 100;
  const stemH = Math.max(0, (gg - 0.05) / 0.95) * 232;
  const bend = Math.sin(gg * Math.PI) * 14;
  const topX = CX + bend;
  const topY = BASE_Y - stemH;
  const ctrlX = CX + bend * 0.45;
  const ctrlY = (BASE_Y + topY) / 2;
  const flower = Math.max(0, (gg - 0.8) / 0.2);

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className={styles.plantSvg} preserveAspectRatio="xMidYMax meet" aria-hidden>
      <defs>
        <radialGradient id="soilGrad" cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#5a4326" />
          <stop offset="100%" stopColor="#2f2113" />
        </radialGradient>
      </defs>

      {/* soil */}
      <ellipse cx={CX} cy={BASE_Y + 6} rx={128} ry={30} fill="url(#soilGrad)" />
      <ellipse cx={CX} cy={BASE_Y - 2} rx={92} ry={17} fill="#1f160c" opacity={0.55} />

      {/* seed (before it sprouts) */}
      {gg < 0.14 && (
        <motion.ellipse
          cx={CX}
          cy={BASE_Y - 6}
          rx={11}
          ry={15}
          fill="#c8912f"
          animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ transformOrigin: `${CX}px ${BASE_Y - 6}px` }}
        />
      )}

      {/* stem */}
      {stemH > 4 && (
        <path
          d={`M ${CX} ${BASE_Y} Q ${ctrlX} ${ctrlY} ${topX} ${topY}`}
          stroke="#4f9e42"
          strokeWidth={Math.max(4, 10 * gg)}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* leaves */}
      {LEAVES.map((leaf, index) => {
        if (gg < leaf.at) return null;
        const point = quadPoint(leaf.h, ctrlX, ctrlY, topX, topY);
        const appear = Math.min(1, (gg - leaf.at) / 0.1);
        const rot = leaf.side > 0 ? 28 : -28;
        return (
          <g key={index} transform={`translate(${point.x} ${point.y}) rotate(${rot})`}>
            <path
              d={`M0 0 C ${leaf.side * 8} -20 ${leaf.side * 42} -20 ${leaf.side * 52} 2 C ${leaf.side * 40} 12 ${leaf.side * 14} 10 0 0 Z`}
              fill={index % 2 === 0 ? "#5bb14a" : "#6cc157"}
              style={{ transformOrigin: "0px 0px", transform: `scale(${appear})` }}
            />
            <path
              d={`M0 0 L ${leaf.side * 44} 0`}
              stroke="rgba(28,74,20,.35)"
              strokeWidth={1.4}
              style={{ transformOrigin: "0px 0px", transform: `scale(${appear})` }}
            />
          </g>
        );
      })}

      {/* flower / bloom */}
      {flower > 0 && (
        <g transform={`translate(${topX} ${topY})`} style={{ transformOrigin: "0px 0px", transform: `scale(${bloomed ? 1 : flower})` }}>
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <ellipse
              key={angle}
              cx={0}
              cy={-16}
              rx={11}
              ry={20}
              fill={bloomed ? "#ffd36b" : "#f2c86a"}
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx={0} cy={0} r={11} fill="#a4642a" />
        </g>
      )}
    </svg>
  );
}

export function SeedJourney() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [growth, setGrowthState] = useState(0);
  const [bloomed, setBloomed] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [watering, setWatering] = useState(false);
  const [blooming, setBlooming] = useState(false);
  const [tapPulse, setTapPulse] = useState(0);
  const [sunTaps, setSunTaps] = useState(0);

  const growthRef = useRef(0);
  const phaseRef = useRef<Phase>("intro");
  const rafRef = useRef<number | null>(null);
  const captionTimer = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const setGrowth = useCallback((value: number) => {
    growthRef.current = value;
    setGrowthState(value);
  }, []);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const blip = useCallback((kind: "tap" | "grow" | "bloom") => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      const audio = audioRef.current ?? new window.AudioContext();
      audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const notes = kind === "bloom" ? [523, 659, 784, 1046] : kind === "grow" ? [440, 660] : [620];
      notes.forEach((frequency, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        const at = audio.currentTime + index * 0.06;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.05, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at + 0.24);
      });
    } catch {
      /* audio is optional */
    }
  }, []);

  const showCaption = useCallback((text: string) => {
    if (captionTimer.current) window.clearTimeout(captionTimer.current);
    setCaption(text);
    captionTimer.current = window.setTimeout(() => setCaption(null), 2600);
  }, []);

  const stopHold = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setWatering(false);
    setBlooming(false);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (captionTimer.current) window.clearTimeout(captionTimer.current);
    void audioRef.current?.close();
  }, []);

  const plantSeed = () => {
    blip("tap");
    setGrowth(6);
    go("water");
    showCaption("Something is being grown here. Quietly.");
  };

  const startWater = () => {
    if (phaseRef.current !== "water") return;
    setWatering(true);
    blip("tap");
    const loop = () => {
      const next = Math.min(WATER_TARGET, growthRef.current + 0.65);
      setGrowth(next);
      if (next >= WATER_TARGET) {
        stopHold();
        go("sun");
        blip("grow");
        showCaption("100+ acres of farmland. Already alive.");
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const tapSun = () => {
    if (phaseRef.current !== "sun") return;
    setSunTaps((count) => count + 1);
    setTapPulse((value) => value + 1);
    blip("tap");
    const next = Math.min(SUN_TARGET, growthRef.current + 5);
    setGrowth(next);
    if (next >= SUN_TARGET) {
      go("grow");
      blip("grow");
      showCaption("Twelve students are already tending it.");
    }
  };

  const tapGrow = () => {
    if (phaseRef.current !== "grow") return;
    setTapPulse((value) => value + 1);
    blip("grow");
    const next = Math.min(GROW_TARGET, growthRef.current + 5.5);
    setGrowth(next);
    if (next >= GROW_TARGET) {
      go("bloom");
      showCaption("It already has a name. Six letters.");
    }
  };

  const startBloom = () => {
    if (phaseRef.current !== "bloom") return;
    setBlooming(true);
    const loop = () => {
      const next = Math.min(MAX, growthRef.current + 0.8);
      setGrowth(next);
      if (next >= MAX) {
        stopHold();
        setBloomed(true);
        blip("bloom");
        window.setTimeout(() => go("reveal"), 1500);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const gg = growth / 100;
  const stepIndex = phase === "intro" ? 0 : phase === "water" ? 1 : phase === "sun" ? 2 : phase === "grow" ? 3 : 4;
  const phaseCopy = PHASE_COPY[phase];

  return (
    <main className={styles.stage}>
      <div className={styles.night} aria-hidden />
      <div className={styles.day} style={{ opacity: gg }} aria-hidden />
      <div className={styles.pollen} aria-hidden />
      <div className={styles.topScrim} aria-hidden />

      <div className={styles.progress} aria-label={`Growth stage ${stepIndex + 1} of ${STEPS.length}`}>
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={index <= stepIndex ? styles.dotActive : styles.dot}
            aria-current={index === stepIndex ? "step" : undefined}
          >
            <i aria-hidden />
            <small>{label}</small>
          </span>
        ))}
      </div>

      {phase !== "reveal" && (
        <header className={styles.sceneHeader}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32 }}
            >
              <p className={styles.phaseKicker}>{phaseCopy.eyebrow}</p>
              <h1>{phaseCopy.title}</h1>
              <p className={styles.phaseLead}>{phaseCopy.body}</p>
            </motion.div>
          </AnimatePresence>
        </header>
      )}

      {/* caption teaser keeps a reserved row so it never covers the plant */}
      <div className={styles.captionSlot}>
        <AnimatePresence>
          {caption && (
            <motion.p className={styles.caption} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {caption}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* plant zone */}
      <div className={styles.field}>
        <motion.button
          type="button"
          className={`${styles.sun} ${phase === "sun" ? styles.sunActive : ""}`}
          style={{ opacity: 0.35 + gg * 0.65, filter: `brightness(${0.7 + gg * 0.6})` }}
          onClick={tapSun}
          disabled={phase !== "sun"}
          aria-label="Give sunlight"
          animate={phase === "sun" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1.4, repeat: phase === "sun" ? Infinity : 0 }}
        >
          <Sun size={40} />
          <AnimatePresence>
            {phase === "sun" && (
              <motion.span key={tapPulse} className={styles.sunRing} initial={{ opacity: 0.7, scale: 0.6 }} animate={{ opacity: 0, scale: 1.8 }} transition={{ duration: 0.6 }} />
            )}
          </AnimatePresence>
        </motion.button>

        <button
          type="button"
          className={styles.plantZone}
          onClick={phase === "intro" ? plantSeed : phase === "grow" ? tapGrow : undefined}
          disabled={phase !== "intro" && phase !== "grow"}
          aria-label={phase === "intro" ? "Plant the seed" : phase === "grow" ? "Tend the plant" : "Plant"}
        >
          {watering && (
            <div className={styles.rain} aria-hidden>
              {Array.from({ length: 7 }).map((_, index) => <i key={index} style={{ left: `${38 + index * 4}%`, animationDelay: `${index * 0.09}s` }} />)}
            </div>
          )}
          {blooming && (
            <div className={styles.petals} aria-hidden>
              {Array.from({ length: 9 }).map((_, index) => <i key={index} style={{ left: `${20 + index * 7}%`, animationDelay: `${index * 0.12}s` }} />)}
            </div>
          )}
          <motion.div
            className={styles.plantHolder}
            animate={{ scale: phase === "grow" ? [1, 1.015, 1] : 1 }}
            transition={{ duration: 0.25 }}
            key={phase === "grow" ? tapPulse : "static"}
          >
            <Plant growth={growth} bloomed={bloomed} />
          </motion.div>
        </button>
      </div>

      {/* controls / prompts */}
      <div className={styles.dock}>
        {phase === "intro" && (
          <motion.button type="button" className={`${styles.action} ${styles.pulse}`} onClick={plantSeed} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Sprout size={20} /> Tap to plant the seed
          </motion.button>
        )}
        {phase === "water" && (
          <motion.button
            type="button"
            className={`${styles.action} ${styles.pulse} ${watering ? styles.actionHot : ""}`}
            onPointerDown={startWater}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Droplets size={20} /> Press &amp; hold to water
          </motion.button>
        )}
        {phase === "sun" && (
          <motion.p className={styles.prompt} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Sun size={17} /> Tap the sun to give it light
          </motion.p>
        )}
        {phase === "grow" && (
          <motion.p className={styles.prompt} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Hand size={17} /> Tap the plant to help it grow
          </motion.p>
        )}
        {phase === "bloom" && (
          <motion.button
            type="button"
            className={`${styles.action} ${styles.pulse} ${blooming ? styles.actionHot : ""}`}
            onPointerDown={startBloom}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Sparkles size={20} /> Press &amp; hold to make it bloom
          </motion.button>
        )}
        <div className={styles.meter}>
          <div className={styles.meterLabel}>
            <span>Growth signal</span>
            <b>{Math.round(growth)}%</b>
          </div>
          <div className={styles.growthBar}><i style={{ width: `${gg * 100}%` }} /></div>
        </div>
        <span className={styles.fictionTag}>an interactive Udyaan experience</span>
      </div>

      {/* reveal */}
      <AnimatePresence>
        {phase === "reveal" && (
          <motion.div className={styles.revealOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <motion.section className={styles.revealCard} initial={{ y: 30, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <div className={styles.revealMedia}><Image src="/udyaan-greenhouse.jpg" alt="Udyaan greenhouse site" fill priority sizes="(max-width: 800px) 100vw, 720px" /></div>
              <div className={styles.revealBody}>
                <p className={styles.revealKicker}>It finally has a name</p>
                <div className={styles.brand}><span><Leaf size={26} /></span><h2>Udyaan</h2></div>
                <p className={styles.revealLead}>A living 100+ acre farmland where students build the future of agri-tech.</p>
                <p className={styles.revealText}>Drone &amp; robot farming, vertical microgreens, hydro-aeroponics and a Bio-CNG loop — with real academic credit, patents you keep, and a venture path for what you build.</p>
                <div className={styles.metrics}>
                  <span><b>100+ acres</b>live field systems</span>
                  <span><b>cohort-01</b>intake open</span>
                  <span><b>you</b>the next to grow it</span>
                </div>
                <Link href="/survey" className={styles.surveyButton}>Begin the Udyaan intake <ArrowRight size={18} /></Link>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
