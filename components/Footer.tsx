import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand" aria-label="Udyaan by Jain Group of Institutions">
          <Image src="/udyaan-logo.png" alt="Udyaan" width={49} height={40} />
          <strong>Udyaan</strong>
          <Image className="footer-jgi" src="/jain-group-logo.png" alt="JAIN Group" width={164} height={36} />
        </div>
        <p>© 2026 JAIN Group. All rights reserved.</p>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/#model">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
          <Link href="/privacy">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
