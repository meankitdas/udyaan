// Single source of truth for SEO metadata and structured data.
//
// The FAQ entries below are rendered on the homepage AND emitted as FAQPage
// JSON-LD. Keep them in sync — Google penalises schema whose answers are not
// visible on the page, so both must read from this one array.

import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.udyaan.org";

export const SITE_NAME = "Udyaan";
export const CONTACT_EMAIL = "support@udyaan.org";

/** Verified from jainuniversity.ac.in — used to tie Udyaan to the parent entity. */
export const PARENT_ORG = {
  name: "JAIN (Deemed-to-be University)",
  alternateName: "Jain Group of Institutions",
  url: "https://www.jainuniversity.ac.in/",
  sameAs: [
    "https://www.jainuniversity.ac.in/",
    "https://www.linkedin.com/school/jaindeemedtobeuniversity",
    "https://www.facebook.com/JainDeemedtobeUniversityofficial",
    "https://www.instagram.com/jainuniversityofficial/",
    "https://www.youtube.com/c/JainDeemedtobeUniversity",
    "https://twitter.com/JainDeemedtbUnv",
  ],
} as const;

export const DEFAULT_DESCRIPTION =
  "Udyaan is a 1,000-acre living lab and paid farmland internship from JAIN (Deemed-to-be University). Students across engineering, sciences, design, business and policy build real prototypes in agritech, food, water, energy and waste — and leave with proof their idea works.";

export const KEYWORDS = [
  "Udyaan",
  "Udyaan JAIN University",
  "farmland internship India",
  "agritech internship Bangalore",
  "paid internship for students India",
  "living lab agriculture",
  "precision agriculture internship",
  "hydroponics internship",
  "sustainability internship India",
  "interdisciplinary student research program",
  "JAIN Deemed-to-be University internship",
  "student incubation India",
];

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const OG_IMAGE = {
  url: absoluteUrl("/udyaan-aerial-poster.jpg"),
  width: 1920,
  height: 1080,
  alt: "Aerial view of the Udyaan living lab farmland campus",
};

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

/** Builds per-page metadata with the canonical URL and social cards filled in. */
export function pageMetadata({ title, description, path, noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_IN",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [OG_IMAGE.url],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export const FAQS: { question: string; answer: string }[] = [
  {
    question: "What is Udyaan?",
    answer:
      "Udyaan is a 1,000-acre living lab run by JAIN (Deemed-to-be University), where students take on real problems in food, water, energy and waste. Instead of passive assignments, you spend a semester on field projects that produce measurable results — and the farm doubles as shared infrastructure for teaching, research, prototyping and enterprise.",
  },
  {
    question: "Who can apply to the Udyaan internship?",
    answer:
      "Udyaan is deliberately cross-disciplinary. Students from engineering and automation, life sciences, food technology, design and creative arts, business and commerce, humanities and policy, data and AI, and sustainability all have a place in the field. Teams are built across majors on purpose.",
  },
  {
    question: "How does the Udyaan selection process work?",
    answer:
      "Selection runs in three phases. Phase one is an initial filter using a pitch-deck resume and a cognitive assessment. Phase two is 'the mud test' — a one-day field boot camp that measures resilience, observation and collaboration through work you cannot do from a desk. Phase three is the boardroom, where you turn field insight into a commercial story and defend it before a cross-functional panel.",
  },
  {
    question: "Is the Udyaan internship paid?",
    answer:
      "Yes. Udyaan offers a monthly stipend pathway of INR 15,000, subject to project eligibility and current program terms. Interns also get faculty and industry mentorship, and access to incubation and investor-readiness support through the technology business incubator.",
  },
  {
    question: "How long is the program and what does it involve?",
    answer:
      "The core is a four-week interdisciplinary sprint. Week one is research and strategy, turning a broad challenge into a testable brief. Week two is prototyping and field testing. Week three covers production, financial viability, safety, compliance and intellectual-property pathways. Week four is the exhibit and launch, where you present the proof and publish what you learned.",
  },
  {
    question: "Do students earn academic credit at Udyaan?",
    answer:
      "Yes. Semester-long field projects replace passive assignments, and students earn academic credit by solving measurable, real-world problems. Strong work can continue further into research, patents and publications, incubation, or a market pilot.",
  },
  {
    question: "What kinds of projects run at Udyaan?",
    answer:
      "Current project tracks include drone and robot precision farming for multispectral scouting and precision spraying, vertical microgreens in controlled environments, hydro-aeroponic systems targeting large reductions in water use, and a circular bioeconomy Bio-CNG living lab covering feedstock logistics, process biology and compliance.",
  },
  {
    question: "What do students leave Udyaan with?",
    answer:
      "A tested prototype, evidence collected in the field, and a portfolio you can defend. You also leave with teammates from other disciplines, faculty and industry mentors, and a route forward — research, intellectual property, incubation or a market pilot.",
  },
];

/** Organization + WebSite graph. Rendered once in the root layout. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "Organization"],
        "@id": absoluteUrl("/#organization"),
        name: SITE_NAME,
        alternateName: "Udyaan by JAIN",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/udyaan-logo.png"),
        },
        image: OG_IMAGE.url,
        description: DEFAULT_DESCRIPTION,
        email: CONTACT_EMAIL,
        parentOrganization: {
          "@type": "CollegeOrUniversity",
          "@id": absoluteUrl("/#parent-organization"),
          name: PARENT_ORG.name,
          alternateName: PARENT_ORG.alternateName,
          url: PARENT_ORG.url,
          sameAs: [...PARENT_ORG.sameAs],
        },
        areaServed: { "@type": "Country", name: "India" },
        knowsAbout: [
          "Precision agriculture",
          "Hydroponics and aeroponics",
          "Vertical farming",
          "Circular bioeconomy",
          "Bio-CNG",
          "Agricultural robotics",
          "Sustainable food systems",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "admissions",
          email: CONTACT_EMAIL,
          url: absoluteUrl("/contact"),
          availableLanguage: ["en"],
        },
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: SITE_URL,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": absoluteUrl("/#organization") },
        inLanguage: "en-IN",
      },
    ],
  };
}

/** Program + FAQ graph for the homepage. */
export function homepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOccupationalProgram",
        "@id": absoluteUrl("/#program"),
        name: "Udyaan Farmland Internship Program",
        description:
          "An immersive, cross-disciplinary farmland internship where students build and field-test prototypes in food, water, energy and waste systems across a 1,000-acre living lab.",
        url: SITE_URL,
        provider: { "@id": absoluteUrl("/#organization") },
        programType: "Internship",
        educationalProgramMode: "full-time",
        timeToComplete: "P4W",
        occupationalCategory: [
          "Agricultural engineering",
          "Sustainability",
          "Food technology",
          "Research and development",
        ],
        offers: {
          "@type": "Offer",
          category: "Paid internship",
          availability: "https://schema.org/InStock",
          url: absoluteUrl("/signup"),
        },
        salaryUponCompletion: {
          "@type": "MonetaryAmountDistribution",
          name: "Monthly stipend pathway",
          currency: "INR",
          duration: "P1M",
          median: 15000,
        },
      },
      {
        "@type": "FAQPage",
        "@id": absoluteUrl("/#faq"),
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

/** Breadcrumbs for interior public pages. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...items].map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
