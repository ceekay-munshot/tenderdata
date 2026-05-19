"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, ChevronDown, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="relative flex max-w-md flex-1 items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker, tender ref, ministry, bidder..."
          className="h-9 pl-9 pr-16"
        />
        <kbd className="pointer-events-none absolute right-3 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 lg:flex">
          <span className="live-dot" />
          <span className="text-xs text-muted-foreground">Feeds live</span>
          <span className="text-[10px] text-muted-foreground tabular">· 4 sources</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-critical" />
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Recent alerts</span>
              <Badge variant="critical" className="text-[10px]">3 new</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <NotifItem
              title="Financial Bid Opening in 48h"
              subtitle="BEL · Light Mountain Radar · 09 Jun"
              tone="critical"
              time="now"
            />
            <NotifItem
              title="Critical Disclosure: BLS"
              subtitle="MEA debarment order — 2 year ban"
              tone="critical"
              time="2h ago"
            />
            <NotifItem
              title="Positive Disclosure: HAL"
              subtitle="LOI received — Sukhoi-30 engine MRO"
              tone="positive"
              time="6h ago"
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/alerts" className="w-full text-center text-xs text-primary">
                View all alerts →
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-primary">CK</AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <div className="text-xs font-medium">Operator</div>
                <div className="text-[10px] text-muted-foreground">Pro plan</div>
              </div>
              <ChevronDown className="hidden h-3 w-3 text-muted-foreground md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>API keys</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function NotifItem({
  title,
  subtitle,
  tone,
  time,
}: {
  title: string;
  subtitle: string;
  tone: "critical" | "positive" | "warning";
  time: string;
}) {
  const dotColor = tone === "critical" ? "bg-critical" : tone === "positive" ? "bg-positive" : "bg-warning";
  return (
    <DropdownMenuItem className="flex items-start gap-3 py-2.5">
      <span className={`mt-1 inline-flex h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="flex-1 space-y-0.5">
        <div className="text-xs font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="text-[10px] text-muted-foreground">{time}</div>
    </DropdownMenuItem>
  );
}
