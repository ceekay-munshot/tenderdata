"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { RecentUpdates } from "@/components/tenders/recent-updates";
import { TenderCard } from "@/components/tenders/tender-card";
import { TenderDetail } from "@/components/tenders/tender-detail";
import { Card } from "@/components/ui/card";
import { sortedTenders } from "@/lib/mock-data";
import { isWatched } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { TenderStatus } from "@/lib/types";

type StatusFilter = "all" | "pending" | "result_in" | "awarded";

export default function TendersPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [watchOnly, setWatchOnly] = useState(false);

  const tenders = useMemo(() => {
    return sortedTenders().filter((t) => {
      if (statusFilter !== "all") {
        if (statusFilter === "pending" && !(t.status === "pending" || t.status === "evaluation")) return false;
        if (statusFilter === "result_in" && t.status !== "result_in") return false;
        if (statusFilter === "awarded" && t.status !== "awarded") return false;
      }
      if (watchOnly && !t.bidders.some((b) => isWatched(b.ticker))) return false;
      return true;
    });
  }, [statusFilter, watchOnly]);

  const counts = {
    all: sortedTenders().length,
    pending: sortedTenders().filter((t) => t.status === "pending" || t.status === "evaluation").length,
    result_in: sortedTenders().filter((t) => t.status === "result_in").length,
    awarded: sortedTenders().filter((t) => t.status === "awarded").length,
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Government tenders</h1>
        <p className="text-sm text-muted-foreground">
          Track who&apos;s bidding, when results drop, and what follows after.
        </p>
      </header>

      <RecentUpdates onSelectTender={setOpenId} />

      <Card className="border-dashed p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label="All" count={counts.all} />
            <Chip
              active={statusFilter === "pending"}
              onClick={() => setStatusFilter("pending")}
              label="Pending"
              count={counts.pending}
              tone="warning"
            />
            <Chip
              active={statusFilter === "result_in"}
              onClick={() => setStatusFilter("result_in")}
              label="Result in"
              count={counts.result_in}
              tone="positive"
            />
            <Chip
              active={statusFilter === "awarded"}
              onClick={() => setStatusFilter("awarded")}
              label="Awarded"
              count={counts.awarded}
              tone="positive"
            />
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

      <TenderDetail tenderId={openId} onClose={() => setOpenId(null)} />
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
