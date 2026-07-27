"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Maximize2, PanelTop, Trash2, X } from "lucide-react";
import ToolLogo from "./ToolLogo";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { ProjectTool, ProjectToolStatus } from "@/lib/portal-types";

/** Tools we actively recommend, and what each one is genuinely good at. */
const TOOL_CATALOG = [
  { key: "notion", name: "Notion", tagline: "Docs, wiki & task database", best: "Project brief, meeting notes, task board" },
  { key: "miro", name: "Miro", tagline: "Collaborative whiteboard", best: "Ideation, journey maps, retrospectives" },
  { key: "trello", name: "Trello", tagline: "Simple kanban boards", best: "Lightweight weekly task tracking" },
  { key: "jira", name: "Jira", tagline: "Issue & sprint tracking", best: "Engineering delivery with sprints" },
  { key: "figma", name: "Figma", tagline: "Design & prototyping", best: "UI mockups and design reviews" },
  { key: "github", name: "GitHub Projects", tagline: "Code-linked issue tracking", best: "Repo work items and reviews" },
  { key: "drive", name: "Google Drive", tagline: "Shared file storage", best: "Reports, datasets and decks" },
  { key: "slack", name: "Slack", tagline: "Team communication", best: "Stand-ups and quick decisions" },
] as const;

const STATUS_BADGE: Record<ProjectToolStatus, string> = {
  Approved: "badge-success",
  Proposed: "badge-warning",
  Declined: "badge-gray",
};

/** Only ever link out to real web URLs — never javascript:/data: from stored input. */
function isSafeUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function workspaceEmbedUrl(tool: ProjectTool): string | null {
  if (!isSafeUrl(tool.url)) return null;
  const url = new URL(tool.url as string);
  const host = url.hostname.toLowerCase();

  if (tool.tool_key === "miro") {
    if (host !== "miro.com" && !host.endsWith(".miro.com")) return null;
    const match = url.pathname.match(/^\/app\/(?:board|live-embed)\/([^/]+)/);
    if (!match || !/^uXjV[A-Za-z0-9_=-]{8,}$/.test(match[1])) return null;
    const embed = new URL(`https://miro.com/app/live-embed/${match[1]}/`);
    embed.searchParams.set("embedMode", "view_only_without_ui");
    embed.searchParams.set("embedAutoplay", "true");
    return embed.toString();
  }

  if (tool.tool_key === "notion") {
    const allowed =
      host === "notion.so" ||
      host.endsWith(".notion.so") ||
      host === "notion.site" ||
      host.endsWith(".notion.site") ||
      host === "notion.com" ||
      host.endsWith(".notion.com");
    return allowed ? url.toString() : null;
  }

  return null;
}

type Props = {
  projectId: string;
  /** Faculty, admins and project heads decide what the project officially runs on. */
  canReview: boolean;
  currentUserId?: string;
};

