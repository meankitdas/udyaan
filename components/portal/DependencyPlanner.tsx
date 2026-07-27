"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { AlertTriangle, GitBranch, Link2, Trash2 } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { DependencyGraph, DependencyNode } from "@/lib/portal-types";

const NODE_W = 238;
const NODE_H = 112;
const COL_GAP = 90;
const ROW_GAP = 34;

/**
 * Deterministic left-to-right layout. Depth is the longest prerequisite chain
 * ending at a node, so parallel work aligns in a column and the critical
 * sequence reads naturally without persisting display coordinates.
 */
function layout(graph: DependencyGraph): { nodes: Node[]; edges: Edge[] } {
  const prereqs = new Map(graph.nodes.map((n) => [n.id, n.prerequisite_ids]));
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const parents = prereqs.get(id) ?? [];
    const value = parents.length ? Math.max(...parents.map(depth)) + 1 : 0;
    memo.set(id, value);
    return value;
  };

  const rows = new Map<number, number>();
  const sorted = [...graph.nodes].sort((a, b) => depth(a.id) - depth(b.id) || a.due_date.localeCompare(b.due_date));
  const nodes: Node[] = sorted.map((item) => {
    const col = depth(item.id);
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    return {
      id: item.id,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: col * (NODE_W + COL_GAP), y: row * (NODE_H + ROW_GAP) },
      style: { width: NODE_W, height: NODE_H },
      className: `portal-dep-node${item.blocked ? " is-blocked" : ""}${item.ready ? " is-ready" : ""}${item.status === "Completed" ? " is-done" : ""}${item.on_critical_path ? " is-critical" : ""}`,
      data: {
        label: (
          <div className="portal-dep-node-content">
            <span>{item.on_critical_path ? "Critical path" : item.blocked ? "Blocked" : item.ready ? "Ready" : item.status}</span>
            <strong>{item.title}</strong>
            <small>{item.assigned_to_name ?? item.assigned_to} · due {new Date(item.due_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</small>
          </div>
        ),
      },
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.depends_on_id,
    target: edge.action_id,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#75758a" },
    style: {
      stroke: graph.critical_path.includes(edge.depends_on_id) && graph.critical_path.includes(edge.action_id)
        ? "#17171c"
        : "#a8a8b2",
      strokeWidth: graph.critical_path.includes(edge.depends_on_id) && graph.critical_path.includes(edge.action_id) ? 2 : 1.2,
    },
  }));
  return { nodes, edges };
}

type Props = { projectId: string; canManage: boolean };

export default function DependencyPlanner({ projectId, canManage }: Props) {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [actionId, setActionId] = useState("");
  const [prerequisiteId, setPrerequisiteId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${projectId}/dependency-graph`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not load action dependencies.");
      setGraph(data);
      setError("");
    } catch (err) {
      setError(friendlyError(err));
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const flow = useMemo(() => (graph ? layout(graph) : { nodes: [], edges: [] }), [graph]);
  const byId = useMemo(() => new Map(graph?.nodes.map((n) => [n.id, n]) ?? []), [graph]);
  const availablePrerequisites = (graph?.nodes ?? []).filter(
    (node) => node.id !== actionId && !node.dependent_ids.includes(actionId),
  );

  const add = async () => {
    if (!actionId || !prerequisiteId) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/action-items/${actionId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ depends_on_id: prerequisiteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not add this dependency.");
      setNotice("Dependency added.");
      setError("");
      setActionId("");
      setPrerequisiteId("");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (edgeId: string) => {
    const res = await apiFetch(`${API_BASE_URL}/action-dependencies/${edgeId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.detail || "Could not remove this dependency.");
      return;
    }
    setNotice("Dependency removed.");
    await load();
  };

  if (!graph) return <div>Loading dependency planner...</div>;

  return (
    <div className="portal-dep" style={{ display: "grid", gap: 24 }}>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && !error && <div className="alert alert-success">{notice}</div>}

      <section className="table-card">
        <div className="portal-dep-head">
          <div>
            <span className="portal-dep-eyebrow"><GitBranch size={13} aria-hidden /> Work graph</span>
            <h4>Dependencies & critical path</h4>
            <p>See what can start, what is waiting, and the longest sequence controlling delivery.</p>
          </div>
          <div className="portal-dep-stats">
            <span><strong>{graph.ready_count}</strong> ready</span>
            <span><strong>{graph.blocked_count}</strong> blocked</span>
            <span><strong>{graph.overdue_count}</strong> overdue</span>
          </div>
        </div>

        {graph.nodes.length === 0 ? (
          <p className="portal-dep-empty">Create action items first; they will appear here automatically.</p>
        ) : (
          <div className="portal-dep-canvas">
            <ReactFlow
              nodes={flow.nodes}
              edges={flow.edges}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.35}
              maxZoom={1.35}
              nodesDraggable={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d9d9dd" />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => node.className?.includes("is-blocked") ? "#ff7759" : node.className?.includes("is-done") ? "#a8a8b2" : "#003c33"}
                maskColor="rgba(238,236,231,.68)"
              />
            </ReactFlow>
          </div>
        )}
      </section>

      {canManage && (
      <section className="table-card">
        <div className="portal-dep-head">
          <div><h4>Add dependency</h4><p>Choose the work that must wait, then what it is waiting for. Cycles are rejected.</p></div>
        </div>
        <div className="portal-dep-form">
          <label><span>Action that must wait</span><select className="form-control" value={actionId} onChange={(e) => { setActionId(e.target.value); setPrerequisiteId(""); }}><option value="">Select action</option>{graph.nodes.filter((n) => n.status !== "Completed").map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
          <span className="portal-dep-arrow">waits for</span>
          <label><span>Prerequisite</span><select className="form-control" value={prerequisiteId} onChange={(e) => setPrerequisiteId(e.target.value)} disabled={!actionId}><option value="">Select prerequisite</option>{availablePrerequisites.map((n) => <option key={n.id} value={n.id}>{n.title}{n.status === "Completed" ? " (done)" : ""}</option>)}</select></label>
          <button type="button" className="btn-primary" onClick={add} disabled={saving || !actionId || !prerequisiteId}><Link2 size={14} aria-hidden /> {saving ? "Adding..." : "Add"}</button>
        </div>
      </section>
      )}

      {graph.edges.length > 0 && (
        <section className="table-card">
          <div className="portal-dep-head"><div><h4>Dependency rules</h4><p>The exact edges behind the visual graph.</p></div></div>
          <ol className="portal-dep-rules">
            {graph.edges.map((edge) => {
              const action: DependencyNode | undefined = byId.get(edge.action_id);
              const prerequisite: DependencyNode | undefined = byId.get(edge.depends_on_id);
              return (
                <li key={edge.id}>
                  <AlertTriangle size={14} aria-hidden />
                  <span><strong>{action?.title}</strong> waits for <strong>{prerequisite?.title}</strong></span>
                  {canManage && <button type="button" onClick={() => remove(edge.id)} aria-label={`Remove dependency for ${action?.title}`}><Trash2 size={14} aria-hidden /></button>}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
