"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Copy, Download } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/seo";
import styles from "./PublicSite.module.css";

export function ProblemIntake() {
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copyState, setCopyState] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);

  function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const subject = `Problem enquiry: ${value("title")}`;
    const body = ["Hello Udyaan team,", `Contact: ${value("name")}`, `Email: ${value("email")}`, `Organisation: ${value("organisation")}`, `Problem: ${value("title")}`, `Context and affected users:\n${value("context")}`, `A useful outcome:\n${value("success")}`, `Constraints and available support:\n${value("constraints") || "To be discussed"}`].join("\n\n");
    setDraft({ subject, body });
    setCopyState("");
    requestAnimationFrame(() => previewRef.current?.focus());
  }

  async function copy() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`); setCopyState("Brief copied."); }
    catch { setCopyState("Clipboard unavailable. Download the brief or select the text below."); }
  }

  function download() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "udyaan-problem-brief.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div>
    <form className={styles.form} onSubmit={prepare} onChange={() => { setDraft(null); setCopyState(""); }}>
      <div className={styles.formRow}><label className={styles.field}>Your name<input name="name" autoComplete="name" required maxLength={100} /></label><label className={styles.field}>Work email<input name="email" type="email" autoComplete="email" required maxLength={160} /></label></div>
      <label className={styles.field}>Organisation<input name="organisation" autoComplete="organization" required maxLength={140} /></label>
      <label className={styles.field}>Problem title<input name="title" placeholder="What needs to change?" required minLength={8} maxLength={120} /></label>
      <label className={styles.field}>What is happening, and who is affected?<textarea name="context" placeholder="Describe the current situation, who experiences it and what has already been tried." required minLength={30} maxLength={1800} /></label>
      <label className={styles.field}>What would a useful outcome look like?<textarea name="success" placeholder="Describe the change you would be able to observe or measure." required minLength={20} maxLength={1000} /></label>
      <label className={styles.field}>Constraints and available support (optional)<textarea name="constraints" placeholder="Budget, timing, access, safety, data or people who can support the work." maxLength={1000} /></label>
      <label className={styles.checkbox}><input type="checkbox" required name="consent" /><span>I have permission to share this non-confidential brief and have read the <Link href="/privacy">privacy policy</Link>.</span></label>
      <p className={styles.formHint}>Your brief stays in this page until you choose to email it. Preparing a brief does not submit it to Udyaan.</p>
      <button className={styles.action} type="submit">Review your brief<ArrowRight size={17} /></button>
    </form>
    {draft && <div className={styles.emailPreview} style={{ marginTop: 35 }} ref={previewRef} tabIndex={-1} aria-label="Prepared problem brief">
      <h2>Your brief is ready to review.</h2><p>Nothing has been sent yet. Email the brief to {CONTACT_EMAIL} to start the conversation. For longer briefs, download and attach the text file.</p>
      <pre>{draft.body}</pre>
      <div className={styles.actions}><a className={styles.action} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}>Open email draft<ArrowUpRight size={17} /></a><button className={styles.reset} type="button" onClick={copy}><Copy size={15} />Copy brief</button><button className={styles.reset} type="button" onClick={download}><Download size={15} />Download brief</button></div>
      <p role="status" className={styles.formHint}>{copyState}</p>
    </div>}
  </div>;
}