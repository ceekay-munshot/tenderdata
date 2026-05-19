"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Plus,
  Search,
  Building2,
  Users,
  Tag,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { companyList, sectorTags, buyerOptions, competitorOptions } from "@/lib/mock-data";

export default function WatchlistPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3 w-3 text-primary" />
          <span>Watchlist Manager</span>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Watchlist & Sector Filter</h1>
            <p className="text-sm text-muted-foreground">
              Add companies, define their sector with an AI-powered semantic filter, and track buyers + competitors.
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4" /> Add company
          </Button>
        </div>
      </header>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Tracked companies</TabsTrigger>
          <TabsTrigger value="sectors">Sector tags</TabsTrigger>
          <TabsTrigger value="ecosystem">Buyers & competitors</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <div className="relative flex flex-1 items-center">
                <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by ticker or name..."
                  className="h-9 pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {companyList.length} active · 3 high alert
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {companyList
              .filter(
                (c) =>
                  !query ||
                  c.ticker.toLowerCase().includes(query.toLowerCase()) ||
                  c.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((c) => (
                <Card key={c.ticker} className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div
                    className={cn(
                      "h-1",
                      c.signalScore >= 80 && "bg-critical",
                      c.signalScore >= 60 && c.signalScore < 80 && "bg-warning",
                      c.signalScore < 60 && "bg-positive",
                    )}
                  />
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {c.ticker.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-semibold tracking-tight">{c.ticker}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.exchange}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-critical">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div>
                      <div className="text-sm font-medium leading-tight">{c.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{c.industry}</div>
                    </div>

                    <div className="flex items-center justify-between border-y py-2.5 tabular">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">LTP</div>
                        <div className="text-sm font-semibold">₹{c.lastPrice.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change</div>
                        <div
                          className={cn(
                            "inline-flex items-center gap-0.5 text-sm font-semibold",
                            c.change >= 0 ? "text-positive" : "text-critical",
                          )}
                        >
                          {c.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {formatPct(c.change)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mkt Cap</div>
                        <div className="text-sm font-semibold">{formatINR(c.marketCap)}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Signal score</span>
                        <span
                          className={cn(
                            "font-semibold tabular",
                            c.signalScore >= 80 && "text-critical",
                            c.signalScore >= 60 && c.signalScore < 80 && "text-warning",
                            c.signalScore < 60 && "text-positive",
                          )}
                        >
                          {c.signalScore}/100
                        </span>
                      </div>
                      <Progress
                        value={c.signalScore}
                        className="h-1.5"
                        indicatorClassName={cn(
                          c.signalScore >= 80 && "bg-critical",
                          c.signalScore >= 60 && c.signalScore < 80 && "bg-warning",
                          c.signalScore < 60 && "bg-positive",
                        )}
                      />
                    </div>

                    <Link
                      href={`/company/${c.ticker}`}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs transition-colors hover:bg-accent"
                    >
                      <span className="text-muted-foreground">Open dossier</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Semantic sector tags
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Embeddings-based filter. Tenders are matched by meaning, not just keywords. We use{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">bge-small-en</code>
                {" + "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">cosine ≥ 0.62</code>
                {" + LLM verification on top matches."}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {sectorTags.map((tag) => (
                <div key={tag.id} className="rounded-lg border bg-card/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      <h3 className="font-medium">{tag.label}</h3>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">{tag.id}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tag.keywords.map((k) => (
                      <span key={k} className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ecosystem" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-primary" />
                  Tracked buyers (ministries / PSUs)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Map the demand side. Any tender originating from these entities is auto-routed to your watchlist.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {buyerOptions.map((b) => (
                  <div key={b} className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
                    <span className="text-sm">{b}</span>
                    <Badge variant="positive" className="text-[10px]">Active</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Tracked competitors
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  When a competitor wins (or loses), the watchlist company moves too. Catch ecosystem effects.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {competitorOptions.map((b) => (
                  <div key={b} className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
                    <span className="text-sm">{b}</span>
                    <Badge variant="warning" className="text-[10px]">Tracked</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
