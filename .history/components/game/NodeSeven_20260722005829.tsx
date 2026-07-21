"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./NodeSeven.module.css";

type Phase = "boot" | "memo" | "cal" | "judge" | "cipher" | "file";

/* ------------------------------------------------------------------ */
/* copy                                                                */
/* ------------------------------------------------------------------ */

const BOOT_LINES = [
  "jgi internal network \u2014 node 07",
  "last sync: 41 days ago",
  "",
  "this endpoint was never meant to be public.",
  "someone left the door open.",
  "",
  "[unverified session] \u2014 nothing you do here is logged. probably.",
];

const MEMO_INTRO = [
  "one file survived the last wipe.",
  "an internal memo. parts of it are still locked.",
  "tap the black to decrypt.",
];

const CAL_INTRO = [
  "the rest of the file won't open for just anyone.",
  "three checks. that's all.",
  "",
  "check 1 \u2014 steady hands.",
  "the line drifts. lock it inside the band. three times.",
];

const JUDGE_INTRO = [
  "check 2 \u2014 judgement.",
  "there are no right answers here.",
  "we watch how you decide, not what you decide.",
];

const CIPHER_INTRO = [
  "check 3 \u2014 the name.",
  "it was in the memo. six letters.",
  "spell it and the file opens.",
];

type Scenario = {
  prompt: string;
  options: string[];
  steady: number; // the low-variance choice
};

const SCENARIOS: Scenario[] = [
  {
    prompt: "the water pump dies at 2am. the seedling trays go dry by sunrise. you:",
    options: [
      "wake the one person who knows the system",
      "try to fix it alone off a video tutorial",
      "wait for daylight and hope",
    ],
    steady: 0,
  },
  {
    prompt: "your drone maps 40 acres. three zones look wrong, but the report is due tonight. you:",
    options: [
      "ship it \u2014 flag the three zones honestly",
      "refly the zones and miss the deadline",
      "crop the three zones out",
    ],
    steady: 0,
  },
  {
    prompt: "a buyer offers double for produce you know isn't ready. you:",
    options: [
      "sell anyway \u2014 money is money",
      "hold the harvest, keep the buyer",
      "sell half, quietly",
    ],
    steady: 1,
  },
];

