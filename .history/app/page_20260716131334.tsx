import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/Brand";
import { Footer } from "@/components/Footer";
import { PlantScene } from "@/components/PlantScene";
import { LivingLabScene } from "@/components/LivingLabScene";
import { ArrowDownIcon, ArrowRightIcon } from "@/components/Icons";

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

        <section className="lab-section" id="lab" aria-labelledby="lab-title">
          <div className="lab-heading">
            <p className="kicker light">One campus. Connected systems.</p>
            <h2 id="lab-title">A living lab you can <em>walk through.</em></h2>
            <p>
              Every zone produces more than crops. It produces operational data, research
              questions, prototypes, business cases, and work students can put in a portfolio.
            </p>
          </div>
          <div className="lab-stage">
            <LivingLabScene />
            <span className="lab-marker marker-greenhouse">Controlled environment</span>
            <span className="lab-marker marker-drone">Drone intelligence</span>
            <span className="lab-marker marker-hydro">Hydroponic rack</span>
            <span className="lab-marker marker-bio">Bio-CNG loop</span>
            <div className="lab-readout">
              <span>Live system map</span>
              <strong>Farm + lab + factory</strong>
            </div>
          </div>
          <div className="lab-system-grid" aria-label="Living lab systems">
            <p><span>01</span> Precision sensing</p>
            <p><span>02</span> Controlled cultivation</p>
            <p><span>03</span> Renewable operations</p>
            <p><span>04</span> Circular bioeconomy</p>
          </div>
        </section>

        <section className="projects-section" id="projects">
          <div className="projects-heading">
            <div>
              <p className="kicker">Projects with a market on the other side</p>
              <h2>Build the system.<br /><em>Prove the value.</em></h2>
            </div>
            <p>
              Udyaan projects connect technical performance to financial and social outcomes.
              Students learn to test both the machine and the model around it.
            </p>
          </div>
          <div className="project-grid">
            {projects.map((project) => (
              <article className={`project-card ${project.tone}`} key={project.number}>
                <div className="project-card-top">
                  <span>{project.number}</span>
                  <small>{project.category}</small>
                </div>
                <div className="project-card-body">
                  <h3>{project.title}</h3>
                  <p>{project.text}</p>
                </div>
                <div className="project-stat">
                  <strong>{project.stat}</strong>
                  <span>{project.statLabel}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="selection-section" id="selection">
          <div className="selection-heading">
            <p className="kicker">Student selection</p>
            <h2>Less resume.<br /><em>More readiness.</em></h2>
            <p>
              The selection process looks for resilience, practical intelligence, ethical
              judgment, and the ability to turn an uncertain field problem into action.
            </p>
          </div>
          <div className="selection-steps">
            {selectionSteps.map((step, index) => (
              <article key={step.phase}>
                <div className="selection-step-index">{String(index + 1).padStart(2, "0")}</div>
                <p>{step.phase}</p>
                <h3>{step.title}</h3>
                <span>{step.text}</span>
              </article>
            ))}
          </div>
          <div className="selection-values" aria-label="Selection qualities">
            <span>Resilience + pivot logic</span>
            <span>Innovation under constraint</span>
            <span>Ethical integrity</span>
          </div>
        </section>

        <section className="journey-section" id="journey">
          <div className="journey-heading">
            <p className="kicker light">The interdisciplinary sprint</p>
            <h2>Four weeks from question to <em>proof.</em></h2>
          </div>
          <div className="journey-track">
            {journey.map((item) => (
              <article key={item.week}>
                <span>{item.week}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="integration-section">
          <div className="integration-copy">
            <p className="kicker">Cross-campus integration</p>
            <h2>Every discipline has a place <em>in the field.</em></h2>
            <p>
              Engineers build the system. Scientists validate it. Designers make it usable.
              Business teams find the market. Policy and humanities teams ask who benefits.
            </p>
          </div>
          <div className="discipline-list" aria-label="Participating disciplines">
            {disciplines.map((discipline, index) => (
              <div key={discipline}><span>{String(index + 1).padStart(2, "0")}</span>{discipline}</div>
            ))}
          </div>
          <div className="intern-value-band">
            <div><strong>INR 15,000*</strong><span>monthly stipend pathway</span></div>
            <div><strong>Expert mentors</strong><span>faculty + industry guidance</span></div>
            <div><strong>Working MVPs</strong><span>portfolio-ready outcomes</span></div>
            <div><strong>TBI access</strong><span>incubation + investor readiness</span></div>
          </div>
          <p className="program-note">*Subject to project eligibility and current program terms.</p>
        </section>

        <section className="final-cta">
          <div className="cta-copy">
            <p className="kicker light">Applications are open</p>
            <h2>Build something<br />the world can <em>use.</em></h2>
            <p>Bring your discipline. Leave with proof that it works.</p>
            <Link className="round-button cream" href="/signup">Apply to Udyaan <ArrowRightIcon /></Link>
          </div>
          <div className="cta-plant" aria-hidden="true">
            <Image src="/farmland-poster.jpg" alt="" fill sizes="40vw" />
          </div>
          <span className="cta-index">JAIN GROUP / UDYAAN / 2026</span>
        </section>
      </main>
      <Footer />
    </div>
  );
}
