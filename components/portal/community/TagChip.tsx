"use client";

import { X } from "lucide-react";

type TagChipProps = {
  label: string;
  /** Highlights interests the viewer shares with this person. */
  shared?: boolean;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
};

export default function TagChip({
  label,
  shared = false,
  active = false,
  count,
  onClick,
  onRemove,
}: TagChipProps) {
  const className = `community-chip${shared ? " shared" : ""}${active ? " active" : ""}`;

  const content = (
    <>
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="community-chip-count">{count}</span>
      )}
    </>
  );

  if (onRemove) {
    return (
      <span className={className}>
        {content}
        <button
          type="button"
          className="community-chip-remove"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <X size={13} strokeWidth={2.4} aria-hidden />
        </button>
      </span>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
