"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, authHeaders, friendlyError } from "@/lib/portal-api";
import type { PortalUser } from "@/lib/portal-types";

type ProjectFormData = {
  title: string;
  category: string;
  description: string;
  project_type: string;
  target_assignee: string[];
  required_skills: string;
  duration: string;
  deliverables: string;
  deadline: string;
  status: string;
};

const emptyForm: ProjectFormData = {
  title: "",
  category: "",
  description: "",
  project_type: "",
  target_assignee: [],
  required_skills: "",
  duration: "",
  deliverables: "",
  deadline: "",
  status: "Draft",
};

export default function CreateProject() {
  const [projectData, setProjectData] = useState<ProjectFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: "", text: "" });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/organizations/users`, { headers: authHeaders() });
      if (response.ok) {
        const data: PortalUser[] = await response.json();
        const allowedRoles = ["STUDENT", "FACULTY"];
        setUsers(data.filter((user) => allowedRoles.includes(user.role_key ?? "")));
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target;
    if (target.name === "target_assignee" && target instanceof HTMLSelectElement) {
      const values = Array.from(target.selectedOptions, (option) => option.value);
      setProjectData({ ...projectData, target_assignee: values });
    } else {
      setProjectData({ ...projectData, [target.name]: target.value });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const payload: Record<string, unknown> = { ...projectData, target_assignee: projectData.target_assignee.join(",") };

      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)),
      );

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(cleanPayload),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Project created successfully!" });
        setProjectData(emptyForm);
      } else {
        setMessage({ type: "error", text: data.detail || "Failed to create project" });
      }
    } catch (error) {
      setMessage({ type: "error", text: friendlyError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-header">
      <h3>Create New Project</h3>
      {message.text && (
        <div className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`}>{message.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Project Title *</label>
          <input type="text" name="title" value={projectData.title} onChange={handleChange} required className="form-control" />
        </div>

        <div className="form-group">
          <label>Category</label>
          <input
            type="text"
            name="category"
            value={projectData.category}
            onChange={handleChange}
            className="form-control"
            placeholder="e.g., Development, Research"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea name="description" value={projectData.description} onChange={handleChange} className="form-control" rows={3} />
        </div>

        <div className="grid-2-cols" style={{ gap: "15px" }}>
          <div className="form-group">
            <label>Project Type</label>
            <input type="text" name="project_type" value={projectData.project_type} onChange={handleChange} className="form-control" />
          </div>
          <div className="form-group">
            <label>Target Assignee (Hold Ctrl to Select Multiple)</label>
            <select
              name="target_assignee"
              value={projectData.target_assignee}
              onChange={handleChange}
              className="form-control"
              multiple
              style={{ height: "100px" }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role_key || "User"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Required Skills</label>
          <input
            type="text"
            name="required_skills"
            value={projectData.required_skills}
            onChange={handleChange}
            className="form-control"
            placeholder="Comma separated"
          />
        </div>

        <div className="grid-2-cols" style={{ gap: "15px" }}>
          <div className="form-group">
            <label>Duration</label>
            <input type="text" name="duration" value={projectData.duration} onChange={handleChange} className="form-control" />
          </div>
          <div className="form-group">
            <label>Deadline</label>
            <input type="date" name="deadline" value={projectData.deadline} onChange={handleChange} className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label>Deliverables</label>
          <textarea name="deliverables" value={projectData.deliverables} onChange={handleChange} className="form-control" rows={2} />
        </div>

        <div className="form-group">
          <label>Status</label>
          <select name="status" value={projectData.status} onChange={handleChange} className="form-control">
            <option value="Draft">Draft</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
