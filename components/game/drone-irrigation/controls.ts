"use client";

import { useEffect, useRef, type RefObject } from "react";
import { clamp, idleInput, type FlightInput, type Mission } from "./simulation";

const FLIGHT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyR", "KeyF", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight"]);

export function useFlightControls(mission: RefObject<Mission>, onPause: () => void) {
  const input = useRef<FlightInput>(idleInput());
  const keys = useRef(new Set<string>());
  const touch = useRef<FlightInput>(idleInput());
  const pause = useRef(onPause);
  pause.current = onPause;
  const sync = () => {
    const held = (first: string, second?: string) => Number(keys.current.has(first) || Boolean(second && keys.current.has(second)));
    input.current = {
      sideways: clamp(held("KeyD", "ArrowRight") - held("KeyA", "ArrowLeft") + touch.current.sideways, -1, 1),
      forward: clamp(held("KeyW", "ArrowUp") - held("KeyS", "ArrowDown") + touch.current.forward, -1, 1),
      lift: clamp(held("KeyR") - held("KeyF") + touch.current.lift, -1, 1),
      yaw: clamp(held("KeyQ") - held("KeyE") + touch.current.yaw, -1, 1),
      spray: keys.current.has("Space") || touch.current.spray,
      brake: keys.current.has("ShiftLeft") || keys.current.has("ShiftRight") || touch.current.brake,
    };
  };
  const reset = () => { keys.current.clear(); touch.current = idleInput(); input.current = idleInput(); };
  const setTouch = (values: Partial<FlightInput>) => { Object.assign(touch.current, values); sync(); };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest("dialog") || event.target.closest("input, textarea, select"))) return;
      if ((event.code === "Escape" || event.code === "KeyP") && mission.current.phase === "flying") {
        event.preventDefault(); reset(); pause.current(); return;
      }
      if (mission.current.phase !== "flying" || !FLIGHT_KEYS.has(event.code)) return;
      event.preventDefault(); keys.current.add(event.code); sync();
    };
    const up = (event: KeyboardEvent) => {
      if (FLIGHT_KEYS.has(event.code)) { keys.current.delete(event.code); sync(); }
    };
    const blur = () => { reset(); if (mission.current.phase === "flying") pause.current(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      reset();
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
    };
  }, [mission]);

  return { input, reset, setTouch };
}

export function useFlightAudio(mission: RefObject<Mission>, muted: boolean) {
  const audio = useRef<{ context: AudioContext; motor: OscillatorNode; gain: GainNode; spray: GainNode } | null>(null);
  const mute = useRef(muted);
  mute.current = muted;
  const start = () => {
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const motor = context.createOscillator(); motor.type = "sawtooth";
        const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 550;
        const gain = context.createGain(); gain.gain.value = 0;
        motor.connect(filter); filter.connect(gain); gain.connect(context.destination); motor.start();
        const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = noise.getChannelData(0);
        for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
        const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
        const sprayFilter = context.createBiquadFilter(); sprayFilter.type = "bandpass"; sprayFilter.frequency.value = 1800;
        const spray = context.createGain(); spray.gain.value = 0;
        source.connect(sprayFilter); sprayFilter.connect(spray); spray.connect(context.destination); source.start();
        audio.current = { context, motor, gain, spray };
      }
      void audio.current.context.resume().catch(() => {});
    } catch { audio.current = null; }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!audio.current) return;
      const { context, gain, motor, spray } = audio.current;
      const active = mission.current.phase === "flying" && !mute.current;
      gain.gain.setTargetAtTime(active ? 0.018 : 0, context.currentTime, 0.12);
      spray.gain.setTargetAtTime(active && mission.current.spraying ? 0.023 : 0, context.currentTime, 0.08);
      motor.frequency.setTargetAtTime(72 + mission.current.thrust * 0.1, context.currentTime, 0.2);
    }, 100);
    return () => { clearInterval(timer); void audio.current?.context.close().catch(() => {}); audio.current = null; };
  }, [mission]);
  return { start };
}