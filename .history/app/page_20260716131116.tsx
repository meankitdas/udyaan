import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/Brand";
import { Footer } from "@/components/Footer";
import { PlantScene } from "@/components/PlantScene";
import { LivingLabScene } from "@/components/LivingLabScene";
import { ArrowDownIcon, ArrowRightIcon, InfinityIcon, QuoteIcon } from "@/components/Icons";

const pathways = [
  { number: "01", title: "Regenerative farming", text: "Learn the soil-first systems reshaping how food is grown.", tone: "sage" },
  { number: "02", title: "Agri-tech & data", text: "Turn field observations into smarter, measurable decisions.", tone: "clay" },
  { number: "03", title: "Community impact", text: "Build with people, not just for them, through local partnerships.", tone: "sun" },
  { number: "04", title: "Food innovation", text: "Follow an idea from the first seed to a market-ready product.", tone: "forest" },
];

const departments = [
  "Agriculture",
  "Biotechnology",
  "Environmental science",
  "Business & marketing",
  "Engineering",
  "Food technology",
  "Data analytics",
  "Sustainability",
];

const modelPillars = [
  {
    number: "01",
    title: "Applied immersion",
    text: "Semester-long field projects replace passive assignments. Students earn academic credit by solving measurable, real-world problems.",
  },
  {
    number: "02",
    title: "IP pipeline",
    text: "The campus becomes a data-rich research environment where evidence can lead to patents, publications, and validated processes.",
  },
  {
    number: "03",
    title: "Venture studio",
    text: "Promising work moves from prototype to market pilot, with compliance, business modeling, incubation, and investor readiness built in.",
  },
];

const projects = [
  {
    number: "01",
    category: "Precision agriculture",
    title: "Drone + robot farming",
    text: "A connected field system for multispectral scouting, soil sensing, precision spraying, and autonomous crop monitoring.",
    stat: "20-35%",
    statLabel: "target chemical savings",
    tone: "mint",
  },
  {
    number: "02",
    category: "Urban food systems",
    title: "Vertical microgreens",
    text: "A compact high-intensity production model combining controlled environments, fast harvest cycles, and direct market channels.",
    stat: "180 sq ft",
    statLabel: "reference footprint",
    tone: "sun",
  },
  {
    number: "03",
    category: "Hydro-aeroponics",
    title: "More crop. Less water.",
    text: "Integrated towers and nutrient-film channels turn limited urban space into a measurable, climate-aware growing system.",
    stat: "92%",
    statLabel: "water reduction target",
    tone: "clay",
  },
  {
    number: "04",
    category: "Circular bioeconomy",
    title: "Waste to wealth",
    text: "A Bio-CNG living lab where feedstock logistics, process biology, compliance, and commercial viability meet in one project.",
    stat: "100 TPD",
    statLabel: "model processing capacity",
    tone: "forest",
  },
];

const selectionSteps = [
  {
    phase: "Phase 01",
    title: "The initial filter",
    text: "A pitch-deck resume and cognitive assessment surface curiosity, reasoning, and the ability to frame a useful problem.",
  },
  {
    phase: "Phase 02",
    title: "The mud test",
    text: "A one-day field boot camp tests resilience, observation, collaboration, and grit through work that cannot be solved from a desk.",
  },
  {
    phase: "Phase 03",
    title: "The boardroom",
    text: "Candidates translate field insight into a commercial story and defend it before a cross-functional evaluation panel.",
  },
];

const journey = [
  { week: "Week 01", title: "Research + strategy", text: "Map the system, define the stakeholder, and turn a broad challenge into a testable brief." },
  { week: "Week 02", title: "Prototype + testing", text: "Build the first working model and collect evidence from the field, lab, or customer." },
  { week: "Week 03", title: "Production + policy", text: "Design operations, financial viability, safety, compliance, and intellectual-property pathways." },
  { week: "Week 04", title: "Exhibit + launch", text: "Present the proof, publish the learning, and move viable ideas toward incubation or market pilots." },
];

const disciplines = [
  "Engineering + automation",
  "Life sciences",
  "Food technology",
  "Design + creative arts",
  "Business + commerce",
  "Humanities + policy",
  "Data + AI",
  "Sustainability",
];

