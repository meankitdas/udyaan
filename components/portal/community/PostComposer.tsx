"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Paperclip,
  PencilLine,
  Send,
  X,
} from "lucide-react";
import Avatar from "./Avatar";
import TagPicker from "./TagPicker";
import { createPost, getMyProfile, uploadAttachment } from "@/lib/community-api";
import type {
  Achievement,
  Attachment,
  Post,
  PostType,
  PostVisibility,
  ProfileDetail,
} from "@/lib/community-types";

type PostComposerProps = {
  onPosted: (post: Post) => void;
};

const TYPES: { value: PostType; label: string; icon: typeof PencilLine; hint: string }[] = [
  {
    value: "update",
    label: "Update",
    icon: PencilLine,
    hint: "Share what you're working on…",
  },
  {
    value: "research",
    label: "Research",
    icon: FileText,
    hint: "Summarise your finding, then add the paper or dataset below.",
  },
  {
    value: "achievement",
    label: "Achievement",
    icon: Award,
    hint: "Add a note about this achievement (optional).",
  },
];

export default function PostComposer({ onPosted }: PostComposerProps) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<PostType>("update");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [achievementId, setAchievementId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadsDisabled, setUploadsDisabled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const achievements: Achievement[] = profile?.achievements ?? [];

  const reset = () => {
    setType("update");
    setBody("");
    setLink("");
    setTags([]);
    setAttachment(null);
    setAchievementId("");
    setVisibility("public");
    setError(null);
    setExpanded(false);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      setAttachment(await uploadAttachment(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      // A deployment without storage configured should stop offering the
      // control rather than failing the same way on every attempt.
      if (message.toLowerCase().includes("not configured")) setUploadsDisabled(true);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type === "achievement" && !achievementId) {
      setError("Choose which achievement to share.");
      return;
    }
    if (type === "research" && !link.trim() && !attachment) {
      setError("Add a link or attach a document for a research finding.");
      return;
    }
    if (type !== "achievement" && !body.trim() && !link.trim() && !attachment) {
      setError("Write something, add a link, or attach a file.");
      return;
    }

    setSaving(true);
    try {
      const post = await createPost({
        post_type: type,
        body: body.trim() || null,
        link_url: link.trim() || null,
        attachment,
        achievement_id: type === "achievement" ? achievementId : null,
        visibility,
        tags,
      });
      onPosted(post);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish your post.");
    } finally {
      setSaving(false);
    }
  };

  const active = TYPES.find((t) => t.value === type) ?? TYPES[0];

  if (!expanded) {
    return (
      <motion.div
        className="community-composer collapsed"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="community-composer-prompt">
          <Avatar name={profile?.full_name ?? "You"} src={profile?.avatar_url} size={44} />
          <button type="button" className="community-composer-trigger" onClick={() => setExpanded(true)}>
            Do you have an update to share?
          </button>
        </div>
        <div className="community-composer-quick" aria-label="Create a post">
          <button type="button" onClick={() => { setType("update"); setExpanded(true); }}><ImageIcon size={17} aria-hidden /> Media</button>
          <button type="button" onClick={() => { setType("research"); setExpanded(true); }}><FileText size={17} aria-hidden /> Research</button>
          <button type="button" onClick={() => { setType("achievement"); setExpanded(true); }}><Award size={17} aria-hidden /> Achievement</button>
          <button type="button" onClick={() => { setType("update"); setExpanded(true); }}><PencilLine size={17} aria-hidden /> Article</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form
      className="community-composer"
      onSubmit={submit}
      initial={{ opacity: 0, height: 88, y: 8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="community-composer-head">
        <Avatar name={profile?.full_name ?? "You"} src={profile?.avatar_url} size={42} />
        <div className="community-composer-types" role="tablist" aria-label="Post type">
          {TYPES.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={type === option.value}
                className={type === option.value ? "active" : ""}
                onClick={() => setType(option.value)}
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden />
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="community-composer-close"
          onClick={reset}
          aria-label="Discard post"
        >
          <X size={17} strokeWidth={1.9} aria-hidden />
        </button>
      </div>

      <textarea
        className="form-control community-composer-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={active.hint}
        rows={4}
        maxLength={5000}
        autoFocus
      />

      {type === "achievement" && (
        <label className="community-field">
          <span>Achievement</span>
          {achievements.length === 0 ? (
            <p className="community-field-hint community-muted">
              You haven&apos;t added any achievements yet. Add one on your profile first.
            </p>
          ) : (
            <select
              className="form-control"
              value={achievementId}
              onChange={(e) => setAchievementId(e.target.value)}
            >
              <option value="">Select an achievement…</option>
              {achievements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.issuer ? ` — ${a.issuer}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      {type === "research" && (
        <label className="community-field">
          <span>
            Link <small>DOI, journal, repository or dataset</small>
          </span>
          <input
            type="url"
            className="form-control"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://doi.org/…"
          />
        </label>
      )}

      {attachment && (
        <div className="community-composer-file">
          <FileText size={16} strokeWidth={1.8} aria-hidden />
          <span>{attachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
          >
            <X size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      <label className="community-field">
        <span>
          Topics <small>helps this reach people who care about it</small>
        </span>
        <TagPicker value={tags} onChange={setTags} max={8} />
      </label>

      {error && <p className="community-inline-error">{error}</p>}

      <div className="community-composer-actions">
        <div className="community-composer-tools">
          {!uploadsDisabled && (
            <>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.csv,.docx,.xlsx,.pptx"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                className="community-btn community-btn-sm ghost"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 size={15} className="community-spin" aria-hidden />
                ) : (
                  <Paperclip size={15} strokeWidth={1.9} aria-hidden />
                )}
                {uploading ? "Uploading…" : "Attach"}
              </button>
            </>
          )}

          <button
            type="button"
            className="community-btn community-btn-sm ghost"
            onClick={() =>
              setVisibility(visibility === "public" ? "connections" : "public")
            }
            title={
              visibility === "public"
                ? "Anyone in the community can see this"
                : "Only your connections can see this"
            }
          >
            {visibility === "public" ? (
              <Globe size={15} strokeWidth={1.9} aria-hidden />
            ) : (
              <Lock size={15} strokeWidth={1.9} aria-hidden />
            )}
            {visibility === "public" ? "Everyone" : "Connections"}
          </button>
        </div>

        <button type="submit" className="community-btn primary" disabled={saving || uploading}>
          {saving ? (
            <Loader2 size={15} className="community-spin" aria-hidden />
          ) : (
            <Send size={15} strokeWidth={1.9} aria-hidden />
          )}
          {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </motion.form>
  );
}
