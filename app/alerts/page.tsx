"use client";

import { useState } from "react";
import { BellRing, Plus, Send, MessageSquare, Mail, Webhook, Banknote, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AlertRule {
  id: string;
  name: string;
  trigger: string;
  leadTime: string;
  channels: string[];
  enabled: boolean;
  matches: number;
  lastFired: string;
}

const rules: AlertRule[] = [
  {
    id: "r1",
    name: "Financial Bid Opening — 48h advance",
    trigger: "financial_bid_opening",
    leadTime: "48 hours",
    channels: ["telegram", "email"],
    enabled: true,
    matches: 24,
    lastFired: "BEL · Light Mountain Radar · 2h ago",
  },
  {
    id: "r2",
    name: "Critical disclosures — instant",
    trigger: "disclosure_critical",
    leadTime: "instant",
    channels: ["telegram", "slack"],
    enabled: true,
    matches: 12,
    lastFired: "BLS · MEA debarment · 4d ago",
  },
  {
    id: "r3",
    name: "Order Win — same-day digest",
    trigger: "disclosure_positive",
    leadTime: "end of day",
    channels: ["email"],
    enabled: true,
    matches: 18,
    lastFired: "HAL · LOI Sukhoi engine · today",
  },
  {
    id: "r4",
    name: "Technical Evaluation — 24h advance",
    trigger: "technical_evaluation",
    leadTime: "24 hours",
    channels: ["telegram"],
    enabled: false,
    matches: 8,
    lastFired: "—",
  },
];

const channelMeta: Record<string, { icon: typeof Send; label: string; color: string }> = {
  telegram: { icon: Send, label: "Telegram", color: "text-sky-500" },
  email: { icon: Mail, label: "Email", color: "text-violet-400" },
  slack: { icon: MessageSquare, label: "Slack", color: "text-emerald-400" },
  webhook: { icon: Webhook, label: "Webhook", color: "text-amber-400" },
};

const triggerMeta: Record<string, { icon: typeof Banknote; label: string; tone: "critical" | "warning" | "positive" }> = {
  financial_bid_opening: { icon: Banknote, label: "Financial Bid Opening", tone: "critical" },
  disclosure_critical: { icon: AlertTriangle, label: "Critical Disclosure", tone: "critical" },
  disclosure_positive: { icon: CheckCircle2, label: "Positive Disclosure", tone: "positive" },
  technical_evaluation: { icon: AlertTriangle, label: "Technical Evaluation", tone: "warning" },
};

export default function AlertsPage() {
  const [tgConnected, setTgConnected] = useState(true);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellRing className="h-3 w-3 text-primary" />
          <span>Notification Engine</span>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Real-time webhook + Telegram pings before D-Day. Configure once, position before the crowd.
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        </div>
      </header>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="history">Delivery history</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3">
          {rules.map((rule) => {
            const trig = triggerMeta[rule.trigger];
            const Icon = trig.icon;
            return (
              <Card key={rule.id} className="overflow-hidden">
                <CardContent className="flex flex-col items-start gap-4 p-5 md:flex-row md:items-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border",
                      trig.tone === "critical" && "border-critical/30 bg-critical/10 text-critical",
                      trig.tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
                      trig.tone === "positive" && "border-positive/30 bg-positive/10 text-positive",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{rule.name}</h3>
                      {rule.enabled ? (
                        <Badge variant="positive" className="text-[10px]">Enabled</Badge>
                      ) : (
                        <Badge variant="neutral" className="text-[10px]">Paused</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Trigger: <span className="text-foreground">{trig.label}</span></span>
                      <span>· Lead time: <span className="text-foreground">{rule.leadTime}</span></span>
                      <span>· Channels:</span>
                      <span className="inline-flex items-center gap-1">
                        {rule.channels.map((ch) => {
                          const cm = channelMeta[ch];
                          const Ico = cm.icon;
                          return <Ico key={ch} className={cn("h-3 w-3", cm.color)} aria-label={cm.label} />;
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-6">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Matches</div>
                      <div className="text-sm font-semibold tabular">{rule.matches}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last fired</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">{rule.lastFired}</div>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="channels" className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChannelCard
              icon={Send}
              name="Telegram"
              status={tgConnected ? "connected" : "disconnected"}
              detail={tgConnected ? "@catalyst_alerts_bot · chat ID 4892**" : "Not connected"}
              accent="text-sky-500"
              action={
                <Button variant={tgConnected ? "outline" : "default"} size="sm" onClick={() => setTgConnected(!tgConnected)}>
                  {tgConnected ? "Disconnect" : "Connect bot"}
                </Button>
              }
            />
            <ChannelCard
              icon={Mail}
              name="Email"
              status="connected"
              detail="operator@example.com"
              accent="text-violet-400"
              action={<Button variant="outline" size="sm">Change</Button>}
            />
            <ChannelCard
              icon={MessageSquare}
              name="Slack"
              status="connected"
              detail="#catalyst-signals in Acme Capital workspace"
              accent="text-emerald-400"
              action={<Button variant="outline" size="sm">Disconnect</Button>}
            />
            <ChannelCard
              icon={Webhook}
              name="Custom webhook"
              status="ready"
              detail="POST https://cloudflare-worker.example.workers.dev/catalyst"
              accent="text-amber-400"
              action={<Button variant="outline" size="sm">Test fire</Button>}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4 text-primary" /> Webhook payload preview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Exact JSON delivered to your endpoint on fire. Use this to wire bots, copy-trading scripts, or dashboards.
              </p>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 text-[11px] leading-relaxed">
{`{
  "event": "financial_bid_opening.upcoming",
  "lead_time_hours": 48,
  "ticker": "BEL",
  "company": "Bharat Electronics Limited",
  "tender_ref": "MoD/IAF/RADAR/2026/77",
  "title": "Light Mountain Radar Systems — 35 units",
  "buyer": "Ministry of Defence",
  "estimated_value_inr": 24800000000,
  "milestone": {
    "type": "financial_bid_opening",
    "scheduled_at": "2026-06-09T11:30:00+05:30"
  },
  "bidders": ["Bharat Electronics", "Tata Advanced Systems"],
  "match_confidence": 92,
  "fired_at": "2026-06-07T11:30:00+05:30",
  "source": "CPPP"
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent alert deliveries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { time: "2h ago", title: "BEL — Financial Bid Opening 48h advance", channels: "telegram, email", status: "delivered" },
                { time: "4h ago", title: "HAL — LOI for engine MRO (positive)", channels: "email", status: "delivered" },
                { time: "4d ago", title: "BLS — MEA debarment (critical)", channels: "telegram, slack", status: "delivered" },
                { time: "6d ago", title: "BLS — UAE contract loss (critical)", channels: "telegram, slack", status: "delivered" },
                { time: "9d ago", title: "RVNL — LOA Eastern DFC (positive)", channels: "email", status: "delivered" },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-sm">{row.title}</span>
                    <span className="text-[11px] text-muted-foreground">via {row.channels}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="positive" className="text-[10px]">{row.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">{row.time}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  name,
  status,
  detail,
  accent,
  action,
}: {
  icon: typeof Send;
  name: string;
  status: "connected" | "disconnected" | "ready";
  detail: string;
  accent: string;
  action: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-card/50">
          <Icon className={cn("h-5 w-5", accent)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{name}</h3>
            <Badge variant={status === "connected" || status === "ready" ? "positive" : "neutral"} className="text-[10px]">
              {status}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </CardContent>
    </Card>
  );
}
