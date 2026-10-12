"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Copy, Download, LoaderCircle, Send } from "lucide-react";
import { CONTACT_EMAIL } from "@/lib/seo";
import { ApiError, submitProblem } from "@/lib/api";
import type { ProblemBrief, ProblemReceipt } from "@/lib/problem-submissions";
import styles from "./PublicSite.module.css";

export function ProblemIntake() {
  const [draft, setDraft] = useState<{ brief: ProblemBrief; body: string } | null>(null);
  const [copyState, setCopyState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ProblemReceipt | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const sendingRef = useRef(false);

  function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const fields = { name: value("name"), email: value("email"), organisation: value("organisation"), title: value("title"), context: value("context"), success: value("success"), constraints: value("constraints"), consent: true as const };
    const fingerprint = JSON.stringify(fields);
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, id: crypto.randomUUID() };
    const body = ["Hello Udyaan team,", `Contact: ${value("name")}`, `Email: ${value("email")}`, `Organisation: ${value("organisation")}`, `Problem: ${value("title")}`, `Context and affected users:\n${value("context")}`, `A useful outcome:\n${value("success")}`, `Constraints and available support:\n${value("constraints") || "To be discussed"}`].join("\n\n");
    setDraft({ brief: { ...fields, requestId: requestRef.current.id }, body });
    setCopyState("");
    setError("");
    requestAnimationFrame(() => previewRef.current?.focus());
  }

  async function submit() {
    if (!draft || sendingRef.current) return;
    sendingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitProblem(draft.brief);
      setReceipt(result);
      requestAnimationFrame(() => previewRef.current?.focus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We could not confirm your submission. Your brief is still here. Try again; retrying this brief will not create a duplicate.");
    } finally {
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try { await navigator.clipboard.writeText(draft.body); setCopyState("Brief copied."); }
    catch { setCopyState("Clipboard unavailable. Download the brief or select the text below."); }
  }

  function download() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([`${receipt ? `Submission reference: ${receipt.id}\nReceived: ${receipt.submittedAt}\n\n` : ""}${draft.body}`], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "udyaan-problem-brief.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (receipt) return <div className={styles.emailPreview} ref={previewRef} tabIndex={-1} aria-label="Problem submission received">
    <CheckCircle2 size={32} aria-hidden="true" />
    <h2>Problem submitted.</h2><p>Your brief has been saved privately for the Udyaan team to review. It has not been published on the public problem board.</p>
    <dl className={styles.factList}><div><dt>Submission reference</dt><dd className={styles.submissionReference}>{receipt.id}</dd></div><div><dt>Received</dt><dd>{new Date(receipt.submittedAt).toLocaleString()}</dd></div></dl>
    <p>The team can follow up using the email in your brief. For questions, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and include your reference.</p>
    <div className={styles.actions}><button className={styles.reset} type="button" onClick={download}><Download size={15} />Download your record</button><Link className={styles.textLink} href="/for-companies">The company journey<ArrowRight size={17} /></Link></div>
  </div>;

  return <div aria-busy={submitting}>
    <form onSubmit={prepare} onChange={() => { setDraft(null); setCopyState(""); setError(""); }}>
      <fieldset className={styles.intakeFields} disabled={submitting}>
      <div className={styles.formRow}><label className={styles.field}>Your name<input name="name" autoComplete="name" required maxLength={100} /></label><label className={styles.field}>Work email<input name="email" type="email" autoComplete="email" required maxLength={160} /></label></div>
      <label className={styles.field}>Organisation<input name="organisation" autoComplete="organization" required maxLength={140} /></label>
      <label className={styles.field}>Problem title<input name="title" placeholder="What needs to change?" required minLength={8} maxLength={120} /></label>
      <label className={styles.field}>What is happening, and who is affected?<textarea name="context" placeholder="Describe the current situation, who experiences it and what has already been tried." required minLength={30} maxLength={1800} /></label>
      <label className={styles.field}>What would a useful outcome look like?<textarea name="success" placeholder="Describe the change you would be able to observe or measure." required minLength={20} maxLength={1000} /></label>
      <label className={styles.field}>Constraints and available support (optional)<textarea name="constraints" placeholder="Budget, timing, access, safety, data or people who can support the work." maxLength={1000} /></label>
      <label className={styles.checkbox}><input type="checkbox" required name="consent" /><span>I have permission to share this non-confidential brief and have read the <Link href="/privacy">privacy policy</Link>.</span></label>
      <p className={styles.formHint}>Review your non-confidential brief, then submit it for private review by the Udyaan team. Your contact details will not appear on the public problem board.</p>
      <button className={styles.action} type="submit">Review your brief<ArrowRight size={17} /></button>
      </fieldset>
    </form>
    {draft && <div className={styles.emailPreview} style={{ marginTop: 35 }} ref={previewRef} tabIndex={-1} aria-label="Prepared problem brief">
      <h2>Your brief is ready to review.</h2><p>Nothing has been sent yet. Check the details below, then submit your problem to the Udyaan team.</p>
      <pre>{draft.body}</pre>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button className={styles.action} type="button" disabled={submitting} onClick={submit}>{submitting ? <LoaderCircle size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}{submitting ? "Submitting..." : "Submit problem"}</button><button className={styles.reset} type="button" disabled={submitting} onClick={copy}><Copy size={15} />Copy brief</button><button className={styles.reset} type="button" disabled={submitting} onClick={download}><Download size={15} />Download brief</button></div>
      <p role="status" className={styles.formHint}>{copyState}</p>
    </div>}
  </div>;
}