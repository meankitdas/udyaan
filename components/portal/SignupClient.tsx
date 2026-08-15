"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf } from "lucide-react";
import { API_BASE_URL, friendlyError } from "@/lib/portal-api";
import { trackConversion } from "@/components/Analytics";

type Org = { id: string; name: string };

export default function SignupClient() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role_key: "STUDENT",
    organization_id: "",
  });
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/organizations/public`)
      .then((res) => res.json())
      .then((data) => setOrganizations(data))
      .catch((err) => console.error("Failed to fetch orgs", err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      trackConversion("sign_up", { label: process.env.NEXT_PUBLIC_ADS_SIGNUP_LABEL });
      router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="auth-wrapper">
      <Link href="/" className="auth-logo-link">
        <Leaf size={22} strokeWidth={1.8} aria-hidden /> Udyaan
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Join the Udyaan community today</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              name="full_name"
              className="form-control"
              value={formData.full_name}
              onChange={handleChange}
              required
              placeholder="John Doe"
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="name@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a password"
            />
          </div>
          <div className="form-group">
            <label>I am a</label>
            <select name="role_key" className="form-control" value={formData.role_key} onChange={handleChange}>
              <option value="STUDENT">Student</option>
              <option value="FACULTY">Faculty</option>
            </select>
          </div>
          <div className="form-group">
            <label>Organization</label>
            <select
              name="organization_id"
              className="form-control"
              value={formData.organization_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="auth-btn">
            Sign Up
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?
            <Link href="/login" className="auth-link">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
