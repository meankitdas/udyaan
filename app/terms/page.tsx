import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms and Conditions",
  description:
    "The terms governing use of the Udyaan platform, operated by Jain Group of Institutions — covering acceptance, accounts, acceptable use, and intellectual property.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms and Conditions"
      updated="15/7/2026"
      sections={[
        { heading: "Acceptance of Terms", content: <p>By accessing and using the Udyaan platform operated by Jain Group of Institutions, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.</p> },
        { heading: "Description of Service", content: <p>Udyaan is an internship and project management platform connecting students with experiential learning opportunities, including farmland internships, industry projects, and cross-disciplinary collaboration.</p> },
        { heading: "Eligibility and Registration", content: <p>You must be a registered user affiliated with an approved organization. You agree to provide accurate information and keep your account secure. You are responsible for all activity under your account.</p> },
        { heading: "User Conduct", content: <p>You agree to use the Platform lawfully. You must not misrepresent your identity, upload offensive or infringing content, attempt unauthorized access, or use the Platform for unauthorized commercial purposes.</p> },
        { heading: "Intellectual Property", content: <p>All content and functionality of the Platform are owned by Jain Group of Institutions or its licensors. You may not copy, modify, or distribute without express permission.</p> },
        { heading: "Limitation of Liability", content: <p>To the fullest extent permitted by law, we shall not be liable for any indirect or consequential damages arising from your use of the Platform.</p> },
        { heading: "Changes to Terms", content: <p>We may update these Terms from time to time. Continued use after changes constitutes acceptance of the new Terms.</p> },
        { heading: "Contact", content: <p>For questions about these Terms, please contact us through the details provided on the Platform or via your institution.</p> },
      ]}
    />
  );
}
