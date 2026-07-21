"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import type { Question, QuestionType, SurveyForm, SurveySection } from "@/lib/survey";
import { uid } from "@/lib/survey";
import { resetFormToDefault, saveForm } from "@/lib/api";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "longtext", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "select", label: "Dropdown" },
  { value: "choice", label: "Multiple choice" },
  { value: "multichoice", label: "Checkboxes" },
  { value: "file", label: "File upload" },
];

export function QuestionBuilder({ form, onFormChange }: { form: SurveyForm; onFormChange: (f: SurveyForm) => void }) {
  const [sectionId, setSectionId] = useState(form.sections[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

  const section = useMemo(
    () => form.sections.find((s) => s.id === sectionId) ?? form.sections[0],
    [form, sectionId],
  );
  const selected = section?.questions.find((q) => q.id === selectedId) ?? null;

  function patchForm(next: SurveyForm) {
    onFormChange(next);
  }

  function patchSection(patch: Partial<SurveySection>) {
    if (!section) return;
    patchForm({
      ...form,
      sections: form.sections.map((s) => (s.id === section.id ? { ...s, ...patch } : s)),
    });
  }

  function patchQuestion(questionId: string, patch: Partial<Question>) {
    if (!section) return;
    patchSection({
      questions: section.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
    });
  }

  function addQuestion() {
    if (!section) return;
    const q: Question = { id: uid(), type: "choice", label: "New question", required: true, options: ["Option A", "Option B"] };
    patchSection({ questions: [...section.questions, q] });
    setSelectedId(q.id);
  }

  function removeQuestion(questionId: string) {
    if (!section) return;
    patchSection({ questions: section.questions.filter((q) => q.id !== questionId) });
    if (selectedId === questionId) setSelectedId(null);
  }

  function duplicateQuestion(questionId: string) {
    if (!section) return;
    const src = section.questions.find((q) => q.id === questionId);
    if (!src) return;
    const copy = { ...src, id: uid(), label: `${src.label} (copy)` };
    const idx = section.questions.findIndex((q) => q.id === questionId);
    const next = [...section.questions];
    next.splice(idx + 1, 0, copy);
    patchSection({ questions: next });
    setSelectedId(copy.id);
  }

  async function persist() {
    setSaveError("");
    try {
      const saved = await saveForm(form);
      onFormChange(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save changes.");
    }
  }

  function reset() {
    if (!window.confirm("Reset the form to the default Farm Logic Test? Unsaved edits will be lost.")) return;
    const def = resetFormToDefault();
    onFormChange(def);
    setSectionId(def.sections[0].id);
    setSelectedId(null);
  }

  if (!section) return null;

  return (
    <div className="qb-layout">
      <aside className="qb-rail">
        <div className="qb-rail-head">
          <h2>Sections</h2>
        </div>
        <div className="qb-section-list">
          {form.sections.map((s) => (
            <button
              key={s.id}
              className={`qb-section-item${s.id === section.id ? " qb-section-active" : ""}`}
              onClick={() => { setSectionId(s.id); setSelectedId(null); }}
            >
              <span>{s.title}</span>
              <em>{s.questions.length}</em>
            </button>
          ))}
        </div>

        <div className="qb-rail-head">
          <h2>Questions</h2>
          <button className="qb-add" onClick={addQuestion}>+ Add</button>
        </div>
        <Reorder.Group
          axis="y"
          values={section.questions}
          onReorder={(qs: Question[]) => patchSection({ questions: qs })}
          className="qb-question-list"
        >
          {section.questions.map((q) => (
            <Reorder.Item
              key={q.id}
              value={q}
              className={`qb-question-item${q.id === selectedId ? " qb-question-active" : ""}`}
              onClick={() => setSelectedId(q.id)}
              whileDrag={{ scale: 1.03, boxShadow: "0 12px 28px rgba(38,42,30,.18)" }}
            >
              <span className="qb-drag" aria-hidden>{"\u2261"}</span>
              <span className="qb-question-label">{q.label || "Untitled"}</span>
              <span className="qb-question-type">{QUESTION_TYPES.find((t) => t.value === q.type)?.label}</span>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        {section.questions.length === 0 && <p className="qb-empty">No questions in this section yet.</p>}
      </aside>

      <section className="qb-editor">
        <div className="qb-editor-top">
          <div className="qb-section-meta">
            <label>
              Section heading
              <input value={section.heading} onChange={(e) => patchSection({ heading: e.target.value })} />
            </label>
            <label>
              Subheading
              <input value={section.subheading ?? ""} onChange={(e) => patchSection({ subheading: e.target.value })} />
            </label>
          </div>
          <div className="qb-actions">
            <label className="qb-publish">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => patchForm({ ...form, published: e.target.checked })}
              />
              Published
            </label>
            <button className="qb-reset" onClick={reset}>Reset to default</button>
            <motion.button className="sv-btn sv-btn-primary qb-save" onClick={persist} whileTap={{ scale: 0.97 }}>
              {savedFlash ? "Saved \u2713" : "Save changes"}
            </motion.button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              className="qb-panel"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              <div className="qb-row">
                <label className="qb-grow">
                  Question label
                  <textarea
                    rows={2}
                    value={selected.label}
                    onChange={(e) => patchQuestion(selected.id, { label: e.target.value })}
                  />
                </label>
              </div>
              <div className="qb-row">
                <label>
                  Type
                  <select
                    value={selected.type}
                    onChange={(e) => {
                      const type = e.target.value as QuestionType;
                      const needsOptions = ["select", "choice", "multichoice"].includes(type);
                      patchQuestion(selected.id, {
                        type,
                        options: needsOptions ? (selected.options?.length ? selected.options : ["Option A", "Option B"]) : undefined,
                        correctOption: needsOptions ? selected.correctOption : undefined,
                      });
                    }}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Placeholder
                  <input
                    value={selected.placeholder ?? ""}
                    onChange={(e) => patchQuestion(selected.id, { placeholder: e.target.value })}
                  />
                </label>
                <label className="qb-check">
                  <input
                    type="checkbox"
                    checked={selected.required ?? false}
                    onChange={(e) => patchQuestion(selected.id, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>

              {["select", "choice", "multichoice"].includes(selected.type) && (
                <OptionsEditor
                  question={selected}
                  onChange={(patch) => patchQuestion(selected.id, patch)}
                />
              )}

              <div className="qb-row qb-danger-row">
                <button className="qb-ghost" onClick={() => duplicateQuestion(selected.id)}>Duplicate</button>
                <button className="qb-danger" onClick={() => removeQuestion(selected.id)}>Delete question</button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="none" className="qb-panel qb-panel-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p>Select a question on the left, drag {"\u2261"} to reorder, or add a new one.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

function OptionsEditor({ question, onChange }: { question: Question; onChange: (patch: Partial<Question>) => void }) {
  const options = question.options ?? [];

  function setOption(index: number, value: string) {
    const next = [...options];
    const old = next[index];
    next[index] = value;
    onChange({
      options: next,
      correctOption: question.correctOption === old ? value : question.correctOption,
    });
  }

  function removeOption(index: number) {
    const removed = options[index];
    onChange({
      options: options.filter((_, i) => i !== index),
      correctOption: question.correctOption === removed ? undefined : question.correctOption,
    });
  }

  return (
    <div className="qb-options">
      <p className="qb-options-title">Options</p>
      {options.map((opt, i) => (
        <div key={i} className="qb-option-row">
          <input value={opt} onChange={(e) => setOption(i, e.target.value)} />
          {question.type === "choice" && (
            <label className="qb-correct" title="Mark as the correct answer (scored)">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={question.correctOption === opt}
                onChange={() => onChange({ correctOption: opt, points: question.points ?? 1 })}
              />
              Correct
            </label>
          )}
          <button className="qb-danger qb-option-remove" onClick={() => removeOption(i)} aria-label="Remove option">{"\u00d7"}</button>
        </div>
      ))}
      <div className="qb-option-row qb-option-footer">
        <button className="qb-ghost" onClick={() => onChange({ options: [...options, `Option ${String.fromCharCode(65 + options.length)}`] })}>
          + Add option
        </button>
        {question.type === "choice" && question.correctOption != null && (
          <label className="qb-points">
            Points
            <input
              type="number"
              min={1}
              max={10}
              value={question.points ?? 1}
              onChange={(e) => onChange({ points: Number(e.target.value) || 1 })}
            />
            <button className="qb-ghost" onClick={() => onChange({ correctOption: undefined, points: undefined })}>
              Clear scoring
            </button>
          </label>
        )}
      </div>
    </div>
  );
}
