"use client";

import { useState } from "react";
import { API_BASE_URL, authHeaders, friendlyError } from "@/lib/portal-api";

export default function CreateOrganization() {
  const [formData, setFormData] = useState({ name: "", address: "", email: "", phone: "" });
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create organization");
      }

      setMessage("Organization created successfully!");
      setFormData({ name: "", address: "", email: "", phone: "" });
    } catch (err) {
      setMessage(`Error: ${friendlyError(err)}`);
    }
  };

  return (
    <div>
      <h3>Create New Organization</h3>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit}>
        <h4>Organization Details</h4>
        <div className="form-group">
          <label>Name</label>
          <input name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Address</label>
          <input name="address" value={formData.address} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Org Email (Optional)</label>
          <input name="email" value={formData.email} onChange={handleChange} type="email" />
        </div>
        <div className="form-group">
          <label>Org Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange} />
        </div>

        <button type="submit">Create Organization</button>
      </form>
    </div>
  );
}
