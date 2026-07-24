"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { Project } from "@/lib/portal-types";

export default function CreateReport({ role }: { role: "student" | "faculty" }) {
  const [form, setForm] = useState({ title: "", content: "", project_id: "", target_id: "" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string }>({ type: "", text: "" });

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/projects`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(data))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    const endpoint = role === "student" ? `${API_BASE_URL}/reports/student` : `${API_BASE_URL}/reports/faculty`;
    const payload: Record<string, string> = { title: form.title, content: form.content, project_id: form.project_id };
    if (role === "student") payload.faculty_id = form.target_id;
    else payload.project_head_id = form.target_id;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Report submitted successfully!" });
        setForm({ title: "", content: "", project_id: "", target_id: "" });
      } else {
        setMessage({ type: "error", text: data.detail || "Failed to submit report" });
      }
    } catch (err) {
      setMessage({ type: "error", text: friendlyError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-header">
      <h3>Submit {role === "student" ? "Student" : "Faculty"} Report</h3>
      {message.text && (
        <div className={`alert ${message.type === "error" ? "alert-danger" : "alert-success"}`}>{message.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Report Title</label>
          <input type="text" name="title" value={form.title} onChange={handleChange} required className="form-control" />
        </div>

        <div className="form-group">
          <label>Content</label>
          <textarea name="content" value={form.content} onChange={handleChange} required className="form-control" rows={4} />
        </div>

        <div className="form-group">
          <label>Project</label>
          <select name="project_id" value={form.project_id} onChange={handleChange} required className="form-control">
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{role === "student" ? "Faculty ID" : "Project Head ID"}</label>
          <input
            type="text"
            name="target_id"
            value={form.target_id}
            onChange={handleChange}
            required
            className="form-control"
            placeholder={`Enter ${role === "student" ? "Faculty" : "Project Head"} ID`}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
