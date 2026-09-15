"use client";

import { useDeferredValue, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { problems } from "@/lib/problems";
import { ProblemCard } from "./Site";
import styles from "./PublicSite.module.css";

export function ProblemBoard() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All areas");
  const [skill, setSkill] = useState("All capabilities");
  const deferredQuery = useDeferredValue(query);
  const terms = deferredQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = problems.filter(problem => {
    const searchText = [problem.title, problem.description, problem.source, problem.type, ...problem.skills].join(" ").toLowerCase();
    return (category === "All areas" || category === problem.category) && (skill === "All capabilities" || problem.skills.includes(skill)) && terms.every(term => searchText.includes(term));
  });
  const hasFilters = query !== "" || category !== "All areas" || skill !== "All capabilities";
  function reset() { setQuery(""); setCategory("All areas"); setSkill("All capabilities"); }
  return <>
    <div className={styles.toolbar}>
      <label className={styles.field}>Find a problem<div className={styles.searchField}><Search size={17} /><input type="search" placeholder="Search problems, skills or topics" value={query} onChange={event => setQuery(event.target.value)} /></div></label>
      <label className={styles.field}>Challenge area<select value={category} onChange={event => setCategory(event.target.value)}>{["All areas", ...new Set(problems.map(problem => problem.category))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className={styles.field}>Your capability<select value={skill} onChange={event => setSkill(event.target.value)}>{["All capabilities", ...new Set(problems.flatMap(problem => problem.skills))].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className={styles.resultsBar}><span role="status" aria-live="polite">{filtered.length} {filtered.length === 1 ? "problem" : "problems"}{hasFilters ? " matching your interests" : " to explore"}</span>{hasFilters && <button className={styles.reset} type="button" onClick={reset}><RotateCcw size={14} />Clear filters</button>}</div>
    {filtered.length ? <div className={styles.problemGrid}>{filtered.map(problem => <ProblemCard key={problem.slug} problem={problem} />)}</div> : <div className={styles.empty}><h2>No problems match just yet.</h2><p>Try a different topic or capability, or explore all current briefs.</p><button className={styles.reset} type="button" onClick={reset}><RotateCcw size={14} />Show all problems</button></div>}
  </>;
}