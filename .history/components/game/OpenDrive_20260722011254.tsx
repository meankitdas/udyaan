"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./OpenDrive.module.css";

type Phase = "boot" | "drive" | "cipher" | "sim" | "file";

/* ------------------------------------------------------------------ */
/* copy                                                                */
/* ------------------------------------------------------------------ */

const BOOT_LINES = [
  "jgi-fs02 \u2014 shared drive",
  "directory listing: ON",
  "",
  "this server was supposed to be internal.",
  "someone forgot to turn the listing off. months ago.",
  "",
  "everything below is exactly as we found it.",
];

const DRIVE_INTRO = [
  "five folders. one encrypted file.",
  "most of this is boring. some of it isn't.",
  "tap anything that feels wrong.",
];

const CIPHER_INTRO = [
  "check \u2014 the name.",
  "it's scattered through everything you just read. six letters.",
  "spell it and the file opens.",
];

const SIM_INTRO = [
  "\u2588\u2588\u2588\u2588\u2588\u2588.enc \u2192 udyaan.enc \u2014 decrypted",
  "",
  "inside: one executable. cohort-0_field_simulator",
  "\u20b910,000. one season. the farm remembers everything you do.",
];

const CIPHER_TARGET = "UDYAAN";

/* ------------------------------------------------------------------ */
/* leak file definitions                                               */
/* ------------------------------------------------------------------ */

type LeakId = "budget" | "vendors" | "exam" | "students" | "wifi" | "readme" | "enc";

type LeakFile = {
  id: LeakId;
  dir: string;
  name: string;
  size: string;
  modified: string;
};

const FILES: LeakFile[] = [
  { id: "readme", dir: "/", name: "README_DO_NOT_DELETE.txt", size: "1 kb", modified: "11 mar, 02:14" },
  { id: "budget", dir: "/finance", name: "q3_budget_draft_v7_FINAL.xlsx", size: "482 kb", modified: "28 sep, 19:42" },
  { id: "vendors", dir: "/finance", name: "vendor_payments_sept.pdf", size: "1.1 mb", modified: "30 sep, 11:03" },
  { id: "exam", dir: "/exams", name: "sem6_cs_question_paper.docx", size: "214 kb", modified: "04 oct, 23:58" },
  { id: "students", dir: "/students", name: "student_master.csv", size: "3.8 mb", modified: "02 oct, 09:17" },
  { id: "wifi", dir: "/it", name: "wifi_passwords.txt", size: "2 kb", modified: "17 aug, 14:31" },
  { id: "enc", dir: "/", name: "\u2588\u2588\u2588\u2588\u2588\u2588.enc", size: "77 mb", modified: "\u2014" },
];

type EvidenceId = "land" | "agrotech" | "drip" | "cohort" | "greenhouse";

const EVIDENCE_LABEL: Record<EvidenceId, string> = {
  land: "\u20b944cr land buy",
  agrotech: "agrotech vendor",
  drip: "drip q. in a cs paper",
  cohort: "field hours column",
  greenhouse: "greenhouse wifi node",
};

const EVIDENCE_NEEDED = 4;

/* ------------------------------------------------------------------ */
/* season simulator                                                    */
/* ------------------------------------------------------------------ */

type SimOption = {
  label: string;
  cash?: number;
  health?: number;
  factor?: number; // revenue = health * factor (final stage)
  flat?: number;
  note: string;
};

type SimStage = { week: string; prompt: string; options: SimOption[] };

