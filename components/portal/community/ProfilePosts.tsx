"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import PostCard from "./PostCard";
import { getUserPosts } from "@/lib/community-api";
import type { Post } from "@/lib/community-types";

type ProfilePostsProps = {
  userId: string;
  isSelf: boolean;
  onOpenProfile?: (userId: string) => void;
};

export default function ProfilePosts({ userId, isSelf, onOpenProfile }: ProfilePostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCursor?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const page = await getUserPosts(userId, nextCursor);
        setPosts((prev) => (nextCursor ? [...prev, ...page.items] : page.items));
        setCursor(page.next_cursor ?? null);
        setHasMore(page.has_more);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load posts.");
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const patchPost = (postId: string, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  };

  return (
    <section className="table-card community-profile-posts">
      <h4 className="community-section-title">
        <Newspaper size={16} strokeWidth={1.9} aria-hidden /> Posts
      </h4>

      {error && <p className="community-inline-error">{error}</p>}

      {loading && posts.length === 0 ? (
        <p className="community-muted">Loading posts…</p>
      ) : posts.length === 0 ? (
        <p className="community-muted">
          {isSelf
            ? "You haven't posted yet. Share an update from the Feed tab."
            : "This member hasn't posted anything visible to you yet."}
        </p>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onChange={(patch) => patchPost(post.id, patch)}
            onRemoved={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            onShared={() => undefined}
            onOpenProfile={onOpenProfile}
          />
        ))
      )}

      {hasMore && (
        <button
          type="button"
          className="community-btn ghost community-block-btn"
          onClick={() => load(cursor)}
          disabled={loading}
        >
          {loading ? "Loading…" : "Show more posts"}
        </button>
      )}
    </section>
  );
}
