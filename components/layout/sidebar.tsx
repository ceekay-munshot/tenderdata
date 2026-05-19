"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Tenders", href: "/", icon: FileText },
  { label: "Watchlist", href: "/watchlist", icon: Eye },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-card/30 backdrop-blur-sm md:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/20">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">TenderTrack</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">India</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-5">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span>Tracking 9 tenders · 6 watchlist</span>
        </div>
      </div>
    </aside>
  );
}
