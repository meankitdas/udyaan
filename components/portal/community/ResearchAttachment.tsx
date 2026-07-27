"use client";

import { ExternalLink, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import type { Attachment } from "@/lib/community-types";

type ResearchAttachmentProps = {
  link?: string | null;
  file?: Attachment | null;
};

function formatSize(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Shorten a URL to its host plus a hint of the path, so cards stay readable. */
function displayLink(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path.length > 24 ? `${path.slice(0, 24)}…` : path}`;
  } catch {
    return url;
  }
}

export default function ResearchAttachment({ link, file }: ResearchAttachmentProps) {
  if (!link && !file) return null;

  const isImage = file?.content_type?.startsWith("image/");
  const size = formatSize(file?.size);

  return (
    <div className="community-post-attachments">
      {file && isImage && (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads are
        // served from cloud storage, which the Next image optimiser is not
        // configured for.
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="community-post-image">
          <img src={file.url} alt={file.name || "Attached image"} loading="lazy" />
        </a>
      )}

      {file && !isImage && (
        <a
          className="community-post-file"
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          download={file.name || undefined}
        >
          <span className="community-post-file-icon">
            <FileText size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <span className="community-post-file-meta">
            <strong>{file.name || "Attached document"}</strong>
            <small>
              {[file.content_type?.split("/").pop()?.toUpperCase(), size]
                .filter(Boolean)
                .join(" · ") || "Document"}
            </small>
          </span>
          <Paperclip size={15} strokeWidth={1.8} aria-hidden />
        </a>
      )}

      {link && (
        <a
          className="community-post-link"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="community-post-file-icon">
            {isImage ? (
              <ImageIcon size={18} strokeWidth={1.8} aria-hidden />
            ) : (
              <ExternalLink size={18} strokeWidth={1.8} aria-hidden />
            )}
          </span>
          <span className="community-post-file-meta">
            <strong>{displayLink(link)}</strong>
            <small>External resource</small>
          </span>
        </a>
      )}
    </div>
  );
}
