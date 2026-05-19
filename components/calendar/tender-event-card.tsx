"use client";

import Link from "next/link";
import { Gavel, FileCheck2, Banknote, Sparkles, ArrowUpRight, ExternalLink, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, daysFromNow, formatDate, formatINR } from "@/lib/utils";
import type { Tender, MilestoneType } from "@/lib/types";

const meta: Record<MilestoneType, { label: string; icon: typeof Gavel; tone: "critical" | "warning" | "positive" | "neutral" }> = {
  financial_bid_opening: { label: "Financial Bid Opening", icon: Banknote, tone: "critical" },
  technical_evaluation: { label: "Technical Evaluation", icon: FileCheck2, tone: "warning" },
  bid_submission: { label: "Bid Submission", icon: Gavel, tone: "neutral" },
  result_announcement: { label: "Result Announcement", icon: Sparkles, tone: "positive" },
};

export function TenderEventCard({ tender, type }: { tender: Tender; type: MilestoneType }) {
  const milestone = tender.milestones.find((m) => m.type === type);
  if (!milestone) return null;
  const m = meta[type];
  const Icon = m.icon;
  const days = daysFromNow(milestone.date);
  const urgent = days >= 0 && days <= 7 && type === "financial_bid_opening";

  return (
    <Card
      className={cn(
        "group overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        urgent && "glow-critical",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-4 py-2",
          m.tone === "critical" && "bg-critical/8",
          m.tone === "warning" && "bg-warning/8",
          m.tone === "positive" && "bg-positive/8",
          m.tone === "neutral" && "bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              m.tone === "critical" && "text-critical",
              m.tone === "warning" && "text-warning",
              m.tone === "positive" && "text-positive",
              m.tone === "neutral" && "text-muted-foreground",
            )}
          />
          <span className="text-xs font-medium">{m.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular text-muted-foreground">
            {formatDate(milestone.date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <Badge
            variant={urgent ? "critical" : days <= 14 ? "warning" : "neutral"}
            className="font-mono text-[10px]"
          >
            T-{days}d
          </Badge>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {tender.watchedCompanies.map((t) => (
            <Badge key={t} variant="default" className="font-mono text-[10px]">{t}</Badge>
          ))}
          <Badge variant="outline" className="text-[10px]">{tender.sourcePortal}</Badge>
          <Badge variant="outline" className="text-[10px]">match {tender.matchScore}%</Badge>
        </div>

        <div>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
            {tender.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {tender.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="text-foreground/80">{tender.buyer}</span>
          </span>
          {tender.estimatedValue && (
            <>
              <span>·</span>
              <span className="tabular text-foreground/80">{formatINR(tender.estimatedValue)}</span>
            </>
          )}
          <span>·</span>
          <span className="font-mono">{tender.refNo}</span>
        </div>

        {tender.knownBidders && tender.knownBidders.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>Bidders:</span>
            {tender.knownBidders.map((b, i) => (
              <span
                key={b}
                className={cn(
                  tender.watchedCompanies.some((t) => b.toLowerCase().includes(t.toLowerCase())) &&
                    "rounded bg-primary/15 px-1 text-primary",
                  tender.competitorBidders?.includes(b) && "rounded bg-critical/15 px-1 text-critical",
                )}
              >
                {b}
                {i < tender.knownBidders!.length - 1 && <span className="text-muted-foreground/50">, </span>}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/company/${tender.watchedCompanies[0]}`}
            className="text-[11px] text-primary hover:underline"
          >
            View company dossier →
          </Link>
          {tender.sourceUrl && (
            <a
              href={tender.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
