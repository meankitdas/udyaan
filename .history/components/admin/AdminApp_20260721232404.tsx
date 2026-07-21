"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import type { SurveyForm } from "@/lib/survey";
import { adminLogin, fetchForm, getToken, hasBackend, setToken } from "@/lib/api";
import { ArrowUpRightIcon } from "@/components/Icons";
import { StepIcon } from "@/components/survey/icons";
import { QuestionBuilder } from "./QuestionBuilder";
import { Candidates } from "./Candidates";

type Tab = "questions" | "candidates";

export function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;
  return <AdminDashboard onLogout={() => { setToken(null); setAuthed(false); }} />;
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminLogin(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ad-login-shell">
      <motion.form
        className="ad-login-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className="sv-kicker">Udyaan Admin</p>
        <h1>Survey Console</h1>
        <p className="ad-login-sub">
          Manage questions, review candidates, and run AI screening.
          {!hasBackend && (
            <>
              <br />
              <em>Demo mode {"\u2014"} admin@udyaan.edu / udyaan-admin</em>
            </>
          )}
        </p>
        {error && <p className="ad-error">{error}</p>}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@udyaan.edu" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        </label>
        <motion.button className="sv-btn sv-btn-primary" disabled={loading} whileTap={{ scale: 0.97 }}>
          {loading ? "Signing in\u2026" : "Sign in"}
        </motion.button>
        <Link href="/" className="ad-back-link">{"\u2190"} Back to site</Link>
      </motion.form>
    </div>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("questions");
  const [form, setForm] = useState<SurveyForm | null>(null);
  const headRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetchForm().then(setForm);
  }, []);

  useEffect(() => {
    if (!headRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".ad-head-item", { y: -16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.08, ease: "power3.out" });
    }, headRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="ad-shell">
      <header className="ad-topbar" ref={headRef}>
        <div className="ad-head-item ad-brand">
          <span className="ad-brand-dot" aria-hidden><StepIcon name="sprout" /></span>
          <div>
            <p className="sv-kicker">Udyaan Admin</p>
            <strong>{form?.title ?? "Survey Console"}</strong>
          </div>
        </div>
        <nav className="ad-head-item ad-tabs" aria-label="Admin sections">
          <button className={tab === "questions" ? "ad-tab-active" : ""} onClick={() => setTab("questions")}>
            Questions
          </button>
          <button className={tab === "candidates" ? "ad-tab-active" : ""} onClick={() => setTab("candidates")}>
            Candidates
          </button>
        </nav>
        <div className="ad-head-item ad-top-actions">
          <Link href="/survey" target="_blank" className="ad-preview-link">Preview survey <ArrowUpRightIcon /></Link>
          <button className="ad-logout" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          className="ad-main"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {tab === "questions" ? (
            form ? <QuestionBuilder form={form} onFormChange={setForm} /> : <p className="ad-loading">Loading form{"\u2026"}</p>
          ) : (
            form ? <Candidates form={form} /> : <p className="ad-loading">Loading{"\u2026"}</p>
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
