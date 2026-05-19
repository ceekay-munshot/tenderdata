"use client";

import Link from "next/link";
import { Eye, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { companyList } from "@/lib/mock-data";

export function WatchlistSnapshot() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            Watchlist — Signal Heatmap
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Live signal score factors in upcoming D-days, disclosure severity, and concentration risk.
          </p>
        </div>
        <Link href="/watchlist" className="text-xs text-primary hover:underline">
          Manage →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pl-5 font-medium">Ticker</th>
                <th className="font-medium">Sector</th>
                <th className="hidden font-medium md:table-cell">LTP</th>
                <th className="hidden font-medium md:table-cell">Change</th>
                <th className="hidden font-medium lg:table-cell">Mkt Cap</th>
                <th className="font-medium">Signal</th>
                <th className="font-medium">Concentration</th>
                <th className="py-3 pr-5"></th>
              </tr>
            </thead>
            <tbody>
              {companyList.map((c) => {
                const up = c.change >= 0;
                const high = c.signalScore >= 75;
                const mid = c.signalScore >= 50;
                return (
                  <tr key={c.ticker} className="border-b last:border-b-0 transition-colors hover:bg-accent/40">
                    <td className="py-3 pl-5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 text-[10px] font-bold text-primary">
                          {c.ticker.slice(0, 3)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{c.ticker}</span>
                          <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[140px]">
                            {c.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{c.sector}</td>
                    <td className="hidden tabular md:table-cell">₹{c.lastPrice.toFixed(2)}</td>
                    <td className="hidden md:table-cell">
                      <span className={cn("inline-flex items-center gap-0.5 text-xs tabular", up ? "text-positive" : "text-critical")}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatPct(c.change)}
                      </span>
                    </td>
                    <td className="hidden text-xs tabular text-muted-foreground lg:table-cell">{formatINR(c.marketCap)}</td>
                    <td className="w-32">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={c.signalScore}
                          className="h-1.5 w-20"
                          indicatorClassName={cn(
                            high && "bg-critical",
                            !high && mid && "bg-warning",
                            !mid && "bg-positive",
                          )}
                        />
                        <span className={cn(
                          "w-7 text-xs tabular font-medium",
                          high && "text-critical",
                          !high && mid && "text-warning",
                          !mid && "text-positive",
                        )}>
                          {c.signalScore}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant={c.concentrationRisk >= 70 ? "critical" : c.concentrationRisk >= 50 ? "warning" : "neutral"}
                        className="text-[10px]"
                      >
                        {c.concentrationRisk}/100
                      </Badge>
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <Link
                        href={`/company/${c.ticker}`}
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
