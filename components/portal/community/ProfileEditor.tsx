"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, EyeOff, Save } from "lucide-react";
import Avatar from "./Avatar";
import AchievementsEditor from "./AchievementsEditor";
import TagPicker from "./TagPicker";
import PortalSkeleton from "../PortalSkeleton";
import { getMyProfile, updateMyProfile, updateMyTags } from "@/lib/community-api";
import type { Achievement, ProfileDetail } from "@/lib/community-types";

type ProfileEditorProps = {
  onSaved?: () => void;
  onViewProfile?: (userId: string) => void;
};

export default function ProfileEditor({ onSaved, onViewProfile }: ProfileEditorProps) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    headline: "",
    bio: "",
    university: "",
    cohort: "",
    avatar_url: "",
    is_discoverable: true,
  });
  const [tags, setTags] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProfile();
      setProfile(data);
      setForm({
        full_name: data.full_name ?? "",
        headline: data.headline ?? "",
        bio: data.bio ?? "",
        university: data.university ?? "",
        cohort: data.cohort ?? "",
        avatar_url: data.avatar_url ?? "",
        is_discoverable: data.is_discoverable,
      });
      setTags(data.tags.map((t) => t.label));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // Tags live in their own join table, so they save through a second call.
      const [updated] = await Promise.all([
        updateMyProfile({
          full_name: form.full_name.trim(),
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
          university: form.university.trim() || null,
          cohort: form.cohort.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
          is_discoverable: form.is_discoverable,
        }),
        updateMyTags(tags),
      ]);
      setProfile(updated);
      setSavedAt(Date.now());
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAchievements = (next: Achievement[]) =>
    setProfile((p) => (p ? { ...p, achievements: next } : p));

  if (loading) return <PortalSkeleton variant="dashboard" />;

  if (!profile) {
    return <p className="community-inline-error">{error || "Could not load your profile"}</p>;
  }

  return (
    <div className="community-editor">
      <form onSubmit={save} className="table-card">
        <div className="community-editor-head">
          <h4 className="community-section-title">Your profile</h4>
          {onViewProfile && (
            <button
              type="button"
              className="btn-link"
              onClick={() => onViewProfile(profile.id)}
            >
              View as others see it
            </button>
          )}
        </div>

        <div className="community-avatar-field">
          <Avatar name={form.full_name || profile.full_name} src={form.avatar_url} size={80} />
          <label className="community-field">
            <span>Photo URL</span>
            <input
              type="url"
              className="form-control"
              value={form.avatar_url}
              onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
              placeholder="https://… (leave blank to use your initials)"
            />
          </label>
        </div>

        <div className="community-field-row">
          <label className="community-field">
            <span>Full name</span>
            <input
              className="form-control"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              maxLength={150}
              required
            />
          </label>
          <label className="community-field">
            <span>Headline</span>
            <input
              className="form-control"
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder="e.g. Final-year agri-engineering student building drone sprayers"
              maxLength={160}
            />
          </label>
        </div>

        <div className="community-field-row">
          <label className="community-field">
            <span>University / Organisation</span>
            <input
              className="form-control"
              value={form.university}
              onChange={(e) => setForm({ ...form, university: e.target.value })}
              maxLength={150}
            />
          </label>
          <label className="community-field">
            <span>Cohort</span>
            <input
              className="form-control"
              value={form.cohort}
              onChange={(e) => setForm({ ...form, cohort: e.target.value })}
              placeholder="e.g. 2026"
              maxLength={50}
            />
          </label>
        </div>

        <label className="community-field">
          <span>Bio</span>
          <textarea
            className="form-control"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="What are you working on, and what are you looking for from this network?"
          />
        </label>

        <div className="community-field">
          <span>Interests</span>
          <p className="community-muted community-field-hint">
            These decide who you&apos;re matched with and what shows up in your feed.
          </p>
          <TagPicker value={tags} onChange={setTags} />
        </div>

        <button
          type="button"
          className={`community-visibility ${form.is_discoverable ? "on" : "off"}`}
          onClick={() => setForm({ ...form, is_discoverable: !form.is_discoverable })}
          aria-pressed={form.is_discoverable}
        >
          {form.is_discoverable ? (
            <Eye size={16} strokeWidth={1.9} aria-hidden />
          ) : (
            <EyeOff size={16} strokeWidth={1.9} aria-hidden />
          )}
          <span>
            <strong>
              {form.is_discoverable ? "Visible in the directory" : "Hidden from the directory"}
            </strong>
            <small>
              {form.is_discoverable
                ? "Other members can find you through search and filters."
                : "You won't appear in search. People with your profile link can still view it."}
            </small>
          </span>
        </button>

        {error && <p className="community-inline-error">{error}</p>}

        <div className="community-form-actions">
          {savedAt > 0 && !saving && (
            <span className="community-saved">
              <Check size={15} strokeWidth={2.2} aria-hidden /> Saved
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={15} strokeWidth={1.9} aria-hidden />
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <AchievementsEditor
        achievements={profile.achievements}
        onChange={handleAchievements}
      />
    </div>
  );
}
