"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Radio, Filter, AlertTriangle, CheckCircle2, AlertCircle, ExternalLink, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatRelativeTime } from "@/lib/utils";
import { disclosures, tendersById } from "@/lib/mock-data";
import type { Severity } from "@/lib/types";

const severityMeta: Record<Severity, { icon: typeof AlertTriangle; label: string; tone: "critical" | "positive" | "warning" | "neutral" }> = {
  critical: { icon: AlertTriangle, label: "Critical Negative", tone: "critical" },
  positive: { icon: CheckCircle2, label: "Critical Positive", tone: "positive" },
  warning: { icon: AlertCircle, label: "Structural / Watch", tone: "warning" },
  neutral: { icon: AlertCircle, label: "Neutral", tone: "neutral" },
};

const categoryLabels: Record<string, string> = {
  contract_win: "Order Win",
  contract_loss: "Contract Loss",
  regulatory: "Regulatory",
  governance: "Governance",
  financial: "Financial",
  structural: "Structural",
  other: "Other",
};

export default function DisclosuresPage() {
  const [tab, setTab] = useState<"all" | Severity>("all");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    return disclosures
      .filter((d) => tab === "all" || d.severity === tab)
      .filter(
        (d) =>
          !query ||
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.ticker.toLowerCase().includes(query.toLowerCase()) ||
          d.body.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
  }, [tab, query]);

  const counts = {
    all: disclosures.length,
    critical: disclosures.filter((d) => d.severity === "critical").length,
    positive: disclosures.filter((d) => d.severity === "positive").length,
    warning: disclosures.filter((d) => d.severity === "warning").length,
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Radio className="h-3 w-3 text-primary" />
          <span>Smoke Detector</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <span className="live-dot" /> Live
          </span>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Real-time SEBI Disclosures</h1>
            <p className="text-sm text-muted-foreground">
              BSE & NSE Reg 30 announcements for watchlisted companies — auto-tagged by severity and category.
            </p>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search disclosures..."
            className="max-w-xs"
          />
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-transparent p-0">
          <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-muted">
            All <Badge variant="neutral" className="font-mono text-[10px]">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="critical" className="gap-1.5 data-[state=active]:bg-critical/15 data-[state=active]:text-critical">
            <AlertTriangle className="h-3 w-3" />
            Critical Negative
            <Badge variant="critical" className="font-mono text-[10px]">{counts.critical}</Badge>
          </TabsTrigger>
          <TabsTrigger value="positive" className="gap-1.5 data-[state=active]:bg-positive/15 data-[state=active]:text-positive">
            <CheckCircle2 className="h-3 w-3" />
            Critical Positive
            <Badge variant="positive" className="font-mono text-[10px]">{counts.positive}</Badge>
          </TabsTrigger>
          <TabsTrigger value="warning" className="gap-1.5 data-[state=active]:bg-warning/15 data-[state=active]:text-warning">
            <AlertCircle className="h-3 w-3" />
            Structural Drama
            <Badge variant="warning" className="font-mono text-[10px]">{counts.warning}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {list.map((d) => {
          const sev = severityMeta[d.severity];
          const Icon = sev.icon;
          const linkedTender = d.linkedTenderId ? tendersById[d.linkedTenderId] : undefined;
          return (
            <Card
              key={d.id}
              id={d.id}
              className={cn(
                "overflow-hidden transition-colors hover:bg-accent/20",
                d.severity === "critical" && "border-l-4 border-l-critical",
                d.severity === "positive" && "border-l-4 border-l-positive",
                d.severity === "warning" && "border-l-4 border-l-warning",
              )}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
                      d.severity === "critical" && "border-critical/30 bg-critical/10 text-critical",
                      d.severity === "positive" && "border-positive/30 bg-positive/10 text-positive",
                      d.severity === "warning" && "border-warning/30 bg-warning/10 text-warning",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/company/${d.ticker}`}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-primary/20 hover:text-primary"
                      >
                        {d.ticker}
                      </Link>
                      <span className="text-xs text-muted-foreground">{d.companyName}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.exchange}</span>
                      <Badge variant={sev.tone} className="text-[10px]">{sev.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{categoryLabels[d.category]}</Badge>
                      {d.predictedImpact === "high" && (
                        <Badge variant="critical" className="text-[10px]">High impact</Badge>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-semibold leading-snug">{d.title}</h3>

                    <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{d.body}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        Filed {formatRelativeTime(d.filedAt)} · {new Date(d.filedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      {d.triggerWords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.triggerWords.map((w) => (
                            <span
                              key={w}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                d.severity === "critical" && "bg-critical/15 text-critical",
                                d.severity === "positive" && "bg-positive/15 text-positive",
                                d.severity === "warning" && "bg-warning/15 text-warning",
                              )}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {linkedTender && (
                      <Link
                        href={`/calendar?event=${linkedTender.id}-financial_bid_opening`}
                        className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs hover:bg-primary/10"
                      >
                        <Link2 className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">Loopback:</span>
                        <span className="font-medium">Linked to tender</span>
                        <span className="font-mono text-[11px] text-primary">{linkedTender.refNo}</span>
                        <span className="ml-auto text-[11px] text-primary">View D-Day →</span>
                      </Link>
                    )}
                  </div>

                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:flex"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {list.length === 0 && (
          <Card className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No disclosures match.
          </Card>
        )}
      </div>
    </div>
  );
}
