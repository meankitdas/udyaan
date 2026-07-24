"use client";

import { Medal } from "lucide-react";

const PODIUM = ["#c8912a", "#8c8c98", "#a2673b"];

/** Rank indicator: medal icon for the top three, muted numeral beyond that. */
export default function RankBadge({ rank }: { rank: number }) {
  if (rank < 3) {
    const label = ["1st place", "2nd place", "3rd place"][rank];
    return (
      <span
        style={{ display: "inline-flex", alignItems: "center", color: PODIUM[rank] }}
        title={label}
        aria-label={label}
      >
        <Medal size={18} strokeWidth={1.8} aria-hidden />
      </span>
    );
  }

  return (
    <span
      style={{ color: "var(--cohere-muted, #75758a)", fontVariantNumeric: "tabular-nums", fontSize: "13px" }}
      aria-label={`Rank ${rank + 1}`}
    >
      {rank + 1}
    </span>
  );
}
