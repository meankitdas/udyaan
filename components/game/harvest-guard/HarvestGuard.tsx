"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  CircleHelp,
  Leaf,
  List,
  LockKeyhole,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sprout,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CropMood } from "./Crop";
import type { Outcome, Phase } from "./Scene";
import { LEVELS, totalVine, type Vec2, type Weather } from "./levels";
import { setMuted, sfx } from "./sfx";
import styles from "./HarvestGuard.module.css";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

const SAVE_KEY = "udyaan.harvest-guard.v1";

type Stage = "title" | "levels" | "plan" | "running" | "paused" | "over";
type Save = { v: 1; stars: Record<string, number> };

function emptySave(): Save {
  return { v: 1, stars: {} };
}

function loadSave(): Save {
  if (typeof window === "undefined") return emptySave();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Save;
    if (parsed?.v !== 1 || !parsed.stars || typeof parsed.stars !== "object") {
      return emptySave();
    }
    return parsed;
  } catch (error) {
    console.warn("Harvest Guard progress could not be loaded.", error);
    return emptySave();
  }
}

const LOSS_COPY: Record<Exclude<Outcome, { result: "win" }>["reason"], {
  title: string;
  body: string;
}> = {
  impact: {
    title: "The crop was struck",
    body: "Reposition the vine so the hazard is carried clear of Sunny.",
  },
  storm: {
    title: "Too close to the storm",
    body: "Storm pods need to burst well beyond the crop's root zone.",
  },
  fell: {
    title: "Sunny left the field",
    body: "Add support below the crop and keep every impact away from the terrace edge.",
  },
};

const WEATHER_LABEL: Record<Weather, string> = {
  sunny: "Clear sky",
  breezy: "Crosswind",
  cloudy: "Hail clouds",
  stormy: "Storm watch",
};

