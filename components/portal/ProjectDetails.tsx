"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import ProjectImpact from "./ProjectImpact";
import ProjectTools from "./ProjectTools";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError, getToken, roleHome } from "@/lib/portal-api";
import type { ActionItem, Meeting, NavItem, Profile, Project } from "@/lib/portal-types";

export default function ProjectDetails() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [summarizing, setSummarizing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const profileRes = await apiFetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
      if (profileRes.ok) {
        setProfile(await profileRes.json());
      } else {
        throw new Error("Failed to fetch profile");
      }

      const projectRes = await apiFetch(`${API_BASE_URL}/projects/${id}`, { headers: authHeaders() });
      if (projectRes.ok) {
        setProject(await projectRes.json());
      } else {
        throw new Error("Failed to fetch project details");
      }

      const meetingsRes = await apiFetch(`${API_BASE_URL}/projects/${id}/meetings`, { headers: authHeaders() });
      if (meetingsRes.ok) setMeetings(await meetingsRes.json());

      const actionsRes = await apiFetch(`${API_BASE_URL}/projects/${id}/action-items`, { headers: authHeaders() });
      if (actionsRes.ok) setActions(await actionsRes.json());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = () => {
    if (!profile) return "User";
    if (profile.role_key === "SUPERADMIN") return "Super Admin";
    if (profile.role_key === "ADMIN") return "Organization Admin";
    if (profile.role_key === "PROJECT_HEAD") return "Project Head";
    if (profile.role_key === "FACULTY") return "Faculty";
    if (profile.role_key === "STUDENT") return "Student";
    return "User";
  };

  const getNavItems = (): NavItem[] => [
    { id: "dashboard", label: "Back to Dashboard" },
    { id: "overview", label: "Project Overview" },
    { id: "meetings", label: "Minutes of Meeting" },
    { id: "actions", label: "Action Taken Report" },
    { id: "impact", label: "Impact Chain" },
    { id: "tools", label: "Workspace Tools" },
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === "dashboard") {
      const role = profile?.role_key;
      router.push((role && roleHome[role]) || "/");
    } else {
      setActiveTab(tabId);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const meetingData = {
      title: formData.get("title"),
      meeting_date: formData.get("meeting_date"),
      agenda: formData.get("agenda"),
      attendees: formData.get("attendees"),
    };

    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(meetingData),
      });
      if (res.ok) {
        alert("Meeting scheduled!");
        setShowMeetingModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.detail || "Failed to schedule meeting");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleSummarizeMoM = async (meetingId: string) => {
    const notes = prompt("Paste raw meeting notes — AI will turn them into structured minutes:");
    if (!notes) return;

    setSummarizing(meetingId);
    try {
      const res = await apiFetch(`${API_BASE_URL}/ai/meeting-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ notes, meeting_id: meetingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not summarize these notes.");

      const lines = [data.summary ?? ""];
      if (data.decisions?.length) lines.push("", "Decisions:", ...data.decisions.map((d: string) => `• ${d}`));
      if (data.action_items?.length) {
        lines.push("", "Action items:");
        for (const a of data.action_items) {
          lines.push(`• ${a.title}${a.owner ? ` — ${a.owner}` : ""}${a.due_hint ? ` (${a.due_hint})` : ""}${a.urgency ? ` [${a.urgency}]` : ""}`);
        }
      }
      if (data.risks?.length) lines.push("", "Risks:", ...data.risks.map((r: string) => `• ${r}`));
      const draft = lines.join("\n").trim();

      if (!window.confirm(`AI drafted these minutes:\n\n${draft}\n\nSave them to this meeting?`)) return;

      const save = await apiFetch(`${API_BASE_URL}/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mom_content: draft }),
      });
      if (save.ok) fetchData();
      else alert("Failed to save the minutes.");
    } catch (err) {
      alert(friendlyError(err));
    } finally {
      setSummarizing(null);
    }
  };

  const handleAddMoM = async (meetingId: string) => {
    const momContent = prompt("Enter Minutes of Meeting:");
    if (!momContent) return;

    try {
      const res = await apiFetch(`${API_BASE_URL}/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mom_content: momContent }),
      });
      if (res.ok) {
        alert("MoM updated!");
        fetchData();
      } else {
        alert("Failed to update MoM");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleCreateAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const actionData = {
      title: formData.get("title"),
      description: formData.get("description"),
      assigned_to: formData.get("assigned_to"),
      due_date: formData.get("due_date"),
      urgency: formData.get("urgency"),
    };

    try {
      const res = await apiFetch(`${API_BASE_URL}/projects/${id}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(actionData),
      });
      if (res.ok) {
        alert("Action Item assigned!");
        setShowActionModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.detail || "Failed to assign action");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleUpdateActionStatus = async (actionId: string, newStatus: string) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/action-items/${actionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to update status");
      }
    } catch {
      alert("Network error");
    }
  };

  const canManage = ["FACULTY", "ADMIN", "PROJECT_HEAD"].includes(profile?.role_key ?? "");

  const renderOverview = () =>
    project && (
      <div style={{ display: "grid", gap: "24px" }}>
        <div className="table-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--dark-green)", margin: "0 0 8px 0" }}>{project.title}</h2>
            <p style={{ color: "var(--text-light)", margin: 0 }}>Project ID: {project.id}</p>
          </div>
          <span
            className={`badge ${
              project.status === "Completed" ? "badge-success" : project.status === "In Progress" ? "badge-warning" : "badge-gray"
            }`}
            style={{ fontSize: "1rem", padding: "8px 16px" }}
          >
            {project.status}
          </span>
        </div>

        <div className="grid-auto-fit">
          <div className="table-card" style={{ padding: "20px" }}>
            <div style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "8px" }}>Category</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--dark-green)" }}>{project.category}</div>
          </div>
          <div className="table-card" style={{ padding: "20px" }}>
            <div style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "8px" }}>Deadline</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--error-red)" }}>
              {project.deadline ? new Date(project.deadline).toLocaleDateString() : "-"}
            </div>
          </div>
          <div className="table-card" style={{ padding: "20px" }}>
            <div style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "8px" }}>Team Size</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--primary-green)" }}>
              {project.assignees_details ? project.assignees_details.length : 0} Members
            </div>
          </div>
        </div>

        <div className="grid-split-2-1">
          <div className="table-card">
            <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--dark-green)", marginBottom: "16px", borderBottom: "1px solid #eee", paddingBottom: "12px" }}>
              Description & Requirements
            </h4>

            <div style={{ marginBottom: "24px" }}>
              <h5 style={{ fontSize: "0.9rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Description</h5>
              <p style={{ lineHeight: "1.6", color: "#4b5563", marginTop: "8px" }}>{project.description}</p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h5 style={{ fontSize: "0.9rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Key Deliverables</h5>
              <p style={{ lineHeight: "1.6", color: "#4b5563", marginTop: "8px" }}>{project.deliverables || "No specific deliverables listed."}</p>
            </div>

            <div>
              <h5 style={{ fontSize: "0.9rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Required Skills</h5>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                {project.required_skills ? (
                  project.required_skills.split(",").map((skill, i) => (
                    <span
                      key={i}
                      style={{ padding: "4px 12px", backgroundColor: "#f3f4f6", color: "#374151", borderRadius: "20px", fontSize: "0.85rem" }}
                    >
                      {skill.trim()}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#999" }}>None specified</span>
                )}
              </div>
            </div>
          </div>

          <div className="table-card">
            <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--dark-green)", marginBottom: "16px", borderBottom: "1px solid #eee", paddingBottom: "12px" }}>
              Assigned Team
            </h4>
            {project.assignees_details && project.assignees_details.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {project.assignees_details.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        backgroundColor: "var(--primary-green)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.9rem",
                        fontWeight: "bold",
                      }}
                    >
                      {u.full_name.charAt(0)}
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.full_name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#999" }}>
                <p>No students assigned yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );

  const renderMeetings = () => (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>Minutes of Meetings</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>Record and track project meetings</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowMeetingModal(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden /> Schedule Meeting
          </button>
        )}
      </div>

      {showMeetingModal && (
        <div style={{ margin: "0 0 24px 0", padding: "24px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px solid #eee" }}>
          <h4 style={{ marginTop: 0, marginBottom: "16px" }}>Schedule New Meeting</h4>
          <form onSubmit={handleCreateMeeting}>
            <div className="grid-2-cols" style={{ gap: "16px", marginBottom: "16px" }}>
              <input name="title" className="form-control" placeholder="Meeting Title" required />
              <input name="meeting_date" type="datetime-local" className="form-control" required style={{ fontFamily: "inherit" }} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <textarea name="agenda" className="form-control" placeholder="Agenda" rows={3} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <input name="attendees" className="form-control" placeholder="Attendees (e.g. John, Jane)" />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" className="btn-primary">
                Schedule Meeting
              </button>
              <button type="button" onClick={() => setShowMeetingModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {meetings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No meetings recorded.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {meetings.map((m) => (
            <div key={m.id} style={{ border: "1px solid #eee", borderRadius: "12px", padding: "20px", backgroundColor: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <h5 style={{ margin: 0, fontSize: "1.1rem", color: "var(--dark-green)" }}>{m.title}</h5>
                <small style={{ color: "var(--text-light)" }}>{new Date(m.meeting_date).toLocaleString()}</small>
              </div>
              <p style={{ margin: "0 0 16px 0", color: "#4b5563" }}>
                <strong>Agenda:</strong> {m.agenda || "N/A"}
              </p>

              <div style={{ padding: "16px", backgroundColor: "#f3f4f6", borderRadius: "8px", borderLeft: "4px solid var(--primary-green)" }}>
                <strong style={{ display: "block", marginBottom: "8px", color: "var(--dark-green)" }}>Minutes of Meeting (MoM)</strong>
                <div style={{ whiteSpace: "pre-wrap", color: "#374151" }}>
                  {m.mom_content || <em style={{ color: "#999" }}>Not yet recorded.</em>}
                </div>
              </div>

              {canManage && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  <button
                    className="btn-link"
                    style={{ marginTop: "12px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => handleAddMoM(m.id)}
                  >
                    <Pencil size={15} strokeWidth={1.8} aria-hidden /> {m.mom_content ? "Edit MoM" : "Add MoM"}
                  </button>
                  <button
                    className="btn-link"
                    style={{ marginTop: "12px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => handleSummarizeMoM(m.id)}
                    disabled={summarizing === m.id}
                  >
                    <Sparkles size={15} strokeWidth={1.8} aria-hidden />{" "}
                    {summarizing === m.id ? "Summarizing…" : "Summarize with AI"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActions = () => (
    <div className="table-card">
      <div className="list-header">
        <div>
          <h3>Action Taken Reports</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: "4px" }}>Track tasks and action items</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setShowActionModal(true)}>
            <Plus size={16} strokeWidth={2} aria-hidden /> Add Action Item
          </button>
        )}
      </div>

      {showActionModal && (
        <div style={{ margin: "0 0 24px 0", padding: "24px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px solid #eee" }}>
          <h4 style={{ marginTop: 0, marginBottom: "16px" }}>Assign Action Item</h4>
          <form onSubmit={handleCreateAction}>
            <div className="grid-2-cols" style={{ gap: "16px", marginBottom: "16px" }}>
              <input name="title" className="form-control" placeholder="Action Title" required />
              <select name="urgency" className="form-control">
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical Priority</option>
              </select>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <textarea name="description" className="form-control" placeholder="Description" rows={2} />
            </div>
            <div className="grid-2-cols" style={{ gap: "16px", marginBottom: "16px" }}>
              <input name="assigned_to" className="form-control" placeholder="Assignee ID (Copy from Team)" required />
              <input name="due_date" type="date" className="form-control" required style={{ fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button type="submit" className="btn-primary">
                Assign Action
              </button>
              <button type="button" onClick={() => setShowActionModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {actions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          <p>No action items found.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Assigned To</th>
                <th>Urgency</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600, color: "var(--dark-green)" }}>{a.title}</td>
                  <td style={{ maxWidth: "300px", whiteSpace: "normal" }}>{a.description}</td>
                  <td>
                    <span className="badge badge-gray">{a.assigned_to.substring(0, 8)}...</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        a.urgency === "Critical"
                          ? "badge-danger"
                          : a.urgency === "High"
                            ? "badge-warning"
                            : a.urgency === "Medium"
                              ? "badge-gray"
                              : "badge-success"
                      }`}
                    >
                      {a.urgency}
                    </span>
                  </td>
                  <td>{a.due_date}</td>
                  <td>
                    <select
                      value={a.status}
                      onChange={(e) => handleUpdateActionStatus(a.id, e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #ddd", backgroundColor: "white", fontSize: "0.9rem" }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      title="Project Details"
      navItems={getNavItems()}
      sidebarTitle={getRoleLabel() + " Portal"}
      userRole={getRoleLabel()}
    >
      {activeTab === "overview" && renderOverview()}
      {activeTab === "meetings" && renderMeetings()}
      {activeTab === "actions" && renderActions()}
      {activeTab === "impact" && id && (
        <ProjectImpact projectId={id} canReview={canManage} currentUserId={profile?.id} />
      )}
      {activeTab === "tools" && id && (
        <ProjectTools projectId={id} canReview={canManage} currentUserId={profile?.id} />
      )}
    </DashboardLayout>
  );
}
