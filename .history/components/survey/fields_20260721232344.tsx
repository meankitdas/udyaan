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
