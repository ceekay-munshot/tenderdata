"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Topbar() {
  const [query, setQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="relative flex max-w-md flex-1 items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tender, ministry, company..."
          className="h-9 pl-9"
        />
      </div>
      <div className="ml-auto hidden items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 lg:flex">
        <span className="live-dot" />
        <span className="text-xs text-muted-foreground">Live</span>
        <span className="text-[10px] text-muted-foreground tabular">· last sync 14s ago</span>
      </div>
    </header>
  );
}
