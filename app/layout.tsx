import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import "./portal.css";

export const metadata: Metadata = {
  title: {
    default: "Udyaan",
    template: "%s | Udyaan",
  },
  description:
    "Udyaan is an immersive farmland internship program for hands-on learning, cross-disciplinary collaboration, and sustainable impact.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
