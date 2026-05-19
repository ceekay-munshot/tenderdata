"use client";

import { useState } from "react";
import { Eye, Plus, X, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { watchlist as seedWatchlist } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import type { WatchlistItem } from "@/lib/types";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>(seedWatchlist);
  const [tickerInput, setTickerInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  const handleAdd = () => {
    const t = tickerInput.trim().toUpperCase();
    if (!t) return;
    if (items.some((i) => i.ticker === t)) return;
    setItems([
      ...items,
      {
        ticker: t,
        name: nameInput.trim() || t,
        exchange: "NSE",
        addedAt: new Date().toISOString(),
      },
    ]);
    setTickerInput("");
    setNameInput("");
  };

  const handleRemove = (ticker: string) => {
    setItems(items.filter((i) => i.ticker !== ticker));
  };

  return (
    <div className="mx-auto w-full max-w-[800px] space-y-5 px-4 py-6 md:px-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3 w-3 text-primary" />
          <span>Watchlist</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tracked companies</h1>
        <p className="text-sm text-muted-foreground">
          Add tickers you want to follow. Their bids will be highlighted in the tenders feed.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
          <Input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Ticker (e.g. BLS)"
            className="sm:max-w-[160px] font-mono uppercase"
          />
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Company name (optional)"
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!tickerInput.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.ticker} className="overflow-hidden transition-colors hover:bg-accent/30">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                {item.ticker.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{item.ticker}</span>
                  <Badge variant="outline" className="text-[10px]">{item.exchange}</Badge>
                  {item.sector && <Badge variant="neutral" className="text-[10px]">{item.sector}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">{item.name}</div>
              </div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                Added {formatDate(item.addedAt, { day: "numeric", month: "short" })}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-critical"
                onClick={() => handleRemove(item.ticker)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <Card className="flex h-32 flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>No tickers on your watchlist yet.</span>
            <span className="text-xs">Add one above to start tracking.</span>
          </Card>
        )}
      </div>
    </div>
  );
}
