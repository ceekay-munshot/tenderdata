"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Filter, Banknote, FileCheck2, Gavel, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenderEventCard } from "@/components/calendar/tender-event-card";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { tenders } from "@/lib/mock-data";
import { companies } from "@/lib/mock-data/companies";
import { cn } from "@/lib/utils";
import type { MilestoneType } from "@/lib/types";

type Filter = "all" | MilestoneType;

export default function CalendarPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [tickerFilter, setTickerFilter] = useState<string | null>(null);
  const [view, setView] = useState<"timeline" | "month">("timeline");

  const filteredEvents = useMemo(() => {
    const rows: { tenderId: string; type: MilestoneType; date: string; ticker: string }[] = [];
    for (const t of tenders) {
      if (tickerFilter && !t.watchedCompanies.includes(tickerFilter)) continue;
      for (const m of t.milestones) {
        if (filter !== "all" && m.type !== filter) continue;
        if (new Date(m.date) < new Date()) continue;
        rows.push({ tenderId: t.id, type: m.type, date: m.date, ticker: t.watchedCompanies[0] });
      }
    }
    return rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filter, tickerFilter]);

  const tickers = Array.from(new Set(tenders.flatMap((t) => t.watchedCompanies)));

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange className="h-3 w-3 text-primary" />
          <span>Crystal Ball</span>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Predictive Tender Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Bid submission · Technical evaluation · Financial bid opening — extracted from tender PDFs and plotted on D-Day.
            </p>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "timeline" | "month")}>
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="month">Month grid</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <Card className="border-dashed p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filter
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All milestones"
            />
            <FilterChip
              active={filter === "financial_bid_opening"}
              onClick={() => setFilter("financial_bid_opening")}
              label="Financial bid opening"
              icon={<Banknote className="h-3 w-3" />}
              tone="critical"
            />
            <FilterChip
              active={filter === "technical_evaluation"}
              onClick={() => setFilter("technical_evaluation")}
              label="Technical evaluation"
              icon={<FileCheck2 className="h-3 w-3" />}
              tone="warning"
            />
            <FilterChip
              active={filter === "bid_submission"}
              onClick={() => setFilter("bid_submission")}
              label="Bid submission"
              icon={<Gavel className="h-3 w-3" />}
              tone="neutral"
            />
            <FilterChip
              active={filter === "result_announcement"}
              onClick={() => setFilter("result_announcement")}
              label="Result"
              icon={<Sparkles className="h-3 w-3" />}
              tone="positive"
            />
          </div>

          <span className="ml-1 h-4 w-px bg-border" />

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={tickerFilter === null}
              onClick={() => setTickerFilter(null)}
              label="All tickers"
            />
            {tickers.map((t) => (
              <FilterChip
                key={t}
                active={tickerFilter === t}
                onClick={() => setTickerFilter(t)}
                label={t}
                mono
              />
            ))}
          </div>

          <div className="ml-auto text-xs text-muted-foreground">
            {filteredEvents.length} events · next 60 days
          </div>
        </div>
      </Card>

      {view === "month" ? (
        <CalendarGrid />
      ) : (
        <TimelineView events={filteredEvents} />
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
  tone,
  mono,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  tone?: "critical" | "warning" | "positive" | "neutral";
  mono?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? cn(
              tone === "critical" && "border-critical/40 bg-critical/15 text-critical",
              tone === "warning" && "border-warning/40 bg-warning/15 text-warning",
              tone === "positive" && "border-positive/40 bg-positive/15 text-positive",
              !tone && "border-primary/40 bg-primary/15 text-primary",
            )
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
        mono && "font-mono text-[11px]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TimelineView({ events }: { events: { tenderId: string; type: MilestoneType; date: string; ticker: string }[] }) {
  // Group by date label (e.g., "Mon, 26 May")
  const groups: { label: string; subLabel: string; rows: typeof events }[] = [];
  for (const e of events) {
    const d = new Date(e.date);
    const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    const subLabel = d.toLocaleDateString("en-IN", { year: "numeric" });
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.rows.push(e);
    else groups.push({ label, subLabel, rows: [e] });
  }

  if (groups.length === 0) {
    return (
      <Card className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No events match current filter.
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="absolute bottom-0 left-[68px] top-0 w-px bg-border md:left-[140px]" />
      <div className="space-y-6">
        {groups.map((g) => {
          const d = new Date(g.rows[0].date);
          const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
          return (
            <div key={g.label} className="flex gap-4 md:gap-8">
              <div className="w-16 shrink-0 md:w-32">
                <div className="text-xs font-semibold">{g.label}</div>
                <div className="text-[10px] text-muted-foreground">{g.subLabel}</div>
                <Badge variant={days <= 7 ? "critical" : days <= 21 ? "warning" : "neutral"} className="mt-1.5 font-mono text-[10px]">
                  T-{days}d
                </Badge>
              </div>
              <div className="relative flex-1">
                <div className="absolute -left-[19px] top-2 hidden h-3 w-3 rounded-full border-2 border-primary bg-background md:block" />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {g.rows.map((row) => {
                    const tender = tenders.find((t) => t.id === row.tenderId)!;
                    return <TenderEventCard key={`${row.tenderId}-${row.type}`} tender={tender} type={row.type} />;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
