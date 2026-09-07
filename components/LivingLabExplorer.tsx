"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, MapPin, RadioTower, Recycle, Sprout, Sun } from "lucide-react";
import styles from "./LivingLabExplorer.module.css";

const systems = [
  {
    id: "sense", number: "01", label: "Sense", icon: RadioTower, color: "#b7dce2",
    title: "Precision sensing",
    description: "Understand the field before changing it. Crop, soil, and water observations become evidence for better decisions on the ground.",
    image: "/udyaan-aerial-poster.jpg", alt: "An aerial view of cultivated fields and the landscape around them",
    caption: "A different perspective on the field.", credit: "Serg Alesenko / Pexels",
    activities: ["Drone mapping + crop scouting", "Soil and moisture sensing", "Field data + decision models"],
    connection: "Field observations guide what we grow next.",
    link: "/drone-irrigation", action: "Enter the drone simulator",
  },
  {
    id: "grow", number: "02", label: "Grow", icon: Sprout, color: "#dbe76e",
    title: "Controlled cultivation",
    description: "Turn growing conditions into a research question. Greenhouse and hydroponic systems connect crop trials with water, nutrition, and yield.",
    image: "/udyaan-greenhouse.jpg", alt: "Rows of crops growing inside a working greenhouse",
    caption: "Small experiments. Tangible outcomes.", credit: "Mark Stebnicki / Pexels",
    activities: ["Greenhouse + hydroponic trials", "Water and nutrient management", "Crop performance + harvest records"],
    connection: "Cultivation turns field insight into measurable results.",
    link: "#projects", action: "Explore growing projects",
  },
  {
    id: "power", number: "03", label: "Power", icon: Sun, color: "#e8c982",
    title: "Renewable operations",
    description: "Follow energy from source to use. Solar and bio-energy projects connect the campus's everyday needs with practical engineering and enterprise.",
    image: "/lab-solar.jpg", alt: "Solar panels capturing sunlight in an open landscape",
    caption: "Energy that keeps the work moving.", credit: "Unsplash",
    activities: ["Solar + bio-energy systems", "Energy use and operating efficiency", "Performance + commercial viability"],
    connection: "Renewable energy supports the campus's working systems.",
    link: "#projects", action: "Explore energy projects",
  },
  {
    id: "return", number: "04", label: "Return", icon: Recycle, color: "#dfb19a",
    title: "Circular bioeconomy",
    description: "A harvest is not the end of the cycle. Organic materials become the starting point for new work in feed, fuel, fertilizer, and resource recovery.",
    image: "/lab-soil.jpg", alt: "A garden trowel and plant pots surrounded by rich soil on a planting bench",
    caption: "The next cycle starts here.", credit: "Unsplash",
    activities: ["Organic material + feedstock flows", "Bio-CNG and nutrient recovery", "Resource loops + business cases"],
    connection: "Recovered resources return value to the next growing cycle.",
    link: "#projects", action: "Explore circular projects",
  },
] as const;

export default function LivingLabExplorer() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % systems.length;
    else if (event.key === "ArrowLeft") next = (index + systems.length - 1) % systems.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = systems.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section className={styles.section} id="lab" aria-labelledby="lab-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>One campus. Connected systems.</p>
            <h2 id="lab-title">A living lab you can <em>walk through.</em></h2>
          </div>
          <div className={styles.overview}>
            <p>Every zone produces more than crops. It produces operational data, research questions, prototypes, and work you can put in a portfolio.</p>
            <div className={styles.footprint}><MapPin size={15} /><span>1,000 acres</span><span className={styles.separator} /><span>Four connected systems</span></div>
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Living lab systems">
          {systems.map((system, index) => {
            const Icon = system.icon;
            return <button type="button" key={system.id} ref={(element) => { tabs.current[index] = element; }}
              role="tab" id={`lab-tab-${system.id}`} aria-controls={`lab-panel-${system.id}`} aria-selected={active === index}
              tabIndex={active === index ? 0 : -1} className={styles.tab} style={{ "--system-color": system.color } as CSSProperties}
              onClick={() => setActive(index)} onKeyDown={(event) => navigateTabs(event, index)}>
              <span className={styles.number}>{system.number}</span><span className={styles.tabLabel}>{system.label}</span><Icon size={21} strokeWidth={1.5} />
            </button>;
          })}
        </div>

        {systems.map((system, index) => (
          <div key={system.id} role="tabpanel" id={`lab-panel-${system.id}`} aria-labelledby={`lab-tab-${system.id}`} hidden={active !== index}
            tabIndex={0} className={styles.panel} style={{ "--system-color": system.color } as CSSProperties}>
            <figure className={styles.media}>
              <Image src={system.image} alt={system.alt} fill sizes="(max-width: 900px) 100vw, 58vw" quality={85} />
              <div className={styles.photoIndex} aria-hidden="true"><span>{system.number}</span><span>/ 04</span></div>
              <figcaption className={styles.caption}><span>Field perspective / {system.label}</span><strong>{system.caption}</strong></figcaption>
              <small className={styles.credit}>Photo: {system.credit}</small>
            </figure>
            <div className={styles.story}>
              <div className={styles.storyTop}><span>FIELD SYSTEM {system.number}</span><ArrowDownRight size={22} strokeWidth={1.3} /></div>
              <h3>{system.title}</h3>
              <p className={styles.description}>{system.description}</p>
              <div className={styles.fieldwork}>
                <h4>On the ground</h4>
                <ul>{system.activities.map((activity) => <li key={activity}><span />{activity}</li>)}</ul>
              </div>
              <Link href={system.link} className={styles.action}>{system.action}<ArrowUpRight size={19} /></Link>
            </div>
            <div className={styles.connection}><Recycle size={17} strokeWidth={1.5} /><p>{system.connection}</p><span>One living system</span></div>
          </div>
        ))}

        <div className={styles.closing}><p>Shared land. Shared learning.<strong>Connected by the work.</strong></p><Link href="#projects">Find your project<ArrowRight size={18} /></Link></div>
      </div>
    </section>
  );
}