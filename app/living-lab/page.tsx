import LivingLabExplorer from "@/components/LivingLabExplorer";
import { Closing, PageIntro, PublicShell } from "@/components/public/Site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "The Living Lab", description: "Explore the connected sensing, growing, energy and circular systems that support real-world building at Udyaan.", path: "/living-lab" });

export default function LivingLabPage() {
  return <PublicShell crumbs={[{ name: "About", path: "/about" }, { name: "Living lab", path: "/living-lab" }]}><PageIntro label="The environment behind the work" title="Real conditions. Real consequences." text="The living lab is the testing environment, not the whole story. Connected systems give teams a place to understand a problem, test assumptions and collect evidence." /><LivingLabExplorer /><Closing /></PublicShell>;
}