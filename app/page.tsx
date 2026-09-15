import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, Check, CircleCheck, Cpu, GitBranch, GraduationCap, Handshake, Users, UserRound } from "lucide-react";
import { Action, Closing, Engine, FaqList, Outcomes, ProblemCard, PublicShell, ReferencePhoto, SectionHeading, TextLink } from "@/components/public/Site";
import styles from "@/components/public/PublicSite.module.css";
import { problems } from "@/lib/problems";
import { FAQS, homepageJsonLd } from "@/lib/seo";

export default function Home() {
  return <PublicShell className={styles.home}>
    <section className={styles.hero} aria-labelledby="hero-title">
      <Image className={styles.heroImage} src="/udyaan-landscape.jpg" alt="Cultivated fields and a distant treeline under an open sky, a reference landscape for real-world problem solving" fill priority sizes="max(100vw, 178dvh)" />
      <div className={`${styles.container} ${styles.heroInner}`}>
        <div className={styles.heroMasthead}><p>A JAIN university initiative</p><span>Learning meets real-world enterprise</span></div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Students. Industry. Possibility.</p>
          <h1 id="hero-title"><span className={styles.heroBrand}>Udyaan.</span>A launchpad for<br />real-world solutions.</h1>
          <p className={styles.heroDescription}>Start with a real problem. Build with the right people.<br className={styles.desktopBreak} /> Turn evidence into adoption, research, or a venture.</p>
          <div className={styles.actions}><Action href="/problems">Explore problems</Action><Action href="/join" secondary>Join Udyaan</Action></div>
        </div>
        <div className={styles.heroBottom}>
          <Link href="#model" className={styles.heroNext}><span><small>01 / Inside Udyaan</small>From problem to possibility</span><ArrowDown size={22} aria-hidden="true" /></Link>
          <Link href="/for-companies" className={styles.heroPartner}><span><small>For industry & partners</small>Bring a problem. Build a partnership.</span><ArrowUpRight size={22} aria-hidden="true" /></Link>
          <p className={styles.heroCredit}>Reference landscape photography<br /> Unsplash</p>
        </div>
      </div>
    </section>
    <div className={styles.trustStrip}><div className={styles.container}>
      <div className={styles.trustBrand}><span>A JAIN university initiative</span><Image src="/jain-group-logo.png" alt="JAIN Group" width={164} height={36} /></div>
      <div className={styles.trustWords}><span><Users size={15} />Cross-disciplinary teams</span><span><CircleCheck size={15} />Evidence-led building</span><span><GitBranch size={15} />Multiple paths forward</span></div>
    </div></div>
    <section className={styles.section}><div className={styles.container}><div className={styles.thesis}>
      <div><p className={styles.eyebrow}>The opportunity</p><h2>Good problems deserve<br />great builders.</h2></div>
      <div className={styles.thesisCopy}><p>Real problems and capable builders are often separated. Companies have challenges worth solving. Students have the knowledge, curiosity and energy to take them on.</p><p><strong>Udyaan creates the path between them.</strong> A problem finds a team. The team builds with support. Evidence decides where the solution goes next.</p><TextLink href="/about">Why Udyaan exists</TextLink></div>
    </div></div></section>
    <section className={`${styles.section} ${styles.dark}`} id="model"><div className={styles.container}>
      <SectionHeading label="01 / The Udyaan engine" title="A clear path from problem to proof."><TextLink href="/how-it-works">How it works</TextLink></SectionHeading><Engine />
    </div></section>
    <section className={styles.section} id="projects"><div className={styles.container}>
      <SectionHeading label="02 / The problem board" title="Real questions. Worth your time." text="Explore challenge directions from the Udyaan living lab. Find a problem that matches how you think, not just what you study."><TextLink href="/problems">All problems</TextLink></SectionHeading>
      <div className={styles.problemGrid}>{[problems[0], problems[2], problems[3]].map(problem => <ProblemCard key={problem.slug} problem={problem} />)}</div>
      <p className={styles.sectionNote}>Proposed briefs based on existing Udyaan tracks. Scope, access and availability are confirmed with the team before a build begins.</p>
    </div></section>
    <section className={`${styles.section} ${styles.blue}`} id="journey"><div className={`${styles.container} ${styles.validation}`}>
      <div className={styles.validationIntro}><p className={styles.eyebrow}>03 / Build against reality</p><h2>Proof before<br />promises.</h2><p>A good presentation is not the finish line. Build, get feedback, improve, and test again. A solution earns its next step through evidence.</p><TextLink href="/how-it-works#validation">Inside the validation process</TextLink><ReferencePhoto subject="electronics" /></div>
      <ol className={styles.gates}>{[
        { icon: Cpu, title: "Technical", text: "Can it work reliably within the constraints?" },
        { icon: UserRound, title: "User", text: "Does it solve a real need for the people using it?" },
        { icon: ChartNoAxesCombined, title: "Market", text: "Is there a credible customer or adoption pathway?" },
        { icon: BadgeCheck, title: "Commercial", text: "Does the value justify continued development?" },
      ].map(({ icon: Icon, title, text }) => <li key={title}><span className={styles.gateIcon}><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></span><div><h3>{title}</h3><p>{text}</p></div><Check size={18} aria-hidden="true" /></li>)}</ol>
    </div></section>
    <section className={styles.section}><div className={styles.container}>
      <SectionHeading label="04 / What comes next" title="The work decides the way forward." text="Not every project needs to become a startup. The right outcome is the one the evidence supports." /><Outcomes />
      <div className={styles.actions}><TextLink href="/ventures">The venture pathway</TextLink></div>
    </div></section>
    <section className={styles.audiences} aria-label="Find your route">
      <article><ReferencePhoto subject="team" /><p className={styles.eyebrow}><GraduationCap size={20} aria-hidden="true" />For students / The builder side</p><h2>Leave with more<br />than a grade.</h2><p>Work beyond your discipline. Build something you can show. Leave with evidence, experience and a clearer idea of what you can do next.</p><TextLink href="/for-students">Find your place</TextLink></article>
      <article><ReferencePhoto subject="design" /><p className={styles.eyebrow}><Handshake size={20} aria-hidden="true" />For companies / The problem side</p><h2>Bring the challenge.<br />Meet the builders.</h2><p>Put a meaningful problem into a structured build-and-validation environment, with mentors involved and your operating context at the centre.</p><TextLink href="/for-companies">Work with Udyaan</TextLink></article>
    </section>
    <section className={styles.section} id="faq"><div className={`${styles.container} ${styles.faqSection}`}>
      <div><p className={styles.eyebrow}>A few things worth knowing</p><h2>Before you<br />step in.</h2><TextLink href="/contact">Talk to the team</TextLink></div><FaqList items={FAQS} />
    </div></section>
    <Closing />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd()) }} />
  </PublicShell>;
}