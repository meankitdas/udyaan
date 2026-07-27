"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Repeat2, ThumbsUp } from "lucide-react";
import { likePost, sharePost, unlikePost } from "@/lib/community-api";
import type { Post } from "@/lib/community-types";

type PostActionsProps = {
  post: Post;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onChange: (patch: Partial<Post>) => void;
  onShared: (created: Post) => void;
};

export default function PostActions({
  post,
  commentsOpen,
  onToggleComments,
  onChange,
  onShared,
}: PostActionsProps) {
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareBody, setShareBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    // Optimistic: a like should feel instant. Reverted from the server's
    // authoritative count if the call fails.
    const previous = { viewer_has_liked: post.viewer_has_liked, like_count: post.like_count };
    onChange({
      viewer_has_liked: !post.viewer_has_liked,
      like_count: post.like_count + (post.viewer_has_liked ? -1 : 1),
    });

    try {
      const result = post.viewer_has_liked
        ? await unlikePost(post.id)
        : await likePost(post.id);
      onChange({
        viewer_has_liked: result.viewer_has_liked,
        like_count: result.like_count,
      });
    } catch (err) {
      onChange(previous);
      setError(err instanceof Error ? err.message : "Could not update your reaction.");
    } finally {
      setBusy(false);
    }
  };

  const submitShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await sharePost(post.id, { body: shareBody.trim() || null });
      onChange({ share_count: post.share_count + 1 });
      onShared(created);
      setShareBody("");
      setSharing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share this post.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="community-post-actions">
      {(post.like_count > 0 || post.comment_count > 0 || post.share_count > 0) && (
        <div className="community-post-counts">
          {post.like_count > 0 && (
            <span>
              {post.like_count} {post.like_count === 1 ? "like" : "likes"}
            </span>
          )}
          {post.comment_count > 0 && (
            <button type="button" onClick={onToggleComments}>
              {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
            </button>
          )}
          {post.share_count > 0 && (
            <span>
              {post.share_count} {post.share_count === 1 ? "share" : "shares"}
            </span>
          )}
        </div>
      )}

      <div className="community-post-buttons">
        <button
          type="button"
          className={post.viewer_has_liked ? "active" : ""}
          onClick={toggleLike}
          disabled={busy}
          aria-pressed={post.viewer_has_liked}
        >
          <ThumbsUp size={16} strokeWidth={1.9} aria-hidden />
          Like
        </button>

        <button
          type="button"
          className={commentsOpen ? "active" : ""}
          onClick={onToggleComments}
          aria-expanded={commentsOpen}
        >
          <MessageCircle size={16} strokeWidth={1.9} aria-hidden />
          Comment
        </button>

        <button
          type="button"
          className={sharing ? "active" : ""}
          onClick={() => setSharing((s) => !s)}
          aria-expanded={sharing}
        >
          <Repeat2 size={17} strokeWidth={1.9} aria-hidden />
          Share
        </button>
      </div>

      {sharing && (
        <form className="community-share-form" onSubmit={submitShare}>
          <textarea
            className="form-control"
            rows={2}
            value={shareBody}
            onChange={(e) => setShareBody(e.target.value)}
            placeholder="Add your thoughts (optional)…"
            maxLength={5000}
            autoFocus
          />
          <div className="community-share-form-actions">
            <button
              type="button"
              className="community-btn community-btn-sm ghost"
              onClick={() => {
                setSharing(false);
                setShareBody("");
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="community-btn community-btn-sm primary"
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="community-spin" aria-hidden /> : null}
              Share now
            </button>
          </div>
        </form>
      )}

      {error && <p className="community-inline-error">{error}</p>}
    </div>
  );
}
