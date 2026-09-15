"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import styles from "./Brand.module.css";

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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    ["Problems", "/problems"],
    ["How it works", "/how-it-works"],
    ["Ventures", "/ventures"],
    ["For students", "/for-students"],
    ["For companies", "/for-companies"],
    ["About", "/about"],
  ];

  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);

  return (
    <header className={styles.header}>
      <a className={styles.skip} href="#main-content">Skip to content</a>
      <Link className={styles.brand} href="/" onClick={() => setMenuOpen(false)} aria-label="Udyaan home">
        <Image src="/udyaan-logo.png" alt="" width={42} height={36} priority />
        <span>udyaan<span className={styles.brandDot}>.</span></span>
      </Link>
      <nav className={styles.desktopNav} aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className={styles.actions}>
        <Link className={styles.signin} href="/login">Sign in</Link>
        <Link className={styles.join} href="/join">Join Udyaan <ArrowUpRight size={16} /></Link>
        <button className={styles.menuButton} type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="public-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <nav id="public-mobile-nav" className={styles.mobileNav} aria-label="Mobile navigation" hidden={!menuOpen}>
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={pathname.startsWith(href) ? "page" : undefined}>{label}<ArrowUpRight size={18} /></Link>)}
        <Link href="/submit-problem" onClick={() => setMenuOpen(false)}>Bring a problem<ArrowUpRight size={18} /></Link>
        <Link href="/login" onClick={() => setMenuOpen(false)}>Sign in<ArrowUpRight size={18} /></Link>
      </nav>
    </header>
  );
}
