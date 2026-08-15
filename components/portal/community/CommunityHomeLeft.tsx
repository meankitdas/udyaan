"use client";

import { Bookmark, Eye, Link2, Network, Sparkles } from "lucide-react";
import Avatar from "./Avatar";
import type { ProfileDetail } from "@/lib/community-types";

type Props = {
  profile: ProfileDetail | null;
  onOpenProfile?: (userId: string) => void;
  onOpenNetwork?: () => void;
  onOpenDiscover?: () => void;
};

export default function CommunityHomeLeft({
  profile,
  onOpenProfile,
  onOpenNetwork,
  onOpenDiscover,
}: Props) {
  const name = profile?.full_name ?? "Your profile";

  return (
    <aside className="community-home-left" aria-label="Your community profile">
      <section className="community-home-profile-card">
        <div className="community-home-cover" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <button
          type="button"
          className="community-home-identity"
          onClick={() => profile?.id && onOpenProfile?.(profile.id)}
        >
          <Avatar
            name={name}
            src={profile?.avatar_url}
            role={profile?.community_role}
            size={72}
          />
          <strong>{name}</strong>
          <small>{profile?.headline || profile?.organization_name || "Udyaan community member"}</small>
          {(profile?.university || profile?.cohort) && (
            <span>{[profile.university, profile.cohort && `Cohort ${profile.cohort}`].filter(Boolean).join(" · ")}</span>
          )}
        </button>

        <div className="community-home-profile-stats">
          <button type="button" onClick={onOpenNetwork}>
            <span><Network size={14} aria-hidden /> Connections</span>
            <strong>{profile?.connection_count ?? 0}</strong>
          </button>
          <button type="button" onClick={onOpenNetwork}>
            <span><Eye size={14} aria-hidden /> Followers</span>
            <strong>{profile?.follower_count ?? 0}</strong>
          </button>
        </div>

        <button type="button" className="community-home-discover" onClick={onOpenDiscover}>
          <Sparkles size={15} aria-hidden />
          <span><strong>Grow your network</strong><small>Find peers and mentors</small></span>
        </button>

        <button type="button" className="community-home-saved" onClick={() => profile?.id && onOpenProfile?.(profile.id)}>
          <Bookmark size={15} aria-hidden /> My posts & achievements
        </button>
      </section>

      {profile?.tags?.length ? (
        <section className="community-home-side-card">
          <header><h3>My interests</h3><Link2 size={15} aria-hidden /></header>
          <div className="community-home-interest-list">
            {profile.tags.slice(0, 6).map((tag) => <span key={tag.id}>#{tag.label}</span>)}
          </div>
          <button type="button" onClick={onOpenDiscover}>Explore matching people</button>
        </section>
      ) : null}
    </aside>
  );
}
