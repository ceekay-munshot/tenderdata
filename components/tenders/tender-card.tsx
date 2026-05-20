"use client";

import { Building2, Calendar, AlertTriangle, CheckCircle2, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { BidderChip } from "./bidder-chip";
import { cn, daysFromNow, formatDate, formatINR } from "@/lib/utils";
import { isWatched } from "@/lib/mock-data";
import type { Tender } from "@/lib/types";

export function TenderCard({ tender, onOpen }: { tender: Tender; onOpen: (id: string) => void }) {
  const days = daysFromNow(tender.resultDate);
  const isFinished = tender.status === "awarded" || tender.status === "result_in";
  const watchedBidders = tender.bidders.filter((b) => isWatched(b.ticker));
  const hasWatchedLoss = isFinished && tender.bidders.some((b) => isWatched(b.ticker) && b.status === "lost");
  const hasWatchedWin = isFinished && tender.bidders.some((b) => isWatched(b.ticker) && b.status === "won");
  const negativeFollowUp = tender.followUps.find((f) => f.tone === "negative");
  const positiveFollowUp = tender.followUps.find((f) => f.tone === "positive");

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md",
        watchedBidders.length > 0 && "ring-1 ring-primary/25",
        hasWatchedLoss && "ring-1 ring-critical/40",
        hasWatchedWin && "ring-1 ring-positive/40",
      )}
      onClick={() => onOpen(tender.id)}
    >
      <div className="space-y-3 p-5">
        {/* Row 1: status + date */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={tender.status} />
            {tender.dataSource === "live" ? (
              <Badge variant="positive" className="gap-1 text-[10px]">
                <span className="live-dot" /> Live · {tender.sourcePortal}
              </Badge>
            ) : tender.dataSource === "manual" ? (
              <Badge variant="default" className="text-[10px]">Watching</Badge>
            ) : (
              <Badge variant="neutral" className="text-[10px]">Example</Badge>
            )}
            {watchedBidders.length > 0 && (
              <Badge variant="default" className="text-[10px]">
                {watchedBidders.length} on watchlist
              </Badge>
            )}
            <span className="font-mono text-[10px] text-muted-foreground">{tender.refNo}</span>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span className="tabular">{formatDate(tender.resultDate, { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            {!isFinished ? (
              <span
                className={cn(
                  "mt-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                  days <= 7 ? "bg-critical/15 text-critical" : days <= 21 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                )}
              >
                Result in {days}d
              </span>
            ) : days >= 0 ? (
              <span
                className={cn(
                  "mt-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                  days <= 7 ? "bg-critical/15 text-critical" : "bg-warning/15 text-warning",
                )}
              >
                Result due in {days}d
              </span>
            ) : (
              <span className="mt-1 text-[10px] text-muted-foreground">Announced {Math.abs(days)}d ago</span>
            )}
          </div>
        </div>

        {/* Row 2: title + buyer */}
        <div>
          <h3 className="text-base font-semibold leading-snug group-hover:text-primary">{tender.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {tender.buyer}
            </span>
            {tender.estimatedValue && (
              <>
                <span>·</span>
                <span className="font-medium text-foreground/80 tabular">{formatINR(tender.estimatedValue)}</span>
              </>
            )}
            <span>·</span>
            <span>{tender.sourcePortal}</span>
          </div>
        </div>

        {/* Row 3: winner banner if applicable */}
        {isFinished && tender.winner && (
          <div className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2",
            "border-positive/40 bg-positive/10",
          )}>
            <Trophy className="h-4 w-4 text-positive" />
            <span className="text-sm">
              <span className="text-muted-foreground">Awarded to</span>{" "}
              <span className="font-semibold text-positive">{tender.winner}</span>
            </span>
          </div>
        )}

        {/* Row 4: bidders */}
        {tender.bidders.length > 0 ? (
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Bidders ({tender.bidders.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tender.bidders.map((b, i) => (
                <BidderChip key={`${b.name}-${i}`} bidder={b} />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
            Bidders not yet disclosed — CPPP publishes the bidder list only after the financial bid opens.
          </div>
        )}

        {/* Row 5: follow-up alerts (collapsed) */}
        {(negativeFollowUp || positiveFollowUp) && (
          <div className="space-y-1.5">
            {negativeFollowUp && (
              <div className="flex items-start gap-2 rounded-md border border-critical/30 bg-critical/8 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical" />
                <div className="flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-critical">
                    Follow-up · {formatDate(negativeFollowUp.date, { day: "numeric", month: "short" })}
                  </span>
                  <p className="text-xs">{negativeFollowUp.text}</p>
                </div>
              </div>
            )}
            {positiveFollowUp && !negativeFollowUp && (
              <div className="flex items-start gap-2 rounded-md border border-positive/30 bg-positive/8 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                <div className="flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-positive">
                    Follow-up · {formatDate(positiveFollowUp.date, { day: "numeric", month: "short" })}
                  </span>
                  <p className="text-xs">{positiveFollowUp.text}</p>
                </div>
              </div>
            )}
            {tender.followUps.length > 1 && (
              <span className="text-[10px] text-muted-foreground">+{tender.followUps.length - 1} more updates — open for details</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
