"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Award,
  Building2,
  CalendarDays,
  ExternalLink,
  Flag,
  GraduationCap,
  Mail,
  Pencil,
  Phone,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import Avatar from "./Avatar";
import ConnectionButton from "./ConnectionButton";
import ReportDialog from "./ReportDialog";
import TagChip from "./TagChip";
import PortalSkeleton from "../PortalSkeleton";
import { followUser, getProfile, unfollowUser } from "@/lib/community-api";
import type { ConnectionState, ProfileDetail } from "@/lib/community-types";

type ProfileViewProps = {
  userId: string;
  onBack?: () => void;
  onEdit?: () => void;
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

export default function ProfileView({ userId, onBack, onEdit }: ProfileViewProps) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await getProfile(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
    setFollowBusy(true);
    try {
      const next = profile.is_following
        ? await unfollowUser(profile.id)
        : await followUser(profile.id);
      setProfile({
        ...profile,
        is_following: next.following,
        follower_count: profile.follower_count + (next.following ? 1 : -1),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update follow state");
    } finally {
      setFollowBusy(false);
    }
  };

  const handleConnectionChange = (next: {
    connection_state: ConnectionState;
    connection_id?: string | null;
  }) => {
    if (!profile) return;
    const becameConnected =
      next.connection_state === "connected" && profile.connection_state !== "connected";
    const lostConnection =
      next.connection_state !== "connected" && profile.connection_state === "connected";

    setProfile({
      ...profile,
      connection_state: next.connection_state,
      connection_id: next.connection_id,
      connection_count: profile.connection_count + (becameConnected ? 1 : lostConnection ? -1 : 0),
    });

    // Contact details are only returned for accepted connections, so refetch to
    // pick them up (or drop them) rather than guessing on the client.
    if (becameConnected || lostConnection) load();
  };

  if (loading) return <PortalSkeleton variant="dashboard" />;

  if (error || !profile) {
    return (
      <div className="community-empty">
        <h4>{error || "Profile not found"}</h4>
        {onBack && (
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to directory
          </button>
        )}
      </div>
    );
  }

  const joined = formatDate(profile.created_at);

  return (
    <div className="community-profile">
      {onBack && (
        <button type="button" className="btn-link community-back" onClick={onBack}>
          <ArrowLeft size={15} strokeWidth={1.9} aria-hidden /> Back to directory
        </button>
      )}

      <header className="community-profile-header table-card">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={96} />

        <div className="community-profile-identity">
          <div className="community-profile-nameline">
            <h2>{profile.full_name}</h2>
            <span className={`community-role-badge ${profile.community_role}`}>
              {profile.community_role === "mentor" ? "Mentor" : "Student"}
            </span>
          </div>

          {profile.headline && <p className="community-profile-headline">{profile.headline}</p>}

          <dl className="community-profile-meta">
            {profile.university && (
              <div>
                <dt>
                  <GraduationCap size={15} strokeWidth={1.8} aria-hidden />
                </dt>
                <dd>{profile.university}</dd>
              </div>
            )}
            {profile.organization_name && (
              <div>
                <dt>
                  <Building2 size={15} strokeWidth={1.8} aria-hidden />
                </dt>
                <dd>{profile.organization_name}</dd>
              </div>
            )}
            {profile.cohort && (
              <div>
                <dt>
                  <CalendarDays size={15} strokeWidth={1.8} aria-hidden />
                </dt>
                <dd>Cohort {profile.cohort}</dd>
              </div>
            )}
          </dl>

          <div className="community-profile-stats">
            <span>
              <strong>{profile.connection_count}</strong> connections
            </span>
            <span>
              <strong>{profile.follower_count}</strong> followers
            </span>
            <span>
              <strong>{profile.following_count}</strong> following
            </span>
            {profile.mutual_connections > 0 && (
              <span className="community-mutual">
                <Users size={14} strokeWidth={1.8} aria-hidden />
                {profile.mutual_connections} mutual
              </span>
            )}
          </div>
        </div>

        <div className="community-profile-actions">
          {profile.is_self ? (
            onEdit && (
              <button type="button" className="btn-primary" onClick={onEdit}>
                <Pencil size={15} strokeWidth={1.9} aria-hidden /> Edit profile
              </button>
            )
          ) : (
            <>
              <ConnectionButton person={profile} onChange={handleConnectionChange} />
              <button
                type="button"
                className={`community-btn ${profile.is_following ? "ghost" : "outline"}`}
                onClick={toggleFollow}
                disabled={followBusy}
              >
                {profile.is_following ? (
                  <>
                    <UserMinus size={15} strokeWidth={1.9} aria-hidden /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={15} strokeWidth={1.9} aria-hidden /> Follow
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-link community-report-link"
                onClick={() => setReporting(true)}
              >
                <Flag size={14} strokeWidth={1.9} aria-hidden /> Report
              </button>
            </>
          )}
        </div>
      </header>

      <div className="community-profile-columns">
        <div className="community-profile-col">
          <section className="table-card">
            <h4 className="community-section-title">About</h4>
            {profile.bio ? (
              <p className="community-bio">{profile.bio}</p>
            ) : (
              <p className="community-muted">
                {profile.is_self
                  ? "Add a short bio so others know what you're working on."
                  : "This member hasn't added a bio yet."}
              </p>
            )}
            {joined && <p className="community-joined">Member since {joined}</p>}
          </section>

          <section className="table-card">
            <h4 className="community-section-title">
              <Award size={16} strokeWidth={1.9} aria-hidden /> Achievements
            </h4>
            {profile.achievements.length === 0 ? (
              <p className="community-muted">
                {profile.is_self
                  ? "Add awards, publications, or certifications to stand out."
                  : "No achievements listed yet."}
              </p>
            ) : (
              <ul className="community-achievements">
                {profile.achievements.map((a) => (
                  <li key={a.id}>
                    <div className="community-achievement-head">
                      <strong>{a.title}</strong>
                      {a.achieved_on && <span>{formatDate(a.achieved_on)}</span>}
                    </div>
                    {a.issuer && <p className="community-achievement-issuer">{a.issuer}</p>}
                    {a.description && <p>{a.description}</p>}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer">
                        View <ExternalLink size={12} strokeWidth={2} aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="community-profile-col">
          <section className="table-card">
            <h4 className="community-section-title">Interests</h4>
            {profile.tags.length === 0 ? (
              <p className="community-muted">
                {profile.is_self
                  ? "Add interests so we can match you with the right people."
                  : "No interests listed yet."}
              </p>
            ) : (
              <div className="community-chip-row">
                {profile.tags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    label={tag.label}
                    shared={profile.shared_tags.includes(tag.label)}
                  />
                ))}
              </div>
            )}
            {profile.shared_tags.length > 0 && (
              <p className="community-shared-note">
                Highlighted interests are ones you share.
              </p>
            )}
          </section>

          {(profile.email || profile.phone) && (
            <section className="table-card">
              <h4 className="community-section-title">Contact</h4>
              <ul className="community-contact">
                {profile.email && (
                  <li>
                    <Mail size={15} strokeWidth={1.8} aria-hidden />
                    <a href={`mailto:${profile.email}`}>{profile.email}</a>
                  </li>
                )}
                {profile.phone && (
                  <li>
                    <Phone size={15} strokeWidth={1.8} aria-hidden />
                    <a href={`tel:${profile.phone}`}>{profile.phone}</a>
                  </li>
                )}
              </ul>
              {!profile.is_self && (
                <p className="community-muted community-contact-note">
                  Shared with you because you&apos;re connected.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      {reporting && (
        <ReportDialog
          targetType="user"
          targetId={profile.id}
          targetLabel={profile.full_name}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
