"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Leaf } from "lucide-react";
import { API_BASE_URL, friendlyError, roleHome, setSession } from "@/lib/portal-api";

export default function LoginClient() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const nextPath = searchParams.get("next");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      // Backend expects application/x-www-form-urlencoded for OAuth2 form
      const params = new URLSearchParams();
      params.append("username", formData.email); // Map email to username
      params.append("password", formData.password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      setSession(data);
      router.push(nextPath || roleHome[data.role_key] || "/");
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
          <h2>Welcome Back</h2>
          <p>Sign in to continue to your dashboard</p>
        </div>

        {expired && !error && (
          <div className="alert alert-warning">Your session expired. Please sign in again to continue.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
              placeholder="Enter your password"
            />
          </div>

          <div style={{ textAlign: "right", marginBottom: "1rem" }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: "0.9em", color: "var(--primary-green)", textDecoration: "none", fontWeight: 500 }}
            >
              Forgot Password?
            </Link>
          </div>

          <button type="submit" className="auth-btn">
            Sign In
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don&apos;t have an account?
            <Link href="/signup" className="auth-link">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
