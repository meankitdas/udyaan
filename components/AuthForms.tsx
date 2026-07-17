"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SubmitButton({ idle, busy, loading }: { idle: string; busy: string; loading: boolean }) {
  return <button className="auth-submit" disabled={loading}>{loading ? busy : idle}</button>;
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    window.setTimeout(() => {
      setLoading(false);
      setMessage("Demo sign-in complete. No credentials were sent or stored; connect your own authentication service here.");
    }, 650);
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {message && <p className="form-message success" role="status">{message}</p>}
      <label>Email Address<input type="email" name="email" placeholder="name@example.com" autoComplete="email" required /></label>
      <div className="password-row"><label htmlFor="password">Password</label><Link href="/forgot-password">Forgot Password?</Link></div>
      <input id="password" type="password" name="password" placeholder="Enter your password" autoComplete="current-password" minLength={6} required />
      <SubmitButton idle="Sign In" busy="Signing In..." loading={loading} />
      <p className="auth-switch">Don&apos;t have an account? <Link href="/signup">Sign Up</Link></p>
    </form>
  );
}

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    window.setTimeout(() => router.push(`/verify-otp?email=${encodeURIComponent(email)}`), 650);
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <p className="form-message demo" role="note">Demo mode: no account will be created and no email or verification code will be sent.</p>
      <label>Full Name<input name="name" placeholder="John Doe" autoComplete="name" required /></label>
      <label>Email Address<input type="email" name="email" placeholder="name@example.com" autoComplete="email" required /></label>
      <label>Password<input type="password" name="password" placeholder="Create a password" autoComplete="new-password" minLength={6} required /></label>
      <label>Organization<select name="organization" defaultValue="" required><option value="" disabled>Select Organization</option><option value="ORG020626001">Jain University</option></select></label>
      <label>Role<select name="role" defaultValue="Student" required><option>Student</option><option>Faculty</option></select></label>
      <SubmitButton idle="Sign Up" busy="Preparing Demo..." loading={loading} />
      <p className="auth-switch">Already have an account? <Link href="/login">Log In</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setSent(true); }, 650);
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {sent && <p className="form-message success" role="status">Demo mode: no email was sent. Connect your own authentication service to enable password resets.</p>}
      <label>Email Address<input type="email" name="email" placeholder="name@example.com" autoComplete="email" required /></label>
      <SubmitButton idle="Send Reset Link" busy="Sending..." loading={loading} />
      <p className="auth-switch">Remembered your password? <Link href="/login">Log In</Link></p>
    </form>
  );
}

export function VerifyOtpForm() {
  const params = useSearchParams();
  const routedEmail = params.get("email") ?? "";
  const [verified, setVerified] = useState(false);
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerified(true);
    window.setTimeout(() => router.push("/login"), 1500);
  }

  if (verified) return <p className="form-message success centered" role="status">Demo verification complete. No live account was created. Redirecting to login...</p>;

  return (
    <form onSubmit={submit} className="auth-form">
      <p className="form-message demo" role="note">Demo mode: no verification code was sent. Enter any 6 digits to preview this step.</p>
      {!routedEmail && <label>Email Address<input type="email" name="email" placeholder="name@example.com" autoComplete="email" required /></label>}
      <label>One-Time Password (OTP)<input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" autoComplete="one-time-code" required /></label>
      <SubmitButton idle="Verify Account" busy="Verifying..." loading={false} />
      <p className="auth-switch">Didn&apos;t receive code? <button type="button" className="link-button" onClick={() => window.alert("Demo mode: no code was sent. Connect your own authentication service to enable resend.")}>Resend</button></p>
    </form>
  );
}
