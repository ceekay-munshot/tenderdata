import { Eye, AlertTriangle, Banknote, Activity, Gauge } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CriticalEvents } from "@/components/dashboard/critical-events";
import { DisclosureFeed } from "@/components/dashboard/disclosure-feed";
import { WatchlistSnapshot } from "@/components/dashboard/watchlist-snapshot";
import { BLSSpotlight } from "@/components/dashboard/bls-spotlight";
import { companyList, tenders, disclosures } from "@/lib/mock-data";
import { formatINR } from "@/lib/utils";

export default function DashboardPage() {
  const upcoming7d = tenders.flatMap((t) =>
    t.milestones.filter((m) => {
      const days = (new Date(m.date).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7 && m.type === "financial_bid_opening";
    }),
  ).length;
  const criticalDisc = disclosures.filter((d) => d.severity === "critical").length;
  const totalTendered = tenders.reduce((s, t) => s + (t.estimatedValue ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <PageHero />

      <BLSSpotlight />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Watchlist"
          value={companyList.length}
          sub={`${companyList.filter((c) => c.signalScore >= 70).length} on high alert`}
          icon={Eye}
          accent="primary"
          delta={{ value: "+2", tone: "neutral" }}
        />
        <StatCard
          label="D-Days in 7 Days"
          value={upcoming7d}
          sub="Financial bid openings"
          icon={Banknote}
          accent="critical"
          delta={{ value: "+1", tone: "critical" }}
        />
        <StatCard
          label="Critical Disclosures"
          value={criticalDisc}
          sub="Last 30 days"
          icon={AlertTriangle}
          accent="critical"
          delta={{ value: "+3", tone: "critical" }}
        />
        <StatCard
          label="Tracked Tender Value"
          value={formatINR(totalTendered)}
          sub="Across watchlist tenders"
          icon={Gauge}
          accent="positive"
          delta={{ value: "+12%", tone: "positive" }}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CriticalEvents />
        <DisclosureFeed />
      </section>

      <section>
        <WatchlistSnapshot />
      </section>

      <Footer />
    </div>
  );
}

function PageHero() {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3 w-3 text-positive" />
        <span>All systems operational</span>
        <span>·</span>
        <span className="tabular">Last sync 14s ago</span>
      </div>
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
          <p className="text-sm text-muted-foreground">
            Predict tender D-days. Tag SEBI signals. Position before the tape.
          </p>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground sm:flex-row">
      <div>
        Sources: CPPP · GeM · BSE Announcements · NSE Announcements · SEBI Orders · State Tender Portals
      </div>
      <div className="flex items-center gap-3">
        <span>Last ingestion: 14s ago</span>
        <span>·</span>
        <span>v0.1 preview</span>
      </div>
    </div>
  );
}
