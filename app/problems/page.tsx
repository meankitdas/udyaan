import { ProblemBoard } from "@/components/public/ProblemBoard";
import { Action, Closing, PageIntro, PublicShell } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Explore Problems", description: "Explore Udyaan challenge briefs in food, water and circular systems. Find a problem by your interests and capabilities.", path: "/problems" });

export default function ProblemsPage() {
  return <PublicShell crumbs={[{ name: "Problems", path: "/problems" }]}>
    <PageIntro label="The problem board" title="Find a problem worth solving." text="Start with what makes you curious. Explore the context, understand the constraints, and consider what you could bring to the team."><p className={styles.notice}>These are proposed briefs developed from Udyaan&apos;s existing project tracks, not confirmed open placements. Availability, partners and resources are agreed during scoping.</p></PageIntro>
    <section className={styles.section}><div className={styles.container}><ProblemBoard /></div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>On the other side of a problem?</p><h2>Bring your context.<br />We will start there.</h2></div><div><p>A useful brief begins with what is difficult today, who is affected and what a better outcome could look like. You do not need to have the solution.</p><Action href="/submit-problem">Bring a problem</Action></div></div></section>
    <Closing />
  </PublicShell>;
}