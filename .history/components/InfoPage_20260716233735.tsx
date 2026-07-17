import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";

type Section = {
  heading: string;
  content: React.ReactNode;
};

type InfoPageProps = {
  title: string;
  subtitle?: string;
  updated?: string;
  sections: Section[];
};

export function InfoPage({ title, subtitle, updated, sections }: InfoPageProps) {
  return (
    <main className="info-page">
      <div className="info-container">
        <Link className="back-link" href="/"><ArrowLeftIcon /> Back to Home</Link>
        <header className="info-header">
          <p className="info-kicker">Udyaan</p>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
          {updated && <p className="updated">Last updated: {updated}</p>}
        </header>
        <div className="info-content">
          {sections.map((section, i) => (
            <section key={section.heading}>
              <span className="info-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="info-body">
                <h2>{section.heading}</h2>
                <div>{section.content}</div>
              </div>
            </section>
          ))}
        </div>
        <p className="info-footnote">JAIN GROUP / UDYAAN / 2026</p>
      </div>
    </main>
  );
}
