"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  Radio,
  Eye,
  BellRing,
  Building2,
  Sparkles,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const nav = [
  {
    section: "Intelligence",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, badge: null },
      { label: "Tender Calendar", href: "/calendar", icon: CalendarRange, badge: "Crystal Ball" },
      { label: "Disclosures", href: "/disclosures", icon: Radio, badge: "Live" },
    ],
  },
  {
    section: "Configuration",
    items: [
      { label: "Watchlist", href: "/watchlist", icon: Eye, badge: null },
      { label: "Companies", href: "/companies", icon: Building2, badge: null },
      { label: "Alerts", href: "/alerts", icon: BellRing, badge: null },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Settings", href: "/settings", icon: Settings, badge: null },
      { label: "Help & Docs", href: "/help", icon: HelpCircle, badge: null },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/30 backdrop-blur-sm md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Catalyst</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Corporate Detective</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5 scrollbar-thin">
        {nav.map((group) => (
          <div key={group.section}>
            <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.section}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <Badge
                        variant={item.badge === "Live" ? "positive" : "default"}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {item.badge === "Live" ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="live-dot" /> Live
                          </span>
                        ) : (
                          item.badge
                        )}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="rounded-lg border bg-gradient-to-br from-primary/10 to-transparent p-3">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">Pro tip</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Track buyers + competitors of a watched company to catch ecosystem moves.
          </p>
        </div>
      </div>
    </aside>
  );
}
