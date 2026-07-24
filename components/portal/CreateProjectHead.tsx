"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL, apiFetch, authHeaders, friendlyError } from "@/lib/portal-api";
import type { Organization } from "@/lib/portal-types";

export default function CreateProjectHead() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    organization_id: "",
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/organizations`, { headers: authHeaders() });
        if (response.ok) setOrganizations(await response.json());
      } catch (err) {
        console.error("Failed to fetch organizations", err);
      }
    };
    fetchOrgs();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await apiFetch(`${API_BASE_URL}/project-heads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create Project Head");
      }

      setMessage("Project Head created successfully!");
      setFormData({ full_name: "", email: "", password: "", phone: "", organization_id: "" });
    } catch (err) {
      setMessage(`Error: ${friendlyError(err)}`);
    }
  };

  return (
    <div>
      <h3>Create Project Head</h3>
      {message && <p>{message}</p>}
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
          <label>Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Organization</label>
          <select name="organization_id" value={formData.organization_id} onChange={handleChange} required>
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Create Project Head</button>
      </form>
    </div>
  );
}
