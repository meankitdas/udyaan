"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { SurveySection } from "@/lib/survey";
import { CheckIcon, StepIcon } from "./icons";

type SidebarProps = {
  sections: SurveySection[];
  activeSection: number;
  maxVisitedSection: number;
  onJump: (sectionIndex: number) => void;
};

export function SurveySidebar({ sections, activeSection, maxVisitedSection, onJump }: SidebarProps) {
  const rootRef = useRef<HTMLElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".sv-step",
        { x: -26, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.55, stagger: 0.07, ease: "power3.out", delay: 0.15 },
      );
      gsap.fromTo(
        ".sv-side-brand",
        { y: -14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" },
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    const active = rootRef.current.querySelector<HTMLElement>(`.sv-step[data-index="${activeSection}"] .sv-step-dot`);
    if (active) {
      gsap.fromTo(active, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: "back.out(2.5)" });
    }
    if (counterRef.current) {
      gsap.fromTo(counterRef.current, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" });
    }
  }, [activeSection]);

  return (
    <aside className="sv-sidebar" ref={rootRef}>
      <div className="sv-side-brand">
        <p className="sv-side-kicker">Udyaan Survey</p>
        <p className="sv-side-section">
          <span className="sv-side-seedling" aria-hidden>{"\ud83c\udf31"}</span> Section {activeSection + 1} of {sections.length}
        </p>
      </div>

      <nav className="sv-steps" aria-label="Survey sections">
        {sections.map((section, i) => {
          const state = i === activeSection ? "active" : i < activeSection ? "done" : "todo";
          const clickable = i <= maxVisitedSection;
          return (
            <button
              key={section.id}
              type="button"
              className={`sv-step sv-step-${state}${clickable ? " sv-step-clickable" : ""}`}
              data-index={i}
              onClick={() => clickable && onJump(i)}
              disabled={!clickable}
            >
              <span className="sv-step-dot">{state === "done" ? <CheckIcon /> : <StepIcon name={section.icon} />}</span>
              <span className="sv-step-label">{section.title}</span>
            </button>
          );
        })}
      </nav>

      <p className="sv-side-counter">
        <span ref={counterRef}>{String(activeSection + 1).padStart(2, "0")}</span>
        {" / "}
        {String(sections.length).padStart(2, "0")}
      </p>
    </aside>
  );
}
