"use client";

import { Building2, GraduationCap, Users, X } from "lucide-react";
import Avatar from "./Avatar";
import ConnectionButton from "./ConnectionButton";
import TagChip from "./TagChip";
import { roleLabel } from "@/lib/community-types";
import type { ConnectionState, ProfileSummary } from "@/lib/community-types";

type PersonCardProps = {
  person: ProfileSummary;
  onOpen: (userId: string) => void;
  onChange: (
    userId: string,
    next: { connection_state: ConnectionState; connection_id?: string | null },
  ) => void;
  /** Supplied only where the card is a suggestion the viewer can reject. */
  onDismiss?: (userId: string) => void;
};

const MAX_VISIBLE_TAGS = 4;

export default function PersonCard({
  person,
  onOpen,
  onChange,
  onDismiss,
}: PersonCardProps) {
  const shared = new Set(person.shared_tags);
  // Interests in common are the reason to click, so they sort to the front.
  const tags = [...person.tags].sort(
    (a, b) => Number(shared.has(b.label)) - Number(shared.has(a.label)),
  );
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const overflow = tags.length - visible.length;

  return (
    <article className="community-card">
      {onDismiss && (
        <button
          type="button"
          className="community-card-dismiss"
          onClick={() => onDismiss(person.id)}
          aria-label={`Stop suggesting ${person.full_name}`}
          title="Not interested"
        >
          <X size={15} strokeWidth={2} aria-hidden />
        </button>
      )}
      <button
        type="button"
        className="community-card-main"
        onClick={() => onOpen(person.id)}
        aria-label={`View ${person.full_name}'s profile`}
      >
        <Avatar name={person.full_name} src={person.avatar_url} size={52} />
        <div className="community-card-identity">
          <h3>{person.full_name}</h3>
          <span
            className={`community-role-badge ${person.community_role}`}
          >
            {roleLabel(person.role_key, person.community_role)}
          </span>
          {person.headline && <p className="community-card-headline">{person.headline}</p>}
        </div>
      </button>

      <dl className="community-card-meta">
        {person.university && (
          <div>
            <dt>
              <GraduationCap size={14} strokeWidth={1.8} aria-hidden />
            </dt>
            <dd>{person.university}</dd>
          </div>
        )}
        {person.organization_name && (
          <div>
            <dt>
              <Building2 size={14} strokeWidth={1.8} aria-hidden />
            </dt>
            <dd>{person.organization_name}</dd>
          </div>
        )}
        {person.mutual_connections > 0 && (
          <div>
            <dt>
              <Users size={14} strokeWidth={1.8} aria-hidden />
            </dt>
            <dd>
              {person.mutual_connections} mutual{" "}
              {person.mutual_connections === 1 ? "connection" : "connections"}
            </dd>
          </div>
        )}
      </dl>

      {visible.length > 0 && (
        <div className="community-chip-row">
          {visible.map((tag) => (
            <TagChip key={tag.id} label={tag.label} shared={shared.has(tag.label)} />
          ))}
          {overflow > 0 && <span className="community-chip muted">+{overflow}</span>}
        </div>
      )}

      <div className="community-card-footer">
        <ConnectionButton
          person={person}
          size="sm"
          onChange={(next) => onChange(person.id, next)}
        />
      </div>
    </article>
  );
}
