"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Building2, FolderKanban, Search, UserRound } from "lucide-react";
import type { DirectoryRow } from "@/lib/portal-types";

const KIND_ICON = {
  project: FolderKanban,
  person: UserRound,
  organisation: Building2,
} as const;

const KIND_LABEL = {
  project: "Projects",
  person: "People",
  organisation: "Organisations",
} as const;

export type PaletteAction = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type Props = {
  directory: DirectoryRow[];
  actions?: PaletteAction[];
};

/**
 * Cmd/Ctrl-K jump-to-anything.
 *
 * The whole directory is already in memory from the control-centre payload, so
 * search is local and instant — no request per keystroke, and it keeps working
 * if the network hiccups mid-session.
 */
export default function CommandPalette({ directory, actions = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, DirectoryRow[]> = { project: [], person: [], organisation: [] };
    for (const row of directory) map[row.kind]?.push(row);
    return map;
  }, [directory]);

  const go = (row: DirectoryRow) => {
    setOpen(false);
    if (row.kind === "project") router.push(`/portal/projects/${row.id}`);
  };

  return (
    <>
      <button type="button" className="portal-cc-kbd-trigger" onClick={() => setOpen(true)}>
        <Search size={14} aria-hidden />
        <span>Search or jump to…</span>
        <kbd>⌘K</kbd>
      </button>

      {/*
        cmdk renders through Radix Dialog: `className` lands on the Command root
        only. Without overlayClassName/contentClassName the backdrop is unstyled
        and the content wrapper collapses to a zero-height box, so the panel
        floats with no dimming behind it.
      */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        overlayClassName="portal-cc-overlay"
        contentClassName="portal-cc-content"
        className="portal-cc-palette"
      >
        <Command.Input placeholder="Search projects, people, organisations…" />
        <Command.List>
          <Command.Empty>Nothing matches that.</Command.Empty>

          {actions.length > 0 && (
            <Command.Group heading="Actions">
              {actions.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`action ${a.label} ${a.hint ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    a.run();
                  }}
                >
                  <span>{a.label}</span>
                  {a.hint && <em>{a.hint}</em>}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {(Object.keys(grouped) as (keyof typeof KIND_LABEL)[]).map((kind) =>
            grouped[kind].length ? (
              <Command.Group key={kind} heading={KIND_LABEL[kind]}>
                {grouped[kind].slice(0, 50).map((row) => {
                  const Icon = KIND_ICON[kind];
                  return (
                    <Command.Item
                      key={`${kind}-${row.id}`}
                      value={`${row.name} ${row.subtitle ?? ""} ${row.id}`}
                      onSelect={() => go(row)}
                    >
                      <Icon size={14} aria-hidden />
                      <span>{row.name}</span>
                      {row.subtitle && <em>{row.subtitle}</em>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null,
          )}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
