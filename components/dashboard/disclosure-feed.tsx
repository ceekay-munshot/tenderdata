"use client";

import Link from "next/link";
import { Radio, ArrowUpRight, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getRecentDisclosures } from "@/lib/mock-data";
import type { Severity } from "@/lib/types";

const severityMeta: Record<Severity, { icon: typeof AlertTriangle; label: string; classes: string }> = {
  critical: { icon: AlertTriangle, label: "Critical", classes: "border-critical/30 bg-critical/10 text-critical" },
  positive: { icon: CheckCircle2, label: "Positive", classes: "border-positive/30 bg-positive/10 text-positive" },
  warning: { icon: AlertCircle, label: "Warning", classes: "border-warning/30 bg-warning/10 text-warning" },
  neutral: { icon: AlertCircle, label: "Neutral", classes: "border-border bg-muted text-muted-foreground" },
};

export function DisclosureFeed() {
  const list = getRecentDisclosures(20);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-primary" />
            Smoke Detector — Live Disclosures
            <span className="ml-1 live-dot" />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            SEBI Reg 30 announcements, auto-tagged by severity. Polling every 60s.
          </p>
        </div>
        <Link href="/disclosures" className="text-xs text-primary hover:underline">
          View feed →
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="max-h-[440px] scrollbar-thin">
          <div className="divide-y">
            {list.map((d) => {
              const meta = severityMeta[d.severity];
              const Icon = meta.icon;
              return (
                <Link
                  key={d.id}
                  href={`/disclosures#${d.id}`}
                  className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border", meta.classes)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">{d.ticker}</Badge>
                        <Badge
                          variant={d.severity === "critical" ? "critical" : d.severity === "positive" ? "positive" : d.severity === "warning" ? "warning" : "neutral"}
                          className="text-[10px]"
                        >
                          {meta.label}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.exchange}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{formatRelativeTime(d.filedAt)}</span>
                    </div>
                    <div className="line-clamp-1 text-sm font-medium group-hover:text-primary">{d.title}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.triggerWords.slice(0, 3).map((w) => (
                        <span key={w} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {w}
                        </span>
                      ))}
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
