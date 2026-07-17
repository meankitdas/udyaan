import { UdyaanBrand } from "@/components/Brand";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-blob auth-blob-one" />
      <div className="auth-blob auth-blob-two" />
      <div className="auth-brand"><UdyaanBrand compact showJgi /></div>
      <section className="auth-card">{children}</section>
    </main>
  );
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="auth-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
