"use client";

import { MessagesSquare } from "lucide-react";
import {
  siFigma,
  siGithub,
  siGoogledrive,
  siJira,
  siMiro,
  siNotion,
  siTrello,
} from "simple-icons";

/**
 * Official brand marks, sourced from simple-icons rather than hand-drawn, so
 * the paths are the real ones and stay correct as brands refresh them.
 *
 * Slack is the exception: it was withdrawn from simple-icons at the brand
 * owner's request, so its artwork is supplied directly from /public instead.
 */
const BRANDS: Record<string, { path: string; hex: string; title: string }> = {
  notion: siNotion,
  miro: siMiro,
  trello: siTrello,
  jira: siJira,
  figma: siFigma,
  github: siGithub,
  drive: siGoogledrive,
};

/** Brands we ship as image assets because no icon-set version is available. */
const IMAGE_BRANDS: Record<string, { src: string; title: string }> = {
  slack: { src: "/slack.webp", title: "Slack" },
};

type Props = {
  toolKey: string;
  size?: number;
  /** Muted tools sit in lists where colour would compete with the content. */
  monochrome?: boolean;
};

export default function ToolLogo({ toolKey, size = 20, monochrome = false }: Props) {
  const brand = BRANDS[toolKey];

  if (brand) {
    return (
      <svg
        role="img"
        aria-label={brand.title}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="portal-tool-logo"
      >
        <path d={brand.path} fill={monochrome ? "currentColor" : `#${brand.hex}`} />
      </svg>
    );
  }

  const image = IMAGE_BRANDS[toolKey];
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        alt={image.title}
        width={size}
        height={size}
        className="portal-tool-logo"
        style={monochrome ? { filter: "grayscale(1)" } : undefined}
      />
    );
  }

  // Unknown tool: a neutral glyph rather than a wrong brand.
  return (
    <MessagesSquare
      size={size}
      aria-label={toolKey}
      className="portal-tool-logo"
      color="currentColor"
      strokeWidth={1.8}
    />
  );
}
