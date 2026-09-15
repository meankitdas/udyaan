import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Action, PageIntro, PublicShell } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { CONTACT_EMAIL, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Talk to Udyaan about student building, company problems, mentorship, research and venture pathways. Contact support@udyaan.org.",
  path: "/contact",
});

export default function ContactPage() {
  return <PublicShell crumbs={[{ name: "Contact", path: "/contact" }]}>
    <PageIntro label="Get in touch" title="A good conversation can be the start." text="Questions about joining, bringing a problem, mentoring a team or taking a solution further? Talk to the Udyaan team." />
    <section className={styles.section}><div className={`${styles.container} ${styles.split}`}><div><p className={styles.eyebrow}>Email the team</p><a className={styles.contactEmail} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}<ArrowUpRight size={24} /></a><p className={styles.sectionNote}>JAIN (Deemed-to-be University) / Udyaan</p></div><div><h2>Already know<br />where to begin?</h2><p>Student builders and company problem owners have their own starting points.</p><div className={styles.actions}><Action href="/join">Join Udyaan</Action><Action href="/submit-problem" secondary>Bring a problem</Action></div></div></div></section>
  </PublicShell>;
}
