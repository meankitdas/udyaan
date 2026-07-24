"use client";

import { type ReactNode } from "react";

/**
 * Minimal markdown renderer for LLM output.
 *
 * Deliberately builds React elements instead of using dangerouslySetInnerHTML:
 * this content is model-generated from workspace data, so injecting raw HTML
 * would be an XSS vector. Anything not recognised stays literal text.
 */

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}

type ListItem = { text: string; depth: number };

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: ListItem[] }
  | { type: "ol"; items: ListItem[] }
  | { type: "h"; level: number; text: string };

/** Two spaces per level, which is what the models emit. */
function depthOf(raw: string): number {
  const leading = raw.length - raw.trimStart().length;
  return Math.min(Math.floor(leading / 2), 3);
}

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const previous = blocks[blocks.length - 1];

    if (!trimmed) {
      // Blank line closes the current block.
      if (previous && previous.type === "p") blocks.push({ type: "p", lines: [] });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length, text: heading[2] });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      const item = { text: bullet[1], depth: depthOf(line) };
      if (previous && previous.type === "ul") previous.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      const item = { text: ordered[1], depth: depthOf(line) };
      if (previous && previous.type === "ol") previous.items.push(item);
      else blocks.push({ type: "ol", items: [item] });
      continue;
    }

    if (previous && previous.type === "p" && previous.lines.length) previous.lines.push(trimmed);
    else blocks.push({ type: "p", lines: [trimmed] });
  }

  return blocks.filter((b) => (b.type === "p" ? b.lines.length > 0 : true));
}

/** Render a flat, indentation-tagged item list as a nested list. */
function renderList(items: ListItem[], ordered: boolean, keyPrefix: string, start = 0, depth = 0): ReactNode {
  const Tag = ordered ? "ol" : "ul";
  const nodes: ReactNode[] = [];
  let i = start;

  while (i < items.length && items[i].depth >= depth) {
    if (items[i].depth > depth) {
      i++; // Consumed by the recursive call below.
      continue;
    }

    const key = `${keyPrefix}-${i}`;
    const current = items[i];

    // Collect any deeper items that belong to this one.
    let j = i + 1;
    while (j < items.length && items[j].depth > depth) j++;
    const children = j > i + 1 ? renderList(items, ordered, key, i + 1, depth + 1) : null;

    nodes.push(
      <li key={key}>
        {renderInline(current.text, key)}
        {children}
      </li>,
    );
    i = j;
  }

  return <Tag key={`${keyPrefix}-list-${depth}`}>{nodes}</Tag>;
}

export default function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content ?? "");

  return (
    <div className="md">
      {blocks.map((block, index) => {
        const key = `b${index}`;

        if (block.type === "h") {
          const Tag = (["h4", "h4", "h5", "h6"][block.level - 1] ?? "h6") as "h4" | "h5" | "h6";
          return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
        }

        if (block.type === "ul") {
          return <div key={key}>{renderList(block.items, false, key)}</div>;
        }

        if (block.type === "ol") {
          return <div key={key}>{renderList(block.items, true, key)}</div>;
        }

        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              <span key={`${key}-${j}`}>
                {j > 0 && <br />}
                {renderInline(line, `${key}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
