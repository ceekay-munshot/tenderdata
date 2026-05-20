"use client";

import { useMemo } from "react";
import {
  Bell,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getRecentUpdates, isWatched } from "@/lib/mock-data";
import type { Update } from "@/lib/types";

export interface RecentUpdatesProps {
  /** Updates pulled from the latest BSE scrape on the `data` branch. */
  bseUpdates: Update[];
  /** ISO timestamp of the latest scrape, or null if not yet run. */
  bseFetchedAt: string | null;
  /** True if the latest scrape is older than the staleness threshold. */
  bseStale: boolean;
  /** Lifecycle status of the BSE feed. */
  bseStatus: "ok" | "empty" | "missing" | "error";
  /** Error message if status === "error". */
  bseError?: string;
  /** Open the tender drawer when a row links to a known tender. */
  onSelectTender: (id: string) => void;
}

export function RecentUpdates({
  bseUpdates,
  bseFetchedAt,
  bseStale,
  bseStatus,
  bseError,
  onSelectTender,
}: RecentUpdatesProps) {
  // Merge BSE-scraped updates with tender-derived follow-ups, drop the
  // routine neutral filings (committee meetings, investor presentations —
  // noise for our purpose), dedupe by id, sort newest first. The strip is
  // meant to be pure signal: wins, losses, bans, regulatory actions.
  const merged = useMemo(() => {
    const mock = getRecentUpdates(40);
    const seen = new Set<string>();
    const all = [...bseUpdates, ...mock].filter((u) => {
      if (u.tone === "neutral") return false;
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
  }, [bseUpdates]);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Recent updates</h2>
          {bseStatus === "ok" && !bseStale && <span className="live-dot ml-1" />}
        </div>
        <FreshnessIndicator
          fetchedAt={bseFetchedAt}
          stale={bseStale}
          status={bseStatus}
          error={bseError}
        />
      </div>

      <ScrollArea className="max-h-[320px] scrollbar-thin">
        <ul className="divide-y">
          {merged.map((u) => {
            const Icon =
              u.tone === "negative" ? AlertTriangle : u.tone === "positive" ? CheckCircle2 : Info;
            const watched = isWatched(u.ticker);
            const fromBse = u.id.startsWith("bse-");
            return (
              <li key={u.id}>
                <button
                  onClick={() => u.tenderId && onSelectTender(u.tenderId)}
                  disabled={!u.tenderId}
                  className={cn(
                    "group flex w-full items-start gap-3 px-5 py-3 text-left transition-colors",
                    u.tenderId ? "hover:bg-accent/50" : "cursor-default",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      u.tone === "negative" && "text-critical",
                      u.tone === "positive" && "text-positive",
                      u.tone === "neutral" && "text-muted-foreground",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.ticker && (
                        <Badge
                          variant={watched ? "default" : "outline"}
                          className={cn("font-mono text-[10px]", watched && "ring-1 ring-primary/30")}
                        >
                          {u.ticker}
                        </Badge>
                      )}
                      {watched && (
                        <span className="text-[9px] uppercase tracking-wider text-primary">on watchlist</span>
                      )}
                      {fromBse && (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">BSE</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm leading-snug">{u.text}</p>
                    {u.context && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{u.context}</p>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(u.date)}</span>
                    {u.tenderId && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
          {merged.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">No updates yet.</li>
          )}
        </ul>
      </ScrollArea>
    </Card>
  );
}

function FreshnessIndicator({
  fetchedAt,
  stale,
  status,
  error,
}: {
  fetchedAt: string | null;
  stale: boolean;
  status: "ok" | "empty" | "missing" | "error";
  error?: string;
}) {
  if (status === "missing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title={error}>
        <Clock className="h-3 w-3" />
        Awaiting first scrape
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-warning" title={error}>
        <AlertTriangle className="h-3 w-3" />
        Feed error
      </span>
    );
  }
  if (!fetchedAt) {
    return <span className="text-[11px] text-muted-foreground">No timestamp</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px]",
        stale ? "text-warning" : "text-muted-foreground",
      )}
      title={`Last scrape: ${new Date(fetchedAt).toLocaleString()}`}
    >
      <RefreshCw className="h-3 w-3" />
      {stale ? "Stale —" : "Last sync"} {formatRelativeTime(fetchedAt)}
    </span>
  );
}
