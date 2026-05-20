"use client";

import { useMemo, useState } from "react";
import { Filter, Database, AlertTriangle, Clock, Plus } from "lucide-react";
import { RecentUpdates } from "@/components/tenders/recent-updates";
import { TenderCard } from "@/components/tenders/tender-card";
import { TenderDetail } from "@/components/tenders/tender-detail";
import { WatchTenderDialog } from "@/components/tenders/watch-tender-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exampleTenders, sortTenders, isWatched } from "@/lib/mock-data";
import { useManualTenders } from "@/lib/manual-tenders";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Tender, Update } from "@/lib/types";

type StatusFilter = "all" | "pending" | "result_in" | "awarded";

export interface TendersClientProps {
  bseUpdates: Update[];
  bseFetchedAt: string | null;
  bseStale: boolean;
  bseStatus: "ok" | "empty" | "missing" | "error";
  bseError?: string;
  /** Live tenders scraped from BidAssist (multi-portal aggregator). */
  liveTenders: Tender[];
  sourceFetchedAt: string | null;
  sourceScanned: number;
  sourceStatus: "ok" | "empty" | "missing" | "error";
  sourceStale: boolean;
  sourceError?: string;
}

export function TendersClient({
  bseUpdates,
  bseFetchedAt,
  bseStale,
  bseStatus,
  bseError,
  liveTenders,
  sourceFetchedAt,
  sourceScanned,
  sourceStatus,
  sourceStale,
  sourceError,
}: TendersClientProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [watchOnly, setWatchOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTender, setEditTender] = useState<Tender | null>(null);

  const manual = useManualTenders();

  // Manual (tracked) tenders first, then live BidAssist, then badged examples.
  const allTenders = useMemo(
    () => sortTenders([...manual.tenders, ...liveTenders, ...exampleTenders]),
    [manual.tenders, liveTenders],
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

  const counts = useMemo(
    () => ({
      all: allTenders.length,
      pending: allTenders.filter((t) => t.status === "pending" || t.status === "evaluation").length,
      result_in: allTenders.filter((t) => t.status === "result_in").length,
      awarded: allTenders.filter((t) => t.status === "awarded").length,
    }),
    [allTenders],
  );

  const openAdd = () => {
    setEditTender(null);
    setDialogOpen(true);
  };
  const openEdit = (t: Tender) => {
    setOpenId(null);
    setEditTender(t);
    setDialogOpen(true);
  };
  const handleDelete = (id: string) => {
    manual.remove(id);
    setOpenId(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Government tenders</h1>
          <p className="text-sm text-muted-foreground">
            Track who&apos;s bidding, when results drop, and what follows after.
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" /> Watch a tender
        </Button>
      </header>

      <RecentUpdates
        bseUpdates={bseUpdates}
        bseFetchedAt={bseFetchedAt}
        bseStale={bseStale}
        bseStatus={bseStatus}
        bseError={bseError}
        onSelectTender={setOpenId}
      />

      <SourceBar
        liveCount={liveTenders.length}
        manualCount={manual.tenders.length}
        scanned={sourceScanned}
        fetchedAt={sourceFetchedAt}
        status={sourceStatus}
        stale={sourceStale}
        error={sourceError}
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
          <Card className="flex h-36 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>No tenders match this filter.</span>
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Watch a tender
            </Button>
          </Card>
        )}
      </div>

      <TenderDetail
        tenderId={openId}
        tenders={allTenders}
        onClose={() => setOpenId(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <WatchTenderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTender={editTender}
        onSave={manual.upsert}
      />
    </div>
  );
}

function SourceBar({
  liveCount,
  manualCount,
  scanned,
  fetchedAt,
  status,
  stale,
  error,
}: {
  liveCount: number;
  manualCount: number;
  scanned: number;
  fetchedAt: string | null;
  status: "ok" | "empty" | "missing" | "error";
  stale: boolean;
  error?: string;
}) {
  let tone: "ok" | "warn" | "muted" = "muted";
  let message: string;

  if (status === "missing") {
    message = "BidAssist feed not yet published — awaiting first scrape.";
    tone = "warn";
  } else if (status === "error") {
    message = `BidAssist feed error${error ? `: ${error}` : ""}.`;
    tone = "warn";
  } else if (liveCount > 0) {
    message = `${liveCount} live tender${liveCount === 1 ? "" : "s"} matched your watchlist — from BidAssist, scanned ${scanned} across all portals.`;
    tone = "ok";
  } else {
    message = `Scanned ${scanned} tenders via BidAssist — 0 matched your watchlist sectors this run. Add tenders directly with "Watch a tender".`;
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
      {manualCount > 0 && (
        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {manualCount} tracked manually
        </span>
      )}
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
