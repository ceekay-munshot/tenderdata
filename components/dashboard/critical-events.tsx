"use client";

import Link from "next/link";
import { CalendarClock, Sparkles, ArrowUpRight, Gavel, FileCheck2, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, daysFromNow, formatDate, formatINR } from "@/lib/utils";
import { tenders } from "@/lib/mock-data";
import type { MilestoneType } from "@/lib/types";

type EventRow = {
  tenderId: string;
  type: MilestoneType;
  date: string;
  title: string;
  buyer: string;
  ticker: string;
  estimatedValue?: number;
  competitors?: string[];
};

const milestoneMeta: Record<MilestoneType, { label: string; icon: typeof Gavel; tone: "critical" | "warning" | "positive" | "neutral" }> = {
  financial_bid_opening: { label: "Financial Bid Opening", icon: Banknote, tone: "critical" },
  technical_evaluation: { label: "Technical Evaluation", icon: FileCheck2, tone: "warning" },
  bid_submission: { label: "Bid Submission", icon: Gavel, tone: "neutral" },
  result_announcement: { label: "Result Announcement", icon: Sparkles, tone: "positive" },
};

export function CriticalEvents() {
  const now = new Date();
  const rows: EventRow[] = [];
  for (const t of tenders) {
    for (const m of t.milestones) {
      const d = new Date(m.date);
      if (d < now) continue;
      rows.push({
        tenderId: t.id,
        type: m.type,
        date: m.date,
        title: t.title.split("—")[0].trim(),
        buyer: t.buyer,
        ticker: t.watchedCompanies[0],
        estimatedValue: t.estimatedValue,
        competitors: t.competitorBidders,
      });
    }
  }
  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            Crystal Ball — Upcoming D-Days
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Next financial bid openings and evaluation dates across watchlist
          </p>
        </div>
        <Link href="/calendar" className="text-xs text-primary hover:underline">
          Open calendar →
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="max-h-[440px] scrollbar-thin">
          <div className="divide-y">
            {rows.slice(0, 8).map((row) => {
              const meta = milestoneMeta[row.type];
              const Icon = meta.icon;
              const days = daysFromNow(row.date);
              const urgent = days <= 3 && meta.tone === "critical";
              return (
                <Link
                  key={`${row.tenderId}-${row.type}`}
                  href={`/calendar?event=${row.tenderId}-${row.type}`}
                  className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      meta.tone === "critical" && "border-critical/30 bg-critical/10 text-critical",
                      meta.tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
                      meta.tone === "positive" && "border-positive/30 bg-positive/10 text-positive",
                      meta.tone === "neutral" && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {row.ticker}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular text-muted-foreground">
                          {formatDate(row.date, { day: "numeric", month: "short" })}
                        </span>
                        <Badge
                          variant={urgent ? "critical" : days <= 7 ? "warning" : "neutral"}
                          className="font-mono text-[10px]"
                        >
                          T-{days}d
                        </Badge>
                      </div>
                    </div>
                    <div className="line-clamp-1 text-sm font-medium group-hover:text-primary">{row.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{row.buyer}</span>
                      {row.estimatedValue && (
                        <>
                          <span>·</span>
                          <span className="tabular">{formatINR(row.estimatedValue)}</span>
                        </>
                      )}
                      {row.competitors && row.competitors.length > 0 && (
                        <>
                          <span>·</span>
                          <span>vs {row.competitors.join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