const SIM_STAGES: SimStage[] = [
  {
    week: "week 1 \u2014 sowing",
    prompt: "the seed shop has two shelves. your neighbour has leftovers from last season.",
    options: [
      { label: "cheap seeds (\u2212\u20b9100)", cash: -100, health: -12, note: "half of them won't wake up. you'll find out which half too late." },
      { label: "certified high-yield (\u2212\u20b9500)", cash: -500, health: 12, note: "expensive. boring. correct." },
      { label: "neighbour's leftovers (free)", cash: 0, health: -22, note: "free seeds carry last season's problems in their pockets." },
    ],
  },
  {
    week: "week 4 \u2014 forecast",
    prompt: "heavy rain predicted for the weekend. the field has no drainage.",
    options: [
      { label: "dig drainage now (\u2212\u20b92,000)", cash: -2000, health: 15, note: "the rain came. it left through the channels you dug." },
      { label: "tarpaulin over the beds (\u2212\u20b9400)", cash: -400, health: -6, note: "the water went under. it always goes under." },
      { label: "do nothing, save the cash", cash: 0, health: -28, note: "standing water for six days. the roots drowned quietly." },
    ],
  },
  {
    week: "week 9 \u2014 pests",
    prompt: "small holes in the leaves. the shop sells chemicals. the internet says yellow traps.",
    options: [
      { label: "yellow sticky traps + oil (\u2212\u20b9300)", cash: -300, health: 6, note: "the bugs went for the yellow. the bees never noticed." },
      { label: "broad-spectrum spray (\u2212\u20b91,500)", cash: -1500, health: -6, note: "the bugs died. so did the pollinators. quiet field now." },
      { label: "wait and watch (free)", cash: 0, health: -20, note: "the holes got bigger. patience is not a pesticide." },
    ],
  },
  {
    week: "week 14 \u2014 harvest",
    prompt: "the crop is what it is. three buyers on the phone.",
    options: [
      { label: "middleman \u2014 instant, low price", factor: 40, note: "he counted the cash before you finished loading the truck." },
      { label: "apartments direct \u2014 high effort (\u2212\u20b91,000)", factor: 80, flat: -1000, note: "four trips. sore back. the ledger smiles." },
      { label: "make puree \u2014 slow, stable", factor: 55, note: "jars don't rot while you sleep. decent call." },
    ],
  },
];

const SIM_START_CASH = 10000;
const SIM_START_HEALTH = 60;

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

function rupees(value: number): string {
  return `\u20b9${value.toLocaleString("en-IN")}`;
}

