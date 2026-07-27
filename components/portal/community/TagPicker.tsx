"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import TagChip from "./TagChip";
import { searchTags } from "@/lib/community-api";
import type { Tag } from "@/lib/community-types";

type TagPickerProps = {
  value: string[];
  onChange: (labels: string[]) => void;
  max?: number;
  placeholder?: string;
};

/**
 * Autocomplete multi-select over the shared interest taxonomy.
 *
 * The taxonomy is open — a user may coin a tag nobody has used yet — so the
 * dropdown always offers a "create" row for the raw query. The backend
 * slugifies on write, which is what stops "Agri Tech" and "agri-tech" becoming
 * two tags.
 */
export default function TagPicker({
  value,
  onChange,
  max = 15,
  placeholder = "Search interests, e.g. agri-tech, drones…",
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchTags(query);
        if (!cancelled) setOptions(results);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const selectedLower = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value],
  );

  const suggestions = options.filter((t) => !selectedLower.has(t.label.toLowerCase()));
  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 0 &&
    !selectedLower.has(trimmed.toLowerCase()) &&
    !options.some((t) => t.label.toLowerCase() === trimmed.toLowerCase());

  const add = (label: string) => {
    if (value.length >= max) return;
    if (selectedLower.has(label.toLowerCase())) return;
    onChange([...value, label]);
    setQuery("");
  };

  const remove = (label: string) => onChange(value.filter((v) => v !== label));

  return (
    <div className="community-tagpicker" ref={containerRef}>
      {value.length > 0 && (
        <div className="community-chip-row">
          {value.map((label) => (
            <TagChip key={label} label={label} active onRemove={() => remove(label)} />
          ))}
        </div>
      )}

      <div className="community-tagpicker-input">
        <Search size={16} strokeWidth={1.9} aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (trimmed) add(trimmed);
            } else if (e.key === "Backspace" && !query && value.length) {
              remove(value[value.length - 1]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={value.length >= max ? `Limit of ${max} interests reached` : placeholder}
          disabled={value.length >= max}
          aria-label="Search interests"
        />
      </div>

      {open && (suggestions.length > 0 || canCreate || loading) && (
        <ul className="community-tagpicker-menu" role="listbox">
          {loading && suggestions.length === 0 && (
            <li className="community-tagpicker-empty">Searching…</li>
          )}

          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button type="button" onClick={() => add(tag.label)}>
                <span>{tag.label}</span>
                {tag.usage_count > 0 && (
                  <small>
                    {tag.usage_count} {tag.usage_count === 1 ? "member" : "members"}
                  </small>
                )}
              </button>
            </li>
          ))}

          {canCreate && (
            <li>
              <button type="button" onClick={() => add(trimmed)}>
                <span>
                  <Plus size={13} strokeWidth={2.2} aria-hidden /> Add &ldquo;{trimmed}&rdquo;
                </span>
                <small>New interest</small>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
