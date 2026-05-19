"use client";

import { Bell, ArrowRight, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getRecentUpdates, isWatched } from "@/lib/mock-data";

export function RecentUpdates({ onSelectTender }: { onSelectTender: (id: string) => void }) {
  const updates = getRecentUpdates(20);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Recent updates</h2>
          <span className="live-dot ml-1" />
        </div>
        <span className="text-[11px] text-muted-foreground">Latest results, follow-ups, regulatory actions</span>
      </div>

      <ScrollArea className="max-h-[300px] scrollbar-thin">
        <ul className="divide-y">
          {updates.map((u) => {
            const Icon =
              u.tone === "negative" ? AlertTriangle : u.tone === "positive" ? CheckCircle2 : Info;
            const watched = isWatched(u.ticker);
            return (
              <li key={u.id}>
                <button
                  onClick={() => onSelectTender(u.tenderId)}
                  className="group flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/50"
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
                    </div>
                    <p className="mt-0.5 text-sm leading-snug">{u.text}</p>
                    {u.context && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{u.context}</p>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(u.date)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </Card>
  );
}
