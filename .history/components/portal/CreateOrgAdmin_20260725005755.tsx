"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { API_BASE_URL, apiFetch, authHeaders } from "@/lib/portal-api";
import type { Organization } from "@/lib/portal-types";

export default function CreateOrgAdmin({ org, onBack }: { org: Organization; onBack: () => void }) {
  const [formData, setFormData] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/organizations/${org.id}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create admin");
      }

      setMessage("Admin account created successfully!");
      setFormData({ full_name: "", email: "", password: "", phone: "" });
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Failed to create admin"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Back to List
        </button>
      </div>

      <h3>Add Admin for {org.name}</h3>
      {message && <p className={message.startsWith("Error") ? "error-text" : "success-text"}>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input name="full_name" value={formData.full_name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input name="email" value={formData.email} onChange={handleChange} type="email" required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input name="password" value={formData.password} onChange={handleChange} type="password" required />
        </div>
        <div className="form-group">
          <label>Phone (Optional)</label>
          <input name="phone" value={formData.phone} onChange={handleChange} />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>
    </div>
  );
}
