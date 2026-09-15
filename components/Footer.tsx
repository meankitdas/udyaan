import Image from "next/image";
import Link from "next/link";
import styles from "@/components/public/PublicSite.module.css";

export function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.footerTop}>
      <div className={styles.footerAbout}><Link href="/" className={styles.footerBrand}><Image src="/udyaan-logo.png" alt="" width={38} height={33} />udyaan.</Link><p>A university-powered platform for real problems, real building and venture creation.</p></div>
      <nav aria-label="Explore Udyaan"><span>The platform</span><Link href="/problems">Problems</Link><Link href="/how-it-works">How it works</Link><Link href="/ventures">Ventures</Link><Link href="/about">About Udyaan</Link></nav>
      <nav aria-label="Join Udyaan"><span>Find your route</span><Link href="/for-students">For students</Link><Link href="/for-companies">For companies</Link><Link href="/join">Join Udyaan</Link><Link href="/submit-problem">Bring a problem</Link><Link href="/login">Sign in</Link></nav>
      <nav aria-label="Resources and legal"><span>Stay connected</span><Link href="/contact">Contact</Link><Link href="/living-lab">The living lab</Link><Link href="/drone-irrigation">Drone simulator</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms &amp; conditions</Link></nav>
    </div>
    <div className={styles.footerBottom}><span>&copy; {new Date().getFullYear()} JAIN (Deemed-to-be University). All rights reserved.</span><Image src="/jain-group-logo.png" alt="JAIN Group" width={164} height={36} /></div>
  </footer>;
}