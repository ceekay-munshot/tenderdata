"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Sparkles, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function BLSSpotlight() {
  return (
    <Card className="relative overflow-hidden border-critical/40">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-critical/10 via-transparent to-transparent" />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="critical" className="gap-1.5">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-critical animate-pulse-glow" />
                Spotlight case
              </Badge>
              <Badge variant="outline" className="text-[10px]">BSE: BLS</Badge>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              BLS International — UAE contract loss + 2-year MEA debarment
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              On <span className="font-medium text-foreground">5 May 2026</span>, the MEA financial bid opening
              awarded the UAE visa outsourcing contract to <span className="font-medium text-foreground">Alhind Group</span>.
              BLS disclosed the loss 3 days later; debarment order followed on 15 May. Stock down{" "}
              <span className="font-medium text-critical">-29.4%</span> over the catalyst window. The tender
              calendar surfaced 5 May as a D-day 53 days in advance.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Bid opening" value="05 May" sub="MEA financial bid" />
              <MiniStat label="Disclosure" value="08 May" sub="Loss confirmed" tone="critical" />
              <MiniStat label="Debarment" value="15 May" sub="2-year MEA ban" tone="critical" />
              <MiniStat label="Stock impact" value="-29.4%" sub="14 trading days" tone="critical" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/company/BLS"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open BLS dossier <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link
                href="/calendar?ticker=BLS"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                See full timeline <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
            <div className="flex items-baseline gap-2 tabular">
              <span className="text-3xl font-semibold text-critical">₹326.45</span>
              <span className="inline-flex items-center gap-0.5 text-sm text-critical">
                <TrendingDown className="h-3.5 w-3.5" />
                -4.82%
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">Live · BSE</div>
            <div className="mt-3 flex items-center gap-2 rounded-md border bg-card/60 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-critical" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">Concentration risk</span>
                <span className="text-[10px] text-muted-foreground">UAE was 12.8% of FY25 rev</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-card/60 px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs font-medium">Predicted in advance</span>
                <span className="text-[10px] text-muted-foreground">53 days lead time</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "critical";
}) {
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular ${tone === "critical" ? "text-critical" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
