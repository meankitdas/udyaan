"use client";

import { useEffect, useRef, useState } from "react";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Respect reduced motion: CSS hides the video, so skip loading/playback.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Safari only allows autoplay when the element is actually muted; the React
    // `muted` prop is not reliably reflected to the DOM, so set it imperatively.
    video.muted = true;
    video.defaultMuted = true;

    if (video.readyState >= 3) setIsReady(true);

    const attemptPlay = () => {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        // Autoplay may still be blocked (e.g. Safari Low Power Mode); the poster
        // stays visible in that case.
        playPromise.catch(() => {});
      }
    };

    attemptPlay();
    video.addEventListener("canplay", attemptPlay);
    document.addEventListener("visibilitychange", attemptPlay);

    return () => {
      video.removeEventListener("canplay", attemptPlay);
      document.removeEventListener("visibilitychange", attemptPlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={`cinematic-film${isReady ? " is-ready" : ""}`}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster="/udyaan-aerial-poster.jpg"
      aria-hidden="true"
      onCanPlay={() => setIsReady(true)}
    >
      <source src="/udyaan-aerial.mp4" type="video/mp4" />
    </video>
  );
}
