import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, CircleHelp, GitBranch, Handshake, Microscope, RefreshCw, Rocket, ScanLine, UserRound, Users, Wrench } from "lucide-react";
import { Header } from "@/components/Brand";
import { Footer } from "@/components/Footer";
import { engineStages, type Problem } from "@/lib/problems";
import { breadcrumbJsonLd } from "@/lib/seo";
import styles from "./PublicSite.module.css";

const referencePhotos = {
  team: { src: "/builder-team.jpg", alt: "People collaborating around a table with laptops and code on screen", label: "Different strengths. Shared work." },
  design: { src: "/builder-design.jpg", alt: "A hand sketching connected product screens and a user flow on paper", label: "Make an idea tangible." },
  electronics: { src: "/builder-electronics.jpg", alt: "Close-up of a circuit board showing chips, connections and electronic components", label: "Work through the details." },
};

export function ReferencePhoto({ subject, wide = false }: { subject: keyof typeof referencePhotos; wide?: boolean }) {
  const photo = referencePhotos[subject];
  return <figure className={`${styles.referencePhoto} ${wide ? styles.referenceWide : ""}`}><div className={styles.referenceFrame}><Image src={photo.src} alt={photo.alt} fill sizes={wide ? "90vw" : "(max-width: 700px) 90vw, 45vw"} /></div><figcaption><span><Camera size={13} aria-hidden="true" />{photo.label}</span><small>Reference photography / Unsplash</small></figcaption></figure>;
}

export function PublicShell({ children, crumbs = [], className = "" }: { children: React.ReactNode; crumbs?: { name: string; path: string }[]; className?: string }) {
  return <div className={`${styles.site} ${className}`}><Header /><main id="main-content">{children}</main><Footer />{crumbs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }} />}</div>;
}

export function Action({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Link className={`${styles.action} ${secondary ? styles.secondary : ""}`} href={href}>{children}<ArrowUpRight size={17} /></Link>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className={styles.textLink} href={href}>{children}<ArrowRight size={17} /></Link>;
}

export function PageIntro({ label, title, text, children, image }: { label: string; title: string; text: string; children?: React.ReactNode; image?: keyof typeof referencePhotos }) {
  return <section className={styles.pageIntro}><div className={styles.container}><p className={styles.eyebrow}>{label}</p><h1>{title}</h1><p className={styles.lead}>{text}</p>{children}{image && <ReferencePhoto subject={image} wide />}</div></section>;
}

export function SectionHeading({ label, title, text, children }: { label: string; title: string; text?: string; children?: React.ReactNode }) {
  return <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>{label}</p><h2>{title}</h2>{text && <p>{text}</p>}</div>{children}</div>;
}

export function Engine() {
  const icons = [CircleHelp, UserRound, Users, Wrench, ScanLine, GitBranch, Rocket];
  const phases = [
    { label: "Assemble", title: "The right people.", start: 0, end: 3, tone: "green" },
    { label: "Build & validate", title: "The work. The proof.", start: 3, end: 5, tone: "blue" },
    { label: "Take it forward", title: "A next step that fits.", start: 5, end: 7, tone: "coral" },
  ];

  return <div className={styles.engine}>
    <div className={styles.enginePhases}>
      {phases.map((phase, phaseIndex) => <section className={styles.enginePhase} data-tone={phase.tone} key={phase.label} aria-label={phase.label}>
        <div className={styles.enginePhaseTop}><span className={styles.enginePhaseNumber}>0{phaseIndex + 1}</span><span>{phase.label}</span>{phaseIndex < phases.length - 1 && <ArrowRight className={styles.engineConnector} size={20} aria-hidden="true" />}</div>
        <h3>{phase.title}</h3>
        <ol className={styles.engineStages} start={phase.start + 1}>
          {engineStages.slice(phase.start, phase.end).map((stage, stageIndex) => {
            const index = phase.start + stageIndex;
            const Icon = icons[index];
            return <li key={stage.title} className={index === 6 ? styles.engineConditional : undefined}>
              <span className={styles.engineIcon}><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div><div className={styles.engineStageTitle}><span className={styles.engineStageNumber}>0{index + 1}</span><h4>{stage.title}</h4></div><p>{stage.text}</p>{index === 6 && <span className={styles.engineQualifier}>When the opportunity is validated</span>}</div>
            </li>;
          })}
        </ol>
      </section>)}
    </div>
    <div className={styles.engineFeedback}><div><RefreshCw size={20} strokeWidth={1.5} aria-hidden="true" /><span>Build. Get feedback. Test again.</span></div><p>A venture is one possible outcome. Evidence decides the next move.</p></div>
  </div>;
}

export function ProblemCard({ problem }: { problem: Problem }) {
  return <article className={styles.problemCard}><Link className={styles.cardImage} href={`/problems/${problem.slug}`} tabIndex={-1} aria-hidden="true"><Image src={problem.image} alt="" fill sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw" /><span className={styles.imageCategory}>{problem.category}</span></Link><div className={styles.cardContent}><div className={styles.cardMeta}><span>{problem.id}</span><span className={styles.status}><span />{problem.status}</span></div><h3><Link href={`/problems/${problem.slug}`}>{problem.title}</Link></h3><p>{problem.description}</p><p className={styles.cardSource}>{problem.source}</p><div className={styles.tags}>{problem.skills.map(skill => <span key={skill}>{skill}</span>)}</div><div className={styles.cardBottom}><span>{problem.stage}</span><Link href={`/problems/${problem.slug}`} aria-label={`View problem: ${problem.title}`}>View brief<ArrowUpRight size={17} /></Link></div></div></article>;
}

export function Outcomes() {
  const routes = [
    { icon: Handshake, title: "Company adoption", label: "01 / Put it to work", text: "A problem owner chooses to pilot, adopt or pay for a solution that creates value." },
    { icon: Microscope, title: "Research & IP", label: "02 / Take it deeper", text: "The evidence opens a research pathway, intellectual property opportunity or further technical development." },
    { icon: Rocket, title: "Student venture", label: "03 / Build what comes next", text: "A validated opportunity and a team willing to continue can become the foundation of a new venture." },
  ];
  return <div className={styles.outcomes}>{routes.map(route => <article key={route.title}><div className={styles.outcomeSymbol}><route.icon size={36} strokeWidth={1.4} aria-hidden="true" /><ArrowUpRight size={18} aria-hidden="true" /></div><span className={styles.eyebrow}>{route.label}</span><h3>{route.title}</h3><p>{route.text}</p></article>)}</div>;
}

export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return <div className={styles.faqList}>{items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>;
}

export function Closing() {
  return <section className={styles.closing}><div className={styles.container}><p className={styles.eyebrow}>The next step is yours</p><h2>Build something<br />the world can use.</h2><p>Find the problem. Build the solution. Prove it.<br />Then decide how far to take it.</p><div className={styles.actions}><Action href="/problems">Explore problems</Action><Action href="/join" secondary>Join Udyaan</Action><TextLink href="/submit-problem">Bring a problem</TextLink></div></div></section>;
}