"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tenders } from "@/lib/mock-data";
import type { MilestoneType } from "@/lib/types";

const milestoneTone: Record<MilestoneType, string> = {
  financial_bid_opening: "bg-critical/80 text-critical-foreground",
  technical_evaluation: "bg-warning/80 text-warning-foreground",
  bid_submission: "bg-muted text-foreground",
  result_announcement: "bg-positive/80 text-positive-foreground",
};

interface DayCell {
  date: Date;
  inMonth: boolean;
  events: { tenderId: string; type: MilestoneType; ticker: string; title: string }[];
}

export function CalendarGrid({ onSelect }: { onSelect?: (date: Date) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())} className="h-8 text-xs">
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-[10px] uppercase tracking-wider text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-2 py-2 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const today = isSameDay(cell.date, new Date());
          const isSelected = selected && isSameDay(cell.date, selected);
          return (
            <button
              key={i}
              onClick={() => {
                setSelected(cell.date);
                onSelect?.(cell.date);
              }}
              className={cn(
                "group relative flex min-h-[88px] flex-col items-stretch gap-1 border-b border-r p-1.5 text-left transition-colors",
                "last:border-r-0",
                !cell.inMonth && "bg-muted/30 text-muted-foreground/50",
                today && "bg-primary/5",
                isSelected && "bg-primary/10",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[11px] tabular",
                    today && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground",
                  )}
                >
                  {cell.date.getDate()}
                </span>
                {cell.events.length > 0 && (
                  <span className="text-[9px] text-muted-foreground">{cell.events.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {cell.events.slice(0, 3).map((e, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[9px] font-medium",
                      milestoneTone[e.type],
                    )}
                    title={e.title}
                  >
                    {e.ticker} · {labelShort(e.type)}
                  </div>
                ))}
                {cell.events.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{cell.events.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-[10px] text-muted-foreground">
        <Legend label="Financial Bid Opening" cls="bg-critical/80" />
        <Legend label="Technical Eval" cls="bg-warning/80" />
        <Legend label="Bid Submission" cls="bg-muted border border-border" />
        <Legend label="Result Announced" cls="bg-positive/80" />
      </div>
    </div>
  );
}

function Legend({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2.5 w-3.5 rounded", cls)} />
      {label}
    </span>
  );
}

function labelShort(t: MilestoneType): string {
  switch (t) {
    case "financial_bid_opening":
      return "D-Day";
    case "technical_evaluation":
      return "Tech Eval";
    case "bid_submission":
      return "Bid Due";
    case "result_announcement":
      return "Result";
  }
}

function buildMonthGrid(cursor: Date): DayCell[] {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startDay = (firstOfMonth.getDay() + 6) % 7; // Monday start
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startDay);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const events: DayCell["events"] = [];
    for (const t of tenders) {
      for (const m of t.milestones) {
        if (isSameDay(new Date(m.date), d)) {
          events.push({ tenderId: t.id, type: m.type, ticker: t.watchedCompanies[0], title: t.title });
        }
      }
    }
    cells.push({
      date: d,
      inMonth: d.getMonth() === cursor.getMonth(),
      events,
    });
    if (i >= 34 && d > lastOfMonth && d.getDay() === 0) break;
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
