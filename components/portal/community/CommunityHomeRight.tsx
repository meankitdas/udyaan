"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Info, UserPlus } from "lucide-react";
import Avatar from "./Avatar";
import ConnectionButton from "./ConnectionButton";
import { dismissSuggestion, listSuggestions } from "@/lib/community-api";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { ConnectionState, ProfileSummary } from "@/lib/community-types";
import type { MatchesResponse } from "@/lib/portal-types";

type Props = {
  onOpenProfile?: (userId: string) => void;
  onSeeAll?: () => void;
  onOpenProject?: (projectId: string) => void;
};

export default function CommunityHomeRight({ onOpenProfile, onSeeAll, onOpenProject }: Props) {
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [matches, setMatches] = useState<MatchesResponse | null>(null);

  useEffect(() => {
    listSuggestions({ limit: 4 }).then((page) => setPeople(page.results)).catch(() => setPeople([]));
    apiFetch(`${API_BASE_URL}/community/matches`, { headers: authHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then(setMatches)
      .catch(() => setMatches(null));
  }, []);

  const change = (id: string, next: { connection_state: ConnectionState }) => {
    setPeople((current) => next.connection_state === "none"
      ? current.map((person) => person.id === id ? { ...person, ...next } : person)
      : current.filter((person) => person.id !== id));
  };

  return (
    <aside className="community-home-right" aria-label="Community recommendations">
      <section className="community-home-side-card community-home-suggestions">
        <header><h3>People to follow</h3><Info size={16} aria-label="Recommendations based on shared skills and network" /></header>
        {people.length ? (
          <ul>
            {people.slice(0, 3).map((person) => {
              const reason = person.shared_tags.length
                ? `${person.shared_tags.length} shared interest${person.shared_tags.length === 1 ? "" : "s"}`
                : person.mutual_connections
                  ? `${person.mutual_connections} mutual connection${person.mutual_connections === 1 ? "" : "s"}`
                  : person.headline || person.organization_name || "Suggested for you";
              return (
                <li key={person.id}>
                  <button type="button" className="community-home-suggestion-person" onClick={() => onOpenProfile?.(person.id)}>
                    <Avatar name={person.full_name} src={person.avatar_url} role={person.community_role} size={44} />
                    <span><strong>{person.full_name}</strong><small>{reason}</small></span>
                  </button>
                  <ConnectionButton person={person} size="sm" onChange={(next) => change(person.id, next)} />
                  <button
                    type="button"
                    className="community-home-suggestion-dismiss"
                    onClick={() => {
                      setPeople((current) => current.filter((item) => item.id !== person.id));
                      void dismissSuggestion(person.id);
                    }}
                    aria-label={`Dismiss ${person.full_name}`}
                  >×</button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="community-home-rail-empty"><UserPlus size={18} aria-hidden /><span>Your recommendations will appear here.</span></div>
        )}
        <button type="button" className="community-home-view-all" onClick={onSeeAll}>View all recommendations <ArrowRight size={14} aria-hidden /></button>
      </section>

      <section className="community-home-side-card community-home-opportunities">
        <header><h3>Matched opportunities</h3><BriefcaseBusiness size={16} aria-hidden /></header>
        {matches?.projects?.length ? (
          <ul>
            {matches.projects.slice(0, 3).map((project, index) => (
              <li key={project.id}>
                <span className={`community-home-project-mark mark-${index % 3}`}>{project.title.charAt(0)}</span>
                <button type="button" onClick={() => onOpenProject?.(project.id)}>
                  <strong>{project.title}</strong>
                  <small>{project.category || project.status || "Project"}</small>
                  <em>{project.matched_skills.slice(0, 2).join(" · ")}</em>
                </button>
                <span>{Math.round(project.score * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="community-home-rail-empty"><BriefcaseBusiness size={18} aria-hidden /><span>Add skills to your profile to reveal matched projects.</span></div>
        )}
      </section>
    </aside>
  );
}
