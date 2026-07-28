"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { uploadAttachment } from "@/lib/community-api";
import type { Attachment } from "@/lib/community-types";

type MessageComposerProps = {
  disabled?: boolean;
  onSend: (body: string, attachment: Attachment | null) => Promise<void>;
  onTyping?: () => void;
};

export default function MessageComposer({
  disabled = false,
  onSend,
  onTyping,
}: MessageComposerProps) {
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  // Grow with the text, but stop before the composer eats the thread.
  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
  }, [body]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      setAttachment(await uploadAttachment(file));
    } catch (err) {
      // Uploads are unavailable entirely when no bucket is configured, so this
      // must degrade to a clear message rather than a dead button.
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if ((!text && !attachment) || sending || disabled) return;

    setSending(true);
    setError(null);
    // Clear optimistically so typing can continue while the request is in
    // flight; restored below if the send fails.
    setBody("");
    setAttachment(null);
    try {
      await onSend(text, attachment);
    } catch (err) {
      setBody(text);
      setAttachment(attachment);
      setError(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line — the convention people expect
    // from every other chat client.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="community-msg-composer" onSubmit={submit}>
      {attachment && (
        <div className="community-msg-attachment">
          <Paperclip size={14} strokeWidth={2} aria-hidden />
          <span>{attachment.name}</span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
          >
            <X size={13} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      )}

      {error && <p className="community-inline-error">{error}</p>}

      <div className="community-msg-composer-row">
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || uploading}
          aria-label="Attach a file"
        >
          {uploading ? (
            <Loader2 size={17} className="community-spin" aria-hidden />
          ) : (
            <Paperclip size={17} strokeWidth={1.9} aria-hidden />
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={pickFile}
          accept="image/*,application/pdf"
        />

        <textarea
          ref={textarea}
          rows={1}
          value={body}
          disabled={disabled}
          onChange={(e) => {
            setBody(e.target.value);
            onTyping?.();
          }}
          onKeyDown={onKeyDown}
          placeholder={disabled ? "You can't reply to this conversation" : "Write a message…"}
          maxLength={5000}
          aria-label="Message"
        />

        <button
          type="submit"
          className="community-btn primary community-msg-send"
          disabled={disabled || sending || (!body.trim() && !attachment)}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 size={16} className="community-spin" aria-hidden />
          ) : (
            <Send size={16} strokeWidth={1.9} aria-hidden />
          )}
        </button>
      </div>
    </form>
  );
}
