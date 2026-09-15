import { ProblemIntake } from "@/components/public/ProblemIntake";
import { PageIntro, PublicShell, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Bring a Problem", description: "Prepare a non-confidential problem brief for Udyaan. Share the context, constraints and desired outcome with the team.", path: "/submit-problem" });

export default function SubmitProblemPage() {
  return <PublicShell crumbs={[{ name: "For companies", path: "/for-companies" }, { name: "Bring a problem", path: "/submit-problem" }]}>
    <PageIntro label="Company & partner enquiry" title="Bring the problem. Start the conversation." text="A useful brief gives us the context, not a predetermined solution. Tell us what is difficult today and what a better outcome would mean." />
    <section className={styles.section}><div className={`${styles.container} ${styles.briefLayout}`}><ProblemIntake /><aside><p className={styles.eyebrow}>What happens next</p><h2 style={{ fontSize: 28 }}>First, we understand the problem.</h2><p>The team reviews your enquiry for fit and follows up to discuss scope, access, expectations and project arrangements.</p><p className={styles.notice}>Do not include confidential data, credentials or unpublished IP. Confidentiality and ownership terms are agreed separately before substantial work begins.</p><TextLink href="/for-companies">The company journey</TextLink></aside></div></section>
  </PublicShell>;
}