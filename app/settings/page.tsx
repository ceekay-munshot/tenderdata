"use client";

import { Settings, Cloud, Cpu, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="h-3 w-3 text-primary" />
          <span>System</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Data sources, LLM provider, scraping cadence, and access controls.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4 text-primary" /> Data sources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "CPPP (eprocure.gov.in)", interval: "15 min", status: "live", coverage: "Central tenders" },
            { name: "GeM (Government e-Marketplace)", interval: "1 hour", status: "live", coverage: "GeM bid catalogue" },
            { name: "BSE Corporate Announcements", interval: "60 sec", status: "live", coverage: "Reg 30 disclosures" },
            { name: "NSE Corporate Filings", interval: "60 sec", status: "live", coverage: "NSE-listed announcements" },
            { name: "SEBI Enforcement Orders", interval: "6 hours", status: "live", coverage: "SEBI orders + penalties" },
            { name: "State Tender Portals", interval: "1 hour", status: "partial", coverage: "MH, KA, TN, GJ" },
            { name: "PIB Press Releases", interval: "15 min", status: "live", coverage: "Ministry press" },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">{s.coverage} · poll every {s.interval}</div>
              </div>
              <Badge variant={s.status === "live" ? "positive" : "warning"} className="text-[10px]">
                {s.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-primary" /> AI / LLM provider
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Used for PDF date extraction, disclosure severity tagging, and semantic sector matching.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Primary — Gemini 2.0 Flash (free tier)</div>
                <div className="text-[11px] text-muted-foreground">1500 req/day · structured output mode</div>
              </div>
              <Badge variant="positive" className="text-[10px]">Active</Badge>
            </div>
          </div>
          <div className="rounded-md border bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Fallback — Groq (Llama 3.3 70B)</div>
                <div className="text-[11px] text-muted-foreground">free tier · low latency</div>
              </div>
              <Badge variant="positive" className="text-[10px]">Active</Badge>
            </div>
          </div>
          <div className="rounded-md border bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Embeddings — bge-small-en-v1.5 (local)</div>
                <div className="text-[11px] text-muted-foreground">CPU-only · 384-dim · semantic sector filter</div>
              </div>
              <Badge variant="positive" className="text-[10px]">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> API access
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            For programmatic access to alerts and tender data. Pro tier and above.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
            sk-catalyst-***************************a92f
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">Rotate</Button>
            <Button variant="outline" size="sm">Copy</Button>
            <span className="text-xs text-muted-foreground">Last used 2h ago</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Catalyst surfaces public regulatory and procurement information. It is not investment advice. Trading
            decisions are the user&apos;s responsibility.
          </p>
          <p>
            For India operations, paid signal redistribution may attract SEBI Research Analyst regulations — keep
            an eye on RA registration thresholds as the product scales.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
