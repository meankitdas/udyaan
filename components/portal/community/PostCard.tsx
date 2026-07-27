"use client";

import { useState } from "react";
import {
  Award,
  Flag,
  Globe,
  Lock,
  MoreHorizontal,
  Repeat2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Avatar from "./Avatar";
import CommentThread from "./CommentThread";
import PostActions from "./PostActions";
import ReportDialog from "./ReportDialog";
import ResearchAttachment from "./ResearchAttachment";
import TagChip from "./TagChip";
import { deletePost } from "@/lib/community-api";
import type { Post } from "@/lib/community-types";

type PostCardProps = {
  post: Post;
  onChange: (patch: Partial<Post>) => void;
  onRemoved: (postId: string) => void;
  onShared: (created: Post) => void;
  onOpenProfile?: (userId: string) => void;
  /** Interests of the current viewer, used to highlight matching topics. */
  viewerTags?: Set<string>;
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  // The API returns naive UTC; without the marker the browser reads it as local
  // time and every post looks hours old.
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PostBody({
  post,
  viewerTags,
  onOpenProfile,
  nested = false,
}: {
  post: Post;
  viewerTags?: Set<string>;
  onOpenProfile?: (userId: string) => void;
  nested?: boolean;
}) {
  const author = post.author;

  return (
    <>
      <div className="community-post-head">
        <button
          type="button"
          className="community-post-author"
          onClick={() => author && onOpenProfile?.(author.id)}
        >
          <Avatar
            name={author?.full_name ?? "Member"}
            src={author?.avatar_url}
            size={nested ? 34 : 44}
            role={author?.community_role}
          />
          <span>
            <strong>{author?.full_name ?? "Member"}</strong>
            {author?.headline && <small>{author.headline}</small>}
            <small className="community-post-time">
              {timeAgo(post.created_at)}
              {post.edited_at ? " · edited" : ""}
              {post.visibility === "connections" && (
                <>
                  {" · "}
                  <Lock size={11} strokeWidth={2.2} aria-label="Connections only" />
                </>
              )}
              {post.visibility === "public" && !nested && (
                <>
                  {" · "}
                  <Globe size={11} strokeWidth={2.2} aria-label="Visible to everyone" />
                </>
              )}
            </small>
          </span>
        </button>
      </div>

      {post.post_type === "achievement" && post.achievement && (
        <div className="community-post-achievement">
          <span className="community-post-achievement-icon">
            <Award size={17} strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <strong>{post.achievement.title}</strong>
            {post.achievement.issuer && <small>{post.achievement.issuer}</small>}
            {post.achievement.description && <p>{post.achievement.description}</p>}
          </div>
        </div>
      )}

      {post.body && <p className="community-post-body">{post.body}</p>}

      {!nested && <ResearchAttachment link={post.link_url} file={post.attachment} />}

      {post.tags.length > 0 && (
        <div className="community-chip-row community-post-tags">
          {post.tags.map((tag) => (
            <TagChip key={tag.id} label={tag.label} shared={viewerTags?.has(tag.slug)} />
          ))}
        </div>
      )}
    </>
  );
}

export default function PostCard({
  post,
  onChange,
  onRemoved,
  onShared,
  onOpenProfile,
  viewerTags,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isShare = Boolean(post.shared_from || post.shared_source_missing);

  const remove = async () => {
    setMenuOpen(false);
    try {
      await deletePost(post.id);
      onRemoved(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this post.");
    }
  };

  return (
    <article className="community-post">
      {isShare && (
        <p className="community-post-shared-label">
          <Repeat2 size={14} strokeWidth={2} aria-hidden />
          <strong>{post.author?.full_name ?? "Someone"}</strong> shared this
        </p>
      )}

      <div className="community-post-toolbar">
        {post.score != null && post.matched_tags.length > 0 && (
          <span
            className="community-post-relevance"
            title={`Matches your interests: ${post.matched_tags.join(", ")}`}
          >
            <Sparkles size={12} strokeWidth={2.2} aria-hidden />
            Matches your interests
          </span>
        )}

        <div className="community-post-menu">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Post options"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={17} strokeWidth={1.9} aria-hidden />
          </button>
          {menuOpen && (
            <div className="community-post-menu-list">
              {post.can_moderate && (
                <button type="button" onClick={remove}>
                  <Trash2 size={14} strokeWidth={1.9} aria-hidden /> Delete post
                </button>
              )}
              {!post.can_edit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReporting(true);
                  }}
                >
                  <Flag size={14} strokeWidth={1.9} aria-hidden /> Report post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <PostBody post={post} viewerTags={viewerTags} onOpenProfile={onOpenProfile} />

      {post.shared_from && (
        <div className="community-post-original">
          <PostBody post={post.shared_from} viewerTags={viewerTags} onOpenProfile={onOpenProfile} nested />
          <ResearchAttachment
            link={post.shared_from.link_url}
            file={post.shared_from.attachment}
          />
        </div>
      )}

      {post.shared_source_missing && (
        <div className="community-post-original tombstone">
          <p className="community-muted">The original post is no longer available.</p>
        </div>
      )}

      {error && <p className="community-inline-error">{error}</p>}

      <PostActions
        post={post}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((o) => !o)}
        onChange={onChange}
        onShared={onShared}
      />

      {commentsOpen && (
        <CommentThread
          postId={post.id}
          onCountChange={(total) => onChange({ comment_count: total })}
          onOpenProfile={onOpenProfile}
        />
      )}

      {reporting && (
        <ReportDialog
          targetType="post"
          targetId={post.id}
          targetLabel={`post by ${post.author?.full_name ?? "a member"}`}
          onClose={() => setReporting(false)}
        />
      )}
    </article>
  );
}
