"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import type { AnswerValue, Question } from "@/lib/survey";
import { CheckIcon, UploadIcon } from "./icons";

type FieldProps = {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
};

export function QuestionField({ question, value, onChange }: FieldProps) {
  switch (question.type) {
    case "select":
      return <SelectField question={question} value={value} onChange={onChange} />;

    case "choice":
      return (
        <div className={`sv-choices${(question.options ?? []).some((o) => o.length > 24) ? " sv-choices-stack" : ""}`}>
          {(question.options ?? []).map((opt, i) => {
            const selected = value === opt;
            return (
              <motion.button
                key={opt}
                type="button"
                className={`sv-choice${selected ? " sv-choice-selected" : ""}`}
                onClick={() => onChange(opt)}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35, ease: "easeOut" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="sv-choice-key">{String.fromCharCode(65 + i)}</span>
                <span className="sv-choice-text">{opt}</span>
              </motion.button>
            );
          })}
        </div>
      );

    case "multichoice": {
      const selectedList = Array.isArray(value) ? value : [];
      return (
        <div className="sv-choices sv-choices-stack">
          {(question.options ?? []).map((opt, i) => {
            const selected = selectedList.includes(opt);
            return (
              <motion.button
                key={opt}
                type="button"
                className={`sv-choice${selected ? " sv-choice-selected" : ""}`}
                onClick={() =>
                  onChange(selected ? selectedList.filter((o) => o !== opt) : [...selectedList, opt])
                }
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35, ease: "easeOut" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="sv-choice-key">{selected ? "\u2713" : String.fromCharCode(65 + i)}</span>
                <span className="sv-choice-text">{opt}</span>
              </motion.button>
            );
          })}
        </div>
      );
    }

    case "longtext":
      return (
        <textarea
          className="sv-input sv-textarea"
          rows={5}
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "file":
      return (
        <label className="sv-file">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              onChange(f ? f.name : "");
            }}
          />
          <UploadIcon />
          <span>{typeof value === "string" && value ? value : "Add File"}</span>
        </label>
      );

    case "email":
      return (
        <input
          type="email"
          className="sv-input"
          placeholder={question.placeholder ?? "you@example.com"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "phone":
      return (
        <input
          type="tel"
          className="sv-input"
          placeholder={question.placeholder ?? "+91"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return (
        <input
          type="text"
          className="sv-input"
          placeholder={question.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (!question.required) return true;
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (question.type === "email") return /.+@.+\..+/.test(value);
  return value.trim().length > 0;
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9.5 12 15.5 18 9.5" />
    </svg>
  );
}

function SelectField({ question, value, onChange }: FieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const options = question.options ?? [];
  const selected = typeof value === "string" ? value : "";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const items = listRef.current.querySelectorAll(".sv-option");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { y: -10, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.3, stagger: 0.035, ease: "power3.out" },
      );
    }, listRef);
    return () => ctx.revert();
  }, [open]);

  function choose(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  return (
    <div className="sv-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`sv-select-btn${open ? " sv-select-open" : ""}${selected ? "" : " sv-select-placeholder"}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected || question.placeholder || "Select an option"}</span>
        <motion.span
          className="sv-select-caret"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <ChevronIcon />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            className="sv-options-menu"
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0.24, 1] }}
          >
            {options.map((opt) => (
              <li
                key={opt}
                role="option"
                aria-selected={selected === opt}
                className={`sv-option${selected === opt ? " sv-option-selected" : ""}`}
                onClick={() => choose(opt)}
              >
                <span>{opt}</span>
                {selected === opt && <CheckIcon />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
