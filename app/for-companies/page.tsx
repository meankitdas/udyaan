import { Check, CircleHelp, ClipboardCheck, Focus, GitBranch, Users, Wrench } from "lucide-react";
import { Action, FaqList, Outcomes, PageIntro, PublicShell, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "For Companies", description: "Bring a business or industry problem to Udyaan. Frame a challenge, meet student builders and work with mentors toward a tested solution.", path: "/for-companies" });

const steps = [
  ["Bring a problem", "Tell us what is difficult, who is affected and what a useful outcome would look like."],
  ["Frame the challenge", "Agree the scope, constraints, available resources and evidence needed for success."],
  ["Meet the builders", "Relevant students are selected and matched into a team around the challenge."],
  ["Build & validate", "The team investigates and builds with mentor support and feedback from your side."],
  ["Review the evidence", "Evaluate the output, test results, limitations and recommendation for the next step."],
  ["Decide what follows", "Explore an adoption, pilot, research, partnership or venture pathway on agreed terms."],
];

const stepIcons = [CircleHelp, Focus, Users, Wrench, ClipboardCheck, GitBranch];

export default function CompaniesPage() {
  return <PublicShell crumbs={[{ name: "For companies", path: "/for-companies" }]}>
    <PageIntro image="design" label="For companies & problem owners" title="Bring us a problem. Let us find the builders." text="A structured way to put real challenges into a supervised student-building environment. Your operating context stays at the centre, from the first brief to the final evidence."><div className={styles.actions}><Action href="/submit-problem">Bring a problem</Action><Action href="/contact" secondary>Talk to Udyaan</Action></div></PageIntro>
    <section className={styles.section}><div className={`${styles.container} ${styles.split}`}>
      <div><p className={styles.eyebrow}>A working relationship</p><h2>Fresh thinking.<br />Grounded in your reality.</h2><p>Some problems need a team willing to investigate the details, question assumptions and test a different approach. Udyaan connects that team with the people closest to the problem.</p></div>
      <ul className={styles.checkList}>{["A clearly scoped challenge, not an open-ended assignment.", "A cross-disciplinary team matched to the problem.", "Mentor guidance and agreed feedback points.", "An output backed by evidence and explicit limitations.", "A conversation about adoption, not a promise of a finished product."].map(item => <li key={item}><Check size={18} />{item}</li>)}</ul>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={styles.container}><SectionHeading label="The company journey" title="From your challenge to a credible next move." /><div className={styles.stepGrid}>{steps.map(([title, text], index) => {
      const Icon = stepIcons[index];
      return <article className={styles.step} key={title}><div className={styles.stepTop}><span>0{index + 1}</span><Icon size={26} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>;
    })}</div></div></section>
    <section className={styles.section}><div className={styles.container}><SectionHeading label="After validation" title="Choose the outcome that creates value." text="A solution can be useful without becoming a company. The problem owner and team decide the next move based on the evidence and the project arrangements." /><Outcomes /></div></section>
    <section className={`${styles.section} ${styles.blue}`}><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>Start with the right brief</p><h2>The problem, not a predetermined answer.</h2></div><div><p>Tell us what happens today, where it falls short and who experiences the consequences. Include constraints such as cost, safety, operations or access to data.</p><p>Before work begins, agree confidentiality, access, contribution and IP terms. Do not include sensitive business information in an initial enquiry.</p><TextLink href="/submit-problem">Prepare your problem brief</TextLink></div></div></section>
    <section className={styles.section}><div className={`${styles.container} ${styles.faqSection}`}><div><p className={styles.eyebrow}>Partnership questions</p><h2>Clear expectations.<br />Better work.</h2></div><FaqList items={[
      { question: "Who can bring a problem?", answer: "Companies, industry partners, researchers and other problem owners can start a conversation with Udyaan. The team reviews fit, feasibility and available support before accepting a challenge." },
      { question: "Do we choose the solution?", answer: "You provide context, constraints and feedback. The student team investigates the problem and proposes an approach that can be tested, rather than simply implementing a predetermined answer." },
      { question: "How much involvement is expected?", answer: "A useful brief needs someone who can explain the context and respond to questions. Review frequency, access and participation are agreed during scoping." },
      { question: "Who owns the IP, and what does adoption cost?", answer: "IP, licensing, commercial terms and any adoption payment depend on the specific project and contributor agreements. These are established with the university and relevant partners, not assumed from a website submission." },
    ]} /></div></section>
    <section className={styles.closing}><div className={styles.container}><p className={styles.eyebrow}>Start a working conversation</p><h2>What is the problem<br />you keep coming back to?</h2><div className={styles.actions}><Action href="/submit-problem">Bring a problem</Action><Action href="/contact" secondary>Talk to the team</Action></div></div></section>
  </PublicShell>;
}