function Typed({ lines, onDone, speed = 16 }: { lines: string[]; onDone?: () => void; speed?: number }) {
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

function Meter({ label, value, max, unit }: { label: string; value: number; max: number; unit?: string }) {
  const cells = 12;
  const filled = Math.round(Math.max(0, Math.min(1, value / max)) * cells);
  return (
    <div className={styles.meter}>
      <span>{label}</span>
      <b aria-hidden>
        {"\u2588".repeat(filled)}
        {"\u2591".repeat(cells - filled)}
      </b>
      <em>{unit === "money" ? rupees(value) : value}</em>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export function OpenDrive() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [bootDone, setBootDone] = useState(false);
  const [balked, setBalked] = useState(false);

  // drive
  const [driveTyped, setDriveTyped] = useState(false);
  const [openFile, setOpenFile] = useState<LeakId | null>(null);
  const [evidence, setEvidence] = useState<Set<EvidenceId>>(new Set());
  const [encNudge, setEncNudge] = useState(false);

  // cipher
  const [cipherTyped, setCipherTyped] = useState(false);
  const [tiles] = useState(() => shuffle([..."UDYAANKR"].map((letter, index) => ({ letter, id: index }))));
  const [usedTiles, setUsedTiles] = useState<Set<number>>(new Set());
  const [entry, setEntry] = useState("");
  const [cipherShake, setCipherShake] = useState(false);
  const [solved, setSolved] = useState(false);

  // simulator
  const [simTyped, setSimTyped] = useState(false);
  const [simStage, setSimStage] = useState(0);
  const [cash, setCash] = useState(SIM_START_CASH);
  const [health, setHealth] = useState(SIM_START_HEALTH);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simNote, setSimNote] = useState<string | null>(null);
  const [simOver, setSimOver] = useState<"pass" | "fail" | null>(null);
  const [seasons, setSeasons] = useState(1);

  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState("");
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback((kind: "tick" | "ok" | "bad" | "open") => {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      const audio = audioRef.current ?? new window.AudioContext();
      audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const spec = kind === "ok" ? [660, 880] : kind === "bad" ? [180] : kind === "open" ? [440, 554, 660, 880] : [980];
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
      /* sound is optional */
    }
  }, []);

  useEffect(() => () => void audioRef.current?.close(), []);

  const flag = useCallback(
    (id: EvidenceId) => {
      setEvidence((current) => {
        if (current.has(id)) return current;
        beep("ok");
        const next = new Set(current);
        next.add(id);
        return next;
      });
    },
    [beep],
  );

  const crackable = evidence.size >= EVIDENCE_NEEDED;

  const openEnc = useCallback(() => {
    if (crackable) {
      beep("tick");
      setPhase("cipher");
    } else {
      beep("bad");
      setEncNudge(true);
      window.setTimeout(() => setEncNudge(false), 1400);
    }
  }, [crackable, beep]);

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
          window.setTimeout(() => setPhase("sim"), 1600);
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

  const chooseSim = useCallback(
    (option: SimOption) => {
      if (simNote || simOver) return;
      const revenue = option.factor ? Math.max(0, Math.round(health * option.factor)) + (option.flat ?? 0) : 0;
      const nextCash = cash + (option.cash ?? 0) + revenue;
      const nextHealth = Math.max(0, Math.min(100, health + (option.health ?? 0)));
      setCash(nextCash);
      setHealth(nextHealth);
      setSimNote(option.note);
      setSimLog((log) => [...log, `${SIM_STAGES[simStage].week}: ${option.label}`]);
      beep("tick");
      window.setTimeout(() => {
        setSimNote(null);
        if (simStage + 1 >= SIM_STAGES.length) {
          const pass = nextCash > SIM_START_CASH && nextHealth >= 40;
          setSimOver(pass ? "pass" : "fail");
          beep(pass ? "open" : "bad");
          if (pass && startRef.current != null) {
            const seconds = Math.round((performance.now() - startRef.current) / 1000);
            setElapsed(`${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`);
          }
        } else {
          setSimStage((stage) => stage + 1);
        }
      }, 1900);
    },
    [simNote, simOver, simStage, cash, health, beep],
  );

  const retrySeason = useCallback(() => {
    setSimStage(0);
    setCash(SIM_START_CASH);
    setHealth(SIM_START_HEALTH);
    setSimLog([]);
    setSimNote(null);
    setSimOver(null);
    setSeasons((count) => count + 1);
    beep("tick");
  }, [beep]);

  const profit = cash - SIM_START_CASH;

  /* ---------------- file viewers ---------------- */

  const Anomaly = ({ id, children }: { id: EvidenceId; children: React.ReactNode }) => (
    <button
      type="button"
      className={`${styles.anomaly} ${evidence.has(id) ? styles.anomalyFound : ""}`}
      onClick={() => flag(id)}
    >
      {children}
      {evidence.has(id) && <i className={styles.anomalyTag}>flagged</i>}
    </button>
  );

  const renderViewer = (id: LeakId) => {
    switch (id) {
      case "readme":
        return (
          <div className={styles.docText}>
            <p>if you can read this, the directory listing is still on.</p>
            <p>i raised the ticket in march. and april. and may.</p>
            <p>move the finance folder somewhere sane. and whatever is in the .enc \u2014</p>
            <p>i don&apos;t know what it is, i don&apos;t want to know. it decrypts with a name.</p>
            <p className={styles.docSign}>\u2014 s., it dept (two weeks notice pending)</p>
          </div>
        );
      case "budget":
        return (
          <div className={styles.sheet}>
            <div className={styles.sheetRow + " " + styles.sheetHead}>
              <span>item</span><span>dept</span><span>amount</span>
            </div>
            <div className={styles.sheetRow}><span>lab equipment refresh</span><span>sciences</span><span>\u20b962,40,000</span></div>
            <div className={styles.sheetRow}><span>library digitisation ph.3</span><span>central</span><span>\u20b918,75,000</span></div>
            <div className={styles.sheetRow}><span>sports complex re-turfing</span><span>sports</span><span>\u20b934,10,000</span></div>
            <Anomaly id="land">
              <div className={styles.sheetRow + " " + styles.sheetOdd}>
                <span>land acquisition \u2014 phase 2 (100+ acres)</span><span>???</span><span>\u20b944,00,00,000</span>
              </div>
              <p className={styles.sheetNote}>cell comment: &quot;do not surface in audit deck. \u2014 r.&quot;</p>
            </Anomaly>
            <div className={styles.sheetRow}><span>canteen vendor advance</span><span>admin</span><span>\u20b97,80,000</span></div>
            <div className={styles.sheetRow}><span>convocation logistics</span><span>admin</span><span>\u20b912,00,000</span></div>
          </div>
        );
      case "vendors":
        return (
          <div className={styles.sheet}>
            <div className={styles.sheetRow + " " + styles.sheetHead}>
              <span>vendor</span><span>account</span><span>paid (sept)</span>
            </div>
            <div className={styles.sheetRow}><span>sodexo campus catering</span><span>xxxxxx4417 \u00b7 hdfc</span><span>\u20b921,40,000</span></div>
            <div className={styles.sheetRow}><span>lenovo edu supply</span><span>xxxxxx9022 \u00b7 icici</span><span>\u20b915,66,000</span></div>
            <Anomaly id="agrotech">
              <div className={styles.sheetRow + " " + styles.sheetOdd}>
                <span>{"\u2588\u2588\u2588\u2588\u2588\u2588"} agrotech pvt ltd</span><span>xxxxxx7734 \u00b7 sbi</span><span>\u20b92,10,00,000</span>
              </div>
              <p className={styles.sheetNote}>memo line: &quot;phase 2 systems \u2014 drones, vertical stacks, bio-cng loop&quot;</p>
            </Anomaly>
            <div className={styles.sheetRow}><span>securitas facility mgmt</span><span>xxxxxx1180 \u00b7 axis</span><span>\u20b99,32,000</span></div>
            <p className={styles.docFoot}>account numbers masked by export. small mercies.</p>
          </div>
        );
      case "exam":
        return (
          <div className={styles.docText}>
            <p className={styles.watermark}>specimen copy \u2014 not the live paper. nice try.</p>
            <p className={styles.docHead}>b.tech cs \u2014 semester 6 \u2014 internal assessment</p>
            <p>q5. explain two-phase commit with a coordinator failure. (8 marks)</p>
            <p>q6. derive the time complexity of heapify. (6 marks)</p>
            <Anomaly id="drip">
              <p className={styles.oddLine}>
                q7. a drip line delivers 2L/hr to 40 plants. sprinklers use 9L/hr for the same bed.
                compute water saved over 5 hours and state which sensor you&apos;d trust. (10 marks)
              </p>
              <p className={styles.sheetNote}>margin note: &quot;why is this in a cs paper?? \u2014 moderation&quot;</p>
            </Anomaly>
            <p>q8. compare paxos and raft leader election. (8 marks)</p>
          </div>
        );
      case "students":
        return (
          <div className={styles.sheet}>
            <div className={styles.sheetRow + " " + styles.sheetHead}>
              <span>name</span><span>usn / dept</span><span>field_hours</span>
            </div>
            <div className={styles.sheetRow}><span>a\u2588\u2588\u2588\u2588\u2588 s\u2588\u2588\u2588\u2588</span><span>1jg21cs\u2588\u2588\u2588 \u00b7 cse</span><span>0</span></div>
            <div className={styles.sheetRow}><span>p\u2588\u2588\u2588\u2588 k\u2588\u2588\u2588\u2588\u2588</span><span>1jg21ec\u2588\u2588\u2588 \u00b7 ece</span><span>0</span></div>
            <Anomaly id="cohort">
              <div className={styles.sheetRow + " " + styles.sheetOdd}>
                <span>m\u2588\u2588\u2588\u2588\u2588 r\u2588\u2588</span><span>1jg20bt\u2588\u2588\u2588 \u00b7 biotech</span><span>142 (cohort-0)</span>
              </div>
              <div className={styles.sheetRow + " " + styles.sheetOdd}>
                <span>s\u2588\u2588\u2588\u2588 d\u2588\u2588\u2588\u2588\u2588</span><span>1jg21me\u2588\u2588\u2588 \u00b7 mech</span><span>96 (cohort-0)</span>
              </div>
              <p className={styles.sheetNote}>a hidden column. twelve students logging farm hours no programme officially has.</p>
            </Anomaly>
            <div className={styles.sheetRow}><span>r\u2588\u2588\u2588\u2588 n\u2588\u2588\u2588</span><span>1jg22cs\u2588\u2588\u2588 \u00b7 cse</span><span>0</span></div>
            <p className={styles.docFoot}>names masked by export policy. the column wasn&apos;t.</p>
          </div>
        );
      case "wifi":
        return (
          <div className={styles.docText}>
            <p>JGI-Staff ............ Summer@2019 (never rotated. yes we know.)</p>
            <p>JGI-Guest ............ welcome123</p>
            <p>exam-cell ............ printed on a post-it in room 214</p>
            <p>hostel-block-c ....... hostelC@440v</p>
            <Anomaly id="greenhouse">
              <p className={styles.oddLine}>greenhouse-node3 ..... [rotates weekly \u2014 ask r. directly]</p>
              <p className={styles.sheetNote}>a city campus with no greenhouse has a greenhouse access point.</p>
            </Anomaly>
            <p className={styles.docSign}>\u2014 do not share outside it dept. obviously that worked.</p>
          </div>
        );
      default:
        return null;
    }
  };

  /* ---------------- render ---------------- */

  const headerRight =
    phase === "boot"
      ? "public: yes (oops)"
      : phase === "drive"
        ? `flagged: ${evidence.size}/5`
        : phase === "cipher"
          ? "cracking \u2588\u2588\u2588\u2588\u2588\u2588.enc"
          : phase === "sim"
            ? `cohort-0 sim \u00b7 season ${seasons}`
            : "clearance: granted";

  return (
    <main className={styles.node}>
      <div className={styles.scanlines} aria-hidden />
      <div className={styles.vignette} aria-hidden />

      <div className={styles.frame}>
        <header className={styles.head}>
          <span>jgi-fs02 / shared</span>
          <span className={styles.headRight}>{headerRight}</span>
        </header>

        {phase === "boot" && (
          <section className={styles.block}>
            <Typed lines={BOOT_LINES} onDone={() => setBootDone(true)} />
            {bootDone && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cmd}
                  onClick={() => {
                    startRef.current = performance.now();
                    beep("tick");
                    setPhase("drive");
                  }}
                >
                  &gt; browse the drive
                </button>
                {!balked ? (
                  <button type="button" className={styles.cmdGhost} onClick={() => { setBalked(true); beep("bad"); }}>
                    &gt; leave
                  </button>
                ) : (
                  <p className={styles.aside}>the files aren&apos;t going anywhere. yet.</p>
                )}
              </div>
            )}
          </section>
        )}

        {phase === "drive" && (
          <section className={styles.block}>
            <Typed lines={DRIVE_INTRO} onDone={() => setDriveTyped(true)} speed={14} />
            {driveTyped && !openFile && (
              <div className={styles.listing}>
                <div className={styles.listHead}>
                  <span>name</span>
                  <span>size</span>
                  <span>modified</span>
                </div>
                {FILES.map((file) =>
                  file.id === "enc" ? (
                    <button
                      key={file.id}
                      type="button"
                      className={`${styles.fileRow} ${styles.encRow} ${crackable ? styles.encReady : ""} ${encNudge ? styles.encNudge : ""}`}
                      onClick={openEnc}
                    >
                      <span>{file.dir === "/" ? "" : file.dir + "/"}{file.name}</span>
                      <span>{file.size}</span>
                      <span>{crackable ? "crackable" : "locked"}</span>
                    </button>
                  ) : (
                    <button key={file.id} type="button" className={styles.fileRow} onClick={() => { setOpenFile(file.id); beep("tick"); }}>
                      <span>{file.dir === "/" ? "" : file.dir + "/"}{file.name}</span>
                      <span>{file.size}</span>
                      <span>{file.modified}</span>
                    </button>
                  ),
                )}
                <p className={styles.listFoot}>
                  {encNudge
                    ? "encrypted. the key is a name \u2014 keep reading, keep flagging."
                    : crackable
                      ? "the .enc is ready. you know enough now."
                      : evidence.size > 0
                        ? `flagged: ${[...evidence].map((id) => EVIDENCE_LABEL[id]).join(" \u00b7 ")}`
                        : "open the files. flag what doesn't fit."}
                </p>
              </div>
            )}
            {driveTyped && openFile && (
              <div className={styles.viewer}>
                <div className={styles.viewerBar}>
                  <span>{FILES.find((file) => file.id === openFile)?.dir}/{FILES.find((file) => file.id === openFile)?.name}</span>
                  <button type="button" className={styles.cmdGhost} onClick={() => { setOpenFile(null); beep("tick"); }}>
                    &gt; back to drive
                  </button>
                </div>
                {renderViewer(openFile)}
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
                {solved && <p className={styles.aside}>key accepted. decrypting 77 mb\u2026</p>}
              </div>
            )}
          </section>
        )}

        {phase === "sim" && (
          <section className={styles.block}>
            <Typed lines={SIM_INTRO} onDone={() => setSimTyped(true)} speed={14} />
            {simTyped && (
              <div className={styles.sim}>
                <div className={styles.meters}>
                  <Meter label="cash" value={cash} max={16000} unit="money" />
                  <Meter label="farm" value={health} max={100} />
                </div>

                {!simOver && (
                  <div className={styles.stage} key={simStage}>
                    <p className={styles.stageWeek}>{SIM_STAGES[simStage].week}</p>
                    <p className={styles.stagePrompt}>{SIM_STAGES[simStage].prompt}</p>
                    <div className={styles.stageOptions}>
                      {SIM_STAGES[simStage].options.map((option, optionIndex) => (
                        <button
                          key={option.label}
                          type="button"
                          className={styles.option}
                          onClick={() => chooseSim(option)}
                          disabled={Boolean(simNote)}
                        >
                          <span>{String.fromCharCode(97 + optionIndex)}</span> {option.label}
                        </button>
                      ))}
                    </div>
                    <p className={styles.stageNote}>{simNote ?? "\u00a0"}</p>
                  </div>
                )}

                {simOver === "fail" && (
                  <div className={styles.stage}>
                    <p className={styles.stageWeek}>season over</p>
                    <p className={styles.stagePrompt}>
                      {health < 40
                        ? "the field didn't make it. the ledger doesn't matter when nothing grew."
                        : "you kept the field alive and still lost money. it happens. once."}
                    </p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.cmd} onClick={retrySeason}>
                        &gt; run the season again
                      </button>
                    </div>
                  </div>
                )}

                {simOver === "pass" && (
                  <div className={styles.stage}>
                    <p className={styles.stageWeek}>season closed</p>
                    <p className={styles.stagePrompt}>
                      profit {rupees(profit)} \u00b7 farm at {health}/100. the simulator logs your run and goes quiet.
                    </p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.cmd} onClick={() => { beep("open"); setPhase("file"); }}>
                        &gt; open the last file
                      </button>
                    </div>
                  </div>
                )}

                {simLog.length > 0 && !simOver && (
                  <div className={styles.simLog}>
                    {simLog.map((line) => (
                      <p key={line}>\u2713 {line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {phase === "file" && (
          <section className={`${styles.block} ${styles.fileBlock}`}>
            <p className={styles.stamp}>cohort-0 profile logged</p>
            <h1 className={styles.fileTitle}>project udyaan</h1>
            <div className={styles.dossier}>
              <p>now you know what the \u20b944 crore was for.</p>
              <p>
                a working farmland. 100+ acres, already running. drone and robot precision farming,
                vertical microgreen stacks, hydro-aeroponics, a bio-cng loop that powers the farm
                with its own waste.
              </p>
              <p>
                the &quot;field_hours&quot; column? twelve students already inside. real academic credit.
                patents stay with the people who build them. a venture studio takes the good
                prototypes to market.
              </p>
              <p>
                built by jain group. unannounced. no posters, no application drive. the intake runs
                on one signal \u2014 who digs all the way to the end.
              </p>
              <figure className={styles.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/udyaan-greenhouse.jpg" alt="field photo of the greenhouse site" loading="lazy" />
                <figcaption>greenhouse-node3 \u00b7 the wifi password finally makes sense</figcaption>
              </figure>
              <div className={styles.report}>
                <p className={styles.reportHead}>your trace</p>
                <div>
                  <span>run time<b>{elapsed || "\u2014"}</b></span>
                  <span>anomalies<b>{evidence.size}/5</b></span>
                  <span>season profit<b>{rupees(profit)}</b></span>
                  <span>seasons<b>{seasons}</b></span>
                </div>
              </div>
              <p className={styles.fileClose}>you dug all the way down. most people close the tab.</p>
              <p className={styles.fileClose}>the intake form is live. it closes when it closes.</p>
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
          <span>do not forward \u00b7 do not screenshot \u00b7 (you will anyway)</span>
        </footer>
      </div>
    </main>
  );
}