const CIPHER_TARGET = "UDYAAN";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function shuffle<T>(input: T[]): T[] {
  const list = [...input];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function Typed({ lines, onDone, speed = 17 }: { lines: string[]; onDone?: () => void; speed?: number }) {
  const total = useMemo(() => lines.reduce((sum, line) => sum + Math.max(1, line.length), 0), [lines]);
  const [progress, setProgress] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    setProgress(0);
    firedRef.current = false;
    const id = window.setInterval(() => {
      setProgress((current) => (current >= total ? current : current + 1));
    }, speed);
    return () => window.clearInterval(id);
  }, [lines, total, speed]);

  useEffect(() => {
    if (progress >= total && !firedRef.current) {
      firedRef.current = true;
      onDone?.();
    }
  }, [progress, total, onDone]);

  let budget = progress;
  const done = progress >= total;
  return (
    <div className={styles.typed} onClick={() => setProgress(total)} role="presentation">
      {lines.map((line, index) => {
        const cost = Math.max(1, line.length);
        const shown = Math.max(0, Math.min(line.length, budget));
        const started = budget > 0;
        budget -= cost;
        const isTyping = started && shown < line.length && budget <= 0;
        if (!started && shown === 0 && line.length > 0) return <p key={index} className={styles.pending} />;
        return (
          <p key={index}>
            {line.slice(0, shown) || "\u00a0"}
            {(isTyping || (done && index === lines.length - 1)) && <span className={styles.cursor} aria-hidden />}
          </p>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export function NodeSeven() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [bootDone, setBootDone] = useState(false);
  const [balked, setBalked] = useState(false);

  // memo
  const [memoTyped, setMemoTyped] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // calibration
  const [calTyped, setCalTyped] = useState(false);
  const [locks, setLocks] = useState(0);
  const [calMisses, setCalMisses] = useState(0);
  const [band, setBand] = useState({ center: 0.5, width: 0.24 });
  const [calFlash, setCalFlash] = useState<"hit" | "miss" | null>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0.5);
  const locksRef = useRef(0);

  // judgement
  const [judgeTyped, setJudgeTyped] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [variance, setVariance] = useState(0);
  const [verdictLine, setVerdictLine] = useState<string | null>(null);

  // cipher
  const [cipherTyped, setCipherTyped] = useState(false);
  const [tiles] = useState(() => shuffle([..."UDYAANKR"].map((letter, index) => ({ letter, id: index }))));
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [entry, setEntry] = useState("");
  const [cipherShake, setCipherShake] = useState(false);
  const [solved, setSolved] = useState(false);

  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState("");
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback((kind: "tick" | "ok" | "bad" | "open") => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      const audio = audioRef.current ?? new window.AudioContext();
      audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const spec =
        kind === "ok" ? [660, 880] : kind === "bad" ? [180] : kind === "open" ? [440, 554, 660, 880] : [980];
      spec.forEach((frequency, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = frequency;
        const at = audio.currentTime + index * 0.09;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(kind === "tick" ? 0.012 : 0.03, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at + 0.14);
      });
    } catch {
      /* audio is a garnish, never a blocker */
    }
  }, []);

  useEffect(() => () => void audioRef.current?.close(), []);

  const proceed = useCallback(() => {
    startRef.current = performance.now();
    beep("tick");
    setPhase("memo");
  }, [beep]);

  /* ---------------- calibration loop ---------------- */

  useEffect(() => {
    if (phase !== "cal" || !calTyped) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const speed = 0.00082 + locksRef.current * 0.00028;
      positionRef.current = (Math.sin((t - t0) * speed * Math.PI * 2) + 1) / 2;
      if (needleRef.current) needleRef.current.style.left = `${positionRef.current * 100}%`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, calTyped]);

  const attemptLock = useCallback(() => {
    if (phase !== "cal" || !calTyped || locksRef.current >= 3) return;
    const inside = Math.abs(positionRef.current - band.center) <= band.width / 2;
    if (inside) {
      const next = locksRef.current + 1;
      locksRef.current = next;
      setLocks(next);
      setCalFlash("hit");
      beep("ok");
      setBand({ center: 0.2 + Math.random() * 0.6, width: Math.max(0.11, 0.24 - next * 0.045) });
      if (next >= 3) window.setTimeout(() => setPhase("judge"), 820);
    } else {
      setCalMisses((count) => count + 1);
      setCalFlash("miss");
      beep("bad");
    }
    window.setTimeout(() => setCalFlash(null), 260);
  }, [phase, calTyped, band, beep]);

  useEffect(() => {
    if (phase !== "cal") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        attemptLock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, attemptLock]);

  /* ---------------- judgement ---------------- */

  const answerScenario = useCallback(
    (optionIndex: number) => {
      if (verdictLine) return;
      const scenario = SCENARIOS[scenarioIndex];
      const steady = optionIndex === scenario.steady;
      if (!steady) setVariance((count) => count + 1);
      setVerdictLine(steady ? "logged. variance: low." : "logged. interesting.");
      beep("tick");
      window.setTimeout(() => {
        setVerdictLine(null);
        if (scenarioIndex + 1 >= SCENARIOS.length) setPhase("cipher");
        else setScenarioIndex((index) => index + 1);
      }, 1050);
    },
    [scenarioIndex, verdictLine, beep],
  );

  /* ---------------- cipher ---------------- */

  const pressTile = useCallback(
    (tileId: number, letter: string) => {
      if (solved || usedTiles.has(tileId)) return;
      if (letter === CIPHER_TARGET[entry.length]) {
        const nextEntry = entry + letter;
        setEntry(nextEntry);
        setUsedTiles((used) => new Set(used).add(tileId));
        beep("tick");
        if (nextEntry === CIPHER_TARGET) {
          setSolved(true);
          beep("open");
          if (startRef.current != null) {
            const seconds = Math.round((performance.now() - startRef.current) / 1000);
            setElapsed(`${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`);
          }
          window.setTimeout(() => setPhase("file"), 1700);
        }
      } else {
        setCipherShake(true);
        setEntry("");
        setUsedTiles(new Set());
        beep("bad");
        window.setTimeout(() => setCipherShake(false), 340);
      }
    },
    [entry, solved, usedTiles, beep],
  );

  /* ---------------- memo fragments ---------------- */

  const reveal = (index: number) => {
    setRevealed((current) => {
      if (current.has(index)) return current;
      beep("tick");
      const next = new Set(current);
      next.add(index);
      return next;
    });
  };

  const Frag = ({ index, children }: { index: number; children: string }) =>
    revealed.has(index) ? (
      <em className={styles.decrypted}>{children}</em>
    ) : (
      <button
        type="button"
        className={styles.redacted}
        onClick={() => reveal(index)}
        aria-label="decrypt fragment"
      >
        {"\u2588".repeat(Math.min(11, Math.max(5, children.length)))}
      </button>
    );

  const memoUnlocked = revealed.size >= 3;

  /* ---------------- render ---------------- */

  return (
    <main className={styles.node}>
      <div className={styles.scanlines} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      <div className={styles.frame}>
        <header className={styles.head}>
          <span>jgi-net / node-07</span>
          <span className={styles.headRight}>
            {phase === "boot" ? "session: unverified" : phase === "file" ? "clearance: granted" : "checks: " + (phase === "memo" ? "0" : phase === "cal" ? "1" : phase === "judge" ? "2" : "3") + "/3"}
          </span>
        </header>

        {phase === "boot" && (
          <section className={styles.block}>
            <Typed lines={BOOT_LINES} onDone={() => setBootDone(true)} />
            {bootDone && (
              <div className={styles.actions}>
                <button type="button" className={styles.cmd} onClick={proceed}>
                  &gt; proceed anyway
                </button>
                {!balked ? (
                  <button type="button" className={styles.cmdGhost} onClick={() => { setBalked(true); beep("bad"); }}>
                    &gt; leave
                  </button>
                ) : (
                  <p className={styles.aside}>smart. the door&apos;s still open, though.</p>
                )}
              </div>
            )}
          </section>
        )}

        {phase === "memo" && (
          <section className={styles.block}>
            <Typed lines={MEMO_INTRO} onDone={() => setMemoTyped(true)} speed={15} />
            {memoTyped && (
              <>
                <article className={styles.memo}>
                  <p className={styles.memoHead}>internal memo — do not forward</p>
                  <p className={styles.memoHead}>re: land programme, phase 2</p>
                  <p>
                    the <Frag index={0}>greenhouse</Frag> site is confirmed. 100+ acres. already operational.
                  </p>
                  <p>
                    students work on live systems — drones, vertical stacks, the <Frag index={1}>bio-cng loop</Frag>.
                    real credit. their patents stay theirs.
                  </p>
                  <p>
                    we don&apos;t want applicants. we want the ones who <Frag index={2}>notice things</Frag>.
                  </p>
                  <p>
                    public name of the project: <span className={styles.hardRedact}>{"\u2588\u2588\u2588\u2588\u2588\u2588"}</span> — six letters. keep it quiet.
                  </p>
                  <p className={styles.memoSign}>— r.</p>
                </article>
                <div className={styles.actions}>
                  {memoUnlocked ? (
                    <button type="button" className={styles.cmd} onClick={() => { beep("tick"); setPhase("cal"); }}>
                      &gt; keep going
                    </button>
                  ) : (
                    <p className={styles.aside}>{3 - revealed.size} fragment{3 - revealed.size === 1 ? "" : "s"} still locked.</p>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {phase === "cal" && (
          <section className={styles.block}>
            <Typed lines={CAL_INTRO} onDone={() => setCalTyped(true)} speed={15} />
            {calTyped && (
              <div className={`${styles.rig} ${calFlash === "miss" ? styles.rigMiss : ""} ${calFlash === "hit" ? styles.rigHit : ""}`}>
                <div className={styles.track} onPointerDown={attemptLock} role="button" aria-label="lock the drifting line inside the band" tabIndex={0}>
                  <div
                    className={styles.bandZone}
                    style={{ left: `${(band.center - band.width / 2) * 100}%`, width: `${band.width * 100}%` }}
                  />
                  <div className={styles.needle} ref={needleRef} />
                </div>
                <div className={styles.rigMeta}>
                  <span>locks: {locks}/3</span>
                  <span>tap the line · or space</span>
                  <span>{calMisses > 0 ? `slips: ${calMisses}` : "\u00a0"}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {phase === "judge" && (
          <section className={styles.block}>
            <Typed lines={JUDGE_INTRO} onDone={() => setJudgeTyped(true)} speed={15} />
            {judgeTyped && (
              <div className={styles.judge} key={scenarioIndex}>
                <p className={styles.judgeCount}>{scenarioIndex + 1} / {SCENARIOS.length}</p>
                <p className={styles.judgePrompt}>{SCENARIOS[scenarioIndex].prompt}</p>
                <div className={styles.judgeOptions}>
                  {SCENARIOS[scenarioIndex].options.map((option, optionIndex) => (
                    <button
                      key={option}
                      type="button"
                      className={styles.option}
                      onClick={() => answerScenario(optionIndex)}
                      disabled={Boolean(verdictLine)}
                    >
                      <span>{String.fromCharCode(97 + optionIndex)}</span> {option}
                    </button>
                  ))}
                </div>
                <p className={styles.judgeVerdict}>{verdictLine ?? "\u00a0"}</p>
              </div>
            )}
          </section>
        )}

        {phase === "cipher" && (
          <section className={styles.block}>
            <Typed lines={CIPHER_INTRO} onDone={() => setCipherTyped(true)} speed={15} />
            {cipherTyped && (
              <div className={`${styles.cipher} ${cipherShake ? styles.cipherShake : ""}`}>
                <div className={`${styles.cipherEntry} ${solved ? styles.cipherSolved : ""}`}>
                  {CIPHER_TARGET.split("").map((_, index) => (
                    <span key={index} className={styles.cipherSlot}>
                      {solved ? CIPHER_TARGET[index] : entry[index] ?? "_"}
                    </span>
                  ))}
                </div>
                {!solved && (
                  <div className={styles.tiles}>
                    {tiles.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        className={styles.tile}
                        disabled={usedTiles.has(tile.id)}
                        onClick={() => pressTile(tile.id, tile.letter)}
                      >
                        {tile.letter}
                      </button>
                    ))}
                  </div>
                )}
                {solved && <p className={styles.aside}>decrypting…</p>}
              </div>
            )}
          </section>
        )}

        {phase === "file" && (
          <section className={`${styles.block} ${styles.fileBlock}`}>
            <p className={styles.stamp}>file decrypted · clearance: yours now</p>
            <h1 className={styles.fileTitle}>project udyaan</h1>
            <div className={styles.dossier}>
              <p>
                it&apos;s real. a working farmland — not a lab bench, not a seminar hall. 100+ acres,
                already running.
              </p>
              <p>
                drone and robot precision farming. vertical microgreen stacks. hydro-aeroponics.
                a bio-cng loop that powers the farm with its own waste.
              </p>
              <p>
                students get embedded in live systems for real academic credit. what you invent,
                you keep — patents stay with the people who build them. a venture studio takes
                the good prototypes to market.
              </p>
              <p>
                built by jain group. unannounced. no application drive, no posters. the intake is
                quiet, and it runs on exactly one signal: who plays this to the end.
              </p>
              <figure className={styles.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/udyaan-greenhouse.jpg" alt="field photo of the greenhouse site" loading="lazy" />
                <figcaption>field photo · node 03 · undisclosed acreage</figcaption>
              </figure>
              <div className={styles.report}>
                <p className={styles.reportHead}>operator report</p>
                <div>
                  <span>run time<b>{elapsed || "\u2014"}</b></span>
                  <span>hand slips<b>{calMisses}</b></span>
                  <span>variance<b>{variance === 0 ? "low" : variance === 1 ? "mild" : "notable"}</b></span>
                </div>
              </div>
              <p className={styles.fileClose}>
                you played it to the end. most people won&apos;t.
              </p>
              <p className={styles.fileClose}>
                the intake form is live. it closes when it closes.
              </p>
            </div>
            <div className={styles.actions}>
              <Link href="/survey" className={styles.cmdSolid}>
                &gt; open the intake form
              </Link>
            </div>
            <p className={styles.psst}>(send the link to one person who notices things.)</p>
          </section>
        )}

        <footer className={styles.foot}>
          <span>{"\u25cf"} rec</span>
          <span>do not forward · do not screenshot · (you will anyway)</span>
        </footer>
      </div>
    </main>
  );
}
