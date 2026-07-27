"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search, SlidersHorizontal, Users, X } from "lucide-react";
import PersonCard from "./PersonCard";
import TagChip from "./TagChip";
import { getDirectory, getDirectoryFacets } from "@/lib/community-api";
import type {
  ConnectionState,
  DirectoryFacets,
  DirectoryFilters,
  ProfileSummary,
} from "@/lib/community-types";

type DirectoryProps = {
  onOpenProfile: (userId: string) => void;
};

const PAGE_SIZE = 24;

const EMPTY_FILTERS: DirectoryFilters = {
  q: "",
  role: "",
  tags: [],
  university: "",
  cohort: "",
  organization_id: "",
  sort: "relevance",
};

export default function Directory({ onOpenProfile }: DirectoryProps) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [facets, setFacets] = useState<DirectoryFacets | null>(null);
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Guards against a slow early request overwriting a newer result set.
  const requestId = useRef(0);

  useEffect(() => {
    getDirectoryFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  // Debounce free-text search so each keystroke doesn't hit the API.
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput })),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const data = await getDirectory({ ...filters, page: targetPage, page_size: PAGE_SIZE });
        if (id !== requestId.current) return;
        setPeople((prev) => (append ? [...prev, ...data.results] : data.results));
        setTotal(data.total);
        setPage(data.page);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Could not load the directory");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters],
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const activeTags = filters.tags ?? [];

  const toggleTag = (slug: string) =>
    setFilters((f) => {
      const current = f.tags ?? [];
      return {
        ...f,
        tags: current.includes(slug)
          ? current.filter((t) => t !== slug)
          : [...current, slug],
      };
    });

  const activeFilterCount = useMemo(
    () =>
      (filters.role ? 1 : 0) +
      (filters.university ? 1 : 0) +
      (filters.cohort ? 1 : 0) +
      (filters.organization_id ? 1 : 0) +
      activeTags.length,
    [filters, activeTags],
  );

  const clearAll = () => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  };

  /** Keep the card in sync after a connect/accept without refetching the page. */
  const handleChange = (
    userId: string,
    next: { connection_state: ConnectionState; connection_id?: string | null },
  ) =>
    setPeople((prev) =>
      prev.map((p) =>
        p.id === userId
          ? { ...p, connection_state: next.connection_state, connection_id: next.connection_id }
          : p,
      ),
    );

  const hasMore = people.length < total;

  return (
    <div className="community-directory">
      <div className="community-searchbar">
        <div className="community-search-input">
          <Search size={18} strokeWidth={1.9} aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search people by name, headline, or university"
            aria-label="Search the directory"
          />
        </div>

        <select
          className="form-control community-sort"
          value={filters.sort}
          onChange={(e) =>
            setFilters((f) => ({ ...f, sort: e.target.value as DirectoryFilters["sort"] }))
          }
          aria-label="Sort results"
        >
          <option value="relevance">Shared interests</option>
          <option value="name">Name (A–Z)</option>
          <option value="newest">Recently joined</option>
        </select>

        <button
          type="button"
          className="btn-secondary community-filter-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden />
          Filters
          {activeFilterCount > 0 && (
            <span className="community-filter-count">{activeFilterCount}</span>
          )}
        </button>
      </div>

      <div className="community-directory-body">
        <aside className={`community-filters ${filtersOpen ? "open" : ""}`}>
          <div className="community-filters-head">
            <h4>
              <Filter size={15} strokeWidth={1.9} aria-hidden /> Refine
            </h4>
            <div className="community-filters-head-actions">
              {activeFilterCount > 0 && (
                <button type="button" className="btn-link" onClick={clearAll}>
                  Clear all
                </button>
              )}
              <button
                type="button"
                className="icon-btn community-filters-close"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X size={18} strokeWidth={1.9} aria-hidden />
              </button>
            </div>
          </div>

          <div className="community-filter-group">
            <span className="community-filter-label">Role</span>
            <div className="community-segmented">
              {[
                { value: "", label: "Everyone" },
                { value: "student", label: "Students" },
                { value: "mentor", label: "Mentors" },
              ].map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  className={filters.role === option.value ? "active" : ""}
                  onClick={() =>
                    setFilters((f) => ({ ...f, role: option.value as DirectoryFilters["role"] }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {facets && facets.tags.length > 0 && (
            <div className="community-filter-group">
              <span className="community-filter-label">Interests</span>
              <div className="community-chip-row">
                {facets.tags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    label={tag.label}
                    count={tag.usage_count}
                    active={activeTags.includes(tag.slug)}
                    onClick={() => toggleTag(tag.slug)}
                  />
                ))}
              </div>
            </div>
          )}

          {facets && facets.universities.length > 0 && (
            <div className="community-filter-group">
              <label className="community-filter-label" htmlFor="filter-university">
                University
              </label>
              <select
                id="filter-university"
                className="form-control"
                value={filters.university}
                onChange={(e) => setFilters((f) => ({ ...f, university: e.target.value }))}
              >
                <option value="">All universities</option>
                {facets.universities.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}

          {facets && facets.cohorts.length > 0 && (
            <div className="community-filter-group">
              <label className="community-filter-label" htmlFor="filter-cohort">
                Cohort
              </label>
              <select
                id="filter-cohort"
                className="form-control"
                value={filters.cohort}
                onChange={(e) => setFilters((f) => ({ ...f, cohort: e.target.value }))}
              >
                <option value="">All cohorts</option>
                {facets.cohorts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {facets && facets.organizations.length > 0 && (
            <div className="community-filter-group">
              <label className="community-filter-label" htmlFor="filter-org">
                Organisation
              </label>
              <select
                id="filter-org"
                className="form-control"
                value={filters.organization_id}
                onChange={(e) => setFilters((f) => ({ ...f, organization_id: e.target.value }))}
              >
                <option value="">All organisations</option>
                {facets.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </aside>

        {filtersOpen && (
          <button
            type="button"
            className="community-filters-scrim"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
        )}

        <section className="community-results">
          <p className="community-results-count">
            {loading ? "Loading…" : `${total} ${total === 1 ? "person" : "people"}`}
          </p>

          {error && <p className="community-inline-error">{error}</p>}

          {loading ? (
            <div className="community-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="community-card community-card-skeleton" />
              ))}
            </div>
          ) : people.length === 0 ? (
            <div className="community-empty">
              <Users size={30} strokeWidth={1.4} aria-hidden />
              <h4>No one matches those filters yet</h4>
              <p>
                Try removing a filter, or broaden your search. New members appear here as soon
                as they complete their profile.
              </p>
              {activeFilterCount > 0 && (
                <button type="button" className="btn-secondary" onClick={clearAll}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="community-grid">
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onOpen={onOpenProfile}
                    onChange={handleChange}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="community-loadmore">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => load(page + 1, true)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
