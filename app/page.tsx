import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/Brand";
import { Footer } from "@/components/Footer";
import { HeroVideo } from "@/components/HeroVideo";
import { ArrowDownIcon, ArrowRightIcon } from "@/components/Icons";
import { FAQS, homepageJsonLd } from "@/lib/seo";

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
        <section className="cinematic-hero" aria-labelledby="hero-title">
          <HeroVideo />
          <div className="cinematic-shade" aria-hidden="true" />

          <div className="cinematic-copy">
            <p className="cinematic-kicker">1,000 acres / every discipline / real stakes</p>
            <h1 id="hero-title">Udyaan is a<br />living lab for<br /><em>ideas that matter.</em></h1>
            <p className="cinematic-description">
              Choose a problem in food, water, energy, or waste. Build with people
              outside your major. Leave with proof that your idea works.
            </p>
            <div className="cinematic-actions">
              <Link className="cinematic-primary" href="/survey">Apply for 2026 <ArrowRightIcon /></Link>
              <Link className="cinematic-secondary" href="#projects">Explore the work <ArrowDownIcon /></Link>
            </div>
          </div>

          <div className="challenge-rail" aria-label="Choose a challenge area">
            <div className="challenge-intro">
              <span>Start with a problem</span>
              <strong>Where will you begin?</strong>
            </div>
            <Link href="#projects"><span>01</span><strong>Food</strong><small>Grow more with less</small></Link>
            <Link href="#projects"><span>02</span><strong>Water</strong><small>Make every drop count</small></Link>
            <Link href="#projects"><span>03</span><strong>Energy</strong><small>Power the living lab</small></Link>
            <Link href="#projects"><span>04</span><strong>Waste</strong><small>Design the next use</small></Link>
          </div>

          <a className="cinematic-scroll" href="#projects" aria-label="Scroll to explore">
            <span>Scroll</span>
            <ArrowDownIcon />
          </a>

          <p className="cinematic-credit">Film: Serg Alesenko / Pexels</p>
        </section>

        <section className="student-promise" aria-labelledby="student-promise-title">
          <div className="promise-media">
            <Image
              src="/udyaan-greenhouse.jpg"
              alt="Rows of crops growing inside a working greenhouse"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
            <div className="promise-caption">
              <span>Field note / 01</span>
              <strong>Real conditions.<br />Real consequences.</strong>
            </div>
            <small className="promise-credit">Photo: Mark Stebnicki / Pexels</small>
          </div>
          <div className="promise-copy">
            <p className="kicker">Not another classroom exercise</p>
            <h2 id="student-promise-title">Leave with more<br />than a <em>grade.</em></h2>
            <p className="promise-lead">
              The work is physical, technical, collaborative, and visible. You will make
              decisions with real constraints, collect evidence, and defend what you built.
            </p>
            <div className="promise-outcomes">
              <article>
                <span>01</span>
                <div><h3>Work worth showing</h3><p>A tested prototype, field evidence, and a story your portfolio can prove.</p></div>
              </article>
              <article>
                <span>02</span>
                <div><h3>People worth building with</h3><p>Teammates across disciplines, with faculty and industry mentors in the loop.</p></div>
              </article>
              <article>
                <span>03</span>
                <div><h3>A real next move</h3><p>Strong work can continue toward research, IP, incubation, or a market pilot.</p></div>
              </article>
            </div>
          </div>
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
            <svg className="lab-flow" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
              <path d="M192 145 C 430 145, 400 280, 600 280" />
              <path d="M192 426 C 430 426, 400 280, 600 280" />
              <path d="M1008 145 C 770 145, 800 280, 600 280" />
              <path d="M1008 426 C 770 426, 800 280, 600 280" />
            </svg>
            <div className="lab-hub" aria-hidden="true">
              <span className="lab-hub-kicker">Udyaan campus</span>
              <strong>One living system</strong>
              <small>1,000 acres · real stakes</small>
            </div>
            <ul className="lab-nodes" aria-label="Living lab systems">
              <li className="lab-node" style={{ top: "26%", left: "16%" }}>
                <span className="lab-node-num">01 / Sense</span>
                <strong>Precision sensing</strong>
                <p>Field sensors and drone telemetry stream live crop, soil, and water data.</p>
              </li>
              <li className="lab-node" style={{ top: "76%", left: "16%" }}>
                <span className="lab-node-num">02 / Grow</span>
                <strong>Controlled cultivation</strong>
                <p>Greenhouse and hydroponic systems run year-round crop experiments.</p>
              </li>
              <li className="lab-node" style={{ top: "26%", left: "84%" }}>
                <span className="lab-node-num">03 / Power</span>
                <strong>Renewable operations</strong>
                <p>Solar arrays and bio-energy keep the campus loops running.</p>
              </li>
              <li className="lab-node" style={{ top: "76%", left: "84%" }}>
                <span className="lab-node-num">04 / Return</span>
                <strong>Circular bioeconomy</strong>
                <p>Waste streams come back as feed, fuel, and fertilizer.</p>
              </li>
            </ul>
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

        <section className="faq-section" id="faq" aria-labelledby="faq-title">
          <div className="faq-heading">
            <p className="kicker">Questions, answered</p>
            <h2 id="faq-title">What people ask <em>before applying.</em></h2>
            <p>
              Everything below reflects how the program actually runs. If your question
              is not here, <Link href="/contact">ask us directly</Link>.
            </p>
          </div>
          <div className="faq-list">
            {FAQS.map((faq) => (
              <details className="faq-item" key={faq.question}>
                <summary>
                  <h3>{faq.question}</h3>
                  <span className="faq-marker" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="cta-copy">
            <p className="kicker light">Applications are open</p>
            <h2>Build something<br />the world can <em>use.</em></h2>
            <p>Bring your discipline. Leave with proof that it works.</p>
            <Link className="round-button cream" href="/signup">Apply to Udyaan <ArrowRightIcon /></Link>
          </div>
          <div className="cta-plant" aria-hidden="true">
            <Image src="/udyaan-greenhouse.jpg" alt="" fill sizes="40vw" />
          </div>
          <span className="cta-index">JAIN GROUP / UDYAAN / 2026</span>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd()) }}
      />
    </div>
  );
}
