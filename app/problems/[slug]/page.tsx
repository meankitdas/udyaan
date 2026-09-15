import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Action, ProblemCard, PublicShell, SectionHeading } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { problems } from "@/lib/problems";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() { return problems.map(problem => ({ slug: problem.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const problem = problems.find(item => item.slug === slug);
  if (!problem) return {};
  return pageMetadata({ title: problem.title, description: problem.description, path: `/problems/${problem.slug}` });
}

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const problem = problems.find(item => item.slug === slug);
  if (!problem) notFound();
  return <PublicShell crumbs={[{ name: "Problems", path: "/problems" }, { name: problem.id, path: `/problems/${slug}` }]}>
    <section className={styles.pageIntro}><div className={styles.container}>
      <Link href="/problems" className={styles.breadcrumb}><ArrowLeft size={15} />All problems</Link>
      <div className={styles.briefMeta}><span>{problem.id}</span><span>{problem.category} / {problem.type}</span><span className={styles.status}><span />{problem.status}</span></div>
      <h1>{problem.title}</h1><p className={styles.lead}>{problem.description}</p>
    </div></section>
    <section className={styles.section}><div className={`${styles.container} ${styles.briefLayout}`}>
      <div className={styles.briefBody}>
        <section><h2>The context</h2><p>{problem.context}</p></section>
        <section><h2>Who this is for</h2><p>{problem.user}</p></section>
        <section><h2>Why it matters</h2><p>{problem.whyNow}</p></section>
        <section><h2>What needs to be solved</h2><p>{problem.ask}</p></section>
        <section><h2>The constraints</h2><ul>{problem.constraints.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h2>What success looks like</h2><ul>{problem.success.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h2>Who can contribute</h2><div className={styles.tags}>{problem.skills.map(skill => <span key={skill}>{skill}</span>)}</div><p>The problem decides the team. These capabilities are a starting point, not a closed list of eligible degrees.</p></section>
        <section><h2>Available support</h2><p>{problem.support}</p></section>
      </div>
      <aside className={styles.briefAside} aria-label="Problem summary">
        <div className={styles.briefAsideImage}><Image src={problem.image} alt={problem.imageAlt} fill sizes="(max-width: 800px) 90vw, 310px" /></div>
        <div className={styles.briefAsideContent}><h2>Could you take this on?</h2><dl className={styles.factList}><div><dt>Source</dt><dd>{problem.source}</dd></div><div><dt>Stage</dt><dd>{problem.stage}</dd></div><div><dt>Status</dt><dd>Proposed brief</dd></div></dl><p>Express interest in this challenge. Scope, team fit, access and ownership terms need to be confirmed before building.</p><Action href={`/join?problem=${problem.slug}`}>I am interested</Action><p className={styles.sectionNote}>A preference is not an offer or a confirmed project placement.</p></div>
      </aside>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={styles.container}><SectionHeading label="Keep exploring" title="Another way to make a difference." /><div className={styles.problemGrid}>{problems.filter(item => item.slug !== slug).slice(0, 3).map(item => <ProblemCard key={item.slug} problem={item} />)}</div></div></section>
  </PublicShell>;
}