"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, UserPlus, X } from "lucide-react";
import Avatar from "./Avatar";
import ConnectionButton from "./ConnectionButton";
import { dismissSuggestion, listSuggestions } from "@/lib/community-api";
import type { ConnectionState, ProfileSummary } from "@/lib/community-types";

type SuggestionsRailProps = {
  onOpenProfile?: (userId: string) => void;
  onSeeAll?: () => void;
};

const RAIL_SIZE = 8;
// Below this the rail is mostly whitespace and reads as a rendering fault
// rather than a feature, so it hides itself instead.
const MIN_TO_SHOW = 2;

/**
 * A compact horizontal strip of suggestions for the top of the feed.
 *
 * Deliberately not a `PersonCard`: the directory card is tall enough that a row
 * of them would push the feed itself below the fold, which inverts what the
 * page is for. This is a narrower tile with the same three facts -- who, why,
 * and one action.
 */
export default function SuggestionsRail({
  onOpenProfile,
  onSeeAll,
}: SuggestionsRailProps) {
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSuggestions({ limit: RAIL_SIZE })
      .then((page) => {
        if (!cancelled) setPeople(page.results);
      })
      .catch(() => {
        // The rail is supplementary; a failure should never break the feed.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(async (userId: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== userId));
    try {
      await dismissSuggestion(userId);
    } catch {
      // Reappears on the next load.
    }
  }, []);

  const handleChange = useCallback(
    (userId: string, next: { connection_state: ConnectionState }) => {
      setPeople((prev) =>
        next.connection_state === "none"
          ? prev.map((p) => (p.id === userId ? { ...p, ...next } : p))
          : prev.filter((p) => p.id !== userId),
      );
    },
    [],
  );

  if (!loaded || people.length < MIN_TO_SHOW) return null;

  return (
    <section className="community-rail" aria-label="People you may know">
      <header className="community-rail-head">
        <h3>
          <UserPlus size={15} strokeWidth={2} aria-hidden />
          People you may know
        </h3>
        {onSeeAll && (
          <button type="button" className="community-rail-all" onClick={onSeeAll}>
            See all
            <ArrowRight size={13} strokeWidth={2} aria-hidden />
          </button>
        )}
      </header>

      <ul className="community-rail-track">
        {people.map((person) => {
          const reason =
            person.shared_tags.length > 0
              ? `${person.shared_tags.length} shared interest${person.shared_tags.length === 1 ? "" : "s"}`
              : person.mutual_connections > 0
                ? `${person.mutual_connections} mutual connection${person.mutual_connections === 1 ? "" : "s"}`
                : person.cohort
                  ? `Cohort ${person.cohort}`
                  : person.university || "Suggested for you";

          return (
            <li key={person.id} className="community-rail-item">
              <button
                type="button"
                className="community-rail-dismiss"
                onClick={() => void handleDismiss(person.id)}
                aria-label={`Stop suggesting ${person.full_name}`}
                title="Not interested"
              >
                <X size={13} strokeWidth={2} aria-hidden />
              </button>

              <button
                type="button"
                className="community-rail-person"
                onClick={() => onOpenProfile?.(person.id)}
                aria-label={`View ${person.full_name}'s profile`}
              >
                <Avatar name={person.full_name} src={person.avatar_url} size={54} />
                <strong>{person.full_name}</strong>
                {person.headline && <small>{person.headline}</small>}
                <span className="community-rail-reason">{reason}</span>
              </button>

              <ConnectionButton
                person={person}
                size="sm"
                onChange={(next) => handleChange(person.id, next)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
