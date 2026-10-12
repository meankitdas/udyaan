"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Inbox, Mail, RefreshCw, Save, Search } from "lucide-react";
import { getProblemSubmission, listProblemSubmissions, reviewProblemSubmission } from "@/lib/api";
import { PROBLEM_STATUSES, type ProblemPage, type ProblemStatus, type ProblemSubmission } from "@/lib/problem-submissions";
import styles from "./ProblemSubmissions.module.css";

const statuses = Object.entries(PROBLEM_STATUSES) as [ProblemStatus, string][];
const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Status({ value }: { value: ProblemStatus }) {
  return <span className={styles.status} data-status={value}>{PROBLEM_STATUSES[value]}</span>;
}

export function ProblemSubmissions() {
  const [data, setData] = useState<ProblemPage | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProblemStatus | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    listProblemSubmissions({ page, status, query }, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load submissions."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, status, query, revision]);

  if (selected) return <ProblemReview key={selected} id={selected} onBack={() => { setSelected(null); setRevision(value => value + 1); }} />;

  return <section className={styles.inbox} aria-labelledby="problem-inbox-title">
    <div className={styles.heading}><div><p className={styles.kicker}>Company & partner intake</p><h1 id="problem-inbox-title">Problem submissions</h1><p>Private briefs received through the website. Accepting a brief does not publish it.</p></div><button className={styles.iconButton} title="Refresh submissions" aria-label="Refresh submissions" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={19} /></button></div>
    <form className={styles.toolbar} onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); setRevision(value => value + 1); }}>
      <label className={styles.search}>Search submissions<div><Search size={18} aria-hidden="true" /><input type="search" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} placeholder="Problem, organisation or email" /></div></label>
      <label>Review status<select aria-label="Review status" value={status} onChange={event => { setStatus(event.target.value as ProblemStatus | ""); setPage(1); }}><option value="">All statuses</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className={styles.button} type="submit"><Search size={17} />Search</button>
    </form>
    {error ? <div className={styles.error} role="alert"><p>{error}</p><button className={styles.textButton} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />Retry</button></div> : loading ? <p className={styles.empty} role="status">Loading problem submissions...</p> : data && <>
      <div className={styles.results} role="status">{data.total} {data.total === 1 ? "submission" : "submissions"}{query || status ? " matching these filters" : " received"}</div>
      {data.items.length > 0 ? <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Private problem submissions, newest first</caption><thead><tr><th scope="col">Problem / organisation</th><th scope="col">Contact</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}>
        <td><button className={styles.titleButton} onClick={() => setSelected(item.id)}>{item.title}<ArrowRight size={15} aria-hidden="true" /></button><span className={styles.secondary}>{item.organisation}</span></td>
        <td><span>{item.name}</span><a className={styles.secondary} href={`mailto:${item.email}`}>{item.email}</a></td>
        <td><time dateTime={item.submittedAt}>{date(item.submittedAt)}</time></td><td><Status value={item.status} /></td>
      </tr>)}</tbody></table></div> : <div className={styles.empty}><Inbox size={30} aria-hidden="true" /><h2>{query || status ? "No matching submissions" : "No problem submissions yet"}</h2><p>{query || status ? "Try another search or review status." : "New website briefs will appear here after they are successfully submitted."}</p></div>}
      {data.total > 0 && <nav className={styles.pagination} aria-label="Submission pages"><span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><div><button className={styles.iconButton} aria-label="Previous page" title="Previous page" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button><button className={styles.iconButton} aria-label="Next page" title="Next page" disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button></div></nav>}
    </>}
  </section>;
}

function ProblemReview({ id, onBack }: { id: string; onBack: () => void }) {
  const [record, setRecord] = useState<ProblemSubmission | null>(null);
  const [status, setStatus] = useState<ProblemStatus>("new");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = record !== null && (status !== record.status || notes !== record.notes);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSaved("");
    getProblemSubmission(id, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then(result => { if (!controller.signal.aborted) { setRecord(result); setStatus(result.status); setNotes(result.notes); } })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load this brief."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);

  useEffect(() => { if (!loading) heading.current?.focus(); }, [loading]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true);
    setError("");
    setSaved("");
    try {
      const updated = await reviewProblemSubmission(id, { status, notes, version: record.version });
      setRecord(updated); setStatus(updated.status); setNotes(updated.notes); setSaved("Review saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Review could not be saved."); }
    finally { setSaving(false); }
  }

  function discard(action: () => void) {
    if (!dirty || window.confirm("Discard your unsaved review changes?")) action();
  }

  return <section className={styles.inbox} aria-label="Problem submission review">
    <div className={styles.reviewToolbar}><button className={styles.textButton} disabled={saving} onClick={() => discard(onBack)}><ArrowLeft size={17} />All submissions</button><button className={styles.textButton} disabled={saving || loading} onClick={() => discard(() => setRevision(value => value + 1))}><RefreshCw size={16} />Reload latest</button></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {loading ? <p className={styles.empty} role="status">Loading brief...</p> : record && <>
      <div className={styles.heading}><div><p className={styles.kicker}>{record.organisation}</p><h1 tabIndex={-1} ref={heading}>{record.title}</h1><p className={styles.reference}>Reference: {record.id}</p></div><Status value={record.status} /></div>
      <div className={styles.reviewLayout}><div className={styles.brief}>
        <dl className={styles.contact}><div><dt>Contact</dt><dd>{record.name}<a href={`mailto:${record.email}`}><Mail size={15} />{record.email}</a></dd></div><div><dt>Received</dt><dd><time dateTime={record.submittedAt}>{date(record.submittedAt)}</time></dd></div></dl>
        <section><h2>Context & affected users</h2><p>{record.context}</p></section>
        <section><h2>Desired outcome</h2><p>{record.success}</p></section>
        <section><h2>Constraints & available support</h2><p>{record.constraints || "Not provided."}</p></section>
        <p className={styles.consent}>The submitter confirmed permission to share this non-confidential brief and acknowledged the privacy policy.</p>
      </div><form className={styles.reviewForm} onSubmit={save}><h2>Internal review</h2><fieldset disabled={saving}>
        <label>Status<select aria-label="Status" value={status} onChange={event => { setStatus(event.target.value as ProblemStatus); setSaved(""); }}>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Private notes<textarea value={notes} maxLength={5000} rows={8} onChange={event => { setNotes(event.target.value); setSaved(""); }} placeholder="Scoping questions, follow-up actions and decisions" /></label>
        <p>Only administrators can see these notes. Status changes do not publish a brief or email the submitter.</p>
        <button className={styles.button} disabled={!dirty || saving} type="submit"><Save size={17} />{saving ? "Saving..." : "Save review"}</button>
      </fieldset><p role="status" className={styles.saved}>{saved}</p>{record.reviewedAt && <p className={styles.audit}>Last reviewed {date(record.reviewedAt)}<br />by {record.reviewedBy}</p>}</form></div>
    </>}
  </section>;
}