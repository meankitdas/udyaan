"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "./icons";

// Placeholder clip until the real survey intro film is produced.
const INTRO_SRC = "/udyaan-aerial.mp4";
const INTRO_POSTER = "/udyaan-aerial-poster.jpg";
const SKIP_AFTER_MS = 4000;

export function SurveyIntro({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari only honours autoplay when the element is muted in the DOM; the
    // React prop is not reliably reflected.
    video.muted = true;
    video.defaultMuted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      // Autoplay can still be refused (Low Power Mode, strict settings) — fall
      // back to a manual play button instead of trapping the respondent.
      playPromise.catch(() => setBlocked(true));
    }
  }, []);

  const startManually = () => {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    video.play().catch(() => setBlocked(true));
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  return (
    <div className="sv-intro">
      <video
        ref={videoRef}
        className="sv-intro-video"
        // `src` (not a <source> child) so a missing file surfaces on the
        // element's own error event and the survey still opens.
        src={INTRO_SRC}
        poster={INTRO_POSTER}
        playsInline
        muted
        preload="auto"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
        onEnded={complete}
        onError={complete}
      />

      <div className="sv-intro-veil" aria-hidden />

      <div className="sv-intro-copy">
        <p className="sv-intro-kicker">Udyaan {"\u00b7"} Farm Logic Test</p>
        <h1>Watch this first</h1>
        <p className="sv-intro-sub">
          A short intro before the questions begin. The test opens automatically when the clip ends.
        </p>
      </div>

      <div className="sv-intro-controls">
        <button type="button" className="sv-intro-chip" onClick={toggleSound}>
          {muted ? "Unmute" : "Mute"}
        </button>
        {blocked && (
          <button type="button" className="sv-intro-chip" onClick={startManually}>
            Play intro
          </button>
        )}
        <motion.button
          type="button"
          className="sv-intro-skip"
          onClick={complete}
          initial={false}
          animate={{ opacity: canSkip || blocked ? 1 : 0, y: canSkip || blocked ? 0 : 8 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: canSkip || blocked ? "auto" : "none" }}
        >
          Skip to the test <ArrowRight />
        </motion.button>
      </div>

      <div className="sv-intro-progress" aria-hidden>
        <div className="sv-intro-progress-fill" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
      </div>
    </div>
  );
}
