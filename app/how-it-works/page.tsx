import { ArrowRight, ArrowRightLeft, BadgeCheck, Building2, Check, FlaskConical, Focus, MessagesSquare, Presentation, RefreshCw, ScanSearch, Search, Users, Wrench } from "lucide-react";
import { Action, Closing, Engine, Outcomes, PageIntro, PublicShell, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { buildStages } from "@/lib/problems";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "How It Works", description: "Follow the Udyaan process from problem discovery and team formation through building, validation, company adoption and venture creation.", path: "/how-it-works" });

const buildIcons = [ScanSearch, Search, Focus, Wrench, FlaskConical, RefreshCw, BadgeCheck, Presentation];

export default function HowItWorksPage() {
  return <PublicShell crumbs={[{ name: "How it works", path: "/how-it-works" }]}>
    <PageIntro image="electronics" label="The method" title="From problem statement to working solution." text="Not a competition. Not a one-time project. A structured build-and-validation environment where the work is judged by what the team can prove."><div className={styles.actions}><Action href="/problems">Find your starting point</Action><TextLink href="#build">The build journey</TextLink></div></PageIntro>
    <section className={`${styles.section} ${styles.dark}`}><div className={styles.container}><SectionHeading label="The complete system" title="The Udyaan engine." /><Engine /></div></section>
    <section className={styles.section} id="build"><div className={styles.container}>
      <SectionHeading label="01 / Do the work" title="Build against reality." text="The method stays consistent. The time, team and resources depend on the problem. Each stage produces something the next decision can use." />
      <div className={styles.stepGrid}>{buildStages.map(([title, text], index) => {
        const Icon = buildIcons[index];
        return <article className={styles.step} key={title}><div className={styles.stepTop}><span>0{index + 1}</span><Icon size={26} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>;
      })}</div>
    </div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={styles.container}>
      <SectionHeading label="The programme calendar" title="A four-week sprint inside a longer journey." text="The existing interdisciplinary sprint gives the work an execution rhythm. Validation and venture continuation can extend beyond it; the project determines the next stage." />
      <ol className={styles.timeline}>{[["Week 01", "Research + strategy"], ["Week 02", "Prototype + testing"], ["Week 03", "Production + policy"], ["Week 04", "Exhibit + next steps"]].map(([week, title]) => <li key={week}><span>{week}</span><strong>{title}</strong></li>)}</ol>
    </div></section>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="02 / Stay connected to the problem" title="You build. Experts challenge. The owner responds." />
      <div className={styles.loop}><article><span className={styles.loopIcon}><Users size={30} strokeWidth={1.5} aria-hidden="true" /></span><h3>Student team</h3><p>Owns the research, decisions, prototypes, testing, iteration and final proof.</p></article><ArrowRightLeft size={26} aria-hidden="true" /><article><span className={styles.loopIcon}><MessagesSquare size={30} strokeWidth={1.5} aria-hidden="true" /></span><h3>Mentor</h3><p>Brings experience, questions assumptions and helps the team make stronger decisions.</p></article><ArrowRightLeft size={26} aria-hidden="true" /><article><span className={styles.loopIcon}><Building2 size={30} strokeWidth={1.5} aria-hidden="true" /></span><h3>Problem owner</h3><p>Provides context, constraints and feedback on whether the solution is useful in practice.</p></article></div>
      <p className={styles.notice}>Build. Get feedback. Improve. Test again. Agree review points with the mentor and problem owner when the brief is scoped.</p>
    </div></section>
    <section className={`${styles.section} ${styles.blue}`} id="validation"><div className={`${styles.container} ${styles.validation}`}>
      <div className={styles.validationIntro}><p className={styles.eyebrow}>03 / Evidence gates</p><h2>A prototype is<br />not yet a venture.</h2><p>The next move should be based on evidence, not momentum. A team may need to revisit earlier assumptions before progressing.</p></div>
      <ol className={styles.gates}>{[["Technical validation", "Demonstrate feasibility, reliability and performance within the agreed constraints."], ["User validation", "Test whether the solution addresses a real need and can be used in context."], ["Market validation", "Establish a credible need, customer or adoption pathway."], ["Commercial validation", "Explain the value created, costs involved and reason to continue."]].map(([title, text], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div><Check size={18} /></li>)}</ol>
    </div></section>
    <section className={styles.section}><div className={styles.container}><SectionHeading label="04 / Decide what comes next" title="Follow the evidence, not a fixed ending." text="Continue. Iterate. Adopt. Research. Spin out. Every serious project should leave with a clear next step, even when that step is not a company." /><Outcomes /></div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={styles.container}>
      <SectionHeading label="For the work worth continuing" title="A practical path to a venture." />
      <div className={styles.venturePath}>{["Problem", "Solution", "Prototype", "Validation", "MVP", "Customer", "Venture"].map((stage, index) => <span key={stage}>{stage}{index < 6 && <ArrowRight size={17} />}</span>)}</div>
      <p className={styles.sectionNote}>Progress depends on evidence, an owner willing to continue and the relevant university and partner agreements. Funding or incorporation is not guaranteed.</p>
      <div className={styles.actions}><TextLink href="/ventures">Explore the venture pathway</TextLink></div>
    </div></section>
    <Closing />
  </PublicShell>;
}