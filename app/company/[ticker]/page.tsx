"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Radio,
  ExternalLink,
  Banknote,
  FileCheck2,
  Gavel,
  Sparkles,
  Gauge,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TenderEventCard } from "@/components/calendar/tender-event-card";
import { companies, tenders, disclosures } from "@/lib/mock-data";
import { cn, daysFromNow, formatDate, formatINR, formatPct, formatRelativeTime } from "@/lib/utils";
import type { MilestoneType, Severity } from "@/lib/types";

const milestoneOrder: MilestoneType[] = ["bid_submission", "technical_evaluation", "financial_bid_opening", "result_announcement"];
const milestoneMeta: Record<MilestoneType, { label: string; icon: typeof Banknote; tone: "critical" | "warning" | "positive" | "neutral" }> = {
  financial_bid_opening: { label: "Financial Bid Opening", icon: Banknote, tone: "critical" },
  technical_evaluation: { label: "Technical Evaluation", icon: FileCheck2, tone: "warning" },
  bid_submission: { label: "Bid Submission", icon: Gavel, tone: "neutral" },
  result_announcement: { label: "Result Announcement", icon: Sparkles, tone: "positive" },
};

export default function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const c = companies[ticker.toUpperCase()];
  if (!c) notFound();

  const companyTenders = tenders.filter((t) => t.watchedCompanies.includes(c.ticker));
  const companyDisclosures = disclosures
    .filter((d) => d.ticker === c.ticker)
    .sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());

  const upcomingTenders = companyTenders.filter((t) =>
    t.milestones.some((m) => new Date(m.date) >= new Date()),
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/watchlist" className="hover:text-foreground">Watchlist</Link>
          <span>/</span>
          <span>Company dossier</span>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-bold text-primary">
              {c.ticker.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{c.ticker}</h1>
                <Badge variant="outline">{c.exchange}</Badge>
                <Badge variant="default">{c.sector}</Badge>
              </div>
              <p className="text-base text-muted-foreground">{c.name}</p>
              {c.about && <p className="mt-1 max-w-2xl text-sm text-muted-foreground/80">{c.about}</p>}
            </div>
          </div>

          <div className="flex items-center gap-6 rounded-lg border bg-card/40 px-5 py-3">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">LTP</div>
              <div className="text-2xl font-semibold tabular">₹{c.lastPrice.toFixed(2)}</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change</div>
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-lg font-semibold",
                  c.change >= 0 ? "text-positive" : "text-critical",
                )}
              >
                {c.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatPct(c.change)}
              </div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mkt Cap</div>
              <div className="text-base font-semibold tabular">{formatINR(c.marketCap)}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Signal cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={cn("relative overflow-hidden p-5", c.signalScore >= 80 && "glow-critical")}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-critical/15 to-transparent" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-critical" />
              <span className="text-xs font-medium text-muted-foreground">Live signal score</span>
            </div>
            <div className="flex items-end justify-between">
              <span className={cn("text-3xl font-semibold tabular", c.signalScore >= 80 ? "text-critical" : c.signalScore >= 60 ? "text-warning" : "text-positive")}>
                {c.signalScore}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <Progress
              value={c.signalScore}
              indicatorClassName={cn(c.signalScore >= 80 && "bg-critical", c.signalScore >= 60 && c.signalScore < 80 && "bg-warning", c.signalScore < 60 && "bg-positive")}
            />
            <p className="text-xs text-muted-foreground">
              {c.signalScore >= 80 ? "On high alert — multiple D-days + critical disclosures in window." :
                c.signalScore >= 60 ? "Elevated — monitor next 14 days closely." :
                "Stable — no critical catalysts in window."}
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs font-medium text-muted-foreground">Tender concentration risk</span>
            </div>
            <div className="flex items-end justify-between">
              <span className={cn("text-3xl font-semibold tabular", c.concentrationRisk >= 70 ? "text-critical" : c.concentrationRisk >= 50 ? "text-warning" : "text-positive")}>
                {c.concentrationRisk}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <Progress
              value={c.concentrationRisk}
              indicatorClassName={cn(c.concentrationRisk >= 70 && "bg-critical", c.concentrationRisk >= 50 && c.concentrationRisk < 70 && "bg-warning", c.concentrationRisk < 50 && "bg-positive")}
            />
            <p className="text-xs text-muted-foreground">
              Measures revenue dependence on top 3 contracts. High = a single loss can hurt deeply.
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Upcoming catalysts (60d)</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold tabular">
                {companyTenders.reduce((s, t) => s + t.milestones.filter((m) => new Date(m.date) >= new Date()).length, 0)}
              </span>
              <span className="text-xs text-muted-foreground">events</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="critical" className="text-[10px]">
                {companyTenders.reduce((s, t) => s + t.milestones.filter((m) => m.type === "financial_bid_opening" && new Date(m.date) >= new Date()).length, 0)} D-days
              </Badge>
              <Badge variant="warning" className="text-[10px]">
                {companyTenders.reduce((s, t) => s + t.milestones.filter((m) => m.type === "technical_evaluation" && new Date(m.date) >= new Date()).length, 0)} tech evals
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Catalyst timeline</TabsTrigger>
          <TabsTrigger value="tenders">Active tenders ({companyTenders.length})</TabsTrigger>
          <TabsTrigger value="disclosures">Disclosures ({companyDisclosures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Catalyst timeline
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Stitched view of upcoming tender milestones and recent disclosures.
              </p>
            </CardHeader>
            <CardContent>
              <CombinedTimeline ticker={c.ticker} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenders" className="space-y-4">
          {companyTenders.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{t.refNo}</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.sourcePortal}</Badge>
                    <Badge
                      variant={
                        t.status === "awarded" ? "neutral" :
                        t.status === "evaluation" ? "warning" :
                        t.status === "bidding_open" ? "positive" : "default"
                      }
                      className="text-[10px]"
                    >
                      {t.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold leading-snug">{t.title}</h3>
                  <p className="text-xs text-muted-foreground">{t.buyer}</p>
                </div>
                <div className="text-right">
                  {t.estimatedValue && (
                    <div className="text-sm font-semibold tabular">{formatINR(t.estimatedValue)}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground">est. value</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm text-muted-foreground">{t.description}</p>

                {/* Milestone progress */}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  {milestoneOrder.map((mtype) => {
                    const m = t.milestones.find((x) => x.type === mtype);
                    if (!m) return null;
                    const meta = milestoneMeta[mtype];
                    const Icon = meta.icon;
                    const date = new Date(m.date);
                    const days = daysFromNow(m.date);
                    const past = date < new Date();
                    return (
                      <div
                        key={mtype}
                        className={cn(
                          "rounded-lg border p-3",
                          past ? "border-dashed bg-muted/30" : "bg-card",
                          !past && meta.tone === "critical" && "border-critical/40",
                          !past && meta.tone === "warning" && "border-warning/40",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon
                            className={cn(
                              "h-3.5 w-3.5",
                              past && "text-muted-foreground/50",
                              !past && meta.tone === "critical" && "text-critical",
                              !past && meta.tone === "warning" && "text-warning",
                              !past && meta.tone === "positive" && "text-positive",
                              !past && meta.tone === "neutral" && "text-muted-foreground",
                            )}
                          />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                        </div>
                        <div className="mt-1.5 text-sm font-medium tabular">
                          {formatDate(m.date, { day: "numeric", month: "short" })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {past ? "completed" : `T-${days}d`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {t.knownBidders && t.knownBidders.length > 0 && (
                  <div className="rounded-md border bg-card/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> Bidders
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {t.knownBidders.map((b) => (
                        <span
                          key={b}
                          className={cn(
                            "rounded-md px-2 py-1 text-xs",
                            b.toLowerCase().includes(c.name.toLowerCase().split(" ")[0].toLowerCase())
                              ? "bg-primary/15 text-primary"
                              : t.competitorBidders?.includes(b)
                              ? "bg-critical/15 text-critical"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="disclosures" className="space-y-3">
          {companyDisclosures.map((d) => {
            const tones: Record<Severity, string> = {
              critical: "border-l-critical",
              positive: "border-l-positive",
              warning: "border-l-warning",
              neutral: "border-l-border",
            };
            return (
              <Card key={d.id} className={cn("border-l-4", tones[d.severity])}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={d.severity === "critical" ? "critical" : d.severity === "positive" ? "positive" : "warning"}
                      className="text-[10px]"
                    >
                      {d.severity === "critical" ? "Critical" : d.severity === "positive" ? "Positive" : "Watch"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(d.filedAt)} · {new Date(d.filedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{d.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{d.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CombinedTimeline({ ticker }: { ticker: string }) {
  type Row =
    | { kind: "tender"; date: string; tenderId: string; type: MilestoneType }
    | { kind: "disclosure"; date: string; disclosureId: string };

  const rows: Row[] = [];
  for (const t of tenders.filter((x) => x.watchedCompanies.includes(ticker))) {
    for (const m of t.milestones) {
      rows.push({ kind: "tender", date: m.date, tenderId: t.id, type: m.type });
    }
  }
  for (const d of disclosures.filter((x) => x.ticker === ticker)) {
    rows.push({ kind: "disclosure", date: d.filedAt, disclosureId: d.id });
  }
  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="relative space-y-3">
      <div className="absolute bottom-3 left-3 top-3 w-px bg-border" />
      {rows.map((r, i) => {
        const past = new Date(r.date) < new Date();
        return (
          <div key={i} className="flex items-start gap-4">
            <div
              className={cn(
                "relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                past ? "border-border bg-muted text-muted-foreground" : "border-primary bg-primary text-primary-foreground",
              )}
            >
              {r.kind === "tender" ? <Calendar className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
            </div>
            {r.kind === "tender" ? (
              <TenderRow tenderId={r.tenderId} type={r.type} />
            ) : (
              <DisclosureRow disclosureId={r.disclosureId} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TenderRow({ tenderId, type }: { tenderId: string; type: MilestoneType }) {
  const t = tenders.find((x) => x.id === tenderId)!;
  const m = t.milestones.find((x) => x.type === type)!;
  const meta = milestoneMeta[type];
  const past = new Date(m.date) < new Date();
  return (
    <div className="flex-1 rounded-lg border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={meta.tone === "critical" ? "critical" : meta.tone === "warning" ? "warning" : meta.tone === "positive" ? "positive" : "neutral"} className="text-[10px]">
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">Tender milestone</span>
        </div>
        <span className="text-xs tabular text-muted-foreground">
          {formatDate(m.date, { day: "numeric", month: "short", year: "numeric" })} {past && "(past)"}
        </span>
      </div>
      <div className="mt-1 text-sm">{t.title}</div>
    </div>
  );
}

function DisclosureRow({ disclosureId }: { disclosureId: string }) {
  const d = disclosures.find((x) => x.id === disclosureId)!;
  return (
    <div className="flex-1 rounded-lg border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={d.severity === "critical" ? "critical" : d.severity === "positive" ? "positive" : "warning"}
            className="text-[10px]"
          >
            Disclosure
          </Badge>
          <span className="text-xs text-muted-foreground">{d.category.replace("_", " ")}</span>
        </div>
        <span className="text-xs tabular text-muted-foreground">{formatRelativeTime(d.filedAt)}</span>
      </div>
      <div className="mt-1 text-sm">{d.title}</div>
    </div>
  );
}
