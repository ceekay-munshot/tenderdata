import { Check, X, Eye, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { isWatched } from "@/lib/mock-data";
import type { Bidder } from "@/lib/types";

export function BidderChip({ bidder }: { bidder: Bidder }) {
  const watched = isWatched(bidder.ticker);

  const tone =
    bidder.status === "won"
      ? "positive"
      : bidder.status === "lost" || bidder.status === "disqualified"
      ? "critical"
      : bidder.status === "qualified"
      ? "primary"
      : watched
      ? "watch"
      : "neutral";

  const tones: Record<string, string> = {
    positive: "border-positive/40 bg-positive/15 text-positive",
    critical: "border-critical/40 bg-critical/15 text-critical",
    primary: "border-primary/40 bg-primary/15 text-primary",
    watch: "border-primary/40 bg-primary/10 text-primary",
    neutral: "border-border bg-muted text-foreground",
  };

  const Icon =
    bidder.status === "won" ? Check : bidder.status === "lost" || bidder.status === "disqualified" ? X : watched ? Eye : CircleDot;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs",
        tones[tone],
        watched && "ring-1 ring-primary/30",
      )}
    >
      <Icon className="h-3 w-3" />
      {bidder.ticker && <span className="font-mono text-[10px] font-semibold">{bidder.ticker}</span>}
      <span className="truncate">{bidder.name}</span>
      {bidder.status === "won" && <span className="text-[10px] font-semibold uppercase">won</span>}
      {bidder.status === "lost" && <span className="text-[10px] font-semibold uppercase">lost</span>}
      {bidder.status === "qualified" && <span className="text-[10px] uppercase">qualified</span>}
    </span>
  );
}
