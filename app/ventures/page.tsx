import { ArrowRight, FolderOpen } from "lucide-react";
import { Action, Closing, Outcomes, PageIntro, PublicShell, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Ventures & Outcomes", description: "Explore the path from a Udyaan problem to a validated solution, company adoption, research or a student-led venture.", path: "/ventures" });

export default function VenturesPage() {
  return <PublicShell crumbs={[{ name: "Ventures", path: "/ventures" }]}>
    <PageIntro label="Ventures & outcomes" title="A project can become a company." text="The journey is not automatic. It is earned through evidence. When a solution proves its value and a builder wants to continue, the next chapter can begin."><div className={styles.actions}><Action href="/problems">Explore the starting points</Action><TextLink href="#portfolio">Portfolio</TextLink></div></PageIntro>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="The venture pathway" title="Keep going when the opportunity is real." />
      <div className={styles.venturePath}>{["Problem", "Solution", "Prototype", "Validation", "MVP", "Customer", "Venture", "Growth"].map((stage, index) => <span key={stage}>{stage}{index < 7 && <ArrowRight size={17} />}</span>)}</div>
      <p className={styles.sectionNote}>Each next stage depends on evidence, appropriate support and the relevant contributor, university and partner agreements.</p>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={styles.container}>
      <SectionHeading label="Three meaningful outcomes" title="Progress does not have only one shape." /><Outcomes />
    </div></section>
    <section className={styles.section} id="portfolio"><div className={styles.container}>
      <SectionHeading label="Built through Udyaan" title="From problem to proof." />
      <div className={styles.portfolioEmpty}><FolderOpen size={52} strokeWidth={1} /><div><h2>The first chapter is still being documented.</h2><p>There are no published, verified venture case studies here yet. Current challenge briefs are starting points, not claims of completed pilots, company adoption or commercial results.</p><TextLink href="/problems">Explore the current challenge directions</TextLink></div></div>
    </div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={styles.container}>
      <SectionHeading label="What makes a credible outcome" title="The evidence behind the story." text="A meaningful record connects the original need to what was built, what was tested and what happened next." />
      <div className={styles.stepGrid}>{[["The problem", "The real need, intended user and original constraints."], ["The team", "The builders, contributors and roles behind the work."], ["The build", "The solution and the choices that shaped it."], ["The evidence", "Test conditions, results, limitations and lessons."], ["The outcome", "An agreed adoption, research or venture next step."], ["Current stage", "Where the work stands and who is continuing it."]].map(([title, text], index) => <article className={styles.step} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>
    <section className={styles.section}><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>The founder pathway</p><h2>You can start with a problem, not a pitch deck.</h2></div><div><p>Become the person who understands the problem. Take responsibility for a solution. Learn what the market is telling you. Then decide whether the opportunity is worth becoming a business.</p><p>Faculty, mentors, IP guidance and incubation support can help eligible work continue. Capital introductions may be relevant at the right stage; investment is not promised.</p><TextLink href="/join?intent=venture">Discuss your next stage</TextLink></div></div></section>
    <Closing />
  </PublicShell>;
}