export default function Home() {
  return (
    <div className="home-page">
      <Header />
      <main>
        <section className="new-hero" aria-labelledby="hero-title">
          <div className="hero-grain" aria-hidden="true" />
          <div className="new-hero-copy">
            <p className="kicker">A living classroom</p>
            <h1 id="hero-title">Where ideas<br />take <em>root.</em></h1>
            <p className="new-hero-description">
              A 1,000-acre learning experience where curious minds grow practical skills,
              build unlikely teams, and create change that lasts.
            </p>
            <div className="new-hero-actions">
              <Link className="round-button primary" href="/signup">Explore the program <ArrowRightIcon /></Link>
              <Link className="text-link" href="#story">See how it works <span><ArrowDownIcon /></span></Link>
            </div>
            <div className="hero-proof" aria-label="Program highlights">
              <div><strong>1,000</strong><span>acres to explore</span></div>
              <div><strong>08</strong><span>learning pathways</span></div>
              <div><strong className="proof-infinity"><InfinityIcon /></strong><span>room to grow</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Interactive 3D plant illustration">
            <span className="visual-label">Grown at Udyaan · 2026</span>
            <PlantScene />
            <div className="floating-note note-one">
              <span className="note-dot" />
              <div><small>Currently growing</small><strong>Future leaders</strong></div>
            </div>
          </div>
        </section>

        <section className="intro-strip" aria-label="Udyaan introduction">
          <p>Education should feel less like a classroom</p>
          <div className="strip-image">
            <Image src="/farmland-poster.jpg" alt="A green plant grown at Udyaan" width={300} height={180} />
          </div>
          <p>and more like a world waiting to be explored.</p>
        </section>

        <section className="story-section" id="story">
          <div className="story-heading">
            <p className="kicker light">The Udyaan difference</p>
            <h2>Learn by doing.<br /><em>Grow by sharing.</em></h2>
            <p>We bring students from every discipline into the field—because the most exciting ideas happen where worlds overlap.</p>
          </div>
          <div className="story-collage">
            <article className="story-photo-card">
              <Image src="/farmland-poster.jpg" alt="Agricultural field experience at Udyaan" fill sizes="(max-width: 900px) 90vw, 44vw" />
              <span>Field notes / 04</span>
              <div className="photo-caption"><strong>Real ground.<br />Real challenges.</strong><small>Karnataka, India</small></div>
            </article>
            <div className="story-side">
              <article className="quote-card">
                <span className="quote-mark"><QuoteIcon /></span>
                <blockquote>The best way to understand a system is to get your hands in it.</blockquote>
                <p>Our approach to learning</p>
              </article>
              <article className="mini-stat-card">
                <span>Students + soil + science</span>
                <strong>One<br />shared<br /><em>purpose.</em></strong>
                <div className="orbit-mark" aria-hidden="true"><i /><i /><i /></div>
              </article>
            </div>
          </div>
        </section>

        <section className="pathways-section" id="pathways">
          <div className="pathways-header">
            <div>
              <p className="kicker">Choose your path</p>
              <h2>Find what makes<br />you <em>curious.</em></h2>
            </div>
            <p>Eight disciplines. One shared ecosystem. Follow a familiar path or discover a completely new one.</p>
          </div>
          <div className="pathway-grid">
            {pathways.map((pathway) => (
              <article className={`pathway-card ${pathway.tone}`} key={pathway.title}>
                <span className="pathway-number">{pathway.number}</span>
                <div className="pathway-art" aria-hidden="true"><i /><i /><i /></div>
                <div>
                  <h3>{pathway.title}</h3>
                  <p>{pathway.text}</p>
                </div>
                <span className="card-arrow"><ArrowRightIcon /></span>
              </article>
            ))}
          </div>
          <div className="department-cloud" aria-label="Available departments">
            {departments.map((department) => <span key={department}>{department}</span>)}
          </div>
        </section>

        <section className="manifesto-section">
          <p>Not just an internship.</p>
          <h2>A season that might<br />change your <em>whole direction.</em></h2>
        </section>

        <section className="final-cta">
          <div className="cta-copy">
            <p className="kicker light">Applications are open</p>
            <h2>Ready to grow<br />something <em>real?</em></h2>
            <p>Bring your curiosity. We&apos;ll provide the acres.</p>
            <Link className="round-button cream" href="/signup">Start your journey <ArrowRightIcon /></Link>
          </div>
          <div className="cta-plant" aria-hidden="true">
            <Image src="/farmland-poster.jpg" alt="" fill sizes="40vw" />
          </div>
          <span className="cta-index">UDY / 26</span>
        </section>
      </main>
      <Footer />
    </div>
  );
}
