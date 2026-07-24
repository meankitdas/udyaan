"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RefreshCw, Send, Sparkles, User2 } from "lucide-react";
import Markdown from "./Markdown";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { AiChatResponse, AiMessage, AiStatus } from "@/lib/portal-types";

const SUGGESTIONS: Record<string, string[]> = {
  STUDENT: [
    "What should I work on next?",
    "Which of my action items are overdue?",
    "Who in my organization can help me with irrigation?",
    "Summarize the projects I'm assigned to",
  ],
  DEFAULT: [
    "How is my organization performing this month?",
    "Which projects are at risk of missing their deadline?",
    "Who are the top contributors right now?",
    "Which students have drone or data skills?",
  ],
};

/** Raw tool names are developer-speak; show what actually happened instead. */
const TOOL_LABELS: Record<string, string> = {
  search_workspace: "Searched your workspace",
  get_my_action_items: "Checked your action items",
  get_org_analytics: "Reviewed organization analytics",
  find_people: "Looked for people with matching skills",
};

export default function AiCopilot({ role = "DEFAULT" }: { role?: string }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexNote, setIndexNote] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const prompts = SUGGESTIONS[role] ?? SUGGESTIONS.DEFAULT;

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/ai/status`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;

    setError("");
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);

    try {
      const res = await apiFetch(`${API_BASE_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: q, history }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "The copilot could not answer that.");
      }
      const data: AiChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations, trace: data.trace },
      ]);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const reindex = async () => {
    setIndexing(true);
    setIndexNote("");
    try {
      const res = await apiFetch(`${API_BASE_URL}/ai/reindex`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setIndexNote(res.ok ? `Indexed ${data.indexed} items from your workspace.` : data.detail || "Indexing failed.");
    } catch (err) {
      setIndexNote(friendlyError(err));
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="ai-copilot">
      <div className="table-card ai-panel">
        <div className="ai-head">
          <div>
            <h4>
              <Sparkles size={18} strokeWidth={1.8} aria-hidden /> Udyaan Copilot
            </h4>
            <p>Grounded in your workspace — projects, tasks, meetings and people.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={reindex} disabled={indexing}>
            {indexing ? <Loader2 size={15} className="ai-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
            {indexing ? "Indexing..." : "Sync data"}
          </button>
        </div>

        {status && (
          <div className="ai-status">
            <span className="badge badge-gray">{status.retrieval}</span>
            <span className={`badge ${status.generation === "azure-openai" ? "badge-success" : "badge-warning"}`}>
              {status.generation === "azure-openai" ? "AI generation on" : "Retrieval-only mode"}
            </span>
          </div>
        )}
        {indexNote && <div className="alert alert-success">{indexNote}</div>}

        <div className="ai-thread">
          {messages.length === 0 && (
            <div className="ai-empty">
              <Bot size={30} strokeWidth={1.4} aria-hidden />
              <p>Ask anything about your work. Try one of these:</p>
              <div className="ai-suggestions">
                {prompts.map((p) => (
                  <button key={p} type="button" onClick={() => ask(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ai-msg-${m.role}`}>
              <span className="ai-avatar">
                {m.role === "user" ? <User2 size={15} aria-hidden /> : <Bot size={15} aria-hidden />}
              </span>
              <div className="ai-bubble">
                {m.role === "assistant" ? (
                  <Markdown content={m.content} />
                ) : (
                  <div className="ai-text">{m.content}</div>
                )}

                {!!m.citations?.length && (
                  <div className="ai-cites">
                    <span>Sources</span>
                    {m.citations.map((c) => (
                      <span key={`${c.kind}-${c.ref_id}`} className="badge badge-gray" title={`relevance ${c.score}`}>
                        {c.kind.replace("_", " ")}: {c.title}
                      </span>
                    ))}
                  </div>
                )}

                {!!m.trace?.length && (
                  <details className="ai-trace">
                    <summary>How I found this ({m.trace.length} step{m.trace.length > 1 ? "s" : ""})</summary>
                    <ol>
                      {m.trace.map((t, j) => {
                        const query = typeof t.args?.query === "string" ? t.args.query : null;
                        const skill = typeof t.args?.skill === "string" ? t.args.skill : null;
                        const detail = query ?? skill;
                        return (
                          <li key={j}>
                            {TOOL_LABELS[t.tool] ?? t.tool}
                            {detail && <em>&nbsp;— &ldquo;{detail}&rdquo;</em>}
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="ai-msg ai-msg-assistant">
              <span className="ai-avatar">
                <Bot size={15} aria-hidden />
              </span>
              <div className="ai-bubble ai-thinking">
                <Loader2 size={15} className="ai-spin" aria-hidden /> Searching your workspace…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form
          className="ai-composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            className="form-control"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your projects, tasks, team or deadlines…"
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>
            <Send size={15} strokeWidth={1.8} aria-hidden /> Ask
          </button>
        </form>
      </div>
    </div>
  );
}
