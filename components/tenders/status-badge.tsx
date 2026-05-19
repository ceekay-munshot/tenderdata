import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TenderStatus } from "@/lib/types";

const meta: Record<TenderStatus, { label: string; tone: "warning" | "neutral" | "positive" | "critical" }> = {
  pending: { label: "Pending", tone: "neutral" },
  evaluation: { label: "Under evaluation", tone: "warning" },
  result_in: { label: "Result in", tone: "positive" },
  awarded: { label: "Awarded", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "critical" },
};

export function StatusBadge({ status, className }: { status: TenderStatus; className?: string }) {
  const m = meta[status];
  return (
    <Badge
      variant={m.tone === "positive" ? "positive" : m.tone === "warning" ? "warning" : m.tone === "critical" ? "critical" : "neutral"}
      className={cn("uppercase tracking-wider text-[10px]", className)}
    >
      {m.label}
    </Badge>
  );
}
