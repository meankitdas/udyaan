import Image from "next/image";
import { Building2, GraduationCap, MessagesSquare, Microscope, Rocket, Users } from "lucide-react";
import { Closing, PageIntro, PublicShell, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "About Udyaan", description: "Udyaan is a JAIN university-led platform connecting learning, real problems, applied building and venture creation.", path: "/about" });

const ecosystemIcons = [Users, GraduationCap, Building2, MessagesSquare, Microscope, Rocket];

export default function AboutPage() {
  return <PublicShell crumbs={[{ name: "About", path: "/about" }]}>
    <PageIntro image="team" label="About Udyaan" title="Built inside a university. Designed for the real world." text="Udyaan is a JAIN (Deemed-to-be University) initiative connecting student capability, meaningful problems, mentorship and execution." />
    <section className={styles.section}><div className={`${styles.container} ${styles.thesis}`}>
      <div><p className={styles.eyebrow}>Why we exist</p><h2>From academic work to work that matters.</h2></div><div className={styles.thesisCopy}><p>A degree develops knowledge. Real work asks what you can do with it when the answer is not already in a textbook.</p><p>Companies have operational challenges and unmet needs. Students have capabilities that deserve to be tested earlier. Udyaan creates a structured place for the two to meet, build and learn from the result.</p></div>
    </div></section>
    <section className={`${styles.section} ${styles.dark}`}><div className={styles.container}><p className={styles.eyebrow}>Our standard</p><h2>Do not stop at the idea.<br />Build. Test. Learn. Prove.</h2><p className={styles.lead}>People learn differently when the work has consequences. Our ambition is a repeatable path from learner to builder, and when the opportunity is real, from builder to founder.</p></div></section>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="The ecosystem" title="One platform. Many people behind the work." />
      <div className={styles.capabilities}>{[["Students", "Bring questions, capability, ownership and execution."], ["Faculty", "Connect academic depth with practical guidance."], ["Companies", "Bring real problems and operating context."], ["Mentors", "Share experience and challenge the team to think better."], ["Researchers", "Bring methods, technical depth and new knowledge."], ["Incubation support", "Helps eligible, validated work find its next stage."]].map(([title, text], index) => {
        const Icon = ecosystemIcons[index];
        return <article key={title}><span className={styles.capabilityIcon}><Icon size={24} strokeWidth={1.5} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div></article>;
      })}</div>
    </div></section>
    <section className={`${styles.section} ${styles.wash}`}><div className={styles.container}>
      <SectionHeading label="A place to test ideas" title="A living lab for ideas that matter." text="The living lab supports the platform. Food, water, energy and circular systems give builders real conditions to investigate, measure and understand."><TextLink href="/living-lab">Explore the living lab</TextLink></SectionHeading>
      <figure className={styles.widePhoto}><Image src="/udyaan-greenhouse.jpg" alt="A working greenhouse with rows of leafy crops" fill sizes="90vw" /><figcaption>Growing systems / Photo: Mark Stebnicki, Pexels</figcaption></figure>
      <p className={styles.sectionNote}>Facilities and project access are confirmed as part of each agreed brief.</p>
    </div></section>
    <Closing />
  </PublicShell>;
}