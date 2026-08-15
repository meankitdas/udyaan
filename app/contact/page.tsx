import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, ArrowUpRightIcon } from "@/components/Icons";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the Udyaan team at JAIN (Deemed-to-be University) about the farmland internship program, partnerships, or applying. Email support@udyaan.org — we typically reply within 1–2 business days.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="contact-page">
      <div className="contact-container">
        <Link className="back-link" href="/"><ArrowLeftIcon /> Back to Home</Link>

        <header className="contact-header">
          <p className="contact-kicker">Get in touch</p>
          <h1>Let&apos;s build something<br />worth talking about.</h1>
          <p className="contact-lead">
            Questions about the program, partnerships, or applying to Udyaan?
            Reach out and the team will get back to you.
          </p>
        </header>

        <a className="contact-card" href="mailto:support@udyaan.org">
          <div className="contact-card-body">
            <span className="contact-card-label">Email us</span>
            <span className="contact-card-value">support@udyaan.org</span>
            <span className="contact-card-note">We typically reply within 1&ndash;2 business days.</span>
          </div>
          <span className="contact-card-icon"><ArrowUpRightIcon /></span>
        </a>

        <p className="contact-footnote">JAIN GROUP / UDYAAN / 2026</p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd([{ name: "Contact", path: "/contact" }])),
        }}
      />
    </main>
  );
}
