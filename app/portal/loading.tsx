import PortalSkeleton from "@/components/portal/PortalSkeleton";

/** Next.js route-transition fallback before individual client components mount. */
export default function PortalLoading() {
  return (
    <main className="portal-route-loading">
      <div className="dashboard-layout portal-route-loading-scope">
        <PortalSkeleton variant="dashboard" />
      </div>
    </main>
  );
}
