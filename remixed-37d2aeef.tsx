import React, { useState } from "react";
import {
  Leaf, Sprout, Wheat, Tractor, ArrowRight, ArrowLeft,
  Check, User, TrendingUp, Upload, Compass, PartyPopper, Pencil
} from "lucide-react";

const STEPS = ["Start", "Details", "Level 1", "Level 2", "Level 3", "Reflect", "Review"];
const STEP_ICONS = [Sprout, User, Leaf, Tractor, TrendingUp, Compass, PartyPopper];

const CAMPUSES = [
  "School of Commerce",
  "School of Engineering and Technology",
  "School of Aerospace Engineering",
  "School of Computer Science and Engineering",
  "School of Sciences",
  "School of Computer Science and IT",
  "School of Allied Healthcare and Sciences",
  "School of Design, Media and Creative Arts",
  "School of Aviation and Aerospace Management",
  "School of Sports Education and Research",
  "School of Law",
  "CMS Business School - Lalbagh",
  "CMS Business School - Seshadri",
];

const DEPARTMENTS = [
  "Department of Humanities & Social Sciences",
  "Department of Economics",
  "Department of Journalism and Mass Communication",
  "Department of Languages",
  "Department of Law",
  "Department of Performing Arts and Cultural Studies",
  "Department of Computer Science and IT",
  "Department of Allied Healthcare and Sciences",
  "Department of Biotechnology and Genetics",
  "Department of Chemistry and Biochemistry",
  "Department of Data Analytics and Mathematical Science",
  "Department of Forensic Science",
  "Department of Microbiology and Botany",
  "Department of Physics and Electronics",
  "Department of Psychology and Allied Sciences",
  "Department of Animation and Virtual Reality",
  "Department of Commerce",
  "Department of Art and Design",
  "Department of Design",
  "Department of Aerospace Engineering",
  "Department of Computer Science and Engineering",
  "Department of Electrical and Electronics Engineering",
  "Department of Electronics and Communication Engineering",
  "Department of Food Technology",
  "Department of Information Science and Engineering",
  "Department of Civil Engineering",
  "Department of Mechanical Engineering",
  "Department of Management Studies - UG",
  "Area - School of Sports Education and Research",
  "CeRSSE",
  "Department of Management Studies - PG",
  "Department of Art and Design (Interior Design)",
];

const LOCATIONS = ["Bangalore", "Kochi"];

const QUIZ = {
  level1: {
    title: "LEVEL 1 – Basic Farm Logic 🌾",
    desc: "",
    questions: [
      {
        id: "l1q1",
        q: "A plant is turning yellow. What should you do?",
        options: ["Pour more water.", "Check if the soil is too wet."],
        correct: 1,
      },
      {
        id: "l1q2",
        q: "Market Alert! Tomato prices dropped to ₹2/kg. What do you do?",
        options: ["Harvest and sell immediately.", "Wait or make Tomato Puree."],
        correct: 1,
      },
      {
        id: "l1q3",
        q: "It is noon and 35°C outside. When should you water crops?",
        options: ["Turn on the sprinklers now.", "Wait until evening."],
        correct: 1,
      },
    ],
  },
  level2: {
    title: "LEVEL 2 – Jugaad Workshop",
    desc: "Fix the problem using everyday items.",
    questions: [
      {
        id: "l2q1",
        q: "The river water is muddy and pipes will get clogged. Which combination makes a basic filter?",
        options: ["Bucket + Sand + Stones + Cloth", "Bottle + Rope", "Plastic sheet only"],
        correct: 0,
      },
      {
        id: "l2q2",
        q: "An irrigation pipe is leaking and shop is closed. What is the temporary fix?",
        options: ["Rubber strip + Wire / Clamp", "Sand only", "Plastic bottle"],
        correct: 0,
      },
      {
        id: "l2q3",
        q: "The bugs are destroying your leaves. No chemicals are also available. Choose the best trap.",
        options: ["Yellow plastic sheet + oil/grease", "Water spray", "Rope fence"],
        correct: 0,
      },
    ],
  },
  level3: {
    title: "LEVEL 3 – Udyaan Tycoon",
    desc: "You start with ₹10,000. Make smart decisions.",
    questions: [
      {
        id: "l3q1",
        q: "Which seeds will you buy?",
        options: ["Cheap seeds (₹100)", "Certified high-yield seeds (₹500)"],
        correct: 1,
      },
      {
        id: "l3q2",
        q: "Heavy rains predicted! What do you do?",
        options: ["Spend ₹2000 on drainage", "Save money and sow seeds for next hours"],
        correct: 0,
      },
      {
        id: "l3q3",
        q: "How will you sell your produce?",
        options: [
          "Sell to middleman (low price, instant income, no risk)",
          "Sell directly to apartments (high effort, high profit)",
        ],
        correct: null, // trade-off, not graded
      },
    ],
  },
};

