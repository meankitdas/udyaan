"use client";

/**
 * Shared portal loading placeholders.
 *
 * Skeletons mirror the stable geometry of the destination view so navigation
 * does not jump when data arrives. They are intentionally neutral: no fake
 * numbers or labels that could be mistaken for loaded information.
 */

type Variant = "profile" | "dashboard" | "table" | "detail" | "workspace";

type Props = {
  variant?: Variant;
  rows?: number;
  compact?: boolean;
};

function Line({ width = "100%", size = "md" }: { width?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  return <span className={`portal-skeleton-line is-${size}`} style={{ width }} />;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`portal-skeleton-card ${className}`}>{children}</div>;
}

function TableRows({ rows }: { rows: number }) {
  return (
    <div className="portal-skeleton-table">
      <div className="portal-skeleton-tr is-head">
        {["32%", "18%", "18%", "15%"].map((width, index) => <Line key={index} width={width} size="xs" />)}
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div className="portal-skeleton-tr" key={index}>
          <span className="portal-skeleton-with-avatar"><i /><Line width={`${60 + (index % 3) * 10}%`} size="sm" /></span>
          <Line width="70%" size="sm" />
          <Line width="55%" size="sm" />
          <Line width="42%" size="sm" />
        </div>
      ))}
    </div>
  );
}

export default function PortalSkeleton({ variant = "dashboard", rows = 5, compact = false }: Props) {
  if (variant === "table") {
    return (
      <div className={`portal-skeleton ${compact ? "is-compact" : ""}`} role="status" aria-label="Loading content" aria-busy="true">
        <Card>
          <div className="portal-skeleton-head"><div><Line width="180px" size="lg" /><Line width="310px" size="sm" /></div><span className="portal-skeleton-button" /></div>
          <TableRows rows={rows} />
        </Card>
        <span className="sr-only">Loading content</span>
      </div>
    );
  }

  if (variant === "profile") {
    return (
      <div className="portal-skeleton" role="status" aria-label="Loading profile" aria-busy="true">
        <Card>
          <div className="portal-skeleton-profile-head"><span className="portal-skeleton-avatar is-large" /><div><Line width="190px" size="lg" /><Line width="105px" size="sm" /></div></div>
          <div className="portal-skeleton-profile-grid">
            {[0, 1].map((group) => <div key={group}>{[0, 1, 2].map((item) => <div className="portal-skeleton-field" key={item}><Line width="90px" size="xs" /><Line width={`${150 + item * 25}px`} size="sm" /></div>)}</div>)}
          </div>
        </Card>
        <span className="sr-only">Loading profile</span>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="portal-skeleton" role="status" aria-label="Loading project" aria-busy="true">
        <Card><div className="portal-skeleton-head"><div><Line width="260px" size="lg" /><Line width="150px" size="sm" /></div><span className="portal-skeleton-pill" /></div><div className="portal-skeleton-kpis">{Array.from({ length: 3 }, (_, i) => <div key={i}><Line width="70px" size="xs" /><Line width={`${90 + i * 15}px`} size="lg" /></div>)}</div></Card>
        <div className="portal-skeleton-split"><Card><Line width="190px" size="lg" />{["92%", "78%", "86%", "64%"].map((w, i) => <Line key={i} width={w} size="sm" />)}</Card><Card><Line width="130px" size="lg" />{Array.from({ length: 3 }, (_, i) => <span className="portal-skeleton-person" key={i}><i /><Line width="65%" size="sm" /></span>)}</Card></div>
        <span className="sr-only">Loading project</span>
      </div>
    );
  }

  if (variant === "workspace") {
    return (
      <div className={`portal-skeleton ${compact ? "is-compact" : ""}`} role="status" aria-label="Loading workspace" aria-busy="true">
        <Card><div className="portal-skeleton-head"><div><Line width="220px" size="lg" /><Line width="360px" size="sm" /></div><span className="portal-skeleton-button" /></div><div className="portal-skeleton-canvas"><span /><span /><span /></div></Card>
        <span className="sr-only">Loading workspace</span>
      </div>
    );
  }

  return (
    <div className={`portal-skeleton ${compact ? "is-compact" : ""}`} role="status" aria-label="Loading dashboard" aria-busy="true">
      <Card><div className="portal-skeleton-head"><div><Line width="235px" size="lg" /><Line width="390px" size="sm" /></div><span className="portal-skeleton-button" /></div><div className="portal-skeleton-kpis">{Array.from({ length: 4 }, (_, i) => <div key={i}><Line width="75px" size="xs" /><Line width={`${60 + i * 8}px`} size="lg" /><Line width="105px" size="xs" /></div>)}</div></Card>
      <div className="portal-skeleton-split"><Card><Line width="160px" size="lg" /><div className="portal-skeleton-chart">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ height: `${25 + ((i * 17) % 65)}%` }} />)}</div></Card><Card><Line width="145px" size="lg" /><div className="portal-skeleton-donut" /><div className="portal-skeleton-legend"><Line width="80px" size="xs" /><Line width="95px" size="xs" /></div></Card></div>
      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
