import Link from "next/link";
import { ArrowUpRight, Building2, Compass, FlaskConical, Sprout } from "lucide-react";
import { Action, PageIntro, PublicShell, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { problems } from "@/lib/problems";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Join Udyaan", description: "Choose your route into Udyaan: solve a problem, test an idea, continue a venture or bring a company challenge.", path: "/join" });

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ problem?: string; intent?: string }> }) {
  const params = await searchParams;
  const problem = problems.find(item => item.slug === params.problem);
  const intent = params.intent === "idea" || params.intent === "venture" ? params.intent : undefined;
  const subject = intent === "idea" ? "Student idea enquiry" : "Student venture enquiry";
  const body = "Hello Udyaan team,\n\nMy name:\nUniversity / discipline:\nThe problem I am working on:\nWhat I have built or tested so far:\nThe support I am looking for:\n";

  return <PublicShell crumbs={[{ name: "Join Udyaan", path: "/join" }]}>
    <PageIntro label="Join Udyaan" title="Choose how you want to enter." text="A problem to solve. An idea to test. A solution worth taking further. Start with where you are now." />
    <section className={styles.section}><div className={styles.container}>
      {problem && <div className={styles.notice}><strong>Your problem preference: {problem.id}</strong><p style={{ margin: "8px 0" }}>{problem.title}</p><p style={{ margin: "0 0 12px" }}>This preference will accompany your assessment response. Team fit and availability are confirmed during selection.</p><TextLink href={`/problems/${problem.slug}`}>Return to the brief</TextLink></div>}
      {intent ? <div className={styles.split}><div><p className={styles.eyebrow}>{intent === "idea" ? "An idea worth investigating" : "The next stage of your solution"}</p><h2>{intent === "idea" ? "Start with what you want to test." : "Bring the work. And the evidence."}</h2><p>Tell the team what problem you are working on, what you have learned and where you need support. Please keep the first message non-confidential.</p></div><div><h3>Start a conversation</h3><p>An initial enquiry helps the team understand the right route. It is not a confirmation of incubation, funding or acceptance.</p><a className={styles.action} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Email the team<ArrowUpRight size={17} /></a><p className={styles.sectionNote}>{CONTACT_EMAIL}</p><TextLink href="/join">View all entry routes</TextLink></div></div> : <div className={styles.entryGrid}>
        <article className={styles.entry}><Compass size={29} strokeWidth={1.4} /><h2>I want to solve a problem.</h2><p>Bring your curiosity and capability. The student assessment is the first step toward selection and matching.</p><TextLink href={problem ? `/survey?problem=${problem.slug}` : "/survey"}>Start student assessment</TextLink></article>
        <article className={styles.entry}><FlaskConical size={29} strokeWidth={1.4} /><h2>I have an idea to test.</h2><p>Describe the problem behind your idea and the assumptions you want to investigate.</p><TextLink href="/join?intent=idea">Discuss your idea</TextLink></article>
        <article className={styles.entry}><Sprout size={29} strokeWidth={1.4} /><h2>I want to build a venture.</h2><p>Bring a solution, the evidence so far and a clear view of what you need for the next stage.</p><TextLink href="/join?intent=venture">Discuss your next stage</TextLink></article>
        <article className={styles.entry}><Building2 size={29} strokeWidth={1.4} /><h2>I want to bring a problem.</h2><p>Give student builders a meaningful challenge from your company or operating context.</p><TextLink href="/submit-problem">Prepare a company brief</TextLink></article>
      </div>}
      {!intent && <p className={styles.sectionNote}>Already part of Udyaan? <Link href="/login" style={{ textDecoration: "underline" }}>Sign in to your workspace.</Link></p>}
    </div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>Not sure where to begin?</p><h2>Let the problem<br />make you curious.</h2></div><div><p>You do not need to know exactly what you will build. Explore a brief, see who is affected and consider what you could contribute.</p><Action href="/problems">Explore problems</Action></div></div></section>
  </PublicShell>;
}