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
  "Udyaan is a university-powered venture-building platform from JAIN (Deemed-to-be University). Real problems meet student builders, expert mentors and a structured path through building, validation, adoption, research and possible ventures.";

export const KEYWORDS = [
  "Udyaan",
  "Udyaan JAIN University",
  "university venture building",
  "student builders India",
  "industry problem solving",
  "applied student research",
  "cross-disciplinary innovation",
  "JAIN Deemed-to-be University innovation",
  "problem to venture platform",
  "student incubation India",
];

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const OG_IMAGE = {
  url: absoluteUrl("/udyaan-greenhouse.jpg"),
  width: 1800,
  height: 1200,
  alt: "A working greenhouse representing real-world systems student builders can investigate",
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
      "Udyaan is a university-led venture-building platform where real problems are matched with student builders, supported by mentors and taken through a structured build-and-validation process. Work can continue toward company adoption, research, intellectual property or a student-led venture.",
  },
  {
    question: "Do I need my own startup idea to join?",
    answer:
      "No. You can start by exploring a problem from Udyaan. Different challenges need technical, design, data, business, research, operations and domain capabilities. Team composition is driven by the problem, not a single discipline.",
  },
  {
    question: "How are students selected and teams formed?",
    answer:
      "Selection focuses on reasoning, curiosity, ownership, practical judgement, collaboration and the ability to work through uncertainty. Selected students are matched to the problem and team where their capabilities fit. The team confirms the applicable assessment stages and availability for each intake.",
  },
  {
    question: "Can a company bring a problem?",
    answer:
      "Yes. Companies and other problem owners can share a non-confidential brief with the team. Udyaan reviews fit, frames the challenge and agrees scope, feedback points and project terms before a build begins.",
  },
  {
    question: "What happens after a solution is validated?",
    answer:
      "The next step can be a company pilot or adoption, further research or IP development, iteration, or a student-led venture. Not every project becomes a company. The evidence and relevant agreements determine the route forward.",
  },
  {
    question: "Who owns the solution or intellectual property?",
    answer:
      "Ownership depends on the project, contributor roles, agreements and applicable university or partner terms. The relevant arrangements should be established before substantial build activity begins. Continuing a student venture is subject to those arrangements.",
  },
  {
    question: "What support is available during and after the build?",
    answer:
      "Support can include faculty and domain mentors, technical and product guidance, research, business and market input, IP pathways and incubation support. Academic integration, stipend eligibility, facilities and any capital introductions are confirmed for the project, not guaranteed for every participant.",
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
          "Student venture building",
          "Problem validation",
          "Company adoption and applied research",
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

/** Platform + FAQ graph for the homepage. */
export function homepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": absoluteUrl("/#platform"),
        name: "Udyaan Venture-Building Platform",
        description: DEFAULT_DESCRIPTION,
        url: SITE_URL,
        provider: { "@id": absoluteUrl("/#organization") },
        serviceType: "Problem solving, applied learning and venture building",
        areaServed: { "@type": "Country", name: "India" },
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
