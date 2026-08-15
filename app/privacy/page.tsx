import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Jain Group of Institutions collects, uses, discloses, and safeguards your information on the Udyaan platform, including your rights over your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      updated="15/7/2026"
      sections={[
        { heading: "Introduction", content: <p>Jain Group of Institutions operates the Udyaan platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform.</p> },
        { heading: "Information We Collect", content: <ul><li>Account information, including your name, email, phone, organization, and role.</li><li>Usage data about how you interact with the Platform.</li><li>Device and log data, such as IP address, browser type, and access times.</li></ul> },
        { heading: "How We Use Your Information", content: <ul><li>Provide, operate, and improve the Platform.</li><li>Authenticate users and maintain account security.</li><li>Send transactional and service-related emails.</li><li>Comply with legal obligations and produce aggregate analytics.</li></ul> },
        { heading: "Sharing of Information", content: <><p>We may share information with your institution and authorized mentors, confidential service providers, and legal authorities when required.</p><p>We do not sell your personal information.</p></> },
        { heading: "Data Security", content: <p>We use appropriate measures, including encryption and access controls, to protect your information. You are responsible for keeping your password confidential.</p> },
        { heading: "Data Retention", content: <p>We retain your information while your account is active or as needed to provide services and meet legal obligations.</p> },
        { heading: "Your Rights", content: <p>You may request to access, correct, or delete your information, or object to certain processing, by contacting us through the Platform.</p> },
        { heading: "Cookies", content: <p>We may use cookies to maintain sessions and analyze usage. You can control cookies through your browser settings.</p> },
        { heading: "Changes to This Policy", content: <p>We may update this policy and will post changes with a revised date.</p> },
        { heading: "Contact Us", content: <p>Contact us through the Platform or your institution with privacy questions.</p> },
      ]}
    />
  );
}
