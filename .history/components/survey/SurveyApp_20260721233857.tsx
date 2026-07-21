"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import type { AnswerValue, Question, QuestionTiming, SurveyForm, SurveyResponse } from "@/lib/survey";
import { computeQuizScore, formatDuration, uid } from "@/lib/survey";
import { fetchForm, submitResponse } from "@/lib/api";
import { SurveySidebar } from "./Sidebar";
import { QuestionField, isAnswered } from "./fields";
import { ArrowLeft, ArrowRight } from "./icons";

type Screen =
  | { kind: "group"; sectionIndex: number; questions: Question[] }
  | { kind: "single"; sectionIndex: number; questions: [Question] }
  | { kind: "review"; sectionIndex: number; questions: Question[] };

function buildScreens(form: SurveyForm): Screen[] {
  const screens: Screen[] = [];
  form.sections.forEach((section, sectionIndex) => {
    if (section.id === "review" || (section.questions.length === 0 && sectionIndex === form.sections.length - 1)) {
      screens.push({ kind: "review", sectionIndex, questions: [] });
      return;
    }
    const paginated = section.questions.some((q) => q.correctOption != null || q.type === "longtext");
    if (paginated) {
      section.questions.forEach((q) => screens.push({ kind: "single", sectionIndex, questions: [q] }));
    } else {
      screens.push({ kind: "group", sectionIndex, questions: section.questions });
    }
  });
  return screens;
}

type TimingDraft = Record<string, { activeMs: number; visits: number; changes: number }>;

