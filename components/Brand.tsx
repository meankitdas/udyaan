import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/Icons";

type BrandProps = {
  compact?: boolean;
  showJgi?: boolean;
};

export function UdyaanBrand({ compact = false, showJgi = false }: BrandProps) {
  return (
    <div className={`brand-cluster${compact ? " compact" : ""}`}>
      <Link href="/" className="udyaan-brand" aria-label="Udyaan home">
        <Image src="/udyaan-logo.png" alt="" width={89} height={72} priority />
        <span>Udyaan</span>
      </Link>
      {showJgi && (
        <Image className="jgi-logo" src="/jain-group-logo.png" alt="JAIN Group" width={164} height={36} />
      )}
    </div>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <UdyaanBrand showJgi />
      <nav className="main-nav" aria-label="Main navigation">
        <Link href="/#model">The model</Link>
        <Link href="/#projects">Projects</Link>
        <Link href="/#journey">Journey</Link>
      </nav>
      <details className="mobile-nav">
        <summary aria-label="Open navigation"><span /><span /></summary>
        <nav aria-label="Mobile navigation">
          <Link href="/#model">The model</Link>
          <Link href="/#projects">Projects</Link>
          <Link href="/#journey">Journey</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </details>
      <div className="header-actions">
        <Link className="header-signin" href="/login">Sign in</Link>
        <Link className="header-apply" href="/survey">Apply now <ArrowUpRightIcon /></Link>
      </div>
    </header>
  );
}
