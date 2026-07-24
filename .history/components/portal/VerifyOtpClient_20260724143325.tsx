"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL, friendlyError } from "@/lib/portal-api";

export default function VerifyOtpClient() {
  const searchParams = useSearchParams();
  const routedEmail = searchParams.get("email") ?? "";
  const router = useRouter();
  const [email, setEmail] = useState(routedEmail);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Verification failed");
      }

      setMessage("Verification successful! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="auth-wrapper">
      <Link href="/" className="auth-logo-link">
        <span style={{ fontSize: "1.8rem" }}>🍃</span> Udyaan
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h2>Verify Your Email</h2>
          <p>
            Enter the 6-digit code sent to
            <br />
            <strong>{email || "your email"}</strong>
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <form onSubmit={handleSubmit}>
          {!routedEmail && (
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
              />
            </div>
          )}

          <div className="form-group">
            <label>One-Time Password (OTP)</label>
            <input
              type="text"
              className="form-control"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              placeholder="123456"
              maxLength={6}
              style={{ letterSpacing: "0.2em", textAlign: "center", fontSize: "1.25rem", fontWeight: 600 }}
            />
          </div>
          <button type="submit" className="auth-btn">
            Verify Account
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Didn&apos;t receive code?{" "}
            <button
              type="button"
              style={{ background: "none", border: "none", color: "var(--primary-green)", fontWeight: 600, cursor: "pointer" }}
              onClick={() => alert("Resend feature not implemented yet")}
            >
              Resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
