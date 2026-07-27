"use client";

import type { CommunityRole } from "@/lib/community-types";

type AvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  role?: CommunityRole;
};

/** Deterministic tint so the same person always gets the same initials colour. */
function tintFor(name: string): string {
  const palette = ["#27684a", "#1d3026", "#0d6efd", "#6610f2", "#fd7e14", "#20c997"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return palette[hash % palette.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function Avatar({ name, src, size = 48, role }: AvatarProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(11, size * 0.36),
    backgroundColor: src ? "#f3f4f6" : tintFor(name),
  };

  return (
    <span className="community-avatar" style={style} data-role={role} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
