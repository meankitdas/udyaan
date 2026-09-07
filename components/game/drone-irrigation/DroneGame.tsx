"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, BatteryMedium, Camera, Check, ChevronDown, ChevronRight, Circle, Clock3, Crosshair, Droplets, Gamepad2, List, LoaderCircle, Map, Maximize2, Minimize2, Move, Pause, Play, Power, RadioTower, RotateCcw, ScanLine, ShieldCheck, Sprout, Volume2, VolumeX, Wind, X } from "lucide-react";
import { BED_SIZE, HOME, LEVELS, SAVE_KEY, WET_TARGET, createMission, missionStars, parseProgress, type FlightInput, type Mission, type Phase, type Progress } from "./simulation";
import { useFlightAudio, useFlightControls } from "./controls";
import { attitudeReadout } from "./camera";
import type { CameraMode } from "./FlightScene";
import styles from "./DroneGame.module.css";

const Scene = dynamic(() => import("./FlightScene"), { ssr: false });
const timeLabel = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;

class SceneBoundary extends Component<{ children: ReactNode; onError: (failed: boolean) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(true); }
  render() { return this.state.failed ? null : this.props.children; }
}

function IconButton({ label, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={`${styles.iconButton} ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function Minimap({ mission }: { mission: Mission }) {
  const toMap = (value: number) => (value + 26) * (220 / 52) + 10;
  const scale = 220 / 52;
  return (
    <div className={styles.map}>
      <svg viewBox="0 0 240 240" role="img" aria-label={`Field moisture map, ${mission.completed} beds irrigated`}>
        <path d="M120 10V230M10 120H230" stroke="#5a7463" strokeWidth="0.5" strokeDasharray="3 5" />
        <rect x={toMap(-23)} y={toMap(-23)} width={46 * scale} height={46 * scale} fill="none" stroke="#809480" strokeWidth="0.7" />
        {mission.beds.map((bed, index) => <rect key={index} x={toMap(bed.x - BED_SIZE / 2)} y={toMap(bed.z - BED_SIZE / 2)} width={BED_SIZE * scale - 1} height={BED_SIZE * scale - 1}
          fill={bed.moisture >= WET_TARGET ? "#99d6a2" : `hsl(${37 + bed.moisture * 100} 35% ${42 + bed.moisture * 18}%)`} />)}
        <rect x={toMap(HOME.x) - 10} y={toMap(HOME.z) - 10} width={20} height={20} fill="none" stroke="#a0d9e2" strokeWidth="1.3" />
        <text x={toMap(HOME.x)} y={toMap(HOME.z) + 4} textAnchor="middle" fill="#b1e6ed" fontSize="10">H</text>
        <g transform={`translate(${toMap(mission.pose.position.x)} ${toMap(mission.pose.position.z)}) rotate(${attitudeReadout(mission.pose).heading})`}>
          <circle r="9" fill="#183b33" fillOpacity="0.8" />
          <path d="M0 -7 L5 5 L0 3 L-5 5 Z" fill="#f6f8e8" />
        </g>
        <text x="120" y="8" textAnchor="middle" fill="#cfdec5" fontSize="8">N</text>
      </svg>
    </div>
  );
}

function FlightStick({ axes, setTouch }: { axes: "throttle" | "translation"; setTouch: (values: Partial<FlightInput>) => void }) {
  const [stick, setStick] = useState({ horizontal: 0, vertical: 0 });
  const pointer = useRef<number | null>(null);
  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const horizontal = event.clientX - rect.left - rect.width / 2;
    const vertical = event.clientY - rect.top - rect.height / 2;
    const length = Math.max(radius, Math.hypot(horizontal, vertical));
    const sideways = horizontal / length;
    const forward = -vertical / length;
    setStick({ horizontal: sideways * radius, vertical: -forward * radius });
    setTouch(axes === "translation" ? { sideways, forward } : { yaw: -sideways, lift: forward });
  };
  const stopStick = () => {
    pointer.current = null;
    setStick({ horizontal: 0, vertical: 0 });
    setTouch(axes === "translation" ? { sideways: 0, forward: 0 } : { yaw: 0, lift: 0 });
  };
  return (
    <div className={styles.joystick} role="group" aria-label={axes === "translation" ? "Flight joystick" : "Throttle and yaw stick"} tabIndex={0}
      onPointerDown={(event) => { if (pointer.current !== null) return; event.preventDefault(); pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveStick(event); }}
      onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick} onBlur={stopStick}>
      <span className={styles.thumb} style={{ transform: `translate(${stick.horizontal}px, ${stick.vertical}px)` }}><Move size={17} /></span>
    </div>
  );
}

function TouchControls({ setTouch }: { setTouch: (values: Partial<FlightInput>) => void }) {
  const hold = (field: "lift" | "yaw", value: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTouch({ [field]: value }); },
    onPointerUp: () => setTouch({ [field]: 0 }),
    onPointerCancel: () => setTouch({ [field]: 0 }),
    onLostPointerCapture: () => setTouch({ [field]: 0 }),
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key === "Enter") { event.preventDefault(); setTouch({ [field]: value }); } },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => { if (event.key === "Enter") setTouch({ [field]: 0 }); },
    onBlur: () => setTouch({ [field]: 0 }),
  });
  return (
    <>
      <div className={styles.leftControl}>
        <div className={styles.yawControls}>
          <IconButton label="Descend" {...hold("lift", -1)}><ArrowDown size={17} /></IconButton>
          <span>THR / YAW</span>
          <IconButton label="Ascend" {...hold("lift", 1)}><ArrowUp size={17} /></IconButton>
        </div>
        <FlightStick axes="throttle" setTouch={setTouch} />
      </div>
      <div className={styles.rightControl}>
        <div className={styles.stickLabel}>PITCH / ROLL</div>
        <FlightStick axes="translation" setTouch={setTouch} />
      </div>
    </>
  );
}

function OnboardDisplay({ mission, mode }: { mission: Mission; mode: CameraMode }) {
  const attitude = attitudeReadout(mission.pose);
  const base = Math.floor(attitude.heading / 10) * 10;
  return (
    <div className={styles.onboardDisplay} aria-hidden="true">
      <div className={styles.compass}>
        <div className={styles.compassTape}>
          {Array.from({ length: 11 }, (_, index) => {
            const angle = base + (index - 5) * 10;
            const heading = (angle % 360 + 360) % 360;
            const cardinal: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };
            return <span key={angle} style={{ left: `${50 + (angle - attitude.heading) * 1.35}%` }}><i />{cardinal[heading] ?? String(heading).padStart(3, "0")}</span>;
          })}
        </div>
        <ChevronDown size={14} />
        <strong>{String(Math.round(attitude.heading) % 360).padStart(3, "0")}<small> HDG</small></strong>
      </div>
      <div className={styles.reticle}><span /><span /><i /></div>
      <div className={styles.attitudeIndicator}>
        <div className={styles.attitudeFace}>
          <div className={styles.attitudeHorizon} style={{ transform: `rotate(${-attitude.roll}deg)` }}><span style={{ transform: `translateY(${Math.max(-20, Math.min(20, attitude.pitch))}px)` }} /></div>
          <i />
        </div>
        <span>{mode === "gimbal" ? "GIMBAL" : "FPV"}</span>
      </div>
    </div>
  );
}

export default function DroneGame() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("gimbal");
  const [cameraTilt, setCameraTilt] = useState(15);
  const [sticksVisible, setSticksVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [, updateHud] = useState(0);
  const mission = useRef(createMission(LEVELS[0]));
  const dialog = useRef<HTMLDialogElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const level = LEVELS[levelIndex];
  const current = mission.current;
  const phaseBeforeMenu = useRef<Phase>("ready");
  const controls = useFlightControls(mission, () => { mission.current.phase = "paused"; setPhase("paused"); });
  const audio = useFlightAudio(mission, muted);
  const dialogOpen = missionsOpen || phase === "paused" || phase === "won" || phase === "lost";

  useEffect(() => {
    try { setProgress(parseProgress(localStorage.getItem(SAVE_KEY))); } catch {}
    const mobile = matchMedia("(pointer: coarse), (max-width: 650px)");
    const updateSticks = () => setSticksVisible(mobile.matches);
    updateSticks();
    mobile.addEventListener("change", updateSticks);
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => { document.removeEventListener("fullscreenchange", onFullscreen); mobile.removeEventListener("change", updateSticks); };
  }, []);

  useEffect(() => {
    const tilt = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, dialog")) return;
      if (event.code !== "BracketLeft" && event.code !== "BracketRight") return;
      event.preventDefault();
      setCameraTilt((value) => Math.max(-10, Math.min(90, value + (event.code === "BracketRight" ? 5 : -5))));
    };
    window.addEventListener("keydown", tilt);
    return () => window.removeEventListener("keydown", tilt);
  }, []);

  useEffect(() => {
    if (phase !== "flying") { controls.reset(); return; }
    const timer = window.setInterval(() => updateHud((value) => value + 1), 100);
    return () => clearInterval(timer);
  }, [phase, attempt]);

  useEffect(() => {
    if (!dialog.current) return;
    if (dialogOpen && !dialog.current.open) dialog.current.showModal();
    if (!dialogOpen && dialog.current.open) dialog.current.close();
  }, [dialogOpen]);

  useEffect(() => {
    if (!failed) return;
    mission.current.phase = "ready";
    controls.reset();
    setPhase("ready");
    setReady(false);
    setMissionsOpen(false);
  }, [failed]);

  useEffect(() => {
    if (phase !== "won") return;
    const stars = missionStars(mission.current, LEVELS[levelIndex]);
    setProgress((previous) => {
      let stored: Progress = {};
      try { stored = parseProgress(localStorage.getItem(SAVE_KEY)); } catch {}
      const next = { ...stored, ...previous, [levelIndex + 1]: Math.max(stars, previous[levelIndex + 1] ?? 0, stored[levelIndex + 1] ?? 0) };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [phase, levelIndex, attempt]);

  const launch = () => { if (!ready || failed) return; controls.reset(); audio.start(); current.phase = "flying"; setPhase("flying"); };
  const pause = () => { controls.reset(); current.phase = "paused"; setPhase("paused"); };
  const resume = () => { controls.reset(); audio.start(); current.phase = "flying"; setPhase("flying"); };
  const chooseLevel = (index: number) => {
    controls.reset(); mission.current = createMission(LEVELS[index]); setLevelIndex(index); setPhase("ready");
    setReady(false); setMissionsOpen(false); setCameraMode("gimbal"); setCameraTilt(15); setAttempt((value) => value + 1);
  };
  const openMissions = () => {
    phaseBeforeMenu.current = phase; controls.reset();
    if (phase === "flying") { current.phase = "paused"; setPhase("paused"); }
    setMissionsOpen(true);
  };
  const closeMissions = () => {
    setMissionsOpen(false);
    if (phaseBeforeMenu.current === "flying") { current.phase = "flying"; setPhase("flying"); }
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void root.current?.requestFullscreen?.().catch(() => {});
  };
  const retryGraphics = () => { setFailed(false); setSceneKey((value) => value + 1); chooseLevel(levelIndex); };
  const efficiency = current.used > 0 ? Math.round(current.delivered / current.used * 100) : 0;
  const attitude = attitudeReadout(current.pose);
  const homeDistance = Math.hypot(current.pose.position.x - HOME.x, current.pose.position.z - HOME.z);
  const flightSpeed = Math.hypot(current.pose.velocity.x, current.pose.velocity.z);
  const warning = current.water < 1 || current.battery < 20 || current.integrity < 40;
  const status = current.servicing ? "Service pad connected" : current.water < 0.1 ? "Tank empty" : current.battery < 20 ? "Low battery" : current.integrity < 40 ? "Airframe damage" : current.spraying ? "Irrigation active" : "Altitude hold";

  return (
    <main className={styles.game} ref={root} data-testid="drone-game" data-phase={phase} data-level={level.id} data-ready={ready} data-view={phase === "ready" ? "external" : "onboard"} data-camera={cameraMode} data-tilt={cameraTilt} data-sticks={sticksVisible}>
      <div className={`${styles.fallback} ${ready && !failed ? styles.hidden : ""}`} aria-hidden="true">
        <Image src="/udyaan-greenhouse.jpg" alt="" fill sizes="100vw" priority />
      </div>
      <div className={styles.canvas}>
        {!failed && <SceneBoundary key={sceneKey} onError={setFailed}>
          <Scene level={level} mission={mission} input={controls.input} phase={phase} attempt={attempt} cameraMode={cameraMode} cameraTilt={cameraTilt}
            onReady={setReady} onError={setFailed} onPhase={setPhase} />
        </SceneBoundary>}
      </div>
      <div className={styles.shade} />
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Udyaan home"><RadioTower size={21} /><span><strong>FIELD PILOT</strong><small>UDYAAN / FLIGHT SIM</small></span></Link>
        <div className={styles.missionName}><span>FIELD {String(level.id).padStart(2, "0")}</span><strong>{level.location}</strong></div>
        <div className={styles.topActions}>
          <div className={styles.cameraModes} role="group" aria-label="Camera view">
            <IconButton label="FPV camera" aria-pressed={cameraMode === "fpv"} onClick={() => setCameraMode("fpv")}><Camera size={18} /></IconButton>
            <IconButton label="Stabilized camera" aria-pressed={cameraMode === "gimbal"} onClick={() => setCameraMode("gimbal")}><ScanLine size={18} /></IconButton>
          </div>
          <IconButton label="Field map" aria-pressed={mapVisible} onClick={() => setMapVisible((value) => !value)}><Map size={17} /></IconButton>
          <IconButton label="Flight sticks" aria-pressed={sticksVisible} onClick={() => { controls.reset(); setSticksVisible((value) => !value); }}><Gamepad2 size={18} /></IconButton>
          <IconButton label="Select mission" onClick={openMissions}><List size={18} /></IconButton>
          <IconButton label={muted ? "Enable sound" : "Mute sound"} onClick={() => { setMuted((value) => !value); audio.start(); }}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</IconButton>
          <IconButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className={styles.fullscreen} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</IconButton>
          {phase === "flying" && <IconButton label="Pause flight" onClick={pause}><Pause size={19} /></IconButton>}
        </div>
      </header>

      <section className={styles.instruments} aria-label="Mission instruments">
        <div className={styles.instrument}><span><Sprout size={13} />COVERAGE</span><strong>{Math.round(current.completed / current.beds.length * 100)}<small>%</small></strong><progress aria-label="Irrigation objective" max={current.goal} value={Math.min(current.goal, current.completed)} /></div>
        <div className={`${styles.instrument} ${current.water < 3 ? styles.low : ""}`}><span><Droplets size={13} />WATER</span><strong>{current.water.toFixed(1)}<small>L</small></strong><progress className={styles.waterBar} aria-label="Water tank" max={level.tank} value={current.water} /></div>
        <div className={`${styles.instrument} ${current.battery < 20 ? styles.low : ""}`}><span><BatteryMedium size={13} />BATTERY</span><strong>{Math.ceil(current.battery)}<small>%</small></strong><progress aria-label="Battery charge" max={100} value={current.battery} /></div>
        <div className={`${styles.instrument} ${current.integrity < 40 ? styles.low : ""}`}><span><ShieldCheck size={13} />AIRFRAME</span><strong>{Math.ceil(current.integrity)}<small>%</small></strong><progress aria-label="Airframe integrity" max={100} value={current.integrity} /></div>
        <div className={`${styles.instrument} ${styles.timer}`}><span><Clock3 size={13} />FLIGHT</span><strong>{timeLabel(current.elapsed)}</strong></div>
      </section>

      {ready && !failed && phase !== "ready" && <OnboardDisplay mission={current} mode={cameraMode} />}
      <div className={styles.feedLabel}><span>SIM</span><Camera size={12} />{phase === "ready" ? "EXTERNAL / POWER OFF" : cameraMode === "fpv" ? "ONBOARD / FPV" : "ONBOARD / STABILIZED"}</div>
      <div className={styles.weather}><Wind size={16} /><span>{Math.hypot(current.wind.x, current.wind.z).toFixed(1)} m/s</span><ArrowRight size={13} style={{ transform: `rotate(${Math.atan2(current.wind.z, current.wind.x)}rad)` }} /></div>

      {mapVisible && <aside className={styles.mapArea} aria-label="Field conditions">
        <Minimap mission={current} />
        <div className={styles.mapCaption}><span>FIELD / {String(level.id).padStart(2, "0")}</span><span>H / HOME</span></div>
      </aside>}

      {phase !== "ready" && <section className={styles.cameraPanel} aria-label="Camera gimbal">
        <div className={styles.cameraPanelHeading}><span>CAM TILT</span><output htmlFor="camera-tilt">{cameraTilt > 0 ? "-" : cameraTilt < 0 ? "+" : ""}{Math.abs(cameraTilt)}<small> DEG</small></output></div>
        <input id="camera-tilt" type="range" min={-10} max={90} step={5} value={cameraTilt} aria-label="Camera tilt" onChange={(event) => setCameraTilt(Number(event.target.value))} />
        <div className={styles.cameraPresets}>
          <IconButton label="Look ahead" onClick={() => setCameraTilt(0)}><Crosshair size={16} /></IconButton>
          <IconButton label="Look down" onClick={() => { setCameraMode("gimbal"); setCameraTilt(90); }}><ArrowDownToLine size={16} /></IconButton>
        </div>
      </section>}

      {phase === "ready" && !failed && <section className={styles.brief} aria-labelledby="mission-title">
        <div className={styles.briefInfo}>
          <p className={styles.eyebrow}><span>FLIGHT PLAN {String(level.id).padStart(2, "0")}</span><span>{progress[level.id] ? "COMPLETED" : "READY"}</span></p>
          <h1 id="mission-title">{level.name}</h1>
          <p className={styles.objective}>Irrigation / {Math.ceil(current.goal / current.beds.length * 100)}% coverage / {timeLabel(level.duration)} window</p>
        </div>
        <div className={styles.briefActions}>
          <IconButton label="Field plans" onClick={openMissions}><List size={19} /></IconButton>
          <button type="button" className={styles.primary} onClick={launch} disabled={!ready}><Power size={16} />Take off</button>
        </div>
      </section>}

      {ready && !failed && <>
        <div className={styles.flightStatus} data-warning={warning} role="status"><span className={styles.flightMode}>{phase === "ready" ? "STANDBY" : "P-ALT"}</span>{phase === "ready" ? "Pre-flight ready" : status}</div>
        <div className={styles.telemetry} data-testid="flight-telemetry" data-x={current.pose.position.x.toFixed(3)} data-y={current.pose.position.y.toFixed(3)} data-z={current.pose.position.z.toFixed(3)} data-water={current.water.toFixed(3)} data-completed={current.completed} data-elapsed={current.elapsed.toFixed(3)} data-speed={flightSpeed.toFixed(3)} data-heading={attitude.heading.toFixed(2)} data-roll={attitude.roll.toFixed(2)} data-pitch={attitude.pitch.toFixed(2)}>
          <div><span>HEIGHT</span><strong>{Math.max(0, current.pose.position.y - HOME.y).toFixed(1)}<small> m</small></strong></div>
          <div><span>HOME</span><strong>{homeDistance.toFixed(1)}<small> m</small></strong></div>
          <div><span>H.SPEED</span><strong>{flightSpeed.toFixed(1)}<small> m/s</small></strong></div>
          <div><span>V.SPEED</span><strong>{current.pose.velocity.y > 0.05 ? "+" : ""}{current.pose.velocity.y.toFixed(1)}<small> m/s</small></strong></div>
        </div>
        {phase === "flying" && <>
          {sticksVisible && <TouchControls setTouch={controls.setTouch} />}
          <button className={styles.spray} type="button" title="Spray water" aria-label="Spray water" aria-pressed={current.spraying}
            onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); controls.setTouch({ spray: true }); }}
            onPointerUp={() => controls.setTouch({ spray: false })} onPointerCancel={() => controls.setTouch({ spray: false })} onLostPointerCapture={() => controls.setTouch({ spray: false })}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); controls.setTouch({ spray: true }); } }}
            onKeyUp={(event) => { if (event.key === "Enter") controls.setTouch({ spray: false }); }} onBlur={() => controls.setTouch({ spray: false })}>
            <Droplets size={23} /><span>{current.spraying ? "FLOW" : "PUMP"}</span>
          </button>
        </>}
      </>}

      {!ready && !failed && <div className={styles.loading} role="status"><LoaderCircle size={15} />Preparing the field</div>}
      {failed && <section className={styles.error} role="alert"><h1>3D view unavailable</h1><button className={styles.primary} type="button" onClick={retryGraphics}><RotateCcw size={17} />Retry graphics</button><Link className={styles.secondary} href="/"><ArrowLeft size={16} />Back to Udyaan</Link></section>}

      <dialog ref={dialog} className={styles.dialog} aria-labelledby="flight-dialog-title" onCancel={(event) => { event.preventDefault(); if (missionsOpen) closeMissions(); else if (phase === "paused") resume(); }}>
        <div className={styles.dialogHeader}>
          <div><p>{missionsOpen ? "OPERATIONS / 05 FIELDS" : `FIELD ${String(level.id).padStart(2, "0")} / ${level.location}`}</p><h2 id="flight-dialog-title">{missionsOpen ? "Field plans" : phase === "paused" ? "Flight paused" : phase === "won" ? "Operation complete" : current.reason}</h2></div>
          {(missionsOpen || phase === "paused") && <IconButton label={missionsOpen ? "Close mission list" : "Resume flight"} onClick={missionsOpen ? closeMissions : resume}><X size={19} /></IconButton>}
        </div>
        {missionsOpen ? <ul className={styles.levelList}>
          {LEVELS.map((item, index) => <li key={item.id}><button type="button" onClick={() => chooseLevel(index)} aria-label={`Mission ${item.id}: ${item.name}`}>
            <span className={styles.levelNumber}>{String(item.id).padStart(2, "0")}</span><span className={styles.levelCopy}><strong>{item.name}</strong><small>{item.difficulty} / {item.wind.toFixed(1)} m/s wind</small></span>
            <span className={styles.planStatus} aria-label={progress[item.id] ? "Completed" : "Not flown"}>{progress[item.id] ? <Check size={16} /> : <Circle size={12} />}</span><ChevronRight size={16} />
          </button></li>)}
        </ul> : <>
          <dl className={styles.results}>
            <div><dt>Beds irrigated</dt><dd>{current.completed} / {current.beds.length}</dd></div>
            <div><dt>Flight time</dt><dd>{timeLabel(current.elapsed)}</dd></div>
            <div><dt>Water delivered</dt><dd>{efficiency}%</dd></div>
            <div><dt>Airframe</dt><dd>{Math.ceil(current.integrity)}%</dd></div>
          </dl>
          <div className={styles.dialogActions}>
            {phase === "paused" && <button type="button" className={styles.primary} onClick={resume}><Play size={17} />Resume flight</button>}
            {phase === "won" && levelIndex < LEVELS.length - 1 && <button type="button" className={styles.primary} onClick={() => chooseLevel(levelIndex + 1)}>Next mission<ArrowRight size={17} /></button>}
            <button type="button" className={phase === "lost" ? styles.primary : styles.secondary} onClick={() => chooseLevel(levelIndex)}><RotateCcw size={16} />Retry mission</button>
            <button type="button" className={phase === "won" && levelIndex === LEVELS.length - 1 ? styles.primary : styles.secondary} onClick={openMissions}><List size={16} />Mission log</button>
            <Link href="/" className={styles.secondary}><ArrowLeft size={16} />Back to Udyaan</Link>
          </div>
        </>}
      </dialog>
    </main>
  );
}