const REFLECTION_QUESTIONS = [
  {
    id: "r1",
    q: "Why are you interested in this program?",
    options: ["Problem you've witnessed", "Skill-to-need fit", "Personal connection", "Learning by doing"],
  },
  {
    id: "r2",
    q: "Pick ONE decision from the test you're most confident about. Why?",
    options: [
      "The trade-off I knowingly made",
      "The moment I corrected course",
      "The decision that went against the 'obvious' choice",
      "The decision that avoided the worst outcome",
    ],
  },
  {
    id: "r3",
    q: "If you had failed one level, what would you improve next time?",
    options: ["Better preparation", "Slower, clearer problem framing", "More self-questioning", "Better use of available resources"],
  },
  {
    id: "r4",
    q: "Have you ever solved a problem with limited resources in real life?",
    options: ["Working with scarcity", "Substituting what was available", "Leveraging people, not just materials", "Constraint leading to a better outcome"],
  },
  {
    id: "r5",
    q: "Do you have any agri-entrepreneurial ideas you'd like to continue with Udyaan?",
    options: ["A clear idea", "A direction, not a finished idea", "An early, unvalidated idea", "Honest, without an idea yet"],
  },
];

const ALL_QUIZ_QUESTIONS = [...QUIZ.level1.questions, ...QUIZ.level2.questions, ...QUIZ.level3.questions];
const SCORED_QUESTIONS = ALL_QUIZ_QUESTIONS.filter((q) => q.correct !== null);

