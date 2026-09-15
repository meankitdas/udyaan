import { ArrowRight, BrainCircuit, ChartNoAxesCombined, Check, Compass, Cpu, GraduationCap, Microscope, PenTool, Rocket, Scale, ScanLine, Send, Sprout, Users, Workflow, Wrench } from "lucide-react";
import { Action, Closing, FaqList, PageIntro, PublicShell, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { capabilities } from "@/lib/problems";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "For Students", description: "Join Udyaan as a student builder. Discover problems, work across disciplines, build with mentors and take validated work toward adoption, research or a venture.", path: "/for-students" });

const selection = [
  ["Discover", "Explore the problems and the work each challenge requires."],
  ["Apply", "Tell us what interests you, what you can bring and how you think."],
  ["Assess", "Show reasoning, practical judgement and an ability to work with uncertainty."],
  ["Match", "Selected builders join the problem and team where their capabilities fit."],
];

const capabilityIcons = [Cpu, ChartNoAxesCombined, PenTool, ChartNoAxesCombined, Microscope, Sprout, Workflow, Scale];
const selectionIcons = [Compass, Send, BrainCircuit, Users];
const supportIcons = [Wrench, ScanLine, Rocket, GraduationCap];

export default function StudentsPage() {
  return <PublicShell crumbs={[{ name: "For students", path: "/for-students" }]}>
    <PageIntro image="team" label="For students" title="Find out what you can build. Before you graduate." text="Choose a real problem. Work with people outside your usual circle. Build something that has to survive reality. You do not need to arrive with a startup."><div className={styles.actions}><Action href="/problems">Explore problems</Action><Action href="/join" secondary>Join Udyaan</Action></div></PageIntro>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="01 / Who can build" title="The problem decides the team." text="Different problems need different people. Capability comes first, degree labels second. Curiosity, ownership, collaboration and a willingness to learn matter across every discipline." />
      <div className={styles.capabilities}>{capabilities.map(([title, text], index) => {
        const Icon = capabilityIcons[index];
        return <article key={title}><span className={styles.capabilityIcon}><Icon size={24} strokeWidth={1.5} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></article>;
      })}</div>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`} id="selection"><div className={styles.container}>
      <SectionHeading label="02 / Getting in" title="Builders, not perfect resumes." text="Selection looks for people who can reason, execute, collaborate and adapt. Once matched, the team moves into the build journey." />
      <div className={styles.stepGrid}>{selection.map(([title, text], index) => {
        const Icon = selectionIcons[index];
        return <article className={styles.step} key={title}><div className={styles.stepTop}><span>0{index + 1}</span><Icon size={26} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>;
      })}</div>
      <div className={styles.actions}><TextLink href="/join">Start your application</TextLink><TextLink href="/how-it-works">What happens after selection</TextLink></div>
      <div className={styles.faqList} style={{ marginTop: 40 }}><details><summary>What does the assessment look for?<span aria-hidden="true">+</span></summary><p>The existing selection model includes an initial pitch-deck resume and cognitive assessment, a practical field boot camp (the &quot;mud test&quot;), and a panel presentation (the &quot;boardroom&quot;). Together they surface reasoning, observation, collaboration and the ability to turn field insight into a credible solution. The team confirms the stages applicable to each intake.</p></details></div>
    </div></section>
    <section className={styles.section}><div className={`${styles.container} ${styles.split}`}>
      <div><p className={styles.eyebrow}>03 / The value of doing</p><h2>Leave with more<br />than a grade.</h2><p>Real work alongside your degree. Decisions you have had to defend. People who have seen you build. A body of evidence that belongs in your next conversation.</p></div>
      <ul className={styles.checkList}>{["A project you can show and explain.", "Research, prototypes and test results, not only a presentation.", "Experience working in a cross-functional team.", "Feedback from mentors and problem owners.", "A clear next step: improve, adopt, research or continue."].map(item => <li key={item}><Check size={18} />{item}</li>)}</ul>
    </div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={styles.container}>
      <SectionHeading label="04 / Support around the builder" title="You own the work. You do not work alone." />
      <div className={styles.stepGrid}>{[["Build", "Faculty, domain mentors, research guidance and relevant technical support."], ["Validate", "Product feedback, problem-owner context and business or market guidance."], ["Continue", "IP pathways, incubation support and relevant capital introductions when appropriate."], ["Learn & earn", "Academic integration where applicable. A monthly INR 15,000 stipend pathway is subject to project eligibility and current programme terms."]].map(([title, text], index) => {
        const Icon = supportIcons[index];
        return <article className={styles.step} key={title}><div className={styles.stepTop}><Icon size={28} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>;
      })}</div>
      <p className={styles.sectionNote}>Credits, stipend, facilities, IP and post-programme support are confirmed for the individual project. They are not automatic entitlements.</p>
    </div></section>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="05 / Keep going, when the opportunity is real" title="Builder today. Maybe founder tomorrow." text="You can become the person who deeply understands a problem, owns the next stage of a solution and chooses to continue. Founder status follows execution, not a title on day one." />
      <div className={styles.venturePath}>{["Builder", "Problem solver", "Solution owner", "Founder"].map((stage, index) => <span key={stage}>{stage}{index < 3 && <ArrowRight size={17} />}</span>)}</div>
      <div className={styles.actions}><TextLink href="/ventures">How a solution can continue</TextLink></div>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={`${styles.container} ${styles.faqSection}`}><div><p className={styles.eyebrow}>Before you apply</p><h2>A few practical questions.</h2></div><FaqList items={[
      { question: "Do I need my own startup idea?", answer: "No. You can start with a problem from Udyaan. You can also bring an idea to discuss with the team; it still needs a clear problem and a way to test its value." },
      { question: "Do I need to apply with a team?", answer: "You can express interest as an individual. Team composition is driven by the capabilities the problem needs, and is confirmed during selection and matching." },
      { question: "Can I continue a solution as my own venture?", answer: "A validated opportunity may continue as a student-led venture, subject to the project, university and partner agreements. Ownership and continuation terms should be clear before substantial building begins." },
    ]} /></div></section>
    <Closing />
  </PublicShell>;
}