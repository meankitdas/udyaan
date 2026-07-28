"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { Loader2, Sparkles } from "lucide-react";
import CommunityHomeLeft from "./CommunityHomeLeft";
import CommunityHomeRight from "./CommunityHomeRight";
import PostCard from "./PostCard";
import PostComposer from "./PostComposer";
import { getFeed, getMyProfile } from "@/lib/community-api";
import type { FeedScope, Post, ProfileDetail } from "@/lib/community-types";

type FeedProps = {
  onOpenProfile?: (userId: string) => void;
  onSeeAllSuggestions?: () => void;
  onOpenNetwork?: () => void;
};

const SCOPES: { value: FeedScope; label: string; blurb: string }[] = [
  { value: "for-you", label: "For you", blurb: "Ranked by your interests, freshness and engagement." },
  { value: "following", label: "Following", blurb: "Only people you follow or are connected with." },
  { value: "latest", label: "Latest", blurb: "Everything, newest first." },
];

function FeedSkeleton() {
  return (
    <div className="community-post skeleton" aria-hidden>
      <div className="community-skeleton-row">
        <span className="community-skeleton-circle" />
        <span className="community-skeleton-lines">
          <span className="community-skeleton-line" style={{ width: "38%" }} />
          <span className="community-skeleton-line" style={{ width: "24%" }} />
        </span>
      </div>
      <span className="community-skeleton-line" style={{ width: "92%" }} />
      <span className="community-skeleton-line" style={{ width: "76%" }} />
    </div>
  );
}

export default function Feed({ onOpenProfile, onSeeAllSuggestions, onOpenNetwork }: FeedProps) {
  const router = useRouter();
  const homeRef = useRef<HTMLDivElement | null>(null);
  const [scope, setScope] = useState<FeedScope>("for-you");
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerTags, setViewerTags] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfileDetail | null>(null);

  const sentinel = useRef<HTMLDivElement | null>(null);
  // Guards the observer against firing a second fetch for the same cursor while
  // the first is still in flight.
  const inFlight = useRef(false);

  // Viewer interests drive the "shared tag" highlight on every scope, not just
  // the ranked one where the server sends matched_tags.
  useEffect(() => {
    getMyProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        setViewerTags(new Set(nextProfile.tags.map((tag) => tag.slug)));
      })
      .catch(() => {
        setProfile(null);
        setViewerTags(new Set());
      });
  }, []);

  useLayoutEffect(() => {
    if (!homeRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let context: ReturnType<typeof gsap.context> | undefined;
    const animate = () => {
      if (context || !homeRef.current) return;
      context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
        timeline.from(
          ".community-home-column",
          { y: 28, duration: 0.72, stagger: 0.11, ease: "power3.out", clearProps: "transform" },
        );
        timeline.from(
          ".community-home-center > *",
          { y: 18, duration: 0.48, stagger: 0.07, ease: "power2.out", clearProps: "transform" },
          "-=0.42",
        );
      }, homeRef);
    };

    if (document.visibilityState === "visible") animate();
    else document.addEventListener("visibilitychange", animate, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", animate);
      context?.revert();
    };
  }, []);

  const loadFirstPage = useCallback(async (nextScope: FeedScope) => {
    setLoading(true);
    setError(null);
    try {
      const page = await getFeed({ scope: nextScope });
      setPosts(page.items);
      setCursor(page.next_cursor ?? null);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the feed.");
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(scope);
  }, [scope, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || !cursor) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await getFeed({ scope, cursor });
      setPosts((prev) => {
        // The ranking window can shift between pages, so de-dupe defensively.
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.next_cursor ?? null);
      setHasMore(page.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more posts.");
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      inFlight.current = false;
    }
  }, [scope, cursor, hasMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const patchPost = (postId: string, patch: Partial<Post>) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
  };

  const activeScope = SCOPES.find((s) => s.value === scope);

  return (
    <div ref={homeRef} className="community-home-grid">
      <div className="community-home-column community-home-left-column">
        <CommunityHomeLeft
          profile={profile}
          onOpenProfile={onOpenProfile}
          onOpenNetwork={onOpenNetwork}
          onOpenDiscover={onSeeAllSuggestions}
        />
      </div>

      <main className="community-home-column community-home-center">
        <PostComposer onPosted={(post) => setPosts((prev) => [post, ...prev])} />

        <motion.div className="community-feed-scopes" role="tablist" aria-label="Feed filter" layout>
        {SCOPES.map((item) => (
          <motion.button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={scope === item.value}
            className={`community-feed-scope${scope === item.value ? " active" : ""}`}
            onClick={() => setScope(item.value)}
            whileTap={{ scale: 0.97 }}
          >
            {item.value === "for-you" && <Sparkles size={13} strokeWidth={2.2} aria-hidden />}
            {item.label}
          </motion.button>
        ))}
        </motion.div>

      {activeScope && <p className="community-feed-blurb">{activeScope.blurb}</p>}

      {error && <p className="community-error">{error}</p>}

      {loading ? (
        <>
          <FeedSkeleton />
          <FeedSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="community-empty">
          <h4>Nothing here yet</h4>
          <p>
            {scope === "following"
              ? "Follow a few mentors and peers to fill this feed, or switch to “For you”."
              : "Be the first to share an update, a research finding or an achievement."}
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, y: 22, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.38, delay: Math.min(index, 4) * 0.045, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
            >
              <PostCard
                post={post}
                viewerTags={viewerTags}
                onChange={(patch) => patchPost(post.id, patch)}
                onRemoved={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onShared={(created) => setPosts((prev) => [created, ...prev])}
                onOpenProfile={onOpenProfile}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <div ref={sentinel} className="community-feed-sentinel" aria-hidden />

      {loadingMore && (
        <p className="community-feed-more">
          <Loader2 size={16} className="community-spin" aria-hidden /> Loading more…
        </p>
      )}

      {!loading && !hasMore && posts.length > 0 && (
        <p className="community-feed-end">You’re all caught up.</p>
      )}
      </main>

      <div className="community-home-column community-home-right-column">
        <CommunityHomeRight
          onOpenProfile={onOpenProfile}
          onSeeAll={onSeeAllSuggestions}
          onOpenProject={(projectId) => router.push(`/portal/projects/${projectId}`)}
        />
      </div>
    </div>
  );
}