function Star({ on, label }: { on: boolean; label: string }) {
  return (
    <div className={on ? `${styles.star} ${styles.starOn}` : styles.star}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function BrandMark() {
  return (
    <div className={styles.brandMark} aria-hidden="true">
      <span className={styles.brandSoil} />
      <span className={styles.brandStem} />
      <span className={`${styles.brandLeaf} ${styles.brandLeafLeft}`} />
      <span className={`${styles.brandLeaf} ${styles.brandLeafRight}`} />
    </div>
  );
}

export default function HarvestGuard() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("title");
  const [levelIndex, setLevelIndex] = useState(0);
  const [strokes, setStrokes] = useState<Vec2[][]>([]);
  const [collected, setCollected] = useState<string[]>([]);
  const [runId, setRunId] = useState(1);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [save, setSave] = useState<Save>(emptySave);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [help, setHelp] = useState(false);
  const [earned, setEarned] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [levelMenuReturn, setLevelMenuReturn] = useState<"title" | "plan">("title");

  const level = LEVELS[levelIndex];
  const committedVine = useMemo(() => totalVine(strokes), [strokes]);
  const budgetLeft = Math.max(0, level.vine - committedVine);
  const totalStars = useMemo(
    () => LEVELS.reduce((sum, item) => sum + (save.stars[item.id] ?? 0), 0),
    [save.stars],
  );

  const vineFill = useRef<HTMLDivElement>(null);
  const vineText = useRef<HTMLSpanElement>(null);
  const timeText = useRef<HTMLSpanElement>(null);
  const committedRef = useRef(committedVine);
  const levelRef = useRef(level);
  const collectedRef = useRef(collected);
  const saveRef = useRef(save);
  const settledRef = useRef(false);
  const toastTimer = useRef<number | null>(null);
  committedRef.current = committedVine;
  levelRef.current = level;
  collectedRef.current = collected;
  saveRef.current = save;

  useEffect(() => {
    setSave(loadSave());
    setFullscreenAvailable(typeof document.documentElement.requestFullscreen === "function");

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  const persist = useCallback((next: Save) => {
    setSave(next);
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Harvest Guard progress could not be saved.", error);
    }
  }, []);

  const unlocked = useMemo(() => {
    let count = 1;
    LEVELS.forEach((item, index) => {
      if (save.stars[item.id]) {
        count = Math.max(count, Math.min(LEVELS.length, index + 2));
      }
    });
    return count;
  }, [save.stars]);

  const resumeIndex = useMemo(() => {
    const unfinished = LEVELS.findIndex(
      (item, index) => index < unlocked && !(save.stars[item.id] > 0),
    );
    return unfinished >= 0 ? unfinished : Math.max(0, unlocked - 1);
  }, [save.stars, unlocked]);

  const paintVine = useCallback((used: number) => {
    const current = levelRef.current;
    const left = Math.max(0, current.vine - used);
    if (vineFill.current) {
      vineFill.current.style.width = `${Math.max(
        0,
        Math.min(100, (left / current.vine) * 100),
      )}%`;
      vineFill.current.dataset.low = left <= current.vine - current.par ? "1" : "0";
    }
    if (vineText.current) vineText.current.textContent = left.toFixed(1);
  }, []);

  useLayoutEffect(() => {
    paintVine(committedVine);
  }, [committedVine, levelIndex, paintVine, stage]);

  const paintTime = useCallback((elapsed: number) => {
    const current = levelRef.current;
    const left = Math.max(0, current.duration - elapsed);
    if (timeText.current) timeText.current.textContent = left.toFixed(1);
  }, []);

  useLayoutEffect(() => {
    paintTime(0);
  }, [levelIndex, paintTime, runId]);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1700);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    setMuted(quiet);
  }, [quiet]);

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (gameRoot.current?.requestFullscreen) {
        await gameRoot.current.requestFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen could not be enabled.", error);
      flash("Fullscreen is unavailable in this browser.");
    }
  }, [flash]);

  const openLevel = useCallback((index: number) => {
    setLevelIndex(index);
    setStrokes([]);
    setCollected([]);
    setOutcome(null);
    setEarned(0);
    settledRef.current = false;
    setRunId((value) => value + 1);
    setStage("plan");
  }, []);

  const retry = useCallback((keepVines: boolean) => {
    setOutcome(null);
    setCollected([]);
    setEarned(0);
    settledRef.current = false;
    if (!keepVines) setStrokes([]);
    setRunId((value) => value + 1);
    setStage("plan");
  }, []);

  const launchWeather = useCallback(() => {
    sfx.launch();
    setCollected([]);
    setOutcome(null);
    settledRef.current = false;
    setRunId((value) => value + 1);
    setStage("running");
  }, []);

  const pause = useCallback(() => {
    setStage((current) => (current === "running" ? "paused" : current));
  }, []);

  const resume = useCallback(() => {
    setStage((current) => (current === "paused" ? "running" : current));
  }, []);

  const showLevels = useCallback(() => {
    sfx.click();
    if (stage === "title") {
      setLevelMenuReturn("title");
    } else {
      setLevelMenuReturn("plan");
      if (stage === "running" || stage === "paused") {
        setCollected([]);
        settledRef.current = false;
        setRunId((value) => value + 1);
      }
    }
    setStage("levels");
  }, [stage]);

  const handleOutcome = useCallback(
    (nextOutcome: Outcome) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setOutcome(nextOutcome);
      setStage("over");

      if (nextOutcome.result !== "win") {
        sfx.lose();
        return;
      }

      const current = levelRef.current;
      const seeds = current.seeds ?? [];
      const allSeeds = seeds.every((seed) => collectedRef.current.includes(seed.id));
      const underPar = committedRef.current <= current.par + 1e-6;
      const stars = 1 + (allSeeds ? 1 : 0) + (underPar ? 1 : 0);
      setEarned(stars);
      const best = Math.max(saveRef.current.stars[current.id] ?? 0, stars);
      persist({
        v: 1,
        stars: { ...saveRef.current.stars, [current.id]: best },
      });
      sfx.win();
    },
    [persist],
  );

  const handleSeed = useCallback((id: string) => {
    setCollected((previous) => {
      if (previous.includes(id)) return previous;
      sfx.seed();
      return [...previous, id];
    });
  }, []);

  const handleCommit = useCallback((points: Vec2[]) => {
    sfx.plant();
    setStrokes([points]);
    launchWeather();
  }, [launchWeather]);

  const onBlocked = useCallback(() => {
    sfx.blocked();
    flash(
      budgetLeft <= 0.15
        ? "No vine left — redraw the field."
        : "That is protected soil. Plant outside the amber zone.",
    );
  }, [budgetLeft, flash]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pause]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "escape") {
        if (help) {
          setHelp(false);
        } else if (stage === "running") {
          pause();
        } else if (stage === "paused") {
          resume();
        }
        return;
      }
      if (key === "f" && fullscreenAvailable) {
        void toggleFullscreen();
        return;
      }
      if (key === "m") {
        setQuiet((current) => !current);
        return;
      }
      if (stage === "over" && (key === " " || key === "enter")) {
        event.preventDefault();
        if (outcome?.result === "win" && levelIndex + 1 < LEVELS.length) {
          openLevel(levelIndex + 1);
        } else {
          retry(false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    fullscreenAvailable,
    help,
    levelIndex,
    openLevel,
    outcome,
    pause,
    resume,
    retry,
    stage,
    toggleFullscreen,
  ]);

  const mood: CropMood =
    stage === "running"
      ? "alert"
      : outcome?.result === "win"
        ? "happy"
        : outcome
          ? "hurt"
          : "idle";
  const scenePhase: Phase =
    stage === "running"
      ? "running"
      : stage === "paused"
        ? "paused"
        : stage === "over"
          ? "over"
          : "plan";
  const seeds = level.seeds ?? [];
  const allSeeds = seeds.every((seed) => collected.includes(seed.id));
  const showGameHud = !["title", "levels"].includes(stage);

  return (
    <div
      ref={gameRoot}
      className={styles.wrap}
      data-weather={level.weather}
      aria-label="Harvest Guard 3D game"
    >
      <div className={styles.stage}>
        <div className={styles.canvas}>
          <Scene
            level={level}
            runId={runId}
            phase={scenePhase}
            canDraw={stage === "plan"}
            strokes={strokes}
            collected={collected}
            budgetLeft={budgetLeft}
            mood={mood}
            onCommit={handleCommit}
            onLiveVine={(length) => paintVine(committedRef.current + length)}
            onBlocked={onBlocked}
            onDrawStart={sfx.drawStart}
            onOutcome={handleOutcome}
            onSeed={handleSeed}
            onStormBurst={sfx.storm}
            onReady={() => setReady(true)}
            onTick={paintTime}
          />
        </div>

        <div
          className={`${styles.hud} ${showGameHud ? styles.hudVisible : ""}`}
          aria-hidden={!showGameHud}
        >
          <div className={styles.hudRow}>
            <div className={styles.levelTag}>
              <span className={styles.levelNo}>{levelIndex + 1}</span>
              <span className={styles.levelCopy}>
                <small>{level.season}</small>
                <strong>{level.name}</strong>
              </span>
            </div>

            <div className={styles.hudTools}>
              {stage === "running" ? (
                <button type="button" onClick={pause} aria-label="Pause game" title="Pause">
                  <Pause />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (stage === "running") pause();
                  setHelp(true);
                }}
                aria-label="How to play"
                title="How to play"
              >
                <CircleHelp />
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  setQuiet((current) => !current);
                }}
                aria-label={quiet ? "Turn sound on" : "Mute game"}
                title={quiet ? "Sound on" : "Mute"}
              >
                {quiet ? <VolumeX /> : <Volume2 />}
              </button>
              {fullscreenAvailable ? (
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? <Minimize2 /> : <Maximize2 />}
                </button>
              ) : null}
              <button type="button" onClick={showLevels} aria-label="Choose a field" title="Fields">
                <List />
              </button>
            </div>
          </div>

          <div className={styles.meters}>
            <div className={styles.meter}>
              <div className={styles.meterHead}>
                <span>
                  <Leaf />
                  Vine
                </span>
                <span>
                  <b ref={vineText}>{level.vine.toFixed(1)}</b> left
                </span>
              </div>
              <div className={styles.bar}>
                <div
                  className={styles.barPar}
                  style={{ left: `${((level.vine - level.par) / level.vine) * 100}%` }}
                />
                <div ref={vineFill} className={styles.barFill} />
              </div>
            </div>

            {stage === "running" || stage === "paused" || stage === "over" ? (
              <div className={`${styles.meter} ${styles.timerMeter}`} aria-label="Weather time remaining">
                <span className={styles.timerLabel}>Weather</span>
                <strong className={styles.timerValue}>
                  <b ref={timeText}>{level.duration.toFixed(1)}</b>
                  <small>s</small>
                </strong>
              </div>
            ) : null}

            {seeds.length ? (
              <div className={styles.seedMeter} aria-label="Seed packets collected">
                {seeds.map((seed) => (
                  <span
                    key={seed.id}
                    className={collected.includes(seed.id) ? styles.seedOn : ""}
                  >
                    <Sprout />
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.objective}>
            <span>{stage === "running" ? WEATHER_LABEL[level.weather] : "Field objective"}</span>
            <p>{stage === "running" ? "Hold the defense until the timer ends." : level.hint}</p>
          </div>
        </div>

        <div className={styles.controls}>
          {stage === "running" ? (
            <button type="button" className={styles.controlButton} onClick={launchWeather}>
              <RotateCcw />
              <span>Reset field</span>
            </button>
          ) : null}
        </div>

        <div className={styles.srStatus} aria-live="polite">
          {toast ?? ""}
        </div>
        <AnimatePresence>
          {toast ? (
            <motion.div
              key="toast"
              className={styles.toastSlot}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <div className={styles.toast}>{toast}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!ready ? (
          <div className={styles.loading}>
            <BrandMark />
            <div className={styles.loadingTitle}>Harvest Guard</div>
            <div className={styles.loadingBar}>
              <span />
            </div>
            <p>Preparing the field physics…</p>
          </div>
        ) : null}

        <AnimatePresence>
          {stage === "title" ? (
            <motion.div
              key="title"
              className={`${styles.overlay} ${styles.titleOverlay}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`${styles.card} ${styles.heroCard}`}
                initial={{ x: -30, opacity: 0, scale: 0.97 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: -20, opacity: 0 }}
              >
                <div className={styles.gameBrand}>
                  <BrandMark />
                  <span>Udyaan Playables</span>
                </div>
                <p className={styles.kicker}>A real-time 3D farm puzzle</p>
                <h1 className={styles.title}>
                  Harvest <span>Guard</span> <em>3D</em>
                </h1>
                <p className={styles.blurb}>
                  Grow solid vine defenses, route dangerous weather, and protect Sunny through ten
                  physics-driven farming challenges.
                </p>
                <div className={styles.featurePills}>
                  <span>Real 3D physics</span>
                  <span>10 farm fields</span>
                  <span>Touch + mouse</span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => {
                      sfx.click();
                      openLevel(resumeIndex);
                    }}
                  >
                    <Play />
                    <span>{totalStars ? "Continue farm" : "Play now"}</span>
                  </button>
                  <button type="button" className={styles.secondary} onClick={showLevels}>
                    <List />
                    <span>Choose field</span>
                  </button>
                </div>
                <div className={styles.progressLine}>
                  <span>{totalStars}/30 stars</span>
                  <span>{unlocked}/10 fields open</span>
                </div>
              </motion.div>
            </motion.div>
          ) : null}

          {stage === "levels" ? (
            <motion.div
              key="levels"
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`${styles.card} ${styles.levelCard}`}
                initial={{ y: 24, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0 }}
              >
                <div className={styles.levelHeader}>
                  <div>
                    <p className={styles.kicker}>Season map</p>
                    <h2 className={styles.cardTitle}>Choose a field</h2>
                  </div>
                  <div className={styles.starTotal}>
                    <span>★</span>
                    {totalStars}/30
                  </div>
                </div>
                <div className={styles.grid}>
                  {LEVELS.map((item, index) => {
                    const stars = save.stars[item.id] ?? 0;
                    const locked = index >= unlocked;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={locked ? `${styles.tile} ${styles.tileLocked}` : styles.tile}
                        disabled={locked}
                        onClick={() => {
                          sfx.click();
                          openLevel(index);
                        }}
                      >
                        <span className={styles.tileTop}>
                          <b>{locked ? <LockKeyhole /> : index + 1}</b>
                          <i>{WEATHER_LABEL[item.weather]}</i>
                        </span>
                        <strong>{item.name}</strong>
                        <small>{item.season}</small>
                        <span className={styles.tileStars} aria-label={`${stars} stars`}>
                          {[0, 1, 2].map((star) => (
                            <i key={star} className={star < stars ? styles.dotOn : styles.dot} />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      sfx.click();
                      setStage(levelMenuReturn);
                    }}
                  >
                    Back
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}

          {stage === "paused" && !help ? (
            <motion.div
              key="paused"
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`${styles.card} ${styles.pauseCard}`}
                initial={{ scale: 0.94, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0 }}
              >
                <span className={styles.pauseIcon}>
                  <Pause />
                </span>
                <p className={styles.kicker}>Weather suspended</p>
                <h2 className={styles.cardTitle}>Field paused</h2>
                <p className={styles.blurb}>The simulation is frozen exactly where you left it.</p>
                <div className={styles.cardActions}>
                  <button type="button" className={styles.primary} onClick={resume}>
                    <Play />
                    Resume
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => retry(false)}>
                    <RotateCcw />
                    Rebuild
                  </button>
                  <button type="button" className={styles.secondary} onClick={showLevels}>
                    <List />
                    Fields
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}

          {stage === "over" && outcome ? (
            <motion.div
              key="over"
              className={`${styles.overlay} ${styles.resultOverlay}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`${styles.card} ${styles.resultCard}`}
                initial={{ y: 30, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, opacity: 0 }}
              >
                {outcome.result === "win" ? (
                  <>
                    <span className={styles.resultCrop}>
                      <Sprout />
                    </span>
                    <p className={styles.kicker}>Field {levelIndex + 1} complete</p>
                    <h2 className={styles.cardTitle}>Harvest protected!</h2>
                    <div className={styles.starRow}>
                      <Star on label="Crop safe" />
                      <Star on={allSeeds} label={seeds.length ? "Seed secured" : "Field clear"} />
                      <Star on={committedVine <= level.par + 1e-6} label="Vine saver" />
                    </div>
                    <p className={styles.scoreCopy}>
                      {earned}/3 stars · {committedVine.toFixed(1)} vine used
                    </p>
                    <div className={styles.lesson}>
                      <Leaf />
                      <span>
                        <b>Farm lesson</b>
                        {level.lesson}
                      </span>
                    </div>
                    <div className={styles.cardActions}>
                      {levelIndex + 1 < LEVELS.length ? (
                        <button
                          type="button"
                          className={styles.primary}
                          onClick={() => {
                            sfx.click();
                            openLevel(levelIndex + 1);
                          }}
                        >
                          Next field
                          <Play />
                        </button>
                      ) : (
                        <button type="button" className={styles.primary} onClick={showLevels}>
                          <List />
                          Season complete
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          sfx.click();
                          retry(false);
                        }}
                      >
                        Improve design
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className={`${styles.resultCrop} ${styles.resultCropLost}`}>
                      <Sprout />
                    </span>
                    <p className={styles.kicker}>Field needs another plan</p>
                    <h2 className={styles.cardTitle}>{LOSS_COPY[outcome.reason].title}</h2>
                    <p className={styles.blurb}>{LOSS_COPY[outcome.reason].body}</p>
                    <div className={styles.tipBox}>
                      <b>Try this</b>
                      <span>{level.hint}</span>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={() => {
                          sfx.click();
                          retry(false);
                        }}
                      >
                        <Undo2 />
                        Draw again
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={() => {
                          sfx.click();
                          launchWeather();
                        }}
                      >
                        <RotateCcw />
                        Retry same vine
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          ) : null}

          {help ? (
            <motion.div
              key="help"
              className={styles.overlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={`${styles.card} ${styles.helpCard}`}
                initial={{ y: 24, scale: 0.96 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: -12, opacity: 0 }}
              >
                <p className={styles.kicker}>Field manual</p>
                <h2 className={styles.cardTitle}>How to protect Sunny</h2>
                <div className={styles.helpGrid}>
                  <div>
                    <span>1</span>
                    <p>
                      <b>Grow a barrier</b>
                      Drag across the field. Every section spends vine.
                    </p>
                  </div>
                  <div>
                    <span>2</span>
                    <p>
                      <b>Read the field</b>
                      Amber beds and Sunny's root ring cannot be planted in.
                    </p>
                  </div>
                  <div>
                    <span>3</span>
                    <p>
                      <b>Run the weather</b>
                      Hail, bales, crates, and storm pods obey real physics.
                    </p>
                  </div>
                  <div>
                    <span>★</span>
                    <p>
                      <b>Master each field</b>
                      Save the crop, collect seed packets, and stay under par.
                    </p>
                  </div>
                </div>
                <p className={styles.shortcuts}>
                  Release to start · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound ·{" "}
                  <kbd>F</kbd> fullscreen
                </p>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => {
                      sfx.click();
                      setHelp(false);
                    }}
                  >
                    Back to field
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
