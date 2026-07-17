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
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
          {updated && <p className="updated">Last updated: {updated}</p>}
        </header>
        <div className="info-content">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <div>{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
