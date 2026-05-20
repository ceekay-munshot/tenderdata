"use client";

import { useMemo, useState } from "react";
import { Filter, Radio, Database, AlertTriangle, Clock } from "lucide-react";
import { RecentUpdates } from "@/components/tenders/recent-updates";
import { TenderCard } from "@/components/tenders/tender-card";
import { TenderDetail } from "@/components/tenders/tender-detail";
import { Card } from "@/components/ui/card";
import { exampleTenders, sortTenders, isWatched } from "@/lib/mock-data";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Tender, Update } from "@/lib/types";

type StatusFilter = "all" | "pending" | "result_in" | "awarded";

export interface TendersClientProps {
  bseUpdates: Update[];
  bseFetchedAt: string | null;
  bseStale: boolean;
  bseStatus: "ok" | "empty" | "missing" | "error";
  bseError?: string;
  /** Live tenders scraped from CPPP. */
  liveTenders: Tender[];
  cpppFetchedAt: string | null;
  cpppScanned: number;
  cpppStatus: "ok" | "empty" | "missing" | "error";
  cpppStale: boolean;
  cpppError?: string;
}

export function TendersClient({
  bseUpdates,
  bseFetchedAt,
  bseStale,
  bseStatus,
  bseError,
  liveTenders,
  cpppFetchedAt,
  cpppScanned,
  cpppStatus,
  cpppStale,
  cpppError,
}: TendersClientProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [watchOnly, setWatchOnly] = useState(false);

  // Live CPPP tenders first, then the badged BLS example tenders.
  const allTenders = useMemo(
    () => sortTenders([...liveTenders, ...exampleTenders]),
    [liveTenders],
  );

  const tenders = useMemo(() => {
    return allTenders.filter((t) => {
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && !(t.status === "pending" || t.status === "evaluation")) return false;
        if (statusFilter === "result_in" && t.status !== "result_in") return false;
        if (statusFilter === "awarded" && t.status !== "awarded") return false;
      }
      if (watchOnly && !t.bidders.some((b) => isWatched(b.ticker))) return false;
      return true;
    });
  }, [allTenders, statusFilter, watchOnly]);

  const counts = useMemo(() => {
    return {
      all: allTenders.length,
      pending: allTenders.filter((t) => t.status === "pending" || t.status === "evaluation").length,
      result_in: allTenders.filter((t) => t.status === "result_in").length,
      awarded: allTenders.filter((t) => t.status === "awarded").length,
    };
  }, [allTenders]);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Government tenders</h1>
        <p className="text-sm text-muted-foreground">
          Track who&apos;s bidding, when results drop, and what follows after.
        </p>
      </header>

      <RecentUpdates
        bseUpdates={bseUpdates}
        bseFetchedAt={bseFetchedAt}
        bseStale={bseStale}
        bseStatus={bseStatus}
        bseError={bseError}
        onSelectTender={setOpenId}
      />

      <CpppSourceBar
        liveCount={liveTenders.length}
        scanned={cpppScanned}
        fetchedAt={cpppFetchedAt}
        status={cpppStatus}
        stale={cpppStale}
        error={cpppError}
      />

      <Card className="border-dashed p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label="All" count={counts.all} />
            <Chip active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")} label="Pending" count={counts.pending} tone="warning" />
            <Chip active={statusFilter === "result_in"} onClick={() => setStatusFilter("result_in")} label="Result in" count={counts.result_in} tone="positive" />
            <Chip active={statusFilter === "awarded"} onClick={() => setStatusFilter("awarded")} label="Awarded" count={counts.awarded} tone="positive" />
          </div>
          <button
            onClick={() => setWatchOnly(!watchOnly)}
            className={cn(
              "ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
              watchOnly ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", watchOnly ? "bg-primary" : "bg-muted-foreground/40")} />
            Watchlist only
          </button>
        </div>
      </Card>

      <div className="space-y-3">
        {tenders.map((t) => (
          <TenderCard key={t.id} tender={t} onOpen={setOpenId} />
        ))}
        {tenders.length === 0 && (
          <Card className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No tenders match this filter.
          </Card>
        )}
      </div>

      <TenderDetail tenderId={openId} tenders={allTenders} onClose={() => setOpenId(null)} />
    </div>
  );
}

function CpppSourceBar({
  liveCount,
  scanned,
  fetchedAt,
  status,
  stale,
  error,
}: {
  liveCount: number;
  scanned: number;
  fetchedAt: string | null;
  status: "ok" | "empty" | "missing" | "error";
  stale: boolean;
  error?: string;
}) {
  let tone: "ok" | "warn" | "muted" = "muted";
  let message: string;

  if (status === "missing") {
    message = "CPPP feed not yet published — awaiting first scrape.";
    tone = "warn";
  } else if (status === "error") {
    message = `CPPP feed error${error ? `: ${error}` : ""}.`;
    tone = "warn";
  } else if (liveCount > 0) {
    message = `${liveCount} live tender${liveCount === 1 ? "" : "s"} from CPPP matched your watchlist · ${scanned} scanned.`;
    tone = "ok";
  } else {
    message = `Scanned ${scanned} CPPP tenders — 0 matched your watchlist sectors. Coverage widens as Railway (IREPS) and Defence portals are added.`;
    tone = "muted";
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        tone === "ok" && "border-positive/30 bg-positive/8 text-foreground",
        tone === "warn" && "border-warning/30 bg-warning/8 text-foreground",
        tone === "muted" && "border-border bg-card text-muted-foreground",
      )}
    >
      {tone === "warn" ? (
        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
      ) : (
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span>{message}</span>
      {fetchedAt && (
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {stale ? "stale —" : "synced"} {formatRelativeTime(fetchedAt)}
        </span>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "warning" | "positive" | "critical";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? tone === "warning"
            ? "border-warning/40 bg-warning/15 text-warning"
            : tone === "positive"
            ? "border-positive/40 bg-positive/15 text-positive"
            : tone === "critical"
            ? "border-critical/40 bg-critical/15 text-critical"
            : "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
      <span className="font-mono text-[10px] opacity-70">{count}</span>
    </button>
  );
}