export default function ProjectTools({ projectId, canReview, currentUserId }: Props) {
  const [tools, setTools] = useState<ProjectTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ tool_key: "notion", name: "", url: "", purpose: "" });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [embedLoaded, setEmbedLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/tools`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Could not load the project's tools.");
      setTools(await res.json());
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(
    () => ({
      Approved: tools.filter((t) => t.status === "Approved"),
      Proposed: tools.filter((t) => t.status === "Proposed"),
      Declined: tools.filter((t) => t.status === "Declined"),
    }),
    [tools],
  );

  const embeddedTools = useMemo(
    () => grouped.Approved.filter((tool) => workspaceEmbedUrl(tool)),
    [grouped.Approved],
  );
  const activeWorkspace =
    embeddedTools.find((tool) => tool.id === activeWorkspaceId) ?? embeddedTools[0] ?? null;

  useEffect(() => {
    if (!activeWorkspaceId && embeddedTools[0]) setActiveWorkspaceId(embeddedTools[0].id);
    if (activeWorkspaceId && !embeddedTools.some((tool) => tool.id === activeWorkspaceId)) {
      setActiveWorkspaceId(embeddedTools[0]?.id ?? null);
    }
  }, [activeWorkspaceId, embeddedTools]);

  const propose = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (form.url.trim() && !isSafeUrl(form.url.trim())) {
      setError("Workspace link must be a full http:// or https:// URL.");
      return;
    }
    if (["notion", "miro"].includes(form.tool_key) && !form.url.trim()) {
      setError("Notion and Miro require a shared workspace URL so they can be embedded.");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          tool_key: form.tool_key,
          name: form.name.trim(),
          url: form.url.trim() || null,
          purpose: form.purpose.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not save this proposal.");

      setForm({ tool_key: form.tool_key, name: "", url: "", purpose: "" });
      setNotice(canReview ? "Tool proposed. Approve it to make it official." : "Proposal sent for review.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (toolId: string, status: Exclude<ProjectToolStatus, "Proposed">) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/project-tools/${toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not update this proposal.");
      }
      setNotice(status === "Approved" ? "Tool approved for this project." : "Proposal declined.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const remove = async (toolId: string) => {
    if (!confirm("Remove this tool from the project?")) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/project-tools/${toolId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Could not remove this tool.");
      }
      setNotice("Tool removed.");
      setError("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const renderGroup = (title: string, hint: string, items: ProjectTool[]) => (
    <div className="table-card" key={title}>
      <h4
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--dark-green)",
          marginBottom: "4px",
        }}
      >
        {title}
      </h4>
      <p style={{ color: "var(--text-light)", fontSize: "0.85rem", margin: "0 0 16px" }}>{hint}</p>

      {items.length === 0 ? (
        <p style={{ color: "#999", margin: 0, fontSize: "0.9rem" }}>Nothing here yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((tool) => {
            const catalog = TOOL_CATALOG.find((c) => c.key === tool.tool_key);
            const canRemove = canReview || tool.proposed_by === currentUserId;
            return (
              <div
                key={tool.id}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "14px",
                  border: "1px solid #eee",
                  borderRadius: "10px",
                  backgroundColor: "#fbfbf9",
                }}
              >
                <span className="portal-tool-mark">
                  <ToolLogo toolKey={tool.tool_key} size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--dark-green)" }}>{tool.name}</strong>
                    <span className={`badge ${STATUS_BADGE[tool.status]}`}>{tool.status}</span>
                    <span style={{ color: "var(--text-light)", fontSize: "0.8rem" }}>
                      {catalog?.name ?? tool.tool_key}
                    </span>
                  </div>

                  {tool.purpose && (
                    <p style={{ margin: "8px 0 0", color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {tool.purpose}
                    </p>
                  )}

                  <div style={{ marginTop: "8px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                    {tool.status === "Approved" && workspaceEmbedUrl(tool) && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => {
                          setEmbedLoaded(false);
                          setActiveWorkspaceId(tool.id);
                          document.getElementById("embedded-workspace")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                      >
                        <PanelTop size={14} aria-hidden /> Open in dashboard
                      </button>
                    )}
                    <span style={{ color: "var(--text-light)", fontSize: "0.8rem" }}>
                      Proposed by {tool.proposed_by_name || "a team member"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {canReview && tool.status !== "Approved" && (
                    <button type="button" className="btn-primary" onClick={() => decide(tool.id, "Approved")}>
                      <Check size={14} aria-hidden /> Approve
                    </button>
                  )}
                  {canReview && tool.status === "Proposed" && (
                    <button type="button" className="btn-secondary" onClick={() => decide(tool.id, "Declined")}>
                      <X size={14} aria-hidden /> Decline
                    </button>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => remove(tool.id)}
                      aria-label={`Remove ${tool.name}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (loading) return <div>Loading tools...</div>;

  return (
    <div className="portal-tools" style={{ display: "grid", gap: "24px" }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      {activeWorkspace && (
        <section id="embedded-workspace" className="table-card portal-tool-embed">
          <div className="portal-tool-embed-head">
            <div>
              <span className="portal-tool-eyebrow">Embedded workspace</span>
              <h4>{activeWorkspace.name}</h4>
              <p>
                {activeWorkspace.tool_key === "miro"
                  ? "Collaborate on the project board without leaving Udyaan."
                  : "View the project's published Notion workspace inside Udyaan."}
              </p>
            </div>
            <div className="portal-tool-tabs" aria-label="Connected workspaces">
              {embeddedTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={tool.id === activeWorkspace.id ? "is-active" : ""}
                  onClick={() => {
                    setEmbedLoaded(false);
                    setActiveWorkspaceId(tool.id);
                  }}
                >
                  <ToolLogo toolKey={tool.tool_key} size={15} />
                  {TOOL_CATALOG.find((entry) => entry.key === tool.tool_key)?.name ?? tool.name}
                </button>
              ))}
            </div>
          </div>

          <div className="portal-tool-frame">
            {!embedLoaded && (
              <div className="portal-tool-loading">
                <strong>Loading {activeWorkspace.tool_key === "miro" ? "Miro board" : "Notion page"}...</strong>
                <span>
                  {activeWorkspace.tool_key === "miro"
                    ? "The board must allow viewing for everyone with the link."
                    : "The page must be published using Notion's Share to web option."}
                </span>
              </div>
            )}
            <iframe
              key={activeWorkspace.id}
              title={`${activeWorkspace.name} embedded workspace`}
              src={workspaceEmbedUrl(activeWorkspace) as string}
              loading="eager"
              allow="clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setEmbedLoaded(true)}
            />
          </div>

          <div className="portal-tool-embed-note">
            <Maximize2 size={14} aria-hidden />
            {activeWorkspace.tool_key === "notion"
              ? "Notion must be published to the web. Private pages require a Notion OAuth/API connection."
              : "Miro uses its secure live-embed view; board permissions still apply."}
          </div>
        </section>
      )}

      <div className="table-card">
        <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--dark-green)", marginBottom: "4px" }}>
          Recommended project management tools
        </h4>
        <p style={{ color: "var(--text-light)", fontSize: "0.85rem", margin: "0 0 16px" }}>
          Pick a tool to propose it for this project. Faculty or the project head approves what the team officially runs on.
        </p>

        <div className="grid-auto-fit">
          {TOOL_CATALOG.map((tool) => {
            const connected = grouped.Approved.some((t) => t.tool_key === tool.key);
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, tool_key: tool.key, name: prev.name || `${tool.name} workspace` }))}
                className={`portal-tool-pick${form.tool_key === tool.key ? " is-selected" : ""}`}
              >
                <div className="portal-tool-pick-head">
                  <span className="portal-tool-mark">
                    <ToolLogo toolKey={tool.key} size={20} />
                  </span>
                  <strong>{tool.name}</strong>
                  {connected && <span className="badge badge-success">Connected</span>}
                </div>
                <div className="portal-tool-pick-tagline">{tool.tagline}</div>
                <div className="portal-tool-pick-best">Best for: {tool.best}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="table-card">
        <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--dark-green)", marginBottom: "16px" }}>
          Propose a workspace
        </h4>
        <form onSubmit={propose}>
          <div className="grid-2-cols" style={{ gap: "15px" }}>
            <div className="form-group">
              <label>Tool *</label>
              <select
                className="form-control"
                value={form.tool_key}
                onChange={(e) => setForm({ ...form, tool_key: e.target.value })}
              >
                {TOOL_CATALOG.map((tool) => (
                  <option key={tool.key} value={tool.key}>
                    {tool.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Workspace name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sprint board"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Workspace link</label>
            <input
              type="url"
              className="form-control"
              required={["notion", "miro"].includes(form.tool_key)}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://www.notion.so/..."
            />
          </div>

          <div className="form-group">
            <label>How the team will use it</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g. Weekly task board and meeting notes for all members"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Propose tool"}
          </button>
        </form>
      </div>

      {renderGroup("Connected tools", "Approved workspaces this project officially runs on.", grouped.Approved)}
      {renderGroup("Awaiting review", "Proposals waiting on faculty or the project head.", grouped.Proposed)}
      {grouped.Declined.length > 0 && renderGroup("Declined", "Proposals the reviewers did not approve.", grouped.Declined)}
    </div>
  );
}
