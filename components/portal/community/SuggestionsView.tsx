"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
import PersonCard from "./PersonCard";
import { dismissSuggestion, listSuggestions } from "@/lib/community-api";
import type { ConnectionState, ProfileSummary } from "@/lib/community-types";

type SuggestionsViewProps = {
  onOpenProfile?: (userId: string) => void;
};

const PAGE_SIZE = 12;

/**
 * The full "people you may know" page.
 *
 * Dismissal and connection both remove a card from the list, because in each
 * case the suggestion has served its purpose and leaving it behind would let a
 * viewer act on the same person twice.
 */
export default function SuggestionsView({ onOpenProfile }: SuggestionsViewProps) {
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset: number) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const page = await listSuggestions({ limit: PAGE_SIZE, offset });
      setPeople((prev) => (offset === 0 ? page.results : [...prev, ...page.results]));
      setHasMore(page.has_more);
      setPersonalized(page.personalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load suggestions.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const handleDismiss = useCallback(async (userId: string) => {
    // Removed first: the request only records a preference, so waiting for it
    // would leave the card sitting there after an unambiguous "no".
    setPeople((prev) => prev.filter((p) => p.id !== userId));
    try {
      await dismissSuggestion(userId);
    } catch {
      // Reappears on the next load, which is the correct recovery.
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

  return (
    <section className="community-suggestions">
      <header className="community-suggestions-head">
        <div>
          <h2>People you may know</h2>
          <p className="community-muted">
            {personalized
              ? "Ranked by shared interests, mutual connections, your cohort, and how closely your stated interests match."
              : "Ranked by shared interests, mutual connections and your cohort."}
          </p>
        </div>
        {personalized && (
          <span className="community-suggestions-badge" title="Includes semantic interest matching">
            <Sparkles size={13} strokeWidth={2} aria-hidden />
            Personalized
          </span>
        )}
      </header>

      {error && <p className="community-error">{error}</p>}

      {loading ? (
        <div className="community-suggestions-loading">
          <Loader2 size={18} className="community-spin" aria-hidden />
          <span>Finding people…</span>
        </div>
      ) : people.length === 0 ? (
        <div className="community-suggestions-empty">
          <UserPlus size={30} strokeWidth={1.5} aria-hidden />
          <h3>No suggestions yet</h3>
          <p>
            Add interest tags to your profile and connect with a few people — suggestions
            get sharper as your network grows.
          </p>
        </div>
      ) : (
        <>
          <div className="community-grid">
            {people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onOpen={(id) => onOpenProfile?.(id)}
                onChange={handleChange}
                onDismiss={handleDismiss}
              />
            ))}
          </div>

          {hasMore && (
            <button
              type="button"
              className="community-btn ghost community-suggestions-more"
              onClick={() => void load(people.length)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 size={15} className="community-spin" aria-hidden />
                  Loading…
                </>
              ) : (
                "Show more"
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