export function SurveyApp() {
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [maxVisitedSection, setMaxVisitedSection] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [phase, setPhase] = useState<"loading" | "form" | "submitting" | "done">("loading");
  const [result, setResult] = useState<SurveyResponse | null>(null);

  const timingsRef = useRef<TimingDraft>({});
  const screenEnteredAtRef = useRef<number>(Date.now());
  const startedAtRef = useRef<string>(new Date().toISOString());
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchForm().then((f) => {
      setForm(f);
      setPhase("form");
      startedAtRef.current = new Date().toISOString();
      screenEnteredAtRef.current = Date.now();
    });
  }, []);

  const screens = useMemo(() => (form ? buildScreens(form) : []), [form]);
  const screen = screens[screenIndex];
  const section = form && screen ? form.sections[screen.sectionIndex] : null;

  const commitScreenTime = useCallback(() => {
    if (!screen) return;
    const elapsed = Date.now() - screenEnteredAtRef.current;
    const perQuestion = screen.questions.length > 1 ? elapsed / screen.questions.length : elapsed;
    for (const q of screen.questions) {
      const t = (timingsRef.current[q.id] ??= { activeMs: 0, visits: 0, changes: 0 });
      t.activeMs += perQuestion;
    }
    screenEnteredAtRef.current = Date.now();
  }, [screen]);

  useEffect(() => {
    if (!screen) return;
    for (const q of screen.questions) {
      const t = (timingsRef.current[q.id] ??= { activeMs: 0, visits: 0, changes: 0 });
      t.visits += 1;
    }
    screenEnteredAtRef.current = Date.now();
  }, [screenIndex, screen]);

  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    const t = (timingsRef.current[questionId] ??= { activeMs: 0, visits: 0, changes: 0 });
    t.changes += 1;
  }, []);

  const screenValid = screen ? screen.questions.every((q) => isAnswered(q, answers[q.id])) : false;

  const goTo = useCallback(
    (nextIndex: number, dir: number) => {
      commitScreenTime();
      setDirection(dir);
      setShowErrors(false);
      setScreenIndex(nextIndex);
      const nextScreen = screens[nextIndex];
      if (nextScreen) setMaxVisitedSection((m) => Math.max(m, nextScreen.sectionIndex));
    },
    [commitScreenTime, screens],
  );

  const next = useCallback(() => {
    if (!screen) return;
    if (!screenValid) {
      setShowErrors(true);
      return;
    }
    if (screenIndex < screens.length - 1) goTo(screenIndex + 1, 1);
  }, [screen, screenValid, screenIndex, screens.length, goTo]);

  const back = useCallback(() => {
    if (screenIndex > 0) goTo(screenIndex - 1, -1);
  }, [screenIndex, goTo]);

  const jumpToSection = useCallback(
    (sectionIndex: number) => {
      const target = screens.findIndex((s) => s.sectionIndex === sectionIndex);
      if (target >= 0) goTo(target, target > screenIndex ? 1 : -1);
    },
    [screens, screenIndex, goTo],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey && phase === "form" && screen?.kind !== "review") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, phase, screen]);

  const submit = useCallback(async () => {
    if (!form) return;
    commitScreenTime();
    setPhase("submitting");
    const timings: QuestionTiming[] = Object.entries(timingsRef.current).map(([questionId, t]) => ({
      questionId,
      activeMs: Math.round(t.activeMs),
      visits: t.visits,
      changes: t.changes,
    }));
    const { score, maxScore } = computeQuizScore(form, answers);
    const submittedAt = new Date().toISOString();
    const response: SurveyResponse = {
      id: uid("resp"),
      formId: form.id,
      answers,
      timings,
      startedAt: startedAtRef.current,
      submittedAt,
      totalMs: Date.now() - new Date(startedAtRef.current).getTime(),
      score,
      maxScore,
    };
    try {
      await submitResponse(response);
    } finally {
      setResult(response);
      setPhase("done");
    }
  }, [form, answers, commitScreenTime]);

  useEffect(() => {
    if (phase !== "done" || !doneRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".sv-done-card", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" });
      gsap.fromTo(
        ".sv-confetti span",
        { y: 0, autoAlpha: 1, scale: 0.6 },
        {
          y: () => gsap.utils.random(-180, -420),
          x: () => gsap.utils.random(-260, 260),
          rotation: () => gsap.utils.random(-240, 240),
          scale: () => gsap.utils.random(0.8, 1.6),
          autoAlpha: 0,
          duration: () => gsap.utils.random(1.2, 2.2),
          ease: "power2.out",
          stagger: 0.03,
          delay: 0.25,
        },
      );
      const scoreEl = doneRef.current!.querySelector(".sv-done-score strong");
      if (scoreEl && result?.maxScore) {
        const counter = { value: 0 };
        gsap.to(counter, {
          value: result.score ?? 0,
          duration: 1.4,
          delay: 0.4,
          ease: "power2.out",
          onUpdate: () => {
            scoreEl.textContent = String(Math.round(counter.value));
          },
        });
      }
    }, doneRef);
    return () => ctx.revert();
  }, [phase, result]);

  if (phase === "loading" || !form) {
    return (
      <div className="sv-shell sv-shell-center">
        <motion.p
          className="sv-loading"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          Preparing your survey{"\u2026"}
        </motion.p>
      </div>
    );
  }

  if (phase === "done" && result) {
    const pct = result.maxScore ? Math.round(((result.score ?? 0) / result.maxScore) * 100) : null;
    return (
      <div className="sv-shell sv-shell-center" ref={doneRef}>
        <div className="sv-confetti" aria-hidden>
          {Array.from({ length: 26 }).map((_, i) => (
            <span key={i}>{["\ud83c\udf31", "\ud83c\udf3e", "\ud83c\udf89", "\u2728", "\ud83c\udf43"][i % 5]}</span>
          ))}
        </div>
        <div className="sv-done-card">
          <p className="sv-kicker">Udyaan Survey</p>
          <h1>Response submitted {"\ud83c\udf89"}</h1>
          {result.maxScore ? (
            <p className="sv-done-score">
              Farm logic score: <strong>{result.score}</strong> / {result.maxScore}
              {pct != null && <em> ({pct}%)</em>}
            </p>
          ) : null}
          <p className="sv-done-note">
            You spent {formatDuration(result.totalMs)} across the test. Our team reviews every response {"\u2014"} results and
            feedback will reach your inbox soon.
          </p>
          <Link href="/" className="sv-btn sv-btn-primary">
            Back to Udyaan <ArrowRight />
          </Link>
        </div>
      </div>
    );
  }

  const sectionScreens = screens.filter((s) => s.sectionIndex === screen.sectionIndex);
  const subIndex = sectionScreens.indexOf(screen);

  return (
    <div className="sv-shell">
      <SurveySidebar
        sections={form.sections}
        activeSection={screen.sectionIndex}
        maxVisitedSection={maxVisitedSection}
        onJump={jumpToSection}
      />

      <main className="sv-canvas">
        <div className="sv-progressbar" aria-hidden>
          <motion.div
            className="sv-progressbar-fill"
            animate={{ width: `${((screenIndex + 1) / screens.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screenIndex}
            className="sv-screen"
            custom={direction}
            initial={{ opacity: 0, y: direction >= 0 ? 44 : -44 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction >= 0 ? -44 : 44 }}
            transition={{ duration: 0.38, ease: [0.32, 0.72, 0.24, 1] }}
          >
            {screen.kind === "review" ? (
              <ReviewScreen form={form} answers={answers} onEdit={jumpToSection} onSubmit={submit} submitting={false} />
            ) : (
              <>
                <header className="sv-screen-head">
                  {screen.kind === "single" && sectionScreens.length > 1 && (
                    <p className="sv-kicker">
                      {section?.title} {"\u00b7"} Question {subIndex + 1} of {sectionScreens.length}
                    </p>
                  )}
                  {screen.kind === "single" ? (
                    <>
                      {subIndex === 0 && (
                        <>
                          <h1>{section?.heading}</h1>
                          {section?.subheading && <p className="sv-sub">{section.subheading}</p>}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <h1>{section?.heading}</h1>
                      {section?.subheading && <p className="sv-sub">{section.subheading}</p>}
                    </>
                  )}
                </header>

                {screen.sectionIndex === 0 && form.collectEmails && (
                  <div className="sv-banner">
                    <span>This form is automatically collecting emails from all respondents.</span>
                  </div>
                )}

                <div className="sv-fields">
                  {screen.questions.map((q) => (
                    <div key={q.id} className={`sv-field${showErrors && !isAnswered(q, answers[q.id]) ? " sv-field-error" : ""}`}>
                      <label className="sv-field-label">
                        {screen.kind === "single" ? <span className="sv-field-question">{q.label}{q.required && <span className="sv-req"> *</span>}</span> : <>{q.label}{q.required && <span className="sv-req"> *</span>}</>}
                      </label>
                      {q.description && <p className="sv-field-desc">{q.description}</p>}
                      {q.image && (
                        <div className="sv-field-image">
                          <img src={q.image} alt="" loading="lazy" />
                        </div>
                      )}
                      <QuestionField question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
                      {showErrors && !isAnswered(q, answers[q.id]) && (
                        <motion.p
                          className="sv-error"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          This field is required.
                        </motion.p>
                      )}
                    </div>
                  ))}
                </div>

                <footer className="sv-nav">
                  <button type="button" className="sv-btn sv-btn-ghost" onClick={back} disabled={screenIndex === 0}>
                    <ArrowLeft /> Back
                  </button>
                  <motion.button
                    type="button"
                    className="sv-btn sv-btn-primary"
                    onClick={next}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    animate={{ opacity: screenValid ? 1 : 0.55 }}
                  >
                    Continue <ArrowRight />
                  </motion.button>
                </footer>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function ReviewScreen({
  form,
  answers,
  onEdit,
  onSubmit,
  submitting,
}: {
  form: SurveyForm;
  answers: Record<string, AnswerValue>;
  onEdit: (sectionIndex: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const answerable = form.sections.filter((s) => s.questions.length > 0);
  return (
    <div className="sv-review">
      <header className="sv-screen-head">
        <h1>Review &amp; Submit {"\ud83c\udf8a"}</h1>
        <p className="sv-sub">Check your answers before you submit. You can go back to any section.</p>
      </header>
      <div className="sv-review-groups">
        {answerable.map((s) => {
          const sectionIndex = form.sections.indexOf(s);
          return (
            <motion.section
              key={s.id}
              className="sv-review-group"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 * sectionIndex }}
            >
              <div className="sv-review-group-head">
                <h2>{s.title}</h2>
                <button type="button" onClick={() => onEdit(sectionIndex)}>
                  Edit
                </button>
              </div>
              <dl>
                {s.questions.map((q) => {
                  const v = answers[q.id];
                  const display = Array.isArray(v) ? v.join(", ") : v;
                  return (
                    <div key={q.id} className="sv-review-row">
                      <dt>{q.label}</dt>
                      <dd className={display ? "" : "sv-review-empty"}>{display || "\u2014"}</dd>
                    </div>
                  );
                })}
              </dl>
            </motion.section>
          );
        })}
      </div>
      <footer className="sv-nav sv-nav-review">
        <motion.button
          type="button"
          className="sv-btn sv-btn-primary sv-btn-lg"
          onClick={onSubmit}
          disabled={submitting}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          {submitting ? "Submitting\u2026" : "Submit response"} <ArrowRight />
        </motion.button>
      </footer>
    </div>
  );
}