export default function UdyaanSurvey() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    campus: "",
    level: "",
    name: "",
    email: "",
    phone: "",
    location: "",
    department: "",
    course: "",
    usn: "",
    cv: "",
  });
  const [answers, setAnswers] = useState({});
  const [reflection, setReflection] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const update = (key, val) => setData((d) => ({ ...d, [key]: val }));
  const answer = (qid, idx) => setAnswers((a) => ({ ...a, [qid]: idx }));
  const reflect = (qid, idx) => setReflection((r) => ({ ...r, [qid]: idx }));

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const step0Valid = data.campus && data.level;
  const step1Valid = data.name.trim() && data.email.trim() && data.phone.trim() && data.location && data.department && data.course.trim() && data.usn.trim();
  const levelAnswered = (levelKey) => QUIZ[levelKey].questions.every((q) => answers[q.id] !== undefined);
  const reflectionAnswered = REFLECTION_QUESTIONS.every((q) => reflection[q.id] !== undefined);

  const canAdvance = () => {
    if (step === 0) return step0Valid;
    if (step === 1) return step1Valid;
    if (step === 2) return levelAnswered("level1");
    if (step === 3) return levelAnswered("level2");
    if (step === 4) return levelAnswered("level3");
    if (step === 5) return reflectionAnswered;
    return true;
  };

  const firstName = data.name.trim().split(" ")[0] || "there";

  const funLine = () => {
    const lines = [
      `You filtered muddy water, saved your tomatoes, and survived the noon sun, ${firstName}. Not bad for a day's work.`,
      `Somewhere out there, a real 5th grader is nodding in approval, ${firstName}.`,
      `You've officially got more farm sense than half the group chat, ${firstName}.`,
      `${firstName}, your ₹10,000 has been spent wisely. Probably. We didn't check.`,
    ];
    return lines[data.name.length % lines.length];
  };

  return (
    <div className="min-h-screen w-full flex items-stretch" style={{ background: "#EFEBDE", fontFamily: "'Public Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .fraunces { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* Progress rail */}
      <div className="hidden md:flex flex-col justify-between w-64 shrink-0 px-8 py-10" style={{ background: "#2B2E22" }}>
        <div>
          <div className="mono text-[11px] tracking-widest uppercase" style={{ color: "#9CA985" }}>
            Udyaan Survey
          </div>
          <div className="fraunces text-2xl mt-2" style={{ color: "#F1EFE4" }}>
            🌱 Section {step + 1} of {STEPS.length}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {STEPS.map((s, i) => {
            const active = i <= step;
            const Icon = STEP_ICONS[i];
            return (
              <div key={s} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500"
                  style={{
                    background: active ? "#7C9473" : "transparent",
                    border: `1.5px solid ${active ? "#7C9473" : "#4A4E3B"}`,
                  }}
                >
                  <Icon size={14} color={active ? "#1A1C13" : "#6B7060"} />
                </div>
                <span className="fraunces text-lg transition-colors duration-500" style={{ color: active ? "#F1EFE4" : "#6B7060" }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mono text-[11px]" style={{ color: "#6B7060" }}>
          {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div className="md:hidden mono text-[11px] tracking-widest uppercase mb-6" style={{ color: "#7C8268" }}>
            {STEPS[step]} · {step + 1}/{STEPS.length}
          </div>

          {step === 0 && (
            <StepShell
              title="Are You Smarter Than a 5th Grader? – Farm Logic Test 🌱"
              subtitle="90% of engineers fail this simple farm logic test."
            >
              <p className="text-[15px]" style={{ color: "#2B2E22" }}>
                Pass all 3 levels to prove your common sense.
              </p>
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: "#F7F5EB", border: "1.5px solid #DDD8C4" }}>
                <span className="text-sm" style={{ color: "#7C8268" }}>
                  This form is automatically collecting emails from all respondents.
                </span>
                <button className="mono text-[11px] underline shrink-0 ml-3" style={{ color: "#4A5D3A" }}>
                  Change settings
                </button>
              </div>

              <Field label="Campus *">
                <select value={data.campus} onChange={(e) => update("campus", e.target.value)} className="onboard-input">
                  <option value="">Select campus</option>
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="UG/PG *">
                <div className="grid grid-cols-2 gap-3">
                  {["UG", "PG"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => update("level", opt)}
                      className="text-center px-4 py-3 rounded-lg fraunces text-lg transition-all duration-150"
                      style={{
                        background: data.level === opt ? "#2B2E22" : "#F7F5EB",
                        border: `1.5px solid ${data.level === opt ? "#2B2E22" : "#DDD8C4"}`,
                        color: data.level === opt ? "#F1EFE4" : "#2B2E22",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
            </StepShell>
          )}

          {step === 1 && (
            <StepShell title="Candidate Details" subtitle="This information is only used to share your result and feedback.">
              <Field label="Full Name *">
                <input autoFocus value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" className="onboard-input" />
              </Field>
              <Field label="Email ID *">
                <input value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" className="onboard-input" />
              </Field>
              <Field label="Phone Number *">
                <input value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+91 " className="onboard-input" />
              </Field>
              <Field label="Location *">
                <select value={data.location} onChange={(e) => update("location", e.target.value)} className="onboard-input">
                  <option value="">Select location</option>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Department *">
                <select value={data.department} onChange={(e) => update("department", e.target.value)} className="onboard-input">
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Course *">
                <input value={data.course} onChange={(e) => update("course", e.target.value)} placeholder="e.g. B.Tech CSE" className="onboard-input" />
              </Field>
              <Field label="USN *">
                <input value={data.usn} onChange={(e) => update("usn", e.target.value)} placeholder="University Seat Number" className="onboard-input" />
              </Field>
              <Field label="CV">
                <label
                  className="flex items-center gap-2 px-4 py-3 rounded-lg cursor-pointer text-sm"
                  style={{ background: "#F7F5EB", border: "1.5px dashed #C9C3AA", color: "#7C8268" }}
                >
                  <Upload size={16} />
                  {data.cv || "Add File"}
                  <input type="file" className="hidden" onChange={(e) => update("cv", e.target.files?.[0]?.name || "")} />
                </label>
              </Field>
            </StepShell>
          )}

          {(step === 2 || step === 3 || step === 4) && (
            <QuizLevel level={QUIZ[["level1", "level2", "level3"][step - 2]]} answers={answers} onAnswer={answer} />
          )}

          {step === 5 && (
            <StepShell title="Reflection & Intent Questions" subtitle="A few honest, open questions — there's no right answer here.">
              {REFLECTION_QUESTIONS.map((q, qi) => (
                <div key={q.id}>
                  <div className="fraunces text-lg mb-3" style={{ color: "#2B2E22" }}>
                    {qi + 1}. {q.q}
                  </div>
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const active = reflection[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          onClick={() => reflect(q.id, oi)}
                          className="text-left px-4 py-3 rounded-lg text-sm transition-all duration-150"
                          style={{
                            background: active ? "#D4A94A" : "#F7F5EB",
                            border: `1.5px solid ${active ? "#D4A94A" : "#DDD8C4"}`,
                            color: active ? "#2B2318" : "#2B2E22",
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </StepShell>
          )}

          {step === 6 && (
            <StepShell title={`One last look, ${firstName} 🌾`} subtitle={funLine()}>
              <div className="rounded-2xl p-5" style={{ background: "#2B2E22" }}>
                <div className="mono text-[11px] tracking-widest uppercase mb-4" style={{ color: "#9CA985" }}>
                  Your details
                </div>
                <div className="flex flex-col gap-3">
                  <ReviewRow label="Name" value={data.name} onEdit={() => setStep(1)} />
                  <ReviewRow label="Email" value={data.email} onEdit={() => setStep(1)} />
                  <ReviewRow label="Phone" value={data.phone} onEdit={() => setStep(1)} />
                  <ReviewRow label="Campus" value={data.campus} onEdit={() => setStep(0)} />
                  <ReviewRow label="UG/PG" value={data.level} onEdit={() => setStep(0)} />
                  <ReviewRow label="Location" value={data.location} onEdit={() => setStep(1)} />
                  <ReviewRow label="Department" value={data.department} onEdit={() => setStep(1)} />
                  <ReviewRow label="Course" value={data.course} onEdit={() => setStep(1)} />
                  <ReviewRow label="USN" value={data.usn} onEdit={() => setStep(1)} />
                  <ReviewRow label="CV" value={data.cv || "Not added"} onEdit={() => setStep(1)} />
                </div>
              </div>

              <div className="rounded-2xl p-5" style={{ background: "#F7F5EB", border: "1.5px solid #DDD8C4" }}>
                <div className="mono text-[11px] tracking-widest uppercase mb-3" style={{ color: "#7C8268" }}>
                  Quick jump
                </div>
                <div className="flex flex-wrap gap-2">
                  <JumpChip label="Level 1" onClick={() => setStep(2)} />
                  <JumpChip label="Level 2" onClick={() => setStep(3)} />
                  <JumpChip label="Level 3" onClick={() => setStep(4)} />
                  <JumpChip label="Reflection" onClick={() => setStep(5)} />
                </div>
              </div>

              {!submitted ? (
                <>
                  <p className="text-sm text-center" style={{ color: "#7C8268" }}>
                    Everything look right, {firstName}? Once you submit, we'll pass this straight to the Udyaan team.
                  </p>
                  <button
                    onClick={() => setSubmitted(true)}
                    className="w-full py-3.5 rounded-xl fraunces text-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                    style={{ background: "#D4A94A", color: "#2B2318" }}
                  >
                    Yes, submit my responses <Wheat size={18} />
                  </button>
                </>
              ) : (
                <div className="rounded-2xl px-5 py-6 flex flex-col items-center gap-2 text-center" style={{ background: "#7C9473", color: "#1A1C13" }}>
                  <PartyPopper size={26} />
                  <span className="fraunces text-xl">Thanks, {firstName} — you're in!</span>
                  <span className="text-sm" style={{ color: "#22301C" }}>
                    We've recorded your responses. Keep an eye on your inbox for what's next.
                  </span>
                </div>
              )}
            </StepShell>
          )}

          {step < 6 && (
            <div className="flex items-center justify-between mt-9">
              <button
                onClick={back}
                disabled={step === 0}
                className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-opacity"
                style={{ color: "#7C8268", opacity: step === 0 ? 0.3 : 1 }}
              >
                <ArrowLeft size={15} /> Back
              </button>
              <button
                onClick={next}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg fraunces text-base transition-opacity"
                style={{ background: "#2B2E22", color: "#F1EFE4", opacity: canAdvance() ? 1 : 0.35 }}
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .onboard-input {
          width: 100%;
          background: #F7F5EB;
          border: 1.5px solid #DDD8C4;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 15px;
          color: #2B2E22;
          outline: none;
          transition: border-color 0.2s;
        }
        .onboard-input:focus { border-color: #7C9473; }
      `}</style>
    </div>
  );
}

function QuizLevel({ level, answers, onAnswer }) {
  return (
    <StepShell title={level.title} subtitle={level.desc}>
      {level.questions.map((q, qi) => (
        <div key={q.id}>
          <div className="fraunces text-lg mb-3" style={{ color: "#2B2E22" }}>
            {qi + 1}. {q.q}
          </div>
          <div className="grid gap-2">
            {q.options.map((opt, oi) => {
              const active = answers[q.id] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => onAnswer(q.id, oi)}
                  className="text-left px-4 py-3 rounded-lg text-sm transition-all duration-150"
                  style={{
                    background: active ? "#7C9473" : "#F7F5EB",
                    border: `1.5px solid ${active ? "#7C9473" : "#DDD8C4"}`,
                    color: active ? "#1A1C13" : "#2B2E22",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </StepShell>
  );
}

function ReviewRow({ label, value, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "#6B7060" }}>{label}</div>
        <div className="text-sm truncate" style={{ color: "#F1EFE4" }}>{value || "—"}</div>
      </div>
      <button onClick={onEdit} className="shrink-0 flex items-center gap-1 mono text-[11px] px-2.5 py-1.5 rounded-md" style={{ background: "#3B3F2E", color: "#B7BDA2" }}>
        <Pencil size={11} /> Edit
      </button>
    </div>
  );
}

function JumpChip({ label, onClick }) {
  return (
    <button onClick={onClick} className="mono text-[11px] px-3 py-1.5 rounded-full" style={{ background: "#EFEBDE", border: "1.5px solid #DDD8C4", color: "#4A5D3A" }}>
      {label}
    </button>
  );
}

function StepShell({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="fraunces text-3xl md:text-[34px] leading-tight" style={{ color: "#2B2E22" }}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-[15px] mt-2 mb-8" style={{ color: "#7C8268" }}>
          {subtitle}
        </p>
      )}
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mono text-[11px] tracking-widest uppercase block mb-2" style={{ color: "#7C8268" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
