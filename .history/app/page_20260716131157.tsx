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
            <p className="kicker">Venture-linked living lab</p>
            <h1 id="hero-title">From soil<br />to <em>startup.</em></h1>
            <p className="new-hero-description">
              Udyaan turns a 1,000-acre campus into a working laboratory where students
              earn credits, generate research, build IP, and launch market-ready ideas.
            </p>
            <div className="new-hero-actions">
              <Link className="round-button primary" href="#lab">Explore the living lab <ArrowRightIcon /></Link>
              <Link className="text-link" href="#model">See the model <span><ArrowDownIcon /></span></Link>
            </div>
            <div className="hero-proof" aria-label="Program highlights">
              <div><strong>1,000</strong><span>acre campus</span></div>
              <div><strong>30+</strong><span>venture pathways</span></div>
              <div><strong>04</strong><span>weeks to launch</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Interactive 3D plant representing an idea growing into a venture">
            <span className="visual-label">Udyaan Living Lab / 2026</span>
            <PlantScene />
            <div className="floating-note note-one">
              <span className="note-dot" />
              <div><small>Learning model</small><strong>Strategy to execution</strong></div>
            </div>
          </div>
        </section>

        <section className="intro-strip" aria-label="Udyaan introduction">
          <p>A venture studio</p>
          <div className="strip-image">
            <Image src="/farmland-poster.jpg" alt="Udyaan farmland living laboratory" width={300} height={180} />
          </div>
          <p>hidden inside a farm.</p>
        </section>

        <section className="venture-model" id="model">
          <div className="venture-model-heading">
            <p className="kicker light">The Udyaan model</p>
            <h2>Academic rigor.<br />Research depth.<br /><em>Venture traction.</em></h2>
            <p>
              The farm is not a field trip. It is shared infrastructure for teaching,
              research, prototyping, and enterprise across the JAIN Group ecosystem.
            </p>
          </div>
          <div className="model-pillars">
            {modelPillars.map((pillar) => (
              <article key={pillar.number}>
                <span>{pillar.number}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.text}</p>
              </article>
            ))}
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
