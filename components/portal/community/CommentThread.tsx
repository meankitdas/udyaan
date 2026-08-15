"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Loader2, Send, Trash2 } from "lucide-react";
import Avatar from "./Avatar";
import ReportDialog from "./ReportDialog";
import {
  createComment,
  deleteComment,
  listComments,
} from "@/lib/community-api";
import type { Comment } from "@/lib/community-types";

type CommentThreadProps = {
  postId: string;
  onCountChange: (total: number) => void;
  onOpenProfile?: (userId: string) => void;
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function CommentRow({
  comment,
  onReply,
  onDelete,
  onReport,
  onOpenProfile,
  isReply = false,
}: {
  comment: Comment;
  onReply: (c: Comment) => void;
  onDelete: (c: Comment) => void;
  onReport: (c: Comment) => void;
  onOpenProfile?: (userId: string) => void;
  isReply?: boolean;
}) {
  if (comment.is_removed) {
    return (
      <li className={`community-comment removed${isReply ? " reply" : ""}`}>
        <p className="community-muted">This comment was removed by a moderator.</p>
        {comment.replies.length > 0 && (
          <ul className="community-comment-replies">
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
                onOpenProfile={onOpenProfile}
                isReply
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const author = comment.author;

  return (
    <li className={`community-comment${isReply ? " reply" : ""}`}>
      <Avatar name={author?.full_name ?? "Member"} src={author?.avatar_url} size={32} />
      <div className="community-comment-main">
        <div className="community-comment-bubble">
          <button
            type="button"
            className="community-comment-author"
            onClick={() => author && onOpenProfile?.(author.id)}
          >
            {author?.full_name ?? "Member"}
          </button>
          {author?.headline && <small>{author.headline}</small>}
          <p>{comment.body}</p>
        </div>
        <div className="community-comment-meta">
          <span>{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span>edited</span>}
          {!isReply && (
            <button type="button" onClick={() => onReply(comment)}>
              Reply
            </button>
          )}
          {comment.can_moderate && (
            <button type="button" onClick={() => onDelete(comment)}>
              <Trash2 size={12} strokeWidth={2} aria-hidden /> Delete
            </button>
          )}
          {!comment.can_edit && (
            <button type="button" onClick={() => onReport(comment)}>
              <Flag size={12} strokeWidth={2} aria-hidden /> Report
            </button>
          )}
        </div>

        {comment.replies.length > 0 && (
          <ul className="community-comment-replies">
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
                onOpenProfile={onOpenProfile}
                isReply
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function CommentThread({
  postId,
  onCountChange,
  onOpenProfile,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Comment | null>(null);

  // Held in a ref so callers can pass an inline arrow without retriggering the
  // fetch effect on every render.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  });

  // Bumped per request so a slow response can't overwrite a newer one.
  const requestRef = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const seq = ++requestRef.current;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const page = await listComments(postId);
        if (seq !== requestRef.current) return;
        setComments(page.items);
        onCountChangeRef.current(page.total);
      } catch (err) {
        if (seq !== requestRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load comments.");
      } finally {
        if (seq === requestRef.current) setLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createComment(postId, {
        body: body.trim(),
        parent_id: replyTo?.id ?? null,
      });
      setBody("");
      setReplyTo(null);
      // Refetch rather than splice: a reply has to land in the right place in
      // the tree, and the server owns the flattening rule.
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your comment.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (comment: Comment) => {
    try {
      await deleteComment(comment.id);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the comment.");
    }
  };

  return (
    <div className="community-comments">
      {loading ? (
        <p className="community-muted">Loading comments…</p>
      ) : comments.length > 0 ? (
        <ul className="community-comment-list">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onReply={setReplyTo}
              onDelete={remove}
              onReport={setReporting}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </ul>
      ) : error ? null : (
        <p className="community-muted">No comments yet. Start the conversation.</p>
      )}

      <form className="community-comment-form" onSubmit={submit}>
        {replyTo && (
          <div className="community-replying-to">
            Replying to <strong>{replyTo.author?.full_name ?? "member"}</strong>
            <button type="button" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </div>
        )}
        <div className="community-comment-input">
          <input
            type="text"
            className="form-control"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
            maxLength={2000}
          />
          <button
            type="submit"
            className="community-btn community-btn-sm primary"
            disabled={saving || !body.trim()}
            aria-label="Post comment"
          >
            {saving ? (
              <Loader2 size={15} className="community-spin" aria-hidden />
            ) : (
              <Send size={15} strokeWidth={1.9} aria-hidden />
            )}
          </button>
        </div>
      </form>

      {error && <p className="community-inline-error">{error}</p>}

      {reporting && (
        <ReportDialog
          targetType="comment"
          targetId={reporting.id}
          targetLabel={`comment by ${reporting.author?.full_name ?? "a member"}`}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  );
}
